import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { moveCandidateStage } from '../db.js';
import { syncApprovedCandidatePlacement } from '../server.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
function extract(source, name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('reprovar preserva vínculo e histórico, desfaz flag aprovado e não realoca', () => {
  const candidate = { id: 'candidate', opportunityId: 'opportunity', curriculumId: 'cv',
    approved: true, stage: 'Aprovado', stageEnteredAt: '2026-09-01T00:00:00.000Z',
    stageHistory: [{ stage: 'Aprovado', enteredAt: '2026-09-01T00:00:00.000Z', leftAt: '' }] };
  moveCandidateStage(candidate, 'Reprovado', new Date('2026-09-25T12:00:00Z'));
  assert.equal(candidate.opportunityId, 'opportunity');
  assert.equal(candidate.curriculumId, 'cv');
  assert.equal(candidate.approved, false);
  assert.equal(candidate.stageHistory.length, 2);
  assert.equal(candidate.stageHistory[0].leftAt, '2026-09-25T12:00:00.000Z');
  assert.equal(candidate.stageHistory[1].stage, 'Reprovado');
  assert.equal(syncApprovedCandidatePlacement(candidate, {}), null);
  assert.equal(candidate.stage, 'Reprovado');
});

test('listas ativas ocultam reprovado em todos os filtros sem apagar estado ou outra vaga', () => {
  const filters = { '#candidateFilterType': { value: '' }, '#candidateFilterValue': { value: '' } };
  const state = { opportunities: [{ id: 'a', status: 'Open' }, { id: 'b', status: 'Open' }],
    candidates: [{ id: 'rejected', curriculumId: 'cv', opportunityId: 'a', stage: 'Reprovado' },
      { id: 'active', curriculumId: 'cv', opportunityId: 'b', stage: 'Triagem' }] };
  const context = vm.createContext({ state, $: selector => filters[selector] });
  vm.runInContext(extract(app, 'getFilteredCandidates'), context);
  assert.equal(context.getFilteredCandidates().length, 1);
  for (const [type, value, count] of [['opportunity', 'a', 0], ['opportunity', 'b', 1], ['consultor', 'rejected', 0]]) {
    filters['#candidateFilterType'].value = type;
    filters['#candidateFilterValue'].value = value;
    assert.equal(context.getFilteredCandidates().length, count);
  }
  assert.equal(state.candidates.length, 2);
});

test('botão principal aciona reprovação, atualiza lista e não abre painel inesperado', async () => {
  let request;
  let renders = 0;
  let modalRenders = 0;
  let saved;
  let message;
  const context = vm.createContext({ state: { editing: {} },
    window: { prompt: () => ' Perfil ', confirm: () => true },
    api: async (url, options) => { request = { url, ...JSON.parse(options.body) }; return { id: 'c', stage: 'Reprovado', notification: { status: 'failed' } }; },
    upsertStateItem: (_, value) => { saved = value; }, render: () => renders++,
    renderOpportunityCandidatesModal: () => modalRenders++, toast: value => { message = value; },
    stageIndex: () => 1, stateForActions: null });
  vm.runInContext(extract(app, 'candidateMovementFeedback') + '\n' + extract(app, 'rejectOpportunityCandidate'), context);
  await context.rejectOpportunityCandidate({ id: 'c', name: 'Teste', opportunityId: 'a' });
  assert.deepEqual(request, { url: '/api/candidates/c', stage: 'Reprovado', rejectionReason: 'Perfil' });
  assert.equal(saved.stage, 'Reprovado');
  assert.equal(renders, 1);
  assert.equal(modalRenders, 0);
  assert.match(message, /Falha no envio/);
  context.state.stages = ['Triagem', 'Entrevista', 'Aprovado', 'Reprovado'];
  vm.runInContext(extract(app, 'renderCandidateStageActions'), context);
  assert.match(context.renderCandidateStageActions({ id: 'c', stage: 'Entrevista' }), /Mover<\/button>[\s\S]*data-reject-opportunity-candidate="c"/);
});

function lifecycleContext({ email = 'candidate@example.test', configured = true, fail = false } = {}) {
  const sent = [];
  const audits = [];
  const snapshots = [];
  const record = { name: 'Teste', opportunityId: 'a', processCycle: 1 };
  const db = { opportunities: [{ id: 'a', opportunity: 'Desenvolvedor' }] };
  const context = vm.createContext({ writeEmailLog: async row => audits.push(JSON.parse(JSON.stringify(row))), lifecycleLog: (_, notification) => ({ ...notification }), findCurriculumForSelectedCandidate: () => ({ email }),
    resolveCandidateCurriculum: async () => null, extractCandidateEmails: async () => [],
    getApinfoCredentials: () => ({}), toISODate: () => '2026-09-25T12:00:00.000Z',
    getSmtpConfigFromEnv: () => ({}), isSmtpAccountConfigured: () => configured,
    sendMail: async args => { if (fail) throw new Error('SMTP indisponível'); sent.push(args); } });
  vm.runInContext(extract(server, 'buildCandidateLifecycleMessage') + '\n' + extract(server, 'sendCandidateLifecycleEmail'), context);
  const invoke = type => context.sendCandidateLifecycleEmail({ db, record, type,
    persist: async () => snapshots.push(JSON.parse(JSON.stringify(record))) });
  return { record, db, invoke, sent, snapshots, audits };
}

test('seleção e reprovação disparam uma vez por ciclo e registram envio', async () => {
  const ctx = lifecycleContext();
  for (const type of ['selected', 'rejected']) {
    assert.equal((await ctx.invoke(type)).status, 'sent');
    assert.equal((await ctx.invoke(type)).status, 'sent');
  }
  assert.equal(ctx.sent.length, 2);
  assert.deepEqual(ctx.audits.map(row => row.status), ['sending', 'sent', 'sending', 'sent']);
  assert.match(ctx.sent[0].text, /aderência à oportunidade Desenvolvedor/);
  assert.match(ctx.sent[1].text, /outros candidatos/);
  assert.equal(ctx.snapshots[0].notifications[0].status, 'sending');
  assert.equal(ctx.snapshots.at(-1).notifications[1].status, 'sent');
  ctx.record.processCycle = 2;
  await ctx.invoke('selected');
  assert.equal(ctx.sent.length, 3);
});

test('gatilho registra ausência de endereço, configuração e falha SMTP sem fingir sucesso', async () => {
  for (const [options, status, error] of [[{ email: '' }, 'skipped', /sem e-mail válido/],
    [{ configured: false }, 'failed', /SMTP não configurado/], [{ fail: true }, 'failed', /SMTP indisponível/]]) {
    const ctx = lifecycleContext(options);
    const result = await ctx.invoke('rejected');
    assert.equal(result.status, status);
    assert.match(result.error, error);
    assert.equal(ctx.sent.length, 0);
    assert.equal(ctx.audits.at(-1).status, status);
    assert.equal(ctx.snapshots.at(-1).notifications[0].status, status);
  }
});

test('Closed envia encerramento sem atribuir decisão de seleção ao cliente e não duplica', async () => {
  const ctx = lifecycleContext();
  ctx.db.opportunities[0].status = 'Closed';
  assert.equal((await ctx.invoke('rejected')).status, 'sent');
  assert.equal((await ctx.invoke('rejected')).status, 'sent');
  assert.equal(ctx.sent.length, 1);
  assert.match(ctx.sent[0].text, /oportunidade Desenvolvedor foi encerrada/);
  assert.doesNotMatch(ctx.sent[0].text, /criteriosa avaliação|outros candidatos/);
  assert.equal(ctx.audits.at(-1).type, 'rejected');
});

test('Closed não repete aviso para o mesmo destinatário em outro vínculo da mesma vaga', async () => {
  const ctx = lifecycleContext();
  ctx.db.opportunities[0].status = 'Closed';
  ctx.db.candidates = [{ notifications: [{ type: 'rejected', opportunityId: 'a', to: 'candidate@example.test', status: 'sent' }] }];
  assert.equal((await ctx.invoke('rejected')).status, 'skipped');
  assert.equal(ctx.sent.length, 0);
  assert.match(ctx.audits.at(-1).error, /duplicidade evitada/);
});
test('reprovação em outra oportunidade não impede o aviso de encerramento', async () => {
  const ctx = lifecycleContext();
  ctx.db.opportunities[0].status = 'Closed';
  ctx.db.candidates = [{ notifications: [{ type: 'rejected', opportunityId: 'b', to: 'candidate@example.test', status: 'sent' }] }];
  assert.equal((await ctx.invoke('rejected')).status, 'sent');
  assert.equal(ctx.sent.length, 1);
});
