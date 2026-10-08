import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function extract(name){const start=server.indexOf(`function ${name}(`);assert.ok(start>=0);const rest=server.slice(start);const next=rest.slice(1).search(/\n(?:export )?(?:async )?function /);return rest.slice(0,next+1);}
const users=[{name:'Gerson',role:'Admin'},{name:'Bruno',role:' ADMIN '},{name:'Recrutador',role:'Recrutador'},{name:'Consultor',role:'Consultor'},{name:'Sem perfil'}];
test('responsaveis no seletor incluem somente Admin, preservando ordenacao',()=>{const code=app.match(/const userOptions = ([\s\S]*?)\n  const ufOptions/)[1];const value=vm.runInNewContext(code,{state:{users},emptyOption:'<option></option>',escapeHtml:x=>x});assert.match(value,/Gerson/);assert.match(value,/Bruno/);assert.doesNotMatch(value,/Recrutador|Consultor|Sem perfil/);assert.ok(value.indexOf('Bruno')<value.indexOf('Gerson'));});
test('validacao de oportunidade aceita Admin e rejeita outros perfis e nomes inexistentes',()=>{for(const [owner,expected] of [['Gerson',false],['Bruno',false],['Recrutador',true],['Consultor',true],['Sem perfil',true],['Inexistente',true],['',false]]){let result;const ctx=vm.createContext({sendError:(_,status,message)=>result={status,message}});vm.runInContext(['isAdminUser','findUserByName','validateOpportunityBusinessRules'].map(extract).join('\n'),ctx);const db={users,clients:[{id:'client'}],contactClients:[],opportunities:[]};assert.equal(ctx.validateOpportunityBusinessRules({}, {clientId:'client',opportunity:'Vaga',opportunityCode:'999',owner,model:'Alocação',status:'Open'},db),expected,owner);if(expected){assert.equal(result.status,422);assert.match(result.message,/administrador/);}}});
