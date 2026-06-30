import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_FILE,
  MONGO_APP_COLLECTIONS,
  readLocalDatabase,
  writeMongoAppDatabase
} from '../db.js';

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

process.env.MONGODB_APP_COLLECTIONS = process.env.MONGODB_APP_COLLECTIONS || 'true';

if (!process.env.MONGODB_URL && !process.env.MONGODB_URI) {
  throw new Error('Configure MONGODB_URL ou MONGODB_URI antes de migrar.');
}

const db = await readLocalDatabase(DATA_FILE);
const payload = {
  ...db,
  curriculums: []
};

await writeMongoAppDatabase(payload);

const counts = Object.fromEntries(
  MONGO_APP_COLLECTIONS.map((collection) => [collection, Array.isArray(db[collection]) ? db[collection].length : 0])
);

console.log(JSON.stringify({
  ok: true,
  database: process.env.MONGODB_DB || 'Banco_de_Talentos',
  migratedCollections: counts,
  skippedCollection: 'curriculums',
  sourceFile: DATA_FILE
}, null, 2));
