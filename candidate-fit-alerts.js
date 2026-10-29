import { evaluateInternalCandidateForFilter } from './apinfo.js';
import { hasSkill, interpretVacancy, curriculumProfessionalEvidence } from './candidate-screening.js';

export const CANDIDATE_FIT_ALERT_RECIPIENTS = Object.freeze([
  'gerson@alcateiaconsulting.com.br',
  'bruno@alcateiaconsulting.com.br'
]);

const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const ALERT_RULE_VERSION = 'automatic-fit-alert-v4';
const MANAGEMENT_TITLES = /\b(?:pmo|project manager|gerente de projetos|gestor de projetos|product manager|product owner|\bpo\b|scrum master)\b/i;
const FUNCTIONAL_TITLES = /\b(?:consultor(?:a)? funcional|analista funcional|especialista funcional|functional consultant)\b/i;
const FUNCTIONAL_WORK = /\b(?:levantamento de requisitos|mapeamento de processos|parametriza|configura|implanta|implementa|suporte funcional|sustenta|homologa|uat|treinamento de usu[aá]rios)\b/i;

function professionalBlocks(curriculum = {}) {
  return String(curriculum.experiencia_profissional || '').split(/\n\s*\n+/).map(block => block.trim()).filter(Boolean);
}

function genericProfessionalCoreEvidence(curriculum, core) {
  return curriculumProfessionalEvidence(curriculum, core).found;
}

function domainEvidenceDecision(curriculum = {}, filter = {}, plan = interpretVacancy(filter)) {
  return genericProfessionalCoreEvidence(curriculum, plan.core)
    ? { status: 'meets', reasons: [] }
    : { status: 'missing', reasons: [`atuação profissional em ${plan.core || 'competência principal'} não comprovada no cargo ou em uma experiência`] };
}

function structuredCandidateText(curriculum = {}) {
  return [
    curriculum.cargo_atual,
    curriculum.currentTitle,
    curriculum.skills,
    curriculum.conhecimento_tecnico,
    curriculum.experiencia_profissional,
    curriculum.cursos_certificacoes,
    curriculum.resumo,
    curriculum.cargo_alvo,
    curriculum.observacoes_entrevista
  ].filter(Boolean).join('\n');
}

function evidenceText(curriculum = {}) {
  const structured = structuredCandidateText(curriculum);
  return structured || String(curriculum.texto_integral || curriculum.search_text_all || '');
}

function roleCompatibility(curriculum = {}, filter = {}) {
  const vacancyText = [filter.coreSkill, filter.mandatorySkills, filter.jobDescription].filter(Boolean).join('\n');
  if (!/\bfuncional\b/i.test(vacancyText)) return { status: 'not_required', detail: '' };
  const title = String(curriculum.cargo_atual || curriculum.currentTitle || '').trim();
  const work = String(curriculum.experiencia_profissional || '');
  if (FUNCTIONAL_TITLES.test(title) || FUNCTIONAL_WORK.test(work)) return { status: 'meets', detail: 'Atuação funcional comprovada' };
  if (MANAGEMENT_TITLES.test(title) || MANAGEMENT_TITLES.test(work)) return { status: 'incompatible', detail: 'Gestão/PMO/PO não substitui atuação funcional prática' };
  return { status: 'unknown', detail: 'Atuação funcional prática não comprovada' };
}

function strictAlertDecision(curriculum, filter, evaluation) {
  const plan = interpretVacancy(filter);
  const text = evidenceText(curriculum);
  const central = plan.ranking.filter(item => item.group === 'central');
  const mandatoryMissing = evaluation.missingMandatorySkills || [];
  const centralMissing = central
    .filter(item => !evaluation.evidence?.some(evidence => normalize(evidence.requirement) === normalize(item.term) && evidence.found))
    .map(item => item.term);
  const operationalPending = (evaluation.operationalChecks || []).filter(item => item.status !== 'meets');
  const role = roleCompatibility(curriculum, filter);
  const roleBlocked = role.status === 'unknown' || role.status === 'incompatible';
  const domain = domainEvidenceDecision(curriculum, filter, plan);
  const coreHasProfessionalEvidence = evaluation.evidence?.some(item => normalize(item.requirement) === normalize(plan.core) && item.found);
  const exactCorePresent = Boolean(plan.core && hasSkill(text, plan.core));
  const automatic = Boolean(
    evaluation.classification === 'approved'
    && exactCorePresent
    && coreHasProfessionalEvidence
    && mandatoryMissing.length === 0
    && !roleBlocked
    && ['meets', 'not_required'].includes(domain.status)
  );
  return {
    version: ALERT_RULE_VERSION,
    automatic,
    manualReview: !automatic,
    reasons: [
      ...mandatoryMissing.map(item => `requisito obrigatório sem evidência: ${item}`),
      ...centralMissing.map(item => `requisito central sem evidência: ${item}`),
      ...operationalPending.map(item => `${item.requirement}: ${item.detail}`),
      ...(!exactCorePresent || !coreHasProfessionalEvidence ? [`atuação profissional em ${plan.core || 'competência principal'} não comprovada`] : []),
      ...(roleBlocked ? [role.detail] : []),
      ...domain.reasons
    ]
  };
}

function inferredCoreSkill(opportunity = {}) {
  const details = opportunity.intakeDetails || {};
  const explicit = details.coreSkill || opportunity.coreSkill || opportunity.skill || '';
  if (String(explicit).trim()) return String(explicit).trim();

  const vacancyText = [opportunity.opportunity, opportunity.jobDescription].filter(Boolean).join('\n');
  const title = String(opportunity.opportunity || '').replace(
    /\b(?:vaga|oportunidade|aloca[cç][aã]o|pontual|consultor(?:a)?|analista|especialista|desenvolvedor(?:a)?|arquiteto(?:a)?|gerente(?:\s+de\s+projetos)?|project\s+manager|funcional|t[eé]cnico|t[eé]cnica|j[uú]nior|junior|jr|pleno|s[eê]nior|senior|sr|horas?)\b|\b\d+\b/gi,
    ' '
  ).replace(/^\s*(?:de|em|para)\s+/i, '').replace(/[–—-]+\s*$/g, '').replace(/\s+/g, ' ').trim();
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
    if (!filter.coreSkill) continue;
    const evaluation = evaluateInternalCandidateForFilter(curriculum, filter);
    const operationalConflict = (evaluation.row.operationalChecks || []).some(item => item.status === 'incompatible');
    const alertDecision = strictAlertDecision(curriculum, filter, evaluation.row);
    if (!evaluation.accepted || operationalConflict || !alertDecision.automatic) continue;
    matches.push({ opportunity, filter, evaluation: { ...evaluation.row, alertDecision } });
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
    `   Aderência técnica: ${Number(evaluation.score || 0) > 0 ? `${evaluation.score}%` : 'experiência principal identificada no currículo'}`,
    `   Evidência (${evaluation.coreExperience?.source || 'currículo'}): ${evaluation.coreExperience?.excerpt || 'não disponível'}`
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

// Review historical indications without resending messages or modifying human selections.
export function reviewHistoricalFit(log, curriculum, opportunity, reviewedAt = new Date().toISOString()) {
  const filter = opportunity ? opportunityFitFilter(opportunity) : null;
  const evidence = curriculum && filter ? curriculumProfessionalEvidence(curriculum, interpretVacancy(filter).core) : null;
  const valid = curriculum && opportunity && matchingOpenOpportunities(curriculum, [opportunity]).length > 0;
  return { version: ALERT_RULE_VERSION, reviewedAt,
    status: !curriculum || !opportunity ? 'unverifiable' : valid ? 'confirmed' : 'withdrawn',
    reason: !curriculum ? 'Currículo não localizado por identificador.' : !opportunity ? 'Oportunidade não localizada.' : opportunity.status !== 'Open' ? 'Oportunidade não está aberta.' : !evidence?.found ? 'Experiência na competência principal não comprovada.' : !valid ? 'Requisitos da oportunidade não comprovados na revisão.' : 'Experiência principal e requisitos técnicos evidenciados.',
    evidence, previousScore: log.score, originalSentAt: log.sentAt };
}
