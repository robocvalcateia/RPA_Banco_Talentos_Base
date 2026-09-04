import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildLinkedinQueries,
  evaluateCandidateTextForFilter,
  evaluateInternalCandidateForFilter,
  evaluateLinkedinCandidateTextForFilter
} from '../apinfo.js';
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

test('leitura de curriculos no Mongo evita sort bloqueante e mantem indice de ordenacao para consultas diretas', () => {
  const mongoSource = readFileSync(new URL('../mongo_talentos.js', import.meta.url), 'utf8');
  const indexSource = readFileSync(new URL('../scripts/create_mongo_indexes.mjs', import.meta.url), 'utf8');

  assert.match(mongoSource, /CURRICULUM_BOOTSTRAP_PROJECTION/);
  assert.match(mongoSource, /projection: CURRICULUM_BOOTSTRAP_PROJECTION,\s*limit: all \? 0 : config\.limit/);
  assert.doesNotMatch(mongoSource, /sort: \{ data_atualizacao: -1, data_criacao: -1, _id: -1 \}/);
  assert.doesNotMatch(mongoSource, /texto_integral_original: 1/);
  assert.doesNotMatch(mongoSource, /versoes: 1/);
  assert.match(indexSource, /data_atualizacao: -1, data_criacao: -1, _id: -1/);
  assert.match(indexSource, /idx_curriculum_load_order/);
});

test('busca do CV original tolera acentos e arquivo sem vinculo direto', () => {
  const query = __mongoTalentosTest.originalFileNameFallbackQuery('Rogério Batista Da Cruz');
  const matchingFile = {
    filename: 'Rogerio-Batista-Da-Cruz-CV.pdf',
    metadata: {
      candidate_name: 'Rogerio Batista Da Cruz',
      original_filename: 'Rogerio-Batista-Da-Cruz-CV.pdf'
    }
  };
  const otherFile = {
    filename: 'Rogerio-Outra-Pessoa-CV.pdf',
    metadata: {
      candidate_name: 'Rogerio Outra Pessoa'
    }
  };

  assert.ok(query);
  assert.equal(__mongoTalentosTest.normalizeOriginalFileLookupText('Rogério Batista Da Cruz'), 'rogerio batista da cruz');
  assert.equal(__mongoTalentosTest.originalFileMatchesCandidate(matchingFile, 'Rogério Batista Da Cruz'), true);
  assert.equal(__mongoTalentosTest.originalFileMatchesCandidate(otherFile, 'Rogério Batista Da Cruz'), false);
});

test('busca de curriculo por identificador prioriza id_controle antes de id legado', async () => {
  const queries = __mongoTalentosTest.buildCandidateIdentifierQueries('1952');
  assert.deepEqual(queries, [
    { id_controle: '1952' },
    { idControle: '1952' },
    { id: '1952' }
  ]);

  const collection = createFakeCollection([
    {
      _id: 'doc_lucas',
      id: '1952',
      id_controle: '9999',
      nome: 'Lucas André Nobre Luz'
    },
    {
      _id: 'doc_hernandez',
      id: 'legacy-hernandez',
      id_controle: '1952',
      nome: 'Hernandez Bianch de Aquino'
    }
  ]);

  const doc = await __mongoTalentosTest.findCurriculumDocumentByIdentifier(collection, '1952');
  assert.equal(doc.nome, 'Hernandez Bianch de Aquino');
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

  assert.equal(evaluateCandidateTextForFilter(acceptedText, filter).review, true); // Unstructured city mentions are not proof of residence.
  assert.equal(evaluateCandidateTextForFilter(missingMandatoryText, filter).accepted, false);
  assert.match(evaluateCandidateTextForFilter(missingMandatoryText, filter).reason, /skill obrigatório/i);
  assert.equal(evaluateCandidateTextForFilter(lowScoreText, filter).accepted, false);
  assert.match(evaluateCandidateTextForFilter(lowScoreText, filter).reason, /skill obrigatório/i);
  assert.equal(evaluateCandidateTextForFilter(missingListText, filter).accepted, false);
  assert.match(evaluateCandidateTextForFilter(missingListText, filter).reason, /Residência não comprovada/i);
});

test('filtro de CV aceita listas em branco e cidades dentro do raio parametrizado', () => {
  const filter = {
    state: '',
    city: 'Sao Paulo',
    cityRadiusCities: ['sao paulo', 'osasco', 'barueri'],
    englishLevel: '',
    mandatorySkills: 'SAP, PMP',
    jobDescription: 'Gerente de projetos Activate',
    matchPercent: 60
  };
  const text = [
    'Consultor em Barueri',
    'SAP PMP',
    'Gerente de projetos Activate'
  ].join('\n');

  assert.equal(evaluateCandidateTextForFilter(text, filter).review, true);
});

test('filtro interno compara localizacao estruturada e aceita ingles acima do minimo', () => {
  const evaluation = evaluateInternalCandidateForFilter({
    nome: 'Pessoa Candidata',
    endereco: 'São Paulo, SP',
    nivel_ingles: 'C1 Advanced',
    skills: 'SAP S/4HANA e Project Management Professional',
    experiencia_profissional: 'Responsável pela implementação SAP S/4HANA como Project Management Professional, com SAP Activate'
  }, {
    state: 'SP',
    city: 'Sao Paulo',
    englishLevel: 'Intermediário',
    mandatorySkills: 'SAP S4HANA, PMP',
    jobDescription: 'Gerente de projetos SAP Activate',
    matchPercent: 75
  });

  assert.equal(evaluation.accepted, true);
});

test('inglês inferior é incompatibilidade operacional, não rejeição do skill', () => {
  const filter = {
    englishLevel: 'Avançado',
    mandatorySkills: '',
    jobDescription: 'Desenvolvedor Java',
    matchPercent: 50
  };

  assert.equal(evaluateCandidateTextForFilter('Desenvolvedor Java com inglês C1', filter).accepted, true);
  const lower = evaluateCandidateTextForFilter('Desenvolvedor Java com inglês B1', filter);
  assert.equal(lower.accepted, true);
  assert.equal(lower.operationalChecks.find(item => item.requirement === 'Inglês').status, 'incompatible');
});

test('busca LinkedIn v2 gera estrategias estruturadas por cargo skills e localidade', () => {
  const filter = {
    opportunity: 'Gerente de Projetos / PMO',
    city: 'Sao Paulo',
    state: 'SP',
    mandatorySkills: 'SAP, PMO',
    jobDescription: 'Gerente de projetos para rollout SAP e governanca PMO',
    resultLimit: 10
  };

  const queries = buildLinkedinQueries(filter, 10);

  assert.ok(queries.length >= 3);
  assert.match(queries[0].query, /site:linkedin\.com\/in/);
  assert.match(queries.map((item) => item.query).join('\n'), /SAP/);
  assert.match(queries.map((item) => item.query).join('\n'), /PMO/);
  assert.match(queries.map((item) => item.query).join('\n'), /Sao Paulo/);
  assert.match(queries.map((item) => item.query).join('\n'), /-recruiter/);
});

test('LinkedIn v2 classifica evidencias publicas sem rejeitar por lacuna nao evidente', () => {
  const filter = {
    opportunity: 'Gerente de Projetos / PMO',
    city: 'Sao Paulo',
    state: 'SP',
    englishLevel: 'Avancado',
    mandatorySkills: 'SAP, PMO',
    jobDescription: 'Gerente de projetos para rollout SAP e governanca PMO',
    matchPercent: 60
  };

  const reviewText = [
    'Pessoa Consultora',
    'Experiencia com SAP e PMO em projetos corporativos.'
  ].join('\n');
  const review = evaluateLinkedinCandidateTextForFilter(reviewText, filter);
  assert.equal(review.classification, 'review');
  assert.equal(review.review, true);
  assert.match(review.reason, /Residência não comprovada/);
  assert.match(review.reason, /Nível não informado/);

  const rejected = evaluateLinkedinCandidateTextForFilter('Gerente de Projetos em Sao Paulo com ingles avancado', filter);
  assert.equal(rejected.classification, 'rejected');
  assert.equal(rejected.accepted, false);
  assert.match(rejected.reason, /competência principal não evidenciada/);

  const approvedText = [
    'Gerente de Projetos PMO em Sao Paulo SP',
    'Ingles avancado',
    'Rollout SAP, governanca PMO e projetos corporativos.'
  ].join('\n');
  const approved = evaluateLinkedinCandidateTextForFilter(approvedText, filter);
  assert.equal(approved.classification, 'review');
  assert.equal(approved.accepted, false); // A public summary still requires a full CV.
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

test('texto pesquisavel do Mongo ignora metadados tecnicos', () => {
  const text = __mongoTalentosTest.searchableTextFromValue({
    nome: 'Pessoa Completa',
    experiencia_profissional: 'Empresa A - Analista. Implantou governanca.',
    hash_documento: 'bf33b3d1fd24ac098cce8bcbbf7d82ed2c561956769bda89cc8a1c2591174272',
    data_criacao: '2026-07-23T21:53:18.224589',
    cv_quality_metrics: { original_chars: 6000 },
    versoes: [{
      data: '2026-07-23T21:53:18.224589',
      dados: {
        Experiencia_Profissional: 'Empresa B - Coordenadora'
      }
    }]
  });

  assert.match(text, /Pessoa Completa/);
  assert.match(text, /Implantou governanca/);
  assert.match(text, /Empresa B - Coordenadora/);
  assert.doesNotMatch(text, /bf33b3d1/);
  assert.doesNotMatch(text, /2026-07-23T21:53:18/);
  assert.doesNotMatch(text, /original_chars/);
});

test('update de curriculo no Mongo ignora hash_documento vazio', () => {
  const update = __mongoTalentosTest.curriculumPayloadToMongoUpdate({
    nome: 'Pessoa Sem Hash',
    hash_documento: ''
  });

  assert.equal(Object.hasOwn(update, 'hash_documento'), false);
});
