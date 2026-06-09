import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIndicators,
  BRAZIL_UFS,
  CANDIDATE_STAGES,
  enrichAllocated,
  enrichCandidate,
  enrichCvFilter,
  enrichSelectedCandidate,
  hashPassword,
  moveCandidateStage,
  normalizeAllocated,
  normalizeCandidate,
  normalizeCurriculum,
  normalizeCvFilter,
  normalizeCvSearchResult,
  normalizeSelectedCandidate,
  normalizeOpportunityModel,
  OPPORTUNITY_MODELS,
  OPPORTUNITY_STATUSES,
  sanitizeUser,
  syncCandidatesWithOpportunityClosures,
  verifyPassword
} from '../db.js';

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
  assert.equal(indicators.candidatesByStage.Aprovado, 1);
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
    versoes: [{ numero: 1 }]
  });

  assert.equal(normalized.id, '01');
  assert.equal(normalized.mongoId, "ObjectId('69d810e8ea6b2af3cebdfb48')");
  assert.equal(normalized.nome, 'Antonio Miguel Costa Junior');
  assert.equal(normalized.email, 'antoniomiguel2332@gmail.com');
  assert.deepEqual(normalized.versoes, [{ numero: 1 }]);
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
  assert.equal(normalized.mandatorySkills, 'PL SQL, JavaScript, ');
  assert.deepEqual(normalized.searchRejectedResults, []);
  assert.equal(enriched.opportunityName, 'Dev Backend');
  assert.throws(() => normalizeCvFilter({ estado: 'XX', percentual_acerto: 50 }), /UF invalida/);
  assert.throws(() => normalizeCvFilter({ estado: 'SP', percentual_acerto: 101 }), /Percentual de acerto invalido/);
});

test('candidato selecionado normaliza e vincula oportunidade', () => {
  const db = sampleDb();
  const normalized = normalizeSelectedCandidate({
    opportunityId: 'opp_1',
    cvFilterId: 'cvf_1',
    nome: ' Candidato APINFO ',
    fonte: 'APINFO',
    link: 'https://www.apinfo.com/apinfo/candidato/123',
    score: 120,
    origem: 'Rejeitado',
    mensagemCandidato: 'Mensagem de contato',
    observacao: 'Faltou experiencia em UIPath'
  });
  const enriched = enrichSelectedCandidate(normalized, db);

  assert.equal(normalized.name, 'Candidato APINFO');
  assert.equal(normalized.score, 100);
  assert.equal(normalized.origin, 'Rejeitado');
  assert.equal(normalized.candidateMessage, 'Mensagem de contato');
  assert.equal(enriched.opportunityName, 'Dev Backend');
  assert.equal(enriched.opportunityCode, 'OPP-001');
});

test('resultado de busca de CV normaliza link e limita score', () => {
  const normalized = normalizeCvSearchResult({
    nome: ' Candidato APINFO ',
    fonte: 'APINFO',
    link: 'https://www.apinfo.com/apinfo/candidato/123',
    score: 120,
    observacao: 'Boa aderencia ao filtro'
  });

  assert.equal(normalized.name, 'Candidato APINFO');
  assert.equal(normalized.source, 'APINFO');
  assert.equal(normalized.link, 'https://www.apinfo.com/apinfo/candidato/123');
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
