import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { curriculumProfessionalEvidence } from '../candidate-screening.js';
import { matchIntakeCandidates } from '../opportunity-intake.js';

test('main-skill evidence works with job titles and rejects keyword-only profiles across domains',()=>{
 for(const [title,work] of [
  ['Consultor Tax One - Pleno','Consultor Tax One. Implementação Tax One para clientes.'],
  ['Analista de Compras Senior','Analista de Compras. Negociação com fornecedores.'],
  ['Consultor SAP FI Pleno','Consultor SAP FI. Implementação SAP FI.'],
  ['Desenvolvedor Python Sênior','Desenvolvedor Python em projetos de APIs.'],
  ['Consultor Coupa','Consultor Coupa em implementação para cliente final.'],
  ['Consultor SAP SuccessFactors EC/Benefits/Onboarding','Consultor SAP SuccessFactors. Implementação Employee Central.'],
  ['Consultor BlueYonder WMS','Consultor BlueYonder WMS em implantação.'],
  ['Analistas Fiscais Sêniores – E-commerce','Analista fiscal em operações de e-commerce, apuração de ICMS.']
 ]) {
  assert.equal(curriculumProfessionalEvidence({experiencia_profissional:work},title).found,true,title);
  for(const cv of [{skills:work},{cargo_alvo:work},{search_text_all:work},{cursos_certificacoes:work},{experiencia_profissional:'Curso de '+work}]) assert.equal(curriculumProfessionalEvidence(cv,title).found,false,title+JSON.stringify(cv));
 }
 assert.equal(curriculumProfessionalEvidence({experiencia_profissional:'Analista fiscal em operações industriais.'},'Analistas Fiscais Sêniores – E-commerce').found,false);
 assert.equal(curriculumProfessionalEvidence({experiencia_profissional:'Gerente de projetos. ERP, compras, contratos e orçamento.'},'Analista de Compras Senior').found,false);
});

test('SuccessFactors main experience does not silently validate missing requested submodules',()=>{
 const fields={profile:'SAP SuccessFactors EC/Benefits/Onboarding',coreSkill:'SAP SuccessFactors EC/Benefits/Onboarding',workModel:'Remoto',requirements:'',mandatorySkills:'',desirable:''};
 const result=matchIntakeCandidates([{id:'sf',experiencia_profissional:'Consultor SAP SuccessFactors. Implementação Employee Central.'}],fields)[0];
 assert.ok(result);assert.equal(result.classification,'review');
 assert.notEqual(result.comparison.find(c=>c.criterionId==='sf-benefits').status,'evidence');
 assert.notEqual(result.comparison.find(c=>c.criterionId==='sf-onboarding').status,'evidence');
});

test('structured professional projects count; title qualifiers are not silently discarded',()=>{
 assert.equal(curriculumProfessionalEvidence({projetos:[{descricao:'Consultor SAP FI. Implementação SAP FI.'}]},'Consultor SAP FI Pleno').found,true);
 const fields={profile:'Analistas Fiscais Sêniores – E-commerce',coreSkill:'Analistas Fiscais Sêniores – E-commerce',workModel:'Remoto',requirements:'',mandatorySkills:'',desirable:''};
 const results=matchIntakeCandidates([
   {id:'a',experiencia_profissional:'Analista fiscal em operações de e-commerce.'},
   {id:'b',experiencia_profissional:'Analista fiscal na indústria.'}
 ],fields);
 assert.equal(results.length,2);assert.equal(results.find(c=>c.id==='a').classification,'approved');assert.equal(results.find(c=>c.id==='b').classification,'review');
});

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const apiSource=source.slice(source.indexOf('async function api(path,'),source.indexOf('async function apiDownload('));
function apiFixture(fetchImpl){
 let cleared=0,login=0,calls=0;
 const context={session:{token:'qa'},isFormDataBody:()=>false,repairEncodingArtifacts:s=>s,sanitizeApiPayload:p=>p,clearSession:()=>cleared++,showLogin:()=>login++,showPasswordChange:()=>{},fetch:async(...args)=>{calls++;return fetchImpl(...args);}};
 vm.createContext(context);vm.runInContext(apiSource,context);
 return {call:(...args)=>context.api(...args),get cleared(){return cleared;},get login(){return login;},get calls(){return calls;}};
}
test('HTTP 502 HTML and network loss are explicit and never replay a write automatically',async()=>{
 for(const status of [500,502,503,504]){
  const f=apiFixture(async()=>new Response('<html>unavailable</html>',{status}));
  await assert.rejects(f.call('/api/intake/qa/confirm',{method:'POST'}),e=>e.status===status && e.uncertain && e.message.includes('Atualize'));
  assert.equal(f.calls,1);
 }
 const f=apiFixture(async()=>{throw Error('offline');});
 await assert.rejects(f.call('/api/intake/qa/confirm',{method:'POST'}),e=>e.uncertain && e.message.includes('pode ter sido concluída'));assert.equal(f.calls,1);
});
test('session expiry, conflicts, validation and invalid JSON remain distinguishable',async()=>{
 const f=apiFixture(async()=>new Response('',{status:401}));await assert.rejects(f.call('/api/intake/qa'),/sessão expirou/);assert.equal(f.cleared,1);assert.equal(f.login,1);
 for(const status of [409,422]) {const f=apiFixture(async()=>Response.json({error:'Mensagem de validação'},{status}));await assert.rejects(f.call('/api/intake/qa'),e=>e.status===status && e.message==='Mensagem de validação');}
 const bad=apiFixture(async()=>new Response('not-json',{status:200}));await assert.rejects(bad.call('/api/intake/qa'),/resposta incompleta/);
});
