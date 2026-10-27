import { evaluateInternalCandidateForFilter } from './apinfo.js';

export const CANDIDATE_FIT_ALERT_RECIPIENTS = Object.freeze([
  'gerson@alcateiaconsulting.com.br',
  'bruno@alcateiaconsulting.com.br'
]);

const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function inferredCoreSkill(opportunity = {}) {
  const details = opportunity.intakeDetails || {};
  const explicit = details.coreSkill || opportunity.coreSkill || opportunity.skill || '';
  if (String(explicit).trim()) return String(explicit).trim();

  const title = String(opportunity.opportunity || '').replace(
    /\b(?:vaga|oportunidade|consultor(?:a)?|analista|especialista|desenvolvedor(?:a)?|arquiteto(?:a)?|funcional|t[eé]cnico|t[eé]cnica|j[uú]nior|junior|jr|pleno|s[eê]nior|senior|sr)\b/gi,
    ' '
  ).replace(/\s+/g, ' ').trim();
  if (title) return title;

  const description = String(opportunity.jobDescription || '');
  return description.match(/(?:experi[eê]ncia|conhecimento|atua[cç][aã]o)\s+(?:com|em)\s+([^\n.;]+)/i)?.[1]?.trim() || '';
}

export function opportunityFitFilter(opportunity = {}) {
  const details = opportunity.intakeDetails || {};
  const coreSkill = inferredCoreSkill(opportunity);
  const workModel = String(opportunity.workModel || details.workModel || '').trim();
  const remote = normalize(workModel) === 'remoto';
  const city = remote ? '' : String(details.city || opportunity.city || '').trim();
  const state = remote ? '' : String(details.state || opportunity.state || '').trim();
  return {
    opportunityId: String(opportunity.id || '').trim(),
    coreSkill,
    mandatorySkills: String(details.mandatorySkills || opportunity.mandatorySkills || coreSkill).trim(),
    technicalSkills: String(details.requirements || opportunity.technicalSkills || '').trim(),
    desirableSkills: String(details.desirable || opportunity.desirableSkills || '').trim(),
    jobDescription: String(opportunity.jobDescription || '').trim(),
    city,
    state,
    locations: city || state ? [city, state].filter(Boolean).join('/') : '',
    englishLevel: String(details.language || opportunity.englishLevel || '').trim(),
    workModel
  };
}

export function matchingOpenOpportunities(curriculum, opportunities = []) {
  if (!curriculum || curriculum.blackflag || curriculum.blacklist) return [];
  const matches = [];
  for (const opportunity of opportunities) {
    if (opportunity?.status !== 'Open') continue;
    const filter = opportunityFitFilter(opportunity);
    if (!filter.coreSkill || !filter.jobDescription) continue;
    const evaluation = evaluateInternalCandidateForFilter(curriculum, filter);
    const operationalConflict = (evaluation.row.operationalChecks || []).some(item => item.status === 'incompatible');
    if (!evaluation.accepted || operationalConflict) continue;
    matches.push({ opportunity, filter, evaluation: evaluation.row });
  }
  return matches.sort((a, b) => Number(b.evaluation.score || 0) - Number(a.evaluation.score || 0));
}

export function candidateFitAlertId(curriculum, opportunity) {
  const curriculumId = curriculum?.id_controle || curriculum?.id || curriculum?.mongoId || curriculum?.email || curriculum?.nome || 'sem-id';
  return `candidate-fit:${curriculumId}:${opportunity?.id || opportunity?.opportunityCode || 'sem-vaga'}`;
}

export function recentCurriculumIds(curriculums = [], since) {
  const sinceTime = new Date(since).getTime();
  if (!Number.isFinite(sinceTime)) throw new Error('Data inicial inválida.');
  return curriculums
    .filter(curriculum => {
      const timestamp = new Date(curriculum?.data_criacao || curriculum?.data_atualizacao || curriculum?.data_origem || 0).getTime();
      return Number.isFinite(timestamp) && timestamp >= sinceTime;
    })
    .sort((left, right) => new Date(left.data_criacao || left.data_atualizacao || left.data_origem || 0) - new Date(right.data_criacao || right.data_atualizacao || right.data_origem || 0))
    .map(curriculum => String(curriculum.id_controle || curriculum.id || curriculum.mongoId || '').trim())
    .filter(Boolean);
}

export function buildCandidateFitAlert({ curriculum, matches, baseUrl }) {
  const curriculumId = curriculum.id_controle || curriculum.id || curriculum.mongoId;
  const url = new URL(String(baseUrl || 'https://rpa-banco-talentos-5v5r.onrender.com'));
  url.searchParams.set('view', 'curriculums');
  url.searchParams.set('curriculumId', curriculumId);
  const vacancies = matches.flatMap(({ opportunity, filter, evaluation }, index) => [
    `${index + 1}. ${[opportunity.opportunityCode, opportunity.opportunity].filter(Boolean).join(' - ')}`,
    `   Skill relacionada: ${filter.coreSkill}`,
    `   Aderência técnica: ${evaluation.score}%`
  ]);
  return {
    to: CANDIDATE_FIT_ALERT_RECIPIENTS.join(','),
    subject: `Alcateia | Novo profissional aderente: ${curriculum.nome}`,
    text: [
      'Gerson e Bruno,',
      '',
      `Um novo currículo inserido no Banco de Talentos apresentou aderência às seguintes oportunidades abertas:`,
      '',
      `Profissional: ${curriculum.nome}`,
      `Skill cadastrada: ${curriculum.skills || curriculum.conhecimento_tecnico || 'consultar currículo'}`,
      '',
      ...vacancies,
      '',
      `Acessar o currículo: ${url.toString()}`,
      '',
      'A classificação representa triagem automática. Validem o currículo antes de vincular o profissional à oportunidade.'
    ].join('\n'),
    curriculumUrl: url.toString()
  };
}

export async function notifyNewCurriculumFits({ curriculum, opportunities, baseUrl, readLogs, writeLog, send, now = () => new Date().toISOString() }) {
  const matches = matchingOpenOpportunities(curriculum, opportunities);
  if (!matches.length) return { status: 'no_match', matches: [], sent: false };
  const logs = await readLogs();
  const sentIds = new Set(logs.filter(item => item.status === 'sent').map(item => item.id));
  const pendingMatches = matches.filter(({ opportunity }) => !sentIds.has(candidateFitAlertId(curriculum, opportunity)));
  if (!pendingMatches.length) return { status: 'already_sent', matches, sent: false };

  const message = buildCandidateFitAlert({ curriculum, matches: pendingMatches, baseUrl });
  const sentAt = now();
  try {
    await send(message);
    for (const { opportunity, filter, evaluation } of pendingMatches) {
      await writeLog({
        id: candidateFitAlertId(curriculum, opportunity), type: 'candidate_opportunity_fit', source: 'curriculum_insert', provider: 'SMTP',
        status: 'sent', to: message.to, candidateId: curriculum.id_controle || curriculum.id || curriculum.mongoId || '', candidateName: curriculum.nome || '',
        opportunityId: opportunity.id || '', opportunityName: opportunity.opportunity || '', opportunityCode: opportunity.opportunityCode || '',
        skill: filter.coreSkill, score: evaluation.score, createdAt: sentAt, sentAt, error: '', curriculumUrl: message.curriculumUrl
      });
    }
    return { status: 'sent', matches: pendingMatches, sent: true };
  } catch (error) {
    for (const { opportunity, filter, evaluation } of pendingMatches) {
      await writeLog({
        id: candidateFitAlertId(curriculum, opportunity), type: 'candidate_opportunity_fit', source: 'curriculum_insert', provider: 'SMTP',
        status: 'failed', to: message.to, candidateId: curriculum.id_controle || curriculum.id || curriculum.mongoId || '', candidateName: curriculum.nome || '',
        opportunityId: opportunity.id || '', opportunityName: opportunity.opportunity || '', opportunityCode: opportunity.opportunityCode || '',
        skill: filter.coreSkill, score: evaluation.score, createdAt: sentAt, sentAt: '', error: String(error?.message || error), curriculumUrl: message.curriculumUrl
      });
    }
    return { status: 'failed', matches: pendingMatches, sent: false, error: String(error?.message || error) };
  }
}
