import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { startIntakeQa } from '../test-support/intake-http-fixture.js';
import { INTAKE_EXAMPLE } from '../intake-example.js';

test('HTTP accepts production legacy hybrid wording without requiring a prior edit',async t=>{
 const qa=await startIntakeQa();t.after(()=>qa.stop());
 const token=await qa.login('gerson@alcateiaconsulting.com.br');
 const received=await qa.request('/api/intake/receive',{token,method:'POST',body:{mailbox:'gerson@alcateiaconsulting.com.br',sender:'poolterceiros@deloitte.com',subject:'SOLICITAÇÃO DE COTAÇÃO - VAGA 9998 - SAP FI',messageId:'legacy-work-model',body:INTAKE_EXAMPLE}});
 assert.equal(received.status,200);
 const db=await qa.read(),draft=db.opportunityIntakes[0];draft.fields.workModel='Hibrido – 2x presencial';
 await fs.writeFile(qa.file,JSON.stringify(db));
 const result=await qa.request('/api/intake/'+draft.id+'/confirm',{token,method:'POST',body:{revision:draft.revision,selectedIds:[],acknowledged:true}});
 assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.opportunity.workModel,'Híbrido');
 const state=await qa.read();assert.equal(state.opportunities.length,1);assert.equal(state.opportunities[0].workModel,'Híbrido');
});

test('real HTTP intake lifecycle: permissions, zero candidates, concurrency, idempotency and atomic failures',async t=>{
 const qa=await startIntakeQa();t.after(()=>qa.stop());
 const a=await qa.login('gerson@alcateiaconsulting.com.br'),b=await qa.login('bruno@alcateiaconsulting.com.br');
 const consultant=await qa.login('consultor@example.test'),change=await qa.login('troca@example.test');
 const call=(url,method,body,token=a)=>qa.request(url,{method,body,token});
 await t.test('unauthenticated, consultant and forced password-change users cannot open intake',async()=>{
   assert.equal((await qa.request('/api/intake/drafts')).status,401);
   assert.equal((await call('/api/intake/drafts','GET',undefined,consultant)).status,403);
   assert.equal((await call('/api/intake/drafts','GET',undefined,change)).status,403);
 });
 const mail=number=>({mailbox:'gerson@alcateiaconsulting.com.br',sender:'poolterceiros@deloitte.com',subject:`SOLICITAÇÃO DE COTAÇÃO - VAGA ${number} - SAP FI`,messageId:'qa-'+number,body:INTAKE_EXAMPLE});
 const created=await call('/api/intake/receive','POST',mail(9001));assert.equal(created.status,200,JSON.stringify(created.body));
 const id=created.body.draft.id,route='/api/intake/'+id;
 await t.test('receipt and replay never duplicate opportunity, draft or notifications',async()=>{
   assert.equal((await call('/api/intake/receive','POST',mail(9001))).body.draft.id,id);
   const db=await qa.read();assert.equal(db.opportunityIntakes.length,1);assert.equal(db.opportunities.length,0);assert.equal(db.intakeNotifications.length,2);
   assert.ok(db.intakeNotifications.every(n=>n.simulated===true));
 });
 await t.test('stale second reviewer cannot overwrite a saved revision',async()=>{
   const current=(await call(route,'GET')).body;
   const body={revision:current.draft.revision,fields:{...current.draft.fields,observation:'QA saved'}};
   const results=await Promise.all([call(route+'/review','POST',body,a),call(route+'/review','POST',{...body,fields:{...body.fields,observation:'other'}},b)]);
   assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 });
 await t.test('invalid quantity, month, candidate and revision do not partly create data',async()=>{
   let current=(await call(route,'GET')).body;
   assert.equal((await call(route+'/review','POST',{revision:current.draft.revision,fields:{...current.draft.fields,start:'13/2026'}})).status,422);
   assert.equal((await call(route+'/confirm','POST',{revision:current.draft.revision,selectedIds:['nonexistent'],acknowledged:true})).status,422);
   assert.equal((await qa.read()).opportunities.length,0);
   assert.equal((await qa.read()).selectedCandidates.length,0);
   for(const fields of [null,[],undefined]) assert.equal((await call(route+'/review','POST',{revision:current.draft.revision,fields})).status,422);
   for(const [key,value] of [['quantity','-1'],['quantity','1.5'],['model','INVALID'],['workModel','INVALID']]) assert.equal((await call(route+'/review','POST',{revision:current.draft.revision,fields:{...current.draft.fields,[key]:value}})).status,422);
 });
 await t.test('confirming twice without selected candidates creates one Open opportunity',async()=>{
   const current=(await call(route,'GET')).body;
   const payload={revision:current.draft.revision,selectedIds:[],acknowledged:true};
   const first=await call(route+'/confirm','POST',payload);assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.opportunity.status,'Open');
   const second=await call(route+'/confirm','POST',payload,b);assert.equal(second.status,200);assert.equal(second.body.repeated,true);
   const db=await qa.read();assert.equal(db.opportunities.length,1);assert.equal(db.selectedCandidates.length,0);assert.equal(db.intakeNotifications.length,2);
 });
 await t.test('new vacancy with no candidates is still confirmable and closing is idempotent',async()=>{
   const result=await call('/api/intake/receive','POST',{...mail(9002),subject:'SOLICITAÇÃO DE COTAÇÃO - VAGA 9002 - Tecnologia Inexistente',body:'Vaga: Tecnologia Inexistente'});
   assert.equal(result.status,200,JSON.stringify(result.body));const d=result.body.draft;
   const view=(await call('/api/intake/'+d.id,'GET')).body;assert.equal(view.candidates.length,0);
   const c=await call('/api/intake/'+d.id+'/confirm','POST',{revision:d.revision,selectedIds:[],acknowledged:true});assert.equal(c.status,200,JSON.stringify(c.body));
   const third=(await call('/api/intake/receive','POST',mail(9003))).body.draft;
   const cancel='/api/intake/'+third.id+'/cancel';assert.equal((await call(cancel,'POST',{revision:third.revision})).status,200);assert.equal((await call(cancel,'POST',{revision:third.revision})).status,200);
   assert.equal((await call('/api/intake/'+third.id+'/confirm','POST',{revision:third.revision,selectedIds:[]})).status,409);
   assert.equal((await qa.read()).opportunities.length,2);
 });
 await t.test('logout invalidates access and integration writes remain blocked in QA',async()=>{
   assert.equal((await call('/api/intake/activate','POST',{})).status,403);
   assert.equal((await call('/api/logout','POST',{})).status,200);
   assert.equal((await call('/api/intake/drafts','GET')).status,401);
 });
 await t.test('a deactivated user loses an already-issued session immediately',async()=>{
   const db=await qa.read();db.users.find(u=>u.id==='qa-b').active=false;await fs.writeFile(qa.file,JSON.stringify(db));
   assert.equal((await call('/api/intake/drafts','GET',undefined,b)).status,403);
   assert.equal((await call('/api/intake/drafts','GET',undefined,b)).status,401);
 });
});
