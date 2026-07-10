import http from 'node:http';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import {
  calculateIndicators,
  BRAZIL_UFS,
  CANDIDATE_ADERENCIA_OPTIONS,
  CANDIDATE_STAGES,
  createId,
  enrichAllocated,
  enrichCandidate,
  enrichCandidatePool,
  enrichCvFilter,
  enrichRateCard,
  enrichSelectedCandidate,
  monthYearFromDate,
  moveCandidateStage,
  hashPassword,
  normalizeCandidate,
  normalizeCurriculum,
  normalizeCurriculumObservation,
  normalizeCvFilter,
  normalizeCvSearchResult,
  normalizeSelectedCandidate,
  normalizeOpportunityModel,
  normalizeOpportunityStatus,
  normalizeAderencia,
  normalizeAllocated,
  normalizeCandidatePool,
  normalizeFaturamento,
  normalizeRateCard,
  normalizeStage,
  CANDIDATE_POOL_PROFILES,
  CANDIDATE_POOL_SKILL_FIELDS,
  OPPORTUNITY_MODELS,
  OPPORTUNITY_STATUSES,
  MONGO_APP_COLLECTIONS,
  readDatabase,
  readLocalDatabase,
  sanitizeUser,
  syncCandidatesWithOpportunityClosures,
  toISODate,
  verifyPassword,
  writeDatabase,
  writeMongoAppDatabase
} from './db.js';
import { extractApinfoCandidateEmails, extractEmailsFromText, searchApinfoAndLinkedinCandidates } from './apinfo.js';
import { getSmtpConfigFromEnv, sendMail } from './smtp.js';
import {
  buildDttZip,
  generateCurriculumContent,
  renderCurriculumDocuments
} from './dtt.js';
import {
  buildAllocatedDocumentsZip,
  renderAllocatedDocuments
} from './allocated-documents.js';
import {
  createCurriculumInMongo,
  getCurriculumsFromMongo,
  getCurriculumFromMongo,
  getMongoTalentStats,
  isMongoTalentosConfigured,
  renameLegacyCurriculumsCollection,
  syncLegacyCandidatesIntoCurriculums,
  updateCurriculumInMongo,
  upsertSelectedCandidatesIntoMongo
} from './mongo_talentos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const LEGACY_PROCESSOR_DIR = path.join(__dirname, 'legacy_banco_talentos');
const CURRICULUM_TEMPLATE_DIR = path.join(__dirname, 'assets', 'templates', 'dtt');
const ALLOCATED_TEMPLATE_DIR = path.join(__dirname, 'assets', 'templates', 'allocateds');

async function loadLocalEnv() {
  try {
    const content = await fs.readFile(path.join(__dirname, '.env'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      if (!process.env[key]) {
        process.env[key] = valueParts.join('=').trim();
      }
    }
  } catch {
    // Local environment file is optional.
  }
}

await loadLocalEnv();
function getSeedUsersFromEnv() {
  const users = [];

  for (let index = 1; index <= 20; index += 1) {
    const suffix = String(index).padStart(2, '0');

    const name = process.env[`APP_USER_${suffix}_NAME`] || '';
    const email = process.env[`APP_USER_${suffix}_EMAIL`] || '';
    const password = process.env[`APP_USER_${suffix}_PASSWORD`] || '';
    const role = process.env[`APP_USER_${suffix}_ROLE`] || 'Admin';

    if (!email || !password) continue;

    users.push({
      name: name || email.split('@')[0],
      email: email.trim().toLowerCase(),
      password,
      role
    });
  }

  return users;
}

async function seedUsersFromEnv() {
  if (process.env.SEED_USERS_FROM_ENV !== 'true') return;

  const seedUsers = getSeedUsersFromEnv();
  if (!seedUsers.length) return;

  const db = await readDatabase();

  const resetPasswords = process.env.RESET_ENV_USER_PASSWORDS === 'true';
  const forceChangePassword = process.env.SEED_USERS_FORCE_CHANGE !== 'false';

  let changed = false;

  for (const seedUser of seedUsers) {
    const existingUser = db.users.find(
      (user) => String(user.email || '').toLowerCase() === seedUser.email
    );

    if (existingUser) {
      existingUser.name = seedUser.name;
      existingUser.role = seedUser.role || existingUser.role || 'Admin';
      existingUser.updatedAt = toISODate();

      if (resetPasswords) {
        existingUser.passwordHash = hashPassword(seedUser.password);
        existingUser.mustChangePassword = forceChangePassword;
      }

      changed = true;
      continue;
    }

    db.users.push({
      id: createId('user', seedUser.name || seedUser.email),
      name: seedUser.name,
      email: seedUser.email,
      role: seedUser.role || 'Admin',
      passwordHash: hashPassword(seedUser.password),
      mustChangePassword: forceChangePassword,
      createdAt: toISODate()
    });

    changed = true;
  }

  if (changed) {
    await writeDatabase(db);
    console.log(`[seed-users] ${seedUsers.length} usuario(s) verificados a partir do .env`);
  }
}

await seedUsersFromEnv();

const PORT = Number(process.env.PORT || 3000);
const sessions = new Map();
const emailProcessing = {
  running: false,
  jobId: '',
  status: 'idle',
  startedAt: '',
  finishedAt: '',
  resultado: null,
  erro: '',
  logs: ''
};
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'America/Sao_Paulo';

function formatDateTimeBR(date = new Date()) {
  return date.toLocaleString('pt-BR', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function getApinfoCredentials() {
  const user = process.env.APINFO_USER || process.env.APINFO_CNPJ || '';
  const password = process.env.APINFO_PASSWORD || process.env.APINFO_SENHA || '';
  return {
    user,
    password,
    configured: Boolean(user && password)
  };
}

function enabledSearchSources(filter) {
  return [
    filter.searchApinfo ? 'APINFO' : '',
    filter.searchLinkedin ? 'LINKEDIN' : '',
    filter.searchAlcateia ? 'ALCATEIA' : ''
  ].filter(Boolean);
}

async function fetchPublicText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 Gestao-do-Negocio-Alcateia',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    }
  });
  const buffer = await response.arrayBuffer();
  return new TextDecoder('utf-8').decode(buffer);
}

async function extractCandidateEmails(candidate, credentials) {
  if (!candidate.link) return [];

  try {
    if (/apinfo2?\.com/i.test(candidate.link) && credentials.configured) {
      return extractApinfoCandidateEmails(credentials, candidate.link);
    }

    const text = await fetchPublicText(candidate.link);
    return extractEmailsFromText(text);
  } catch {
    return [];
  }
}

function buildCandidateEmailBody(rows, missingRows, candidateMessage = '') {
  const lines = [
    'Teste de envio de e-mails dos candidatos selecionados.',
    ''
  ];

  if (candidateMessage) {
    lines.push('Mensagem ao candidato:', candidateMessage, '');
  }

  lines.push(
    'E-mails encontrados:'
  );

  if (rows.length) {
    rows.forEach((row) => {
      lines.push(`- ${row.name}: ${row.emails.join(', ')}`);
    });
  } else {
    lines.push('- Nenhum e-mail encontrado.');
  }

  if (missingRows.length) {
    lines.push('', 'Candidatos sem e-mail encontrado:');
    missingRows.forEach((row) => lines.push(`- ${row.name} (${row.link || 'sem link'})`));
  }

  return lines.join('\n');
}

function buildCandidateMailto(to, subject, body) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}


async function loadCurriculumsForBootstrap(localDb) {
  if (!isMongoTalentosConfigured()) {
    return {
      curriculums: localDb.curriculums,
      source: 'local_json',
      stats: { total_candidatos: localDb.curriculums.length },
      error: ''
    };
  }

  try {
    const mongoResponse = await getCurriculumsFromMongo();
    const stats = await getMongoTalentStats().catch(() => ({ total_candidatos: mongoResponse.total }));
    return {
      curriculums: mongoResponse.curriculums,
      source: 'mongodb',
      stats: {
        ...stats,
        total_lido_na_tela: mongoResponse.curriculums.length,
        limite_leitura: mongoResponse.limit
      },
      error: ''
    };
  } catch (error) {
    return {
      curriculums: localDb.curriculums,
      source: 'local_json_fallback',
      stats: { total_candidatos: localDb.curriculums.length },
      error: `Falha ao conectar no MongoDB. Usando data/database.json. Detalhe: ${error.message}`
    };
  }
}
function normalizeSearchText(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_/|]+/g, ' ')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSearchTermsForCv(value = '') {
  return Array.from(new Set(
    normalizeSearchText(value)
      .split(' ')
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
  ));
}

function searchableTextFromValue(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => searchableTextFromValue(item, seen)).filter(Boolean).join(' ');
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '';
    seen.add(value);

    return Object.entries(value)
      .filter(([key]) => key !== '_id')
      .map(([, item]) => searchableTextFromValue(item, seen))
      .filter(Boolean)
      .join(' ');
  }

  return String(value);
}

function curriculumTextForAlcateia(curriculum = {}) {
  return searchableTextFromValue(curriculum);
}

function shortSearchText(value = '', maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function evaluateAlcateiaCurriculum(curriculum, filter) {
  const terms = splitSearchTermsForCv(`${filter.mandatorySkills || ''} ${filter.jobDescription || ''}`);
  const normalizedText = normalizeSearchText(curriculumTextForAlcateia(curriculum));

  if (!terms.length) {
    return {
      score: 100,
      hits: [],
      missing: []
    };
  }

  const hits = terms.filter((term) => normalizedText.includes(term));
  const missing = terms.filter((term) => !normalizedText.includes(term));
  const score = Math.round((hits.length / terms.length) * 100);

  return {
    score,
    hits,
    missing
  };
}

async function searchAlcateiaCandidates(filter, limit = 10) {
  const requestedLimit = Math.max(1, Math.min(50, Number(filter.resultLimit || limit || 10)));
  const minimum = Number(filter.matchPercent || 0);

  if (!isMongoTalentosConfigured()) {
    return {
      totalFound: 0,
      results: [],
      rejectedResults: [],
      message: 'ALCATEIA marcada, mas MongoDB não está configurado no ambiente.'
    };
  }

  const mongoResponse = await getCurriculumsFromMongo();
  const curriculums = Array.isArray(mongoResponse.curriculums) ? mongoResponse.curriculums : [];

  const evaluated = curriculums
    .map((curriculum) => {
      const evaluation = evaluateAlcateiaCurriculum(curriculum, filter);
      const accepted = evaluation.score >= minimum;

      const found = evaluation.hits.slice(0, 10).join(', ') || 'nenhum termo forte encontrado';
      const missing = evaluation.missing.slice(0, 10).join(', ') || 'sem lacunas relevantes';

      return {
        curriculum,
        accepted,
        score: evaluation.score,
        found,
        missing
      };
    })
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }

      const firstDate = new Date(first.curriculum.data_atualizacao || first.curriculum.data_criacao || 0).getTime();
      const secondDate = new Date(second.curriculum.data_atualizacao || second.curriculum.data_criacao || 0).getTime();

      return secondDate - firstDate;
    });

  const acceptedRows = evaluated
    .filter((item) => item.accepted)
    .slice(0, requestedLimit)
    .map(({ curriculum, score, found, missing }) => ({
      id: `alcateia_${curriculum.id || curriculum.id_controle || curriculum.mongoId}`,
      name: curriculum.nome || '-',
      source: 'ALCATEIA',
      curriculumId: curriculum.id_controle || curriculum.id || curriculum.mongoId || '',
      link: curriculum.linkedin || '',
      linkedinLink: curriculum.linkedin || '',
      score,
      observation: [
        `ID Controle: ${curriculum.id_controle || '-'}`,
        `Aderência MongoDB: ${score}%`,
        `Encontrado: ${found}`,
        `Pontos não evidentes: ${missing}`,
        `Skills: ${shortSearchText(curriculum.skills || curriculum.conhecimento_tecnico || '-')}`
      ].join(' | ')
    }));

  const rejectedRows = evaluated
    .filter((item) => !item.accepted)
    .slice(0, requestedLimit)
    .map(({ curriculum, score, found, missing }) => ({
      id: `alcateia_rej_${curriculum.id || curriculum.id_controle || curriculum.mongoId}`,
      name: curriculum.nome || '-',
      source: 'ALCATEIA',
      curriculumId: curriculum.id_controle || curriculum.id || curriculum.mongoId || '',
      link: curriculum.linkedin || '',
      linkedinLink: curriculum.linkedin || '',
      score,
      observation: [
        `Reprovado pela regra de aderência mínima ${minimum}%`,
        `Aderência MongoDB: ${score}%`,
        `Encontrado: ${found}`,
        `Faltando: ${missing}`
      ].join(' | ')
    }));

  return {
    totalFound: curriculums.length,
    results: acceptedRows,
    rejectedResults: rejectedRows,
    message: `ALCATEIA/MongoDB analisou ${curriculums.length} currículo(s), aprovados: ${acceptedRows.length}, rejeitados: ${rejectedRows.length}.`
  };
}

function getPythonExecutable() {
  return process.env.PYTHON_EXECUTABLE || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

function clipLogs(value, maxLength = 12000) {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}

function parseLegacyProcessResult(output) {
  const lines = String(output || '').split(/\r?\n/).reverse();
  const marker = '__RESULT_JSON__=';
  const resultLine = lines.find((line) => line.startsWith(marker));
  if (!resultLine) return null;

  try {
    return JSON.parse(resultLine.slice(marker.length));
  } catch {
    return null;
  }
}

function startLegacyEmailProcessing(options = {}) {
  const jobId = randomBytes(12).toString('hex');
  const subjectFilter = String(options.subjectFilter || options.query || '').trim();
  const foldersFromPayload = Array.isArray(options.folders)
    ? options.folders.map((folder) => String(folder).trim()).filter(Boolean).join(',')
    : String(options.folders || '').trim();
  const includeErrorFolder = Boolean(options.includeErrorFolder || subjectFilter);
  const emailFolders = foldersFromPayload
    || process.env.EMAIL_FOLDERS
    || (includeErrorFolder ? 'inbox,CVs_Processados_Erro,CVs_Processados' : 'inbox');

  emailProcessing.running = true;
  emailProcessing.jobId = jobId;
  emailProcessing.status = 'processando';
  emailProcessing.startedAt = formatDateTimeBR();
  emailProcessing.finishedAt = '';
  emailProcessing.resultado = null;
  emailProcessing.erro = '';
  emailProcessing.logs = [
    'Processamento de e-mails iniciado.',
    subjectFilter ? `Filtro: ${subjectFilter}` : '',
    `Pastas: ${emailFolders}`,
    ''
  ].filter(Boolean).join('\n');

  const child = spawn(getPythonExecutable(), ['run_process_emails.py'], {
    cwd: LEGACY_PROCESSOR_DIR,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      EMAIL_SUBJECT_FILTER: subjectFilter,
      EMAIL_FOLDERS: emailFolders
    },
    windowsHide: true
  });

  let combinedOutput = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    combinedOutput += text;
    emailProcessing.logs = clipLogs(`${emailProcessing.logs}${text}`);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    combinedOutput += text;
    emailProcessing.logs = clipLogs(`${emailProcessing.logs}${text}`);
  });

  child.on('error', (error) => {
    emailProcessing.running = false;
    emailProcessing.status = 'erro';
    emailProcessing.finishedAt = formatDateTimeBR();
    emailProcessing.erro = `Falha ao iniciar Python: ${error.message}`;
    emailProcessing.resultado = {
      success: false,
      message: emailProcessing.erro,
      stats: { erros: 1 },
      total_candidatos: 0
    };
  });

  child.on('close', async (code) => {
    const result = parseLegacyProcessResult(combinedOutput);
    emailProcessing.running = false;
    emailProcessing.finishedAt = formatDateTimeBR();

    if (result) {
      emailProcessing.resultado = result;
      emailProcessing.status = result.success ? 'finalizado' : 'erro';
      emailProcessing.erro = result.success ? '' : (result.message || `Processamento finalizado com codigo ${code}.`);

      if (result.success && isMongoTalentosConfigured()) {
        try {
          const sync = await syncLegacyCandidatesIntoCurriculums();
          emailProcessing.resultado = {
            ...result,
            sync,
            message: `${result.message || 'Processamento finalizado.'} ${sync.message}`
          };
        } catch (error) {
          emailProcessing.status = 'erro';
          emailProcessing.erro = `Processamento concluiu, mas a sincronizacao com curriculums falhou: ${error.message}`;
          emailProcessing.resultado = {
            ...result,
            success: false,
            message: emailProcessing.erro,
            sync_error: error.message
          };
        }
      }
    } else {
      emailProcessing.status = code === 0 ? 'finalizado' : 'erro';
      emailProcessing.erro = code === 0 ? '' : `Processamento finalizado com codigo ${code}, mas sem retorno JSON.`;
      emailProcessing.resultado = {
        success: code === 0,
        message: emailProcessing.erro || 'Processamento finalizado.',
        stats: {},
        total_candidatos: 0
      };
    }
  });

  return jobId;
}

async function listCurriculumTemplates() {
  const configPath = path.join(LEGACY_PROCESSOR_DIR, 'templates', 'config.json');
  const content = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(content);
  return Array.isArray(config.templates)
    ? config.templates.map((template) => ({ id: template.id, nome: template.nome }))
    : [];
}

function safeDocxFileName(value) {
  return String(value || 'curriculo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'curriculo';
}

function parseDocumentGenerationResult(output) {
  const marker = '__DOCX_RESULT__=';
  const lines = String(output || '').split(/\r?\n/).reverse();
  const line = lines.find((item) => item.startsWith(marker));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(marker.length));
  } catch {
    return null;
  }
}

async function generateCurriculumDocx(templateId, curriculum) {
  await fs.access(path.join(LEGACY_PROCESSOR_DIR, 'generate_document_cli.py'));
  await fs.access(path.join(LEGACY_PROCESSOR_DIR, 'templates', 'config.json'));

  const tmpDir = path.join(LEGACY_PROCESSOR_DIR, '.tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, `candidate-${Date.now()}-${randomBytes(6).toString('hex')}.json`);
  await fs.writeFile(inputPath, JSON.stringify(curriculum, null, 2), 'utf8');

  return await new Promise((resolve, reject) => {
    const child = spawn(getPythonExecutable(), [
      'generate_document_cli.py',
      '--template-id', templateId,
      '--candidate-json', inputPath
    ], {
      cwd: LEGACY_PROCESSOR_DIR,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8'
      },
      windowsHide: true
    });

    let combinedOutput = '';

    child.stdout.on('data', (chunk) => {
      combinedOutput += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      combinedOutput += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      reject(new Error(`Falha ao iniciar gerador Python: ${error.message}`));
    });

    child.on('close', async (code) => {
      await fs.unlink(inputPath).catch(() => null);
      const result = parseDocumentGenerationResult(combinedOutput);
      if (!result) {
        reject(new Error(`Geracao do documento nao retornou JSON. Codigo ${code}. ${combinedOutput.slice(-800)}`));
        return;
      }
      if (!result.success) {
        reject(new Error(result.error || 'Erro ao gerar documento.'));
        return;
      }
      resolve(result);
    });
  });
}

function sendDocxFile(response, filePath, filename) {
  return fs.readFile(filePath).then((content) => {
    response.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeDocxFileName(filename)}"`,
      'Content-Length': content.length,
      'Cache-Control': 'no-store, max-age=0'
    });
    response.end(content);
  });
}

function sendBufferDownload(response, filename, content, contentType) {
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${safeDocxFileName(filename)}"`,
    'Content-Length': content.length,
    'Cache-Control': 'no-store, max-age=0'
  });
  response.end(content);
}

function findLocalCurriculum(db, identifier) {
  const value = String(identifier || '').trim();
  if (!value) return null;
  return db.curriculums.find((item) => (
    item.id === value ||
    item.id_controle === value ||
    item.mongoId === value ||
    `mongo_${item.mongoId}` === value
  )) || null;
}

function buildCurriculumPayload(payload = {}) {
  return normalizeCurriculum({
    id: payload.id,
    mongoId: payload.mongoId,
    id_controle: payload.id_controle,
    nome: payload.nome,
    email: payload.email,
    telefone: payload.telefone,
    endereco: payload.endereco,
    nacionalidade: payload.nacionalidade,
    estado_civil: payload.estado_civil,
    idade: payload.idade,
    linkedin: payload.linkedin,
    skills: payload.skills,
    formacao_academica: payload.formacao_academica,
    nivel_ingles: payload.nivel_ingles,
    nivel_espanhol: payload.nivel_espanhol,
    cursos_certificacoes: payload.cursos_certificacoes,
    conhecimento_tecnico: payload.conhecimento_tecnico,
    experiencia_profissional: payload.experiencia_profissional,
    cargo_alvo: payload.cargo_alvo,
    observacoes_entrevista: payload.observacoes_entrevista,
    feedback_entrevista_ingles: payload.feedback_entrevista_ingles,
    disponibilidade_viagem: payload.disponibilidade_viagem,
    fonte: payload.fonte,
    data_criacao: payload.data_criacao,
    data_origem: payload.data_origem,
    data_nascimento: payload.data_nascimento,
    blackflag: payload.blackflag ?? payload.blacklist,
    blackflagObservation: payload.blackflagObservation ?? payload.blacklistObservation,
    data_atualizacao: toISODate()
  });
}

async function getCurriculumByIdentifier(db, identifier) {
  if (isMongoTalentosConfigured()) {
    const mongoCurriculum = await getCurriculumFromMongo(identifier).catch(() => null);
    if (mongoCurriculum) return mongoCurriculum;
  }
  return findLocalCurriculum(db, identifier);
}

async function updateCurriculumByIdentifier(db, identifier, payload) {
  const normalized = buildCurriculumPayload(payload);
  if (!normalized.nome) {
    throw new Error('Informe o nome do candidato.');
  }

  if (isMongoTalentosConfigured()) {
    const updatedMongo = await updateCurriculumInMongo(identifier, normalized);
    if (updatedMongo) return updatedMongo;
  }

  const existing = findLocalCurriculum(db, identifier);
  if (!existing) return null;
  Object.assign(existing, {
    ...normalized,
    id: existing.id,
    mongoId: existing.mongoId,
    data_criacao: existing.data_criacao || normalized.data_criacao,
    data_atualizacao: toISODate()
  });
  await writeDatabase(db);
  return existing;
}

function createSession(user) {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, {
    userId: user.id,
    createdAt: Date.now()
  });
  return token;
}

function getBearerToken(request) {
  const header = request.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' ? token : '';
}

async function authenticateRequest(request, response) {
  const token = getBearerToken(request);
  const session = sessions.get(token);

  if (!session) {
    sendError(response, 401, 'Sessao invalida ou expirada.');
    return null;
  }

  const db = await readDatabase();
  const user = db.users.find((item) => item.id === session.userId);

  if (!user) {
    sessions.delete(token);
    sendError(response, 401, 'Usuario nao encontrado.');
    return null;
  }

  return { db, token, user };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function getRoute(request) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  return {
    pathname: decodeURIComponent(url.pathname),
    searchParams: url.searchParams
  };
}

function buildHuntingOpportunity(payload, db, existing = null) {
  const startDate = String(payload.startDate ?? payload.openingDate ?? '').trim();
  return {
    ...(existing ?? {}),
    id: existing?.id ?? createId('opp', payload.profile || payload.candidateName || 'hunting'),
    clientId: String(payload.clientId ?? '').trim(),
    opportunity: String(payload.profile ?? payload.opportunity ?? '').trim(),
    opportunityCode: String(payload.opportunityCode ?? existing?.opportunityCode ?? '').trim()
      || `HUNT-${String(db.opportunities.filter((item) => item.model === 'Hunting').length + 1).padStart(3, '0')}`,
    status: 'WON',
    openingDate: startDate,
    closingDate: startDate,
    monthYear: monthYearFromDate(startDate),
    model: 'Hunting',
    owner: String(payload.owner ?? existing?.owner ?? '').trim(),
    quantity: 1,
    closedQuantity: 1,
    contractValue: Number(payload.revenue ?? payload.contractValue ?? 0),
    observation: String(payload.observation ?? existing?.observation ?? '').trim(),
    source: String(payload.source ?? existing?.source ?? '').trim(),
    updatedAt: toISODate(),
    createdAt: existing?.createdAt ?? toISODate()
  };
}

function buildHuntingCandidate(payload, opportunityId, existing = null) {
  const timestamp = toISODate();
  return normalizeCandidate({
    ...(existing ?? {}),
    id: existing?.id ?? createId('cand', payload.candidateName || payload.name || 'hunting'),
    name: String(payload.candidateName ?? payload.name ?? '').trim(),
    curriculumId: String(payload.curriculumId ?? existing?.curriculumId ?? '').trim(),
    opportunityId,
    hourlyRate: Number(payload.salary ?? payload.hourlyRate ?? 0),
    observation: String(payload.candidateObservation ?? existing?.observation ?? '').trim(),
    approved: true,
    stage: 'Aprovado',
    aderencia: existing?.aderencia ?? 50,
    source: String(payload.source ?? existing?.source ?? '').trim(),
    notes: String(payload.notes ?? existing?.notes ?? '').trim(),
    status: 'Aprovado',
    huntingTax: String(payload.tax ?? existing?.huntingTax ?? '').trim(),
    substitution: existing?.substitution ?? false,
    stageEnteredAt: existing?.stageEnteredAt ?? timestamp,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    stageHistory: existing?.stageHistory ?? [{ stage: 'Aprovado', enteredAt: timestamp, leftAt: '' }]
  });
}

function findHuntingCandidate(db, opportunityId, candidateId = '') {
  return db.candidates.find((candidate) => (
    candidate.opportunityId === opportunityId
    && (!candidateId || candidate.id === candidateId)
  )) ?? db.candidates.find((candidate) => candidate.opportunityId === opportunityId);
}

export function isApprovedValue(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1' || value === 'Sim';
}

export function findUserByName(db, name) {
  const normalized = String(name ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return db.users.find((user) => String(user.name ?? '').trim().toLowerCase() === normalized) ?? null;
}

function comparableText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

function candidateAderenciaFromScore(score) {
  const numericScore = Number(score ?? 0);
  if (!Number.isFinite(numericScore)) return 50;
  return CANDIDATE_ADERENCIA_OPTIONS.reduce((closest, option) => (
    Math.abs(option - numericScore) < Math.abs(closest - numericScore) ? option : closest
  ), 50);
}

export function findCurriculumForCandidateResult(db, result) {
  const curriculumId = String(result?.curriculumId ?? '').trim();
  if (curriculumId) {
    const byId = db.curriculums.find((item) => item.id === curriculumId || item.id_controle === curriculumId || item.mongoId === curriculumId);
    if (byId) return byId;
  }

  const observation = String(result?.observation ?? '');
  const controlMatch = observation.match(/ID\s*Controle:\s*([^|]+)/i);
  const controlId = String(controlMatch?.[1] ?? '').trim();
  if (controlId && controlId !== '-') {
    const byControl = db.curriculums.find((item) => item.id === controlId || item.id_controle === controlId || item.mongoId === controlId);
    if (byControl) return byControl;
  }

  const resultName = comparableText(result?.name);
  if (!resultName) return null;

  return db.curriculums.find((item) => comparableText(item.nome) === resultName) ?? null;
}

function preferredExternalCandidateLink(result) {
  const link = String(result?.link ?? '').trim();
  const linkedinLink = String(result?.linkedinLink ?? result?.linkedin ?? '').trim();
  const apinfoLink = String(result?.apinfoLink ?? result?.apinfo ?? '').trim();

  if (linkedinLink) return linkedinLink;
  if (/linkedin\.com/i.test(link)) return link;
  if (apinfoLink) return apinfoLink;
  return link;
}

function enrichCvSearchResultWithCurriculum(result, db) {
  const curriculum = findCurriculumForCandidateResult(db, result);
  const curriculumId = curriculum?.id_controle || curriculum?.id || result.curriculumId || '';

  return normalizeCvSearchResult({
    ...result,
    curriculumId,
    link: curriculum ? preferredExternalCandidateLink(result) : preferredExternalCandidateLink(result)
  });
}

export function advanceSelectedCandidateToInterview(db, selectedCandidateId) {
  const selected = db.selectedCandidates.find((item) => item.id === selectedCandidateId);
  if (!selected) {
    const error = new Error('Candidato selecionado nao encontrado.');
    error.statusCode = 404;
    throw error;
  }

  const opportunity = db.opportunities.find((item) => item.id === selected.opportunityId);
  if (!opportunity) {
    const error = new Error('Oportunidade do candidato selecionado nao encontrada.');
    error.statusCode = 422;
    throw error;
  }

  const curriculum = findCurriculumForCandidateResult(db, selected);
  const curriculumId = selected.curriculumId || curriculum?.id_controle || curriculum?.id || '';
  const selectedName = String(selected.name || curriculum?.nome || '').trim();
  const normalizedName = comparableText(selectedName);
  const existing = db.candidates.find((candidate) => (
    candidate.opportunityId === selected.opportunityId
    && (
      (curriculumId && candidate.curriculumId === curriculumId)
      || (normalizedName && comparableText(candidate.name) === normalizedName)
    )
  ));
  const timestamp = toISODate();

  if (existing) {
    existing.name = selectedName || existing.name;
    existing.curriculumId = curriculumId || existing.curriculumId;
    existing.opportunityId = selected.opportunityId;
    existing.observation = selected.observation || existing.observation || '';
    existing.source = selected.source || existing.source || '';
    existing.aderencia = candidateAderenciaFromScore(selected.score ?? existing.aderencia);
    if (!['Aprovado', 'Reprovado'].includes(existing.stage) && existing.stage !== 'Entrevista Alcateia') {
      moveCandidateStage(existing, 'Entrevista Alcateia');
    }
    existing.updatedAt = timestamp;
    return existing;
  }

  const candidate = normalizeCandidate({
    id: createId('cand', selectedName || 'candidato'),
    name: selectedName,
    curriculumId,
    opportunityId: selected.opportunityId,
    hourlyRate: 0,
    observation: selected.observation,
    approved: false,
    stage: 'Entrevista Alcateia',
    aderencia: candidateAderenciaFromScore(selected.score),
    source: selected.source,
    notes: selected.candidateMessage,
    status: 'Em andamento',
    stageEnteredAt: timestamp,
    createdAt: timestamp,
    stageHistory: [{ stage: 'Entrevista Alcateia', enteredAt: timestamp, leftAt: '' }]
  });

  if (!candidate.name) {
    const error = new Error('Informe o nome do candidato.');
    error.statusCode = 422;
    throw error;
  }

  db.candidates.push(candidate);
  return candidate;
}

export function placementCodeFromCandidate(candidate, opportunity) {
  const source = candidate.curriculumId || opportunity?.opportunityCode || candidate.id || candidate.name || 'alocado';
  return String(source)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .toUpperCase();
}

export function buildAllocatedFromApprovedCandidate(candidate, db, existing = null) {
  const curriculum = db.curriculums.find((item) => item.id === candidate.curriculumId || item.id_controle === candidate.curriculumId);
  const opportunity = db.opportunities.find((item) => item.id === candidate.opportunityId);
  const responsible = findUserByName(db, opportunity?.owner);
  const today = new Date().toISOString().slice(0, 10);

  return normalizeAllocated({
    ...(existing ?? {}),
    id: existing?.id ?? createId('alloc', candidate.name),
    externalId: existing?.externalId || candidate.curriculumId || candidate.id,
    code: existing?.code || placementCodeFromCandidate(candidate, opportunity),
    consultant: candidate.name,
    skill: curriculum?.skills || existing?.skill || candidate.observation,
    clientId: opportunity?.clientId || existing?.clientId || '',
    hourlyRate: candidate.hourlyRate,
    phone: curriculum?.telefone || existing?.phone || '',
    consultantEmail: curriculum?.email || existing?.consultantEmail || '',
    startDate: existing?.startDate || opportunity?.closingDate || today,
    active: existing?.active ?? true,
    endDate: existing?.endDate || '',
    manager: opportunity?.owner || existing?.manager || '',
    managerEmail: responsible?.email || existing?.managerEmail || '',
    managerPhone: existing?.managerPhone || '',
    candidateId: candidate.id,
    curriculumId: candidate.curriculumId,
    opportunityId: candidate.opportunityId,
    createdAt: existing?.createdAt ?? toISODate(),
    updatedAt: toISODate()
  });
}

export function syncApprovedCandidatePlacement(candidate, db) {
  if (!candidate.approved) return null;

  if (candidate.stage !== 'Aprovado') {
    moveCandidateStage(candidate, 'Aprovado');
  }
  candidate.status = 'Aprovado';
  candidate.approved = true;
  candidate.updatedAt = toISODate();

  const opportunity = db.opportunities.find((item) => item.id === candidate.opportunityId);
  if (!opportunity) {
    return { type: 'none', action: 'skipped', reason: 'Oportunidade nao encontrada.' };
  }

  if (opportunity.model === 'Hunting') {
    const closingDate = opportunity.closingDate || new Date().toISOString().slice(0, 10);
    opportunity.status = 'WON';
    opportunity.closingDate = closingDate;
    opportunity.monthYear = opportunity.monthYear || monthYearFromDate(closingDate);
    opportunity.closedQuantity = Math.max(1, Number(opportunity.closedQuantity ?? 0));
    opportunity.updatedAt = toISODate();
    return { type: 'hunting', action: 'updated', opportunityId: opportunity.id };
  }

  if (!opportunity.clientId || !db.clients.some((client) => client.id === opportunity.clientId)) {
    return { type: 'allocated', action: 'skipped', reason: 'Cliente da oportunidade nao encontrado.' };
  }

  const allocated = db.allocateds.find((item) => (
    item.candidateId === candidate.id
    || (candidate.curriculumId && item.curriculumId === candidate.curriculumId && item.opportunityId === candidate.opportunityId)
  ));
  const synced = buildAllocatedFromApprovedCandidate(candidate, db, allocated);

  if (allocated) {
    Object.assign(allocated, synced);
    return { type: 'allocated', action: 'updated', allocatedId: allocated.id };
  }

  db.allocateds.push(synced);
  return { type: 'allocated', action: 'created', allocatedId: synced.id };
}

async function serveStatic(request, response) {
  const { pathname } = getRoute(request);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(response, 403, 'Acesso negado.');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0'
    });
    response.end(content);
  } catch {
    sendError(response, 404, 'Arquivo nao encontrado.');
  }
}

async function handleApi(request, response) {
  const route = getRoute(request);
  const pathname = route.pathname.length > 1 && route.pathname.endsWith('/')
    ? route.pathname.slice(0, -1)
    : route.pathname;

  try {
    if (request.method === 'POST' && pathname === '/api/login') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const email = String(payload.email ?? '').trim().toLowerCase();
      const user = db.users.find((item) => item.email.toLowerCase() === email);

      if (!user || !verifyPassword(payload.password, user.passwordHash)) {
        sendError(response, 401, 'Usuario ou senha invalidos.');
        return;
      }

      const token = createSession(user);
      sendJson(response, 200, {
        token,
        user: sanitizeUser(user)
      });
      return;
    }

    const auth = await authenticateRequest(request, response);
    if (!auth) return;

    const canAccessBeforePasswordChange = pathname === '/api/change-password' || pathname === '/api/logout';
    if (auth.user.mustChangePassword && !canAccessBeforePasswordChange) {
      sendError(response, 403, 'Troque sua senha para continuar.');
      return;
    }

    if (request.method === 'POST' && pathname === '/api/logout') {
      sessions.delete(auth.token);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/change-password') {
      const payload = await readJsonBody(request);
      const newPassword = String(payload.newPassword ?? '');
      const confirmation = String(payload.confirmPassword ?? '');

      if (newPassword.length < 6) {
        sendError(response, 422, 'A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (newPassword !== confirmation) {
        sendError(response, 422, 'A confirmacao da senha nao confere.');
        return;
      }
      if (verifyPassword(newPassword, auth.user.passwordHash)) {
        sendError(response, 422, 'Escolha uma senha diferente da senha inicial.');
        return;
      }
      auth.user.passwordHash = hashPassword(newPassword);
      auth.user.mustChangePassword = false;
      auth.user.passwordChangedAt = toISODate();
      await writeDatabase(auth.db);

      sendJson(response, 200, {
        user: sanitizeUser(auth.user)
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/admin/migrate-mongodb') {
      if (String(auth.user.role || '').toLowerCase() !== 'admin') {
        sendError(response, 403, 'Apenas administradores podem executar a migracao.');
        return;
      }

      const payload = await readJsonBody(request);
      if (String(payload.confirm || '').trim() !== 'MIGRAR_PARA_MONGO') {
        sendError(response, 422, 'Informe confirm=MIGRAR_PARA_MONGO para executar a migracao.');
        return;
      }

      if (!isMongoTalentosConfigured()) {
        sendError(response, 500, 'MongoDB nao esta configurado neste ambiente.');
        return;
      }

      const localDb = await readLocalDatabase();
      const renameResult = await renameLegacyCurriculumsCollection().catch((error) => ({
        changed: false,
        error: error.message
      }));
      const migratedDb = await writeMongoAppDatabase(localDb);
      const migratedCollections = Object.fromEntries(
        MONGO_APP_COLLECTIONS.map((collection) => [
          collection,
          Array.isArray(migratedDb[collection]) ? migratedDb[collection].length : 0
        ])
      );
      const curriculumBootstrap = await loadCurriculumsForBootstrap({
        ...migratedDb,
        curriculums: []
      });

      sendJson(response, 200, {
        ok: true,
        database: process.env.MONGODB_DB || 'Banco_de_Talentos',
        renamedCurriculums: renameResult,
        migratedCollections,
        curriculums: {
          source: curriculumBootstrap.source,
          total: curriculumBootstrap.stats?.total_candidatos ?? curriculumBootstrap.curriculums.length,
          loaded: curriculumBootstrap.curriculums.length
        }
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/admin/clear-operational-data') {
      if (String(auth.user.role || '').toLowerCase() !== 'admin') {
        sendError(response, 403, 'Apenas administradores podem limpar dados operacionais.');
        return;
      }

      const payload = await readJsonBody(request);
      const allowedCollections = new Set(['opportunities', 'candidates', 'allocateds']);
      const requestedCollections = Array.isArray(payload.collections)
        ? payload.collections.map((collection) => String(collection || '').trim()).filter(Boolean)
        : ['opportunities', 'candidates', 'allocateds'];
      const invalidCollections = requestedCollections.filter((collection) => !allowedCollections.has(collection));

      if (String(payload.confirm || '').trim() !== 'APAGAR_DADOS_OPERACIONAIS') {
        sendError(response, 422, 'Informe confirm=APAGAR_DADOS_OPERACIONAIS para executar a limpeza.');
        return;
      }
      if (invalidCollections.length) {
        sendError(response, 422, `Colecoes nao permitidas: ${invalidCollections.join(', ')}`);
        return;
      }

      const before = Object.fromEntries(
        requestedCollections.map((collection) => [
          collection,
          Array.isArray(auth.db[collection]) ? auth.db[collection].length : 0
        ])
      );

      for (const collection of requestedCollections) {
        auth.db[collection] = [];
      }

      await writeDatabase(auth.db);

      const after = Object.fromEntries(requestedCollections.map((collection) => [collection, 0]));
      sendJson(response, 200, {
        ok: true,
        clearedCollections: requestedCollections,
        before,
        after
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/admin/import-operational-data') {
      if (String(auth.user.role || '').toLowerCase() !== 'admin') {
        sendError(response, 403, 'Apenas administradores podem importar dados operacionais.');
        return;
      }

      const payload = await readJsonBody(request);
      if (String(payload.confirm || '').trim() !== 'IMPORTAR_MIGRACAO_PROD') {
        sendError(response, 422, 'Informe confirm=IMPORTAR_MIGRACAO_PROD para executar a importacao.');
        return;
      }

      const clients = Array.isArray(payload.clients) ? payload.clients : [];
      const opportunities = Array.isArray(payload.opportunities) ? payload.opportunities : [];
      const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
      const allocateds = Array.isArray(payload.allocateds) ? payload.allocateds : [];
      const before = {
        clients: auth.db.clients.length,
        opportunities: auth.db.opportunities.length,
        candidates: auth.db.candidates.length,
        allocateds: auth.db.allocateds.length
      };

      const clientKey = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      const existingClientKeys = new Set(auth.db.clients.map((client) => clientKey(client.customerName)));

      for (const item of clients) {
        const customerName = String(item.customerName ?? item.name ?? '').trim();
        if (!customerName || existingClientKeys.has(clientKey(customerName))) continue;

        auth.db.clients.push({
          id: String(item.id || createId('client', customerName)).trim(),
          customerName,
          primaryContactName: String(item.primaryContactName ?? '').trim(),
          primaryContactEmail: String(item.primaryContactEmail ?? '').trim(),
          primaryContactPhone: String(item.primaryContactPhone ?? '').trim(),
          observation: String(item.observation ?? '').trim(),
          createdAt: String(item.createdAt ?? toISODate()).trim()
        });
        existingClientKeys.add(clientKey(customerName));
      }

      if (payload.replaceOperationalData !== false) {
        auth.db.opportunities = [];
        auth.db.candidates = [];
        auth.db.allocateds = [];
      }

      const validClientIds = new Set(auth.db.clients.map((client) => client.id));
      const importedOpportunities = opportunities.map((item) => ({
        id: String(item.id || createId('opp', item.opportunity)).trim(),
        externalId: String(item.externalId ?? '').trim(),
        clientId: String(item.clientId ?? '').trim(),
        opportunity: String(item.opportunity ?? '').trim(),
        opportunityOriginalName: String(item.opportunityOriginalName ?? '').trim(),
        opportunityCode: String(item.opportunityCode ?? '').trim(),
        status: normalizeOpportunityStatus(item.status || 'Open'),
        openingDate: String(item.openingDate ?? new Date().toISOString().slice(0, 10)).trim(),
        closingDate: String(item.closingDate ?? '').trim(),
        monthYear: String(item.monthYear ?? monthYearFromDate(item.openingDate)).trim(),
        model: normalizeOpportunityModel(item.model || 'Alocação'),
        owner: String(item.owner ?? '').trim(),
        quantity: Number(item.quantity ?? 1),
        closedQuantity: Number(item.closedQuantity ?? 0),
        contractValue: Number(item.contractValue ?? 0),
        observation: String(item.observation ?? '').trim(),
        source: String(item.source ?? 'importacao').trim(),
        createdAt: String(item.createdAt ?? toISODate()).trim()
      }));
      const invalidOpportunity = importedOpportunities.find((item) => !item.opportunity || !validClientIds.has(item.clientId));
      if (invalidOpportunity) {
        sendError(response, 422, `Oportunidade invalida ou sem cliente valido: ${invalidOpportunity.opportunity || invalidOpportunity.id}`);
        return;
      }

      auth.db.opportunities.push(...importedOpportunities);
      const validOpportunityIds = new Set(auth.db.opportunities.map((opportunity) => opportunity.id));
      const importedCandidates = candidates.map((item) => normalizeCandidate({
        id: String(item.id || createId('cand', item.name)).trim(),
        externalId: String(item.externalId ?? '').trim(),
        name: item.name,
        curriculumId: item.curriculumId,
        opportunityId: item.opportunityId,
        hourlyRate: item.hourlyRate,
        observation: item.observation,
        approved: item.approved,
        stage: item.stage,
        aderencia: item.aderencia,
        source: item.source,
        notes: item.notes,
        createdAt: String(item.createdAt ?? toISODate()).trim()
      }));
      const invalidCandidate = importedCandidates.find((item) => !item.name || !validOpportunityIds.has(item.opportunityId));
      if (invalidCandidate) {
        sendError(response, 422, `Candidato invalido ou sem oportunidade valida: ${invalidCandidate?.name || invalidCandidate?.id || '-'}`);
        return;
      }

      auth.db.candidates.push(...importedCandidates);
      const validCandidateIds = new Set(auth.db.candidates.map((candidate) => candidate.id));
      const importedAllocateds = allocateds.map((item) => normalizeAllocated({
        id: String(item.id || createId('alloc', item.code || item.consultant)).trim(),
        externalId: item.externalId,
        code: item.code,
        consultant: item.consultant,
        skill: item.skill,
        clientId: item.clientId,
        hourlyRate: item.hourlyRate,
        saleHourlyRate: item.saleHourlyRate,
        monthlyHours: item.monthlyHours,
        contractTerm: item.contractTerm,
        contractType: item.contractType,
        companyName: item.companyName,
        companyCnpj: item.companyCnpj,
        companyAddress: item.companyAddress,
        companyCity: item.companyCity,
        companyState: item.companyState,
        companyZip: item.companyZip,
        contactAddress: item.contactAddress,
        contactCity: item.contactCity,
        contactState: item.contactState,
        contactZip: item.contactZip,
        rg: item.rg,
        cpf: item.cpf,
        birthDate: item.birthDate,
        motherName: item.motherName,
        phone: item.phone,
        consultantEmail: item.consultantEmail,
        startDate: item.startDate,
        active: item.active,
        endDate: item.endDate,
        manager: item.manager,
        managerEmail: item.managerEmail,
        managerPhone: item.managerPhone,
        candidateId: validCandidateIds.has(String(item.candidateId ?? '').trim()) ? String(item.candidateId).trim() : '',
        curriculumId: item.curriculumId,
        opportunityId: validOpportunityIds.has(String(item.opportunityId ?? '').trim()) ? String(item.opportunityId).trim() : '',
        source: item.source,
        createdAt: String(item.createdAt ?? toISODate()).trim()
      }));
      const invalidAllocated = importedAllocateds.find((item) => !item.code || !item.consultant || !validClientIds.has(item.clientId));
      if (invalidAllocated) {
        sendError(response, 422, `Alocado invalido ou sem cliente valido: ${invalidAllocated?.consultant || invalidAllocated?.code || '-'}`);
        return;
      }

      auth.db.allocateds.push(...importedAllocateds);
      syncCandidatesWithOpportunityClosures(auth.db);
      await writeDatabase(auth.db);

      sendJson(response, 200, {
        ok: true,
        before,
        imported: {
          clients: clients.length,
          opportunities: importedOpportunities.length,
          candidates: importedCandidates.length,
          allocateds: importedAllocateds.length
        },
        after: {
          clients: auth.db.clients.length,
          opportunities: auth.db.opportunities.length,
          candidates: auth.db.candidates.length,
          allocateds: auth.db.allocateds.length
        }
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/bootstrap') {
      const curriculumBootstrap = await loadCurriculumsForBootstrap(auth.db);
      const responseDb = { ...auth.db, curriculums: curriculumBootstrap.curriculums };
      const curriculumTemplates = await listCurriculumTemplates().catch(() => []);
      sendJson(response, 200, {
        clients: responseDb.clients,
        opportunities: responseDb.opportunities,
        faturamento: responseDb.faturamento,
        cvFilters: responseDb.cvFilters.map((filter) => enrichCvFilter(filter, responseDb)),
        selectedCandidates: responseDb.selectedCandidates.map((candidate) => enrichSelectedCandidate(candidate, responseDb)),
        curriculums: curriculumBootstrap.curriculums,
        curriculumObservations: responseDb.curriculumObservations,
        curriculumTemplates,
        talentSource: curriculumBootstrap.source,
        talentStats: curriculumBootstrap.stats,
        talentError: curriculumBootstrap.error,
        emailProcessing: { ...emailProcessing },
        candidates: responseDb.candidates.map((candidate) => enrichCandidate(candidate, responseDb)),
        allocateds: responseDb.allocateds.map((allocated) => enrichAllocated(allocated, responseDb)),
        rateCards: responseDb.rateCards.map((rateCard) => enrichRateCard(rateCard, responseDb)),
        candidatePool: responseDb.candidatePool.map((item) => enrichCandidatePool(item, responseDb)),
        users: responseDb.users.map(sanitizeUser),
        currentUser: sanitizeUser(auth.user),
        stages: CANDIDATE_STAGES,
        aderenciaOptions: CANDIDATE_ADERENCIA_OPTIONS,
        candidatePoolProfiles: CANDIDATE_POOL_PROFILES,
        candidatePoolSkillFields: CANDIDATE_POOL_SKILL_FIELDS,
        opportunityModels: OPPORTUNITY_MODELS,
        opportunityStatuses: OPPORTUNITY_STATUSES,
        brazilUfs: BRAZIL_UFS,
        indicators: calculateIndicators(responseDb)
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/curriculum-templates') {
      const templates = await listCurriculumTemplates();
      sendJson(response, 200, { templates });
      return;
    }

    if (request.method === 'GET' && /^\/api\/curriculums\/[^/]+\/observations$/.test(pathname)) {
      const curriculumId = decodeURIComponent(pathname.split('/').at(-2));
      const curriculum = await getCurriculumByIdentifier(auth.db, curriculumId).catch(() => null);
      const curriculumAliases = new Set([
        curriculumId,
        curriculum?.id,
        curriculum?.id_controle,
        curriculum?.mongoId
      ].filter(Boolean).map((value) => String(value).trim()));
      const observations = auth.db.curriculumObservations
        .filter((observation) => curriculumAliases.has(observation.curriculumId))
        .map((observation) => {
          const user = auth.db.users.find((item) => item.id === observation.userId);
          return {
            ...observation,
            userName: observation.userName || user?.name || '',
            userEmail: observation.userEmail || user?.email || ''
          };
        })
        .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')));

      sendJson(response, 200, observations);
      return;
    }

    if (request.method === 'POST' && /^\/api\/curriculums\/[^/]+\/observations$/.test(pathname)) {
      const curriculumId = decodeURIComponent(pathname.split('/').at(-2));
      const payload = await readJsonBody(request);
      const observationText = String(payload.observation ?? payload.observacoes ?? '').trim();

      if (!observationText) {
        sendError(response, 422, 'Informe a observacao do candidato.');
        return;
      }

      const curriculum = await getCurriculumByIdentifier(auth.db, curriculumId);
      if (!curriculum) {
        sendError(response, 404, 'Curriculo nao encontrado.');
        return;
      }

      const canonicalCurriculumId = String(curriculum.id_controle || curriculum.id || curriculum.mongoId || curriculumId).trim();
      const observation = normalizeCurriculumObservation({
        id: createId('curr_obs', canonicalCurriculumId),
        curriculumId: canonicalCurriculumId,
        observation: observationText,
        date: toISODate(),
        userId: auth.user.id,
        userName: auth.user.name,
        userEmail: auth.user.email,
        createdAt: toISODate()
      });

      auth.db.curriculumObservations.push(observation);
      await writeDatabase(auth.db);
      sendJson(response, 201, observation);
      return;
    }

    if (request.method === 'PATCH' && /^\/api\/curriculums\/[^/]+$/.test(pathname)) {
      const curriculumId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const updated = await updateCurriculumByIdentifier(auth.db, curriculumId, payload);

      if (!updated) {
        sendError(response, 404, 'Candidato nao encontrado no Banco de Talentos.');
        return;
      }

      sendJson(response, 200, updated);
      return;
    }

    if (request.method === 'POST' && /^\/api\/curriculums\/[^/]+\/export-template$/.test(pathname)) {
      const parts = pathname.split('/');
      const curriculumId = parts.at(-2);
      const payload = await readJsonBody(request);
      const templateId = String(payload.templateId || payload.template_id || '').trim();

      if (!templateId) {
        sendError(response, 422, 'Selecione um template para exportar.');
        return;
      }

      const baseCurriculum = await getCurriculumByIdentifier(auth.db, curriculumId);
      const curriculumPayload = payload.curriculum && typeof payload.curriculum === 'object'
        ? buildCurriculumPayload({ ...(baseCurriculum || {}), ...payload.curriculum })
        : baseCurriculum;

      if (!curriculumPayload) {
        sendError(response, 404, 'Candidato nao encontrado para exportacao.');
        return;
      }

      if (templateId === 'alcateia' || templateId === 'dtt') {
        const generatedContent = await generateCurriculumContent(curriculumPayload);
        const documents = await renderCurriculumDocuments(
          curriculumPayload,
          generatedContent,
          CURRICULUM_TEMPLATE_DIR
        );
        const filenameBase = safeDocxFileName(curriculumPayload.nome || curriculumPayload.id_controle);

        if (templateId === 'dtt') {
          sendBufferDownload(
            response,
            `${filenameBase}-DTT.zip`,
            buildDttZip(filenameBase, documents),
            'application/zip'
          );
          return;
        }

        sendBufferDownload(
          response,
          `${filenameBase}-CV-Alcateia-PT.docx`,
          documents.alcateia,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        return;
      }

      const generated = await generateCurriculumDocx(templateId, curriculumPayload);
      const fileName = generated.filename || `${safeDocxFileName(curriculumPayload.nome)}_${templateId}.docx`;
      await sendDocxFile(response, generated.path, fileName);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/processar-emails') {
      const payload = await readJsonBody(request).catch(() => ({}));

      if (emailProcessing.running) {
        sendJson(response, 409, {
          success: false,
          message: 'Ja existe um processamento de e-mails em andamento.',
          error: 'Ja existe um processamento de e-mails em andamento.',
          job_id: emailProcessing.jobId,
          status: emailProcessing.status,
          running: true
        });
        return;
      }

      try {
        await fs.access(path.join(LEGACY_PROCESSOR_DIR, 'run_process_emails.py'));
      } catch {
        sendError(response, 500, 'Processador legado de e-mails nao encontrado em legacy_banco_talentos.');
        return;
      }

      const jobId = startLegacyEmailProcessing(payload);
      sendJson(response, 202, {
        success: true,
        message: 'Processamento de e-mails iniciado em background.',
        job_id: jobId,
        status: 'processando',
        running: true
      });
      return;
    }

    if (request.method === 'GET' && /^\/api\/processamento-status\/[^/]+$/.test(pathname)) {
      const jobId = pathname.split('/').at(-1);

      if (emailProcessing.jobId !== jobId) {
        sendError(response, 404, 'Processamento nao encontrado.');
        return;
      }

      sendJson(response, 200, {
        success: true,
        job_id: emailProcessing.jobId,
        running: emailProcessing.running,
        status: emailProcessing.status,
        started_at: emailProcessing.startedAt,
        finished_at: emailProcessing.finishedAt,
        resultado: emailProcessing.resultado,
        erro: emailProcessing.erro,
        logs: emailProcessing.logs
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/users') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const email = String(payload.email ?? '').trim().toLowerCase();
      const user = {
        id: createId('user', payload.name || email),
        name: String(payload.name ?? '').trim(),
        email,
        role: 'Admin',
        passwordHash: hashPassword('Alcateia123'),
        mustChangePassword: false,
        createdAt: toISODate()
      };

      if (!user.name || !user.email) {
        sendError(response, 422, 'Informe nome e e-mail do usuario.');
        return;
      }
      if (db.users.some((item) => item.email.toLowerCase() === user.email)) {
        sendError(response, 409, 'Ja existe um usuario com esse e-mail.');
        return;
      }

      db.users.push(user);
      await writeDatabase(db);
      sendJson(response, 201, sanitizeUser(user));
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/users/')) {
      const userId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const user = db.users.find((item) => item.id === userId);
      const email = String(payload.email ?? '').trim().toLowerCase();

      if (!user) {
        sendError(response, 404, 'Usuario nao encontrado.');
        return;
      }
      if (!String(payload.name ?? '').trim() || !email) {
        sendError(response, 422, 'Informe nome e e-mail do usuario.');
        return;
      }
      if (db.users.some((item) => item.id !== userId && item.email.toLowerCase() === email)) {
        sendError(response, 409, 'Ja existe um usuario com esse e-mail.');
        return;
      }

      user.name = String(payload.name).trim();
      user.email = email;
      user.role = 'Admin';
      user.updatedAt = toISODate();
      await writeDatabase(db);
      sendJson(response, 200, sanitizeUser(user));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/clients') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const client = {
        id: createId('client', payload.customerName),
        customerName: String(payload.customerName ?? '').trim(),
        primaryContactName: String(payload.primaryContactName ?? '').trim(),
        primaryContactEmail: String(payload.primaryContactEmail ?? '').trim(),
        primaryContactPhone: String(payload.primaryContactPhone ?? '').trim(),
        observation: String(payload.observation ?? '').trim(),
        createdAt: toISODate()
      };

      if (!client.customerName) {
        sendError(response, 422, 'Informe o nome do cliente.');
        return;
      }

      db.clients.push(client);
      await writeDatabase(db);
      sendJson(response, 201, client);
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/clients/')) {
      const clientId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const client = db.clients.find((item) => item.id === clientId);

      if (!client) {
        sendError(response, 404, 'Cliente nao encontrado.');
        return;
      }

      client.customerName = String(payload.customerName ?? '').trim();
      client.primaryContactName = String(payload.primaryContactName ?? '').trim();
      client.primaryContactEmail = String(payload.primaryContactEmail ?? '').trim();
      client.primaryContactPhone = String(payload.primaryContactPhone ?? '').trim();
      client.observation = String(payload.observation ?? '').trim();
      client.updatedAt = toISODate();

      if (!client.customerName) {
        sendError(response, 422, 'Informe o nome do cliente.');
        return;
      }

      await writeDatabase(db);
      sendJson(response, 200, client);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/opportunities') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const openingDate = String(payload.openingDate ?? new Date().toISOString().slice(0, 10));
      const opportunity = {
        id: createId('opp', payload.opportunity),
        clientId: String(payload.clientId ?? ''),
        opportunity: String(payload.opportunity ?? '').trim(),
        opportunityCode: String(payload.opportunityCode ?? '').trim(),
        status: normalizeOpportunityStatus(payload.status || 'Open'),
        openingDate,
        closingDate: String(payload.closingDate ?? '').trim(),
        monthYear: String(payload.monthYear ?? monthYearFromDate(openingDate)).trim(),
        model: normalizeOpportunityModel(payload.model || 'Alocação'),
        owner: String(payload.owner ?? '').trim(),
        quantity: Number(payload.quantity ?? 1),
        closedQuantity: Number(payload.closedQuantity ?? 0),
        contractValue: Number(payload.contractValue ?? 0),
        observation: String(payload.observation ?? '').trim(),
        createdAt: toISODate()
      };

      if (!opportunity.clientId || !db.clients.some((client) => client.id === opportunity.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }
      if (!opportunity.opportunity) {
        sendError(response, 422, 'Informe a oportunidade.');
        return;
      }
      if (opportunity.owner && !findUserByName(db, opportunity.owner)) {
        sendError(response, 422, 'Selecione um responsavel cadastrado em usuarios.');
        return;
      }

      db.opportunities.push(opportunity);
      syncCandidatesWithOpportunityClosures(db);
      await writeDatabase(db);
      sendJson(response, 201, opportunity);
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/opportunities/')) {
      const opportunityId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const opportunity = db.opportunities.find((item) => item.id === opportunityId);
      const openingDate = String(payload.openingDate ?? new Date().toISOString().slice(0, 10));

      if (!opportunity) {
        sendError(response, 404, 'Oportunidade nao encontrada.');
        return;
      }
      if (!String(payload.clientId ?? '') || !db.clients.some((client) => client.id === String(payload.clientId ?? ''))) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }
      if (!String(payload.opportunity ?? '').trim()) {
        sendError(response, 422, 'Informe a oportunidade.');
        return;
      }
      if (String(payload.owner ?? '').trim() && !findUserByName(db, payload.owner)) {
        sendError(response, 422, 'Selecione um responsavel cadastrado em usuarios.');
        return;
      }

      opportunity.clientId = String(payload.clientId ?? '');
      opportunity.opportunity = String(payload.opportunity ?? '').trim();
      opportunity.opportunityCode = String(payload.opportunityCode ?? '').trim();
      opportunity.status = normalizeOpportunityStatus(payload.status || 'Open');
      opportunity.openingDate = openingDate;
      opportunity.closingDate = String(payload.closingDate ?? '').trim();
      opportunity.monthYear = String(payload.monthYear ?? monthYearFromDate(openingDate)).trim();
      opportunity.model = normalizeOpportunityModel(payload.model || 'Alocação');
      opportunity.owner = String(payload.owner ?? '').trim();
      opportunity.quantity = Number(payload.quantity ?? 1);
      opportunity.closedQuantity = Number(payload.closedQuantity ?? 0);
      opportunity.contractValue = Number(payload.contractValue ?? 0);
      opportunity.observation = String(payload.observation ?? '').trim();
      opportunity.updatedAt = toISODate();

      syncCandidatesWithOpportunityClosures(db);
      await writeDatabase(db);
      sendJson(response, 200, opportunity);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/faturamento') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const faturamento = normalizeFaturamento({
        id: createId('faturamento', payload.monthYear),
        ...payload,
        createdAt: toISODate()
      });

      if (!faturamento.monthYear) {
        sendError(response, 422, 'Informe o mes/ano.');
        return;
      }

      db.faturamento.push(faturamento);
      await writeDatabase(db);
      sendJson(response, 201, faturamento);
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/faturamento/')) {
      const faturamentoId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const faturamento = db.faturamento.find((item) => item.id === faturamentoId);

      if (!faturamento) {
        sendError(response, 404, 'Faturamento nao encontrado.');
        return;
      }

      const updated = normalizeFaturamento({
        ...faturamento,
        ...payload,
        id: faturamento.id,
        createdAt: faturamento.createdAt,
        updatedAt: toISODate()
      });

      if (!updated.monthYear) {
        sendError(response, 422, 'Informe o mes/ano.');
        return;
      }

      Object.assign(faturamento, updated);
      await writeDatabase(db);
      sendJson(response, 200, faturamento);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/huntings') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const opportunity = buildHuntingOpportunity(payload, db);
      const candidate = buildHuntingCandidate(payload, opportunity.id);

      if (!candidate.name) {
        sendError(response, 422, 'Informe o candidato.');
        return;
      }
      if (!opportunity.opportunity) {
        sendError(response, 422, 'Informe o perfil.');
        return;
      }
      if (!opportunity.clientId || !db.clients.some((client) => client.id === opportunity.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }

      db.opportunities.push(opportunity);
      db.candidates.push(candidate);
      await writeDatabase(db);
      sendJson(response, 201, { opportunity, candidate: enrichCandidate(candidate, db) });
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/huntings/')) {
      const opportunityId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const opportunity = db.opportunities.find((item) => item.id === opportunityId && item.model === 'Hunting');

      if (!opportunity) {
        sendError(response, 404, 'Hunting nao encontrado.');
        return;
      }

      const updatedOpportunity = buildHuntingOpportunity(payload, db, opportunity);
      const candidate = findHuntingCandidate(db, opportunity.id, String(payload.candidateId ?? ''));
      const updatedCandidate = buildHuntingCandidate(payload, opportunity.id, candidate);

      if (!updatedCandidate.name) {
        sendError(response, 422, 'Informe o candidato.');
        return;
      }
      if (!updatedOpportunity.opportunity) {
        sendError(response, 422, 'Informe o perfil.');
        return;
      }
      if (!updatedOpportunity.clientId || !db.clients.some((client) => client.id === updatedOpportunity.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }

      Object.assign(opportunity, updatedOpportunity);
      if (candidate) Object.assign(candidate, updatedCandidate);
      else db.candidates.push(updatedCandidate);

      await writeDatabase(db);
      sendJson(response, 200, {
        opportunity,
        candidate: enrichCandidate(candidate ?? updatedCandidate, db)
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/cv-filters') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const filter = normalizeCvFilter({
        id: createId('cvf', payload.jobDescription || payload.opportunityId),
        ...payload,
        createdAt: toISODate()
      });

      if (!filter.opportunityId || !db.opportunities.some((opportunity) => opportunity.id === filter.opportunityId)) {
        sendError(response, 422, 'Selecione uma oportunidade valida.');
        return;
      }
      if (!filter.jobDescription) {
        sendError(response, 422, 'Informe a job_description.');
        return;
      }

      db.cvFilters.push(filter);
      await writeDatabase(db);
      sendJson(response, 201, enrichCvFilter(filter, db));
      return;
    }

    if (request.method === 'POST' && pathname.startsWith('/api/cv-filters/') && pathname.endsWith('/search')) {
      const filterId = pathname.split('/').at(-2);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const filter = db.cvFilters.find((item) => item.id === filterId);

      if (!filter) {
        sendError(response, 404, 'Filtro de CV nao encontrado.');
        return;
      }
      const runtimeFilter = normalizeCvFilter({
        ...filter,
        ...payload,
        id: filter.id,
        createdAt: filter.createdAt
      });

      const credentials = getApinfoCredentials();
      const ruleSummary = [
        `palavras-chave APINFO: ${runtimeFilter.mandatorySkills || 'nao informadas'}`,
        `estado: ${runtimeFilter.state || 'nao informado'}`,
        `cidade: ${runtimeFilter.city || 'nao informada'}`,
        `nivel de ingles: ${runtimeFilter.englishLevel || 'nao informado'}`,
        `Job Description com aderencia minima de ${runtimeFilter.matchPercent || 0}%`,
        `fontes: ${enabledSearchSources(runtimeFilter).join(', ') || 'nenhuma'}`
      ].join('; ');
      const searchResponse = {
        ...enrichCvFilter(runtimeFilter, db),
        searchSource: 'APINFO',
        searchExecutedAt: toISODate(),
        searchStatus: 'running',
        searchMessage: `Busca APINFO em andamento. Regra: ${ruleSummary}.`,
        searchResults: [],
        searchRejectedResults: []
      };

      if (!enabledSearchSources(runtimeFilter).length) {
        searchResponse.searchStatus = 'no_sources';
        searchResponse.searchMessage = `Nenhuma fonte de busca selecionada. Regra: ${ruleSummary}.`;
      } else if (runtimeFilter.searchApinfo && !credentials.configured) {
        searchResponse.searchStatus = 'pending_credentials';
        searchResponse.searchMessage = `Busca real no APINFO pendente de usuario e senha. Regra: ${ruleSummary}.`;
      } else {
        const requestedLimit = runtimeFilter.resultLimit || 10;

        const shouldSearchApinfo = runtimeFilter.searchApinfo && credentials.configured;
        const apinfoBlocked = runtimeFilter.searchApinfo && !credentials.configured;

        const shouldSearchApinfoLinkedin = shouldSearchApinfo || runtimeFilter.searchLinkedin;

        let search = {
          keyword: runtimeFilter.mandatorySkills || '',
          totalFound: 0,
          inspected: [],
          linkedinQuery: '',
          linkedinFound: 0,
          linkedinProvider: '',
          linkedinError: '',
          results: [],
          rejectedResults: []
        };

        if (shouldSearchApinfoLinkedin) {
          search = await searchApinfoAndLinkedinCandidates(
            {
              ...runtimeFilter,
              searchApinfo: shouldSearchApinfo
            },
            credentials,
            requestedLimit
          );
        }

        const alcateiaSearch = runtimeFilter.searchAlcateia
          ? await searchAlcateiaCandidates(runtimeFilter, requestedLimit)
          : {
              totalFound: 0,
              results: [],
              rejectedResults: [],
              message: 'ALCATEIA desmarcado.'
            };

        const mergedResults = [
          ...search.results,
          ...alcateiaSearch.results
        ].map((result) => enrichCvSearchResultWithCurriculum(result, db));

        const mergedRejectedResults = [
          ...search.rejectedResults,
          ...alcateiaSearch.rejectedResults
        ].map((result) => enrichCvSearchResultWithCurriculum(result, db));

        searchResponse.searchStatus = 'completed';

        const apinfoSummary = runtimeFilter.searchApinfo
          ? (
              apinfoBlocked
                ? 'APINFO marcado, mas credenciais não configuradas.'
                : `APINFO chave "${search.keyword}", encontrados: ${search.totalFound}.`
            )
          : 'APINFO desmarcado.';

        const linkedinSummary = runtimeFilter.searchLinkedin
          ? (
              search.linkedinError
                ? ` Google/LinkedIn: ${search.linkedinError}`
                : ` Google/LinkedIn via ${search.linkedinProvider}: consulta "${search.linkedinQuery}" retornou ${search.linkedinFound} perfil(is) para análise.`
            )
          : ' Google/LinkedIn desmarcado.';

        const alcateiaSummary = runtimeFilter.searchAlcateia
          ? ` ${alcateiaSearch.message}`
          : ' ALCATEIA desmarcado.';

        searchResponse.searchMessage = [
          'Busca concluída.',
          apinfoSummary,
          `Resultados aprovados: ${mergedResults.length}.`,
          `Rejeitados abaixo do percentual: ${mergedRejectedResults.length}.`,
          linkedinSummary,
          alcateiaSummary,
          `Regra: ${ruleSummary}.`
        ].join(' ');

        searchResponse.searchResults = mergedResults;
        searchResponse.searchRejectedResults = mergedRejectedResults;
      }

      sendJson(response, 200, searchResponse);
      return;
    }

    if (request.method === 'DELETE' && /^\/api\/cv-filters\/[^/]+$/.test(pathname)) {
      const filterId = pathname.split('/').at(-1);
      const db = await readDatabase();
      const initialLength = db.cvFilters.length;
      db.cvFilters = db.cvFilters.filter((filter) => filter.id !== filterId);

      if (db.cvFilters.length === initialLength) {
        sendError(response, 404, 'Filtro de CV nao encontrado.');
        return;
      }

      db.selectedCandidates = db.selectedCandidates.map((candidate) => (
        candidate.cvFilterId === filterId ? { ...candidate, cvFilterId: '', updatedAt: toISODate() } : candidate
      ));
      await writeDatabase(db);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/selected-candidates/message') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const opportunityId = String(payload.opportunityId ?? '').trim();
      const candidateMessage = String(payload.candidateMessage ?? '').trim();
      const candidates = db.selectedCandidates.filter((candidate) => candidate.opportunityId === opportunityId);

      if (!opportunityId || !db.opportunities.some((opportunity) => opportunity.id === opportunityId)) {
        sendError(response, 422, 'Selecione uma oportunidade valida.');
        return;
      }
      if (!candidates.length) {
        sendError(response, 404, 'Nenhum candidato selecionado para esta oportunidade.');
        return;
      }

      for (const candidate of candidates) {
        candidate.candidateMessage = candidateMessage;
        candidate.updatedAt = toISODate();
      }

      await writeDatabase(db);
      sendJson(response, 200, candidates.map((candidate) => enrichSelectedCandidate(candidate, db)));
      return;
    }

    if (
      request.method === 'POST'
      && (
        ['/api/selected-candidates/send-test', '/api/selected-candidates/send', '/api/selected-candidates/send-message'].includes(pathname)
        || /^\/api\/selected-candidates\/.*(?:send|enviar)/i.test(pathname)
      )
    ) {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const ids = Array.isArray(payload.ids) ? payload.ids.map((id) => String(id)) : [];
      const candidates = db.selectedCandidates.filter((candidate) => ids.includes(candidate.id));
      const credentials = getApinfoCredentials();
      const candidateMessage = String(payload.candidateMessage ?? candidates[0]?.candidateMessage ?? '').trim();

      if (!candidates.length) {
        sendError(response, 422, 'Selecione pelo menos um candidato para enviar.');
        return;
      }

      const foundRows = [];
      const missingRows = [];

      for (const candidate of candidates) {
        const emails = await extractCandidateEmails(candidate, credentials);
        if (emails.length) {
          foundRows.push({
            id: candidate.id,
            name: candidate.name,
            link: candidate.link,
            emails
          });
        } else {
          missingRows.push({
            id: candidate.id,
            name: candidate.name,
            link: candidate.link
          });
        }
      }

      const subject = 'Teste de envio - candidatos selecionados';
      const body = buildCandidateEmailBody(foundRows, missingRows, candidateMessage);
      const smtpConfig = getSmtpConfigFromEnv();
      const mailto = buildCandidateMailto(smtpConfig.testTo, subject, body);

      if (smtpConfig.configured) {
        await sendMail({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          user: smtpConfig.user,
          password: smtpConfig.password,
          from: smtpConfig.from,
          to: smtpConfig.testTo,
          subject,
          text: body
        });
      }

      sendJson(response, 200, {
        to: smtpConfig.testTo,
        found: foundRows,
        missing: missingRows,
        mailto,
        sent: smtpConfig.configured,
        delivery: smtpConfig.configured ? 'smtp' : 'mailto',
        smtpConfigured: smtpConfig.configured
      });
      return;
    }

    if (request.method === 'POST' && /^\/api\/selected-candidates\/[^/]+\/advance$/.test(pathname)) {
      const candidateId = pathname.split('/').at(-2);
      const db = await readDatabase();
      const candidate = advanceSelectedCandidateToInterview(db, candidateId);

      await writeDatabase(db);
      sendJson(response, 200, enrichCandidate(candidate, db));
      return;
    }

    if (request.method === 'DELETE' && /^\/api\/selected-candidates\/[^/]+$/.test(pathname)) {
      const candidateId = pathname.split('/').at(-1);
      const db = await readDatabase();
      const initialLength = db.selectedCandidates.length;
      db.selectedCandidates = db.selectedCandidates.filter((candidate) => candidate.id !== candidateId);

      if (db.selectedCandidates.length === initialLength) {
        sendError(response, 404, 'Candidato selecionado nao encontrado.');
        return;
      }

      await writeDatabase(db);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/candidate-pool') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const item = normalizeCandidatePool({
        id: createId('pool', payload.candidateName || payload.clientId),
        ...payload,
        createdAt: toISODate()
      });

      if (!item.clientId || !db.clients.some((client) => client.id === item.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }
      if (!item.candidateName) {
        sendError(response, 422, 'Informe o nome do candidato.');
        return;
      }
      if (!CANDIDATE_POOL_PROFILES.includes(item.profile)) {
        sendError(response, 422, 'Selecione um perfil valido.');
        return;
      }
      if (db.candidatePool.some((existing) => (
        existing.clientId === item.clientId
        && existing.candidateName.toLowerCase() === item.candidateName.toLowerCase()
      ))) {
        sendError(response, 422, 'Ja existe candidato no bolsao para este cliente.');
        return;
      }

      db.candidatePool.push(item);
      await writeDatabase(db);
      sendJson(response, 201, enrichCandidatePool(item, db));
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/candidate-pool/')) {
      const itemId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const item = db.candidatePool.find((candidatePoolItem) => candidatePoolItem.id === itemId);

      if (!item) {
        sendError(response, 404, 'Candidato do bolsao nao encontrado.');
        return;
      }

      const updated = normalizeCandidatePool({
        ...item,
        ...payload,
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: toISODate()
      });

      if (!updated.clientId || !db.clients.some((client) => client.id === updated.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }
      if (!updated.candidateName) {
        sendError(response, 422, 'Informe o nome do candidato.');
        return;
      }
      if (!CANDIDATE_POOL_PROFILES.includes(updated.profile)) {
        sendError(response, 422, 'Selecione um perfil valido.');
        return;
      }
      if (db.candidatePool.some((existing) => (
        existing.id !== item.id
        && existing.clientId === updated.clientId
        && existing.candidateName.toLowerCase() === updated.candidateName.toLowerCase()
      ))) {
        sendError(response, 422, 'Ja existe candidato no bolsao para este cliente.');
        return;
      }

      Object.assign(item, updated);
      await writeDatabase(db);
      sendJson(response, 200, enrichCandidatePool(item, db));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/selected-candidates') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const opportunityId = String(payload.opportunityId ?? '').trim();
      const cvFilterId = String(payload.cvFilterId ?? '').trim();
      const candidateMessage = String(payload.candidateMessage ?? '').trim();
      const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

      if (!opportunityId || !db.opportunities.some((opportunity) => opportunity.id === opportunityId)) {
        sendError(response, 422, 'Selecione uma oportunidade valida.');
        return;
      }
      if (!candidates.length) {
        sendError(response, 422, 'Selecione pelo menos um candidato.');
        return;
      }

      const saved = [];
      for (const candidatePayload of candidates) {
        const candidate = normalizeSelectedCandidate({
          ...candidatePayload,
          opportunityId,
          cvFilterId,
          candidateMessage,
          createdAt: candidatePayload.createdAt || toISODate()
        });
        const matchingCurriculum = findCurriculumForCandidateResult(db, candidate);
        candidate.curriculumId = candidate.curriculumId || matchingCurriculum?.id_controle || matchingCurriculum?.id || '';
        candidate.link = preferredExternalCandidateLink(candidate);

        if (!candidate.name) continue;

        const existing = db.selectedCandidates.find((item) => {
          if (item.opportunityId !== candidate.opportunityId) return false;
          if (candidate.link && item.link) return item.link === candidate.link;
          return item.name.toLowerCase() === candidate.name.toLowerCase();
        });

        if (existing) {
          Object.assign(existing, {
            ...candidate,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: toISODate()
          });
          saved.push(existing);
        } else {
          db.selectedCandidates.push(candidate);
          saved.push(candidate);
        }
      }

      if (!saved.length) {
        sendError(response, 422, 'Nenhum candidato valido foi selecionado.');
        return;
      }

      let mongoSaved = [];

      if (isMongoTalentosConfigured()) {
        try {
          const opportunity = db.opportunities.find((item) => item.id === opportunityId) || null;
          const cvFilter = db.cvFilters.find((item) => item.id === cvFilterId) || null;

          mongoSaved = await upsertSelectedCandidatesIntoMongo({
            candidates: saved,
            opportunity,
            cvFilter,
            user: auth.user
          });
        } catch (error) {
          sendError(response, 500, `Candidatos selecionados nao foram gravados no MongoDB. Detalhe: ${error.message}`);
          return;
        }
      }

      await writeDatabase(db);

      const responsePayload = saved.map((candidate, index) => {
        const enriched = enrichSelectedCandidate(candidate, db);
        const mongoCandidate = mongoSaved[index];

        return {
          ...enriched,
          savedToMongo: Boolean(mongoCandidate),
          mongoId: mongoCandidate?.mongoId || '',
          curriculumId: mongoCandidate?.id_controle || mongoCandidate?.id || enriched.curriculumId || ''
        };
      });

      sendJson(response, 201, responsePayload);
      return;
      }

      if ((request.method === 'PATCH' || request.method === 'POST') && /^\/api\/cv-filters\/[^/]+$/.test(pathname)) {
      const filterId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const filter = db.cvFilters.find((item) => item.id === filterId);

      if (!filter) {
        sendError(response, 404, 'Filtro de CV nao encontrado.');
        return;
      }

      const updated = normalizeCvFilter({
        ...filter,
        ...payload,
        id: filter.id,
        createdAt: filter.createdAt,
        updatedAt: toISODate()
      });

      if (!updated.opportunityId || !db.opportunities.some((opportunity) => opportunity.id === updated.opportunityId)) {
        sendError(response, 422, 'Selecione uma oportunidade valida.');
        return;
      }
      if (!updated.jobDescription) {
        sendError(response, 422, 'Informe a job_description.');
        return;
      }

      Object.assign(filter, updated);
      await writeDatabase(db);
      sendJson(response, 200, enrichCvFilter(filter, db));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/curriculums') {
      const payload = await readJsonBody(request);

      if (isMongoTalentosConfigured()) {
        try {
          const curriculum = await createCurriculumInMongo(payload);
          sendJson(response, 201, curriculum);
          return;
        } catch (error) {
          if (/Ja existe/.test(error.message || '')) {
            sendError(response, 409, error.message);
            return;
          }
          throw error;
        }
      }

      const db = await readDatabase();
      const curriculum = normalizeCurriculum({
        id: createId('curr', payload.nome || payload.email),
        ...payload,
        data_criacao: payload.data_criacao || toISODate()
      });

      if (!curriculum.nome) {
        sendError(response, 422, 'Informe o nome do curriculo.');
        return;
      }
      if (curriculum.email && db.curriculums.some((item) => item.email.toLowerCase() === curriculum.email.toLowerCase())) {
        sendError(response, 409, 'Ja existe um curriculo com esse e-mail.');
        return;
      }
      if (db.curriculums.some((item) => item.id_controle === curriculum.id_controle)) {
        sendError(response, 409, 'Ja existe um curriculo com esse id_controle.');
        return;
      }

      db.curriculums.push(curriculum);
      await writeDatabase(db);
      sendJson(response, 201, curriculum);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/candidates') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const timestamp = toISODate();
      const stage = normalizeStage(payload.stage || 'Triagem');
      const curriculum = db.curriculums.find((item) => item.id === String(payload.curriculumId ?? '') || item.id_controle === String(payload.curriculumId ?? ''));
      const candidate = {
        id: createId('cand', payload.name || curriculum?.nome),
        name: String(payload.name ?? curriculum?.nome ?? '').trim(),
        curriculumId: String(payload.curriculumId ?? payload.idNome ?? '').trim(),
        opportunityId: String(payload.opportunityId ?? '').trim(),
        hourlyRate: Number(payload.hourlyRate ?? 0),
        observation: String(payload.observation ?? '').trim(),
        approved: isApprovedValue(payload.approved) || stage === 'Aprovado',
        stage,
        aderencia: normalizeAderencia(payload.aderencia ?? 50),
        source: String(payload.source ?? '').trim(),
        notes: String(payload.notes ?? '').trim(),
        status: stage === 'Aprovado' || stage === 'Reprovado' ? stage : 'Em andamento',
        stageEnteredAt: timestamp,
        createdAt: timestamp,
        stageHistory: [
          {
            stage,
            enteredAt: timestamp,
            leftAt: ''
          }
        ]
      };

      if (!candidate.name) {
        sendError(response, 422, 'Informe o nome do candidato.');
        return;
      }
      if (candidate.curriculumId && !curriculum) {
        sendError(response, 422, 'Selecione um curriculo valido.');
        return;
      }
      if (!candidate.opportunityId || !db.opportunities.some((opportunity) => opportunity.id === candidate.opportunityId)) {
        sendError(response, 422, 'Selecione uma oportunidade valida.');
        return;
      }

      db.candidates.push(candidate);
      const placement = syncApprovedCandidatePlacement(candidate, db);
      await writeDatabase(db);
      sendJson(response, 201, {
        ...enrichCandidate(candidate, db),
        placement
      });
      return;
    }

    if (request.method === 'POST' && /^\/api\/candidates\/[^/]+\/select$/.test(pathname)) {
      const candidateId = pathname.split('/').at(-2);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const candidate = db.candidates.find((item) => item.id === candidateId);

      if (!candidate) {
        sendError(response, 404, 'Candidato nao encontrado.');
        return;
      }

      const curriculum = db.curriculums.find((item) => item.id === candidate.curriculumId || item.id_controle === candidate.curriculumId);
      const opportunity = db.opportunities.find((item) => item.id === candidate.opportunityId);
      const clientId = String(payload.clientId ?? opportunity?.clientId ?? '').trim();
      const allocated = normalizeAllocated({
        id: createId('alloc', payload.code || candidate.name),
        externalId: payload.externalId,
        code: payload.code,
        consultant: payload.consultant || candidate.name,
        skill: payload.skill || curriculum?.skills || candidate.observation,
        clientId,
        hourlyRate: payload.hourlyRate ?? candidate.hourlyRate,
        phone: payload.phone || curriculum?.telefone,
        consultantEmail: payload.consultantEmail || curriculum?.email,
        startDate: payload.startDate,
        active: payload.active === undefined ? true : payload.active,
        endDate: payload.endDate,
        manager: payload.manager,
        managerEmail: payload.managerEmail,
        managerPhone: payload.managerPhone,
        candidateId: candidate.id,
        curriculumId: candidate.curriculumId,
        opportunityId: candidate.opportunityId,
        createdAt: toISODate()
      });

      if (!allocated.code) {
        sendError(response, 422, 'Informe o codigo do alocado.');
        return;
      }
      if (!allocated.consultant) {
        sendError(response, 422, 'Informe o consultor.');
        return;
      }
      if (!allocated.clientId || !db.clients.some((client) => client.id === allocated.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }

      moveCandidateStage(candidate, 'Aprovado');
      candidate.approved = true;
      candidate.status = 'Aprovado';
      candidate.updatedAt = toISODate();

      db.allocateds.push(allocated);
      await writeDatabase(db);
      sendJson(response, 201, {
        candidate: enrichCandidate(candidate, db),
        allocated: enrichAllocated(allocated, db)
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/allocateds') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const allocated = normalizeAllocated({
        id: createId('alloc', payload.code || payload.consultant),
        ...payload,
        createdAt: toISODate()
      });

      if (!allocated.code) {
        sendError(response, 422, 'Informe o codigo do alocado.');
        return;
      }
      if (!allocated.consultant) {
        sendError(response, 422, 'Informe o consultor.');
        return;
      }
      if (!allocated.clientId || !db.clients.some((client) => client.id === allocated.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }

      db.allocateds.push(allocated);
      await writeDatabase(db);
      sendJson(response, 201, enrichAllocated(allocated, db));
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/allocateds/')) {
      const allocatedId = decodeURIComponent(pathname.split('/').at(-1));
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const allocated = db.allocateds.find((item) => item.id === allocatedId);

      if (!allocated) {
        sendError(response, 404, 'Alocado nao encontrado.');
        return;
      }

      const updated = normalizeAllocated({
        ...allocated,
        ...payload,
        id: allocated.id,
        createdAt: allocated.createdAt,
        updatedAt: toISODate()
      });

      if (!updated.code) {
        sendError(response, 422, 'Informe o codigo do alocado.');
        return;
      }
      if (!updated.consultant) {
        sendError(response, 422, 'Informe o consultor.');
        return;
      }
      if (!updated.clientId || !db.clients.some((client) => client.id === updated.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }

      Object.assign(allocated, updated);
      await writeDatabase(db);
      sendJson(response, 200, enrichAllocated(allocated, db));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/allocateds/export-documents') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const allocatedIds = Array.isArray(payload.allocatedIds)
        ? payload.allocatedIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      const templateIds = Array.isArray(payload.templateIds)
        ? payload.templateIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];

      if (!allocatedIds.length) {
        sendError(response, 422, 'Selecione ao menos um alocado.');
        return;
      }

      const selected = db.allocateds.filter((allocated) => allocatedIds.includes(allocated.id));
      if (!selected.length) {
        sendError(response, 404, 'Nenhum alocado encontrado para gerar formularios.');
        return;
      }

      const documents = await renderAllocatedDocuments(selected, db.clients, templateIds, ALLOCATED_TEMPLATE_DIR);
      if (documents.length === 1) {
        const document = documents[0];
        response.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${document.filename}"`,
          'Cache-Control': 'no-store'
        });
        response.end(document.content);
        return;
      }

      const archive = buildAllocatedDocumentsZip(documents);
      response.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="formularios-alocados-${new Date().toISOString().slice(0, 10)}.zip"`,
        'Cache-Control': 'no-store'
      });
      response.end(archive);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/rate-cards') {
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const rateCard = normalizeRateCard({
        id: createId('ratecard', payload.skill || payload.clientId),
        ...payload,
        createdAt: toISODate()
      });

      if (!rateCard.skill) {
        sendError(response, 422, 'Informe a skill do Rate Card.');
        return;
      }
      if (!Number.isFinite(rateCard.rate) || rateCard.rate <= 0) {
        sendError(response, 422, 'Informe uma taxa valida.');
        return;
      }
      if (!rateCard.clientId || !db.clients.some((client) => client.id === rateCard.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }
      if (db.rateCards.some((item) => item.clientId === rateCard.clientId && item.skill.toLowerCase() === rateCard.skill.toLowerCase())) {
        sendError(response, 422, 'Ja existe Rate Card para esta skill e cliente.');
        return;
      }

      db.rateCards.push(rateCard);
      await writeDatabase(db);
      sendJson(response, 201, enrichRateCard(rateCard, db));
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/rate-cards/')) {
      const rateCardId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const rateCard = db.rateCards.find((item) => item.id === rateCardId);

      if (!rateCard) {
        sendError(response, 404, 'Rate Card nao encontrado.');
        return;
      }

      const updated = normalizeRateCard({
        ...rateCard,
        ...payload,
        id: rateCard.id,
        createdAt: rateCard.createdAt,
        updatedAt: toISODate()
      });

      if (!updated.skill) {
        sendError(response, 422, 'Informe a skill do Rate Card.');
        return;
      }
      if (!Number.isFinite(updated.rate) || updated.rate <= 0) {
        sendError(response, 422, 'Informe uma taxa valida.');
        return;
      }
      if (!updated.clientId || !db.clients.some((client) => client.id === updated.clientId)) {
        sendError(response, 422, 'Selecione um cliente valido.');
        return;
      }
      if (db.rateCards.some((item) => (
        item.id !== rateCard.id
        && item.clientId === updated.clientId
        && item.skill.toLowerCase() === updated.skill.toLowerCase()
      ))) {
        sendError(response, 422, 'Ja existe Rate Card para esta skill e cliente.');
        return;
      }

      Object.assign(rateCard, updated);
      await writeDatabase(db);
      sendJson(response, 200, enrichRateCard(rateCard, db));
      return;
    }

    if (request.method === 'PATCH' && pathname.startsWith('/api/candidates/')) {
      const candidateId = pathname.split('/').at(-1);
      const payload = await readJsonBody(request);
      const db = await readDatabase();
      const candidate = db.candidates.find((item) => item.id === candidateId);

      if (!candidate) {
        sendError(response, 404, 'Candidato nao encontrado.');
        return;
      }

      if (payload.curriculumId !== undefined && String(payload.curriculumId ?? '').trim()) {
        const curriculumId = String(payload.curriculumId ?? '').trim();
        const curriculum = db.curriculums.find((item) => item.id === curriculumId || item.id_controle === curriculumId);
        if (!curriculum) {
          sendError(response, 422, 'Selecione um curriculo valido.');
          return;
        }
        candidate.curriculumId = curriculumId;
        candidate.name = String(payload.name ?? curriculum?.nome ?? candidate.name).trim();
      } else if (payload.name !== undefined) {
        candidate.name = String(payload.name ?? '').trim();
      }
      if (payload.opportunityId !== undefined) {
        candidate.opportunityId = String(payload.opportunityId ?? '').trim();
        if (!candidate.opportunityId || !db.opportunities.some((opportunity) => opportunity.id === candidate.opportunityId)) {
          sendError(response, 422, 'Selecione uma oportunidade valida.');
          return;
        }
      }
      if (payload.hourlyRate !== undefined) {
        candidate.hourlyRate = Number(payload.hourlyRate ?? 0);
      }
      if (payload.observation !== undefined) {
        candidate.observation = String(payload.observation ?? '').trim();
      }
      if (payload.approved !== undefined) {
        candidate.approved = isApprovedValue(payload.approved);
      }
      if (payload.stage && payload.stage !== candidate.stage) {
        moveCandidateStage(candidate, payload.stage);
      }
      if (payload.aderencia !== undefined) {
        candidate.aderencia = normalizeAderencia(payload.aderencia);
      }
      if (payload.notes !== undefined) {
        candidate.notes = String(payload.notes).trim();
      }
      if (!candidate.name) {
        sendError(response, 422, 'Informe o nome do candidato.');
        return;
      }
      if (candidate.stage === 'Aprovado') {
        candidate.approved = true;
      }
      candidate.updatedAt = toISODate();
      const placement = syncApprovedCandidatePlacement(candidate, db);

      await writeDatabase(db);
      sendJson(response, 200, {
        ...enrichCandidate(candidate, db),
        placement
      });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/uploads') {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const filename = request.headers['x-file-name'];
      const safeName = String(filename || `curriculo-${Date.now()}.txt`)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const targetName = `${Date.now()}-${safeName || 'arquivo'}`;
      const targetPath = path.join(UPLOAD_DIR, targetName);
      const chunks = [];

      for await (const chunk of request) {
        chunks.push(chunk);
      }

      await fs.writeFile(targetPath, Buffer.concat(chunks));
      sendJson(response, 201, {
        filename: targetName,
        url: `/uploads/${targetName}`
      });
      return;
    }

    sendError(response, 404, 'Rota nao encontrada.');
  } catch (error) {
    const message = error.message || 'Erro interno.';
    const isValidationError = /invalida|invalido/.test(message);
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : (isValidationError ? 422 : 500);
    sendError(response, statusCode, message);
  }
}

const server = http.createServer((request, response) => {
  if (request.url?.startsWith('/api/')) {
    handleApi(request, response);
    return;
  }

  serveStatic(request, response);
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
  console.log(`Gestão do Negócio Alcateia MVP em http://localhost:${PORT}`);
  });
}
