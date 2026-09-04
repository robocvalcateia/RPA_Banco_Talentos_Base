import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { screenCandidate, coreKeyword, englishEvidence, hasSkill, screeningStats, experienceEvidence } from '../candidate-screening.js';
import { evaluateInternalCandidateForFilter, evaluateLinkedinCandidateTextForFilter, buildLinkedinQueries, searchLinkedinCandidates, searchApinfoAndLinkedinCandidates, searchApinfoCandidates, apinfoNextPage } from '../apinfo.js';
import { normalizeCvFilter, normalizeCvSearchResult } from '../db.js';
const filter = { coreSkill: 'SAP MM', mandatorySkills: 'SAP MM', technicalSkills: 'J1BTAX, TAXBRA, revisão de faturas', desirableSkills: 'SAP Activate, debug', englishLevel: 'Avançado', locations: 'São Paulo/SP; Rio de Janeiro/RJ', matchPercent: 60 };
test('LinkedIn evaluates every recovered profile and paginates when strategy overlap leaves fewer than target', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SERPAPI_KEY;
  process.env.SERPAPI_KEY = 'fixture';
  const starts = [];
  globalThis.fetch = async input => {
    const url = new URL(input); const start = Number(url.searchParams.get('start') || 0); starts.push(start);
    const queryCode = [...String(url.searchParams.get('q') || '')].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
    const offset = start ? queryCode % 1000 : 0;
    return new Response(JSON.stringify({organic_results:Array.from({length:10},(_,i)=>({
      title:`Consultor SAP FI ${offset+i}`, link:`https://www.linkedin.com/in/fixture-${start}-${offset+i}`,
      snippet:'Consultor SAP FI com atuação funcional em AP AR GL'
    }))}),{headers:{'Content-Type':'application/json'}});
  };
  try {
    const result=await searchLinkedinCandidates({coreSkill:'SAP FI',mandatorySkills:'SAP FI, SAP AP, SAP AR, SAP GL',resultLimit:10},50);
    assert.equal(result.stats.evaluated,result.totalFound);
    assert.equal(result.totalFound,50);
    assert.ok(starts.some(start=>start===10));
  } finally {
    globalThis.fetch=originalFetch;
    if (originalKey === undefined) delete process.env.SERPAPI_KEY; else process.env.SERPAPI_KEY=originalKey;
  }
});
test('technical gaps cannot be offset by location English and every desirable', () => {
  const result = screenCandidate('SAP MM Activate debug', filter, { city: 'São Paulo', state: 'SP', englishLevel: 'Fluente' });
  assert.ok(result.score < 50); assert.equal(result.classification, 'review');
  assert.notEqual(result.triageGroup, 'prioridade de entrevista');
  assert.equal(result.evidence[0].found, false);
});
test('a training course does not prove professional delivery of a technical requirement', () => {
  const result = screenCandidate('SAP MM\nCurso reforma tributária\nTreinamento J1BTAX', {...filter, technicalSkills:'reforma tributária, J1BTAX'});
  assert.equal(result.technicalScore, 0);
  assert.match(result.evidence.find(item => item.requirement === 'reforma tributária').kind, /somente formação/);
  const delivered = screenCandidate('SAP MM\nCurso reforma tributária\nImplantação reforma tributária no cliente', {...filter,technicalSkills:'reforma tributária'});
  assert.ok(delivered.technicalScore > result.technicalScore);
  assert.match(delivered.evidence.find(item => item.requirement === 'reforma tributária').excerpt, /Implantação/);
});
test('FI AP AR GL aliases match real accounting terms without treating AP as arbitrary abbreviation', () => {
  assert.equal(hasSkill('contas a pagar', 'SAP AP'), true);
  assert.equal(hasSkill('accounts receivable', 'SAP AR'), true);
  assert.equal(hasSkill('general ledger', 'SAP GL'), true);
  assert.equal(hasSkill('endereço AP 42', 'SAP AP'), false);
});
test('current junior headline fails senior role but historical junior experience does not', () => {
  const senior = { ...filter, jobDescription: 'Consultor SAP MM Sênior, mínimo 6 anos' };
  assert.equal(evaluateLinkedinCandidateTextForFilter('Consultor SAP MM Junior\nJ1BTAX TAXBRA', senior).operationalChecks.find(item => item.requirement === 'Senioridade').status, 'incompatible');
  assert.notEqual(screenCandidate('SAP MM J1BTAX TAXBRA. Em 2010 trabalhou como junior.', senior).classification, 'rejected');
});
test('English basic is not overwritten by Spanish fluent on the same line', () => {
  assert.equal(englishEvidence('Inglês básico e espanhol fluente'), 1);
});
test('module experience merges overlaps and excludes unrelated module date ranges', () => {
  const text = 'SAP MM 01/2020 - 12/2022\n\nSAP MM 01/2022 - 12/2023\n\nSAP FI 01/2010 - 12/2019';
  assert.equal(experienceEvidence(text, 'SAP MM').months, 48);
  assert.equal(experienceEvidence('SAP MM 01/2024 - atual', 'SAP MM', new Date('2024-12-01')).months, 12);
});
test('APINFO follows actual next-page links and refuses external URLs', () => {
  assert.match(apinfoNextPage('<a href="pesq9b.cfm?start=21&amp;keyw=SAP">2</a>').url, /start=21&keyw=SAP/);
  assert.equal(apinfoNextPage('<a href="https://example.com/next">Próxima</a>'), null);
  const form = apinfoNextPage('<form method="post" action="pesq9b.cfm"><input type="hidden" name="inicio" value="21"><input type="submit" name="seguir" value="Proximos"></form>');
  assert.equal(form.method, 'post'); assert.equal(form.body.inicio, '21');
  const jump = apinfoNextPage('<form METHOD="POST" ACTION="pesq9b.cfm">Pular para a página :<input type="hidden" name="pkey" value="snapshot-test"><input type="hidden" name="tcv" value="3282"><input type="hidden" name="keyw" value="SAP FI"><input type="text" name="pag" value="2"><input type="submit" value="OK"></form>');
  assert.equal(jump.body.pag, '2'); assert.equal(jump.body.tcv, '3282'); assert.equal(jump.body.keyw, 'SAP FI'); assert.equal(jump.body.pkey, 'snapshot-test');
});
test('Junior as a surname is not a junior job title', () => {
  const result = evaluateLinkedinCandidateTextForFilter('Mario Zanon Junior - Consultor SAP MM Sênior\nJ1BTAX', {...filter,jobDescription:'Consultor Sênior SAP MM'});
  assert.notEqual(result.classification, 'rejected');
});
test('APINFO retains successful CVs after detail failures and detects repeated pagination', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    const value = String(url);
    if (value.includes('pesqentra')) return new Response('form-busca Palavras-chave');
    if (value.includes('roteador2.cfm?prof=2')) return new Response('failure', {status:503});
    if (value.includes('roteador2')) return new Response('<p>Teste</p><p>Consultor SAP MM</p><p>Codigo APinfo</p><p>SAP MM J1BTAX TAXBRA invoice verification SAP Activate debug Inglês avançado experiencia profissional</p>');
    return new Response('Encontrados: 50 curriculos <a href="roteador2.cfm?prof=1">1</a><a href="roteador2.cfm?prof=2">2</a><a href="pesq9b.cfm?start=21">Próxima</a>');
  };
  try {
    const result = await searchApinfoCandidates(filter, {user:'test',password:'test'});
    assert.equal(result.stats.evaluated, 1); assert.equal(result.failedDetails.length, 1);
    assert.ok(result.warnings.some(s => /parcial/.test(s))); assert.equal(result.results.length, 1);
  } finally {globalThis.fetch = original;}
});
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
  assert.equal(screenCandidate('SAP MM. Inglês básico.', filter).operationalChecks.find(item => item.requirement === 'Inglês').status, 'incompatible');
});
test('unknown fields stay pending; either requested city qualifies when structured', () => {
  for (const [city, state] of [['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ']]) {
    const result = screenCandidate('Consultor SAP MM, configuração J1BTAX TAXBRA invoice verification', filter, { city, state, englishLevel: 'Fluente' });
    assert.equal(result.classification, 'approved'); assert.ok(result.score >= 60);
  }
  assert.equal(screenCandidate('SAP MM J1BTAX TAXBRA', filter).classification, 'review');
  assert.equal(screenCandidate('Consultor SAP MM', filter, { city: 'Curitiba', state: 'PR' }).classification, 'approved');
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
  assert.equal(result.classification, 'review'); assert.match(result.reason, /skill obrigatório a confirmar/);
  assert.equal(screenCandidate('Consultor SAP SD', filter).classification, 'rejected');
});
test('differentials improve rank but are never mandatory', () => {
  const base = screenCandidate('Consultor SAP MM: configuração J1BTAX TAXBRA invoice verification', filter, { city: 'São Paulo', state: 'SP', englishLevel: 'Avançado' });
  const richer = screenCandidate('Consultor SAP MM: configuração J1BTAX TAXBRA invoice verification Activate debug', filter, { city: 'São Paulo', state: 'SP', englishLevel: 'Avançado' });
  assert.equal(base.classification, 'approved'); assert.ok(richer.score > base.score);
});
test('internal CV preserves full text, score, classification and candidate ID', () => {
  const result = evaluateInternalCandidateForFilter({ nome: 'Teste', id_controle: '42', search_text_all: 'Consultor SAP MM: configuração J1BTAX TAXBRA invoice verification', cidade: 'Rio de Janeiro', estado: 'RJ', nivel_ingles: 'Fluente' }, filter);
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
