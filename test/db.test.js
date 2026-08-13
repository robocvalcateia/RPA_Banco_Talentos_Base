import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  calculateIndicators,
  calculateFaturamentoGrossMargin,
  BRAZIL_UFS,
  CANDIDATE_STAGES,
  buildMongoAppBulkWrite,
  enrichAllocated,
  enrichCandidate,
  enrichCandidatePool,
  enrichCvFilter,
  enrichRateCard,
  enrichSelectedCandidate,
  hashPassword,
  moveCandidateStage,
  normalizeDatabase,
  normalizeAllocated,
  normalizeBusinessCalendarEntry,
  normalizeCandidate,
  normalizeCandidatePool,
  normalizeCurriculum,
  normalizeCurriculumObservation,
  normalizeCvFilter,
  normalizeCvSearchResult,
  recalculateFaturamentoAccumulatedRealized,
  normalizeWorkHourClosure,
  normalizeWorkHourEntry,
  normalizeRateCard,
  normalizeSelectedCandidate,
  normalizeOpportunityModel,
  OPPORTUNITY_MODELS,
  OPPORTUNITY_STATUSES,
  readDatabaseCollections,
  sanitizeUser,
  syncCandidatesWithOpportunityClosures,
  verifyPassword,
  writeDatabaseCollections,
  writeDatabaseDocument,
  deleteDatabaseDocument
} from '../db.js';

function comparableClientNameForTest(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function sampleDb() {
  return {
    clients: [
      {
        id: 'client_1',
        customerName: 'Cliente Teste'
      }
    ],
    opportunities: [
      {
        id: 'opp_1',
        clientId: 'client_1',
        opportunity: 'Dev Backend',
        opportunityCode: 'OPP-001',
        status: 'Open',
        contractValue: 1000
      },
      {
        id: 'opp_2',
        clientId: 'client_1',
        opportunity: 'Analista',
        opportunityCode: 'OPP-002',
        status: 'Closed',
        contractValue: 2000
      },
      {
        id: 'opp_3',
        clientId: 'client_1',
        opportunity: 'Projeto fechado',
        opportunityCode: 'OPP-003',
        status: 'WON',
        closingDate: '2026-05-10',
        model: 'Hunting',
        closedQuantity: 2,
        contractValue: 3000
      },
      {
        id: 'opp_4',
        clientId: 'client_1',
        opportunity: 'Projeto fechado antigo',
        opportunityCode: 'OPP-004',
        status: 'WON',
        closingDate: '2026-03-15',
        model: 'Consultoria',
        closedQuantity: 3,
        contractValue: 7000
      }
    ],
    curriculums: [
      {
        id: 'curr_ana',
        nome: 'Ana',
        email: 'ana@example.com',
        id_controle: 'curr_ana'
      },
      {
        id: 'curr_bruno',
        nome: 'Bruno',
        email: 'bruno@example.com',
        id_controle: 'curr_bruno'
      }
    ],
    candidates: [
      {
        id: 'cand_1',
        name: 'Ana',
        curriculumId: 'curr_ana',
        opportunityId: 'opp_1',
        hourlyRate: 120,
        observation: 'Backend',
        approved: false,
        stage: 'Triagem',
        aderencia: 75,
        status: 'Em andamento',
        stageEnteredAt: '2026-05-02T00:00:00.000Z',
        stageHistory: [
          {
            stage: 'Inscrito',
            enteredAt: '2026-05-01T00:00:00.000Z',
            leftAt: '2026-05-02T00:00:00.000Z'
          },
          {
            stage: 'Triagem',
            enteredAt: '2026-05-02T00:00:00.000Z',
            leftAt: ''
          }
        ]
      },
      {
        id: 'cand_2',
        name: 'Bruno',
        curriculumId: 'curr_bruno',
        opportunityId: 'opp_2',
        hourlyRate: 100,
        observation: 'People',
        approved: true,
        stage: 'Aprovado',
        aderencia: 100,
        status: 'Aprovado',
        stageEnteredAt: '2026-05-15T00:00:00.000Z',
        stageHistory: [
          {
            stage: 'Aprovado',
            enteredAt: '2026-05-15T00:00:00.000Z',
            leftAt: ''
          }
        ]
      }
    ],
    allocateds: [
      {
        id: 'alloc_1',
        code: 'ALC-001',
        consultant: 'Carlos',
        clientId: 'client_1',
        active: true
      },
      {
        id: 'alloc_2',
        code: 'ALC-002',
        consultant: 'Daniela',
        clientId: 'client_1',
        active: true
      },
      {
        id: 'alloc_3',
        code: 'ALC-003',
        consultant: 'Eduardo',
        clientId: 'client_1',
        active: false
      }
    ],
    cvFilters: [],
    selectedCandidates: []
  };
}

test('calcula indicadores basicos do MVP', () => {
  const indicators = calculateIndicators(sampleDb(), new Date('2026-05-21T00:00:00.000Z'));

  assert.equal(indicators.totals.openOpportunities, 1);
  assert.equal(indicators.totals.candidates, 2);
  assert.equal(indicators.candidatesByStage.Triagem, 1);
  assert.equal(indicators.candidatesByStage.Aprovado, 0);
  assert.equal(indicators.opportunitiesByStatus.Open, 1);
  assert.equal(indicators.opportunitiesByStatus.Closed, 1);
  assert.equal(indicators.opportunitiesByStatus.WON, 2);
  assert.equal(indicators.totals.wonCurrentMonth, 1);
  assert.equal(indicators.wonByModelCurrentMonth.Hunting, 1);
  assert.equal(indicators.totals.wonContractValueCurrentMonth, 6000);
  assert.equal(indicators.wonContractValueByMonth['2026-03'], 21000);
  assert.equal(indicators.wonContractValueByMonth['2026-05'], 6000);
  assert.equal(indicators.totals.activeContractValue, 1000);
  assert.equal(indicators.totals.activeAllocateds, 2);
  assert.equal(indicators.allocatedsByClient['Cliente Teste'], 2);
  assert.equal(indicators.averageDaysByStage.Triagem, 19);
  assert.equal(indicators.approvedByMonth['2026-05'], 1);
  assert.equal(indicators.totals.averageAderencia, 87.5);
});

test('indicadores nao contam bolsao ativo como alocado ativo', () => {
  const db = sampleDb();
  db.allocateds[0].consultant = 'Carlos Alberto Silva';
  db.candidatePool = [
    {
      id: 'pool_1',
      clientId: 'client_1',
      candidateName: 'Carlos Silva',
      status: 'Ativo',
      active: true
    }
  ];

  const indicators = calculateIndicators(db, new Date('2026-05-21T00:00:00.000Z'));

  assert.equal(indicators.totals.activeAllocateds, 1);
  assert.equal(indicators.allocatedsByClient['Cliente Teste'], 1);
});

test('indicadores contam alocado quando bolsao esta com status alocado', () => {
  const db = sampleDb();
  db.allocateds[0].consultant = 'Carlos Alberto Silva';
  db.candidatePool = [
    {
      id: 'pool_1',
      clientId: 'client_1',
      candidateName: 'Carlos Silva',
      status: 'Alocado',
      active: false
    }
  ];

  const indicators = calculateIndicators(normalizeDatabase(db), new Date('2026-05-21T00:00:00.000Z'));

  assert.equal(indicators.totals.activeAllocateds, 2);
  assert.equal(indicators.allocatedsByClient['Cliente Teste'], 2);
});

test('normalizacao consolida clientes duplicados por nome e remapeia referencias', () => {
  const db = normalizeDatabase({
    clients: [
      {
        id: 'client_totvs',
        customerName: 'Totvs',
        observation: 'Cliente principal'
      },
      {
        id: 'client_totvs_duplicado',
        customerName: 'TOTVS',
        primaryContactName: 'Davi Mateus',
        primaryContactEmail: 'davi.paula@totvs.com.br',
        observation: 'Contato RMO'
      }
    ],
    users: [],
    opportunities: [
      { id: 'opp_1', clientId: 'client_totvs_duplicado', opportunity: 'Projeto', status: 'Open' }
    ],
    faturamento: [],
    curriculums: [],
    candidates: [],
    allocateds: [
      { id: 'alloc_1', code: 'P-001', consultant: 'Pessoa', clientId: 'client_totvs_duplicado' }
    ],
    rateCards: [],
    candidatePool: [
      { id: 'pool_1', clientId: 'client_totvs_duplicado', candidateName: 'Pessoa', profile: 'Técnico' }
    ],
    contactClients: [
      { id: 'contact_1', clientId: 'client_totvs_duplicado', name: 'Davi' }
    ],
    cvFilters: [],
    curriculumObservations: [],
    selectedCandidates: []
  });

  const totvsClients = db.clients.filter((client) => comparableClientNameForTest(client.customerName) === 'totvs');

  assert.equal(totvsClients.length, 1);
  assert.equal(totvsClients[0].id, 'client_totvs_duplicado');
  assert.equal(totvsClients[0].primaryContactName, 'Davi Mateus');
  assert.match(totvsClients[0].observation, /Cliente principal/);
  assert.match(totvsClients[0].observation, /Contato RMO/);
  assert.equal(db.opportunities[0].clientId, 'client_totvs_duplicado');
  assert.equal(db.allocateds[0].clientId, 'client_totvs_duplicado');
  assert.equal(db.candidatePool[0].clientId, 'client_totvs_duplicado');
  assert.equal(db.contactClients[0].clientId, 'client_totvs_duplicado');
});

test('move candidato e preserva historico de etapas', () => {
  const candidate = sampleDb().candidates[0];
  moveCandidateStage(candidate, 'Entrevista Alcateia', new Date('2026-05-04T12:00:00.000Z'));

  assert.equal(candidate.stage, 'Entrevista Alcateia');
  assert.equal(candidate.status, 'Em andamento');
  assert.equal(candidate.stageHistory.at(-2).stage, 'Triagem');
  assert.equal(candidate.stageHistory.at(-2).leftAt, '2026-05-04T12:00:00.000Z');
  assert.deepEqual(candidate.stageHistory.at(-1), {
    stage: 'Entrevista Alcateia',
    enteredAt: '2026-05-04T12:00:00.000Z',
    leftAt: ''
  });
});

test('rejeita etapas fora da estrutura definida para candidatos', () => {
  const candidate = sampleDb().candidates[0];

  assert.throws(() => moveCandidateStage(candidate, 'Oferta fantasma'), /Etapa invalida/);
  assert.ok(CANDIDATE_STAGES.includes('Reprovado'));
});

test('oportunidade fechada sem WON reprova candidatos vinculados', () => {
  const db = sampleDb();
  db.opportunities[0].status = 'LOST';
  db.opportunities[0].closingDate = '2026-05-20';

  syncCandidatesWithOpportunityClosures(db, new Date('2026-05-21T00:00:00.000Z'));

  assert.equal(db.candidates[0].stage, 'Reprovado');
  assert.equal(db.candidates[0].status, 'Reprovado');
  assert.equal(db.candidates[0].approved, false);
  assert.equal(db.candidates[0].stageHistory.at(-1).stage, 'Reprovado');
});

test('oportunidade aberta com data de fechamento nao reprova candidato aprovado', () => {
  const db = sampleDb();
  db.opportunities[0].status = 'Open';
  db.opportunities[0].closingDate = '2026-07-30';
  db.candidates[0].stage = 'Aprovado';
  db.candidates[0].status = 'Aprovado';
  db.candidates[0].approved = true;

  syncCandidatesWithOpportunityClosures(db, new Date('2026-07-31T00:00:00.000Z'));

  assert.equal(db.candidates[0].stage, 'Aprovado');
  assert.equal(db.candidates[0].status, 'Aprovado');
  assert.equal(db.candidates[0].approved, true);
});

test('status de oportunidade usa apenas valores permitidos', () => {
  assert.deepEqual(OPPORTUNITY_STATUSES, ['WON', 'LOST', 'Freezing', 'Closed', 'Open']);
});

test('modelo de oportunidade usa apenas valores permitidos', () => {
  assert.deepEqual(OPPORTUNITY_MODELS, ['Alocação', 'Hunting', 'Projeto', 'Consultoria']);
  assert.equal(normalizeOpportunityModel(' Consultoria'), 'Consultoria');
  assert.equal(normalizeOpportunityModel('Alocacao'), 'Alocação');
  assert.throws(() => normalizeOpportunityModel('Remoto integral'), /Modelo de oportunidade invalido/);
});

test('candidato segue estrutura vinculada a curriculum e oportunidade', () => {
  const db = sampleDb();
  const normalized = normalizeCandidate(
    {
      id: 'cand_maria',
      name: ' Maria ',
      idNome: 'curr_maria',
      opportunityId: 'opp_1',
      valorHora: '150',
      observation: 'Aprovada pelo gestor',
      aprovado: true
    },
    db
  );
  const enriched = enrichCandidate(normalized, db);

  assert.equal(normalized.curriculumId, 'curr_maria');
  assert.equal(normalized.hourlyRate, 150);
  assert.equal(normalized.approved, true);
  assert.equal(normalized.stage, 'Triagem');
  assert.equal(normalized.aderencia, 50);
  assert.equal(enriched.opportunityName, 'Dev Backend');
  assert.equal(enriched.opportunityCode, 'OPP-001');
  assert.equal(enriched.curriculumName, '');
});

test('curriculum normaliza estrutura importada', () => {
  const normalized = normalizeCurriculum({
    _id: "ObjectId('69d810e8ea6b2af3cebdfb48')",
    nome: ' Antonio Miguel Costa Junior ',
    email: 'antoniomiguel2332@gmail.com',
    telefone: '34-93300-2293',
    id_controle: '01',
    blacklist: true,
    blacklistObservation: 'Nao contratar novamente',
    versoes: [{ numero: 1 }]
  });

  assert.equal(normalized.id, '01');
  assert.equal(normalized.mongoId, "ObjectId('69d810e8ea6b2af3cebdfb48')");
  assert.equal(normalized.nome, 'Antonio Miguel Costa Junior');
  assert.equal(normalized.email, 'antoniomiguel2332@gmail.com');
  assert.equal(normalized.blackflag, true);
  assert.equal(normalized.blackflagObservation, 'Nao contratar novamente');
  assert.deepEqual(normalized.versoes, [{ numero: 1 }]);
});

test('curriculum cria blackflag false por padrao', () => {
  const normalized = normalizeCurriculum({
    id: 'curr_sem_flag',
    nome: 'Candidato Sem Flag'
  });

  assert.equal(normalized.blackflag, false);
  assert.equal(normalized.blackflagObservation, '');
});

test('aderencia aceita apenas valores predefinidos', () => {
  assert.equal(normalizeCandidate({ id: 'cand_1', name: 'Ana', aderencia: 75 }).aderencia, 75);
  assert.throws(() => normalizeCandidate({ id: 'cand_2', name: 'Bruno', aderencia: 80 }), /Aderencia invalida/);
});

test('alocado normaliza estrutura e vincula cliente', () => {
  const db = sampleDb();
  const normalized = normalizeAllocated({
    id: 'alloc_1',
    Id: '1058',
    codigo: 'ALC-001',
    consultor: ' Ana Silva ',
    skill: 'RPA',
    clientId: 'client_1',
    valorHora: '145.50',
    fone: '11-99999-0000',
    emailConsultor: 'ana@example.com',
    inicio: '2026-05-21',
    ativo: 'Sim',
    termino: '',
    gestor: 'Gestor Teste',
    emailGestor: 'gestor@example.com',
    foneGestor: '11-98888-0000'
  });
  const enriched = enrichAllocated(normalized, db);

  assert.equal(normalized.code, 'ALC-001');
  assert.equal(normalized.externalId, '1058');
  assert.equal(normalized.consultant, 'Ana Silva');
  assert.equal(normalized.hourlyRate, 145.5);
  assert.equal(normalized.active, true);
  assert.equal(enriched.clientName, 'Cliente Teste');
});

test('rate card calcula maximo e vincula cliente', () => {
  const db = sampleDb();
  const normalized = normalizeRateCard({
    id: 'rate_1',
    Skill: ' PROTHEUS ',
    taxa: '113',
    ativo: 'Sim',
    clientId: 'client_1'
  });
  const enriched = enrichRateCard(normalized, db);

  assert.equal(normalized.skill, 'PROTHEUS');
  assert.equal(normalized.rate, 113);
  assert.equal(normalized.maximum, 79.1);
  assert.equal(normalized.active, true);
  assert.equal(enriched.clientName, 'Cliente Teste');
});

test('apontamento de horas normaliza campos principais', () => {
  const normalized = normalizeWorkHourEntry({
    allocatedId: 'alloc_1',
    consultantName: 'Pessoa Teste',
    consultantEmail: 'Pessoa@Example.com',
    date: '2026-07-27',
    hours: '8.5',
    clientId: 'client_1',
    project: 'Projeto A',
    observation: 'Atividade validada'
  });

  assert.equal(normalized.allocatedId, 'alloc_1');
  assert.equal(normalized.consultantEmail, 'pessoa@example.com');
  assert.equal(normalized.date, '2026-07-27');
  assert.equal(normalized.hours, 8.5);
  assert.equal(normalized.project, 'Projeto A');
});

test('faturamento recalcula acumulado realizado por ano calendario', () => {
  const rows = recalculateFaturamentoAccumulatedRealized([
    { id: 'fat_2025_12', monthYear: '2025-12', realized: 4978, result: 1000, accumulatedRealized: 4978 },
    { id: 'fat_2026_01', monthYear: '2026-01', realized: 888, result: 88.8, accumulatedRealized: 5866 },
    { id: 'fat_2026_02', monthYear: '2026-02', realized: 854, result: 85.4, accumulatedRealized: 6720 },
    { id: 'fat_2027_01', monthYear: '2027-01', realized: 0, result: 0, accumulatedRealized: 9258 }
  ]);

  assert.equal(rows.find((item) => item.id === 'fat_2025_12').accumulatedRealized, 4978);
  assert.equal(rows.find((item) => item.id === 'fat_2026_01').accumulatedRealized, 888);
  assert.equal(rows.find((item) => item.id === 'fat_2026_02').accumulatedRealized, 1742);
  assert.equal(rows.find((item) => item.id === 'fat_2027_01').accumulatedRealized, 0);
  assert.equal(rows.find((item) => item.id === 'fat_2026_01').grossMargin, 10);
});

test('faturamento calcula gross margin pelo resultado sobre realizado', () => {
  assert.equal(calculateFaturamentoGrossMargin(122315.33, 1174.5), 10414.25);
  assert.equal(calculateFaturamentoGrossMargin(100, 0), 0);
});

test('fechamento mensal de horas preserva dias uteis faltantes', () => {
  const normalized = normalizeWorkHourClosure({
    allocatedId: 'alloc_1',
    monthYear: '2026-07',
    consultantEmail: 'Pessoa@Example.com',
    missingBusinessDays: ['2026-07-01', '2026-07-02'],
    confirmedWithMissingDays: true
  });

  assert.equal(normalized.allocatedId, 'alloc_1');
  assert.equal(normalized.monthYear, '2026-07');
  assert.equal(normalized.consultantEmail, 'pessoa@example.com');
  assert.deepEqual(normalized.missingBusinessDays, ['2026-07-01', '2026-07-02']);
  assert.equal(normalized.confirmedWithMissingDays, true);
});

test('calendario de feriados normaliza dia inteiro e intervalo por cliente', () => {
  const fullDay = normalizeBusinessCalendarEntry({
    data: '2026-08-10',
    diaInteiro: true,
    clienteId: 'client_1',
    motivo: 'Feriado cliente',
    observacao: 'Parada operacional'
  });
  const partial = normalizeBusinessCalendarEntry({
    date: '2026-08-11',
    allDay: false,
    startTime: '09:30',
    endTime: '12:00',
    reason: 'Manutenção'
  });

  assert.equal(fullDay.date, '2026-08-10');
  assert.equal(fullDay.allDay, true);
  assert.equal(fullDay.startTime, '00:00');
  assert.equal(fullDay.endTime, '23:59');
  assert.equal(fullDay.clientId, 'client_1');
  assert.equal(partial.allDay, false);
  assert.equal(partial.startTime, '09:30');
  assert.equal(partial.endTime, '12:00');
});

test('base normalizada cria rate cards TOTVS iniciais sem duplicar', () => {
  const normalized = normalizeDatabase({
    clients: [],
    users: [],
    opportunities: [],
    faturamento: [],
    curriculums: [],
    candidates: [],
    allocateds: [],
    cvFilters: [],
    selectedCandidates: [],
    rateCards: []
  });
  const repeated = normalizeDatabase(normalized);
  const totvsCards = repeated.rateCards.filter((rateCard) => rateCard.clientId === 'client_totvs');

  assert.equal(normalized.clients.some((client) => client.id === 'client_totvs'), true);
  assert.equal(totvsCards.length, 19);
  assert.equal(totvsCards.find((rateCard) => rateCard.skill === 'SIGAEIC')?.maximum, 129.5);
});

test('base normalizada preserva gestor do cliente e arvore de contatos', () => {
  const normalized = normalizeDatabase({
    clients: [
      {
        id: 'client_tree',
        customerName: 'Cliente Arvore',
        managerContactId: 'contact_1'
      }
    ],
    contactClients: [
      {
        id: 'contact_1',
        clientId: 'client_tree',
        name: 'Gestor Principal'
      },
      {
        id: 'contact_2',
        clientId: 'client_tree',
        name: 'Contato Filho',
        parentContactId: 'contact_1'
      }
    ]
  });

  assert.equal(normalized.clients.find((client) => client.id === 'client_tree')?.managerContactId, 'contact_1');
  assert.equal(normalized.contactClients.find((contact) => contact.id === 'contact_2')?.parentContactId, 'contact_1');
});

test('bolsao de candidatos normaliza campos da planilha TOTVS', () => {
  const db = sampleDb();
  const normalized = normalizeCandidatePool({
    id: 'pool_1',
    clientId: 'client_1',
    'Nome (FK nome Curriculum)': 'Roberto Teixeira',
    'Perfil (Select: Técnico, Funcional)': 'Técnico',
    'Valor Hora (Currency)': 85,
    'Data Acordo (Date)': '2026-05-22T00:00:00',
    'Ativo (Checkbox)': 'true',
    'Técnico ADVPL (Checkbox)': 'true'
  });
  const enriched = enrichCandidatePool(normalized, db);

  assert.equal(normalized.candidateName, 'Roberto Teixeira');
  assert.equal(normalized.profile, 'Técnico');
  assert.equal(normalized.hourlyRate, 85);
  assert.equal(normalized.agreementDate, '2026-05-22');
  assert.equal(normalized.status, 'Ativo');
  assert.equal(normalized.active, true);
  assert.equal(normalized.tecnicoAdvpl, true);
  assert.equal(normalized.scrumMaster, false);
  assert.equal(enriched.clientName, 'Cliente Teste');
  assert.deepEqual(enriched.activeSkills, ['Técnico ADVPL']);
});

test('bolsao de candidatos aceita status alocado como indisponivel', () => {
  const normalized = normalizeCandidatePool({
    id: 'pool_alocado',
    clientId: 'client_1',
    candidateName: 'Pessoa Alocada',
    profile: 'Técnico',
    status: 'Alocado',
    active: true
  });

  assert.equal(normalized.status, 'Alocado');
  assert.equal(normalized.active, false);
});

test('bolsao de candidatos aceita flag Scrum Master', () => {
  const normalized = normalizeCandidatePool({
    id: 'pool_scrum',
    clientId: 'client_1',
    candidateName: 'Scrum Teste',
    profile: 'Funcional',
    scrumMaster: true
  });

  assert.equal(normalized.scrumMaster, true);
});

test('base normalizada cria bolsao TOTVS inicial sem duplicar', () => {
  const normalized = normalizeDatabase({
    clients: [],
    users: [],
    opportunities: [],
    faturamento: [],
    curriculums: [],
    candidates: [],
    allocateds: [],
    cvFilters: [],
    selectedCandidates: [],
    rateCards: [],
    candidatePool: []
  });
  const repeated = normalizeDatabase(normalized);
  const totvsClient = repeated.clients.find((client) => client.id === 'client_totvs');
  const totvsPool = repeated.candidatePool.filter((item) => item.clientId === 'client_totvs');

  assert.ok(totvsClient);
  assert.equal(totvsPool.length, 5);
  assert.equal(totvsPool.find((item) => item.candidateName === 'Roberto Teixeira')?.tecnicoAdvpl, true);
});

test('observacoes de curriculum normalizam rastreabilidade por usuario', () => {
  const normalized = normalizeDatabase({
    clients: [],
    users: [],
    opportunities: [],
    faturamento: [],
    curriculums: [],
    candidates: [],
    allocateds: [],
    cvFilters: [],
    selectedCandidates: [],
    rateCards: [],
    candidatePool: [],
    curriculumObservations: [
      {
        id_curriculum: 'curr_1',
        observacoes: 'Contato realizado com candidato.',
        responsavel: 'user_1',
        data: '2026-07-03T10:00:00.000Z'
      }
    ]
  });
  const observation = normalized.curriculumObservations[0];
  const direct = normalizeCurriculumObservation({
    curriculumId: 'curr_2',
    observation: 'Nova observação',
    userId: 'user_2'
  });

  assert.equal(observation.curriculumId, 'curr_1');
  assert.equal(observation.observation, 'Contato realizado com candidato.');
  assert.equal(observation.userId, 'user_1');
  assert.equal(observation.date, '2026-07-03T10:00:00.000Z');
  assert.equal(direct.curriculumId, 'curr_2');
  assert.equal(direct.userId, 'user_2');
  assert.equal(direct.observation, 'Nova observação');
});

test('filtro de CV normaliza campos e valida UF e percentual', () => {
  const db = sampleDb();
  const normalized = normalizeCvFilter({
    opportunityId: 'opp_1',
    job_description: 'Pessoa desenvolvedora backend',
    estado: 'sp',
    cidade: 'São Paulo',
    percentual_acerto: '85',
    quantidade_retorno: '12',
    nivel_ingles: 'IntermediÃ¡rio',
    habilidades_obrigatorias: 'PL SQL, JavaScript, InglÃªs avanÃ§ado, UIPath',
    searchRejectedResults: [
      {
        nome: 'Candidato rejeitado',
        fonte: 'APINFO',
        link: 'https://www.apinfo.com/apinfo/candidato/rejeitado',
        score: 40,
        observacao: 'Faltam habilidades obrigatorias: UIPath.'
      }
    ]
  });
  const enriched = enrichCvFilter(normalized, db);

  assert.ok(BRAZIL_UFS.includes('SP'));
  assert.equal(normalized.state, 'SP');
  assert.equal(normalized.city, 'São Paulo');
  assert.equal(normalized.matchPercent, 85);
  assert.equal(normalized.resultLimit, 12);
  assert.equal(normalized.englishLevel, 'IntermediÃ¡rio');
  assert.equal(normalized.mandatorySkills, 'PL SQL, JavaScript, InglÃªs avanÃ§ado, UIPath');
  assert.deepEqual(normalized.searchRejectedResults, []);
  assert.equal(enriched.opportunityName, 'Dev Backend');
  assert.throws(() => normalizeCvFilter({ estado: 'XX', percentual_acerto: 50 }), /UF invalida/);
  assert.throws(() => normalizeCvFilter({ estado: 'SP', percentual_acerto: 101 }), /Percentual de acerto invalido/);
});

test('oportunidade normaliza campos comerciais e mantem Id_Oportunidade como referencia', () => {
  const db = normalizeDatabase({
    clients: [{ id: 'client_1', customerName: 'Cliente Teste' }],
    opportunities: [{
      id: 'opp_1',
      clientId: 'client_1',
      opportunity: 'Gerente de Projetos',
      idOportunidade: '1896',
      codigoOportunidadeCliente: 'TOTVS-2026-001',
      tipoContratacao: 'PJ',
      modeloTrabalho: 'Hibrido',
      job_description: 'Atuar como PMO senior'
    }]
  });

  assert.equal(db.opportunities[0].opportunityCode, '1896');
  assert.equal(db.opportunities[0].clientOpportunityCode, 'TOTVS-2026-001');
  assert.equal(db.opportunities[0].contractType, 'PJ');
  assert.equal(db.opportunities[0].workModel, 'Hibrido');
  assert.equal(db.opportunities[0].jobDescription, 'Atuar como PMO senior');
});

test('filtro de CV aceita estado cidade e ingles em branco para buscar todos', () => {
  const normalized = normalizeCvFilter({
    opportunityId: 'opp_1',
    jobDescription: 'Pessoa desenvolvedora backend',
    state: '',
    city: '',
    englishLevel: '',
    matchPercent: 0
  });

  assert.equal(normalized.state, '');
  assert.equal(normalized.city, '');
  assert.equal(normalized.englishLevel, '');
});

test('candidato selecionado normaliza e vincula oportunidade', () => {
  const db = sampleDb();
  const normalized = normalizeSelectedCandidate({
    opportunityId: 'opp_1',
    cvFilterId: 'cvf_1',
    nome: ' Candidato APINFO ',
    fonte: 'APINFO',
    link: 'https://www.apinfo.com/apinfo/candidato/123',
    curriculumId: '1001',
    linkedinLink: 'https://linkedin.com/in/candidato',
    apinfoLink: 'https://www.apinfo.com/apinfo/candidato/123',
    score: 120,
    origem: 'Rejeitado',
    mensagemCandidato: 'Mensagem de contato',
    observacao: 'Faltou experiencia em UIPath'
  });
  const enriched = enrichSelectedCandidate(normalized, db);

  assert.equal(normalized.name, 'Candidato APINFO');
  assert.equal(normalized.score, 100);
  assert.equal(normalized.curriculumId, '1001');
  assert.equal(normalized.linkedinLink, 'https://linkedin.com/in/candidato');
  assert.equal(normalized.apinfoLink, 'https://www.apinfo.com/apinfo/candidato/123');
  assert.equal(normalized.origin, 'Rejeitado');
  assert.equal(normalized.candidateMessage, 'Mensagem de contato');
  assert.equal(enriched.opportunityName, 'Dev Backend');
  assert.equal(enriched.opportunityCode, 'OPP-001');
});

test('candidato selecionado encontra curriculum pelo nome quando link externo existe', () => {
  const db = sampleDb();
  const normalized = normalizeSelectedCandidate({
    opportunityId: 'opp_1',
    cvFilterId: 'cvf_1',
    name: 'Ana',
    source: 'LinkedIn/Google',
    link: 'https://linkedin.com/in/ana',
    score: 100
  });
  const enriched = enrichSelectedCandidate(normalized, db);

  assert.equal(enriched.curriculumId, 'curr_ana');
});

test('resultado de busca de CV normaliza link e limita score', () => {
  const normalized = normalizeCvSearchResult({
    nome: ' Candidato APINFO ',
    fonte: 'APINFO',
    link: 'https://www.apinfo.com/apinfo/candidato/123',
    curriculumId: '1001',
    linkedinLink: 'https://linkedin.com/in/candidato',
    apinfoLink: 'https://www.apinfo.com/apinfo/candidato/123',
    score: 120,
    observacao: 'Boa aderencia ao filtro'
  });

  assert.equal(normalized.name, 'Candidato APINFO');
  assert.equal(normalized.source, 'APINFO');
  assert.equal(normalized.link, 'https://www.apinfo.com/apinfo/candidato/123');
  assert.equal(normalized.curriculumId, '1001');
  assert.equal(normalized.linkedinLink, 'https://linkedin.com/in/candidato');
  assert.equal(normalized.apinfoLink, 'https://www.apinfo.com/apinfo/candidato/123');
  assert.equal(normalized.score, 100);
  assert.equal(normalized.observation, 'Boa aderencia ao filtro');
});

test('senha de usuario e validada por hash e nao por texto puro', () => {
  const passwordHash = hashPassword('alcateia', 'salt-de-teste');

  assert.equal(verifyPassword('alcateia', passwordHash), true);
  assert.equal(verifyPassword('outra-senha', passwordHash), false);
  assert.equal(passwordHash.includes('alcateia'), false);
});

test('usuario sanitizado nao expoe passwordHash', () => {
  const user = sanitizeUser({
    id: 'user_1',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'Admin',
    passwordHash: 'hash',
    mustChangePassword: true
  });

  assert.deepEqual(user, {
    id: 'user_1',
    name: 'Admin',
    email: 'admin@example.com',
    role: 'Admin',
    mustChangePassword: true
  });
});

test('bulk write do Mongo app agrupa updates por documento', () => {
  const { ids, operations } = buildMongoAppBulkWrite([
    { _id: 'mongo-interno', id: 'client_a', customerName: 'Cliente A' },
    { id: 'client_b', customerName: 'Cliente B' }
  ], 'clients');

  assert.deepEqual(ids, ['client_a', 'client_b']);
  assert.equal(operations.length, 2);
  assert.deepEqual(operations[0], {
    replaceOne: {
      filter: { id: 'client_a' },
      replacement: { id: 'client_a', customerName: 'Cliente A' },
      upsert: true
    }
  });
  assert.equal('_id' in operations[0].replaceOne.replacement, false);
});

test('leituras ordenadas do Mongo app permitem sort em disco', () => {
  const dbSource = readFileSync(new URL('../db.js', import.meta.url), 'utf8');

  assert.match(dbSource, /find\(\{\}, \{\s*sort: \{ createdAt: 1, id: 1, _id: 1 \},\s*allowDiskUse: true\s*\}\)/);
});

test('Mongo operacional continua obrigatorio em runtime de producao', () => {
  const dbSource = readFileSync(new URL('../db.js', import.meta.url), 'utf8');

  assert.match(dbSource, /const productionRuntime = isProductionRuntime\(env\)/);
  assert.match(dbSource, /required:\s*productionRuntime\s*\?\s*true/s);
});

test('gravacao parcial em JSON preserva colecoes fora do alvo', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'talentos-db-'));
  const file = path.join(directory, 'database.json');

  try {
    await writeFile(file, `${JSON.stringify({
      clients: [{ id: 'client_1', customerName: 'Cliente Original' }],
      curriculums: [{ id: 'curr_1', id_controle: 'curr_1', nome: 'Curriculo Original' }],
      contactClients: []
    })}\n`, 'utf8');

    const partial = await readDatabaseCollections(['clients', 'contactClients'], file);
    partial.contactClients.push({
      id: 'contact_1',
      clientId: 'client_1',
      name: 'Contato Teste'
    });

    await writeDatabaseCollections(partial, ['contactClients'], file);
    await writeDatabaseDocument('contactClients', {
      id: 'contact_2',
      clientId: 'client_1',
      name: 'Contato Documento'
    }, file);
    await deleteDatabaseDocument('contactClients', 'contact_1', file);
    const saved = JSON.parse(await readFile(file, 'utf8'));

    assert.equal(saved.clients.some((client) => client.customerName === 'Cliente Original'), true);
    assert.equal(saved.curriculums.some((curriculum) => curriculum.nome === 'Curriculo Original'), true);
    assert.equal(saved.contactClients.length, 1);
    assert.equal(saved.contactClients[0].name, 'Contato Documento');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
