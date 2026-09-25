import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { writeEmailLog, readEmailLogs, lifecycleLog, legacyEmailLogs, queryEmailLogs, receivedMessageLog } from '../email-logs.js';

test('log preserva ciclos anteriores e atualiza somente o mesmo evento', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'email-log-'));
  const file = path.join(dir, 'log.jsonl');
  try {
    await writeEmailLog({ id: 'a:cycle1', status: 'sending' }, file);
    await Promise.all([writeEmailLog({ id: 'b:cycle1', status: 'failed' }, file), writeEmailLog({ id: 'a:cycle1', status: 'sent' }, file)]);
    await writeEmailLog({ id: 'a:cycle2', status: 'sent' }, file);
    const rows = await readEmailLogs(file);
    assert.equal(rows.length, 3);
    assert.equal(rows.find(row => row.id === 'a:cycle1').status, 'sent');
    assert.equal(rows.find(row => row.id === 'b:cycle1').status, 'failed');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('consulta filtra e pagina com período no horário de Brasília', () => {
  const rows = [
    { id: 'a', type: 'selected', status: 'sent', candidateName: 'João', to: 'joao@example.test', opportunityCode: '151', sentAt: '2026-09-25T01:00:00Z' },
    { id: 'b', type: 'rejected', status: 'failed', candidateName: 'Maria', opportunityCode: '151', createdAt: '2026-09-25T14:00:00Z' }
  ];
  assert.equal(queryEmailLogs(rows, { q: 'joao', from: '2026-09-24', to: '2026-09-24' }).total, 1);
  assert.equal(queryEmailLogs(rows, { q: 'example.test', from: '2026-09-25' }).total, 0);
  assert.equal(queryEmailLogs(rows, { type: 'rejected', status: 'failed', q: '151' }).rows[0].id, 'b');
  assert.equal(queryEmailLogs(rows, { pageSize: 1, page: 99 }).page, 2);
  assert.equal(queryEmailLogs([...rows, { ...rows[0], status: 'failed' }], { status: 'failed' }).total, 2);
});

test('identidade estável evita duplicação entre histórico legado e novos registros', () => {
  const candidate = { id: 'c', name: 'Nome', opportunityId: 'o', notifications: [{ eventKey: 'rejected:o:1', type: 'rejected', status: 'sent' }] };
  const db = { candidates: [candidate], opportunities: [{ id: 'o', opportunity: 'Vaga' }] };
  const legacy = legacyEmailLogs(db);
  const current = lifecycleLog(candidate, candidate.notifications[0], db.opportunities[0], 'robocv@example.test');
  const result = queryEmailLogs([...legacy, current]);
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].from, 'robocv@example.test');
  assert.equal(result.rows[0].opportunityName, 'Vaga');
});

test('importação aceita somente confirmação de CV e mantém identidade Microsoft', () => {
  assert.equal(receivedMessageLog({ subject: 'Outro assunto' }, 'mailbox'), null);
  const row = receivedMessageLog({ id: 'immutable', subject: '[Alcateia] Confirmação de recebimento do seu CV', sentDateTime: '2026-09-25T14:00:00Z', toRecipients: [{ emailAddress: { name: 'Teste', address: 'teste@example.test' } }] }, 'mailbox');
  assert.equal(row.id, 'graph:immutable');
  assert.equal(row.to, 'teste@example.test');
  assert.equal(row.source, 'sent_items');
});

test('consulta e importação exigem administrador antes de acessar dados', async () => {
  const source = await readFile(new URL('../server.js', import.meta.url), 'utf8');
  const start = source.indexOf("    if (pathname === '/api/admin/email-logs'");
  const end = source.indexOf("    if (request.method === 'GET' && pathname === '/api/admin/candidate-email-diagnostics')", start);
  for (const method of ['GET', 'POST']) {
    let status;
    const context = vm.createContext({ request: { method }, pathname: '/api/admin/email-logs', auth: { user: { role: 'consultor' } }, response: {},
      sendError: (_, code) => { status = code; }, readDatabaseCollections: () => assert.fail('Acesso não autorizado') });
    await vm.runInContext('(async () => {' + source.slice(start, end) + '})()', context);
    assert.equal(status, 403);
  }
});
