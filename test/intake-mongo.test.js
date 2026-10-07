import test from 'node:test';
import assert from 'node:assert/strict';
import {createMongoIntakeAdapter} from '../intake-mongo.js';

// Deterministic network-latency model: every database round trip costs 250 ms.
// A transaction exceeding 60 s is rolled back, as on a time-limited server.
function fixture({failBulk=false}={}) {
  let saved={opportunities:[{id:'old',status:'Closed'}]},pending,elapsed=0,ended=false;
  const calls=[];
  const tick=()=>{elapsed+=250;if(elapsed>60000)throw Error('Transaction has been aborted (simulated lifetime limit)');};
  const session={async withTransaction(fn){pending=structuredClone(saved);try{await fn();saved=pending;}finally{pending=null;}},async endSession(){ended=true;}};
  const collection=name=>({
    async createIndex(){},async updateOne(q,u,o){if(o?.session)tick();},
    find(q,o){return{async toArray(){if(o?.session)tick();return structuredClone((pending||saved)[name]||[]);}};},
    async replaceOne(q,row,o){tick();assert.equal(o.session,session);const rows=pending[name]||=[];const i=rows.findIndex(r=>r.id===q.id);if(i<0)rows.push(structuredClone(row));else rows[i]=structuredClone(row);},
    async bulkWrite(ops,o){tick();calls.push({name,size:ops.length});assert.equal(o.session,session);if(failBulk)throw Error('Injected bulk write failure');for(const {replaceOne:r} of ops){const rows=pending[name]||=[];const i=rows.findIndex(v=>v.id===r.filter.id);if(i<0)rows.push(structuredClone(r.replacement));else rows[i]=structuredClone(r.replacement);}},
    async deleteMany(q,o){tick();assert.equal(o.session,session);pending[name]=(pending[name]||[]).filter(r=>!q.id.$in.includes(r.id));}
  });
  const adapter=createMongoIntakeAdapter({env:{MONGODB_URL:'test'},loadTalent:async()=>[],clientFactory:()=>({async connect(){return this;},db(){return{collection};},startSession(){elapsed=0;return session;}})});
  return{adapter,calls,get data(){return saved;},get elapsed(){return elapsed;},get ended(){return ended;}};
}
function addDraft(db,count=500){db.opportunityIntakes.push({id:'draft',status:'pending',search:{candidates:Array.from({length:count},(_,i)=>({id:String(i),name:'Candidate '+i,score:80}))}});}

test('large candidate intake commits within transaction budget without losing history or duplicating results',async()=>{
  const f=fixture();await f.adapter.transaction(db=>addDraft(db));
  assert.equal(f.data.intakeSearchResults.length,500);
  assert.deepEqual(f.data.opportunities,[{id:'old',status:'Closed'}]);
  assert.equal(f.data.opportunityIntakes.length,1);assert.equal(f.data.opportunityIntakes[0].search.candidates,undefined);
  assert.ok(f.elapsed<60000);assert.ok(f.ended);
  const before=f.calls.length;await f.adapter.transaction(()=>{});assert.equal(f.calls.length,before);
  assert.equal((await f.adapter.read()).opportunityIntakes[0].search.candidates.length,500);
});

test('failed candidate write rolls back the draft and preserves earlier records',async()=>{
  const f=fixture({failBulk:true});await assert.rejects(f.adapter.transaction(db=>addDraft(db,2)),/Injected bulk write failure/);
  assert.deepEqual(f.data,{opportunities:[{id:'old',status:'Closed'}]});assert.ok(f.ended);
});

test('changed search only replaces its own results and keeps other drafts',async()=>{
  const f=fixture();await f.adapter.transaction(db=>{addDraft(db,3);db.opportunityIntakes.push({id:'other',search:{candidates:[{id:'keep'}]}});});
  await f.adapter.transaction(db=>{db.opportunityIntakes.find(d=>d.id==='draft').search.candidates=[{id:'1',score:99}];});
  assert.equal(f.data.intakeSearchResults.length,2);assert.equal(f.data.intakeSearchResults.find(r=>r.id==='draft:1').candidate.score,99);
  assert.equal(f.data.intakeSearchResults.find(r=>r.id==='other:keep').candidate.id,'keep');
});
