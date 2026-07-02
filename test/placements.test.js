import test from 'node:test';
import assert from 'node:assert/strict';
import { findUserByName, syncApprovedCandidatePlacement } from '../server.js';

function buildDb() {
  return {
    clients: [{ id: 'client_a', customerName: 'Cliente A' }],
    users: [{ id: 'user_a', name: 'Maria Responsavel', email: 'maria@example.com' }],
    curriculums: [
      {
        id: 'curr_a',
        id_controle: '1001',
        nome: 'Pessoa Teste',
        email: 'pessoa@example.com',
        telefone: '11999999999',
        skills: 'Node, SQL'
      }
    ],
    opportunities: [
      {
        id: 'opp_a',
        clientId: 'client_a',
        opportunity: 'Dev',
        opportunityCode: 'OPP-1',
        status: 'Open',
        model: 'Alocacao',
        owner: 'Maria Responsavel',
        closedQuantity: 0
      }
    ],
    candidates: [],
    allocateds: []
  };
}

function buildCandidate(overrides = {}) {
  return {
    id: 'cand_a',
    name: 'Pessoa Teste',
    curriculumId: 'curr_a',
    opportunityId: 'opp_a',
    hourlyRate: 120,
    observation: '',
    approved: true,
    stage: 'Triagem',
    status: 'Em andamento',
    stageEnteredAt: '2026-07-01T00:00:00.000Z',
    stageHistory: [{ stage: 'Triagem', enteredAt: '2026-07-01T00:00:00.000Z', leftAt: '' }],
    ...overrides
  };
}

test('responsavel de oportunidade referencia usuario por nome', () => {
  const db = buildDb();

  assert.equal(findUserByName(db, 'maria responsavel')?.email, 'maria@example.com');
  assert.equal(findUserByName(db, 'Usuario Inexistente'), null);
});

test('candidato aprovado cria ou atualiza alocado sem duplicar', () => {
  const db = buildDb();
  const candidate = buildCandidate();

  const created = syncApprovedCandidatePlacement(candidate, db);

  assert.equal(created.type, 'allocated');
  assert.equal(created.action, 'created');
  assert.equal(db.allocateds.length, 1);
  assert.equal(db.allocateds[0].consultant, 'Pessoa Teste');
  assert.equal(db.allocateds[0].manager, 'Maria Responsavel');
  assert.equal(db.allocateds[0].managerEmail, 'maria@example.com');
  assert.equal(candidate.stage, 'Aprovado');
  assert.equal(candidate.status, 'Aprovado');

  const updated = syncApprovedCandidatePlacement(candidate, db);

  assert.equal(updated.type, 'allocated');
  assert.equal(updated.action, 'updated');
  assert.equal(db.allocateds.length, 1);
});

test('candidato aprovado em hunting atualiza oportunidade sem criar alocado', () => {
  const db = buildDb();
  db.opportunities = [
    {
      id: 'opp_h',
      clientId: 'client_a',
      opportunity: 'Hunting Dev',
      status: 'Open',
      model: 'Hunting',
      owner: 'Maria Responsavel',
      closedQuantity: 0
    }
  ];
  const candidate = buildCandidate({
    id: 'cand_h',
    opportunityId: 'opp_h',
    stage: 'Entrevista Alcateia',
    stageHistory: [{ stage: 'Entrevista Alcateia', enteredAt: '2026-07-01T00:00:00.000Z', leftAt: '' }]
  });

  const placement = syncApprovedCandidatePlacement(candidate, db);

  assert.equal(placement.type, 'hunting');
  assert.equal(placement.action, 'updated');
  assert.equal(db.opportunities[0].status, 'WON');
  assert.equal(db.opportunities[0].closedQuantity, 1);
  assert.equal(candidate.stage, 'Aprovado');
  assert.equal(db.allocateds.length, 0);
});
