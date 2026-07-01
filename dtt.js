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
- Quando uma informação não existir, use lista vazia ou string vazia. Nunca escreva "Não informado", "Nao informado" ou "Not informed" nos textos finais.
- Preserve nomes próprios, marcas e tecnologias. Traduza cargos, períodos e descrições para o inglês, mas não traduza nomes de empresas.
- O resumo da entrevista deve usar as observações registradas. Se não houver observações, informe explicitamente que não há entrevista registrada; não simule uma entrevista.
- O feedback de inglês e a disponibilidade para viagem devem ficar vazios quando não estiverem registrados.
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

export class AIProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = options.provider || 'IA';
    this.status = options.status;
    this.transient = Boolean(options.transient);
    this.statusCode = options.statusCode || (this.transient ? 503 : 500);
    if (options.cause) this.cause = options.cause;
  }
}

function isTemporaryAIError(status, message = '') {
  const text = String(message || '').toLowerCase();
  return status === 408
    || status === 409
    || status === 429
    || status >= 500
    || /high demand|spikes in demand|try again later|temporar|overload|overloaded|unavailable|timeout|timed out|rate limit|capacity|busy|quota/.test(text);
}

function publicAIError(error) {
  if (error instanceof AIProviderError && error.transient) {
    return new AIProviderError(
      'A IA está temporariamente sobrecarregada. Tente gerar o CV novamente em alguns minutos.',
      {
        provider: error.provider,
        status: error.status,
        transient: true,
        statusCode: 503,
        cause: error
      }
    );
  }
  return error;
}

function aiProviderError(provider, status, payload) {
  const message = payload?.error?.message || `Falha na IA (${provider}, HTTP ${status}).`;
  return new AIProviderError(message, {
    provider,
    status,
    transient: isTemporaryAIError(status, message)
  });
}

function normalizeAIError(error, provider) {
  if (error instanceof AIProviderError) return error;

  const message = error?.message || `Falha na IA (${provider}).`;
  return new AIProviderError(message, {
    provider,
    transient: isTemporaryAIError(0, message),
    cause: error
  });
}

function retryDelay(attempt, baseDelayMs) {
  return Math.max(0, baseDelayMs) * (attempt + 1);
}

async function waitBeforeRetry(delayMs, signal) {
  if (!delayMs) return;
  if (signal?.aborted) throw signal.reason || new Error('Operação cancelada.');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(signal.reason || new Error('Operação cancelada.'));
      }, { once: true });
    }
  });
}

async function withRetry(action, options = {}) {
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 2;
  const retryDelayMs = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : 1500;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = normalizeAIError(error, options.provider || 'IA');
      if (!lastError.transient || attempt >= maxRetries) break;
      await waitBeforeRetry(retryDelay(attempt, retryDelayMs), options.signal);
    }
  }

  throw lastError;
}

async function generateWithOpenAI(curriculum, options) {
  const fetchImpl = options.fetchImpl || fetch;
  const openAIKey = options.openAIKey || options.apiKey || process.env.OPENAI_API_KEY || '';
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
    throw aiProviderError('OpenAI', response.status, payload);
  }

  return JSON.parse(extractOpenAIText(payload));
}

async function generateWithGemini(curriculum, options) {
  const fetchImpl = options.fetchImpl || fetch;
  const geminiKey = options.geminiKey || process.env.GEMINI_API_KEY || '';
  const model = options.geminiModel || options.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
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
    throw aiProviderError('Gemini', response.status, payload);
  }

  return JSON.parse(extractGeminiText(payload));
}

export async function generateCurriculumContent(curriculum, options = {}) {
  const openAIKey = options.openAIKey || options.apiKey || process.env.OPENAI_API_KEY || '';
  const geminiKey = options.geminiKey || process.env.GEMINI_API_KEY || '';
  if (!openAIKey && !geminiKey) {
    throw new Error('Configure OPENAI_API_KEY ou GEMINI_API_KEY para gerar os documentos com IA.');
  }

  if (openAIKey) {
    try {
      return await withRetry(() => generateWithOpenAI(curriculum, options), {
        ...options,
        provider: 'OpenAI'
      });
    } catch (error) {
      const openAIError = normalizeAIError(error, 'OpenAI');
      if (geminiKey && openAIError.transient) {
        try {
          return await withRetry(() => generateWithGemini(curriculum, options), {
            ...options,
            provider: 'Gemini'
          });
        } catch (fallbackError) {
          throw publicAIError(normalizeAIError(fallbackError, 'Gemini'));
        }
      }
      throw publicAIError(openAIError);
    }
  }

  try {
    return await withRetry(() => generateWithGemini(curriculum, options), {
      ...options,
      provider: 'Gemini'
    });
  } catch (error) {
    throw publicAIError(normalizeAIError(error, 'Gemini'));
  }
}

function safe(value, fallback = '') {
  return String(value ?? '').trim() || fallback;
}

function isUnavailableText(value) {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return [
    'nao informado',
    'nao informada',
    'not informed',
    'not specified',
    'not provided'
  ].includes(normalized);
}

function sanitizeDocumentValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeDocumentValue(item))
      .filter((item) => {
        if (Array.isArray(item)) return item.length > 0;
        if (item && typeof item === 'object') {
          return Object.values(item).some((field) => {
            if (Array.isArray(field)) return field.length > 0;
            if (field && typeof field === 'object') return Object.keys(field).length > 0;
            return String(field ?? '').trim() !== '';
          });
        }
        return String(item ?? '').trim() !== '';
      });
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeDocumentValue(item)])
    );
  }

  if (isUnavailableText(value)) return '';
  return value;
}

export function prepareDocumentData(curriculum, generated) {
  const nationalityAge = [safe(curriculum.nacionalidade), curriculum.idade ? `${safe(curriculum.idade)} anos` : '']
    .filter(Boolean)
    .join(', ');
  return sanitizeDocumentValue({
    ...generated,
    languages_pt_text: (generated.languages_pt || []).join('\n\n'),
    languages_en_text: (generated.languages_en || []).join('\n\n'),
    candidate_name: safe(curriculum.nome, 'Candidato'),
    target_role_pt: safe(curriculum.cargo_alvo, safe(generated.target_role_pt, 'Profissional de Tecnologia')),
    target_role_en: safe(generated.target_role_en, 'Technology Professional'),
    nationality_age: nationalityAge,
    address: safe(curriculum.endereco),
    phone: safe(curriculum.telefone),
    email: safe(curriculum.email),
    linkedin: safe(curriculum.linkedin)
  });
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
