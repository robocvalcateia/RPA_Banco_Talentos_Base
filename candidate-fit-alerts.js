import { evaluateInternalCandidateForFilter } from './apinfo.js';
import { hasSkill, interpretVacancy } from './candidate-screening.js';

export const CANDIDATE_FIT_ALERT_RECIPIENTS = Object.freeze([
  'gerson@alcateiaconsulting.com.br',
  'bruno@alcateiaconsulting.com.br'
]);

const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const ALERT_RULE_VERSION = 'automatic-fit-alert-v2';
const MANAGEMENT_TITLES = /\b(?:pmo|project manager|gerente de projetos|gestor de projetos|product manager|product owner|\bpo\b|scrum master)\b/i;
const FUNCTIONAL_TITLES = /\b(?:consultor(?:a)? funcional|analista funcional|especialista funcional|functional consultant)\b/i;
const FUNCTIONAL_WORK = /\b(?:levantamento de requisitos|mapeamento de processos|parametriza|configura|implanta|implementa|suporte funcional|sustenta|homologa|uat|treinamento de usu[aá]rios)\b/i;

const DOMAIN_RULES = [
  { product: 'Oracle ERP Cloud', vacancy: /\b(?:oracle\s+(?:erp\s+)?cloud|oracle\s+fusion)\b/i, evidence: /\b(?:oracle\s+(?:erp\s+)?cloud|oracle\s+fusion)\b/i,
    requirements: [
      ['OM', /\b(?:OM|order management)\b/i], ['AR', /\b(?:AR|accounts receivable|contas a receber)\b/i],
      ['FDG', /\bFDG\b/i], ['Tax', /\b(?:oracle\s+tax|fusion\s+tax|tax\s+configuration)\b/i],
      ['OTC', /\b(?:OTC|order to cash)\b/i]
    ] },
  { product: 'Protheus', vacancy: /\b(?:totvs\s+)?protheus\b/i, evidence: /\b(?:totvs\s+)?protheus\b/i,
    requirements: [
      ['SIGADPR', /\bSIGADPR\b/i], ['Financeiro', /\b(?:financeiro|SIGAFIN)\b/i],
      ['Ativo Fixo', /\b(?:ativo fixo|SIGAATF)\b/i], ['Fiscal', /\b(?:fiscal|SIGAFIS)\b/i],
      ['Contábil', /\b(?:contabil|SIGACTB)\b/i], ['LP', /\b(?:linguagem de programacao|\bLP\b)\b/i],
      ['ADVPL', /\bADVPL\b/i]
    ] },
  { product: 'Tax One', vacancy: /\b(?:tax\s*one|mastersaf\s+(?:dw|data warehouse))\b/i, evidence: /\b(?:tax\s*one|mastersaf\s+(?:dw|data warehouse))\b/i, requirements: [] },
  { product: 'Datasul', vacancy: /\b(?:totvs\s+)?datasul\b/i, evidence: /\b(?:totvs\s+)?datasul\b/i, requirements: [] }
];

function professionalBlocks(curriculum = {}) {
  return String(curriculum.experiencia_profissional || '').split(/\n\s*\n+/).map(block => block.trim()).filter(Boolean);
}

function recentProfessionalBlock(block, now = new Date()) {
  const years = [...String(block).matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(match => Number(match[1]));
  if (!years.length) return false;
  const latest = Math.max(...years);
  return /\b(?:atual|presente|current|present)\b/i.test(block) || latest >= now.getFullYear() - 5;
}

function domainEvidenceDecision(curriculum = {}, filter = {}, plan = interpretVacancy(filter)) {
  const vacancyText = [filter.coreSkill, filter.mandatorySkills, filter.technicalSkills, filter.jobDescription].filter(Boolean).join('\n');
  const rule = DOMAIN_RULES.find(item => item.vacancy.test(vacancyText));
  const blocks = professionalBlocks(curriculum);
  const productName = rule?.product || plan.core;
  const productBlocks = blocks.filter(block =>
    (rule ? rule.evidence.test(block) : hasSkill(block, plan.core))
    && (FUNCTIONAL_WORK.test(block) || FUNCTIONAL_TITLES.test(block))
  );
  if (!productBlocks.length) return { status: 'missing', reasons: [`atuação profissional em ${productName || 'competência principal'} não comprovada em uma experiência`] };
  const recentBlocks = productBlocks.filter(block => recentProfessionalBlock(block));
  if (!recentBlocks.length) return { status: 'missing', reasons: [`experiência em ${productName || 'competência principal'} nos últimos cinco anos não comprovada`] };
  const required = rule
    ? rule.requirements.filter(([, pattern]) => pattern.test(vacancyText)).map(([name, pattern]) => ({ name, matches: block => pattern.test(block) }))
    : plan.ranking.filter(item => item.group === 'central').map(item => ({ name: item.term, matches: block => hasSkill(block, item.term) }));
  const missing = required.filter(item => !recentBlocks.some(block => item.matches(block))).map(item => item.name);
  return { status: missing.length ? 'missing' : 'meets', reasons: missing.map(name => `${productName}: requisito específico sem evidência na mesma experiência recente: ${name}`) };
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
    && Number(evaluation.score || 0) > 0
    && exactCorePresent
    && coreHasProfessionalEvidence
    && mandatoryMissing.length === 0
    && centralMissing.length === 0
    && operationalPending.length === 0
    && !roleBlocked
    && domain.status === 'meets'
  );
  return {
    version: ALERT_RULE_VERSION,
    automatic,
    manualReview: !automatic,
    reasons: [
      ...mandatoryMissing.map(item => `requisito obrigatório sem evidência: ${item}`),
      ...centralMissing.map(item => `requisito central sem evidência: ${item}`),
      ...operationalPending.map(item => `${item.requirement}: ${item.detail}`),
      ...(Number(evaluation.score || 0) <= 0 ? ['aderência técnica sem pontuação comprovada'] : []),
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
