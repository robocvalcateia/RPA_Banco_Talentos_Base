import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretVacancy, screenCandidate, contextualEvidence } from '../candidate-screening.js';

const vacancy = {
  coreSkill: 'SAP FI',
  mandatorySkills: 'SAP FI — atuação funcional em AP (contas a pagar), AR (contas a receber) e GL (contabilidade geral)',
  jobDescription: 'Mínimo de 6 anos. Plano de contas, impostos retidos e fechamento contábil. SAP CO e debug serão diferenciais. Trabalho híbrido, viagens e dedicação exclusiva.',
  englishLevel: 'Avançado', locations: 'São Paulo/SP; Rio de Janeiro/RJ', matchPercent: 100
};
const professional = 'Consultor funcional SAP FI: configuração de FI-AP, FI-AR e FI-GL em implementação para cliente.';

test('interprets natural-language mandatory skill before reviewing CVs', () => {
  const plan = interpretVacancy(vacancy);
  assert.deepEqual(plan.mandatory.sort(), ['SAP FI', 'SAP AP', 'SAP AR', 'SAP GL'].sort());
  assert.equal(plan.ranking.find(item => item.term === 'plano de contas').weight, 3);
  assert.equal(plan.ranking.find(item => item.term === 'SAP CO').weight, 1);
  assert.equal(plan.operational.minimumYears, 6);
  assert.ok(!plan.ranking.some(item => /anos|viagens|inglês/.test(item.term)));
});

test('FI AP AR GL professional evidence approves triage despite unknown operations and JD gaps', () => {
  const result = screenCandidate(professional, vacancy);
  assert.equal(result.classification, 'approved');
  assert.equal(result.approvalScope, 'technical_triage');
  assert.equal(result.presentationStatus, 'requires_validation');
  assert.ok(result.score < 100);
  assert.ok(result.operationalChecks.some(item => item.requirement === 'Disponibilidade' && item.status === 'unknown'));
});

test('operational incompatibility stays visible and does not become technical rejection', () => {
  const result = screenCandidate(professional, vacancy, { city: 'Curitiba', state: 'PR', englishLevel: 'Básico' });
  assert.equal(result.classification, 'approved');
  assert.equal(result.operationalChecks.filter(item => item.status === 'incompatible').length, 2);
});

test('missing AR, courses, lists, negation and unrelated ABAP work cannot approve mandatory skill', () => {
  for (const cv of [
    'Consultor funcional SAP FI: configuração de FI-AP e FI-GL.',
    'Curso SAP FI FI-AP FI-AR FI-GL',
    'Habilidades: SAP FI, AP, AR, GL',
    'Sem experiência em SAP FI AP AR GL',
    'Desenvolvedor ABAP: desenvolvimento para SAP FI AP AR GL'
  ]) assert.notEqual(screenCandidate(cv, vacancy).classification, 'approved', cv);
});

test('FICO with functional FI processes qualifies; FICO limited to CO does not', () => {
  assert.equal(screenCandidate('Consultor funcional SAP FICO: configuração de accounts payable, accounts receivable e general ledger.', vacancy).classification, 'approved');
  assert.notEqual(screenCandidate('Consultor SAP FICO: configuração de CO, centros de custo e ordens internas.', vacancy).classification, 'approved');
});

test('recognizes common senior and English role wording without accepting a mere list', () => {
  for (const role of ['Consultor Sênior SAP FI', 'SAP FI consultant', 'Experiência em SAP FI']) {
    assert.equal(screenCandidate(`${role}: FI-AP, FI-AR e FI-GL.`, vacancy).classification, 'approved');
  }
});

test('synonyms and repeated terms count once, and work weighs more than a list', () => {
  const filter = { ...vacancy, jobDescription: 'Plano de contas, Chart of Accounts. Fechamento contábil.' };
  assert.equal(interpretVacancy(filter).ranking.filter(item => item.term === 'plano de contas').length, 1);
  const work = `${professional}\nConfiguração de chart of accounts e financial closing no SAP FI.`;
  const list = `${professional}\nHabilidades: chart of accounts e financial closing.`;
  assert.ok(screenCandidate(work, filter).score > screenCandidate(list, filter).score);
  assert.equal(screenCandidate(work, filter).score, screenCandidate(`${work}\n${work}`, filter).score);
});

test('a later professional implementation outweighs a training mention', () => {
  const evidence = contextualEvidence('Curso de SAP FI\nExperiência profissional\nConsultor funcional SAP FI: configuração de contas a pagar.', 'SAP AP', 'SAP FI');
  assert.equal(evidence.found, true);
});

test('public summaries never become full-CV approvals and unrelated modules fail', () => {
  assert.equal(screenCandidate(professional, vacancy, {}, true).classification, 'review');
  assert.equal(screenCandidate('Consultor SAP MM: configuração J1BTAX.', vacancy).classification, 'rejected');
});

test('AR country code, management descriptions and certified SD do not prove functional FI processes', () => {
  const cv = 'Project manager SAP FICO, gestão de projetos.\nExperiência na condução de projetos no exterior (USA-Houston, Buenos Aires-AR).\nSAP SD CERTIFIED, New GL e SAP PROJECT MANAGER.';
  const result = screenCandidate(cv, vacancy);
  assert.notEqual(result.classification, 'approved');
  assert.equal(result.evidence.find(item => item.requirement === 'SAP AR').found, false);
  assert.equal(result.evidence.find(item => item.requirement === 'SAP GL').found, false);
  assert.equal(result.evidence.find(item => item.requirement === 'SAP FI').found, false);
});

test('BI BW ETL and knowledge lists cannot substitute functional FI experience', () => {
  for (const cv of [
    'Consultor SAP FICO.\nTechnical Leader for Building the SAP BW Corporate Data Warehouse (FI AP, FI AR, FI GL).',
    'Consultor SAP FI.\nDesenvolvimento e customizações de módulos SAP (AP, AR, FI, GL) com Datastage e Fabric.',
    'Consultor SAP FI.\nConhecimento em transações FI-GL, FI-AR e FI-AP.',
    'Consultor SAP FI.\nSAP ECC, S/4HANA, Rollouts, AP/AR, GL, NewGL, TR, AA.',
    'Consultor SAP FI.\nCustomização de módulos SAP para recuperar dados nos módulos AP, AR, FI, GL e transferir para outra base.'
  ]) assert.notEqual(screenCandidate(cv, vacancy).classification, 'approved', cv);
});
