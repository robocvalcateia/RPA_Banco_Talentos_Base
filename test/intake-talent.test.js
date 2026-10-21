import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntakeTalentReader} from '../intake-talent.js';
import {matchIntakeCandidates} from '../opportunity-intake.js';

test('production search streams CVs, preserves complete matching and avoids a bulk toArray', async()=>{
  const rows=[{id:'1',nome:'Consultor A',experiencia_profissional:'Consultor SAP FI, implementação e parametrização FI-GL FI-AP FI-AR.'},{id:'2',nome:'Consultor B',experiencia_profissional:'Desenvolvimento Java.'}];
  let reads=0,batch;
  const reader=createIntakeTalentReader({convert:x=>x,getCollection:async()=>({find(){return {batchSize(n){batch=n;return this;},async *[Symbol.asyncIterator](){for(const row of rows){reads++;yield row;}},toArray(){throw Error('Bulk loading forbidden');}};}})});
  const fields={profile:'Consultor SAP FI',coreSkill:'SAP FI',requirements:'SAP FI implementação',workModel:'Remoto'};
  const result=await reader.searchCandidates(fields);
  assert.equal(reads,2);assert.equal(batch,5);assert.equal(result.totalEvaluated,2);
  assert.deepEqual(result.candidates,matchIntakeCandidates(rows,fields));
});

test('runtime with no candidates does not query CVs and review fetches only eligibility/contact fields',async()=>{
  let calls=0,query,projection;
  const reader=createIntakeTalentReader({convert:x=>x,getCollection:async()=>({find(q,o){calls++;query=q;projection=o.projection;return {batchSize(){return this;},async *[Symbol.asyncIterator](){yield {id_controle:1197,telefone:'11999999999'};}};}})});
  assert.deepEqual(await reader.loadTalent([]),[]);assert.equal(calls,0);
  assert.equal((await reader.loadTalent(['1197']))[0].id_controle,1197);
  assert.ok(query.$or[0].id_controle.$in.includes(1197));assert.ok(query.$or[0].id_controle.$in.includes('1197'));
  assert.equal(projection.telefone,1);assert.equal(projection.experiencia_profissional,undefined);assert.equal(projection.blacklist,1);
});
