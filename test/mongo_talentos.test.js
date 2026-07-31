import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateCandidateTextForFilter } from '../apinfo.js';
import { __mongoTalentosTest } from '../mongo_talentos.js';

function matchesQuery(doc, query) {
  if (query.$or) return query.$or.some((item) => matchesQuery(doc, item));

  return Object.entries(query).every(([field, value]) => doc[field] === value);
}

function createFakeCollection(initialDocs = []) {
  const docs = initialDocs.map((doc) => ({ ...doc }));

  return {
    docs,
    async findOne(query) {
      return docs.find((doc) => matchesQuery(doc, query)) || null;
    },
    async updateOne(query, update) {
      const doc = docs.find((item) => matchesQuery(item, query));
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };

      const payload = update.$set || {};
      for (const field of ['email', 'telefone', 'linkedin', 'hash_documento', 'id_controle']) {
        if (!payload[field]) continue;
        const conflict = docs.find((item) => item._id !== doc._id && item[field] === payload[field]);
        if (conflict) {
          const error = new Error(`E11000 duplicate key error dup key: { ${field}: "${payload[field]}" }`);
          error.code = 11000;
          error.keyValue = { [field]: payload[field] };
          throw error;
        }
      }

      Object.assign(doc, payload);
      return { matchedCount: 1, modifiedCount: 1 };
    }
  };
}

test('sincronizacao legado trata identificadores cruzados sem falhar com duplicate key', async () => {
  const collection = createFakeCollection([
    {
      _id: 'doc_hash',
      id_controle: '10',
      id: '10',
      nome: 'Pessoa Hash',
      email: 'antigo@example.com',
      hash_documento: 'hash-1',
      data_criacao: '2026-07-01T00:00:00.000Z'
    },
    {
      _id: 'doc_email',
      id_controle: '11',
      id: '11',
      nome: 'Pessoa Email',
      email: 'novo@example.com'
    }
  ]);

  const payload = {
    nome: 'Pessoa Atualizada',
    email: 'novo@example.com',
    hash_documento: 'hash-1',
    telefone: '11999999999'
  };

  const existing = await __mongoTalentosTest.findLegacySyncTarget(collection, payload);
  const result = await __mongoTalentosTest.writeLegacySyncUpdate(collection, existing, payload);

  assert.deepEqual(result.conflicts, ['email']);
  assert.equal(collection.docs[0].nome, 'Pessoa Atualizada');
  assert.equal(collection.docs[0].email, 'antigo@example.com');
  assert.equal(collection.docs[0].telefone, '11999999999');
  assert.equal(collection.docs[0].id_controle, '10');
});

test('sincronizacao legado remove identificadores vazios antes de gravar', () => {
  const payload = __mongoTalentosTest.normalizeLegacySyncPayload({
    nome: 'Pessoa Sem Email',
    email: '   ',
    telefone: '',
    linkedin: null,
    hash_documento: undefined
  });

  assert.equal(payload.nome, 'Pessoa Sem Email');
  assert.equal(Object.hasOwn(payload, 'email'), false);
  assert.equal(Object.hasOwn(payload, 'telefone'), false);
  assert.equal(Object.hasOwn(payload, 'linkedin'), false);
  assert.equal(Object.hasOwn(payload, 'hash_documento'), false);
});

test('sincronizacao legado monta query a partir da chave duplicada do MongoDB', () => {
  const error = new Error('duplicate key');
  error.code = 11000;
  error.keyValue = { email: 'Pessoa@Example.com ' };

  assert.deepEqual(__mongoTalentosTest.duplicateKeyQueryFromError(error), {
    email: 'pessoa@example.com'
  });
});

test('leitura de curriculos no Mongo permite sort em disco e tem indice de ordenacao', () => {
  const mongoSource = readFileSync(new URL('../mongo_talentos.js', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('../scripts/create_mongo_indexes.mjs', import.meta.url), 'utf8');

  assert.match(mongoSource, /\.find\(\{\}\)\s*\.allowDiskUse\(true\)\s*\.sort\(\{ data_atualizacao: -1, data_criacao: -1, _id: -1 \}\)/);
  assert.match(indexSource, /data_atualizacao: -1, data_criacao: -1, _id: -1/);
  assert.match(indexSource, /idx_curriculum_load_order/);
});

test('candidato selecionado nao usa observacao como experiencia ou conhecimento tecnico', () => {
  const payload = __mongoTalentosTest.selectedCandidateToMongoPayload(
    {
      name: 'Rodrigo Aparecido de Castro Moura',
      observation: 'CV encaminhado para avaliacao em 21/07/26'
    },
    {
      cvFilter: {
        mandatorySkills: '.NET, React',
        jobDescription: 'Desenvolver integrações'
      }
    }
  );

  assert.equal(payload.nome, 'Rodrigo Aparecido de Castro Moura');
  assert.equal(payload.observacao_busca, 'CV encaminhado para avaliacao em 21/07/26');
  assert.equal(Object.hasOwn(payload, 'experiencia_profissional'), false);
  assert.equal(Object.hasOwn(payload, 'conhecimento_tecnico'), false);
  assert.equal(Object.hasOwn(payload, 'skills'), false);
});

test('filtro de CV exige listas preenchidas, skills obrigatorias e percentual minimo da JD', () => {
  const filter = {
    state: 'SP',
    city: 'Sao Paulo',
    englishLevel: 'Fluente',
    mandatorySkills: 'SAP, PMP',
    jobDescription: 'Gerente de projetos Activate',
    matchPercent: 80
  };
  const acceptedText = [
    'Consultor em Sao Paulo SP',
    'Ingles fluente',
    'SAP PMP',
    'Gerente de projetos Activate'
  ].join('\n');
  const missingMandatoryText = acceptedText.replace('PMP', '');
  const lowScoreText = [
    'Consultor em Sao Paulo SP',
    'Ingles fluente',
    'SAP PMP',
    'Gerente de projetos'
  ].join('\n');
  const missingListText = [
    'Consultor em Curitiba PR',
    'Ingles fluente',
    'SAP PMP',
    'Gerente de projetos Activate'
  ].join('\n');

  assert.equal(evaluateCandidateTextForFilter(acceptedText, filter).accepted, true);
  assert.equal(evaluateCandidateTextForFilter(missingMandatoryText, filter).accepted, false);
  assert.match(evaluateCandidateTextForFilter(missingMandatoryText, filter).reason, /habilidade obrigatoria/i);
  assert.equal(evaluateCandidateTextForFilter(lowScoreText, filter).accepted, false);
  assert.match(evaluateCandidateTextForFilter(lowScoreText, filter).reason, /abaixo do minimo/i);
  assert.equal(evaluateCandidateTextForFilter(missingListText, filter).accepted, false);
  assert.match(evaluateCandidateTextForFilter(missingListText, filter).reason, /filtro obrigatorio/i);
});

test('candidato selecionado preserva campos estruturados quando vierem explicitamente do curriculo', () => {
  const payload = __mongoTalentosTest.selectedCandidateToMongoPayload({
    name: 'Pessoa Técnica',
    skills: 'Node.js',
    technicalKnowledge: 'APIs REST e MongoDB',
    professionalExperience: 'Desenvolvimento de microsserviços'
  });

  assert.equal(payload.skills, 'Node.js');
  assert.equal(payload.conhecimento_tecnico, 'APIs REST e MongoDB');
  assert.equal(payload.experiencia_profissional, 'Desenvolvimento de microsserviços');
});

test('update de curriculo no Mongo preserva texto integral e estruturas ricas', () => {
  const update = __mongoTalentosTest.curriculumPayloadToMongoUpdate({
    nome: 'Pessoa Completa',
    experiencia_profissional: 'Experiencia resumida',
    search_text_all: 'Texto integral com projetos, resultados e bullets',
    hash_documento: 'hash-1',
    versoes: [{ dados: { Experiencia_Profissional: 'Historico completo' } }],
    experiencias: [{ empresa: 'Empresa A', detalhes: ['Projeto A'] }]
  });

  assert.equal(update.search_text_all, 'Texto integral com projetos, resultados e bullets');
  assert.equal(update.hash_documento, 'hash-1');
  assert.equal(update.versoes.length, 1);
  assert.equal(update.experiencias.length, 1);
});

test('update de curriculo no Mongo ignora hash_documento vazio', () => {
  const update = __mongoTalentosTest.curriculumPayloadToMongoUpdate({
    nome: 'Pessoa Sem Hash',
    hash_documento: ''
  });

  assert.equal(Object.hasOwn(update, 'hash_documento'), false);
});
