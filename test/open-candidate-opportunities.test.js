import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {requireOpenCandidateOpportunity,advanceSelectedCandidateToInterview} from '../server.js';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
function extract(source,name){
 const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));
 assert.ok(start>=0);const rest=source.slice(start);const next=rest.slice(1).search(/\n(?:export )?(?:async )?function |\nconst server =/);
 return next<0?rest:rest.slice(0,next+1);
}
const statuses=['Open','Closed','WON','LOST','Freezing','','open',undefined];
test('somente Open exato permite novo vínculo, inclusive após fechamento da tela',()=>{
 for(const status of statuses){
  const db={opportunities:[{id:'o',status}]};
  if(status==='Open')assert.equal(requireOpenCandidateOpportunity(db,' o '),db.opportunities[0]);
  else assert.throws(()=>requireOpenCandidateOpportunity(db,'o'),{statusCode:422});
 }
 assert.throws(()=>requireOpenCandidateOpportunity({opportunities:[]},'missing'),{statusCode:422});
});
test('avanço de lista antiga fechada não cria candidato nem modifica histórico',()=>{
 for(const status of statuses.filter(s=>s!=='Open')){
  const db={opportunities:[{id:'o',status}],selectedCandidates:[{id:'s',opportunityId:'o',name:'Teste'}],candidates:[]};
  const before=JSON.stringify(db);
  assert.throws(()=>advanceSelectedCandidateToInterview(db,'s'),{statusCode:422});
  assert.equal(JSON.stringify(db),before);
 }
});
test('cadastro, filtro CV e modal usam só Open; seleção antiga é retirada',()=>{
 function select(value){return {value,options:[],set innerHTML(html){this.html=html;this.options=[...html.matchAll(/value="([^"]*)"/g)].map(m=>({value:m[1]}));this.value='';},get innerHTML(){return this.html;}};}
 const selects=[select('Closed'),select('Open'),select('WON')];
 const state={opportunities:statuses.map((status,i)=>({id:String(status),status,opportunityCode:i})),clients:[],opportunityStatuses:[],opportunityModels:[],opportunityContractTypes:[],opportunityWorkModels:[],stages:[],aderenciaOptions:[],users:[],curriculums:[]};
 const ctx=vm.createContext({state,$:()=>null,$$:s=>s==='select[name="opportunityId"]'?selects:[],fallbackCitiesByUf:{},byCurriculumControl:()=>0,byOpportunityCode:(a,b)=>a.opportunityCode-b.opportunityCode,opportunityLabel:o=>o.id,escapeHtml:x=>x,updateOpportunityContactOptions:()=>{}});
 vm.runInContext(extract(app,'openOpportunitiesForCurriculumSelection')+'\n'+extract(app,'renderOptions'),ctx);
 ctx.renderOptions();
 for(const s of selects)assert.deepEqual(s.options.map(x=>x.value),['','Open']);
 assert.equal(selects[0].value,'');assert.equal(selects[1].value,'Open');
 const type={value:'opportunity'},value=select('Closed');ctx.$=s=>s==='#candidateFilterType'?type:value;
 vm.runInContext(extract(app,'renderCandidateFilters'),ctx);ctx.renderCandidateFilters();
 assert.deepEqual(value.options.map(x=>x.value),['','Open']);assert.equal(value.value,'');
 assert.match(extract(app,'renderSelectedCandidates'),/opportunityOptions = .*openOpportunitiesForCurriculumSelection\(\)/);
});
test('rotas bloqueiam vínculo fechado sem persistência ou envio',async()=>{
 const cases=[['POST','/api/candidates',{name:'Teste',opportunityId:'closed'}],['POST','/api/selected-candidates',{opportunityId:'closed',candidates:[{name:'Teste'}]}],['POST','/api/cv-filters',{opportunityId:'closed',coreSkill:'SAP'}],['PATCH','/api/cv-filters/f',{opportunityId:'closed'}],['POST','/api/cv-filters/f/search',{}],['PATCH','/api/candidates/c',{opportunityId:'closed',name:'Não modificar'}],['PATCH','/api/candidates/c',{opportunityId:'closed',curriculumId:'other'}]];
 for(const [method,url,payload] of cases){
  const db={opportunities:[{id:'closed',status:'Closed'},{id:'open',status:'Open'}],candidates:[{id:'c',name:'Original',opportunityId:'open',curriculumId:'old'}],cvFilters:[{id:'f',opportunityId:'closed'}]};
  const before=JSON.stringify(db);let result;
  const ctx=vm.createContext({process:{env:{}},getRoute:r=>new URL(r.url,'http://test'),authenticateRequest:async()=>({user:{id:'u'}}),isConsultantUser:()=>false,isBusinessCalendarCollectionPath:()=>false,businessCalendarItemIdFromPath:()=>null,readDatabase:async()=>db,readJsonBody:async()=>payload,sendError:(_,code,message)=>result={code,message},sendJson:()=>assert.fail('Resposta de sucesso inesperada'),toISODate:()=>'',normalizeCvFilter:x=>x,normalizeStage:x=>x,normalizeAderencia:x=>x,createId:()=> 'new',databaseWithResolvedCurriculum:d=>d,curriculumIdentifierForCandidate:()=>'',isApprovedValue:()=>false,requireOpenCandidateOpportunity});
  vm.runInContext(extract(server,'handleApi'),ctx);await ctx.handleApi({method,url},{});
  assert.equal(result?.code,422,`${method} ${url}: ${result?.message}`);assert.match(result.message,/status Open/);assert.equal(JSON.stringify(db),before);
 }
});
