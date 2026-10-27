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

const curriculum = {
  id_controle: 'CV-900',
  nome: 'Pessoa Tax',
  skills: 'Tax One, Mastersaf DW',
  experiencia_profissional: 'Consultor funcional Mastersaf DW: implementação, parametrização e suporte aos usuários.'
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
