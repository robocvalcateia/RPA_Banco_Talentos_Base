import { promises as fs } from 'node:fs';
import path from 'node:path';

import Docxtemplater from 'docxtemplater';
import { zipSync } from 'fflate';
import PizZip from 'pizzip';


export const DTT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'target_role_pt',
    'target_role_en',
    'profile_pt',
    'profile_en',
    'technical_skills_pt',
    'experiences',
    'education_pt',
    'education_en',
    'certifications_pt',
    'certifications_en',
    'languages_pt',
    'languages_en',
    'interview_summary_pt',
    'required_technical_knowledge_pt',
    'english_level_pt',
    'english_interview_feedback_pt',
    'travel_availability_pt'
  ],
  properties: {
    target_role_pt: { type: 'string' },
    target_role_en: { type: 'string' },
    profile_pt: { type: 'array', items: { type: 'string' } },
    profile_en: { type: 'array', items: { type: 'string' } },
    technical_skills_pt: { type: 'array', items: { type: 'string' } },
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['company', 'role_pt', 'role_en', 'period_pt', 'period_en', 'details_pt', 'details_en'],
        properties: {
          company: { type: 'string' },
          role_pt: { type: 'string' },
          role_en: { type: 'string' },
          period_pt: { type: 'string' },
          period_en: { type: 'string' },
          details_pt: { type: 'array', items: { type: 'string' } },
          details_en: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    education_pt: { type: 'array', items: { type: 'string' } },
    education_en: { type: 'array', items: { type: 'string' } },
    certifications_pt: { type: 'array', items: { type: 'string' } },
    certifications_en: { type: 'array', items: { type: 'string' } },
    languages_pt: { type: 'array', items: { type: 'string' } },
    languages_en: { type: 'array', items: { type: 'string' } },
    interview_summary_pt: { type: 'array', items: { type: 'string' } },
    required_technical_knowledge_pt: { type: 'array', items: { type: 'string' } },
    english_level_pt: { type: 'string' },
    english_interview_feedback_pt: { type: 'string' },
    travel_availability_pt: { type: 'string' }
  }
};

const AI_INSTRUCTIONS = `
Você prepara currículos profissionais nos modelos Alcateia e Deloitte/DTT.

Objetivo: reorganizar, detalhar e traduzir o currículo fornecido, produzindo o JSON solicitado. Preserve todas as experiências profissionais, inclusive as mais antigas, em ordem cronológica inversa.

Regras de evidência:
- Use somente fatos presentes nos dados do currículo e nas observações da entrevista.
- Não invente empresas, períodos, cargos, clientes, ferramentas, resultados, números, formação, certificações ou nível de idioma.
- Você pode corrigir gramática, expandir abreviações inequívocas, separar responsabilidades que estejam aglutinadas e tornar a descrição mais clara.
- Quando uma informação não existir, use lista vazia ou "Não informado", conforme o tipo do campo.
- Preserve nomes próprios, marcas e tecnologias. Traduza cargos, períodos e descrições para o inglês, mas não traduza nomes de empresas.
- O resumo da entrevista deve usar as observações registradas. Se não houver observações, informe explicitamente que não há entrevista registrada; não simule uma entrevista.
- O feedback de inglês e a disponibilidade para viagem devem ser "Não informado" quando não estiverem registrados.
- Cada responsabilidade profissional deve ocupar um item separado em details_pt/details_en.
- Não inclua dados pessoais de contato nos textos de perfil.
`.trim();

function sourceCurriculum(curriculum) {
  return {
    nome: String(curriculum.nome ?? '').trim(),
    cargo_alvo: String(curriculum.cargo_alvo ?? '').trim(),
    skills: String(curriculum.skills ?? '').trim(),
    conhecimento_tecnico: String(curriculum.conhecimento_tecnico ?? '').trim(),
    experiencia_profissional: String(curriculum.experiencia_profissional ?? '').trim(),
    formacao_academica: String(curriculum.formacao_academica ?? '').trim(),
    cursos_certificacoes: String(curriculum.cursos_certificacoes ?? '').trim(),
    nivel_ingles: String(curriculum.nivel_ingles ?? '').trim(),
    nivel_espanhol: String(curriculum.nivel_espanhol ?? '').trim(),
    observacoes_entrevista: String(curriculum.observacoes_entrevista ?? '').trim(),
    feedback_entrevista_ingles: String(curriculum.feedback_entrevista_ingles ?? '').trim(),
    disponibilidade_viagem: String(curriculum.disponibilidade_viagem ?? '').trim()
  };
}

export function buildOpenAIRequest(curriculum, model = process.env.OPENAI_MODEL || 'gpt-5.5') {
  return {
    model,
    store: false,
    reasoning: { effort: 'medium' },
    max_output_tokens: 16000,
    input: [
      { role: 'developer', content: AI_INSTRUCTIONS },
      {
        role: 'user',
        content: `Gere o JSON do currículo a partir destes dados:\n${JSON.stringify(sourceCurriculum(curriculum), null, 2)}`
      }
    ],
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'dtt_curriculum',
        strict: true,
        schema: DTT_SCHEMA
      }
    }
  };
}

export function extractOpenAIText(payload) {
  for (const output of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(output?.content) ? output.content : []) {
      if (content?.type === 'refusal' && content.refusal) {
        throw new Error(`A IA recusou o processamento: ${content.refusal}`);
      }
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }
  throw new Error('A IA não retornou o conteúdo estruturado do currículo.');
}

function geminiSchema(value) {
  if (Array.isArray(value)) return value.map(geminiSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'additionalProperties')
      .map(([key, item]) => [key, geminiSchema(item)])
  );
}

export function buildGeminiRequest(curriculum) {
  return {
    contents: [{
      role: 'user',
      parts: [{
        text: `${AI_INSTRUCTIONS}\n\nGere o JSON do currículo a partir destes dados:\n${JSON.stringify(sourceCurriculum(curriculum), null, 2)}`
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseJsonSchema: geminiSchema(DTT_SCHEMA)
    }
  };
}

export function extractGeminiText(payload) {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim();
  if (!text) {
    const reason = payload?.promptFeedback?.blockReason;
    throw new Error(reason
      ? `A IA recusou o processamento: ${reason}`
      : 'A IA não retornou o conteúdo estruturado do currículo.');
  }
  return text;
}

export async function generateCurriculumContent(curriculum, options = {}) {
  const openAIKey = options.openAIKey || options.apiKey || process.env.OPENAI_API_KEY || '';
  const geminiKey = options.geminiKey || process.env.GEMINI_API_KEY || '';
  const fetchImpl = options.fetchImpl || fetch;
  if (!openAIKey && !geminiKey) {
    throw new Error('Configure OPENAI_API_KEY ou GEMINI_API_KEY para gerar os documentos com IA.');
  }

  if (openAIKey) {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildOpenAIRequest(curriculum, options.model)),
      signal: options.signal || AbortSignal.timeout(180000)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || `Falha na IA (HTTP ${response.status}).`;
      throw new Error(message);
    }

    return JSON.parse(extractOpenAIText(payload));
  }

  const model = options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildGeminiRequest(curriculum)),
    signal: options.signal || AbortSignal.timeout(180000)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Falha na IA (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return JSON.parse(extractGeminiText(payload));
}

function safe(value, fallback = '') {
  return String(value ?? '').trim() || fallback;
}

export function prepareDocumentData(curriculum, generated) {
  const nationalityAge = [safe(curriculum.nacionalidade), curriculum.idade ? `${safe(curriculum.idade)} anos` : '']
    .filter(Boolean)
    .join(', ');
  return {
    ...generated,
    languages_pt_text: (generated.languages_pt || []).join('\n\n'),
    languages_en_text: (generated.languages_en || []).join('\n\n'),
    candidate_name: safe(curriculum.nome, 'Candidato'),
    target_role_pt: safe(curriculum.cargo_alvo, safe(generated.target_role_pt, 'Profissional de Tecnologia')),
    target_role_en: safe(generated.target_role_en, 'Technology Professional'),
    nationality_age: nationalityAge || 'Não informado',
    address: safe(curriculum.endereco, 'Não informado'),
    phone: safe(curriculum.telefone, 'Não informado'),
    email: safe(curriculum.email, 'Não informado'),
    linkedin: safe(curriculum.linkedin, 'Não informado')
  };
}

async function renderDocx(templatePath, data) {
  const template = await fs.readFile(templatePath);
  const doc = new Docxtemplater(new PizZip(template, { createFolders: false }), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => ''
  });
  doc.render(data);
  const output = doc.getZip();
  const entries = Object.fromEntries(
    Object.keys(output.files)
      .filter((name) => !name.endsWith('/'))
      .map((name) => [name, output.file(name).asUint8Array()])
  );
  return Buffer.from(zipSync(entries, { level: 6 }));
}

export async function renderCurriculumDocuments(curriculum, generated, templateDirectory) {
  const data = prepareDocumentData(curriculum, generated);
  const [portuguese, english, interview, alcateia] = await Promise.all([
    renderDocx(path.join(templateDirectory, 'dtt-cv-pt.docx'), data),
    renderDocx(path.join(templateDirectory, 'dtt-cv-en.docx'), data),
    renderDocx(path.join(templateDirectory, 'dtt-resumo-entrevista.docx'), data),
    renderDocx(path.join(templateDirectory, 'alcateia-cv-pt.docx'), data)
  ]);

  return { portuguese, english, interview, alcateia };
}

export function buildDttZip(filenameBase, documents) {
  return Buffer.from(zipSync({
    [`${filenameBase}-DTT-CV-PT.docx`]: new Uint8Array(documents.portuguese),
    [`${filenameBase}-DTT-CV-EN.docx`]: new Uint8Array(documents.english),
    [`${filenameBase}-DTT-Resumo-Entrevista-PT.docx`]: new Uint8Array(documents.interview)
  }, { level: 6 }));
}
