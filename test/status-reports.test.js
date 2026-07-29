import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichStatusReport,
  MONGO_APP_COLLECTIONS,
  normalizeDatabase,
  normalizeStatusReport
} from '../db.js';

test('status report normaliza estrutura executiva e farol', () => {
  const report = normalizeStatusReport({
    clienteId: 'client_1',
    consultorId: 'alloc_1',
    periodo: 'Julho/2026',
    farol: 'amarelo',
    resumoExecutivo: 'Acompanhamento estavel',
    tarefas: 'Entrega 1\nEntrega 2',
    pontosAtencao: 'Dependencia do cliente'
  });

  assert.equal(report.clientId, 'client_1');
  assert.equal(report.allocatedId, 'alloc_1');
  assert.equal(report.period, 'Julho/2026');
  assert.equal(report.statusLight, 'amarelo');
  assert.equal(report.executiveSummary, 'Acompanhamento estavel');
  assert.match(report.governanceNote, /Gestao diaria/);
});

test('base normalizada cria colecao de status reports e enriquece cliente e consultor', () => {
  const db = normalizeDatabase({
    clients: [{ id: 'client_1', customerName: 'Totvs', managerContactName: 'Eloi' }],
    allocateds: [{ id: 'alloc_1', code: 'P-1', consultant: 'Maria Silva', clientId: 'client_1', consultantEmail: 'maria@example.com' }],
    statusReports: [{ clientId: 'client_1', allocatedId: 'alloc_1', period: 'Julho/2026', executiveSummary: 'Tudo ok' }]
  });

  assert.equal(db.statusReports.length, 1);
  const enriched = enrichStatusReport(db.statusReports[0], db);
  assert.equal(enriched.clientName, 'Totvs');
  assert.equal(enriched.consultantName, 'Maria Silva');
  assert.equal(enriched.clientManagerName, 'Eloi');
});

test('status reports fazem parte das colecoes operacionais do Mongo app', () => {
  assert.ok(MONGO_APP_COLLECTIONS.includes('statusReports'));
});
