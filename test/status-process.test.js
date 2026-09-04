import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as fflate from 'fflate';
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
function fn(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}
test('closed reference month is missing, submitted or saved reports remain saved', () => {
  const ctx = vm.createContext({currentStatusReportMonthKey: ()=>'2026-09'});
  vm.runInContext(fn(app,'statusReportDeliveryStatus'),ctx);
  assert.equal(ctx.statusReportDeliveryStatus({referenceMonth:'2026-08'}),'Sem Entrega');
  assert.equal(ctx.statusReportDeliveryStatus({referenceMonth:'2026-09'}),'Pendente');
  assert.equal(ctx.statusReportDeliveryStatus({referenceMonth:'2026-08',consultantSubmittedAt:'2026-09-02'}),'Salvo');
  assert.equal(ctx.statusReportDeliveryStatus({referenceMonth:'2026-08',deliveryStatus:'Salvo'}),'Salvo');
});
test('late delivery belongs only to the reference month', () => {
  const ctx = vm.createContext({monthKeyFromValue: v=>String(v||'').slice(0,7)});
  vm.runInContext(fn(app,'statusReportMatchesDeliveryMonth'),ctx);
  const report={referenceMonth:'2026-08',consultantSubmittedAt:'2026-09-02'};
  assert.equal(ctx.statusReportMatchesDeliveryMonth(report,'2026-08'),true);
  assert.equal(ctx.statusReportMatchesDeliveryMonth(report,'2026-09'),false);
});
test('missing records are derived only for allocations covering selected closed month', () => {
  const state={statusReportFilter:{month:'2026-08'},statusReports:[],clients:[],allocateds:[
    {id:'a',active:true,startDate:'2026-07-01'},
    {id:'future',active:true,startDate:'2026-09-01'},
    {id:'ended',active:false,startDate:'2026-01-01',endDate:'2026-07-31'},
    {id:'unknown',active:true}
  ]};
  const ctx=vm.createContext({state,currentStatusReportMonthKey:()=>'2026-09',formatMonthLabel:x=>x});
  vm.runInContext(fn(app,'statusReportsWithMissingDeliveries'),ctx);
  assert.equal(ctx.statusReportsWithMissingDeliveries().length,1);
  assert.equal(state.statusReports.length,0);
  state.statusReports.push({allocatedId:'a',referenceMonth:'2026-08'});
  assert.equal(ctx.statusReportsWithMissingDeliveries().length,1);
});
test('batch exports every selected PDF in one ZIP per registered manager', async () => {
  const blobs=[]; const links=[]; const nodes={
    '#statusReportSavedMonth':{value:'2026-08'}, '#statusReportBatchDownload':{},
    '#statusReportBatchLinks':{replaceChildren(){},append(){}}
  };
  const reports=[{allocatedId:'a',consultantName:'Same'},{allocatedId:'b',consultantName:'Same'},{allocatedId:'c',consultantName:'Third'}];
  const ctx=vm.createContext({ Blob, Uint8Array, TextEncoder, TextDecoder, fflate,
    $:id=>nodes[id], getSavedStatusReports:()=>reports,
    state:{allocateds:[{id:'a',manager:'Manager',managerEmail:'m@example.com'},{id:'b',manager:'Manager',managerEmail:'m@example.com'},{id:'c'}]},
    URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:test';},revokeObjectURL(){}},
    document:{createElement:tag=>({append(){},click(){links.push(this.download);}})},
    toast(){},setSubmitButtonBusy:()=>'',restoreSubmitButton(){},
    createStatusReportCanvas:async()=>({toDataURL:()=>'',width:1,height:1}),
    pdfBlobFromJpegDataUrl:()=>new Blob(['%PDF-fixture'])
  });
  vm.runInContext(app.slice(app.indexOf('const statusReportBatchUrls'),app.indexOf('function currentStatusReportMonthKey')),ctx);
  await ctx.downloadStatusReportBatch();
  assert.equal(blobs.length,2);
  assert.equal(links.length,2);
  const counts=[];
  for(const blob of blobs) counts.push(Object.keys(ctx.fflate.unzipSync(new Uint8Array(await blob.arrayBuffer()))).length);
  assert.deepEqual(counts,[2,1]);
  assert.match(links[1],/Sem-gestor/);
  assert.equal(nodes['#statusReportSavedMonth'].disabled,false);
});
test('Wapp uses same email body builder and endpoint is admin-only without sending', () => {
  const endpoint=server.slice(server.indexOf("pathname.split('/')[3]",server.indexOf("/whatsapp$"))-400,server.indexOf("if (request.method === 'POST' && pathname === '/api/status-reports')"));
  assert.match(endpoint,/requireAdmin/);
  assert.match(endpoint,/buildStatusReportConsultantMessage/);
  assert.doesNotMatch(endpoint,/sendMail\(/);
  assert.match(server,/const message = buildStatusReportConsultantMessage\(args\)/);
});

test('shared message preserves personalized email body for WhatsApp', () => {
  const ctx=vm.createContext({
    buildStatusReportUrl:()=> 'https://example.test/status',
    monthLabelFromKey:x=>x,
    statusReportMessageForClient:()=>({body:'Olá {{consultor}}: {{periodo}}',subject:'Status'}),
    initialConsultantPassword:()=> 'test-fixture',
    applyStatusReportMessageTemplate:(text,context)=>text.replace('{{consultor}}',context.consultantName).replace('{{periodo}}',context.monthLabel),
    ensureStatusReportAccessInstructions:(text,context)=>`${text}\n${context.url}`
  });
  vm.runInContext(fn(server,'buildStatusReportConsultantMessage'),ctx);
  const result=ctx.buildStatusReportConsultantMessage({report:{period:'Agosto/2026'},allocated:{consultant:'Maria',consultantEmail:'m@example.test'},db:{}});
  assert.equal(result.text,'Olá Maria: Agosto/2026\nhttps://example.test/status');
  assert.equal(result.to,'m@example.test');
});
