import { randomUUID } from 'node:crypto';

export const APPROVED_TARGET = 30;

export function uniqueApproved(rows) {
  return uniqueCandidates(rows.filter(row => row.classification === 'approved'));
}

export function recommendedCandidates(rows, limit = APPROVED_TARGET) {
  return uniqueCandidates(rows).slice(0, limit);
}

function uniqueCandidates(rows) {
  const parent = new Map();
  const root = key => {
    if (!parent.has(key)) parent.set(key, key);
    if (parent.get(key) !== key) parent.set(key, root(parent.get(key)));
    return parent.get(key);
  };
  const identified = rows.filter(row => ['approved', 'review'].includes(row.classification))
    .sort((a, b) => Number(b.classification === 'approved') - Number(a.classification === 'approved') || Number(b.score || 0) - Number(a.score || 0))
    .map(row => {
      // Names alone cannot distinguish homonyms. Prefer a verified curriculum ID.
      let link = String(row.link || '').trim();
      try {
        const url = new URL(link);
        link = url.hostname.includes('linkedin.com') ? `linkedin:${url.pathname.replace(/\/$/, '').toLowerCase()}`
          : url.hostname.includes('apinfo') && url.searchParams.get('prof') ? `apinfo:${url.searchParams.get('prof')}` : link;
      } catch { /* Internal rows use curriculum identifiers. */ }
      const keys = [row.curriculumId && `cv:${row.curriculumId}`, row.curriculumControlId && `control:${row.curriculumControlId}`, link && `link:${link}`].filter(Boolean);
      keys.forEach(key => parent.set(root(key), root(keys[0])));
      return { row, key: keys[0] };
    });
  const seen = new Set();
  return identified.filter(({ key }) => {
    if (!key || seen.has(root(key))) return false;
    seen.add(root(key)); return true;
  }).map(({ row }) => row);
}

export class CvSearchJobs {
  constructor() { this.jobs = new Map(); }
  find(owner, filterId) {
    return [...this.jobs.values()].find(job => job.owner === owner && job.filterId === filterId && job.response.searchStatus === 'running');
  }
  get(id, owner) {
    const job = this.jobs.get(id);
    return job?.owner === owner ? job : null;
  }
  start(owner, filterId, response, run) {
    const active = this.find(owner, filterId);
    if (active) return active;
    for (const [id, job] of this.jobs) if (job.finishedAt && Date.now() - job.finishedAt > 3600000) this.jobs.delete(id);
    if ([...this.jobs.values()].filter(job => job.response.searchStatus === 'running').length >= 3) throw new Error('Há três buscas em andamento. Aguarde uma finalizar.');
    const id = randomUUID();
    const job = { id, owner, filterId, response: { ...response, searchJobId: id, searchTarget: APPROVED_TARGET, searchApprovedCount: 0, searchStatus: 'running' } };
    this.jobs.set(id, job);
    job.done = Promise.resolve().then(() => run(job.response)).catch(error => {
      job.response.searchStatus = 'partial';
      job.response.searchMessage = `Busca interrompida: ${error.message}. Resultados já obtidos preservados; meta não garantida.`;
    }).finally(() => { job.finishedAt = Date.now(); });
    return job;
  }
}
