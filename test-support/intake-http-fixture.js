import { promises as fs } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../db.js';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function startIntakeQa({port,keep=false}={}) {
  await fs.mkdir(path.join(repo,'tmp'),{recursive:true});
  const root=await fs.mkdtemp(path.join(repo,'tmp','intake-qa-'));
  for(const entry of await fs.readdir(repo)) if(entry.endsWith('.js') || entry==='package.json') await fs.copyFile(path.join(repo,entry),path.join(root,entry));
  await fs.cp(path.join(repo,'public'),path.join(root,'public'),{recursive:true});
  await fs.cp(path.join(repo,'resources'),path.join(root,'resources'),{recursive:true});
  await fs.mkdir(path.join(root,'data','intake-local'),{recursive:true});
  const file=path.join(root,'data','intake-local','database.json');
  const password='Qa-local-only-2026!';
  const users=[
    ['qa-a','Revisor QA A','gerson@alcateiaconsulting.com.br','Admin'],
    ['qa-b','Revisor QA B','bruno@alcateiaconsulting.com.br','Admin'],
    ['qa-consultor','Consultor QA','consultor@example.test','Consultor'],
    ['qa-change','Troca QA','troca@example.test','Admin']
  ].map(([id,name,email,role])=>({id,name,email,role,active:true,passwordHash:hashPassword(password),mustChangePassword:id==='qa-change'}));
  const state={clients:[{id:'dtt',customerName:'DTT'}],users,opportunities:[],curriculums:[
    {id:'qa-fi',id_controle:'qa-fi',nome:'QA Consultor FI',endereco:'Niterói/RJ',telefone:'21999990000',experiencia_profissional:'Consultor SAP FI. Experiência em implementação SAP FI e configuração FI-GL, FI-AR, FI-AP e FI-AA. Inglês avançado.'},
    {id:'qa-mm',id_controle:'qa-mm',nome:'QA Consultor MM',endereco:'São Paulo/SP',experiencia_profissional:'Consultor SAP MM. Implementação e configuração SAP MM.'},
    {id:'qa-pmo',id_controle:'qa-pmo',nome:'QA PMO',endereco:'São Paulo/SP',experiencia_profissional:'Gerente de projetos. Implantação de ERP. Compras, orçamento e contratos.'}
  ],selectedCandidates:[],candidateMovements:[],opportunityIntakes:[],intakeNotifications:[],intakeRuntime:[]};
  await fs.writeFile(file,JSON.stringify(state));
  if(!port){const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));port=listener.address().port;await new Promise(resolve=>listener.close(resolve));}
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|userprofile|appdata|localappdata|comspec|pathext|home)$/i.test(key)));
  Object.assign(env,{LOCAL_INTAKE_MODE:'true',NODE_ENV:'test',PORT:String(port),MONGODB_APP_COLLECTIONS:'false',MONGODB_APP_REQUIRED:'false',EMAIL_INBOX_SCHEDULE_ENABLED:'false',STATUS_REPORT_REMINDER_ENABLED:'false',FORM_REMINDER_ENABLED:'false'});
  const child=spawn(process.execPath,['server.js'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
  const base='http://127.0.0.1:'+port;
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,100));}
  if(!ready){child.kill();throw Error('QA server did not start: '+logs);}
  const request=async(url,{token,method='GET',body}={})=>{const r=await fetch(base+url,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,body:await r.json()};};
  const login=async(email)=>{const r=await request('/api/login',{method:'POST',body:{email,password}});if(r.status!==200)throw Error(JSON.stringify(r));return r.body.token;};
  return {root,file,base,password,request,login,child,get logs(){return logs;},read:async()=>JSON.parse(await fs.readFile(file,'utf8')),stop:async()=>{child.kill();if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));if(!keep)await fs.rm(root,{recursive:true,force:true});}};
}
