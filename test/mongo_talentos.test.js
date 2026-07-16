import test from 'node:test';
import assert from 'node:assert/strict';
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
