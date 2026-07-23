import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import PizZip from 'pizzip';

import {
  buildDttZip,
  buildGeminiRequest,
  buildOpenAIRequest,
  extractGeminiText,
  extractOpenAIText,
  generateCurriculumContent,
  prepareDocumentData,
  renderCurriculumDocuments,
  sanitizeCvText
} from '../dtt.js';


const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TEMPLATE_DIR = path.join(ROOT, 'assets', 'templates', 'dtt');

const curriculum = {
  nome: 'Marina Teste',
  email: 'marina@example.com',
  telefone: '(11) 99999-9999',
  endereco: 'São Paulo/SP',
  nacionalidade: 'Brasileira',
  idade: '39',
  linkedin: 'https://linkedin.com/in/marina',
  cargo_alvo: 'Analista de Sistemas Sênior',
  skills: 'Java, SQL, APIs',
  conhecimento_tecnico: 'Java, SQL, APIs',
  experiencia_profissional: 'Empresa Atual - 2020/Atual - Analista. Empresa Antiga - 2010/2020 - Desenvolvedora.',
  formacao_academica: 'Bacharelado em Sistemas de Informação',
  cursos_certificacoes: 'Scrum Foundation',
  nivel_ingles: 'Intermediário',
  observacoes_entrevista: 'Comunicação clara e experiência compatível.',
  feedback_entrevista_ingles: 'Compreende textos e mantém conversação técnica.',
  disponibilidade_viagem: 'Sim'
};

const generated = {
  target_role_pt: 'Analista de Sistemas Sênior',
  target_role_en: 'Senior Systems Analyst',
  profile_pt: ['Profissional com experiência em desenvolvimento de sistemas.'],
  profile_en: ['Professional experienced in systems development.'],
  technical_skills_pt: ['Linguagens: Java', 'Banco de dados: SQL', 'Integrações: APIs'],
  experiences: [
    {
      company: 'Empresa Atual',
      role_pt: 'Analista de Sistemas',
      role_en: 'Systems Analyst',
      period_pt: '2020 – Atual',
      period_en: '2020 – Present',
      details_pt: ['Desenvolvimento de sistemas em Java.', 'Consultas SQL.'],
      details_en: ['Development of Java systems.', 'SQL queries.']
    },
    {
      company: 'Empresa Antiga',
      role_pt: 'Desenvolvedora',
      role_en: 'Developer',
      period_pt: '2010 – 2020',
      period_en: '2010 – 2020',
      details_pt: ['Desenvolvimento e manutenção de APIs.'],
      details_en: ['API development and maintenance.']
    }
  ],
  education_pt: ['Bacharelado em Sistemas de Informação'],
  education_en: ["Bachelor's Degree in Information Systems"],
  certifications_pt: ['Scrum Foundation'],
  certifications_en: ['Scrum Foundation'],
  languages_pt: ['Inglês Intermediário'],
  languages_en: ['English – Intermediate'],
  interview_summary_pt: ['Comunicação clara e experiência compatível.'],
  required_technical_knowledge_pt: ['Java', 'SQL', 'APIs'],
  english_level_pt: 'Intermediário',
  english_interview_feedback_pt: 'Compreende textos e mantém conversação técnica.',
  travel_availability_pt: 'Sim'
};

function allXml(buffer) {
  const zip = new PizZip(buffer);
  return Object.keys(zip.files)
    .filter((name) => name.endsWith('.xml'))
    .map((name) => zip.file(name).asText())
    .join('\n');
}

test('requisição de IA usa Responses API estruturada e não armazena o currículo', () => {
  const request = buildOpenAIRequest(curriculum);
  assert.equal(request.model, 'gpt-5.5');
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema.additionalProperties, false);
  assert.match(request.input[1].content, /Empresa Antiga/);
});

test('requisição de IA envia texto integral original para preservar detalhes do CV', () => {
  const request = buildOpenAIRequest({
    ...curriculum,
    experiencia_profissional: 'Empresa Atual - Gerente.',
    search_text_all: [
      'Empresa Atual - Gerente',
      '• Implantou governança de projetos.',
      '• Liderou integrações SAP e Power BI.',
      'Empresa Antiga - Coordenadora',
      '• Estruturou PMO e indicadores executivos.'
    ].join('\n')
  });

  const source = JSON.parse(request.input[1].content.split('\n').slice(1).join('\n'));
  assert.match(source.texto_integral_original, /Implantou governança de projetos/);
  assert.match(source.texto_integral_original, /Estruturou PMO/);
  assert.equal(request.max_output_tokens, 24000);
});

test('higienizacao de CV remove lixo invisivel e preserva termos tecnicos', () => {
  const text = sanitizeCvText([
    'C\u200B#  .NET\u00A0 C++ Node.js SAP S/4HANA',
    '\u2023 Liderou roadmap\u2014PMO com aspas \u201csmart\u201d',
    'Texto com ligatura \uFB01nanceiro e controle\u0007'
  ].join('\r\n'));

  assert.match(text, /C# \.NET C\+\+ Node\.js SAP S\/4HANA/);
  assert.match(text, /• Liderou roadmap-PMO com aspas "smart"/);
  assert.match(text, /financeiro e controle/);
  assert.doesNotMatch(text, /[\u200B\u00A0\u0007]/);
});

test('resposta estruturada da IA é extraída e recusas são tratadas', () => {
  assert.equal(extractOpenAIText({ output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }] }), '{"ok":true}');
  assert.throws(
    () => extractOpenAIText({ output: [{ content: [{ type: 'refusal', refusal: 'Não posso.' }] }] }),
    /recusou/
  );
});

test('geração de conteúdo aceita uma resposta mockada da Responses API', async () => {
  const result = await generateCurriculumContent(curriculum, {
    apiKey: 'teste',
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.store, false);
      return {
        ok: true,
        json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(generated) }] }] })
      };
    }
  });
  assert.equal(result.experiences.length, 2);
});

test('geracao reidrata experiencias quando IA resume demais o texto original', async () => {
  const richCurriculum = {
    ...curriculum,
    experiencia_profissional: [
      'CRDC | Central de Registros | Mar/2022 - Mai/2026',
      'Gerente de Projetos & Produtos',
      'Liderou a gestao do ciclo de vida completo de produtos digitais do Product Discovery ao Delivery.',
      'Estruturou roadmap de produto de medio e longo prazo e priorizacao estrategica de backlog.',
      'Implantou governanca de portfolio com KPIs, gestao de riscos, cronograma e reporte executivo.',
      'Coordenou squads ageis em iniciativas de alta complexidade com stakeholders internos e externos.',
      'Foursys | Jun/2021 - Mar/2022',
      'Gerente de Projetos, Tech Lead & Agile Master',
      'Gerenciou projetos de transformacao digital para clientes de grande porte.',
      'Monitorou velocity, lead time, cycle time e burn-down para reportes executivos.'
    ].join('\n')
  };
  const sparseGenerated = {
    ...generated,
    experiences: [{
      company: 'CRDC',
      role_pt: 'Gerente de Projetos & Produtos',
      role_en: 'Project and Product Manager',
      period_pt: 'Mar/2022 - Mai/2026',
      period_en: 'Mar/2022 - May/2026',
      details_pt: ['Lideranca de iniciativas complexas de transformacao digital.'],
      details_en: ['Led complex digital transformation initiatives.']
    }]
  };

  const result = await generateCurriculumContent(richCurriculum, {
    apiKey: 'teste',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(sparseGenerated) }] }] })
    })
  });

  assert.match(result.experiences[0].details_pt.join(' '), /Product Discovery ao Delivery/);
  assert.match(result.experiences[0].details_pt.join(' '), /reporte executivo/);
  assert.ok(result.experiences.some((experience) => /Foursys/i.test(experience.company)));
});

test('geracao de conteudo tenta novamente quando a IA esta sobrecarregada', async () => {
  let calls = 0;
  const result = await generateCurriculumContent(curriculum, {
    apiKey: 'teste',
    maxRetries: 1,
    retryDelayMs: 0,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          json: async () => ({
            error: {
              message: 'This model is currently experiencing high demand. Please try again later.'
            }
          })
        };
      }
      return {
        ok: true,
        json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(generated) }] }] })
      };
    }
  });

  assert.equal(calls, 2);
  assert.equal(result.experiences.length, 2);
});

test('geracao usa Gemini como fallback quando OpenAI esta temporariamente indisponivel', async () => {
  const urls = [];
  const result = await generateCurriculumContent(curriculum, {
    apiKey: 'teste-openai',
    geminiKey: 'teste-gemini',
    maxRetries: 0,
    retryDelayMs: 0,
    fetchImpl: async (url) => {
      urls.push(url);
      if (url.includes('api.openai.com')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({
            error: {
              message: 'The model is overloaded. Try again later.'
            }
          })
        };
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] })
      };
    }
  });

  assert.equal(urls.length, 2);
  assert.match(urls[0], /api\.openai\.com/);
  assert.match(urls[1], /generativelanguage\.googleapis\.com/);
  assert.equal(result.experiences.length, 2);
});

test('erro temporario de IA e apresentado com mensagem amigavel', async () => {
  await assert.rejects(
    generateCurriculumContent(curriculum, {
      apiKey: 'teste',
      maxRetries: 0,
      retryDelayMs: 0,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          error: {
            message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.'
          }
        })
      })
    }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /temporariamente sobrecarregada/);
      assert.doesNotMatch(error.message, /Spikes in demand/);
      return true;
    }
  );
});

test('geração de conteúdo usa Gemini quando essa é a integração configurada', async () => {
  const request = buildGeminiRequest(curriculum);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.equal(request.generationConfig.responseJsonSchema.additionalProperties, undefined);
  assert.equal(extractGeminiText({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), '{"ok":true}');

  const result = await generateCurriculumContent(curriculum, {
    geminiKey: 'teste',
    fetchImpl: async (url, options) => {
      assert.match(url, /generativelanguage\.googleapis\.com/);
      assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, 'application/json');
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] })
      };
    }
  });
  assert.equal(result.experiences.length, 2);
});

test('dados diretos de contato não dependem da IA', () => {
  const data = prepareDocumentData(curriculum, generated);
  assert.equal(data.candidate_name, 'Marina Teste');
  assert.equal(data.nationality_age, 'Brasileira, 39 anos');
  assert.equal(data.phone, '(11) 99999-9999');
});

test('templates geram os quatro DOCX e o pacote DTT com três arquivos', async () => {
  const documents = await renderCurriculumDocuments(curriculum, generated, TEMPLATE_DIR);
  for (const document of Object.values(documents)) {
    assert.ok(Buffer.isBuffer(document));
    assert.ok(document.length > 10_000);
    assert.doesNotMatch(allXml(document), /\{[#/.]?[a-z_]+\}/i);
  }

  assert.match(allXml(documents.portuguese), /Empresa Antiga/);
  assert.match(allXml(documents.english), /Empresa Antiga/);
  assert.match(allXml(documents.interview), /Comunicação clara/);
  assert.match(allXml(documents.alcateia), /Empresa Antiga/);

  const bundle = new PizZip(buildDttZip('Marina-Teste', documents));
  const names = Object.keys(bundle.files).sort();
  assert.deepEqual(names, [
    'Marina-Teste-DTT-CV-EN.docx',
    'Marina-Teste-DTT-CV-PT.docx',
    'Marina-Teste-DTT-Resumo-Entrevista-PT.docx'
  ]);
});

test('campos nao informados nao aparecem nos dados dos documentos', () => {
  const data = prepareDocumentData(
    {
      ...curriculum,
      endereco: 'Não informado',
      telefone: '',
      email: 'Nao informado',
      linkedin: 'Not informed',
      nacionalidade: '',
      idade: ''
    },
    {
      ...generated,
      technical_skills_pt: ['Java', 'Não informado', 'SQL'],
      languages_pt: ['Nao informado'],
      languages_en: ['Not informed'],
      english_interview_feedback_pt: 'Não informado',
      travel_availability_pt: 'Nao informado'
    }
  );

  assert.equal(data.address, '');
  assert.equal(data.phone, '');
  assert.equal(data.email, '');
  assert.equal(data.linkedin, '');
  assert.equal(data.nationality_age, '');
  assert.deepEqual(data.technical_skills_pt, ['Java', 'SQL']);
  assert.deepEqual(data.languages_pt, []);
  assert.deepEqual(data.languages_en, []);
  assert.equal(data.english_interview_feedback_pt, '');
  assert.equal(data.travel_availability_pt, '');
});
