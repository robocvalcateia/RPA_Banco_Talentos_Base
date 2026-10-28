import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCandidateFitAlert,
  candidateFitAlertId,
  matchingOpenOpportunities,
  notifyNewCurriculumFits,
  opportunityFitFilter,
  recentCurriculumIds
} from '../candidate-fit-alerts.js';

test('selects newly created curricula for catch-up processing', () => {
  const ids = recentCurriculumIds([
    { id_controle: '10', data_criacao: '2026-10-26T23:59:59Z' },
    { id_controle: '11', data_criacao: '2026-10-27T01:00:00Z' },
    { id_controle: '12', data_atualizacao: '2026-10-27T02:00:00Z' }
  ], '2026-10-27T00:00:00Z');
  assert.deepEqual(ids, ['11', '12']);
});

test('legacy collection identifiers remain usable after synchronization', async () => {
  const sourceId = '6900abcdefabcdefabcdef12';
  const queries = (await import('../mongo_talentos.js')).__mongoTalentosTest.buildCandidateIdentifierQueries(sourceId);
  assert.ok(queries.some(query => query.legacy_candidato_id === sourceId));
});

const curriculum = {
  id_controle: 'CV-900',
  nome: 'Pessoa Tax',
  skills: 'Tax One, Mastersaf DW',
  experiencia_profissional: '2024 a atual - Consultor funcional Mastersaf DW: implementação, parametrização e suporte aos usuários.'
};

const openTaxOne = {
  id: 'opp-tax', opportunityCode: '2100', opportunity: 'Consultor Funcional Tax One Pleno', status: 'Open', workModel: 'Remoto',
  jobDescription: 'Experiência com Tax One em implementação, parametrização e suporte funcional.'
};

test('derives each vacancy matrix from its own technology', () => {
  const tax = opportunityFitFilter(openTaxOne);
  const datasul = opportunityFitFilter({ ...openTaxOne, id: 'opp-data', opportunity: 'Consultor Datasul', jobDescription: 'Experiência com TOTVS Datasul.', intakeDetails: { coreSkill: 'Datasul' } });
  assert.equal(tax.coreSkill, 'Tax One');
  assert.equal(datasul.coreSkill, 'Datasul');
  assert.doesNotMatch(tax.mandatorySkills, /SAP|Datasul/i);
  assert.doesNotMatch(datasul.mandatorySkills, /SAP|Tax One/i);
});

test('accepts the approved Oracle Cloud aliases and bare Datasul as core product evidence', () => {
  const oracleOpportunity = {
    id: 'oracle-cloud', opportunity: 'Consultor Oracle Cloud', status: 'Open', workModel: 'Remoto',
    intakeDetails: { coreSkill: 'Oracle Cloud' },
    jobDescription: 'Consultor Oracle Cloud para implementação funcional.'
  };
  for (const product of ['Oracle Cloud', 'Oracle Fusion', 'Fusion', 'ERP Cloud', 'ERP Oracle']) {
    const person = {
      id_controle: `CV-${product}`, nome: product, cargo_atual: 'Consultor Funcional',
      experiencia_profissional: `2024 a atual - Consultor funcional ${product}: implementação e parametrização.`
    };
    assert.deepEqual(matchingOpenOpportunities(person, [oracleOpportunity]).map(row => row.opportunity.id), ['oracle-cloud']);
  }
  const datasulOpportunity = {
    id: 'datasul', opportunity: 'Consultor Datasul', status: 'Open', workModel: 'Remoto',
    intakeDetails: { coreSkill: 'Datasul' }, jobDescription: 'Consultor Datasul para implementação funcional.'
  };
  const datasulPerson = {
    id_controle: 'CV-DATASUL', nome: 'Pessoa Datasul', cargo_atual: 'Consultor Funcional',
    experiencia_profissional: '2024 a atual - Consultor funcional Datasul: implementação e parametrização.'
  };
  assert.deepEqual(matchingOpenOpportunities(datasulPerson, [datasulOpportunity]).map(row => row.opportunity.id), ['datasul']);
});

test('matches only technically approved open opportunities without operational conflict', () => {
  const rows = matchingOpenOpportunities(curriculum, [
    openTaxOne,
    { ...openTaxOne, id: 'closed', status: 'Closed' },
    { ...openTaxOne, id: 'sap', opportunity: 'Consultor SAP FI', jobDescription: 'Experiência com SAP FI.' }
  ]);
  assert.deepEqual(rows.map(row => row.opportunity.id), ['opp-tax']);
});

test('sends one grouped email to Gerson and Bruno and never duplicates curriculum-vacancy alert', async () => {
  const logs = [];
  const sent = [];
  const dependencies = {
    curriculum,
    opportunities: [openTaxOne],
    baseUrl: 'https://rpa-banco-talentos-5v5r.onrender.com',
    readLogs: async () => logs,
    writeLog: async row => logs.push(row),
    send: async message => sent.push(message),
    now: () => '2026-10-27T12:00:00.000Z'
  };
  const first = await notifyNewCurriculumFits(dependencies);
  const second = await notifyNewCurriculumFits(dependencies);
  assert.equal(first.status, 'sent');
  assert.equal(second.status, 'already_sent');
  assert.equal(sent.length, 1);
  assert.match(sent[0].to, /gerson@alcateiaconsulting\.com\.br/);
  assert.match(sent[0].to, /bruno@alcateiaconsulting\.com\.br/);
  assert.match(sent[0].text, /2100 - Consultor Funcional Tax One Pleno/);
  assert.match(sent[0].text, /view=curriculums&curriculumId=CV-900/);
  assert.equal(logs[0].id, candidateFitAlertId(curriculum, openTaxOne));
});

test('email content groups all matching vacancies for the professional', () => {
  const matches = matchingOpenOpportunities(curriculum, [openTaxOne, { ...openTaxOne, id: 'opp-tax-2', opportunityCode: '2101' }]);
  const email = buildCandidateFitAlert({ curriculum, matches, baseUrl: 'https://example.test' });
  assert.match(email.text, /2100/);
  assert.match(email.text, /2101/);
  assert.equal((email.text.match(/Acessar o currículo:/g) || []).length, 1);
});

test('does not alert a PMO profile for an Oracle Cloud functional vacancy', () => {
  const cleber = {
    id_controle: 'CV-CLEBER', nome: 'Cleber', cargo_atual: 'PMO / Gerente de Projetos',
    skills: 'Oracle, gestão de projetos, integração',
    experiencia_profissional: 'Gerente de projetos de integração de sistemas Oracle. Gestão de cronograma e fornecedores.',
    search_text_all: 'Oracle Cloud OM AR TAX implementação configuração'
  };
  const oracle = {
    id: '149', opportunityCode: '1978', opportunity: 'Consultor Oracle Cloud - OM/AR/TAX', status: 'Open', workModel: 'Remoto',
    intakeDetails: { coreSkill: 'Oracle ERP Cloud', mandatorySkills: 'Oracle ERP Cloud; OM; AR; Tax; atuação funcional' },
    jobDescription: 'Consultor funcional Oracle ERP Cloud. Obrigatório: OM, AR e Tax. Implementação e configuração funcional.'
  };
  assert.deepEqual(matchingOpenOpportunities(cleber, [oracle]), []);
});

test('does not combine old Protheus PCP management with unrelated fiscal knowledge', () => {
  const tseng = {
    id_controle: 'CV-TSENG', nome: 'Tseng Kan', cargo_atual: 'Product Manager / Product Owner / Tech Lead',
    skills: 'Protheus, PCP, fiscal',
    experiencia_profissional: [
      '2005 a 2007 - Gerente de TI. Automação e integração do Protheus PCP; treinamento de usuários.',
      '2021 a atual - Product Owner. Processos fiscais em plataforma própria.'
    ].join('\n\n')
  };
  const vacancies = [
    { id: '174', opportunity: 'Alocação pontual Protheus Senior', status: 'Open', workModel: 'Remoto', intakeDetails: { coreSkill: 'Protheus SIGADPR', mandatorySkills: 'Protheus; SIGADPR; implementação' }, jobDescription: 'Consultor funcional Protheus. Obrigatório SIGADPR e implementação.' },
    { id: '179', opportunity: 'Analista de Sistemas Protheus Pleno', status: 'Open', workModel: 'Remoto', intakeDetails: { coreSkill: 'Protheus', mandatorySkills: 'Protheus; Financeiro; Ativo Fixo; Fiscal; sustentação' }, jobDescription: 'Atuação funcional em Protheus Financeiro, Ativo Fixo e Fiscal, com sustentação e parametrização.' },
    { id: '175', opportunity: 'Protheus presencial Barueri', status: 'Open', workModel: 'Presencial', intakeDetails: { coreSkill: 'Protheus Contábil', mandatorySkills: 'Protheus; Contábil; LP; ADVPL' }, jobDescription: 'Consultor funcional Protheus Contábil com LP e ADVPL, presencial em Barueri.' }
  ];
  assert.deepEqual(matchingOpenOpportunities(tseng, vacancies), []);
});

test('never sends an automatic alert with zero technical score', () => {
  const vagueOpportunity = {
    id: 'zero', opportunity: 'Consultor Tax One', status: 'Open', workModel: 'Remoto',
    intakeDetails: { coreSkill: 'Tax One' }, jobDescription: 'Experiência profissional em Tax One.'
  };
  assert.deepEqual(matchingOpenOpportunities(curriculum, [vagueOpportunity]), []);
});
