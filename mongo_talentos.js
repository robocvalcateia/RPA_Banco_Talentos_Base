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
  const collectionName = env.MONGODB_CURRICULUM_COLLECTION || 'curriculums';
  const legacyCollectionName = env.MONGODB_LEGACY_CURRICULUM_COLLECTION || env.MONGODB_COLLECTION || 'candidatos';
  return {
    url: env.MONGODB_URL || env.MONGODB_URI || '',
    dbName: env.MONGODB_DB || 'Banco_de_Talentos',
    collectionName,
    legacyCollectionName: legacyCollectionName === collectionName ? '' : legacyCollectionName,
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

export function mongoCandidateToCurriculum(doc = {}) {
  const mongoId = normalizeMongoId(doc._id);
  const idControle = String(doc.id_controle ?? doc.idControle ?? '').trim();
  const id = idControle || (mongoId ? `mongo_${mongoId}` : '');
  const { _id, ...documentFields } = doc;

  return normalizeCurriculum({
    ...documentFields,
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
    skills: doc.skills ?? doc.Skil,
    formacao_academica: doc.formacao_academica ?? doc.Formacao_Academica,
    nivel_ingles: doc.nivel_ingles ?? doc.Nivel_Idioma_Ingles,
    nivel_espanhol: doc.nivel_espanhol ?? doc.Nivel_Idioma_Espanhol,
    cursos_certificacoes: doc.cursos_certificacoes ?? doc.Cursos_Certificacoes,
    conhecimento_tecnico: doc.conhecimento_tecnico ?? doc.Conhecimento_Tecnico,
    experiencia_profissional: doc.experiencia_profissional ?? doc.Experiencia_Profissional,
    hash_documento: doc.hash_documento,
    fonte: doc.fonte || 'email',
    data_criacao: dateToString(doc.data_criacao),
    data_atualizacao: dateToString(doc.data_atualizacao),
    data_origem: dateToString(doc.data_origem),
    versoes: Array.isArray(doc.versoes) ? doc.versoes : [],
    experiencias: doc.experiencias,
    experiences: doc.experiences,
    atividades: doc.atividades,
    atividades_exercidas: doc.atividades_exercidas ?? doc.atividadesExercidas,
    empresas: doc.empresas,
    projetos: doc.projetos,
    tecnologias: doc.tecnologias,
    search_text: doc.search_text ?? doc.texto_pesquisa,
    search_text_all: searchableTextFromValue(doc),
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
  const db = client.db(config.dbName);
  const target = db.collection(config.collectionName);

  if (!config.legacyCollectionName) {
    return target;
  }

  const [targetCount, legacyCount] = await Promise.all([
    target.countDocuments({}).catch(() => 0),
    db.collection(config.legacyCollectionName).countDocuments({}).catch(() => 0)
  ]);

  return targetCount || !legacyCount ? target : db.collection(config.legacyCollectionName);
}

export async function getCurriculumsFromMongo() {
  const config = readMongoConfig();
  const collection = await getMongoTalentosCollection();

  const docs = await collection
    .find({})
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

function buildLegacySyncQuery(doc = {}) {
  const or = [];
  const hash = String(doc.hash_documento || '').trim();
  const email = String(doc.email || '').trim().toLowerCase();
  const telefone = String(doc.telefone || '').trim();
  const linkedin = String(doc.linkedin || '').trim();

  if (hash) or.push({ hash_documento: hash });
  if (email) or.push({ email });
  if (telefone) or.push({ telefone });
  if (linkedin) or.push({ linkedin });

  return or.length ? { $or: or } : null;
}

async function findLegacySyncTarget(collection, doc = {}) {
  const hash = String(doc.hash_documento || '').trim();
  const email = String(doc.email || '').trim().toLowerCase();
  const telefone = String(doc.telefone || '').trim();
  const linkedin = String(doc.linkedin || '').trim();

  for (const query of [
    hash ? { hash_documento: hash } : null,
    email ? { email } : null,
    telefone ? { telefone } : null,
    linkedin ? { linkedin } : null
  ].filter(Boolean)) {
    const existing = await collection.findOne(query);
    if (existing) return existing;
  }

  return null;
}

function legacyCandidateDocumentToCurriculumDoc(doc = {}) {
  const curriculum = mongoCandidateToCurriculum(doc);
  const { _id, ...rawFields } = doc;
  const legacyMongoId = normalizeMongoId(_id);

  return {
    ...rawFields,
    ...curriculum,
    mongoId: curriculum.mongoId || legacyMongoId,
    legacy_candidato_id: legacyMongoId,
    legacy_id_controle: String(doc.id_controle || doc.idControle || '').trim(),
    fonte: curriculum.fonte || doc.fonte || 'email',
    search_text_all: curriculum.search_text_all || searchableTextFromValue(doc)
  };
}

export async function syncLegacyCandidatesIntoCurriculums() {
  const config = readMongoConfig();

  if (!config.legacyCollectionName || config.legacyCollectionName === config.collectionName) {
    return {
      changed: false,
      sourceName: config.legacyCollectionName || config.collectionName,
      targetName: config.collectionName,
      sourceTotal: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      message: 'Collection legada ja aponta para curriculums.'
    };
  }

  const client = await getMongoClient(config);
  const db = client.db(config.dbName);
  const source = db.collection(config.legacyCollectionName);
  const target = db.collection(config.collectionName);
  const sourceTotal = await source.countDocuments({}).catch(() => 0);

  if (!sourceTotal) {
    return {
      changed: false,
      sourceName: config.legacyCollectionName,
      targetName: config.collectionName,
      sourceTotal,
      inserted: 0,
      updated: 0,
      skipped: 0,
      message: 'Nenhum candidato legado para sincronizar.'
    };
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const cursor = source.find({});

  for await (const legacyDoc of cursor) {
    const payload = legacyCandidateDocumentToCurriculumDoc(legacyDoc);
    if (!payload.nome && !payload.email && !payload.telefone) {
      skipped += 1;
      continue;
    }

    const query = buildLegacySyncQuery(payload);
    const existing = query ? await findLegacySyncTarget(target, payload) : null;
    const now = new Date().toISOString();
    const payloadToSave = { ...payload };

    if (!String(payloadToSave.email || '').trim()) {
      delete payloadToSave.email;
    }

    if (existing) {
      payloadToSave.id_controle = existing.id_controle || payloadToSave.id_controle || existing.id || '';
      payloadToSave.id = existing.id || payloadToSave.id_controle || payloadToSave.id || '';
      payloadToSave.data_criacao = existing.data_criacao || payloadToSave.data_criacao || now;
      payloadToSave.data_atualizacao = payloadToSave.data_atualizacao || now;

      await target.updateOne(
        { _id: existing._id },
        { $set: payloadToSave }
      );
      updated += 1;
      continue;
    }

    payloadToSave.id_controle = String(await getNextIdControle(target));
    payloadToSave.id = payloadToSave.id_controle;
    payloadToSave.data_criacao = payloadToSave.data_criacao || now;
    payloadToSave.data_atualizacao = payloadToSave.data_atualizacao || now;

    try {
      await target.insertOne(payloadToSave);
      inserted += 1;
    } catch (error) {
      if (error?.code === 11000) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return {
    changed: inserted > 0 || updated > 0,
    sourceName: config.legacyCollectionName,
    targetName: config.collectionName,
    sourceTotal,
    inserted,
    updated,
    skipped,
    message: `Sincronizacao legado -> curriculums: ${inserted} novo(s), ${updated} atualizado(s), ${skipped} ignorado(s).`
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

export async function createCurriculumInMongo(payload = {}) {
  await loadMongoDriver();
  const collection = await getMongoTalentosCollection();
  const doc = curriculumPayloadToMongoUpdate(payload);

  if (!doc.nome) {
    throw new Error('Informe o nome do candidato.');
  }

  const duplicateChecks = [];
  if (doc.email) duplicateChecks.push({ email: doc.email });
  if (doc.id_controle) duplicateChecks.push({ id_controle: doc.id_controle });
  if (payload.hash_documento) duplicateChecks.push({ hash_documento: String(payload.hash_documento).trim() });

  if (duplicateChecks.length) {
    const existing = await collection.findOne({ $or: duplicateChecks });
    if (existing) {
      throw new Error('Ja existe um curriculo com os dados informados.');
    }
  }

  if (!doc.id_controle) {
    doc.id_controle = String(await getNextIdControle(collection));
  }
  if (payload.hash_documento) {
    doc.hash_documento = String(payload.hash_documento).trim();
  }
  doc.data_criacao = String(payload.data_criacao || new Date().toISOString()).trim();
  doc.data_atualizacao = String(payload.data_atualizacao || '').trim();

  const result = await collection.insertOne(doc);
  return mongoCandidateToCurriculum({ ...doc, _id: result.insertedId });
}
const COUNTER_ID = 'curriculums_id_controle';

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

export async function renameLegacyCurriculumsCollection() {
  const config = readMongoConfig();
  const client = await getMongoClient(config);
  const db = client.db(config.dbName);
  const sourceName = config.legacyCollectionName || 'candidatos';
  const targetName = config.collectionName || 'curriculums';

  if (!sourceName || sourceName === targetName) {
    return {
      changed: false,
      sourceName,
      targetName,
      message: 'Origem e destino ja apontam para a mesma collection.'
    };
  }

  const collectionNames = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((collection) => collection.name)
  );
  const sourceExists = collectionNames.has(sourceName);
  const targetExists = collectionNames.has(targetName);

  if (!sourceExists && targetExists) {
    const total = await db.collection(targetName).countDocuments({});
    return {
      changed: false,
      sourceName,
      targetName,
      total,
      message: `Migration already applied: ${targetName} exists.`
    };
  }

  if (!sourceExists && !targetExists) {
    return {
      changed: false,
      sourceName,
      targetName,
      total: 0,
      message: `Neither ${sourceName} nor ${targetName} exists.`
    };
  }

  if (sourceExists && targetExists) {
    const [sourceTotal, targetTotal] = await Promise.all([
      db.collection(sourceName).countDocuments({}),
      db.collection(targetName).countDocuments({})
    ]);

    if (targetTotal > 0) {
      return {
        changed: false,
        sourceName,
        targetName,
        sourceTotal,
        targetTotal,
        message: `Both collections exist and target is not empty. Manual review required.`
      };
    }

    await db.collection(targetName).drop();
  }

  await db.collection(sourceName).rename(targetName, { dropTarget: false });
  const total = await db.collection(targetName).countDocuments({});

  return {
    changed: true,
    sourceName,
    targetName,
    total,
    message: `Collection renamed from ${sourceName} to ${targetName}.`
  };
}
