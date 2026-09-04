import test from 'node:test';
import assert from 'node:assert/strict';
import { CvSearchJobs, uniqueApproved, APPROVED_TARGET } from '../cv-search-jobs.js';
import { searchApinfoCandidates } from '../apinfo.js';

test('only explicit, identified approvals count; scores cannot promote pending', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ link: `https://example.org/${i}`, classification: 'review', score: 100 }));
  rows.push({ link: 'https://example.org/approved', classification: 'approved', score: 70 });
  rows.push({ link: 'https://example.org/legacy', score: 100 });
  assert.equal(uniqueApproved(rows).length, 1);
  assert.equal(APPROVED_TARGET, 30);
});

test('deduplicates verified IDs and canonical source URLs, preserves homonyms', () => {
  const rows = [
    { curriculumId: '1', link: 'https://www.linkedin.com/in/test/?trk=a', name: 'Same Name', classification: 'approved', score: 90 },
    { curriculumId: '1', link: 'https://www.apinfo2.com/apinfo/inc/roteador2.cfm?prof=10', classification: 'approved', score: 80 },
    { link: 'https://linkedin.com/in/test', classification: 'approved', score: 70 },
    { curriculumId: '2', name: 'Same Name', classification: 'approved', score: 85 }
  ];
  assert.deepEqual(uniqueApproved(rows).map(row => row.score), [90, 85]);
});

test('jobs return immediately, isolate owners and prevent duplicate clicks', async () => {
  const jobs = new CvSearchJobs();
  let finish;
  const wait = new Promise(resolve => { finish = resolve; });
  const first = jobs.start('alice', 'fi', {}, async response => { await wait; response.searchStatus = 'completed'; });
  assert.equal(first.response.searchStatus, 'running');
  assert.equal(jobs.start('alice', 'fi', {}, () => assert.fail()), first);
  assert.equal(jobs.get(first.id, 'bob'), null);
  finish(); await first.done;
  assert.equal(jobs.get(first.id, 'alice').response.searchStatus, 'completed');
});

test('job failure preserves earlier approvals and reports incomplete search', async () => {
  const job = new CvSearchJobs().start('alice', 'fi', {}, async response => {
    response.searchApprovedCount = 12;
    throw new Error('source unavailable');
  });
  await job.done;
  assert.equal(job.response.searchApprovedCount, 12);
  assert.equal(job.response.searchStatus, 'partial');
});

async function withApinfoFixture(run, { total = 260, failurePage = 0 } = {}) {
  const original = globalThis.fetch;
  const details = [], pages = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname.includes('pesqentra')) return new Response('Palavras-chave');
    if (url.pathname.includes('roteador2')) {
      const id = Number(url.searchParams.get('prof')); details.push(id);
      const skill = id <= 100 ? 'SAP SD' : 'SAP FI';
      return new Response(`<p>Professional ${id}</p><p>Consultor ${skill}</p><p>Codigo APinfo ${id}</p><p>Experiencia profissional em ${skill}. Configuracao, implementacao e suporte a processos empresariais.</p>`);
    }
    const page = Number(new URLSearchParams(options.body).get('pag') || 1);
    pages.push(page);
    if (page === failurePage) return new Response('failed', { status: 503 });
    const start = (page - 1) * 20 + 1;
    const links = Array.from({ length: Math.max(0, Math.min(20, total - start + 1)) }, (_, i) => `<a href="roteador2.cfm?prof=${start + i}">${start + i}</a>`).join('');
    const next = start + 20 <= total ? `<form method="POST" action="pesq9b.cfm"><input type="hidden" name="pkey" value="snapshot"><input type="hidden" name="tcv" value="${total}">Pular para a pagina :<input type="text" name="pag" value="${page + 1}"><input type="submit" value="OK"></form>` : '';
    return new Response(`Encontrados: ${total} curriculos ${links}${next}`);
  };
  try { await run({ details, pages }); } finally { globalThis.fetch = original; }
}

test('APINFO automatically passes the first 100 and stops after reaching 30 approvals', async () => {
  await withApinfoFixture(async ({ details, pages }) => {
    let approved = [], progress = 0;
    const result = await searchApinfoCandidates({ coreSkill: 'SAP FI', technicalSkills: 'SAP FI', mandatorySkills: 'SAP FI', matchPercent: 0, resultLimit: 50 }, {}, 50, {
      continueToTarget: true,
      shouldStop: () => approved.length >= 30,
      onProgress: batch => { approved = uniqueApproved(batch.results); progress += 1; }
    });
    assert.ok(approved.length >= 30);
    assert.equal(progress, 2);
    assert.equal(details.length, 200);
    assert.equal(new Set(details).size, 200);
    assert.equal(Math.max(...pages), 10);
    assert.equal(result.exhausted, false);
  });
});

test('APINFO continues to actual exhaustion when fewer than 30 qualify', async () => {
  await withApinfoFixture(async ({ details }) => {
    const result = await searchApinfoCandidates({ coreSkill: 'SAP FI', technicalSkills: 'SAP FI', mandatorySkills: 'SAP FI', state: 'SP', matchPercent: 0, resultLimit: 50 }, {}, 50, { continueToTarget: true });
    assert.equal(details.length, 115);
    assert.equal(uniqueApproved(result.results).length, 0);
    assert.equal(result.results.filter(row => row.classification === 'review').length, 15);
    assert.equal(result.exhausted, true);
  }, { total: 115 });
});

test('APINFO pagination failure retains earlier results and never claims exhaustion', async () => {
  await withApinfoFixture(async () => {
    const result = await searchApinfoCandidates({ coreSkill: 'SAP FI', mandatorySkills: 'SAP FI', resultLimit: 50 }, {}, 50, { continueToTarget: true });
    assert.equal(result.stats.evaluated, 100);
    assert.equal(result.exhausted, false);
    assert.ok(result.warnings.length);
  }, { failurePage: 6 });
});
