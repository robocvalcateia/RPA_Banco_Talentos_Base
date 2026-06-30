import { MongoClient } from 'mongodb';

const url = process.env.MONGODB_URL || process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB || 'Banco_de_Talentos';
const fromCollection = process.env.MONGODB_RENAME_FROM || 'candidatos';
const toCollection = process.env.MONGODB_CURRICULUM_COLLECTION || process.env.MONGODB_RENAME_TO || 'curriculums';

if (!url) {
  throw new Error('Configure MONGODB_URL ou MONGODB_URI antes de executar a migração.');
}

if (!fromCollection || !toCollection) {
  throw new Error('Informe os nomes das collections de origem e destino.');
}

if (fromCollection === toCollection) {
  console.log(`Nada a fazer: origem e destino já são "${toCollection}".`);
  process.exit(0);
}

const client = new MongoClient(url, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000
});

try {
  await client.connect();
  await client.db('admin').command({ ping: 1 });

  const db = client.db(dbName);
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const collectionNames = new Set(collections.map((collection) => collection.name));

  const fromExists = collectionNames.has(fromCollection);
  const toExists = collectionNames.has(toCollection);

  if (!fromExists && toExists) {
    const total = await db.collection(toCollection).countDocuments({});
    console.log(`Migração já aplicada: "${toCollection}" existe com ${total} documento(s).`);
    process.exit(0);
  }

  if (!fromExists && !toExists) {
    throw new Error(`Collection de origem "${fromCollection}" não existe e destino "${toCollection}" também não existe.`);
  }

  if (fromExists && toExists) {
    const [fromTotal, toTotal] = await Promise.all([
      db.collection(fromCollection).countDocuments({}),
      db.collection(toCollection).countDocuments({})
    ]);

    throw new Error(
      `Migração bloqueada: as duas collections existem. ` +
      `"${fromCollection}" tem ${fromTotal} documento(s) e "${toCollection}" tem ${toTotal} documento(s). ` +
      'Revise manualmente antes de consolidar para evitar perda ou duplicidade.'
    );
  }

  await db.collection(fromCollection).rename(toCollection, { dropTarget: false });
  const total = await db.collection(toCollection).countDocuments({});
  console.log(`Collection renomeada: "${fromCollection}" -> "${toCollection}". Total: ${total} documento(s).`);
} finally {
  await client.close().catch(() => null);
}
