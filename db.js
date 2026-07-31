import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sanitizeUnicodeValue } from './text-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.join(__dirname, 'data', 'database.json');

export const CANDIDATE_STAGES = [
  'Triagem',
  'Entrevista Alcateia',
  'Entrevista tecnica/gestor',
  'Proposta',
  'Aprovado',
  'Reprovado'
];

export const CANDIDATE_ADERENCIA_OPTIONS = [0, 25, 50, 75, 100];

const LEGACY_CANDIDATE_STAGES = ['Inscrito', ...CANDIDATE_STAGES];

export const OPPORTUNITY_STATUSES = ['WON', 'LOST', 'Freezing', 'Closed', 'Open'];
export const OPPORTUNITY_MODELS = ['Alocação', 'Hunting', 'Projeto', 'Consultoria'];
export const BRAZIL_UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO'
];

const LEGACY_OPPORTUNITY_STATUS_MAP = {
  Aberta: 'Open',
  Pausada: 'Freezing',
  Fechada: 'Closed',
  Cancelada: 'LOST'
};

const LEGACY_OPPORTUNITY_MODEL_MAP = {
  Alocacao: 'Alocação',
  Remoto: 'Alocação',
  Hibrido: 'Alocação',
  'Híbrido': 'Alocação',
  'Sao Paulo / Hibrido': 'Alocação',
  'São Paulo / Híbrido': 'Alocação'
};

const REQUIRED_COLLECTIONS = [
  'clients',
  'users',
  'opportunities',
  'faturamento',
  'formDefinitions',
  'formRequests',
  'formRequestObservations',
  'curriculums',
  'candidates',
  'allocateds',
  'workHours',
  'workHourClosures',
  'businessCalendar',
  'rateCards',
  'statusReports',
  'candidatePool',
  'contactClients',
  'cvFilters',
  'curriculumObservations',
  'selectedCandidates'
];

export const MONGO_APP_COLLECTIONS = REQUIRED_COLLECTIONS.filter((collection) => collection !== 'curriculums');

function emptyDatabase() {
  return Object.fromEntries(REQUIRED_COLLECTIONS.map((collection) => [collection, []]));
}

const DEFAULT_RATE_CARD_CLIENT_NAME = 'Totvs';
const DEFAULT_RATE_CARDS = [
  ['PROTHEUS', 113],
  ['RM', 113],
  ['FLUIG', 118.5],
  ['DATASUL', 113],
  ['SIGAEIC', 185],
  ['ADVPL', 122.5],
  ['DBA', 128],
  ['SAUDE', 135],
  ['HOSPITALIDADE', 124],
  ['PO', 172.5],
  ['SCRUM MASTER', 155.5],
  ['FRONT BACK LIVE', 164.5],
  ['FULLSTACK LIVE', 172.5],
  ['QA', 149],
  ['UX', 133],
  ['DEV.NET CORE N1', 85],
  ['DEV.NET CORE N2', 102],
  ['SUPORTE N2', 47.5],
  ['SUPORTE N3', 60]
];

export const CANDIDATE_POOL_PROFILES = ['Técnico', 'Funcional'];
export const CANDIDATE_POOL_STATUSES = ['Ativo', 'Inativo', 'Alocado'];
export const CANDIDATE_POOL_SKILL_FIELDS = [
  ['protheusFinanceiro', 'Protheus Financeiro'],
  ['protheusFiscal', 'Protheus Fiscal'],
  ['protheusContabil', 'Protheus Contábil'],
  ['protheusCompras', 'Protheus Compras'],
  ['protheusEstoque', 'Protheus Estoque'],
  ['protheusFaturamento', 'Protheus Faturamento'],
  ['protheusPcp', 'Protheus PCP'],
  ['protheusRh', 'Protheus RH'],
  ['rmFolha', 'RM Folha'],
  ['rmPonto', 'RM Ponto'],
  ['rmContabil', 'RM Contábil'],
  ['rmFiscal', 'RM Fiscal'],
  ['rmFinanceiro', 'RM Financeiro'],
  ['rmEducacional', 'RM Educacional'],
  ['datasulManufatura', 'Datasul Manufatura'],
  ['datasulPcp', 'Datasul PCP'],
  ['datasulWms', 'Datasul WMS'],
  ['datasulCq', 'Datasul CQ'],
  ['fluigBpm', 'Fluig BPM'],
  ['fluigEcm', 'Fluig ECM'],
  ['fluigFormularios', 'Fluig Formulários'],
  ['fluigIntegracoes', 'Fluig Integrações'],
  ['tecnicoAdvpl', 'Técnico ADVPL'],
  ['scrumMaster', 'Scrum Master']
];

const DEFAULT_CANDIDATE_POOL_CLIENT_NAME = 'TOTVS';
const DEFAULT_CANDIDATE_POOL = [
  {
    candidateName: 'Alexandre Takeo',
    profile: 'Funcional',
    hourlyRate: 79,
    agreementDate: '2026-05-15',
    active: true,
    protheusFinanceiro: true,
    protheusFiscal: true,
    protheusContabil: true,
    protheusCompras: true,
    protheusEstoque: true,
    protheusFaturamento: true,
    protheusPcp: true,
    protheusRh: true
  },
  {
    candidateName: 'Jean Valóes',
    profile: 'Funcional',
    hourlyRate: 79,
    agreementDate: '2026-05-22',
    active: true,
    protheusFinanceiro: true,
    protheusFiscal: true,
    protheusContabil: true,
    protheusCompras: true,
    protheusEstoque: true,
    protheusFaturamento: true,
    protheusPcp: true
  },
  {
    candidateName: 'Roberto Teixeira',
    profile: 'Técnico',
    hourlyRate: 85,
    agreementDate: '2026-05-22',
    active: true,
    tecnicoAdvpl: true
  },
  {
    candidateName: 'Fábio Ricardo Costa',
    profile: 'Funcional',
    hourlyRate: 79,
    agreementDate: '2026-05-27',
    active: true,
    protheusFinanceiro: true,
    protheusFiscal: true,
    protheusContabil: true,
    protheusCompras: true,
    protheusEstoque: true,
    protheusFaturamento: true,
    protheusPcp: true
  },
  {
    candidateName: 'Jefferson Ribeiro dos Reis',
    profile: 'Funcional',
    hourlyRate: 80,
    agreementDate: '2026-05-27',
    active: true
  }
];

let mongoAppClient = null;
let mongoAppClientUrl = '';
let MongoClientCtor = null;
const mongoAppCollectionsDataCache = new Map();

async function loadMongoDriver() {
  if (MongoClientCtor) return { MongoClient: MongoClientCtor };
  try {
    const driver = await import('mongodb');
    MongoClientCtor = driver.MongoClient;
    return { MongoClient: MongoClientCtor };
  } catch {
    throw new Error('Dependencia mongodb nao instalada. Rode npm install antes de usar MongoDB.');
  }
}

function isProductionRuntime(env = process.env) {
  return [
    env.RENDER_SERVICE_NAME,
    env.RENDER_EXTERNAL_HOSTNAME,
    env.RENDER_EXTERNAL_URL,
    env.APP_BASE_URL,
    env.NODE_ENV
  ].some((value) => /rpa-banco-talentos-5v5r|onrender\.com|production/i.test(String(value || '')));
}

function readMongoAppConfig(env = process.env) {
  const hasMongoUrl = Boolean(env.MONGODB_URL || env.MONGODB_URI);
  return {
    enabled: env.MONGODB_APP_COLLECTIONS !== 'false',
    required: env.MONGODB_APP_REQUIRED === 'false'
      ? false
      : env.MONGODB_APP_REQUIRED === 'true' || isProductionRuntime(env) || hasMongoUrl,
    url: env.MONGODB_URL || env.MONGODB_URI || '',
    dbName: env.MONGODB_DB || 'Banco_de_Talentos',
    prefix: env.MONGODB_APP_COLLECTION_PREFIX || ''
  };
}

export function isMongoAppDatabaseConfigured(env = process.env) {
  const config = readMongoAppConfig(env);
  return Boolean(config.enabled && config.url && config.dbName);
}

function shouldUseMongoAppDatabase(file = DATA_FILE) {
  return path.resolve(file) === path.resolve(DATA_FILE) && isMongoAppDatabaseConfigured();
}

function mongoAppCollectionName(collection, config = readMongoAppConfig()) {
  return `${config.prefix}${collection}`;
}

async function getMongoAppClient(config = readMongoAppConfig()) {
  if (mongoAppClient && mongoAppClientUrl === config.url) {
    return mongoAppClient;
  }

  if (mongoAppClient) {
    await mongoAppClient.close().catch(() => null);
  }

  const { MongoClient } = await loadMongoDriver();
  mongoAppClient = new MongoClient(config.url, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 30000
  });
  await mongoAppClient.connect();
  await mongoAppClient.db('admin').command({ ping: 1 });
  mongoAppClientUrl = config.url;
  return mongoAppClient;
}

function stripMongoInternalFields(doc = {}) {
  const { _id, ...cleanDoc } = doc;
  return cleanDoc;
}

function idSlug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'item';
}

function deterministicRateCardId(clientId, skill) {
  return `ratecard_${idSlug(clientId)}_${idSlug(skill)}`;
}

function deterministicCandidatePoolId(clientId, candidateName) {
  return `pool_${idSlug(clientId)}_${idSlug(candidateName)}`;
}

function rateCardMaximum(rate) {
  const value = Number(rate || 0) * 0.7;
  return Number(value.toFixed(2));
}

function comparableClientName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function mergeClientTextField(target, source, field) {
  const current = String(target[field] ?? '').trim();
  const incoming = String(source[field] ?? '').trim();
  if (!incoming) return;
  if (!current) {
    target[field] = incoming;
    return;
  }

  const currentParts = current.split('|').map((part) => part.trim()).filter(Boolean);
  if (!currentParts.some((part) => part.toLowerCase() === incoming.toLowerCase())) {
    target[field] = `${current} | ${incoming}`;
  }
}

function clientReferenceCount(data, clientId) {
  const referencedCollections = ['opportunities', 'contactClients', 'allocateds', 'rateCards', 'candidatePool'];
  return referencedCollections.reduce((total, collection) => (
    total + (data[collection] ?? []).filter((item) => item.clientId === clientId).length
  ), 0);
}

function mergeDuplicateClients(data) {
  const clientGroups = new Map();
  const clientsWithoutKey = [];

  for (const client of data.clients) {
    const key = comparableClientName(client.customerName ?? client.name);
    if (!key) {
      clientsWithoutKey.push(client);
      continue;
    }

    if (!clientGroups.has(key)) clientGroups.set(key, []);
    clientGroups.get(key).push(client);
  }

  const clientIdMap = new Map();
  const mergedClients = [...clientsWithoutKey];

  for (const clients of clientGroups.values()) {
    if (clients.length === 1) {
      mergedClients.push(clients[0]);
      continue;
    }

    const canonical = clients
      .slice()
      .sort((first, second) => clientReferenceCount(data, second.id) - clientReferenceCount(data, first.id))[0];

    for (const client of clients) {
      if (client === canonical) continue;
      if (client.id && canonical.id) clientIdMap.set(client.id, canonical.id);
      for (const field of ['primaryContactName', 'primaryContactEmail', 'primaryContactPhone', 'observation']) {
        mergeClientTextField(canonical, client, field);
      }
      if (!canonical.managerContactId && client.managerContactId) {
        canonical.managerContactId = client.managerContactId;
      }
    }

    mergedClients.push(canonical);
  }

  if (!clientIdMap.size) return;

  data.clients = mergedClients;
  for (const collection of ['opportunities', 'contactClients', 'allocateds', 'rateCards', 'candidatePool']) {
    data[collection] = (data[collection] ?? []).map((item) => ({
      ...item,
      clientId: clientIdMap.get(item.clientId) ?? item.clientId
    }));
  }
}

function ensureDefaultRateCards(data) {
  const targetClientName = comparableClientName(DEFAULT_RATE_CARD_CLIENT_NAME);
  let client = data.clients.find((item) => comparableClientName(item.customerName ?? item.name) === targetClientName);

  if (!client) {
    client = {
      id: 'client_totvs',
      customerName: DEFAULT_RATE_CARD_CLIENT_NAME,
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      observation: 'Cliente criado automaticamente para Rate Cards.',
      createdAt: toISODate()
    };
    data.clients.push(client);
  }

  const existingKeys = new Set(
    data.rateCards.map((item) => `${String(item.clientId || '').trim()}::${idSlug(item.skill)}`)
  );

  for (const [skill, rate] of DEFAULT_RATE_CARDS) {
    const key = `${client.id}::${idSlug(skill)}`;
    if (existingKeys.has(key)) continue;

    data.rateCards.push(normalizeRateCard({
      id: deterministicRateCardId(client.id, skill),
      skill,
      rate,
      active: true,
      clientId: client.id,
      createdAt: toISODate()
    }));
    existingKeys.add(key);
  }
}

function ensureDefaultCandidatePool(data) {
  const targetClientName = comparableClientName(DEFAULT_CANDIDATE_POOL_CLIENT_NAME);
  let client = data.clients.find((item) => comparableClientName(item.customerName ?? item.name) === targetClientName);

  if (!client) {
    client = {
      id: 'client_totvs',
      customerName: 'Totvs',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      observation: 'Cliente criado automaticamente para Bolsão de Candidatos.',
      createdAt: toISODate()
    };
    data.clients.push(client);
  }

  const existingKeys = new Set(
    data.candidatePool.map((item) => `${String(item.clientId || '').trim()}::${idSlug(item.candidateName)}`)
  );

  for (const row of DEFAULT_CANDIDATE_POOL) {
    const key = `${client.id}::${idSlug(row.candidateName)}`;
    if (existingKeys.has(key)) continue;

    data.candidatePool.push(normalizeCandidatePool({
      id: deterministicCandidatePoolId(client.id, row.candidateName),
      clientId: client.id,
      createdAt: toISODate(),
      ...row
    }));
    existingKeys.add(key);
  }
}

export function normalizeDatabase(data = {}) {
  if (!data || typeof data !== 'object') {
    data = {};
  }
  data = sanitizeUnicodeValue(data);

  if (!Array.isArray(data.clients) && Array.isArray(data.companies)) {
    data.clients = data.companies.map((company) => ({
      id: company.id?.replace(/^comp_/, 'client_') ?? createId('client', company.name),
      customerName: company.name ?? '',
      primaryContactName: company.contactName ?? '',
      primaryContactEmail: company.contactEmail ?? '',
      primaryContactPhone: company.contactPhone ?? '',
      observation: company.segment ?? '',
      createdAt: company.createdAt ?? toISODate()
    }));
    delete data.companies;
  }

  if (!Array.isArray(data.opportunities) && Array.isArray(data.jobs)) {
    data.opportunities = data.jobs.map((job, index) => ({
      id: job.id?.replace(/^job_/, 'opp_') ?? createId('opp', job.title),
      clientId: job.clientId ?? job.companyId?.replace(/^comp_/, 'client_') ?? '',
      opportunity: job.title ?? '',
      opportunityCode: job.opportunityCode ?? `OPP-${String(index + 1).padStart(3, '0')}`,
      status: normalizeOpportunityStatus(LEGACY_OPPORTUNITY_STATUS_MAP[job.status] ?? job.status ?? 'Open'),
      openingDate: job.openedAt ?? '',
      closingDate: job.closedAt ?? '',
      monthYear: monthYearFromDate(job.openedAt),
      model: normalizeOpportunityModel(job.model ?? job.location ?? 'Alocação'),
      owner: job.owner ?? '',
      quantity: Number(job.quantity ?? 1),
      closedQuantity: Number(job.closedQuantity ?? 0),
      contractValue: Number(job.contractValue ?? 0),
      observation: [job.description, job.requirements ? `Requisitos: ${job.requirements}` : ''].filter(Boolean).join(' '),
      createdAt: job.createdAt ?? toISODate()
    }));
    delete data.jobs;
  }

  const legacyFaturamentoCollection = ['sa', 'les'].join('');
  if (!Array.isArray(data.faturamento) && Array.isArray(data[legacyFaturamentoCollection])) {
    data.faturamento = data[legacyFaturamentoCollection];
  }
  delete data[legacyFaturamentoCollection];

  if (!Array.isArray(data.rateCards)) {
    data.rateCards = Array.isArray(data.ratecard)
      ? data.ratecard
      : Array.isArray(data.ratecards)
        ? data.ratecards
        : [];
  }
  delete data.ratecard;
  delete data.ratecards;

  for (const collection of REQUIRED_COLLECTIONS) {
    if (!Array.isArray(data[collection])) {
      data[collection] = [];
    }
  }

  mergeDuplicateClients(data);
  data.clients = data.clients.map((client) => normalizeClient(client));

  data.opportunities = data.opportunities.map((opportunity) => ({
    ...opportunity,
    contactClientId: String(opportunity.contactClientId ?? opportunity.contatoClienteId ?? '').trim(),
    status: normalizeOpportunityStatus(LEGACY_OPPORTUNITY_STATUS_MAP[opportunity.status] ?? opportunity.status ?? 'Open'),
    model: normalizeOpportunityModel(opportunity.model ?? 'Alocação')
  }));
  data.faturamento = data.faturamento.map((item) => normalizeFaturamento(item));

  data.curriculums = data.curriculums.map((curriculum) => normalizeCurriculum(curriculum));
  data.candidates = data.candidates.map((candidate) => normalizeCandidate(candidate));
  syncCandidatesWithOpportunityClosures(data);
  data.allocateds = data.allocateds.map((allocated) => normalizeAllocated(allocated));
  data.workHours = data.workHours.map((entry) => normalizeWorkHourEntry(entry));
  data.workHourClosures = data.workHourClosures.map((closure) => normalizeWorkHourClosure(closure));
  data.businessCalendar = data.businessCalendar.map((entry) => normalizeBusinessCalendarEntry(entry));
  data.rateCards = data.rateCards.map((rateCard) => normalizeRateCard(rateCard));
  data.statusReports = data.statusReports.map((report) => normalizeStatusReport(report));
  ensureDefaultRateCards(data);
  data.candidatePool = data.candidatePool.map((item) => normalizeCandidatePool(item));
  ensureDefaultCandidatePool(data);
  data.contactClients = data.contactClients.map((contact) => normalizeContactClient(contact));
  data.cvFilters = data.cvFilters.map((filter) => normalizeCvFilter(filter));
  data.curriculumObservations = data.curriculumObservations.map((observation) => normalizeCurriculumObservation(observation));
  data.formRequestObservations = data.formRequestObservations.map((observation) => normalizeFormRequestObservation(observation));
  data.selectedCandidates = data.selectedCandidates.map((candidate) => normalizeSelectedCandidate(candidate));
  delete data.applications;

  return data;
}

export async function readLocalDatabase(file = DATA_FILE) {
  let content = '';
  try {
    content = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const initialData = emptyDatabase();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(initialData, null, 2)}\n`, 'utf8');
    content = JSON.stringify(initialData);
  }
  const data = JSON.parse(content);
  return normalizeDatabase(data);
}

export async function readMongoAppDatabase() {
  const config = readMongoAppConfig();
  const client = await getMongoAppClient(config);
  const mongoDb = client.db(config.dbName);
  const data = emptyDatabase();

  await Promise.all(MONGO_APP_COLLECTIONS.map(async (collection) => {
    data[collection] = await mongoDb
      .collection(mongoAppCollectionName(collection, config))
      .find({})
      .sort({ createdAt: 1, id: 1, _id: 1 })
      .toArray()
      .then((docs) => docs.map(stripMongoInternalFields));
  }));

  return normalizeDatabase(data);
}

export async function readMongoAppCollections(collections = MONGO_APP_COLLECTIONS) {
  const config = readMongoAppConfig();
  const client = await getMongoAppClient(config);
  const mongoDb = client.db(config.dbName);
  const data = emptyDatabase();
  const targetCollections = Array.from(new Set(collections))
    .filter((collection) => MONGO_APP_COLLECTIONS.includes(collection));

  await Promise.all(targetCollections.map(async (collection) => {
    data[collection] = await mongoDb
      .collection(mongoAppCollectionName(collection, config))
      .find({})
      .sort({ createdAt: 1, id: 1, _id: 1 })
      .toArray()
      .then((docs) => docs.map(stripMongoInternalFields));
  }));

  return normalizeDatabase(data);
}

async function hasMongoAppCollectionsData() {
  const config = readMongoAppConfig();
  const cacheKey = `${config.url}::${config.dbName}::${config.prefix}`;
  if (mongoAppCollectionsDataCache.has(cacheKey)) {
    return mongoAppCollectionsDataCache.get(cacheKey);
  }

  const client = await getMongoAppClient(config);
  const mongoDb = client.db(config.dbName);
  const hasData = (await mongoDb.collection(mongoAppCollectionName('users', config)).countDocuments({})) > 0;
  mongoAppCollectionsDataCache.set(cacheKey, hasData);
  return hasData;
}

export function buildMongoAppBulkWrite(rows = [], label = 'item') {
  const ids = [];
  const operations = [];

  for (const row of rows) {
    const cleanRow = stripMongoInternalFields(row);
    if (!cleanRow.id) {
      cleanRow.id = createId(label, cleanRow.name || cleanRow.customerName || cleanRow.opportunity || cleanRow.monthYear);
    }

    ids.push(cleanRow.id);
    operations.push({
      replaceOne: {
        filter: { id: cleanRow.id },
        replacement: cleanRow,
        upsert: true
      }
    });
  }

  return { ids, operations };
}

async function writeMongoAppCollections(data, collections = MONGO_APP_COLLECTIONS) {
  const config = readMongoAppConfig();
  const client = await getMongoAppClient(config);
  const mongoDb = client.db(config.dbName);
  const normalized = normalizeDatabase({ ...data, curriculums: [] });
  const targetCollections = collections.filter((collection) => MONGO_APP_COLLECTIONS.includes(collection));

  await Promise.all(targetCollections.map(async (collection) => {
    const mongoCollection = mongoDb.collection(mongoAppCollectionName(collection, config));
    const rows = Array.isArray(normalized[collection]) ? normalized[collection] : [];
    const { ids, operations } = buildMongoAppBulkWrite(rows, collection);

    if (operations.length) {
      await mongoCollection.bulkWrite(operations, { ordered: false });
    }

    if (ids.length) {
      await mongoCollection.deleteMany({ id: { $nin: ids } });
    } else {
      await mongoCollection.deleteMany({});
    }
  }));

  return normalized;
}

async function writeMongoAppDocument(collection, item) {
  if (!MONGO_APP_COLLECTIONS.includes(collection)) {
    throw new Error(`Colecao operacional invalida para MongoDB: ${collection}`);
  }

  const config = readMongoAppConfig();
  const client = await getMongoAppClient(config);
  const mongoDb = client.db(config.dbName);
  const cleanItem = stripMongoInternalFields(item);
  if (!cleanItem.id) {
    cleanItem.id = createId(collection, cleanItem.name || cleanItem.customerName || cleanItem.opportunity || cleanItem.monthYear);
  }

  await mongoDb
    .collection(mongoAppCollectionName(collection, config))
    .replaceOne({ id: cleanItem.id }, cleanItem, { upsert: true });

  return cleanItem;
}

async function deleteMongoAppDocument(collection, id) {
  if (!MONGO_APP_COLLECTIONS.includes(collection)) {
    throw new Error(`Colecao operacional invalida para MongoDB: ${collection}`);
  }

  const config = readMongoAppConfig();
  const client = await getMongoAppClient(config);
  const mongoDb = client.db(config.dbName);
  await mongoDb
    .collection(mongoAppCollectionName(collection, config))
    .deleteOne({ id });
}

export async function writeMongoAppDatabase(data) {
  return writeMongoAppCollections(data, MONGO_APP_COLLECTIONS);
}

export async function writeUserRecord(user, file = DATA_FILE) {
  const cleanUser = stripMongoInternalFields(user);
  const config = readMongoAppConfig();

  if (shouldUseMongoAppDatabase(file)) {
    try {
      if (config.required || await hasMongoAppCollectionsData()) {
        const client = await getMongoAppClient(config);
        const mongoDb = client.db(config.dbName);
        await mongoDb
          .collection(mongoAppCollectionName('users', config))
          .replaceOne({ id: cleanUser.id }, cleanUser, { upsert: true });
        return cleanUser;
      }
    } catch (error) {
      if (config.required) throw error;
      console.warn(`[mongo-app] Falha ao gravar usuario no MongoDB. Usando data/database.json. Detalhe: ${error.message}`);
    }
  }

  const data = await readLocalDatabase(file);
  const index = data.users.findIndex((item) => item.id === cleanUser.id);
  if (index >= 0) {
    data.users[index] = cleanUser;
  } else {
    data.users.push(cleanUser);
  }
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return cleanUser;
}

export async function readDatabase(file = DATA_FILE) {
  const config = readMongoAppConfig();
  if (shouldUseMongoAppDatabase(file)) {
    try {
      const mongoDb = await readMongoAppDatabase();
      if (mongoDb.users.length) {
        return mongoDb;
      }
      if (config.required) {
        throw new Error('Colecoes operacionais do MongoDB ainda nao possuem usuarios migrados.');
      }
    } catch (error) {
      if (config.required) throw error;
      console.warn(`[mongo-app] Falha ao ler MongoDB. Usando data/database.json. Detalhe: ${error.message}`);
    }
  }

  return readLocalDatabase(file);
}

export async function readDatabaseCollections(collections = [], file = DATA_FILE) {
  const targetCollections = Array.from(new Set(collections))
    .filter((collection) => REQUIRED_COLLECTIONS.includes(collection));
  if (!targetCollections.length) {
    return readDatabase(file);
  }

  const config = readMongoAppConfig();
  if (shouldUseMongoAppDatabase(file)) {
    try {
      if (config.required || await hasMongoAppCollectionsData()) {
        return await readMongoAppCollections(targetCollections);
      }
      if (config.required) {
        throw new Error('Colecoes operacionais do MongoDB ainda nao possuem usuarios migrados.');
      }
    } catch (error) {
      if (config.required) throw error;
      console.warn(`[mongo-app] Falha ao ler colecoes do MongoDB. Usando data/database.json. Detalhe: ${error.message}`);
    }
  }

  const data = await readLocalDatabase(file);
  const partialData = emptyDatabase();
  for (const collection of targetCollections) {
    partialData[collection] = data[collection];
  }
  return normalizeDatabase(partialData);
}

export async function writeDatabase(data, file = DATA_FILE) {
  const config = readMongoAppConfig();
  if (shouldUseMongoAppDatabase(file)) {
    try {
      if (config.required || await hasMongoAppCollectionsData()) {
        return await writeMongoAppDatabase(data);
      }
    } catch (error) {
      if (config.required) throw error;
      console.warn(`[mongo-app] Falha ao gravar MongoDB. Usando data/database.json. Detalhe: ${error.message}`);
    }
  }

  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
}

export async function writeDatabaseCollections(data, collections = [], file = DATA_FILE) {
  const targetCollections = Array.from(new Set(collections)).filter(Boolean);
  if (!targetCollections.length) {
    return writeDatabase(data, file);
  }

  const config = readMongoAppConfig();
  if (shouldUseMongoAppDatabase(file)) {
    try {
      if (config.required || await hasMongoAppCollectionsData()) {
        return await writeMongoAppCollections(data, targetCollections);
      }
    } catch (error) {
      if (config.required) throw error;
      console.warn(`[mongo-app] Falha ao gravar colecoes no MongoDB. Usando data/database.json. Detalhe: ${error.message}`);
    }
  }

  const currentData = await readLocalDatabase(file);
  const normalized = normalizeDatabase(data);
  for (const collection of targetCollections) {
    if (REQUIRED_COLLECTIONS.includes(collection)) {
      currentData[collection] = normalized[collection] ?? [];
    }
  }
  const mergedData = normalizeDatabase(currentData);
  await fs.writeFile(file, `${JSON.stringify(mergedData, null, 2)}\n`, 'utf8');
  return mergedData;
}

export async function writeDatabaseDocument(collection, item, file = DATA_FILE) {
  if (!REQUIRED_COLLECTIONS.includes(collection)) {
    return item;
  }

  const config = readMongoAppConfig();
  if (shouldUseMongoAppDatabase(file)) {
    try {
      if (config.required || await hasMongoAppCollectionsData()) {
        return await writeMongoAppDocument(collection, item);
      }
    } catch (error) {
      if (config.required) throw error;
      console.warn(`[mongo-app] Falha ao gravar documento no MongoDB. Usando data/database.json. Detalhe: ${error.message}`);
    }
  }

  const data = await readLocalDatabase(file);
  const collectionRows = Array.isArray(data[collection]) ? data[collection] : [];
  const index = collectionRows.findIndex((row) => row.id === item.id);
  if (index >= 0) {
    collectionRows[index] = item;
  } else {
    collectionRows.push(item);
  }
  data[collection] = collectionRows;
  await writeDatabaseCollections(data, [collection], file);
  return item;
}

export async function deleteDatabaseDocument(collection, id, file = DATA_FILE) {
  if (!REQUIRED_COLLECTIONS.includes(collection)) {
    return;
  }

  const config = readMongoAppConfig();
  if (shouldUseMongoAppDatabase(file)) {
    try {
      if (config.required || await hasMongoAppCollectionsData()) {
        await deleteMongoAppDocument(collection, id);
        return;
      }
    } catch (error) {
      if (config.required) throw error;
      console.warn(`[mongo-app] Falha ao excluir documento no MongoDB. Usando data/database.json. Detalhe: ${error.message}`);
    }
  }

  const data = await readLocalDatabase(file);
  data[collection] = (Array.isArray(data[collection]) ? data[collection] : [])
    .filter((row) => row.id !== id);
  await writeDatabaseCollections(data, [collection], file);
}

export function createId(prefix, label = '') {
  const slug = String(label)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${slug || 'item'}_${random}`;
}

export function toISODate(date = new Date()) {
  return date.toISOString();
}

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [scheme, salt, storedHash] = String(passwordHash ?? '').split(':');
  if (scheme !== 'scrypt' || !salt || !storedHash) return false;

  const attempted = Buffer.from(scryptSync(String(password), salt, 32).toString('hex'), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return stored.length === attempted.length && timingSafeEqual(stored, attempted);
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordResetTokenHash, passwordResetExpiresAt, ...safeUser } = user;
  return safeUser;
}

export function monthYearFromDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromValue(value) {
  const raw = String(value ?? '').trim().replace('--', '-');
  const match = raw.match(/^(\d{4})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
  }
  return monthYearFromDate(raw);
}

function rollingMonthKeys(now, months = 6) {
  const base = new Date(now);
  if (Number.isNaN(base.getTime())) return [];

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (months - index - 1), 1);
    return monthYearFromDate(date);
  });
}

export function normalizeStage(stage) {
  if (!CANDIDATE_STAGES.includes(stage)) {
    throw new Error(`Etapa invalida: ${stage}`);
  }
  return stage;
}

function normalizeHistoricalStage(stage) {
  if (!LEGACY_CANDIDATE_STAGES.includes(stage)) {
    throw new Error(`Etapa invalida: ${stage}`);
  }
  return stage;
}

export function normalizeOpportunityStatus(status) {
  if (!OPPORTUNITY_STATUSES.includes(status)) {
    throw new Error(`Status de oportunidade invalido: ${status}`);
  }
  return status;
}

export function normalizeOpportunityModel(model) {
  const value = String(model ?? '').trim();
  const normalized = LEGACY_OPPORTUNITY_MODEL_MAP[value] ?? value;

  if (!OPPORTUNITY_MODELS.includes(normalized)) {
    throw new Error(`Modelo de oportunidade invalido: ${model}`);
  }
  return normalized;
}

export function normalizeCurriculum(curriculum) {
  const nome = String(curriculum.nome ?? curriculum.name ?? '').trim();
  const idControle = String(curriculum.id_controle ?? curriculum.idControle ?? curriculum.curriculumId ?? '').trim();
  const id = String(curriculum.id ?? (idControle || createId('curr', nome))).trim();

  return {
    ...curriculum,
    id,
    mongoId: String(curriculum.mongoId ?? curriculum._id ?? '').trim(),
    nome,
    email: String(curriculum.email ?? '').trim(),
    telefone: String(curriculum.telefone ?? curriculum.phone ?? '').trim(),
    endereco: String(curriculum.endereco ?? '').trim(),
    nacionalidade: String(curriculum.nacionalidade ?? '').trim(),
    estado_civil: String(curriculum.estado_civil ?? '').trim(),
    idade: String(curriculum.idade ?? '').trim(),
    linkedin: String(curriculum.linkedin ?? '').trim(),
    skills: String(curriculum.skills ?? '').trim(),
    formacao_academica: String(curriculum.formacao_academica ?? '').trim(),
    nivel_ingles: String(curriculum.nivel_ingles ?? '').trim(),
    nivel_espanhol: String(curriculum.nivel_espanhol ?? '').trim(),
    cursos_certificacoes: String(curriculum.cursos_certificacoes ?? '').trim(),
    conhecimento_tecnico: String(curriculum.conhecimento_tecnico ?? '').trim(),
    experiencia_profissional: String(curriculum.experiencia_profissional ?? '').trim(),
    cargo_alvo: String(curriculum.cargo_alvo ?? '').trim(),
    observacoes_entrevista: String(curriculum.observacoes_entrevista ?? '').trim(),
    feedback_entrevista_ingles: String(curriculum.feedback_entrevista_ingles ?? '').trim(),
    disponibilidade_viagem: String(curriculum.disponibilidade_viagem ?? '').trim(),
    hash_documento: String(curriculum.hash_documento ?? '').trim(),
    fonte: String(curriculum.fonte ?? '').trim(),
    data_criacao: String(curriculum.data_criacao ?? curriculum.createdAt ?? toISODate()).trim(),
    data_atualizacao: String(curriculum.data_atualizacao ?? '').trim(),
    data_origem: String(curriculum.data_origem ?? '').trim(),
    versoes: Array.isArray(curriculum.versoes) ? curriculum.versoes : [],
    experiencias: curriculum.experiencias ?? curriculum.experiences ?? [],
    experiences: curriculum.experiences ?? [],
    atividades: curriculum.atividades ?? '',
    atividades_exercidas: curriculum.atividades_exercidas ?? curriculum.atividadesExercidas ?? '',
    empresas: curriculum.empresas ?? [],
    projetos: curriculum.projetos ?? [],
    tecnologias: curriculum.tecnologias ?? [],
    search_text: String(curriculum.search_text ?? curriculum.texto_pesquisa ?? '').trim(),
    search_text_all: String(curriculum.search_text_all ?? curriculum.texto_pesquisavel ?? '').trim(),
    data_nascimento: String(curriculum.data_nascimento ?? '').trim(),
    blackflag: normalizeBoolean(
      curriculum.blackflag
      ?? curriculum.blackFlag
      ?? curriculum.black_flag
      ?? curriculum.blacklist
      ?? curriculum.blackList
      ?? curriculum.black_list
      ?? false
    ),
    blackflagObservation: String(
      curriculum.blackflagObservation
      ?? curriculum.blackFlagObservation
      ?? curriculum.blackflag_observation
      ?? curriculum.blacklistObservation
      ?? curriculum.blackListObservation
      ?? curriculum.blacklist_observation
      ?? ''
    ).trim(),
    id_controle: idControle || id
  };
}

export function normalizeClient(client) {
  const customerName = String(client.customerName ?? client.name ?? '').trim();

  return {
    ...client,
    id: String(client.id ?? createId('client', customerName)).trim(),
    customerName,
    primaryContactName: String(client.primaryContactName ?? '').trim(),
    primaryContactEmail: String(client.primaryContactEmail ?? '').trim(),
    primaryContactPhone: String(client.primaryContactPhone ?? '').trim(),
    managerContactId: String(client.managerContactId ?? client.gestorContatoId ?? client.nomeGestorId ?? '').trim(),
    observation: String(client.observation ?? client.observacao ?? '').trim(),
    createdAt: String(client.createdAt ?? toISODate()).trim(),
    updatedAt: String(client.updatedAt ?? '').trim()
  };
}

export function normalizeContactClient(contact) {
  const name = String(contact.name ?? contact.nome ?? '').trim();
  const clientId = String(contact.clientId ?? contact.client_id ?? '').trim();

  return {
    id: String(contact.id ?? createId('contact_client', name || clientId || 'contato')).trim(),
    clientId,
    parentContactId: String(contact.parentContactId ?? contact.managerContactId ?? contact.gestorContatoId ?? '').trim(),
    name,
    area: String(contact.area ?? '').trim(),
    role: String(contact.role ?? contact.cargo ?? '').trim(),
    phone: String(contact.phone ?? contact.telefone ?? '').trim(),
    email: String(contact.email ?? '').trim(),
    createdAt: String(contact.createdAt ?? toISODate()).trim(),
    updatedAt: String(contact.updatedAt ?? '').trim()
  };
}

export function normalizeCurriculumObservation(observation = {}) {
  const curriculumId = String(
    observation.curriculumId
    ?? observation.idCurriculum
    ?? observation.id_curriculum
    ?? observation.idCurriculo
    ?? observation.id_curriculo
    ?? ''
  ).trim();
  const userId = String(
    observation.userId
    ?? observation.responsibleUserId
    ?? observation.responsavelId
    ?? observation.responsavel
    ?? ''
  ).trim();
  const text = String(
    observation.observation
    ?? observation.observacoes
    ?? observation.observacao
    ?? observation['observações']
    ?? ''
  ).trim();

  return {
    id: String(observation.id ?? createId('curr_obs', `${curriculumId}-${userId}`)).trim(),
    curriculumId,
    observation: text,
    date: String(observation.date ?? observation.data ?? observation.createdAt ?? toISODate()).trim(),
    userId,
    userName: String(observation.userName ?? observation.responsibleName ?? observation.responsavelNome ?? '').trim(),
    userEmail: String(observation.userEmail ?? observation.responsibleEmail ?? observation.responsavelEmail ?? '').trim(),
    createdAt: String(observation.createdAt ?? observation.date ?? toISODate()).trim()
  };
}

export function normalizeFormRequestObservation(observation = {}) {
  const requestId = String(
    observation.requestId
    ?? observation.formRequestId
    ?? observation.requisitionId
    ?? observation.idRequisicao
    ?? ''
  ).trim();
  const userId = String(
    observation.userId
    ?? observation.responsibleUserId
    ?? observation.responsavelId
    ?? ''
  ).trim();
  const text = String(
    observation.observation
    ?? observation.text
    ?? observation.observacao
    ?? observation.observacoes
    ?? ''
  ).trim();
  const date = String(observation.date ?? observation.createdAt ?? observation.data ?? toISODate()).trim();

  return {
    id: String(observation.id ?? createId('form_req_obs', `${requestId}-${userId}-${date}`)).trim(),
    requestId,
    observation: text,
    date,
    userId,
    userName: String(observation.userName ?? observation.responsibleName ?? observation.responsavelNome ?? '').trim(),
    userEmail: String(observation.userEmail ?? observation.responsibleEmail ?? observation.responsavelEmail ?? '').trim(),
    action: String(observation.action ?? observation.status ?? '').trim(),
    createdAt: String(observation.createdAt ?? date).trim()
  };
}

export function normalizeCandidate(candidate) {
  const opportunityId = String(candidate.opportunityId ?? '').trim();
  const stage = normalizeStage(candidate.stage ?? 'Triagem');
  const timestamp = toISODate();
  const createdAt = candidate.createdAt ?? timestamp;
  const stageEnteredAt = candidate.stageEnteredAt ?? createdAt;
  const rawHistory = candidate.stageHistory ?? candidate.history;
  const stageHistory = normalizeStageHistory(rawHistory, stage, stageEnteredAt);

  return {
    ...candidate,
    name: String(candidate.name ?? '').trim(),
    curriculumId: String(candidate.curriculumId ?? candidate.idNome ?? candidate.id?.replace(/^cand_/, 'curr_') ?? '').trim(),
    opportunityId,
    hourlyRate: Number(candidate.hourlyRate ?? candidate.valorHora ?? 0),
    observation: String(candidate.observation ?? candidate.notes ?? candidate.skills ?? '').trim(),
    approved: normalizeBoolean(candidate.approved ?? candidate.aprovado ?? false) || stage === 'Aprovado',
    stage,
    aderencia: normalizeAderencia(candidate.aderencia ?? candidate.adherence ?? 50),
    source: String(candidate.source ?? '').trim(),
    notes: String(candidate.notes ?? '').trim(),
    status: stage === 'Aprovado' || stage === 'Reprovado' ? stage : 'Em andamento',
    stageEnteredAt,
    createdAt,
    stageHistory
  };
}

export function normalizeAllocated(allocated) {
  const active = allocated.active ?? allocated.ativo ?? true;

  return {
    ...allocated,
    id: String(allocated.id ?? createId('alloc', allocated.code ?? allocated.codigo ?? allocated.consultant ?? allocated.consultor)).trim(),
    externalId: String(allocated.externalId ?? allocated.Id ?? allocated.idOriginal ?? '').trim(),
    code: String(allocated.code ?? allocated.codigo ?? '').trim(),
    consultant: String(allocated.consultant ?? allocated.consultor ?? '').trim(),
    skill: String(allocated.skill ?? '').trim(),
    clientId: String(allocated.clientId ?? '').trim(),
    hourlyRate: Number(allocated.hourlyRate ?? allocated.valorHora ?? 0),
    saleHourlyRate: Number(allocated.saleHourlyRate ?? allocated.valorVendaHora ?? allocated.vendaBase ?? 0),
    monthlyHours: Number(allocated.monthlyHours ?? allocated.horasMes ?? allocated.horas ?? 0),
    contractTerm: String(allocated.contractTerm ?? allocated.validade ?? '').trim(),
    contractType: String(allocated.contractType ?? allocated.tipoContrato ?? allocated.tipo ?? '').trim(),
    companyName: String(allocated.companyName ?? allocated.empresa ?? '').trim(),
    companyCnpj: String(allocated.companyCnpj ?? allocated.cnpj ?? '').trim(),
    companyAddress: String(allocated.companyAddress ?? allocated.enderecoEmpresa ?? allocated.endereco ?? '').trim(),
    companyCity: String(allocated.companyCity ?? allocated.cidadeEmpresa ?? allocated.cidade ?? '').trim(),
    companyState: String(allocated.companyState ?? allocated.estadoEmpresa ?? allocated.estado ?? '').trim(),
    companyZip: String(allocated.companyZip ?? allocated.cepEmpresa ?? allocated.cep ?? '').trim(),
    contactAddress: String(allocated.contactAddress ?? allocated.enderecoContato ?? '').trim(),
    contactCity: String(allocated.contactCity ?? allocated.cidadeContato ?? '').trim(),
    contactState: String(allocated.contactState ?? allocated.estadoContato ?? '').trim(),
    contactZip: String(allocated.contactZip ?? allocated.cepContato ?? '').trim(),
    rg: String(allocated.rg ?? '').trim(),
    cpf: String(allocated.cpf ?? '').trim(),
    birthDate: String(allocated.birthDate ?? allocated.dataNascimento ?? '').trim(),
    motherName: String(allocated.motherName ?? allocated.nomeMae ?? '').trim(),
    phone: String(allocated.phone ?? allocated.fone ?? '').trim(),
    consultantEmail: String(allocated.consultantEmail ?? allocated.emailConsultor ?? '').trim(),
    startDate: String(allocated.startDate ?? allocated.inicio ?? '').trim(),
    active: normalizeBoolean(active),
    endDate: String(allocated.endDate ?? allocated.termino ?? '').trim(),
    manager: String(allocated.manager ?? allocated.gestor ?? '').trim(),
    managerEmail: String(allocated.managerEmail ?? allocated.emailGestor ?? '').trim(),
    managerPhone: String(allocated.managerPhone ?? allocated.foneGestor ?? '').trim(),
    createdAt: String(allocated.createdAt ?? toISODate()).trim()
  };
}

export function normalizeWorkHourEntry(entry = {}) {
  const date = String(entry.date ?? entry.data ?? '').trim();
  const allocatedId = String(entry.allocatedId ?? entry.alocadoId ?? entry.consultorId ?? '').trim();
  const hours = Number(entry.hours ?? entry.horasTrabalhadas ?? entry.horas ?? 0);

  return {
    ...entry,
    id: String(entry.id ?? createId('work_hour', `${allocatedId}-${date}`)).trim(),
    allocatedId,
    consultantName: String(entry.consultantName ?? entry.consultor ?? '').trim(),
    consultantEmail: String(entry.consultantEmail ?? entry.emailConsultor ?? '').trim().toLowerCase(),
    date,
    hours: Number.isFinite(hours) ? hours : 0,
    clientId: String(entry.clientId ?? entry.clienteId ?? '').trim(),
    project: String(entry.project ?? entry.projeto ?? '').trim(),
    observation: String(entry.observation ?? entry.observacao ?? '').trim(),
    createdById: String(entry.createdById ?? entry.usuarioId ?? '').trim(),
    createdByName: String(entry.createdByName ?? entry.usuario ?? '').trim(),
    createdByEmail: String(entry.createdByEmail ?? entry.usuarioEmail ?? '').trim().toLowerCase(),
    createdAt: String(entry.createdAt ?? toISODate()).trim(),
    updatedAt: String(entry.updatedAt ?? entry.createdAt ?? toISODate()).trim()
  };
}

export function normalizeWorkHourClosure(closure = {}) {
  const monthYear = String(closure.monthYear ?? closure.mesAno ?? '').trim();
  const allocatedId = String(closure.allocatedId ?? closure.alocadoId ?? closure.consultorId ?? '').trim();
  const missingBusinessDays = Array.isArray(closure.missingBusinessDays)
    ? closure.missingBusinessDays.map((day) => String(day || '').trim()).filter(Boolean)
    : [];

  return {
    ...closure,
    id: String(closure.id ?? createId('work_hour_closure', `${allocatedId}-${monthYear}`)).trim(),
    allocatedId,
    monthYear,
    consultantName: String(closure.consultantName ?? closure.consultor ?? '').trim(),
    consultantEmail: String(closure.consultantEmail ?? closure.emailConsultor ?? '').trim().toLowerCase(),
    clientId: String(closure.clientId ?? closure.clienteId ?? '').trim(),
    status: String(closure.status ?? 'Finalizado').trim(),
    missingBusinessDays,
    confirmedWithMissingDays: Boolean(closure.confirmedWithMissingDays ?? closure.confirmadoComDiasEmBranco ?? false),
    finalizedById: String(closure.finalizedById ?? closure.usuarioId ?? '').trim(),
    finalizedByName: String(closure.finalizedByName ?? closure.usuario ?? '').trim(),
    finalizedByEmail: String(closure.finalizedByEmail ?? closure.usuarioEmail ?? '').trim().toLowerCase(),
    finalizedAt: String(closure.finalizedAt ?? closure.createdAt ?? toISODate()).trim(),
    notification: closure.notification && typeof closure.notification === 'object' ? closure.notification : null,
    updatedAt: String(closure.updatedAt ?? closure.finalizedAt ?? closure.createdAt ?? toISODate()).trim()
  };
}

export function normalizeBusinessCalendarEntry(entry = {}) {
  const date = String(entry.date ?? entry.data ?? '').trim();
  const allDay = normalizeBoolean(entry.allDay ?? entry.diaInteiro ?? entry.dia_inteiro ?? true);
  const startTime = String(entry.startTime ?? entry.horaInicial ?? entry.hora_inicial ?? '00:00').trim();
  const endTime = String(entry.endTime ?? entry.horaFinal ?? entry.hora_final ?? '23:59').trim();
  const clientId = String(entry.clientId ?? entry.clienteId ?? '').trim();
  const reason = String(entry.reason ?? entry.motivo ?? '').trim();

  return {
    ...entry,
    id: String(entry.id ?? createId('business_calendar', `${date}-${clientId || 'todos'}-${reason}`)).trim(),
    date,
    allDay,
    startTime: allDay ? '00:00' : startTime,
    endTime: allDay ? '23:59' : endTime,
    clientId,
    reason,
    observation: String(entry.observation ?? entry.observacao ?? '').trim(),
    createdAt: String(entry.createdAt ?? toISODate()).trim(),
    updatedAt: String(entry.updatedAt ?? '').trim()
  };
}

export function normalizeFaturamento(item) {
  return {
    ...item,
    id: String(item.id ?? createId('faturamento', item.monthYear ?? item.mesAno ?? item.month)).trim().replace(new RegExp(['^sa', 'le_'].join('')), 'faturamento_'),
    monthYear: String(item.monthYear ?? item.mesAno ?? item.month ?? '').trim(),
    forecast: Number(item.forecast ?? item.previsto ?? 0),
    realized: Number(item.realized ?? item.realizado ?? 0),
    accumulatedGrowth: Number(item.accumulatedGrowth ?? item.acumuladoCrescimento ?? 0),
    accumulatedRealized: Number(item.accumulatedRealized ?? item.acumuladoRealizado ?? 0),
    createdAt: String(item.createdAt ?? toISODate()).trim()
  };
}

export function normalizeRateCard(rateCard) {
  const rate = Number(rateCard.rate ?? rateCard.taxa ?? 0);
  const maximumSource = rateCard.maximum ?? rateCard.maximo ?? rateCard['máximo'];
  const maximum = maximumSource === undefined || maximumSource === ''
    ? rateCardMaximum(rate)
    : Number(maximumSource);
  const active = rateCard.active ?? rateCard.ativo ?? true;
  const skill = String(rateCard.skill ?? rateCard.Skill ?? '').trim();
  const clientId = String(rateCard.clientId ?? rateCard.clienteId ?? rateCard.cliente ?? '').trim();

  return {
    ...rateCard,
    id: String(rateCard.id ?? deterministicRateCardId(clientId || 'cliente', skill || 'skill')).trim(),
    skill,
    rate: Number.isFinite(rate) ? rate : 0,
    maximum: Number.isFinite(maximum) ? maximum : rateCardMaximum(rate),
    active: normalizeBoolean(active),
    clientId,
    createdAt: String(rateCard.createdAt ?? toISODate()).trim(),
    updatedAt: String(rateCard.updatedAt ?? '').trim()
  };
}

export function normalizeStatusReport(report = {}) {
  const clientId = String(report.clientId ?? report.clienteId ?? '').trim();
  const allocatedId = String(report.allocatedId ?? report.alocadoId ?? report.consultorId ?? '').trim();
  const period = String(report.period ?? report.periodo ?? '').trim();
  const statusLightInput = String(report.statusLight ?? report.farol ?? 'verde').trim().toLowerCase();
  const statusLight = ['verde', 'amarelo', 'vermelho'].includes(statusLightInput) ? statusLightInput : 'verde';

  return {
    ...report,
    id: String(report.id ?? createId('status_report', `${clientId}-${allocatedId}-${period}`)).trim(),
    clientId,
    allocatedId,
    period,
    clientName: String(report.clientName ?? report.nomeCliente ?? '').trim(),
    consultantName: String(report.consultantName ?? report.consultor ?? '').trim(),
    consultantEmail: String(report.consultantEmail ?? report.emailConsultor ?? '').trim().toLowerCase(),
    managerName: String(report.managerName ?? report.gestor ?? '').trim(),
    managerEmail: String(report.managerEmail ?? report.emailGestor ?? '').trim().toLowerCase(),
    alcateiaOwner: String(report.alcateiaOwner ?? report.responsavelAlcateia ?? '').trim(),
    reportDate: String(report.reportDate ?? report.data ?? toISODate().slice(0, 10)).trim(),
    statusLight,
    executiveSummary: String(report.executiveSummary ?? report.resumoExecutivo ?? '').trim(),
    tasks: String(report.tasks ?? report.tarefas ?? '').trim(),
    nextSteps: String(report.nextSteps ?? report.proximasAtividades ?? '').trim(),
    attentionPoints: String(report.attentionPoints ?? report.pontosAtencao ?? '').trim(),
    risks: String(report.risks ?? report.riscos ?? '').trim(),
    recommendedActions: String(report.recommendedActions ?? report.acoesRecomendadas ?? '').trim(),
    governanceNote: String(report.governanceNote ?? report.observacaoGovernanca ?? 'Gestao diaria sob responsabilidade do cliente; acompanhamento Alcateia para mitigacao de riscos e antecipacao de pontos de atencao.').trim(),
    createdById: String(report.createdById ?? '').trim(),
    createdByName: String(report.createdByName ?? '').trim(),
    createdByEmail: String(report.createdByEmail ?? '').trim().toLowerCase(),
    createdAt: String(report.createdAt ?? toISODate()).trim(),
    updatedAt: String(report.updatedAt ?? report.createdAt ?? toISODate()).trim()
  };
}

export function normalizeCandidatePool(item) {
  const profile = String(item.profile ?? item.perfil ?? item['Perfil (Select: Técnico, Funcional)'] ?? '').trim();
  const normalizedProfile = CANDIDATE_POOL_PROFILES.includes(profile) ? profile : 'Funcional';
  const candidateName = String(item.candidateName ?? item.name ?? item.nome ?? item['Nome (FK nome Curriculum)'] ?? '').trim();
  const clientId = String(item.clientId ?? item.clienteId ?? item['Cliente(FK Clients)'] ?? '').trim();
  const hourlyRate = Number(item.hourlyRate ?? item.valorHora ?? item['Valor Hora (Currency)'] ?? 0);
  const rawDate = String(item.agreementDate ?? item.dataAcordo ?? item['Data Acordo (Date)'] ?? '').trim();
  const agreementDate = rawDate.includes('T') ? rawDate.slice(0, 10) : rawDate.slice(0, 10);
  const rawStatus = String(item.status ?? item.situacao ?? item['Status'] ?? '').trim();
  const normalizedStatus = CANDIDATE_POOL_STATUSES.includes(rawStatus)
    ? rawStatus
    : normalizeBoolean(item.active ?? item.ativo ?? item['Ativo (Checkbox)'] ?? true)
      ? 'Ativo'
      : 'Inativo';

  const normalized = {
    ...item,
    id: String(item.id ?? deterministicCandidatePoolId(clientId || 'cliente', candidateName || 'candidato')).trim(),
    clientId,
    candidateName,
    profile: normalizedProfile,
    hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : 0,
    agreementDate,
    status: normalizedStatus,
    active: normalizedStatus === 'Ativo',
    createdAt: String(item.createdAt ?? toISODate()).trim(),
    updatedAt: String(item.updatedAt ?? '').trim()
  };

  const aliases = {
    protheusFinanceiro: ['Protheus_Financeiro (Checkbox)', 'protheus_financeiro'],
    protheusFiscal: ['Protheus_Fiscal (Checkbox)', 'protheus_fiscal'],
    protheusContabil: ['Protheus_Contábil (Checkbox)', 'Protheus_Contabil (Checkbox)', 'protheus_contabil'],
    protheusCompras: ['Protheus_Compras (Checkbox)', 'protheus_compras'],
    protheusEstoque: ['Protheus_Estoque (Checkbox)', 'protheus_estoque'],
    protheusFaturamento: ['Protheus_Faturamento (Checkbox)', 'protheus_faturamento'],
    protheusPcp: ['Protheus_PCP (Checkbox)', 'protheus_pcp'],
    protheusRh: ['Protheus_RH (Checkbox)', 'protheus_rh'],
    rmFolha: ['RM_Folha (Checkbox)', 'rm_folha'],
    rmPonto: ['RM_Ponto (Checkbox)', 'rm_ponto'],
    rmContabil: ['RM_Contábil (Checkbox)', 'RM_Contabil (Checkbox)', 'rm_contabil'],
    rmFiscal: ['RM_Fiscal (Checkbox)', 'rm_fiscal'],
    rmFinanceiro: ['RM_Financeiro (Checkbox)', 'rm_financeiro'],
    rmEducacional: ['RM_Educacional (Checkbox)', 'rm_educacional'],
    datasulManufatura: ['Datasul_Manufatura (Checkbox)', 'datasul_manufatura'],
    datasulPcp: ['Datasul_PCP (Checkbox)', 'datasul_pcp'],
    datasulWms: ['Datasul_WMS (Checkbox)', 'datasul_wms'],
    datasulCq: ['Datasul_CQ (Checkbox)', 'datasul_cq'],
    fluigBpm: ['Fluig_BPM (Checkbox)', 'fluig_bpm'],
    fluigEcm: ['Fluig_ECM (Checkbox)', 'fluig_ecm'],
    fluigFormularios: ['Fluig_Formulários (Checkbox)', 'Fluig_Formularios (Checkbox)', 'fluig_formularios'],
    fluigIntegracoes: ['Fluig_Integrações (Checkbox)', 'Fluig_Integracoes (Checkbox)', 'fluig_integracoes'],
    tecnicoAdvpl: ['Técnico ADVPL (Checkbox)', 'Tecnico ADVPL (Checkbox)', 'tecnico_advpl'],
    scrumMaster: ['Scrum Master (Checkbox)', 'Scrum_Master (Checkbox)', 'scrum_master']
  };

  for (const [field] of CANDIDATE_POOL_SKILL_FIELDS) {
    const aliasValue = (aliases[field] ?? []).map((alias) => item[alias]).find((value) => value !== undefined);
    normalized[field] = normalizeBoolean(item[field] ?? aliasValue ?? false);
  }

  return normalized;
}

export function normalizeCvFilter(filter) {
  const state = String(filter.state ?? filter.estado ?? '').trim().toUpperCase();
  const matchPercent = Number(filter.matchPercent ?? filter.percentualAcerto ?? filter.percentual_acerto ?? 0);
  const mandatorySkills = String(filter.mandatorySkills ?? filter.habilidadesObrigatorias ?? filter.habilidades_obrigatorias ?? '').trim();
  const requestedLimit = Number(filter.resultLimit ?? filter.qtdeRetorno ?? filter.quantidadeRetorno ?? filter.quantidade_retorno ?? 10);
  const sourceValue = (camelName, snakeName) => filter[camelName] ?? filter.searchSources?.[camelName.replace(/^search/, '').toLowerCase()] ?? filter[snakeName];
  const defaultChecked = (value) => value === undefined ? true : normalizeBoolean(value);
  const resultLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(50, Math.trunc(requestedLimit)))
    : 10;

  if (state && !BRAZIL_UFS.includes(state)) {
    throw new Error(`UF invalida: ${state}`);
  }
  if (!Number.isFinite(matchPercent) || matchPercent < 0 || matchPercent > 100) {
    throw new Error(`Percentual de acerto invalido: ${matchPercent}`);
  }

  return {
    ...filter,
    id: String(filter.id ?? createId('cvf', filter.jobDescription ?? filter.job_description ?? filter.opportunityId)).trim(),
    opportunityId: String(filter.opportunityId ?? '').trim(),
    jobDescription: String(filter.jobDescription ?? filter.job_description ?? '').trim(),
    mandatorySkills,
    candidateMessage: undefined,
    searchApinfo: defaultChecked(sourceValue('searchApinfo', 'busca_apinfo')),
    searchLinkedin: defaultChecked(sourceValue('searchLinkedin', 'busca_linkedin')),
    searchAlcateia: defaultChecked(sourceValue('searchAlcateia', 'busca_alcateia')),
    englishLevel: String(filter.englishLevel ?? filter.nivelIngles ?? filter.nivel_ingles ?? '').trim(),
    state,
    city: String(filter.city ?? filter.cidade ?? '').trim(),
    available: normalizeBoolean(filter.available ?? filter.disponivel ?? false),
    ageRange: String(filter.ageRange ?? filter.faixaEtaria ?? filter.faixa_etaria ?? '').trim(),
    matchPercent,
    resultLimit,
    searchStatus: '',
    searchMessage: '',
    searchSource: '',
    searchExecutedAt: '',
    searchResults: [],
    searchRejectedResults: [],
    createdAt: String(filter.createdAt ?? toISODate()).trim()
  };
}

export function normalizeCvSearchResult(result) {
  const score = Number(result.score ?? 0);

  return {
    id: String(result.id ?? createId('match', result.name ?? result.nome ?? result.link ?? 'candidato')).trim(),
    name: String(result.name ?? result.nome ?? '').trim(),
    source: String(result.source ?? result.fonte ?? 'APINFO').trim(),
    link: String(result.link ?? '').trim(),
    linkedinLink: String(result.linkedinLink ?? result.linkedin ?? '').trim(),
    apinfoLink: String(result.apinfoLink ?? result.apinfo ?? '').trim(),
    curriculumId: String(result.curriculumId ?? result.idNome ?? result.id_controle ?? '').trim(),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    observation: String(result.observation ?? result.observacao ?? result['observacao'] ?? '').trim()
  };
}

export function normalizeSelectedCandidate(candidate) {
  const score = Number(candidate.score ?? 0);

  return {
    id: String(candidate.id ?? createId('sel', candidate.name ?? candidate.nome ?? candidate.link ?? 'candidato')).trim(),
    opportunityId: String(candidate.opportunityId ?? '').trim(),
    cvFilterId: String(candidate.cvFilterId ?? '').trim(),
    name: String(candidate.name ?? candidate.nome ?? '').trim(),
    source: String(candidate.source ?? candidate.fonte ?? 'APINFO').trim(),
    link: String(candidate.link ?? '').trim(),
    linkedinLink: String(candidate.linkedinLink ?? candidate.linkedin ?? '').trim(),
    apinfoLink: String(candidate.apinfoLink ?? candidate.apinfo ?? '').trim(),
    curriculumId: String(candidate.curriculumId ?? candidate.idNome ?? candidate.id_controle ?? '').trim(),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    origin: String(candidate.origin ?? candidate.origem ?? 'Resultado').trim(),
    candidateMessage: String(candidate.candidateMessage ?? candidate.mensagemCandidato ?? '').trim(),
    observation: String(candidate.observation ?? candidate.observacao ?? candidate['observação'] ?? candidate['observação'] ?? '').trim(),
    createdAt: String(candidate.createdAt ?? toISODate()).trim(),
    updatedAt: String(candidate.updatedAt ?? '').trim()
  };
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1' || value === 'Sim';
}

export function normalizeAderencia(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || !CANDIDATE_ADERENCIA_OPTIONS.includes(number)) {
    throw new Error(`Aderencia invalida: ${value}`);
  }
  return number;
}

function normalizeStageHistory(history, currentStage, enteredAt) {
  const normalized = Array.isArray(history)
    ? history
        .map((item) => ({
          stage: normalizeHistoricalStage(item.stage),
          enteredAt: item.enteredAt || enteredAt,
          leftAt: item.leftAt || ''
        }))
        .filter((item) => item.enteredAt)
    : [];

  if (!normalized.length) {
    normalized.push({
      stage: currentStage,
      enteredAt,
      leftAt: ''
    });
  }

  if (!normalized.some((item) => item.stage === currentStage && !item.leftAt)) {
    normalized.push({
      stage: currentStage,
      enteredAt,
      leftAt: ''
    });
  }

  return normalized;
}

export function enrichCandidate(candidate, db) {
  const opportunity = db.opportunities.find((item) => item.id === candidate.opportunityId);
  const curriculum = db.curriculums.find((item) => item.id === candidate.curriculumId || item.id_controle === candidate.curriculumId);
  const blackflag = normalizeBoolean(curriculum?.blackflag ?? curriculum?.blacklist ?? false);

  return {
    ...candidate,
    curriculumName: curriculum?.nome ?? '',
    curriculumControlId: curriculum?.id_controle ?? candidate.curriculumId,
    blackflag,
    blackflagObservation: curriculum?.blackflagObservation ?? curriculum?.blacklistObservation ?? '',
    opportunityName: opportunity?.opportunity ?? '',
    opportunityCode: opportunity?.opportunityCode ?? '',
    opportunityStatus: opportunity?.status ?? ''
  };
}

export function enrichAllocated(allocated, db) {
  const client = db.clients.find((item) => item.id === allocated.clientId);

  return {
    ...allocated,
    clientName: client?.customerName ?? ''
  };
}

export function enrichRateCard(rateCard, db) {
  const client = db.clients.find((item) => item.id === rateCard.clientId);

  return {
    ...rateCard,
    clientName: client?.customerName ?? ''
  };
}

export function enrichStatusReport(report, db) {
  const client = db.clients.find((item) => item.id === report.clientId);
  const allocated = db.allocateds.find((item) => item.id === report.allocatedId);

  return {
    ...report,
    clientName: client?.customerName ?? report.clientName ?? '',
    consultantName: allocated?.consultant ?? report.consultantName ?? '',
    consultantEmail: allocated?.consultantEmail ?? report.consultantEmail ?? '',
    managerName: allocated?.manager ?? report.managerName ?? '',
    managerEmail: allocated?.managerEmail ?? report.managerEmail ?? '',
    clientManagerName: client?.managerContactName ?? ''
  };
}

export function enrichCvFilter(filter, db) {
  const opportunity = db.opportunities.find((item) => item.id === filter.opportunityId);

  return {
    ...filter,
    opportunityName: opportunity?.opportunity ?? '',
    opportunityCode: opportunity?.opportunityCode ?? ''
  };
}

function comparableName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

function findCurriculumByName(db, name) {
  const candidateName = comparableName(name);
  if (!candidateName) return null;
  return db.curriculums.find((item) => comparableName(item.nome) === candidateName) ?? null;
}

export function enrichCandidatePool(item, db) {
  const client = db.clients.find((clientItem) => clientItem.id === item.clientId);
  const curriculum = findCurriculumByName(db, item.candidateName);
  const activeSkills = CANDIDATE_POOL_SKILL_FIELDS
    .filter(([field]) => item[field])
    .map(([, label]) => label);

  return {
    ...item,
    clientName: client?.customerName ?? '',
    curriculumId: curriculum?.id_controle || curriculum?.id || curriculum?.mongoId || '',
    curriculumMongoId: curriculum?.mongoId || '',
    blackflag: normalizeBoolean(curriculum?.blackflag ?? curriculum?.blacklist ?? false),
    activeSkills
  };
}

function findCurriculumForSelectedCandidate(candidate, db) {
  const curriculumId = String(candidate.curriculumId ?? '').trim();
  if (curriculumId) {
    const byId = db.curriculums.find((item) => (
      item.id === curriculumId
      || item.id_controle === curriculumId
      || item.mongoId === curriculumId
    ));
    if (byId) return byId;
  }

  const candidateName = comparableName(candidate.name);
  if (!candidateName) return null;

  return db.curriculums.find((item) => comparableName(item.nome) === candidateName) ?? null;
}

export function enrichSelectedCandidate(candidate, db) {
  const opportunity = db.opportunities.find((item) => item.id === candidate.opportunityId);
  const filter = db.cvFilters.find((item) => item.id === candidate.cvFilterId);
  const curriculum = findCurriculumForSelectedCandidate(candidate, db);
  const blackflag = normalizeBoolean(curriculum?.blackflag ?? curriculum?.blacklist ?? false);

  return {
    ...candidate,
    curriculumId: candidate.curriculumId || curriculum?.id_controle || curriculum?.id || curriculum?.mongoId || '',
    blackflag,
    blackflagObservation: curriculum?.blackflagObservation ?? curriculum?.blacklistObservation ?? '',
    opportunityName: opportunity?.opportunity ?? '',
    opportunityCode: opportunity?.opportunityCode ?? '',
    cvFilterName: filter?.jobDescription ?? ''
  };
}

function comparableNameTokens(value) {
  return comparableName(value).split(' ').filter((token) => token.length > 1);
}

function namesLikelyReferToSamePerson(firstName, secondName) {
  const firstTokens = comparableNameTokens(firstName);
  const secondTokens = comparableNameTokens(secondName);
  if (!firstTokens.length || !secondTokens.length) return false;

  const first = firstTokens.join(' ');
  const second = secondTokens.join(' ');
  if (first === second) return true;

  const firstSet = new Set(firstTokens);
  const secondSet = new Set(secondTokens);
  const firstContainedInSecond = firstTokens.every((token) => secondSet.has(token));
  const secondContainedInFirst = secondTokens.every((token) => firstSet.has(token));
  return firstContainedInSecond || secondContainedInFirst;
}

function isAllocatedAlsoActiveInCandidatePool(allocated, db) {
  return (db.candidatePool ?? []).some((poolItem) => (
    poolItem.status === 'Ativo'
    && poolItem.clientId === allocated.clientId
    && namesLikelyReferToSamePerson(allocated.consultant, poolItem.candidateName)
  ));
}

export function calculateIndicators(db, now = new Date()) {
  const openOpportunities = db.opportunities.filter((opportunity) => opportunity.status === 'Open').length;
  const currentMonth = monthYearFromDate(now);
  const lastSixMonths = rollingMonthKeys(now);
  const wonCurrentMonth = db.opportunities.filter(
    (opportunity) => opportunity.status === 'WON' && monthKeyFromValue(opportunity.closingDate) === currentMonth
  );
  const wonContractValueCurrentMonth = wonCurrentMonth.reduce(
    (sum, opportunity) => sum + Number(opportunity.closedQuantity ?? 0) * Number(opportunity.contractValue ?? 0),
    0
  );
  const wonByModelCurrentMonth = Object.fromEntries(OPPORTUNITY_MODELS.map((model) => [model, 0]));
  for (const opportunity of wonCurrentMonth) {
    wonByModelCurrentMonth[opportunity.model] = (wonByModelCurrentMonth[opportunity.model] ?? 0) + 1;
  }
  const wonContractValueByMonth = Object.fromEntries(lastSixMonths.map((month) => [month, 0]));
  for (const opportunity of db.opportunities) {
    const month = monthKeyFromValue(opportunity.closingDate || opportunity.monthYear);
    if (opportunity.status === 'WON' && Object.hasOwn(wonContractValueByMonth, month)) {
      wonContractValueByMonth[month] += Number(opportunity.closedQuantity ?? 0) * Number(opportunity.contractValue ?? 0);
    }
  }
  const activeContractValue = db.opportunities
    .filter((opportunity) => !['Closed', 'LOST', 'WON'].includes(opportunity.status))
    .reduce((sum, opportunity) => sum + Number(opportunity.contractValue ?? 0), 0);

  const activeOpportunityIds = new Set(
    db.opportunities
      .filter((opportunity) => !['Closed', 'LOST', 'WON'].includes(opportunity.status))
      .map((opportunity) => opportunity.id)
  );
  const candidatesByStage = Object.fromEntries(CANDIDATE_STAGES.map((stage) => [stage, 0]));
  for (const candidate of db.candidates.filter((item) => activeOpportunityIds.has(item.opportunityId))) {
    candidatesByStage[candidate.stage] = (candidatesByStage[candidate.stage] ?? 0) + 1;
  }

  const opportunitiesByStatus = Object.fromEntries(OPPORTUNITY_STATUSES.map((status) => [status, 0]));
  for (const opportunity of db.opportunities) {
    opportunitiesByStatus[opportunity.status] = (opportunitiesByStatus[opportunity.status] ?? 0) + 1;
  }

  const activeAllocateds = db.allocateds.filter((allocated) => (
    allocated.active === true
    && !isAllocatedAlsoActiveInCandidatePool(allocated, db)
  ));
  const allocatedsByClient = Object.fromEntries(db.clients.map((client) => [client.customerName, 0]));
  for (const allocated of activeAllocateds) {
    const client = db.clients.find((item) => item.id === allocated.clientId);
    const clientName = client?.customerName || 'Sem cliente';
    allocatedsByClient[clientName] = (allocatedsByClient[clientName] ?? 0) + 1;
  }

  const timeByStage = Object.fromEntries(CANDIDATE_STAGES.map((stage) => [stage, []]));
  for (const candidate of db.candidates) {
    for (const history of candidate.stageHistory ?? []) {
      const enteredAt = new Date(history.enteredAt);
      const leftAt = history.leftAt ? new Date(history.leftAt) : now;
      const diffDays = Math.max(0, (leftAt - enteredAt) / (1000 * 60 * 60 * 24));
      if (Number.isFinite(diffDays)) {
        timeByStage[history.stage]?.push(diffDays);
      }
    }
  }

  const averageDaysByStage = Object.fromEntries(
    Object.entries(timeByStage).map(([stage, values]) => [
      stage,
      values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0
    ])
  );

  const approvedByMonth = {};
  for (const candidate of db.candidates) {
    const approvedHistory = (candidate.stageHistory ?? []).find((item) => item.stage === 'Aprovado');
    if (!approvedHistory) continue;
    const date = new Date(approvedHistory.enteredAt);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    approvedByMonth[month] = (approvedByMonth[month] ?? 0) + 1;
  }

  return {
    totals: {
      openOpportunities,
      wonCurrentMonth: wonCurrentMonth.length,
      wonContractValueCurrentMonth,
      activeAllocateds: activeAllocateds.length,
      activeContractValue,
      candidates: db.candidates.length,
      clients: db.clients.length,
      averageAderencia: db.candidates.length
        ? Number((db.candidates.reduce((sum, candidate) => sum + Number(candidate.aderencia ?? 0), 0) / db.candidates.length).toFixed(1))
        : 0
    },
    candidatesByStage,
    opportunitiesByStatus,
    wonByModelCurrentMonth,
    wonContractValueByMonth,
    allocatedsByClient,
    averageDaysByStage,
    approvedByMonth
  };
}

export function syncCandidatesWithOpportunityClosures(db, now = new Date()) {
  const closedRejectedOpportunities = new Set(
    db.opportunities
      .filter((opportunity) => ['Closed', 'LOST'].includes(opportunity.status) && String(opportunity.closingDate ?? '').trim())
      .map((opportunity) => opportunity.id)
  );

  for (const candidate of db.candidates) {
    if (!closedRejectedOpportunities.has(candidate.opportunityId) || candidate.stage === 'Reprovado') {
      continue;
    }
    moveCandidateStage(candidate, 'Reprovado', now);
    candidate.approved = false;
    candidate.status = 'Reprovado';
  }

  return db;
}

export function moveCandidateStage(candidate, nextStage, now = new Date()) {
  normalizeStage(nextStage);
  const timestamp = toISODate(now);

  if (candidate.stage === nextStage) {
    return candidate;
  }

  const history = Array.isArray(candidate.stageHistory) ? candidate.stageHistory : [];
  const currentEntry = history.findLast?.((item) => item.stage === candidate.stage && !item.leftAt);

  if (currentEntry) {
    currentEntry.leftAt = timestamp;
  } else if (candidate.stageEnteredAt) {
    history.push({
      stage: candidate.stage,
      enteredAt: candidate.stageEnteredAt,
      leftAt: timestamp
    });
  }

  history.push({
    stage: nextStage,
    enteredAt: timestamp,
    leftAt: ''
  });

  candidate.stage = nextStage;
  candidate.stageEnteredAt = timestamp;
  candidate.status = nextStage === 'Aprovado' || nextStage === 'Reprovado' ? nextStage : 'Em andamento';
  candidate.approved = nextStage === 'Aprovado' ? true : candidate.approved;
  candidate.stageHistory = history;

  return candidate;
}

