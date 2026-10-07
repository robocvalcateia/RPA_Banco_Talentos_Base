import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createIntakeStore } from '../opportunity-intake.js';
import { createHourlyIntake, listDttMessages, isDttMessage } from '../intake-hourly.js';
import { INTAKE_EXAMPLE } from '../intake-example.js';
const message={id:'immutable-1',internetMessageId:'mail-1',subject:'SOLICITAÇÃO DE COTAÇÃO -VAGA 2054 - SAP FI',from:{emailAddress:{address:'poolterceiros@deloitte.com'}},receivedDateTime:'2026-10-04T12:00:00.000Z',body:{contentType:'text',content:INTAKE_EXAMPLE}};
const user={id:'reviewer',name:'Gerson'};
async function fixture(t){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dtt-hourly-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'db.json'); await fs.writeFile(file,JSON.stringify({clients:[{id:'dtt',customerName:'DTT'}],users:['gerson','bruno'].map(id=>({id,name:id,email:`${id}@alcateiaconsulting.com.br`,active:true})),curriculums:[],opportunities:[]}));
  const store=createIntakeStore(file); let time='2026-10-04T12:00:00.000Z';const sent=[],logs=[];
  const options={store,getToken:async()=> 'fake-token',fetchMessages:async()=>[message],send:async m=>sent.push(m),log:async m=>logs.push(m),now:()=>time};
  return{store,sent,logs,options,read:async()=>JSON.parse(await fs.readFile(file,'utf8')),setTime:value=>{time=value;}};
}
test('hourly receipt sends same link to both reviewers, persists across restarts and stops after confirmation',async t=>{
  const f=await fixture(t);const worker=createHourlyIntake(f.options);
  const first=await worker.run();assert.equal(first.sent,2);assert.equal((await f.store.list()).length,1);
  assert.deepEqual(f.sent.map(m=>m.to),['gerson@alcateiaconsulting.com.br','bruno@alcateiaconsulting.com.br']);
  assert.equal(f.sent[0].text,f.sent[1].text);assert.match(f.sent[0].subject,/2054 - SAP FI/);
  assert.equal((await worker.run()).skipped,true);assert.equal(f.sent.length,2);
  f.setTime('2026-10-04T13:00:00.000Z');await createHourlyIntake(f.options).run();assert.equal(f.sent.length,4);assert.equal((await f.store.list()).length,1);
  const draft=(await f.store.list())[0];await f.store.confirm(draft.id,draft.revision,[],user,true);
  assert.equal((await f.read()).opportunities[0].clientOpportunityCode,'2054');
  f.setTime('2026-10-04T14:00:00.000Z');await worker.run();assert.equal(f.sent.length,4);assert.equal(f.logs.length,4);
});
test('cancellation stops reminders; same vacancy with changed title remains one draft',async t=>{
  const f=await fixture(t);await createHourlyIntake(f.options).run();
  const draft=(await f.store.list())[0];
  f.setTime('2026-10-04T13:00:00.000Z');await createHourlyIntake({...f.options,fetchMessages:async()=>[{...message,id:'other',internetMessageId:'other',subject:'SOLICITAÇÃO DE COTAÇÃO -VAGA 2054 - Título alterado'}]}).run();
  assert.equal((await f.store.list()).length,1);await f.store.cancel(draft.id,draft.revision,user);
  f.setTime('2026-10-04T14:00:00.000Z');await createHourlyIntake(f.options).run();assert.equal(f.sent.length,4);
});
test('SMTP failure affects only recipient, is recorded, and retries no sooner than next hour',async t=>{
  const f=await fixture(t);const run=createHourlyIntake({...f.options,send:async m=>{if(m.to.startsWith('gerson'))throw Error('do not expose transport secrets');f.sent.push(m);}});
  await run.run();assert.equal(f.sent.length,1);assert.equal(f.logs.filter(l=>l.status==='failed').length,1);assert.ok(!JSON.stringify(f.logs).includes('transport secrets'));
  f.setTime('2026-10-04T12:59:59.000Z');assert.equal((await run.run()).skipped,true);
  f.setTime('2026-10-04T13:00:00.000Z');await run.run();assert.equal(f.sent.length,2);
});
test('concurrent workers share durable cycle claim and reminders are not duplicated',async t=>{
  const f=await fixture(t);const results=await Promise.all([createHourlyIntake(f.options).run(),createHourlyIntake(f.options).run()]);
  assert.equal(results.filter(r=>r.skipped).length,1);assert.equal(f.sent.length,2);
});
test('mailbox failure leaves checkpoint unchanged and still reminds existing pending drafts',async t=>{
  const f=await fixture(t);await createHourlyIntake(f.options).run();const before=await f.store.schedulerStatus();
  f.setTime('2026-10-04T13:00:00.000Z');await createHourlyIntake({...f.options,getToken:async()=>{throw Error('Graph unavailable');}}).run();
  const after=await f.store.schedulerStatus();assert.equal(after.checkpoint,before.checkpoint);assert.equal(after.status,'error');assert.equal(f.sent.length,4);
});
test('Graph pagination requests text, filters sender and subject, and rejects permission errors and untrusted links',async()=>{
  let count=0;
  const rows=await listDttMessages({token:'fake',since:'2026-10-04T12:00:00Z',until:'2026-10-04T13:00:00Z',fetchImpl:async(url,options)=>{
    count++;assert.match(options.headers.Prefer,/body-content-type="text"/);
    return {ok:true,json:async()=>count===1?{value:[message], '@odata.nextLink':'https://graph.microsoft.com/v1.0/next'}:{value:[{...message,from:{emailAddress:{address:'other@example.test'}}}]}};
  }});assert.equal(count,2);assert.equal(rows.length,1);
  await assert.rejects(listDttMessages({token:'fake',since:message.receivedDateTime,until:message.receivedDateTime,fetchImpl:async()=>({ok:false,status:403})}),/403/);
  await assert.rejects(listDttMessages({token:'fake',since:message.receivedDateTime,until:message.receivedDateTime,fetchImpl:async()=>({ok:true,json:async()=>({value:[], '@odata.nextLink':'https://example.test/steal'})})}),/inválida/);
  assert.equal(isDttMessage({...message,subject:'Outra mensagem'}),false);
});
test('no historical import before activation; simulated run never calls real transport',async t=>{
  const f=await fixture(t);f.setTime('2026-10-04T13:00:00.000Z');const r=await createHourlyIntake({...f.options,simulated:true}).run();
  assert.equal(r.received,0);assert.equal(f.sent.length,0);
});

test('admin recovery only retries failed enabled cycles, preserving the checkpoint and preventing duplicate schedules',async t=>{
  const f=await fixture(t);await f.store.activate('2026-10-04T11:00:00.000Z',user);
  await createHourlyIntake({...f.options,getToken:async()=>{throw Error('Temporary failure');}}).run();
  const before=await f.store.schedulerStatus();await f.store.retryFailedCycle();
  await assert.rejects(f.store.retryFailedCycle(),/Somente/);
  assert.equal((await f.store.schedulerStatus()).checkpoint,before.checkpoint);
  const result=await createHourlyIntake(f.options).run();assert.equal(result.received,1);assert.equal(result.sent,2);
  await assert.rejects(f.store.retryFailedCycle(),/Somente/);
});
