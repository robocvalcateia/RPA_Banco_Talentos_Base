import { promises as fs } from 'node:fs';
import path from 'node:path';

import Docxtemplater from 'docxtemplater';
import { zipSync } from 'fflate';
import PizZip from 'pizzip';

import { repairUnicodeText } from './text-utils.js';

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
- Use o campo texto_integral_original como fonte principal quando ele existir, especialmente para experiências, projetos, responsabilidades, resultados, ferramentas, cursos e certificações.
- Os campos resumidos existem apenas para orientação. Nunca descarte detalhes existentes no texto_integral_original porque uma versão resumida também foi enviada.
- Não invente empresas, períodos, cargos, clientes, ferramentas, resultados, números, formação, certificações ou nível de idioma.
- Você pode corrigir gramática, expandir abreviações inequívocas, separar responsabilidades que estejam aglutinadas e tornar a descrição mais clara, mas sem reduzir o conteúdo factual.
- Quando uma informação não existir, use lista vazia ou string vazia. Nunca escreva "Não informado", "Nao informado" ou "Not informed" nos textos finais.
- Preserve nomes próprios, marcas e tecnologias. Traduza cargos, períodos e descrições para o inglês, mas não traduza nomes de empresas.
- O resumo da entrevista deve usar as observações registradas. Se não houver observações, informe explicitamente que não há entrevista registrada; não simule uma entrevista.
- O feedback de inglês e a disponibilidade para viagem devem ficar vazios quando não estiverem registrados.
- Cada responsabilidade profissional deve ocupar um item separado em details_pt/details_en. Para cada empresa, preserve os principais bullets de atuação, projetos, sistemas, governança, gestão, indicadores e resultados presentes no texto original.
- Não inclua dados pessoais de contato nos textos de perfil.
`.trim();

export function sanitizeCvText(value = '') {
  return repairUnicodeText(value)
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\uFB00-\uFB06]/g, (match) => ({
      '\uFB00': 'ff',
      '\uFB01': 'fi',
      '\uFB02': 'fl',
      '\uFB03': 'ffi',
      '\uFB04': 'ffl',
      '\uFB05': 'st',
      '\uFB06': 'st'
    }[match] || match))
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2022\u2023\u2043\u2219\u25AA\u25CF\u25E6\u00B7]/g, '\u2022')
    .replace(/[ \t]+\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactSourceText(value, maxChars = 50000) {
  return removeTechnicalSourceNoise(sanitizeCvText(value))
    .slice(0, maxChars);
}

const TECHNICAL_SOURCE_KEYS = new Set([
  '_id',
  'id',
  'id_controle',
  'idcontrole',
  'mongoid',
  'legacymongoid',
  'legacy_candidato_id',
  'legacy_id_controle',
  'hash_documento',
  'document_hash',
  'fonte',
  'source',
  'data',
  'data_criacao',
  'data_atualizacao',
  'data_origem',
  'arquivo_original_atualizado_em',
  'tem_arquivo_original',
  'cv_quality_status',
  'cv_quality_issues',
  'cv_quality_warnings',
  'cv_quality_metrics'
]);

function normalizeSourceKey(key = '') {
  return String(key)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isTechnicalSourceKey(key = '') {
  return TECHNICAL_SOURCE_KEYS.has(normalizeSourceKey(key));
}

function removeTechnicalSourceNoise(value = '') {
  return String(value || '')
    .replace(/\b[a-f0-9]{40,128}\b/gi, '')
    .replace(/\b[a-f0-9]{24}\b/gi, '')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '')
    .replace(/\b(?:hash_documento|document_hash|id_controle|data_criacao|data_atualizacao|data_origem)\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sourceTextFromValue(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return '';

  if (Array.isArray(value)) {
    return value.map((item) => sourceTextFromValue(item, seen)).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '';
    seen.add(value);
    return Object.entries(value)
      .filter(([key]) => !isTechnicalSourceKey(key))
      .map(([, item]) => sourceTextFromValue(item, seen))
      .filter(Boolean)
      .join('\n');
  }

  return sanitizeCvText(value);
}

function fullSourceText(curriculum) {
  const parts = [
    curriculum.texto_integral_original,
    curriculum.Texto_Integral_Original,
    curriculum.search_text_all,
    curriculum.search_text,
    curriculum.texto_pesquisavel,
    curriculum.texto_pesquisa,
    curriculum.atividades,
    curriculum.atividades_exercidas,
    Array.isArray(curriculum.experiencias) ? curriculum.experiencias : '',
    Array.isArray(curriculum.experiences) ? curriculum.experiences : '',
    Array.isArray(curriculum.empresas) ? curriculum.empresas : '',
    Array.isArray(curriculum.projetos) ? curriculum.projetos : '',
    Array.isArray(curriculum.tecnologias) ? curriculum.tecnologias : '',
    Array.isArray(curriculum.versoes) ? curriculum.versoes : ''
  ]
    .map((item) => compactSourceText(sourceTextFromValue(item), 20000))
    .filter(Boolean);

  return compactSourceText([...new Set(parts)].join('\n\n'), 50000);
}

function normalizeKey(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSourceLine(value = '') {
  return sanitizeCvText(value)
    .replace(/^Page\s+\d+\s*$/i, '')
    .replace(/This resume contains.+$/i, '')
    .replace(/^[•\-\u2022]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractExperienceSection(text = '') {
  const lines = String(text || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanSourceLine)
    .filter(Boolean);

  const startIndex = lines.findIndex((line) => /^experi[eê]ncia profissional$/i.test(line));
  const scopedLines = startIndex >= 0 ? lines.slice(startIndex + 1) : lines;
  const stopIndex = scopedLines.findIndex((line) => /^(forma[cç][aã]o|educa[cç][aã]o|cursos|certifica[cç][oõ]es|idiomas|languages)\b/i.test(line));
  return (stopIndex >= 0 ? scopedLines.slice(0, stopIndex) : scopedLines).join('\n');
}

function looksLikeExperienceHeader(line = '') {
  const text = cleanSourceLine(line);
  if (!text || text.length > 180) return false;
  if (/^(cargo|empresa|resumo|principais compet[eê]ncias)$/i.test(text)) return false;
  return /(\b\d{4}\b|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|atual|present)/i.test(text)
    && /(\||-|–|—|\))/.test(text);
}

function parseSourceExperiences(text = '') {
  const section = extractExperienceSection(text);
  const lines = section
    .split('\n')
    .map(cleanSourceLine)
    .filter(Boolean);
  const blocks = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    const details = current.details.map(cleanSourceLine).filter((line) => line.length > 8);
    if (!current.role_pt && details.length && details[0].length <= 95 && !/[.;:]$/.test(details[0])) {
      current.role_pt = details.shift();
    }
    if (details.length) {
      blocks.push({
        company: current.company || current.header,
        role_pt: current.role_pt || '',
        role_en: current.role_pt || '',
        period_pt: current.period_pt || '',
        period_en: current.period_pt || '',
        details_pt: details,
        details_en: details
      });
    }
  };

  for (const line of lines) {
    if (looksLikeExperienceHeader(line)) {
      pushCurrent();
      const periodMatch = line.match(/((?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z./]*\s*\/?\s*\d{4}\s*[–-]\s*(?:atual|present|(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z./]*\s*\/?\s*\d{4}|\d{4})|\d{4}\s*[–-]\s*(?:\d{4}|atual|present))/i);
      const beforePeriod = periodMatch ? line.slice(0, periodMatch.index).replace(/[|–-]\s*$/, '').trim() : line;
      const parts = beforePeriod.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
      current = {
        header: line,
        company: parts.slice(0, Math.min(2, parts.length || 1)).join(' | ') || beforePeriod,
        role_pt: parts.length > 2 ? parts.slice(2).join(' | ') : '',
        period_pt: periodMatch ? periodMatch[1].trim() : '',
        details: []
      };
      continue;
    }

    if (current) {
      current.details.push(line);
    }
  }

  pushCurrent();
  return blocks;
}

function experienceDetailsLength(experience = {}) {
  return [...(experience.details_pt || []), ...(experience.details_en || [])]
    .join(' ')
    .length;
}

function mergeGeneratedWithSourceExperiences(curriculum, generated) {
  const source = [
    curriculum.experiencia_profissional,
    fullSourceText(curriculum)
  ].filter(Boolean).join('\n\n');
  const sourceExperiences = parseSourceExperiences(source);
  if (!sourceExperiences.length) return generated;

  const generatedExperiences = Array.isArray(generated.experiences) ? generated.experiences : [];
  const sourceDetailsLength = sourceExperiences.reduce((sum, item) => sum + experienceDetailsLength(item), 0);
  const generatedDetailsLength = generatedExperiences.reduce((sum, item) => sum + experienceDetailsLength(item), 0);

  if (sourceDetailsLength < 300 || sourceDetailsLength <= generatedDetailsLength * 1.25) {
    return generated;
  }

  const merged = generatedExperiences.map((experience) => ({ ...experience }));
  for (const sourceExperience of sourceExperiences) {
    const sourceKey = normalizeKey(sourceExperience.company);
    const index = merged.findIndex((experience) => {
      const generatedKey = normalizeKey(experience.company);
      return generatedKey && sourceKey && (generatedKey.includes(sourceKey) || sourceKey.includes(generatedKey));
    });

    if (index >= 0) {
      const current = merged[index];
      if ((current.details_pt || []).join(' ').length < sourceExperience.details_pt.join(' ').length * 0.8) {
        current.details_pt = sourceExperience.details_pt;
      }
      if ((current.details_en || []).join(' ').length < sourceExperience.details_pt.join(' ').length * 0.8) {
        current.details_en = sourceExperience.details_en;
      }
      current.role_pt = current.role_pt || sourceExperience.role_pt;
      current.role_en = current.role_en || sourceExperience.role_en;
      current.period_pt = current.period_pt || sourceExperience.period_pt;
      current.period_en = current.period_en || sourceExperience.period_en;
    } else {
      merged.push(sourceExperience);
    }
  }

  return {
    ...generated,
    experiences: merged
  };
}

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
    disponibilidade_viagem: String(curriculum.disponibilidade_viagem ?? '').trim(),
    texto_integral_original: fullSourceText(curriculum)
  };
}

export function buildOpenAIRequest(curriculum, model = process.env.OPENAI_MODEL || 'gpt-5.5') {
  return {
    model,
    store: false,
    reasoning: { effort: 'medium' },
    max_output_tokens: 24000,
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

  return mergeGeneratedWithSourceExperiences(curriculum, JSON.parse(extractOpenAIText(payload)));
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

  return mergeGeneratedWithSourceExperiences(curriculum, JSON.parse(extractGeminiText(payload)));
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
  return sanitizeCvText(value);
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
