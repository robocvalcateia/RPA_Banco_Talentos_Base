import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { summarizeCandidateEmails, summarizeSentMessages } from '../email-diagnostics.js';

test('diagnóstico resume eventos sem expor destinatário nem alterar registros', () => {
  const db = { selectedCandidates: [{ notifications: [{ type: 'selected', status: 'sent', to: 'private@example.test', createdAt: '2026-09-01' }] }],
    candidates: [{ notifications: [{ type: 'rejected', status: 'failed', error: 'SMTP não configurado.', createdAt: '2026-09-02' }] }] };
  const before = JSON.stringify(db);
  const result = summarizeCandidateEmails(db);
  assert.equal(result[0].counts.sent, 1);
  assert.equal(result[1].counts.failed, 1);
  assert.equal(result[1].latest.error, 'SMTP não configurado.');
  assert.equal(JSON.stringify(db), before);
  assert.doesNotMatch(JSON.stringify(result), /private@example/);
  assert.equal(summarizeCandidateEmails({})[0].latest, null);
});

test('amostra de itens enviados distingue os três assuntos e ignora outros emails', () => {
  const result = summarizeSentMessages([
    { subject: '[Alcateia] Confirmação de recebimento do seu CV', sentDateTime: '2026-09-25T10:00:00Z' },
    { subject: '[Alcateia] Processo seletivo - Dev', sentDateTime: '2026-09-24T10:00:00Z' },
    { subject: 'Relatório Diário PROD - Banco de Talentos', sentDateTime: '2026-09-25T10:00:00Z' }
  ]);
  assert.deepEqual(result.map(item => item.count), [1, 1, 0]);
  assert.equal(result[2].latest, null);
});

test('rota de diagnóstico bloqueia não administrador antes de ler dados', async () => {
  const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const start = source.indexOf("    if (request.method === 'GET' && pathname === '/api/admin/candidate-email-diagnostics')");
  const end = source.indexOf("    if (request.method === 'POST' && pathname === '/api/admin/smtp-diagnostics')", start);
  let code;
  const context = vm.createContext({ request: { method: 'GET' }, pathname: '/api/admin/candidate-email-diagnostics',
    auth: { user: { role: 'consultor' } }, response: {}, sendError: (_, status) => { code = status; },
    readDatabase: () => { throw Error('Não deve acessar dados'); } });
  await vm.runInContext('(async () => {' + source.slice(start, end) + '})()', context);
  assert.equal(code, 403);
  assert.doesNotMatch(source.slice(start, end), /sendMail\(|writeDatabase/);
});
