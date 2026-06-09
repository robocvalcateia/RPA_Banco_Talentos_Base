import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const databasePath = path.join(rootDir, 'data', 'database.json');
const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(rootDir, 'data', 'candidatos_old.json');

function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.$date) return toText(value.$date);
    if (value.$oid) return toText(value.$oid);
    return JSON.stringify(value);
  }
  return String(value).trim();
}

function normalizeArrayOrString(value) {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ');
  return toText(value);
}

function normalizeId(value, fallbackLabel) {
  const raw = toText(value);
  if (raw) return raw;

  const hash = createHash('sha1').update(toText(fallbackLabel) || String(Date.now())).digest('hex').slice(0, 10);
  return `CV-${hash}`;
}

function normalizeCurriculum(doc) {
  const mongoId = toText(doc._id?.$oid ?? doc._id ?? doc.mongoId);
  const idControle = normalizeId(doc.id_controle ?? doc.idControle ?? doc.curriculumId, mongoId || doc.email || doc.nome);
  const nome = toText(doc.nome ?? doc.name);
  const email = toText(doc.email).toLowerCase();
  const skills = normalizeArrayOrString(doc.skills ?? doc.conhecimento_tecnico ?? doc.tecnologias);

  return {
    id: `curr_${idControle}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
    mongoId,
    nome,
    email,
    telefone: toText(doc.telefone ?? doc.phone),
    endereco: toText(doc.endereco),
    nacionalidade: toText(doc.nacionalidade),
    estado_civil: toText(doc.estado_civil),
    idade: toText(doc.idade),
    linkedin: toText(doc.linkedin),
    skills,
    formacao_academica: normalizeArrayOrString(doc.formacao_academica),
    nivel_ingles: toText(doc.nivel_ingles),
    nivel_espanhol: toText(doc.nivel_espanhol),
    cursos_certificacoes: normalizeArrayOrString(doc.cursos_certificacoes),
    conhecimento_tecnico: normalizeArrayOrString(doc.conhecimento_tecnico) || skills,
    experiencia_profissional: normalizeArrayOrString(doc.experiencia_profissional),
    hash_documento: toText(doc.hash_documento),
    fonte: toText(doc.fonte) || 'MongoDB legado',
    data_criacao: toText(doc.data_criacao) || new Date().toISOString(),
    data_atualizacao: toText(doc.data_atualizacao) || toText(doc.data_criacao) || new Date().toISOString(),
    data_origem: toText(doc.data_origem),
    versoes: Array.isArray(doc.versoes) ? doc.versoes : [],
    data_nascimento: toText(doc.data_nascimento),
    id_controle: idControle
  };
}

function dedupeKey(item) {
  if (item.email) return `email:${item.email.toLowerCase()}`;
  if (item.id_controle) return `id:${item.id_controle}`;
  if (item.mongoId) return `mongo:${item.mongoId}`;
  return `nome:${item.nome.toLowerCase()}`;
}

async function main() {
  const rawInput = await fs.readFile(inputPath, 'utf8');
  const parsedInput = JSON.parse(rawInput);
  const sourceDocs = Array.isArray(parsedInput)
    ? parsedInput
    : Array.isArray(parsedInput.data)
      ? parsedInput.data
      : Array.isArray(parsedInput.candidatos)
        ? parsedInput.candidatos
        : [];

  if (!sourceDocs.length) {
    throw new Error(`Nenhum candidato encontrado no arquivo ${inputPath}`);
  }

  const database = JSON.parse(await fs.readFile(databasePath, 'utf8'));
  database.curriculums = Array.isArray(database.curriculums) ? database.curriculums : [];

  const byKey = new Map(database.curriculums.map((item, index) => [dedupeKey(item), index]));
  let inserted = 0;
  let updated = 0;

  for (const doc of sourceDocs) {
    const curriculum = normalizeCurriculum(doc);
    if (!curriculum.nome && !curriculum.email) continue;

    const key = dedupeKey(curriculum);
    if (byKey.has(key)) {
      const index = byKey.get(key);
      database.curriculums[index] = {
        ...database.curriculums[index],
        ...curriculum,
        id: database.curriculums[index].id || curriculum.id
      };
      updated += 1;
    } else {
      database.curriculums.push(curriculum);
      byKey.set(key, database.curriculums.length - 1);
      inserted += 1;
    }
  }

  await fs.writeFile(databasePath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  console.log(`Importação concluída. Inseridos: ${inserted}. Atualizados: ${updated}. Total na base: ${database.curriculums.length}.`);
}

main().catch((error) => {
  console.error(`Erro na importação: ${error.message}`);
  process.exitCode = 1;
});
