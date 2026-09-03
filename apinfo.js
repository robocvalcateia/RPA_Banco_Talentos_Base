import { screenCandidate, coreKeyword, skillAlternatives, screeningStats } from './candidate-screening.js';

const APINFO_BASE = 'https://www.apinfo2.com/apinfo/inc/';
const APINFO_LOGIN_URL = new URL('pesqentra2.cfm', APINFO_BASE).href;
const APINFO_SEARCH_URL = new URL('pesq9b.cfm', APINFO_BASE).href;
const GOOGLE_SEARCH_URL = 'https://www.google.com/search';
const SERPAPI_SEARCH_URL = 'https://serpapi.com/search.json';

const STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'des', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'ou', 'para', 'por', 'que', 'se', 'um', 'uma', 'perfil', 'pessoa', 'profissional', 'experiencia',
  'conhecimento', 'conhecimentos', 'desenvolvimento', 'atuacao', 'atuar', 'nivel', 'pleno', 'senior', 'junior'
]);

const ENGLISH_LEVELS = {
  basico: '1',
  tecnico: '1',
  intermediario: '2',
  avancado: '3',
  fluente: '3'
};

const ENGLISH_RANKS = Object.freeze({ basico: 1, tecnico: 1, intermediario: 2, avancado: 3, fluente: 4 });
const ENGLISH_PATTERNS = Object.freeze([
  ['fluente', 4, /\b(fluente|fluent|fluency|full professional|native|nativo|c2)\b/],
  ['avancado', 3, /\b(avancad[oa]|advanced|professional working|upper intermediate|c1)\b/],
  ['intermediario', 2, /\b(intermediari[oa]|intermediate|b1|b2|regular)\b/],
  ['tecnico', 1, /\b(tecnic[oa]|technical reading|leitura tecnica)\b/],
  ['basico', 1, /\b(basic[oa]?|elementary|a1|a2)\b/]
]);

const SKILL_ALIASES = Object.freeze({
  'pl sql': ['pl/sql', 'plsql'],
  'pl/sql': ['pl sql', 'plsql'],
  '.net': ['dotnet', 'asp.net', 'c#'],
  dotnet: ['.net', 'asp.net', 'c#'],
  pmp: ['project management professional'],
  'sap s/4hana': ['sap s4hana', 's/4 hana', 's4 hana'],
  'sap s4hana': ['sap s/4hana', 's/4 hana', 's4 hana']
});

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_/|]+/g, ' ')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value = '') {
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>'
  };

  return String(value).replace(/&(nbsp|amp|quot|#39|lt|gt);/g, (entity) => entities[entity] ?? entity);
}

function stripHtml(html = '') {
  return decodeEntities(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n'))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function htmlToText(html = '') {
  return stripHtml(html).join('\n');
}

export function extractEmailsFromText(text = '') {
  return Array.from(new Set(
    String(text)
      .match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []
  ));
}

function extractTerms(value = '') {
  const normalized = normalizeText(value);
  return Array.from(new Set(normalized.split(' ')
    .filter((term) => term.length >= 3 && !STOPWORDS.has(term))));
}

function splitMandatorySkills(value = '') {
  return String(value)
    .split(/[,;\n]+/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactSkillText(value = '') {
  return normalizeText(value).replace(/[\s.]+/g, '');
}

function textContainsSkill(normalizedText, compactText, skill) {
  const normalizedSkill = normalizeText(skill);
  if (!normalizedSkill) return true;

  const alternatives = [normalizedSkill, ...(SKILL_ALIASES[normalizedSkill] || []).map(normalizeText)];
  return alternatives.some((alternative) => {
    if (/^[a-z0-9]+$/.test(alternative)) {
      return new RegExp(`(^| )${escapeRegex(alternative)}( |$)`).test(normalizedText);
    }

    const compactSkill = compactSkillText(alternative);
    return normalizedText.includes(alternative) || (compactSkill && compactText.includes(compactSkill));
  });
}

function evaluateMandatorySkills(text, mandatorySkills) {
  const skills = splitMandatorySkills(mandatorySkills);
  if (!skills.length) {
    return { accepted: true, required: [], hits: [], missing: [] };
  }

  const normalizedText = normalizeText(text);
  const compactText = compactSkillText(text);
  const hits = skills.filter((skill) => textContainsSkill(normalizedText, compactText, skill));
  const missing = skills.filter((skill) => !textContainsSkill(normalizedText, compactText, skill));

  return {
    accepted: missing.length === 0,
    required: skills,
    hits,
    missing
  };
}

function calculateJobMatch(text, jobDescription) {
  const terms = extractTerms(jobDescription);
  if (!terms.length) {
    return { score: 100, hits: [], missing: [] };
  }

  const normalizedText = normalizeText(text);
  const hits = terms.filter((term) => normalizedText.includes(term));
  const missing = terms.filter((term) => !normalizedText.includes(term));
  return {
    score: Math.round((hits.length / terms.length) * 100),
    hits,
    missing
  };
}

function extractCityCodes(html, city) {
  if (!city) return [];
  const normalizedCity = normalizeText(city);
  const matches = Array.from(String(html).matchAll(/<input\s+type=checkbox\s+name=cod_cidade\[\]\s+value=(?<value>[^>\s]+)>\s*&nbsp;&nbsp;(?<name>[^<]+)/gi));
  return matches
    .filter((match) => normalizeText(match.groups.name) === normalizedCity)
    .map((match) => match.groups.value);
}

function buildKeyword(filter) {
  return coreKeyword(filter);
}

function requestedEnglishRank(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) return 0;
  const direct = ENGLISH_RANKS[normalized];
  if (direct) return direct;
  return ENGLISH_PATTERNS.find(([, , pattern]) => pattern.test(normalized))?.[1] || 0;
}

function detectedEnglishLevel(value = '') {
  const normalized = normalizeText(value);
  const matches = ENGLISH_PATTERNS.filter(([, , pattern]) => pattern.test(normalized));
  if (!matches.length) return { rank: 0, level: '', evident: false };
  const [level, rank] = matches.sort((first, second) => second[1] - first[1])[0];
  return { rank, level, evident: true };
}

function uniqueNonEmpty(values = []) {
  return Array.from(new Set(
    values
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));
}

function quotedTerm(value = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  return /\s/.test(text) ? `"${text}"` : text;
}

function booleanOr(values = []) {
  const terms = uniqueNonEmpty(values).map(quotedTerm).filter(Boolean);
  if (!terms.length) return '';
  return terms.length === 1 ? terms[0] : `(${terms.join(' OR ')})`;
}

function splitSearchPhrases(value = '') {
  return String(value)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstStrongTerms(value = '', limit = 6) {
  return extractTerms(value)
    .filter((term) => term.length >= 4)
    .slice(0, limit);
}

function opportunitySearchTerms(filter = {}) {
  const opportunityText = [
    filter.opportunity,
    filter.opportunityName,
    filter.opportunityTitle,
    filter.position,
    filter.role,
    filter.cargo,
    filter.title
  ].filter(Boolean).join(' ');

  const jobTerms = firstStrongTerms(filter.jobDescription, 8);
  const titlePatterns = [];
  const normalizedOpportunity = normalizeText(opportunityText);
  const normalizedJob = normalizeText(filter.jobDescription);
  const context = `${normalizedOpportunity} ${normalizedJob}`;

  if (/gerente|gestor|project manager|pmo/.test(context)) {
    titlePatterns.push('Gerente de Projetos', 'Project Manager', 'PMO', 'Coordenador de Projetos');
  }
  if (/desenvolvedor|developer|programador|front|back|fullstack/.test(context)) {
    titlePatterns.push('Desenvolvedor', 'Developer', 'Software Engineer', 'Programador');
  }
  if (/analista|consultor|consultant/.test(context)) {
    titlePatterns.push('Consultor', 'Analista', 'Consultant');
  }
  if (/arquiteto|architect/.test(context)) {
    titlePatterns.push('Arquiteto', 'Architect');
  }

  const opportunityPhrases = splitSearchPhrases(opportunityText)
    .filter((item) => normalizeText(item).length >= 4)
    .slice(0, 4);

  return uniqueNonEmpty([
    ...opportunityPhrases,
    ...titlePatterns,
    ...jobTerms.slice(0, 4)
  ]).slice(0, 10);
}

function linkedinLocationTerms(filter = {}) {
  const cities = Array.isArray(filter.cityRadiusCities) && filter.cityRadiusCities.length
    ? filter.cityRadiusCities.slice(0, 8)
    : [filter.city].filter(Boolean);

  return uniqueNonEmpty([
    ...cities,
    filter.state
  ]);
}

function linkedinSkillTerms(filter = {}) {
  return uniqueNonEmpty([
    ...splitMandatorySkills(filter.mandatorySkills),
    ...firstStrongTerms(filter.jobDescription, 10)
  ]).slice(0, 12);
}

function linkedinNegativeTerms() {
  return ['vaga', 'jobs', 'job', 'recruiter', 'recrutador', 'curso', 'treinamento', 'professor', 'estagio', 'estagiario'];
}

export function buildLinkedinQueries(filter = {}, limit = 10) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const titles = opportunitySearchTerms(filter);
  const skills = linkedinSkillTerms(filter);
  const mandatorySkills = splitMandatorySkills(filter.mandatorySkills);
  const locations = linkedinLocationTerms(filter);
  const negatives = linkedinNegativeTerms().map((term) => `-${term}`).join(' ');

  const titleGroup = booleanOr(titles.slice(0, 5));
  const skillGroup = booleanOr(skills.slice(0, 6));
  const mandatoryGroup = booleanOr(mandatorySkills.slice(0, 6));
  const locationGroup = booleanOr(locations.slice(0, 6));

  const strategies = [
    { name: 'Competência principal', query: ['site:linkedin.com/in', booleanOr(skillAlternatives(coreKeyword(filter))), negatives].filter(Boolean).join(' ') },
    {
      name: 'Restritiva',
      query: ['site:linkedin.com/in', titleGroup, mandatoryGroup, locationGroup, negatives].filter(Boolean).join(' ')
    },
    {
      name: 'Balanceada',
      query: ['site:linkedin.com/in', titleGroup || skillGroup, skillGroup, locationGroup, negatives].filter(Boolean).join(' ')
    },
    {
      name: 'Cargo e habilidades',
      query: ['site:linkedin.com/in', titleGroup, mandatoryGroup || skillGroup, negatives].filter(Boolean).join(' ')
    },
    {
      name: 'Habilidades obrigatorias',
      query: ['site:linkedin.com/in', mandatoryGroup || skillGroup, locationGroup, negatives].filter(Boolean).join(' ')
    },
    {
      name: 'Job description',
      query: ['site:linkedin.com/in', booleanOr(firstStrongTerms(filter.jobDescription, 8)), locationGroup, negatives].filter(Boolean).join(' ')
    }
  ];

  return strategies
    .filter((strategy) => strategy.query.replace(/^site:linkedin\.com\/in\s*/i, '').trim())
    .filter((strategy, index, array) => array.findIndex((item) => item.query === strategy.query) === index)
    .slice(0, Math.max(1, Math.min(8, requestedLimit)));
}

function linkedinQuery(filter) {
  return buildLinkedinQueries(filter, 1)[0]?.query || `site:linkedin.com/in ${String(filter.mandatorySkills || '').trim()}`.trim();
}

function englishCode(level = '') {
  return ENGLISH_LEVELS[normalizeText(level)] || '';
}

function textContainsValue(normalizedText, value) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return true;

  if (normalizedValue.length <= 2) {
    return new RegExp(`(^| )${escapeRegex(normalizedValue)}( |$)`).test(normalizedText);
  }

  return normalizedText.includes(normalizedValue);
}

function evaluateRequiredListFilters(text, filter, candidate = {}) {
  const normalizedText = normalizeText(text);
  const cityValues = Array.isArray(filter.cityRadiusCities) && filter.cityRadiusCities.length
    ? filter.cityRadiusCities
    : [filter.city].filter(Boolean);
  const missing = [];
  const candidateState = String(candidate.state || candidate.estado || '').trim();
  const candidateCity = String(candidate.city || candidate.cidade || '').trim();
  const candidateEnglish = String(candidate.englishLevel || candidate.nivel_ingles || '').trim();

  if (String(filter.state || '').trim()) {
    const stateMatches = candidateState
      ? normalizeText(candidateState) === normalizeText(filter.state)
      : textContainsValue(normalizedText, filter.state);
    if (!stateMatches) missing.push(`estado: ${filter.state}`);
  }

  if (String(filter.englishLevel || '').trim()) {
    const requestedRank = requestedEnglishRank(filter.englishLevel);
    const detected = detectedEnglishLevel(candidateEnglish || text);
    if (!detected.evident || detected.rank < requestedRank) {
      missing.push(`nivel de ingles minimo: ${filter.englishLevel}`);
    }
  }

  const cityMatches = candidateCity
    ? cityValues.some((city) => normalizeText(city) === normalizeText(candidateCity))
    : cityValues.some((city) => textContainsValue(normalizedText, city));
  if (String(filter.city || '').trim() && !cityMatches) {
    missing.push(`cidade: ${cityValues.join(' ou ')}`);
  }

  return {
    accepted: missing.length === 0,
    missing
  };
}

function parseResultLinks(html) {
  return Array.from(String(html).matchAll(/<a\s+[^>]*href="(?<href>roteador2\.cfm[^"]+)"[^>]*>(?<text>[\s\S]*?)<\/a>/gi))
    .map((match) => {
      const code = decodeEntities(match.groups.text.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
      const link = new URL(match.groups.href.replace(/\s/g, '%20'), APINFO_BASE).href;
      return { code, link };
    });
}

function extractCount(html) {
  const text = htmlToText(html);
  const match = text.match(/Encontrad[oa]s?\s*:?\s*([\d.]+)\s*curr/i);
  return match ? Number(match[1].replace(/\./g, '')) : 0;
}

function parseBrazilianDate(value = '') {
  const match = String(value).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return 0;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year < 50 ? 2000 : 1900;

  return Date.UTC(year, month - 1, day);
}

function parseAnyDateTime(value = '') {
  const text = String(value || '').trim();
  if (!text) return 0;
  const brazilian = parseBrazilianDate(text);
  if (brazilian) return brazilian;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function extractLastUpdated(text = '') {
  const match = String(text).match(/(?:Ultima atualizacao|Última atualização)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  return match?.[1] ?? '';
}

function extractDetail(html, result) {
  const lines = stripHtml(html);
  const codeIndex = lines.findIndex((line) => /Codigo APinfo|Código APinfo/i.test(line));
  const name = codeIndex > 1 ? lines[codeIndex - 2] : result.code;
  const role = codeIndex > 0 ? lines[codeIndex - 1] : '';
  const text = lines.join('\n');
  const lastUpdated = extractLastUpdated(text);

  return {
    name,
    role,
    code: result.code,
    link: result.link,
    lastUpdated,
    lastUpdatedTime: parseBrazilianDate(lastUpdated),
    text
  };
}

function filterAndScoreCandidate(detail, filter, candidate = {}) {
  return screenCandidate(detail.text, filter, { currentTitle: detail.role || '', ...candidate });
}

function extractGoogleLinkedinResults(html = '') {
  const results = [];
  const seen = new Set();
  const blocks = String(html).split(/<div class="g"|<div class="MjjYud"/i);

  for (const block of blocks) {
    const urlMatch = block.match(/href="\/url\?q=(?<url>https?:\/\/[^"&]+linkedin\.com\/in\/[^"&]+)/i)
      || block.match(/href="(?<url>https?:\/\/[^"]+linkedin\.com\/in\/[^"]+)"/i);
    if (!urlMatch?.groups?.url) continue;

    const url = decodeURIComponent(urlMatch.groups.url).split('&')[0];
    const cleanUrl = url.replace(/[#?].*$/, '');
    if (seen.has(cleanUrl)) continue;

    const titleMatch = block.match(/<h3[^>]*>(?<title>[\s\S]*?)<\/h3>/i);
    const text = htmlToText(block);
    const title = titleMatch ? htmlToText(titleMatch.groups.title).replace(/\n+/g, ' ').trim() : '';
    const snippet = text
      .split('\n')
      .filter((line) => line && line !== title && !line.includes('linkedin.com/in'))
      .slice(0, 4)
      .join(' ');

    seen.add(cleanUrl);
    results.push({
      name: title || cleanUrl,
      link: cleanUrl,
      snippet
    });
  }

  return results;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 Gestao-do-Negocio-Alcateia',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      ...(options.headers ?? {})
    }
  });
  const buffer = await response.arrayBuffer();
  return new TextDecoder('utf-8').decode(buffer);
}

async function fetchLinkedinProfileText(link, fallbackText) {
  try {
    const html = await fetchText(link, { headers: { Referer: GOOGLE_SEARCH_URL } });
    const text = htmlToText(html);
    if (/authwall|checkpoint|login|sign in|entrar/i.test(text) && text.length < 1200) {
      return fallbackText;
    }
    return text.length > fallbackText.length ? text : fallbackText;
  } catch {
    return fallbackText;
  }
}

function parseSerpApiLinkedinResults(payload) {
  const organicResults = Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  return organicResults
    .filter((result) => /linkedin\.com\/in\//i.test(String(result.link ?? '')))
    .map((result) => ({
      name: String(result.title ?? result.link ?? '').replace(/\s*\|\s*LinkedIn.*$/i, '').trim(),
      link: String(result.link ?? '').replace(/[#?].*$/, ''),
      snippet: String(result.snippet ?? '').trim()
    }));
}

async function searchLinkedinCandidatesWithSerpApi(filter, limit, queryOverride = '') {
  const apiKey = process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY || '';
  if (!apiKey) {
    throw new Error('SERPAPI_KEY nao configurada; Google direto retorna pagina de JavaScript.');
  }

  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const query = queryOverride || linkedinQuery(filter);
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    api_key: apiKey,
    num: String(Math.min(10, requestedLimit)),
    hl: 'pt-BR',
    gl: 'br'
  });
  const response = await fetch(`${SERPAPI_SEARCH_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 Gestao-do-Negocio-Alcateia'
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    throw new Error(payload.error || `SerpAPI retornou HTTP ${response.status}.`);
  }

  return {
    query,
    profiles: parseSerpApiLinkedinResults(payload).slice(0, requestedLimit),
    provider: 'SerpAPI'
  };
}

async function searchLinkedinCandidatesWithGoogle(filter, limit, queryOverride = '') {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const query = queryOverride || linkedinQuery(filter);
  const params = new URLSearchParams({
    q: query,
    num: String(Math.min(10, requestedLimit)),
    hl: 'pt-BR'
  });
  const html = await fetchText(`${GOOGLE_SEARCH_URL}?${params.toString()}`);
  if (/httpservice\/retry\/enablejs|If you're having trouble accessing Google Search|SG_REL/i.test(html)) {
    throw new Error('Google retornou pagina de ativacao de JavaScript em vez dos resultados.');
  }
  if (/\/sorry\/|captcha|unusual traffic/i.test(html)) {
    throw new Error('Google bloqueou a consulta automatizada.');
  }
  return {
    query,
    profiles: extractGoogleLinkedinResults(html).slice(0, requestedLimit),
    provider: 'Google direto'
  };
}

function linkedinEvidence(profileText, filter) {
  const normalizedText = normalizeText(profileText);
  const titleHits = opportunitySearchTerms(filter).filter((term) => textContainsValue(normalizedText, term));
  const locationHits = linkedinLocationTerms(filter).filter((term) => textContainsValue(normalizedText, term));
  const englishHits = String(filter.englishLevel || '').trim() && textContainsValue(normalizedText, filter.englishLevel)
    ? [filter.englishLevel]
    : [];
  const mandatory = evaluateMandatorySkills(profileText, filter.mandatorySkills);
  const job = calculateJobMatch(profileText, filter.jobDescription);
  const publicSignals = [
    titleHits.length ? `cargo/contexto: ${titleHits.slice(0, 4).join(', ')}` : '',
    mandatory.hits.length ? `skills obrigatorias: ${mandatory.hits.join(', ')}` : '',
    locationHits.length ? `localidade: ${locationHits.slice(0, 4).join(', ')}` : '',
    englishHits.length ? `ingles: ${englishHits.join(', ')}` : '',
    job.hits.length ? `JD: ${job.hits.slice(0, 6).join(', ')}` : ''
  ].filter(Boolean);
  const publicGaps = [
    mandatory.missing.length ? `skills obrigatorias nao evidentes: ${mandatory.missing.join(', ')}` : '',
    String(filter.city || filter.state || '').trim() && !locationHits.length ? 'localidade nao evidente no perfil publico' : '',
    String(filter.englishLevel || '').trim() && !englishHits.length ? 'nivel de ingles nao evidente no perfil publico' : '',
    !titleHits.length ? 'cargo/contexto nao evidente no perfil publico' : ''
  ].filter(Boolean);

  const score = Math.min(100, Math.round(
    (mandatory.required.length ? (mandatory.hits.length / mandatory.required.length) * 45 : 20)
    + Math.min(25, titleHits.length * 8)
    + Math.min(15, locationHits.length * 5)
    + (job.score * 0.15)
  ));

  return {
    score,
    mandatory,
    job,
    titleHits,
    englishHits,
    locationHits,
    publicSignals,
    publicGaps
  };
}

export function evaluateLinkedinCandidateTextForFilter(text, filter) {
  return screenCandidate(text, filter, {}, true);
}

function linkedinResultRow(profile, filter, search, evaluation) {
  const accepted = evaluation.classification === 'approved';
  const review = evaluation.classification === 'review';
  const strategy = profile.strategy ? `Estrategia: ${profile.strategy}.` : '';
  const signals = evaluation.publicSignals.length
    ? `Evidencias publicas: ${evaluation.publicSignals.join('; ')}.`
    : 'Evidencias publicas insuficientes no resumo do LinkedIn.';
  const gaps = evaluation.publicGaps.length
    ? `Pontos pendentes: ${evaluation.publicGaps.join('; ')}.`
    : 'Sem lacunas publicas relevantes.';
  const profileStatus = accepted
    ? 'Perfil LinkedIn aprovado pela regra publica.'
    : review
      ? 'Perfil LinkedIn exige revisao manual pela regra publica.'
      : 'Perfil LinkedIn rejeitado pela regra publica.';

  return {
    ...evidenceFields(evaluation),
    name: profile.name,
    source: accepted ? 'LinkedIn v2' : review ? 'Revisar LinkedIn' : 'LinkedIn v2 - rejeitado',
    link: profile.link,
    score: evaluation.score,
    classification: evaluation.classification,
    scoreType: evaluation.scoreType,
    pendingChecks: evaluation.pendingChecks,
    sourceUpdatedAt: '',
    sourceUpdatedAtTime: 0,
    matchedMandatorySkills: evaluation.mandatory.hits,
    missingMandatorySkills: evaluation.mandatory.missing,
    jobDescriptionHits: evaluation.job.hits,
    jobDescriptionMissing: evaluation.job.missing,
    observation: `${profileStatus} ${evaluation.observation || evaluation.reason || ''} ${strategy} ${signals} ${gaps} Busca via ${search.provider}.`
  };
}

export async function searchLinkedinCandidates(filter, limit = 10) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const strategies = buildLinkedinQueries(filter, requestedLimit);
  const profilesByLink = new Map();
  const providers = new Set();
  const queryErrors = [];

  for (const strategy of strategies) {
    try {
      const search = (process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY)
        ? await searchLinkedinCandidatesWithSerpApi(filter, requestedLimit, strategy.query)
        : await searchLinkedinCandidatesWithGoogle(filter, requestedLimit, strategy.query);
      providers.add(search.provider);
      for (const profile of search.profiles) {
        const key = String(profile.link || '').replace(/\/$/, '');
        if (!key) continue;
        if (!profilesByLink.has(key)) {
          profilesByLink.set(key, {
            ...profile,
            link: key,
            strategy: strategy.name,
            query: strategy.query
          });
        }
      }
    } catch (error) {
      queryErrors.push(`${strategy.name}: ${error.message || 'falha na busca'}`);
    }
  }

  if (!profilesByLink.size && queryErrors.length === strategies.length && strategies.length) {
    throw new Error(queryErrors.join(' | '));
  }

  const search = {
    query: strategies.map((strategy) => `${strategy.name}: ${strategy.query}`).join(' || '),
    profiles: Array.from(profilesByLink.values()).slice(0, Math.max(requestedLimit * 3, requestedLimit)),
    provider: Array.from(providers).join(' + ') || ((process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY) ? 'SerpAPI' : 'Google direto'),
    errors: queryErrors
  };
  const results = [];
  const rejectedResults = [];

  for (const profile of search.profiles) {
    const fallbackText = `${profile.name}\n${profile.snippet}`;
    const profileText = fallbackText; // Public summaries are partial evidence, never a complete CV.
    const evaluation = evaluateLinkedinCandidateTextForFilter(profileText, filter);
    const row = linkedinResultRow(profile, filter, search, evaluation);

    if (evaluation.accepted || evaluation.review) {
      results.push(row);
    } else {
      rejectedResults.push(row);
    }

  }

  return {
    query: search.query,
    totalFound: profilesByLink.size,
    stats: screeningStats([...results, ...rejectedResults], profilesByLink.size),
    provider: search.provider,
    strategies,
    errors: search.errors,
    results,
    rejectedResults
  };
}

function mergeCandidateRows(primaryRows, secondaryRows, limit) {
  const rows = [];
  const seen = new Set();

  for (const row of [...primaryRows, ...secondaryRows]) {
    const key = row.link || `${row.source}:${row.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return rows.slice(0, Math.max(1, limit * 2));
}

function sortByJobScore(rows) {
  return rows
    .slice()
    .sort((first, second) => Number(second.score || 0) - Number(first.score || 0));
}

function sortByFreshnessAndScore(rows) {
  return rows
    .slice()
    .sort((first, second) => {
      const firstTime = Number(first.sourceUpdatedAtTime || parseAnyDateTime(first.sourceUpdatedAt) || 0);
      const secondTime = Number(second.sourceUpdatedAtTime || parseAnyDateTime(second.sourceUpdatedAt) || 0);
      if (firstTime !== secondTime) return secondTime - firstTime;

      const scoreDiff = Number(second.score || 0) - Number(first.score || 0);
      if (scoreDiff) return scoreDiff;

      return String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR', { sensitivity: 'base' });
    });
}

function evidenceFields(evaluation) {
  return { technicalScore: evaluation.technicalScore, triageGroup: evaluation.triageGroup, evidence: evaluation.evidence, experience: evaluation.experience };
}

export function apinfoNextPage(html, currentPage = 1) {
  const options = [];
  for (const match of String(html).matchAll(/<a\b([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const label = htmlToText(match[4]).trim();
    const next = /pr[oó]xim|seguinte|next/i.test(label + match[1] + match[3]);
    const page = /^\d+$/.test(label) ? Number(label) : 0;
    if (!next && page !== currentPage + 1) continue;
    try {
      const url = new URL(decodeEntities(match[2]), APINFO_SEARCH_URL);
      if (url.origin !== new URL(APINFO_BASE).origin || !url.pathname.startsWith('/apinfo/inc/') || /roteador|logout/i.test(url.pathname)) continue;
      options.push({ url: url.href, page: page || currentPage + 1 });
    } catch { /* Ignore non-URL controls; report incomplete coverage rather than invent a request. */ }
  }
  return options[0] || null;
}

class ApinfoSession {
  constructor(credentials) {
    this.credentials = credentials;
    this.cookies = new Map();
  }

  cookieHeader() {
    return Array.from(this.cookies.values()).join('; ');
  }

  storeCookies(response) {
    const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
    const setCookies = getSetCookie ? getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);

    for (const header of setCookies) {
      const cookie = String(header).split(';')[0];
      const name = cookie.split('=')[0];
      if (name) this.cookies.set(name, cookie);
    }
  }

  async request(url, options = {}) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { return await this.requestOnce(url, options); }
      catch (error) {
        lastError = error;
        if (/HTTP 4\d\d/.test(error.message)) throw error;
      }
    }
    throw lastError;
  }

  async requestOnce(url, options = {}) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 Gestao-do-Negocio-Alcateia',
        ...(this.cookieHeader() ? { Cookie: this.cookieHeader() } : {}),
        ...(options.headers ?? {})
      }
    });

    if (!response.ok) throw new Error(`APINFO respondeu HTTP ${response.status}`);
    this.storeCookies(response);
    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('windows-1252').decode(buffer);
    return { response, html };
  }

  async post(url, body) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        form.append(key, item);
      }
    }

    return this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: url
      },
      body: form
    });
  }

  async login() {
    await this.request(APINFO_LOGIN_URL);
    const { html } = await this.post(APINFO_LOGIN_URL, {
      cgc: this.credentials.user,
      magic: this.credentials.password,
      R1: 'EP',
      suby: 'Enviar'
    });

    if (!/form-busca|Resultado da pesquisa|Palavras-chave/i.test(html)) {
      throw new Error('Nao foi possivel autenticar na APINFO.');
    }
    return html;
  }

  async search(filter, extraFields = {}, page = 1) {
    return this.post(APINFO_SEARCH_URL, {
      tcv: '1',
      pag: String(page),
      keyw: buildKeyword(filter),
      estado: filter.state || '',
      ...extraFields
    });
  }

  async getDetail(link) {
    return this.request(link);
  }
}

export async function searchApinfoCandidates(filter, credentials, limit = 10) {
  const session = new ApinfoSession(credentials);
  await session.login();
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const targetScan = Math.min(Math.max(requestedLimit * 4, 20), 100);
  const maxPages = 10;
  const warnings = [];
  const failedDetails = [];
  const extraFields = {};
  const retrievalFilter = { ...filter, state: '', city: '' };

  const firstSearch = await session.search(retrievalFilter, extraFields);
  let firstHtml = firstSearch.html;
  // Missing language and residence fields must not suppress initial retrieval.

  let links = parseResultLinks(firstHtml);

  let pageHtml = firstHtml, pagesRead = 1;
  const visited = new Set();
  for (let page = 1; page < maxPages && links.length < targetScan; page += 1) {
    const next = apinfoNextPage(pageHtml, page);
    if (!next || visited.has(next.url)) break;
    visited.add(next.url);
    try {
      const pageSearch = await session.request(next.url);
      const pageLinks = parseResultLinks(pageSearch.html);
      const known = new Set(links.map(item => item.code || item.link));
      const fresh = pageLinks.filter(item => !known.has(item.code || item.link));
      if (!fresh.length) { warnings.push('Paginação retornou página repetida ou sem novos currículos.'); break; }
      links.push(...fresh); pageHtml = pageSearch.html; pagesRead += 1;
    } catch (error) { warnings.push(`Paginação interrompida: ${error.message}`); break; }
  }

  const uniqueLinks = Array.from(new Map(links.map((link) => [link.code || link.link, link])).values()).slice(0, targetScan);
  const details = [];

  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(3, uniqueLinks.length) }, async () => {
    while (cursor < uniqueLinks.length) {
      const link = uniqueLinks[cursor++];
      try {
        const detailResponse = await session.getDetail(link.link);
        const detail = extractDetail(detailResponse.html, link);
        if (!detail.name || !detail.text || detail.text.length < 80) throw new Error('CV incompleto ou resposta de autenticação');
        details.push(detail);
      } catch (error) { failedDetails.push({ code: link.code, reason: error.message }); }
    }
  }));
  const found = extractCount(firstHtml);
  if (details.length < found) warnings.push(`Cobertura parcial: ${details.length} de ${found} resultados analisados; limite por execução ${targetScan}.`);
  if (failedDetails.length) warnings.push(`${failedDetails.length} currículos não puderam ser lidos após nova tentativa.`);

  details.sort((first, second) => second.lastUpdatedTime - first.lastUpdatedTime);

  const results = [];
  const rejectedResults = [];
  const inspected = [];

  for (const detail of details) {
    const evaluation = filterAndScoreCandidate(detail, filter);
    inspected.push({ code: detail.code, accepted: evaluation.accepted, reason: evaluation.reason, lastUpdated: detail.lastUpdated });

    if (evaluation.accepted || evaluation.review) {
      results.push({
        ...evidenceFields(evaluation),
        classification: evaluation.classification,
        scoreType: evaluation.scoreType,
        pendingChecks: evaluation.pendingChecks,
        name: detail.name,
        source: 'APINFO',
        link: detail.link,
        score: evaluation.score,
        sourceUpdatedAt: detail.lastUpdated,
        sourceUpdatedAtTime: detail.lastUpdatedTime,
        matchedMandatorySkills: evaluation.matchedMandatorySkills,
        missingMandatorySkills: evaluation.missingMandatorySkills,
        jobDescriptionHits: evaluation.jobDescriptionHits,
        jobDescriptionMissing: evaluation.jobDescriptionMissing,
        observation: `${evaluation.observation}. Ultima atualizacao: ${detail.lastUpdated || 'nao informada'}`
      });
    } else {
      rejectedResults.push({
        ...evidenceFields(evaluation),
        classification: 'rejected',
        name: detail.name,
        source: 'APINFO',
        link: detail.link,
        score: evaluation.score,
        sourceUpdatedAt: detail.lastUpdated,
        sourceUpdatedAtTime: detail.lastUpdatedTime,
        matchedMandatorySkills: evaluation.matchedMandatorySkills,
        missingMandatorySkills: evaluation.missingMandatorySkills,
        jobDescriptionHits: evaluation.jobDescriptionHits,
        jobDescriptionMissing: evaluation.jobDescriptionMissing,
        observation: `${evaluation.reason || 'Reprovado pela regra de aderencia.'} Ultima atualizacao: ${detail.lastUpdated || 'nao informada'}`
      });
    }

  }

  return {
    keyword: buildKeyword(filter),
    totalFound: extractCount(firstHtml),
    inspected,
    warnings, pagesRead, failedDetails,
    stats: screeningStats([...results, ...rejectedResults], extractCount(firstHtml)),
    results: results.sort((a, b) => b.score - a.score).slice(0, requestedLimit),
    rejectedResults: rejectedResults.slice(0, requestedLimit)
  };
}

export async function extractApinfoCandidateEmails(credentials, link) {
  const session = new ApinfoSession(credentials);
  await session.login();
  const detailResponse = await session.getDetail(link);
  return extractEmailsFromText(htmlToText(detailResponse.html));
}

export async function extractApinfoCandidateText(credentials, link) {
  const session = new ApinfoSession(credentials);
  await session.login();
  const detailResponse = await session.getDetail(link);
  return htmlToText(detailResponse.html);
}

export async function searchApinfoAndLinkedinCandidates(filter, credentials, limit = 50) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 50)));
  const safeSearch = async (enabled, run) => {
    if (!enabled) return { totalFound: 0, results: [], rejectedResults: [], stats: screeningStats([], 0), status: 'disabled' };
    try { const result = await run(); return { ...result, status: result.warnings?.length ? 'partial' : 'completed' }; }
    catch (error) { return { totalFound: 0, results: [], rejectedResults: [], stats: screeningStats([], 0), status: 'error', error: error.message || 'Falha na fonte' }; }
  };
  const [apinfo, linkedin] = await Promise.all([
    safeSearch(filter.searchApinfo, () => searchApinfoCandidates(filter, credentials, requestedLimit)),
    safeSearch(filter.searchLinkedin, () => searchLinkedinCandidates(filter, requestedLimit))
  ]);
  return {
    keyword: coreKeyword(filter), totalFound: apinfo.totalFound, inspected: apinfo.inspected || [],
    apinfoError: apinfo.error || '', linkedinQuery: linkedin.query || '', linkedinFound: linkedin.totalFound,
    linkedinProvider: linkedin.provider || '', linkedinError: linkedin.error || '',
    linkedinStrategies: linkedin.strategies || [], linkedinErrors: linkedin.errors || [],
    sourceStats: { APINFO: { ...apinfo.stats, status: apinfo.status, error: apinfo.error || '', warnings: apinfo.warnings || [], pagesRead: apinfo.pagesRead || 0, failedDetails: apinfo.failedDetails || [] }, LINKEDIN: { ...linkedin.stats, status: linkedin.status, error: linkedin.error || '', warnings: linkedin.errors || [] } },
    results: [...apinfo.results, ...linkedin.results].sort((a, b) => b.score - a.score),
    rejectedResults: [...apinfo.rejectedResults, ...linkedin.rejectedResults].sort((a, b) => b.score - a.score)
  };
}

export function evaluateCandidateTextForFilter(text, filter) {
  return filterAndScoreCandidate({ text }, filter);
}

export function evaluateInternalCandidateForFilter(curriculum, filter) {
  const text = [
    curriculum.nome,
    curriculum.email,
    curriculum.telefone,
    curriculum.endereco,
    curriculum.linkedin,
    curriculum.skills,
    curriculum.formacao_academica,
    curriculum.nivel_ingles,
    curriculum.nivel_espanhol,
    curriculum.cursos_certificacoes,
    curriculum.conhecimento_tecnico,
    curriculum.experiencia_profissional,
    curriculum.search_text_all,
    curriculum.texto_integral,
    curriculum.resumo,
    curriculum.cargo_alvo,
    curriculum.observacoes_entrevista,
    curriculum.fonte,
    curriculum.id_controle
  ].filter(Boolean).join('\n');
  const address = String(curriculum.endereco || curriculum.localizacao || '').trim();
  const addressParts = address.split(/[,/\-]+/).map((part) => part.trim()).filter(Boolean);
  const stateMatch = address.match(/(?:^|[,/\s-])(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:$|[,/\s-])/);
  const structuredCandidate = {
    currentTitle: curriculum.cargo_atual || curriculum.currentTitle || '',
    city: curriculum.cidade || (addressParts.length === 2 && /^[A-Z]{2}$/.test(addressParts[1]) ? addressParts[0] : ''),
    state: curriculum.estado || stateMatch?.[1] || '',
    englishLevel: curriculum.nivel_ingles || ''
  };
  const evaluation = filterAndScoreCandidate({ text }, filter, structuredCandidate);
  const sourceUpdatedAt = curriculum.data_atualizacao || curriculum.data_criacao || '';

  return {
    accepted: evaluation.accepted,
    review: evaluation.review,
    row: {
      ...evidenceFields(evaluation),
      id: `alcateia_${curriculum.id || curriculum.id_controle || curriculum.mongoId || curriculum.nome}`,
      name: curriculum.nome,
      curriculumId: curriculum.id_controle || curriculum.id || curriculum.mongoId || '',
      classification: evaluation.classification,
      scoreType: evaluation.scoreType,
      pendingChecks: evaluation.pendingChecks,
      source: 'ALCATEIA',
      link: curriculum.linkedin || '',
      score: evaluation.score,
      sourceUpdatedAt,
      sourceUpdatedAtTime: parseAnyDateTime(sourceUpdatedAt),
      matchedMandatorySkills: evaluation.matchedMandatorySkills,
      missingMandatorySkills: evaluation.missingMandatorySkills,
      jobDescriptionHits: evaluation.jobDescriptionHits,
      jobDescriptionMissing: evaluation.jobDescriptionMissing,
      observation: (evaluation.accepted || evaluation.review)
        ? `${evaluation.observation}. Banco interno atualizado em ${sourceUpdatedAt || 'data nao informada'}.`
        : `${evaluation.reason || 'Reprovado pela regra de aderencia.'} Banco interno atualizado em ${sourceUpdatedAt || 'data nao informada'}.`
    }
  };
}

export function sortCandidateRowsByFreshnessAndScore(rows) {
  return sortByFreshnessAndScore(rows);
}
