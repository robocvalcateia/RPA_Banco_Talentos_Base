import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { screenCandidate, coreKeyword, englishEvidence, hasSkill, screeningStats } from '../candidate-screening.js';
import { evaluateInternalCandidateForFilter, evaluateLinkedinCandidateTextForFilter, buildLinkedinQueries, searchApinfoAndLinkedinCandidates } from '../apinfo.js';
import { normalizeCvFilter, normalizeCvSearchResult } from '../db.js';
const filter = { coreSkill: 'SAP MM', mandatorySkills: 'SAP MM', technicalSkills: 'J1BTAX, TAXBRA, revisão de faturas', desirableSkills: 'SAP Activate, debug', englishLevel: 'Avançado', locations: 'São Paulo/SP; Rio de Janeiro/RJ', matchPercent: 60 };
test('retrieval uses only the core, with a broad LinkedIn strategy', () => {
  assert.equal(coreKeyword({ mandatorySkills: 'SAP FI, localização Brasil' }), 'SAP FI');
  const query = buildLinkedinQueries({ ...filter, mandatorySkills: 'SAP MM, localização Brasil' })[0].query;
  assert.match(query, /SAP MM/); assert.doesNotMatch(query, /localiza|Janeiro|Avançado/);
});
test('English cannot be inferred from Spanish fluency or technical courses', () => {
  assert.equal(englishEvidence('Espanhol fluente. Curso avançado SAP'), 0);
  assert.equal(englishEvidence('Inglês C1'), 3);
  assert.equal(englishEvidence('Advanced English'), 3);
  assert.equal(screenCandidate('SAP MM. Espanhol fluente.', filter).classification, 'review');
  assert.equal(screenCandidate('SAP MM. Inglês básico.', filter).classification, 'rejected');
});
test('unknown fields stay pending; either requested city qualifies when structured', () => {
  for (const [city, state] of [['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ']]) {
    const result = screenCandidate('SAP MM J1BTAX TAXBRA invoice verification', filter, { city, state, englishLevel: 'Fluente' });
    assert.equal(result.classification, 'approved'); assert.ok(result.score >= 60);
  }
  assert.equal(screenCandidate('SAP MM J1BTAX TAXBRA', filter).classification, 'review');
  assert.equal(screenCandidate('SAP MM', filter, { city: 'Curitiba', state: 'PR' }).classification, 'review');
});
test('short public profiles never fail the complete JD threshold or become approved', () => {
  const result = evaluateLinkedinCandidateTextForFilter('Consultor SAP MM e J1BTAX', { ...filter, jobDescription: 'texto muito extenso '.repeat(100), matchPercent: 100 });
  assert.equal(result.classification, 'review'); assert.equal(result.accepted, false);
  assert.doesNotMatch(result.reason, /abaixo do mínimo/);
});
test('no module crossover or partial token matches; tax evidence is not automatic proof', () => {
  assert.equal(hasSkill('SAP MM', 'SAP FI'), false);
  assert.equal(hasSkill('SAP FICO', 'SAP FI'), true);
  assert.equal(hasSkill('SAP FIORI', 'SAP FI'), false);
  const result = screenCandidate('SAP MM J1BTAX', { ...filter, mandatorySkills: 'SAP MM, localização Brasil' });
  assert.equal(result.classification, 'review'); assert.match(result.reason, /indícios técnicos/);
  assert.equal(screenCandidate('Consultor SAP SD', filter).classification, 'rejected');
});
test('differentials improve rank but are never mandatory', () => {
  const base = screenCandidate('SAP MM J1BTAX TAXBRA invoice verification', filter, { city: 'São Paulo', state: 'SP', englishLevel: 'Avançado' });
  const richer = screenCandidate('SAP MM J1BTAX TAXBRA invoice verification Activate debug', filter, { city: 'São Paulo', state: 'SP', englishLevel: 'Avançado' });
  assert.equal(base.classification, 'approved'); assert.ok(richer.score > base.score);
});
test('internal CV preserves full text, score, classification and candidate ID', () => {
  const result = evaluateInternalCandidateForFilter({ nome: 'Teste', id_controle: '42', search_text_all: 'SAP MM J1BTAX TAXBRA invoice verification', cidade: 'Rio de Janeiro', estado: 'RJ', nivel_ingles: 'Fluente' }, filter);
  assert.equal(result.accepted, true); assert.ok(Number.isFinite(result.row.score)); assert.equal(result.row.curriculumId, '42');
  const normalized = normalizeCvSearchResult(result.row);
  assert.equal(normalized.classification, 'approved'); assert.equal(normalized.score, result.row.score);
});
test('stats include every evaluated record, independent of displayed limits', () => {
  const rows = [...Array.from({ length: 20 }, () => ({ classification: 'review' })), { classification: 'approved' }, { classification: 'rejected' }];
  assert.deepEqual(screeningStats(rows, 80), { found: 80, evaluated: 22, compatible: 1, pending: 20, rejected: 1 });
});
test('new criteria persist; historical table is removed and rejection reasons remain accessible', () => {
  const normalized = normalizeCvFilter(filter);
  for (const key of ['coreSkill', 'technicalSkills', 'desirableSkills', 'locations']) assert.equal(normalized[key], filter[key]);
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /cvFilterTable|cvFilterCount/); assert.doesNotMatch(app, /cvFilterTable|renderCvFilters/);
  assert.match(html, /cvRejectedResultTable/); assert.match(app, /counts\.evaluated/);
});
test('a failure in APINFO does not hide LinkedIn results or masquerade as a successful zero', async () => {
  const previousFetch = globalThis.fetch, previousKey = process.env.SERPAPI_KEY;
  process.env.SERPAPI_KEY = 'test-only';
  globalThis.fetch = async url => String(url).includes('serpapi.com')
    ? new Response(JSON.stringify({ organic_results: [{ title: 'Consultor SAP MM', link: 'https://www.linkedin.com/in/test-screening', snippet: 'J1BTAX TAXBRA' }] }), { status: 200 })
    : new Response('unavailable', { status: 503 });
  try {
    const result = await searchApinfoAndLinkedinCandidates({ ...filter, searchApinfo: true, searchLinkedin: true }, { user: 'test', password: 'test' });
    assert.equal(result.sourceStats.APINFO.status, 'error');
    assert.equal(result.sourceStats.LINKEDIN.status, 'completed');
    assert.equal(result.sourceStats.LINKEDIN.evaluated, 1);
    assert.equal(result.results[0].classification, 'review');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.SERPAPI_KEY; else process.env.SERPAPI_KEY = previousKey;
  }
});
