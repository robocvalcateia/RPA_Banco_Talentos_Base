import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDttReconciliationSelection, buildCandidateLifecycleMessage } from '../server.js';

function database() {
  return {
    clients: [{ id: 'dtt', customerName: 'Deloitte' }],
    opportunities: [{
      id: 'opp', clientId: 'dtt', opportunityCode: '211', clientOpportunityCode: '2095',
      opportunity: 'Consultor Coupa', status: 'Open', closingDate: '', observation: ''
    }],
    candidates: [{
      id: 'candidate', opportunityId: 'opp', curriculumId: 'cv', name: 'Pessoa Teste',
      stage: 'Triagem', status: '', observation: '', processCycle: 1, stageHistory: []
    }],
    selectedCandidates: [{
      id: 'selected', opportunityId: 'opp', curriculumId: 'cv', name: 'Pessoa Teste',
      stage: '', status: 'Selecionado', observation: '', processCycle: 1
    }],
    curriculums: [{ id: 'cv', id_controle: 'cv', nome: 'Pessoa Teste', email: 'pessoa@example.test' }],
    candidateMovements: [], curriculumObservations: [], recordObservations: [], allocateds: []
  };
}

test('aplica somente linha selecionada, encerra vínculos e prepara um único aviso por candidato', async () => {
  const db = database();
  const batch = {
    fileName: 'DTT Status.xlsx',
    rows: [{
      key: 'Canceladas:2', opportunityId: 'opp', sourceStatus: 'Cancelada', proposedStatus: 'LOST'
    }]
  };
  let persisted = 0;
  const notifications = [];
  const result = await applyDttReconciliationSelection({
    db,
    batch,
    selectedKeys: ['Canceladas:2'],
    user: { id: 'user', name: 'Gerson', email: 'gerson@alcateiaconsulting.com.br' },
    now: new Date('2026-11-05T15:00:00.000Z'),
    persist: async () => { persisted += 1; },
    sendNotification: async (args) => {
      notifications.push(args);
      return { status: 'sent', to: 'pessoa@example.test', sentAt: '2026-11-05T15:00:01.000Z' };
    }
  });

  assert.equal(db.opportunities[0].status, 'LOST');
  assert.equal(db.opportunities[0].closingDate, '2026-11-05');
  assert.match(db.opportunities[0].observation, /atualizada automaticamente pela conciliação DTT/);
  assert.equal(db.candidates[0].stage, 'Reprovado');
  assert.equal(db.selectedCandidates[0].stage, 'Reprovado');
  assert.match(db.candidates[0].observation, /encerrada automaticamente devido ao aviso de status da DTT/);
  assert.equal(db.curriculumObservations.length, 1);
  assert.equal(db.candidateMovements.length, 1);
  assert.equal(db.recordObservations.filter((item) => item.entityType === 'opportunity').length, 1);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'dtt-closed');
  assert.equal(result.updated.length, 1);
  assert.deepEqual(result.emailSummary, { sent: 1, skipped: 0, failed: 0 });
  assert.ok(persisted >= 1);
});

test('não altera oportunidade que deixou de estar Open entre a prévia e a confirmação', async () => {
  const db = database();
  db.opportunities[0].status = 'Closed';
  const result = await applyDttReconciliationSelection({
    db,
    batch: { fileName: 'DTT.xlsx', rows: [{ key: 'x', opportunityId: 'opp', sourceStatus: 'Cancelada', proposedStatus: 'LOST' }] },
    selectedKeys: ['x'],
    sendNotification: async () => { throw new Error('não deveria enviar'); }
  });
  assert.equal(result.updated.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(db.opportunities[0].status, 'Closed');
});

test('mensagem DTT agradece, informa encerramento e mantém o perfil no banco', () => {
  const message = buildCandidateLifecycleMessage('dtt-closed', 'Maria', 'Consultor Coupa', 'Closed');
  assert.match(message, /Agradecemos sua participação/);
  assert.match(message, /oportunidade foi encerrada pela empresa contratante/);
  assert.match(message, /Banco de Talentos/);
  assert.match(message, /Alcateia Consulting/);
});
