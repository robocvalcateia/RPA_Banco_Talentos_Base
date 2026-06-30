import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function loadLocalEnv() {
  try {
    const content = await fs.readFile(path.join(rootDir, '.env'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      if (!process.env[key]) {
        process.env[key] = valueParts.join('=').trim();
      }
    }
  } catch {
    // .env local é opcional; em produção, Render injeta as variáveis.
  }
}

await loadLocalEnv();

const url = process.env.MONGODB_URL || process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB || 'Banco_de_Talentos';
const curriculumCollection = process.env.MONGODB_CURRICULUM_COLLECTION || process.env.MONGODB_COLLECTION || 'curriculums';

if (!url) {
  throw new Error('Configure MONGODB_URL ou MONGODB_URI antes de criar índices.');
}

const client = new MongoClient(url, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000
});

const indexPlan = {
  [curriculumCollection]: [
    [{ id_controle: 1 }, { unique: true, sparse: true, name: 'uid_id_controle' }],
    [{ email: 1 }, { sparse: true, name: 'idx_email' }],
    [{ telefone: 1 }, { sparse: true, name: 'idx_telefone' }],
    [{ hash_documento: 1 }, { sparse: true, name: 'idx_hash_documento' }],
    [{ nome: 'text', skills: 'text', conhecimento_tecnico: 'text', experiencia_profissional: 'text' }, { name: 'txt_curriculum_search' }]
  ],
  clients: [
    [{ id: 1 }, { unique: true, name: 'uid_id' }],
    [{ customerName: 1 }, { name: 'idx_customerName' }]
  ],
  users: [
    [{ id: 1 }, { unique: true, name: 'uid_id' }],
    [{ email: 1 }, { unique: true, name: 'uid_email' }]
  ],
  opportunities: [
    [{ id: 1 }, { unique: true, name: 'uid_id' }],
    [{ clientId: 1 }, { name: 'idx_clientId' }],
    [{ status: 1, model: 1 }, { name: 'idx_status_model' }],
    [{ openingDate: 1, closingDate: 1 }, { name: 'idx_dates' }]
  ],
  candidates: [
    [{ id: 1 }, { unique: true, name: 'uid_id' }],
    [{ opportunityId: 1 }, { name: 'idx_opportunityId' }],
    [{ curriculumId: 1 }, { name: 'idx_curriculumId' }],
    [{ stage: 1 }, { name: 'idx_stage' }]
  ],
  allocateds: [
    [{ id: 1 }, { unique: true, name: 'uid_id' }],
    [{ clientId: 1, active: 1 }, { name: 'idx_client_active' }]
  ],
  cvFilters: [
    [{ id: 1 }, { unique: true, name: 'uid_id' }],
    [{ opportunityId: 1 }, { name: 'idx_opportunityId' }]
  ],
  selectedCandidates: [
    [{ id: 1 }, { unique: true, name: 'uid_id' }],
    [{ opportunityId: 1 }, { name: 'idx_opportunityId' }],
    [{ cvFilterId: 1 }, { name: 'idx_cvFilterId' }]
  ],
  faturamento: [
    [{ id: 1 }, { unique: true, name: 'uid_id' }],
    [{ monthYear: 1 }, { unique: true, sparse: true, name: 'uid_monthYear' }]
  ]
};

try {
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  const db = client.db(dbName);

  const created = {};
  for (const [collectionName, indexes] of Object.entries(indexPlan)) {
    created[collectionName] = [];
    for (const [keys, options] of indexes) {
      await db.collection(collectionName).createIndex(keys, options);
      created[collectionName].push(options.name);
    }
  }

  console.log(JSON.stringify({ ok: true, database: dbName, indexes: created }, null, 2));
} finally {
  await client.close().catch(() => null);
}
