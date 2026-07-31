import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advanceSelectedCandidateToInterview,
  approvedCandidatesForOpportunity,
  buildCandidateEmailBody,
  buildCurriculumPayload,
  databaseWithSelectedCandidateCurriculums,
  duplicatedAllocatedCodeGroups,
  findAllocatedByCode,
  findCurriculumForCandidateResult,
  findUserByName,
  isAlcateiaSenderEmail,
  resolveCandidateCurriculum,
  shouldSyncLegacyAfterProcessing,
  shouldResetEnvUserPasswords,
  syncApprovedCandidatePlacementsForOpportunity,
  syncApprovedCandidatePlacement
} from '../server.js';

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
    selectedCandidates: [],
    allocateds: []
  };
}

test('payload de exportacao de curriculo preserva texto integral e estruturas ricas', () => {
  const payload = buildCurriculumPayload({
    id: '1954',
    id_controle: '1954',
    nome: 'Edivaldo De Fabio',
    experiencia_profissional: 'Empresa Atual - Gerente.',
    search_text_all: 'Empresa Atual - Gerente\n• Implantou governanca de projetos.\n• Liderou integracoes SAP.',
    versoes: [{ dados: { Experiencia_Profissional: 'Experiencia historica detalhada' } }],
    experiencias: [{ empresa: 'Empresa Antiga', detalhes: ['Estruturou PMO'] }]
  });

  assert.match(payload.search_text_all, /Implantou governanca/);
  assert.equal(payload.versoes.length, 1);
  assert.equal(payload.experiencias.length, 1);
});

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
  db.opportunities[0].status = 'WON';
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

test('candidato aprovado em oportunidade aberta nao cria alocado ativo', () => {
  const db = buildDb();
  const candidate = buildCandidate();
  db.candidates.push(candidate);

  const skipped = syncApprovedCandidatePlacement(candidate, db);

  assert.equal(skipped.type, 'allocated');
  assert.equal(skipped.action, 'skipped');
  assert.match(skipped.reason, /WON/);
  assert.equal(db.allocateds.length, 0);

  db.opportunities[0].status = 'WON';
  const placements = syncApprovedCandidatePlacementsForOpportunity(db, 'opp_a');

  assert.equal(placements.length, 1);
  assert.equal(placements[0].action, 'created');
  assert.equal(db.allocateds.length, 1);
  assert.equal(db.allocateds[0].opportunityId, 'opp_a');
  assert.equal(db.allocateds[0].candidateId, 'cand_a');
});

test('WON exige candidato aprovado na propria oportunidade', () => {
  const db = buildDb();
  db.candidates.push(
    buildCandidate({ id: 'cand_triagem', approved: false, stage: 'Triagem', status: 'Em andamento' }),
    buildCandidate({ id: 'cand_outra_opp', opportunityId: 'opp_b', approved: true, stage: 'Aprovado', status: 'Aprovado' })
  );

  assert.equal(approvedCandidatesForOpportunity(db, 'opp_a').length, 0);

  db.candidates[0].approved = true;
  db.candidates[0].stage = 'Aprovado';
  db.candidates[0].status = 'Aprovado';

  const approved = approvedCandidatesForOpportunity(db, 'opp_a');
  assert.equal(approved.length, 1);
  assert.equal(approved[0].id, 'cand_triagem');
});

test('codigo de alocado duplicado e detectado de forma normalizada', () => {
  const allocateds = [
    { id: 'alloc_1', code: ' P-00126-A ', consultant: 'Ana' },
    { id: 'alloc_2', code: 'p 00126 a', consultant: 'Bruno' },
    { id: 'alloc_3', code: 'P-00126-B', consultant: 'Carla' }
  ];

  assert.equal(findAllocatedByCode(allocateds, 'P-00126-A')?.id, 'alloc_1');
  assert.equal(findAllocatedByCode(allocateds, 'P-00126-A', 'alloc_1')?.id, 'alloc_2');
  assert.equal(findAllocatedByCode(allocateds, 'P-00126-B', 'alloc_3'), null);
  assert.equal(duplicatedAllocatedCodeGroups(allocateds).length, 1);
});

test('edicao de alocado valida duplicidade somente quando codigo muda', () => {
  const serverSource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

  assert.match(serverSource, /const codeChanged = comparableAllocatedCode\(updated\.code\) !== comparableAllocatedCode\(allocated\.code\);/);
  assert.match(serverSource, /if \(codeChanged && validateAllocatedUniqueCode\(response, db\.allocateds, updated, allocated\.id\)\)/);
});

test('formulario de alocado respeita checkbox ativo ao atualizar', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /payload\.active = Boolean\(form\.elements\.active\?\.checked\);/);
  assert.doesNotMatch(appSource, /payload\.status = payload\.status \|\| 'Ativo';/);
});

test('candidato aprovado gera codigo unico quando codigo automatico colide', () => {
  const db = buildDb();
  db.opportunities[0].status = 'WON';
  db.curriculums[0].id_controle = 'DUP-1';
  db.curriculums[0].id = 'DUP-1';
  db.allocateds.push({
    id: 'alloc_existente',
    code: 'DUP-1',
    consultant: 'Outra Pessoa',
    clientId: 'client_a',
    active: true
  });

  const candidate = buildCandidate({ curriculumId: 'DUP-1' });
  const placement = syncApprovedCandidatePlacement(candidate, db);

  assert.equal(placement.action, 'created');
  assert.equal(db.allocateds.length, 2);
  assert.equal(db.allocateds[1].code, 'DUP-1-2');
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

test('resultado com curriculo interno encontra a base antes de link externo', () => {
  const db = buildDb();
  const curriculum = findCurriculumForCandidateResult(db, {
    name: 'Pessoa Teste',
    link: 'https://linkedin.com/in/pessoa-teste',
    observation: 'ID Controle: 1001 | Aderencia MongoDB: 100%'
  });

  assert.equal(curriculum?.id_controle, '1001');
});

test('vinculo de candidato aceita curriculo resolvido fora do cache local', async () => {
  const db = buildDb();
  db.curriculums = [];

  const curriculum = await resolveCandidateCurriculum(db, '1921', async (_db, identifier) => ({
    id: '1921',
    id_controle: identifier,
    nome: 'Márcio Ribeiro',
    email: 'marcio@example.com',
    telefone: '11999999999'
  }));

  assert.equal(curriculum?.id_controle, '1921');
  assert.equal(curriculum?.nome, 'Márcio Ribeiro');
});

test('envio de candidato selecionado usa curriculo resolvido fora do cache local', async () => {
  const db = buildDb();
  db.curriculums = [];
  const selected = [{
    id: 'sel_1921',
    name: 'Marcio Ribeiro',
    curriculumId: '1921',
    opportunityId: 'opp_a'
  }];

  const resolved = await databaseWithSelectedCandidateCurriculums(db, selected, async (_db, identifier) => ({
    id: identifier,
    id_controle: identifier,
    nome: 'Marcio Ribeiro',
    email: 'marcio@example.com',
    telefone: '11999999999'
  }));

  assert.equal(resolved.curriculums.length, 1);
  assert.equal(resolved.curriculums[0].email, 'marcio@example.com');
  assert.equal(resolved.curriculums[0].telefone, '11999999999');
});

test('email de candidato selecionado inclui assinatura gravada', () => {
  const body = buildCandidateEmailBody(
    [{ name: 'Pessoa Teste' }],
    'Segue oportunidade.',
    'Gerson Scholz\nAlcateia Consulting'
  );

  assert.match(body, /Oportunidade|Segue oportunidade/);
  assert.match(body, /Gerson Scholz/);
  assert.match(body, /Alcateia Consulting/);
});

test('remetente de candidato selecionado deve ser dominio Alcateia', () => {
  assert.equal(isAlcateiaSenderEmail('gerson@alcateiaconsulting.com.br'), true);
  assert.equal(isAlcateiaSenderEmail('gerson@gmail.com'), false);
});

test('processamento de emails vazio nao dispara sincronizacao completa', () => {
  assert.equal(shouldSyncLegacyAfterProcessing({
    success: true,
    stats: {
      emails_processados: 0,
      arquivos_baixados: 0,
      arquivos_processados: 0,
      novos_candidatos: 0,
      candidatos_atualizados: 0,
      sem_mudancas: 0
    }
  }), false);
});

test('processamento de emails com arquivo dispara sincronizacao', () => {
  assert.equal(shouldSyncLegacyAfterProcessing({
    success: true,
    stats: {
      arquivos_baixados: 1,
      arquivos_processados: 1,
      novos_candidatos: 0,
      candidatos_atualizados: 0,
      sem_mudancas: 1
    }
  }), true);
});

test('seed de ambiente nao reseta senha sem confirmacao explicita', () => {
  assert.equal(shouldResetEnvUserPasswords({
    RESET_ENV_USER_PASSWORDS: 'true'
  }), false);
  assert.equal(shouldResetEnvUserPasswords({
    RESET_ENV_USER_PASSWORDS: 'true',
    ALLOW_ENV_USER_PASSWORD_RESET: 'CONFIRMO_RESETAR_SENHAS'
  }), true);
});

test('candidato selecionado avanca para entrevistados sem duplicar', () => {
  const db = buildDb();
  db.selectedCandidates.push({
    id: 'sel_a',
    opportunityId: 'opp_a',
    cvFilterId: 'cvf_a',
    name: 'Pessoa Teste',
    source: 'ALCATEIA',
    link: '',
    curriculumId: '1001',
    score: 100,
    origin: 'Resultado',
    candidateMessage: 'Convite enviado',
    observation: 'ID Controle: 1001 | aderente',
    createdAt: '2026-07-02T00:00:00.000Z'
  });

  const created = advanceSelectedCandidateToInterview(db, 'sel_a');
  const updated = advanceSelectedCandidateToInterview(db, 'sel_a');

  assert.equal(created.id, updated.id);
  assert.equal(db.candidates.length, 1);
  assert.equal(db.candidates[0].stage, 'Entrevista Alcateia');
  assert.equal(db.candidates[0].curriculumId, '1001');
  assert.equal(db.candidates[0].opportunityId, 'opp_a');
});
