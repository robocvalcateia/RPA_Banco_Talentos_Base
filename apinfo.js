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
  tecnico: '1',
  intermediario: '2',
  fluente: '3'
};

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
  return String(filter.mandatorySkills || '').trim().slice(0, 20);
}

function linkedinQuery(filter) {
  return `site:linkedin.com/in ${String(filter.mandatorySkills || '').trim()}`.trim();
}

function englishCode(level = '') {
  return ENGLISH_LEVELS[normalizeText(level)] || '';
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

function filterAndScoreCandidate(detail, filter) {
  const match = calculateJobMatch(detail.text, filter.jobDescription);
  const jobScore = match.score;
  const minimum = Number(filter.matchPercent || 0);
  const found = match.hits.slice(0, 8).join(', ') || 'nenhum termo forte encontrado';
  const missing = match.missing.slice(0, 8).join(', ') || 'sem lacunas relevantes';

  if (jobScore < minimum) {
    return {
      accepted: false,
      score: jobScore,
      reason: `Aderencia da Job Description ${jobScore}% abaixo do minimo ${minimum}%. Ficou de fora: ${missing}. Encontrado no CV: ${found}.`
    };
  }

  return {
    accepted: true,
    score: jobScore,
    observation: `Aderencia da Job Description: ${jobScore}%. Encontrado no CV: ${found}. Pontos nao evidentes: ${missing}.`
  };
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

async function searchLinkedinCandidatesWithSerpApi(filter, limit) {
  const apiKey = process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY || '';
  if (!apiKey) {
    throw new Error('SERPAPI_KEY nao configurada; Google direto retorna pagina de JavaScript.');
  }

  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const query = linkedinQuery(filter);
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

async function searchLinkedinCandidatesWithGoogle(filter, limit) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const query = linkedinQuery(filter);
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

export async function searchLinkedinCandidates(filter, limit = 10) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const search = await searchLinkedinCandidatesWithSerpApi(filter, requestedLimit);
  const results = [];
  const rejectedResults = [];

  for (const profile of search.profiles) {
    const fallbackText = `${profile.name}\n${profile.snippet}`;
    const profileText = await fetchLinkedinProfileText(profile.link, fallbackText);
    const evaluation = filterAndScoreCandidate(
      {
        text: profileText,
        name: profile.name,
        link: profile.link,
        lastUpdated: ''
      },
      filter
    );

    if (evaluation.accepted) {
      results.push({
        name: profile.name,
        source: 'LinkedIn/Google',
        link: profile.link,
        score: evaluation.score,
        observation: `${evaluation.observation}. Analisado por busca ${search.provider}.`
      });
    } else {
      rejectedResults.push({
        name: profile.name,
        source: 'LinkedIn/Google',
        link: profile.link,
        score: evaluation.score,
        observation: `${evaluation.reason || 'Reprovado pela regra de aderencia.'} Analisado por busca ${search.provider}.`
      });
    }
  }

  return {
    query: search.query,
    totalFound: search.profiles.length,
    provider: search.provider,
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
    const response = await fetch(url, {
      redirect: 'follow',
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 Gestao-do-Negocio-Alcateia',
        ...(this.cookieHeader() ? { Cookie: this.cookieHeader() } : {}),
        ...(options.headers ?? {})
      }
    });

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
  const maxPages = Math.ceil(targetScan / 20);
  const extraFields = {};
  const level = englishCode(filter.englishLevel);

  if (level) extraFields['ingles[]'] = level;

  const firstSearch = await session.search(filter, extraFields);
  let firstHtml = firstSearch.html;
  const cityCodes = extractCityCodes(firstHtml, filter.city);

  if (cityCodes.length) {
    extraFields['cod_cidade[]'] = cityCodes;
    const citySearch = await session.search(filter, extraFields);
    firstHtml = citySearch.html;
  }

  let links = parseResultLinks(firstHtml);

  for (let page = 2; page <= maxPages && links.length < targetScan; page += 1) {
    const pageSearch = await session.search(filter, extraFields, page);
    const pageLinks = parseResultLinks(pageSearch.html);
    if (!pageLinks.length) break;
    links.push(...pageLinks);
  }

  if (!links.length && (cityCodes.length || level)) {
    const fallback = await session.search(filter);
    links = parseResultLinks(fallback.html);
  }

  const uniqueLinks = Array.from(new Map(links.map((link) => [link.code || link.link, link])).values()).slice(0, targetScan);
  const details = [];

  for (const link of uniqueLinks) {
    const detailResponse = await session.getDetail(link.link);
    details.push(extractDetail(detailResponse.html, link));
  }

  details.sort((first, second) => second.lastUpdatedTime - first.lastUpdatedTime);

  const results = [];
  const rejectedResults = [];
  const inspected = [];

  for (const detail of details) {
    const evaluation = filterAndScoreCandidate(detail, filter);
    inspected.push({ code: detail.code, accepted: evaluation.accepted, reason: evaluation.reason, lastUpdated: detail.lastUpdated });

    if (evaluation.accepted) {
      results.push({
        name: detail.name,
        source: 'APINFO',
        link: detail.link,
        score: evaluation.score,
        observation: `${evaluation.observation}. Ultima atualizacao: ${detail.lastUpdated || 'nao informada'}`
      });
    } else {
      rejectedResults.push({
        name: detail.name,
        source: 'APINFO',
        link: detail.link,
        score: evaluation.score,
        observation: `${evaluation.reason || 'Reprovado pela regra de aderencia.'} Ultima atualizacao: ${detail.lastUpdated || 'nao informada'}`
      });
    }

    if (results.length >= requestedLimit && rejectedResults.length >= requestedLimit) break;
  }

  return {
    keyword: buildKeyword(filter),
    totalFound: extractCount(firstHtml),
    inspected,
    results: results.slice(0, requestedLimit),
    rejectedResults: rejectedResults.slice(0, requestedLimit)
  };
}

export async function extractApinfoCandidateEmails(credentials, link) {
  const session = new ApinfoSession(credentials);
  await session.login();
  const detailResponse = await session.getDetail(link);
  return extractEmailsFromText(htmlToText(detailResponse.html));
}

export async function searchApinfoAndLinkedinCandidates(filter, credentials, limit = 10) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const apinfo = filter.searchApinfo
    ? await searchApinfoCandidates(filter, credentials, requestedLimit)
    : {
        keyword: buildKeyword(filter),
        totalFound: 0,
        inspected: [],
        results: [],
        rejectedResults: []
      };
  let linkedin = {
    query: linkedinQuery(filter),
    totalFound: 0,
    results: [],
    rejectedResults: [],
    provider: (process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY) ? 'SerpAPI' : 'Google direto',
    error: ''
  };

  try {
    if (filter.searchLinkedin) {
      linkedin = await searchLinkedinCandidates(filter, requestedLimit);
    }
  } catch (error) {
    linkedin.error = error.message || 'Nao foi possivel consultar Google/LinkedIn.';
  }

  return {
    keyword: apinfo.keyword,
    totalFound: apinfo.totalFound,
    inspected: apinfo.inspected,
    linkedinQuery: linkedin.query,
    linkedinFound: linkedin.totalFound,
    linkedinProvider: linkedin.provider || ((process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY) ? 'SerpAPI' : 'Google direto'),
    linkedinError: linkedin.error || '',
    results: sortByJobScore(mergeCandidateRows(apinfo.results, linkedin.results, requestedLimit)).slice(0, requestedLimit),
    rejectedResults: sortByJobScore(mergeCandidateRows(apinfo.rejectedResults, linkedin.rejectedResults, requestedLimit)).slice(0, requestedLimit)
  };
}
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
  tecnico: '1',
  intermediario: '2',
  fluente: '3'
};

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
  return String(filter.mandatorySkills || '').trim().slice(0, 20);
}

function linkedinQuery(filter) {
  return `site:linkedin.com/in ${String(filter.mandatorySkills || '').trim()}`.trim();
}

function englishCode(level = '') {
  return ENGLISH_LEVELS[normalizeText(level)] || '';
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

function filterAndScoreCandidate(detail, filter) {
  const match = calculateJobMatch(detail.text, filter.jobDescription);
  const jobScore = match.score;
  const minimum = Number(filter.matchPercent || 0);
  const found = match.hits.slice(0, 8).join(', ') || 'nenhum termo forte encontrado';
  const missing = match.missing.slice(0, 8).join(', ') || 'sem lacunas relevantes';

  if (jobScore < minimum) {
    return {
      accepted: false,
      score: jobScore,
      reason: `Aderencia da Job Description ${jobScore}% abaixo do minimo ${minimum}%. Ficou de fora: ${missing}. Encontrado no CV: ${found}.`
    };
  }

  return {
    accepted: true,
    score: jobScore,
    observation: `Aderencia da Job Description: ${jobScore}%. Encontrado no CV: ${found}. Pontos nao evidentes: ${missing}.`
  };
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

async function searchLinkedinCandidatesWithSerpApi(filter, limit) {
  const apiKey = process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY || '';
  if (!apiKey) {
    throw new Error('SERPAPI_KEY nao configurada; Google direto retorna pagina de JavaScript.');
  }

  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const query = linkedinQuery(filter);
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

async function searchLinkedinCandidatesWithGoogle(filter, limit) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const query = linkedinQuery(filter);
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

export async function searchLinkedinCandidates(filter, limit = 10) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const search = await searchLinkedinCandidatesWithSerpApi(filter, requestedLimit);
  const results = [];
  const rejectedResults = [];

  for (const profile of search.profiles) {
    const fallbackText = `${profile.name}\n${profile.snippet}`;
    const profileText = await fetchLinkedinProfileText(profile.link, fallbackText);
    const evaluation = filterAndScoreCandidate(
      {
        text: profileText,
        name: profile.name,
        link: profile.link,
        lastUpdated: ''
      },
      filter
    );

    if (evaluation.accepted) {
      results.push({
        name: profile.name,
        source: 'LinkedIn/Google',
        link: profile.link,
        score: evaluation.score,
        observation: `${evaluation.observation}. Analisado por busca ${search.provider}.`
      });
    } else {
      rejectedResults.push({
        name: profile.name,
        source: 'LinkedIn/Google',
        link: profile.link,
        score: evaluation.score,
        observation: `${evaluation.reason || 'Reprovado pela regra de aderencia.'} Analisado por busca ${search.provider}.`
      });
    }
  }

  return {
    query: search.query,
    totalFound: search.profiles.length,
    provider: search.provider,
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
    const response = await fetch(url, {
      redirect: 'follow',
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 Gestao-do-Negocio-Alcateia',
        ...(this.cookieHeader() ? { Cookie: this.cookieHeader() } : {}),
        ...(options.headers ?? {})
      }
    });

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
      estado: filter.state || 'SP',
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
  const maxPages = Math.ceil(targetScan / 20);
  const extraFields = {};
  const level = englishCode(filter.englishLevel);

  if (level) extraFields['ingles[]'] = level;

  const firstSearch = await session.search(filter, extraFields);
  let firstHtml = firstSearch.html;
  const cityCodes = extractCityCodes(firstHtml, filter.city);

  if (cityCodes.length) {
    extraFields['cod_cidade[]'] = cityCodes;
    const citySearch = await session.search(filter, extraFields);
    firstHtml = citySearch.html;
  }

  let links = parseResultLinks(firstHtml);

  for (let page = 2; page <= maxPages && links.length < targetScan; page += 1) {
    const pageSearch = await session.search(filter, extraFields, page);
    const pageLinks = parseResultLinks(pageSearch.html);
    if (!pageLinks.length) break;
    links.push(...pageLinks);
  }

  if (!links.length && (cityCodes.length || level)) {
    const fallback = await session.search(filter);
    links = parseResultLinks(fallback.html);
  }

  const uniqueLinks = Array.from(new Map(links.map((link) => [link.code || link.link, link])).values()).slice(0, targetScan);
  const details = [];

  for (const link of uniqueLinks) {
    const detailResponse = await session.getDetail(link.link);
    details.push(extractDetail(detailResponse.html, link));
  }

  details.sort((first, second) => second.lastUpdatedTime - first.lastUpdatedTime);

  const results = [];
  const rejectedResults = [];
  const inspected = [];

  for (const detail of details) {
    const evaluation = filterAndScoreCandidate(detail, filter);
    inspected.push({ code: detail.code, accepted: evaluation.accepted, reason: evaluation.reason, lastUpdated: detail.lastUpdated });

    if (evaluation.accepted) {
      results.push({
        name: detail.name,
        source: 'APINFO',
        link: detail.link,
        score: evaluation.score,
        observation: `${evaluation.observation}. Ultima atualizacao: ${detail.lastUpdated || 'nao informada'}`
      });
    } else {
      rejectedResults.push({
        name: detail.name,
        source: 'APINFO',
        link: detail.link,
        score: evaluation.score,
        observation: `${evaluation.reason || 'Reprovado pela regra de aderencia.'} Ultima atualizacao: ${detail.lastUpdated || 'nao informada'}`
      });
    }

    if (results.length >= requestedLimit && rejectedResults.length >= requestedLimit) break;
  }

  return {
    keyword: buildKeyword(filter),
    totalFound: extractCount(firstHtml),
    inspected,
    results: results.slice(0, requestedLimit),
    rejectedResults: rejectedResults.slice(0, requestedLimit)
  };
}

export async function extractApinfoCandidateEmails(credentials, link) {
  const session = new ApinfoSession(credentials);
  await session.login();
  const detailResponse = await session.getDetail(link);
  return extractEmailsFromText(htmlToText(detailResponse.html));
}

export async function searchApinfoAndLinkedinCandidates(filter, credentials, limit = 10) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const apinfo = filter.searchApinfo
    ? await searchApinfoCandidates(filter, credentials, requestedLimit)
    : {
        keyword: buildKeyword(filter),
        totalFound: 0,
        inspected: [],
        results: [],
        rejectedResults: []
      };
  let linkedin = {
    query: linkedinQuery(filter),
    totalFound: 0,
    results: [],
    rejectedResults: [],
    provider: (process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY) ? 'SerpAPI' : 'Google direto',
    error: ''
  };

  try {
    if (filter.searchLinkedin) {
      linkedin = await searchLinkedinCandidates(filter, requestedLimit);
    }
  } catch (error) {
    linkedin.error = error.message || 'Nao foi possivel consultar Google/LinkedIn.';
  }

  return {
    keyword: apinfo.keyword,
    totalFound: apinfo.totalFound,
    inspected: apinfo.inspected,
    linkedinQuery: linkedin.query,
    linkedinFound: linkedin.totalFound,
    linkedinProvider: linkedin.provider || ((process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY) ? 'SerpAPI' : 'Google direto'),
    linkedinError: linkedin.error || '',
    results: sortByJobScore(mergeCandidateRows(apinfo.results, linkedin.results, requestedLimit)).slice(0, requestedLimit),
    rejectedResults: sortByJobScore(mergeCandidateRows(apinfo.rejectedResults, linkedin.rejectedResults, requestedLimit)).slice(0, requestedLimit)
  };
}
