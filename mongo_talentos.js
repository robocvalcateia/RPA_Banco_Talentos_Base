import { normalizeCurriculum } from './db.js';

let mongoClient = null;
let mongoClientUrl = '';
let MongoClientCtor = null;
let ObjectIdCtor = null;

async function loadMongoDriver() {
  if (MongoClientCtor && ObjectIdCtor) return { MongoClient: MongoClientCtor, ObjectId: ObjectIdCtor };
  try {
    const driver = await import('mongodb');
    MongoClientCtor = driver.MongoClient;
    ObjectIdCtor = driver.ObjectId;
    return { MongoClient: MongoClientCtor, ObjectId: ObjectIdCtor };
  } catch {
    throw new Error('Dependencia mongodb nao instalada. Rode npm install antes de usar MONGODB_URL.');
  }
}

function readMongoConfig(env = process.env) {
  return {
    url: env.MONGODB_URL || env.MONGODB_URI || '',
    dbName: env.MONGODB_DB || 'Banco_de_Talentos',
    collectionName: env.MONGODB_COLLECTION || 'candidatos',
    limit: Math.max(1, Math.min(Number(env.MONGODB_CURRICULUM_LIMIT || 5000), 20000))
  };
}

export function isMongoTalentosConfigured(env = process.env) {
  const config = readMongoConfig(env);
  return Boolean(config.url && config.dbName && config.collectionName);
}

async function getMongoClient(config = readMongoConfig()) {
  if (mongoClient && mongoClientUrl === config.url) {
    return mongoClient;
  }

  if (mongoClient) {
    await mongoClient.close().catch(() => null);
  }

  const { MongoClient } = await loadMongoDriver();
  mongoClient = new MongoClient(config.url, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 30000
  });
  await mongoClient.connect();
  await mongoClient.db('admin').command({ ping: 1 });
  mongoClientUrl = config.url;
  return mongoClient;
}

function dateToString(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeMongoId(value) {
  if (!value) return '';
  if (ObjectIdCtor && value instanceof ObjectIdCtor) return value.toHexString();
  if (typeof value === 'object' && value.$oid) return String(value.$oid);
  return String(value);
}

export function mongoCandidateToCurriculum(doc = {}) {
  const mongoId = normalizeMongoId(doc._id);
  const idControle = String(doc.id_controle ?? doc.idControle ?? '').trim();
  const id = idControle || (mongoId ? `mongo_${mongoId}` : '');

  return normalizeCurriculum({
    id,
    mongoId,
    id_controle: idControle || id,
    nome: doc.nome,
    email: doc.email,
    telefone: doc.telefone,
    endereco: doc.endereco,
    nacionalidade: doc.nacionalidade,
    estado_civil: doc.estado_civil,
    idade: doc.idade,
    linkedin: doc.linkedin,
    skills: doc.skills,
    formacao_academica: doc.formacao_academica,
    nivel_ingles: doc.nivel_ingles,
    nivel_espanhol: doc.nivel_espanhol,
    cursos_certificacoes: doc.cursos_certificacoes,
    conhecimento_tecnico: doc.conhecimento_tecnico,
    experiencia_profissional: doc.experiencia_profissional,
    hash_documento: doc.hash_documento,
    fonte: doc.fonte || 'email',
    data_criacao: dateToString(doc.data_criacao),
    data_atualizacao: dateToString(doc.data_atualizacao),
    data_origem: dateToString(doc.data_origem),
    versoes: Array.isArray(doc.versoes) ? doc.versoes : [],
    data_nascimento: dateToString(doc.data_nascimento),
    cargo_alvo: doc.cargo_alvo,
    observacoes_entrevista: doc.observacoes_entrevista,
    feedback_entrevista_ingles: doc.feedback_entrevista_ingles,
    disponibilidade_viagem: doc.disponibilidade_viagem
  });
}

export async function getMongoTalentosCollection() {
  const config = readMongoConfig();
  const client = await getMongoClient(config);
  return client.db(config.dbName).collection(config.collectionName);
}

export async function getCurriculumsFromMongo() {
  const config = readMongoConfig();
  const client = await getMongoClient(config);
  const collection = client.db(config.dbName).collection(config.collectionName);

  const projection = {
    _id: 1,
    id_controle: 1,
    nome: 1,
    email: 1,
    telefone: 1,
    endereco: 1,
    nacionalidade: 1,
    estado_civil: 1,
    idade: 1,
    linkedin: 1,
    skills: 1,
    formacao_academica: 1,
    nivel_ingles: 1,
    nivel_espanhol: 1,
    cursos_certificacoes: 1,
    conhecimento_tecnico: 1,
    experiencia_profissional: 1,
    hash_documento: 1,
    fonte: 1,
    data_criacao: 1,
    data_atualizacao: 1,
    data_origem: 1,
    versoes: 1,
    data_nascimento: 1,
    cargo_alvo: 1,
    observacoes_entrevista: 1,
    feedback_entrevista_ingles: 1,
    disponibilidade_viagem: 1
  };

  const docs = await collection
    .find({}, { projection })
    .sort({ data_atualizacao: -1, data_criacao: -1, _id: -1 })
    .limit(config.limit)
    .toArray();

  const total = await collection.countDocuments({});
  const curriculums = docs.map(mongoCandidateToCurriculum);

  return {
    source: 'mongodb',
    total,
    limit: config.limit,
    curriculums
  };
}

export async function getMongoTalentStats() {
  const collection = await getMongoTalentosCollection();
  const [total, email, whatsapp, comEmail, comTelefone] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ fonte: 'email' }),
    collection.countDocuments({ fonte: 'whatsapp' }),
    collection.countDocuments({ email: { $nin: ['', null] } }),
    collection.countDocuments({ telefone: { $nin: ['', null] } })
  ]);

  return {
    total_candidatos: total,
    origem_email: email,
    origem_whatsapp: whatsapp,
    com_email: comEmail,
    com_telefone: comTelefone
  };
}

function buildCandidateIdentifierQuery(identifier) {
  const value = String(identifier || '').trim();
  if (!value) return null;

  const or = [
    { id_controle: value },
    { idControle: value },
    { id: value }
  ];

  const cleanMongoId = value.replace(/^mongo_/, '');
  if (ObjectIdCtor && /^[0-9a-fA-F]{24}$/.test(cleanMongoId)) {
    try {
      or.unshift({ _id: new ObjectIdCtor(cleanMongoId) });
    } catch {
      // Ignore invalid ObjectId conversion.
    }
  }

  return { $or: or };
}

export async function getCurriculumFromMongo(identifier) {
  await loadMongoDriver();
  const collection = await getMongoTalentosCollection();
  const query = buildCandidateIdentifierQuery(identifier);
  if (!query) return null;

  const doc = await collection.findOne(query);
  return doc ? mongoCandidateToCurriculum(doc) : null;
}

function curriculumPayloadToMongoUpdate(payload = {}) {
  const allowedFields = [
    'id_controle',
    'nome',
    'email',
    'telefone',
    'endereco',
    'nacionalidade',
    'estado_civil',
    'idade',
    'linkedin',
    'skills',
    'formacao_academica',
    'nivel_ingles',
    'nivel_espanhol',
    'cursos_certificacoes',
    'conhecimento_tecnico',
    'experiencia_profissional',
    'fonte',
    'data_nascimento',
    'cargo_alvo',
    'observacoes_entrevista',
    'feedback_entrevista_ingles',
    'disponibilidade_viagem'
  ];

  const update = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      update[field] = String(payload[field] ?? '').trim();
    }
  }

  update.data_atualizacao = new Date().toISOString();
  return update;
}

export async function updateCurriculumInMongo(identifier, payload = {}) {
  await loadMongoDriver();
  const collection = await getMongoTalentosCollection();
  const query = buildCandidateIdentifierQuery(identifier);
  if (!query) return null;

  const update = curriculumPayloadToMongoUpdate(payload);
  if (!update.nome) {
    throw new Error('Informe o nome do candidato.');
  }

  const result = await collection.findOneAndUpdate(
    query,
    { $set: update },
    { returnDocument: 'after' }
  );

  const doc = result?.value || result;
  return doc ? mongoCandidateToCurriculum(doc) : null;
}
const COUNTER_ID = 'candidatos_id_controle';

function normalizarTextoChave(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function limparNomeCandidato(value) {
  const raw = String(value || '').trim();

  if (!raw) return '';

  // Exemplo: "William Magliari - Business Analyst | RPA Developer"
  // Salva como nome principal: "William Magliari"
  return raw.split(/\s[-–—]\s/)[0].trim() || raw;
}

function extrairTituloDoResultado(value) {
  const raw = String(value || '').trim();
  const partes = raw.split(/\s[-–—]\s/);

  if (partes.length <= 1) return '';

  return partes.slice(1).join(' - ').trim();
}

async function getNextIdControle(collection) {
  const config = readMongoConfig();
  const client = await getMongoClient(config);
  const counters = client.db(config.dbName).collection('contadores');

  const docs = await collection
    .find(
      { id_controle: { $exists: true, $nin: [null, ''] } },
      { projection: { id_controle: 1 } }
    )
    .toArray();

  const maiorIdAtual = docs.reduce((maior, doc) => {
    const numero = Number(String(doc.id_controle || '').trim());
    return Number.isFinite(numero) ? Math.max(maior, numero) : maior;
  }, 0);

  await counters.updateOne(
    { _id: COUNTER_ID },
    { $max: { seq: maiorIdAtual } },
    { upsert: true }
  );

  const result = await counters.findOneAndUpdate(
    { _id: COUNTER_ID },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  const doc = result?.value || result;
  const seq = Number(doc?.seq || maiorIdAtual + 1);

  return String(seq).padStart(2, '0');
}

function selectedCandidateToMongoPayload(candidate = {}, context = {}) {
  const now = new Date().toISOString();

  const rawName = candidate.name || candidate.nome || '';
  const nome = limparNomeCandidato(rawName);
  const titulo = extrairTituloDoResultado(rawName);

  const link = String(candidate.link || '').trim();
  const fonteBusca = String(candidate.source || candidate.fonte || 'Filtro de CVs').trim();

  const cvFilter = context.cvFilter || {};
  const opportunity = context.opportunity || {};
  const user = context.user || {};

  const skills = [
    candidate.skills,
    cvFilter.mandatorySkills,
    titulo
  ]
    .filter(Boolean)
    .join(', ');

  const conhecimentoTecnico = [
    cvFilter.jobDescription,
    candidate.observation
  ]
    .filter(Boolean)
    .join('\n\n');

  const payload = {
    nome,
    skills,
    conhecimento_tecnico: conhecimentoTecnico,
    experiencia_profissional: String(candidate.observation || '').trim(),
    fonte: fonteBusca,
    data_atualizacao: now,

    nome_original_busca: rawName,
    nome_normalizado: normalizarTextoChave(nome),
    link_origem: link,
    fonte_busca: fonteBusca,
    score_busca: Number(candidate.score || 0),
    observacao_busca: String(candidate.observation || '').trim(),
    origem_candidato: String(candidate.origin || '').trim(),

    oportunidade_id: String(opportunity.id || '').trim(),
    oportunidade_codigo: String(opportunity.opportunityCode || '').trim(),
    oportunidade_nome: String(opportunity.opportunity || '').trim(),
    cv_filter_id: String(cvFilter.id || '').trim(),
    salvo_por: String(user.email || user.name || '').trim()
  };

  const email = String(candidate.email || '').trim().toLowerCase();
  const telefone = String(candidate.telefone || candidate.phone || '').trim();
  const linkedin = /linkedin\.com/i.test(link) ? link : '';

  // Só envia para o MongoDB se realmente existir valor.
  // Isso evita duplicate key em email vazio.
  if (email) {
    payload.email = email;
  }

  if (telefone) {
    payload.telefone = telefone;
  }

  if (linkedin) {
    payload.linkedin = linkedin;
  }

  return payload;
}

function buildSelectedCandidateMongoQuery(payload = {}) {
  const or = [];

  if (payload.email) {
    or.push({ email: payload.email });
  }

  if (payload.linkedin) {
    or.push({ linkedin: payload.linkedin });
  }

  if (payload.link_origem) {
    or.push({ link_origem: payload.link_origem });
  }

  if (payload.nome_normalizado) {
    or.push({
      nome_normalizado: payload.nome_normalizado,
      fonte_busca: payload.fonte_busca || 'Filtro de CVs'
    });
  }

  if (!or.length) {
    return null;
  }

  return { $or: or };
}

export async function upsertSelectedCandidatesIntoMongo({ candidates = [], opportunity = null, cvFilter = null, user = null } = {}) {
  if (!isMongoTalentosConfigured()) {
    return candidates.map(() => null);
  }

  await loadMongoDriver();

  const collection = await getMongoTalentosCollection();
  const results = [];

  for (const candidate of candidates) {
    const payload = selectedCandidateToMongoPayload(candidate, {
      opportunity,
      cvFilter,
      user
    });

    if (!payload.nome) {
      results.push(null);
      continue;
    }

    const query = buildSelectedCandidateMongoQuery(payload);

    if (!query) {
      results.push(null);
      continue;
    }

    const existing = await collection.findOne(query);

    const update = {
      $set: payload
    };

    if (!existing) {
      update.$setOnInsert = {
        id_controle: await getNextIdControle(collection),
        data_criacao: new Date().toISOString()
      };
    }

    const result = await collection.findOneAndUpdate(
      query,
      update,
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    const doc = result?.value || result;
    results.push(doc ? mongoCandidateToCurriculum(doc) : null);
  }

  return results;
}
