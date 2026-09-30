import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
function extract(source,name){
 const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);
 const rest=source.slice(start),next=rest.slice(1).search(/\n(?:export )?(?:async )?function |\nconst server =/);
 return next<0?rest:rest.slice(0,next+1);
}
const user={id:'u',name:'Ana',email:'ana@example.test',role:'Consultor'};
function ui(enabled=true){
 const nodes={};const state={currentUser:user,allocateds:[{id:'mine',consultant:'Ana',consultantEmail:user.email,clientId:'c',active:true},{id:'other',consultant:'Bia',consultantEmail:'bia@example.test',clientId:'c',active:true}],clients:[{id:'c',usesTimesheet:enabled}]};
 const $=s=>nodes[s]??=( {textContent:'',hidden:false,children:[],replaceChildren(...x){this.children=x;},append(...x){this.children.push(...x);}} );
 const ctx=vm.createContext({state,session:{},$: $,normalizeText:x=>String(x||'').toLowerCase(),launcherNodes:{statusReports:{},billingReportEntry:{}},createLauncherCard:id=>{const tags={strong:{},small:{}};return {id,querySelector:q=>tags[q],tags};}});
 for(const name of ['currentUserRole','isCurrentUserAdmin','isCurrentUserConsultant','currentUserEmail','currentUserNameKey','activeAllocatedsForCurrentUser','workHourAllocatedOptions','canCurrentUserAccessWorkHours','canAccessView','renderConsultantHome'])vm.runInContext(extract(app,name),ctx);
 return {ctx,state,nodes};
}
test('consultor vê dois cards, Billing habilitado somente para cliente elegível',()=>{
 for(const enabled of [true,false]){
  const {ctx,state,nodes}=ui(enabled);ctx.renderConsultantHome();const cards=nodes['#moduleDrillCards'].children;
  assert.deepEqual(cards.map(c=>c.tags.strong.textContent),['Status Report','Billing']);
  assert.equal(cards[1].disabled,!enabled);assert.equal(ctx.canAccessView('dashboard'),true);assert.equal(ctx.canAccessView('statusReports'),true);assert.equal(ctx.canAccessView('billingReport'),enabled);
  for(const view of ['clients','users','faturamento','statusReportManagement','workHours'])assert.equal(ctx.canAccessView(view),false);
  state.allocateds[0].active=false;assert.equal(ctx.canCurrentUserAccessWorkHours(),false,'alocação de outro consultor não habilita Billing');
 }
});
test('Billing consultor força apontamento e login abre a tela de cards',async()=>{
 const {ctx,state}=ui();const panels=['entry','query','registrations'].map(p=>({dataset:{billingPanel:p}}));ctx.$$=()=>panels;
 vm.runInContext(extract(app,'renderBillingReportPanels'),ctx);state.activeBillingReportPanel='registrations';ctx.renderBillingReportPanels();
 assert.deepEqual(panels.map(p=>p.hidden),[false,true,true]);
 let view;Object.assign(ctx,{api:async()=>({currentUser:user}),render:()=>{},showApp:()=>{},showView:v=>view=v,applyInitialRoute:()=>assert.fail('Não abrir rota administrativa')});
 vm.runInContext(extract(app,'refresh'),ctx);await ctx.refresh();assert.equal(view,'dashboard');assert.equal(state.activeStatusReportPanel,'consultant');
});
function apiHarness({enabled=true,active=true,period='OPEN',payload={},method='POST',url='/api/work-hours'}={}){
 const db={clients:[{id:'c',usesTimesheet:enabled,timesheetMode:'simplified'}],allocateds:[{id:'mine',consultant:'Ana',consultantEmail:user.email,clientId:'c',active},{id:'other',consultant:'Bia',consultantEmail:'bia@example.test',clientId:'c',active:true}],workHours:[],workHourAudit:[],businessCalendar:[],timesheetProjects:[{id:'p',clientId:'c',name:'Projeto',active:true}],timesheetPeriods:[{clientId:'c',monthYear:'2026-09',status:period}]};
 let result,writes=0;
 const ctx=vm.createContext({getRoute:r=>new URL(r.url,'http://test'),authenticateRequest:async()=>({user}),readDatabaseCollections:async()=>db,readJsonBody:async()=>({allocatedId:'mine',date:'2026-09-15',projectId:'p',mode:'simplified',hours:8,...payload}),sendError:(_,code,message)=>result={code,message},sendJson:(_,code,data)=>result={code,data},writeDatabaseCollections:async()=>writes++,simplifyFormText:s=>String(s||'').toLowerCase(),isBusinessCalendarCollectionPath:()=>false,businessCalendarItemIdFromPath:()=>null,normalizeDateOnly:x=>x,normalizeWorkHourEntry:x=>x,normalizeWorkHourAudit:x=>x,createId:()=> 'new',toISODate:()=> '2026-09-30T12:00:00Z',workHourNonBusinessReason:()=>''});
 for(const name of ['isAdminUser','isConsultantUser','consultantCanAccessApi','activeAllocatedsForUser','canUserAccessAllocated','effectiveTimesheetPeriod','timeToMinutes','validateWorkHourEntry','buildWorkHourEntryFromPayload','handleApi'])vm.runInContext(extract(server,name),ctx);
 return {db,run:async()=>{await ctx.handleApi({method,url},{});return {result,writes};}};
}
test('consultor habilitado grava somente suas horas, sem acesso a importação ou administração',async()=>{
 const own=apiHarness();const saved=await own.run();assert.equal(saved.result.code,201);assert.equal(saved.writes,1);assert.equal(own.db.workHours[0].consultantEmail,user.email);
 for(const options of [{payload:{allocatedId:'other'}},{enabled:false},{active:false},{period:'CLOSED'},{url:'/api/work-hours/import'},{url:'/api/timesheet-periods'},{url:'/api/timesheet-projects'},{url:'/api/users'}]){
  const h=apiHarness(options),r=await h.run();assert.ok([403,404,422].includes(r.result.code),JSON.stringify(r));assert.equal(r.writes,0);assert.equal(h.db.workHours.length,0);
 }
});
test('edição exige propriedade do apontamento e mantém validação do cliente',async()=>{
 for(const [allocatedId,enabled,expected] of [['mine',true,200],['other',true,403],['mine',false,422]]){
  const h=apiHarness({enabled,method:'PATCH',url:'/api/work-hours/e',payload:{hours:4}});
  h.db.workHours.push({id:'e',allocatedId,clientId:'c',date:'2026-09-15',projectId:'p',mode:'simplified',hours:8});
  const r=await h.run();assert.equal(r.result.code,expected);assert.equal(r.writes,expected===200?1:0);
 }
});
