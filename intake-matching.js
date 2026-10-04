import { normalize, skillAlternatives, experienceEvidence } from './candidate-screening.js';
import { locationEligibility } from './intake-location.js';

export const INTAKE_MATCH_VERSION = 'email-full-cv-v4';
const labels = { texto_integral_original: 'Currículo integral', experiencia_profissional: 'Experiência profissional', experiencias: 'Experiências', experiences: 'Experiências', projetos: 'Projetos', skills: 'Competências', conhecimento_tecnico: 'Conhecimento técnico', cursos_certificacoes: 'Cursos e certificações', formacao_academica: 'Formação', observacoes_entrevista: 'Entrevista', feedback_entrevista_ingles: 'Entrevista de inglês', nivel_ingles: 'Nível de inglês', nivel_espanhol: 'Nível de espanhol', search_text_all: 'Texto consolidado', versoes: 'Versões do currículo' };
const cvFields = ['texto_integral_original', 'experiencia_profissional', 'experiencias', 'experiences', 'atividades', 'atividades_exercidas', 'empresas', 'projetos', 'tecnologias', 'skills', 'conhecimento_tecnico', 'formacao_academica', 'cursos_certificacoes', 'idiomas', 'nivel_ingles', 'nivel_espanhol', 'englishLevel', 'observacoes_entrevista', 'feedback_entrevista_ingles', 'disponibilidade', 'disponibilidade_viagem', 'cargo_alvo', 'resumo', 'summary', 'endereco', 'city', 'state', 'versoes', 'search_text_all', 'search_text', 'texto_pesquisa', 'texto_pesquisavel'];
const excluded = /^(idade|age|data_nascimento|birthdate|estado_civil|nacionalidade|sexo|genero|gender|religiao|raca|cpf|rg|email|telefone|phone|password|passwordHash|foto|photo|arquivo_base64|base64|oportunidade.*|jobDescription|observacao_busca|score_busca)$/i;
function textOf(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n\n');
  if (typeof value === 'object') return Object.entries(value).filter(([key]) => !excluded.test(key)).map(([key, val]) => `${key}: ${textOf(val)}`).join('\n');
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
export function curriculumSources(cv) {
  const seen = new Set();
  return cvFields.flatMap(field => {
    const text = textOf(cv[field]).trim();
    if (!text || seen.has(text)) return [];
    seen.add(text);
    return [{ field, label: labels[field] || field.replaceAll('_', ' '), text }];
  });
}
const definitions = [
  ['implementation', 'Projetos de implementação', /\bimplement\w*|\bimplant\w*/],
  ['finance', 'Processos de negócios em Finanças', /process\w*[^.\n]{0,60}(?:finan|contab)|financial processes|finance business/],
  ['specification', 'Especificações funcionais', /especifica\w* funciona\w*|functional specifications?|functional design/],
  ['configuration', 'Configuração / parametrização', /configur\w*|parametriz\w*|customiz\w*/],
  ['complex', 'Desenvolvimentos complexos', /desenvolv\w* complex\w*|complex development/],
  ['testscript', 'Scripts / cenários de testes', /(?:scripts?|cenarios?|roteiros?) de testes?|test (?:scripts?|cases?|scenarios?)/],
  ['uat', 'Homologação e apoio aos key-users', /homologa\w*|\buat\b|user acceptance|key users?/],
  ['monthlyclosing', 'Fechamento contábil mensal', /fechamento[^.\n]{0,35}mensal|month(?:ly| end) clos\w*/],
  ['annualclosing', 'Fechamento contábil anual', /fechamento[^.\n]{0,45}anual|year(?:ly| end) clos\w*|annual clos\w*/],
  ['localization', 'Localização Brasil', /localiza\w* (?:brasil|brasileira)|brazil(?:ian)? localization/],
  ['withholding', 'Retenções / impostos', /withholdings?|impostos? retidos?|retenc\w* (?:de )?impostos?|withholding tax/],
  ['rootcause', 'Análise de erros e causa raiz', /causa raiz|root cause|analise de erros?/],
  ['workaround', 'Solução de contorno', /soluc\w* de contorno|workarounds?/],
  ['permanent', 'Solução definitiva', /soluc\w*[^.\n]{0,25}definitiva|permanent (?:fix|solution)/],
  ['actionplan', 'Plano de ação', /planos? de acao|action plans?/],
  ['waterfall', 'Metodologia Waterfall', /waterfall|cascata/],
  ['agile', 'Metodologia Agile', /\bagile\b|\bagil\b|scrum/],
  ['communication', 'Comunicação', /(?:boa |habilidades? de )comunicacao|comunicacao (?:interpessoal|verbal|escrita)|communication skills|^comunicacao$|^communication$/],
  ['analytical', 'Capacidade analítica', /senso analitico|capacidade analitica|analytical (?:skills|thinking)/],
  ['leadership', 'Liderança', /lideranca|leadership/],
  ['teamwork', 'Colaboração / trabalho em equipe', /colaboracao|trabalho em equipe|teamwork|team player/],
  ['proactivity', 'Proatividade', /proativ\w*|proactiv\w*/],
  ['adaptability', 'Adaptabilidade / resiliência', /adaptabilidade|resiliencia|adaptability|resilience/],
  ['certification', 'Certificação SAP', /certifica\w* sap|sap certif\w*/],
  ['abap', 'ABAP', /\babap\b/],
  ['sql', 'SQL', /\bsql\b|\bplsql\b/],
  ['taxone', 'ONESOURCE TaxOne', /\btaxone\b|onesource tax/],
  ['mastersafdw', 'MasterSaf DW', /mastersaf\s*dw|mastersaf data warehouse/]
];
const behavioral = new Set(['communication', 'analytical', 'leadership', 'teamwork', 'proactivity', 'adaptability']);
const scoringGroups = {
  core: ['core', 5], implementation: ['implementation', 5],
  finance: ['finance', 3], specification: ['functional-delivery', 3], configuration: ['functional-delivery', 3], complex: ['functional-delivery', 3],
  testscript: ['testing', 3], uat: ['testing', 3], monthlyclosing: ['closing', 3], annualclosing: ['closing', 3],
  localization: ['brazil-tax', 3], withholding: ['brazil-tax', 3],
  rootcause: ['troubleshooting', 3], workaround: ['troubleshooting', 3], permanent: ['troubleshooting', 3], actionplan: ['troubleshooting', 3], waterfall: ['methodology', 1]
};
const moduleAliases = {
  GL: ['fi gl', 'general ledger', 'razao geral', 'contabilidade geral'],
  AR: ['fi ar', 'accounts receivable', 'contas a receber'],
  AP: ['fi ap', 'accounts payable', 'contas a pagar'],
  AA: ['fi aa', 'asset accounting', 'fixed assets', 'ativos fixos', 'imobilizado']
};
const regexOfTerms = terms => new RegExp(`\\b(?:${terms.map(t => normalize(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`);
const filler = new Set('a o as os e de da do das dos em com no na nos nas para por um uma ao aos bem que ser sera profissionais profissional buscamos conhecimento experiencia comprovada dominio dominios habilidades habilidade minimo anos projetos requerido desejavel desejaveis diferencial diferenciais sendo tanto quanto elaborar elaboracao escrita detalhada necessario necessarios'.split(' '));
export function compileIntakeRequirements(f) {
  const criteria = [], coverage = [];
  const core = f.coreSkill || f.profile || '';
  const coreTerms = skillAlternatives(core);
  if (/sap\s*fi/i.test(core)) coreTerms.push('sap finance', 'sap financial accounting', 'fi aa');
  if (core) criteria.push({ id: 'core', label: core, group: 'mandatory', weight: 5, re: regexOfTerms(coreTerms) });
  const full = `${f.requirements}\n${f.mandatorySkills}`;
  const normalized = normalize(full);
  for (const [module, aliases] of Object.entries(moduleAliases)) {
    if (new RegExp(`\\b(?:fa|fi) ${module.toLowerCase()}\\b`).test(normalized) || regexOfTerms(aliases).test(normalized)) {
      const ambiguous = new RegExp(`\\bfa ${module.toLowerCase()}\\b`).test(normalized);
      criteria.push({ id: `module-${module}`, label: `SAP FI-${module}${ambiguous ? ` (FA-${module} no e-mail)` : ''}`, group: 'mandatory', weight: 3, re: regexOfTerms(aliases), vacancyRe: regexOfTerms([...aliases, `fa ${module}`]), ambiguous });
    }
  }
  for (const [id, label, re] of definitions) {
    const requiredLines = String(full).split(/\n|(?<=[.;])\s+/).filter(line => re.test(normalize(line)));
    const inRequired = requiredLines.some(line => id === 'waterfall' || !/diferencial|desejavel/i.test(normalize(line)));
    if (inRequired || re.test(normalize(f.desirable))) criteria.push({ id, label, group: inRequired ? 'mandatory' : 'desirable', weight: inRequired ? 3 : 1, re });
  }
  // Retain every source requirement. Unrecognized clauses stay explicit review items.
  for (const [text, group] of [[f.requirements, 'mandatory'], [f.desirable, 'desirable'], [f.mandatorySkills, 'mandatory']]) {
    for (const line of String(text || '').split(/\n|(?<=[.;])\s+/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(s => s.length > 8 && !/^[\wÀ-ÿ ]+:$/.test(s))) {
      const normalizedLine = normalize(line);
      const matches = criteria.filter(c => (c.vacancyRe || c.re)?.test(normalizedLine) || c.tokens && normalize(c.label) === normalizedLine);
      const mapped = matches.map(c => c.id);
      const residual = matches.reduce((text, c) => c.re ? text.replace(new RegExp((c.vacancyRe || c.re).source, 'g'), '') : '', normalizedLine);
      const residualWords = [...new Set(residual.split(' ').filter(w => w.length > 2 && !filler.has(w) && !/^[0-9]+$/.test(w)))];
      if (!mapped.length || residualWords.length >= 2) {
        const words = mapped.length ? residualWords : [...new Set(normalizedLine.split(' ').filter(w => w.length > 2 && !filler.has(w)))];
        const id = `text-${coverage.length}`;
        criteria.push({ id, label: mapped.length ? `Detalhes adicionais: ${line}` : line, group, weight: 1, tokens: words });
        mapped.push(id);
      }
      coverage.push({ text: line, criteria: mapped, group });
    }
  }
  for (const c of criteria) {
    if (behavioral.has(c.id)) { c.group = 'behavioral'; c.weight = 0; }
    else if (c.tokens) { c.group = 'review'; c.weight = 0; }
    else if (c.group === 'mandatory') {
      const [group, weight] = scoringGroups[c.id] || [c.id, c.id.startsWith('module-') ? 3 : 1];
      c.scoreGroup = group; c.weight = weight;
    }
  }
  return { criteria, coverage, core, operational: ['language', 'minimumYears', 'seniority', 'workModel', 'city', 'state', 'start', 'duration', 'contractType'].filter(key => f[key]), processInstructions: [f.instructions, f.attachments].filter(Boolean) };
}

const action = /configur|parametriz|implement|implant|desenvolv|elabor|escrev|escrit|execut|apoio|apoi|suport|support|sustenta|analis|analys|realiz|respons|atu[aeo]|trabalh|worked|delivered|customiz|conduz|defini|gerenc|lead|consultor(?:a)? (?:funcional |senior |pleno )?sap|sap (?:fi|fico) consultant/;
function segments(sources) {
  return sources.flatMap(source => {
    let section = /cursos|formacao/.test(source.field) ? 'training' : /skills|tecnologias|conhecimento/.test(source.field) ? 'list' : 'text';
    let previous = '';
    return source.text.split(/\n|[•●▪]|(?<=[.;])\s+|(?=Tools & Technologies:)/).map(line => {
      const normalized = normalize(line);
      if (/^(experiencias?|historico profissional|projetos|professional experience|employment)/.test(normalized)) section = 'work';
      else if (/^(cursos|formacao|certificacoes|education|training)/.test(normalized)) section = 'training';
      else if (/^(habilidades|competencias|conhecimentos|skills|technologies)/.test(normalized)) section = 'list';
      const row = { text: line, normalized, context: `${previous} ${normalized}`, source: source.label, field: source.field, section };
      previous = normalized;
      return row;
    }).filter(row => row.normalized);
  });
}
function compareCriterion(c, rows) {
  if (c.group === 'behavioral') return { requirement: c.label, criterionId: c.id, group: 'behavioral', status: 'interview', detail: 'Avaliar na entrevista. Critério comportamental fora da pontuação.', excerpt: '', source: '', strength: 0 };
  let best = { requirement: c.label, criterionId: c.id, group: c.group, status: 'unknown', detail: 'Não localizado nos textos disponíveis; confirmar com o profissional.', excerpt: '', source: '', strength: 0 };
  for (const row of rows) {
    if (/requisitos da vaga|vaga exige|buscamos profissionais|job description|candidato deve/.test(row.normalized)) continue;
    const groupedModule = c.id.startsWith('module-') && /sap fi|sap fico/.test(row.context)
      && ['ap', 'ar', 'gl', 'aa'].filter(m => new RegExp(`\\b${m}\\b`).test(row.normalized)).length >= 2
      && new RegExp(`\\b${c.id.slice(7).toLowerCase()}\\b`).test(row.normalized);
    const hit = c.re ? c.re.test(row.normalized) || groupedModule : c.tokens.length && c.tokens.filter(token => row.normalized.includes(token)).length / c.tokens.length >= .65;
    if (!hit) continue;
    const negated = /\bsem (?:experiencia|conhecimento|atuacao|certificacao)|nao (?:possuo|tenho|atuei|trabalhei|sou certificado)|no experience|never worked/.test(row.normalized);
    const training = row.section === 'training' || (/\bcursos?\b|\bcourses?\b|\bacademia\b|\bacademy\b|\btreinamento\b|\btraining\b|\bcursando\b/.test(row.normalized) && !/ministr|conduz|treinou|trained|delivered training/.test(row.normalized));
    const list = row.section === 'list' || /^(skills|conhecimento|habilidades|tecnologias|tools and technologies|tools technologies)/.test(row.normalized);
    const functionalCriterion = c.id === 'core' || c.id.startsWith('module-') || ['implementation', 'configuration', 'specification'].includes(c.id);
    const unrelatedRole = /abap|developer|desenvolvedor|(?:project|program|programme) manager|gerente de (?:projetos|programas)|infrastructure|infraestrutura|cloud|sap basis|data warehouse|\betl\b|\bbw\b/.test(row.context);
    const functionalWork = /(?:consultor|consultant|analista) funcional|functional (?:consultant|analyst)|(?:configur\w*|parametriz\w*)[^.]{0,60}(?:sap fi\b|sap fico|fi (?:gl|ap|ar|aa)|contas a pagar|contas a receber)/.test(row.normalized);
    const broadFinanceOnly = c.id === 'core' && /sap finan/.test(row.normalized) && !/sap fi\b|sap fico\b|fi (?:gl|ar|ap|aa)\b/.test(row.normalized);
    const nonFunctional = functionalCriterion && ((unrelatedRole && !functionalWork) || broadFinanceOnly);
    const certificate = c.id === 'certification' && /certificad[oa]|certified|certificacao (?:sap|em sap)/.test(row.normalized) && !/curso|training|cursando|prepar|em andamento|objetivo|pretend/.test(row.normalized);
    const fiCore = c.id === 'core' && /sap fi/.test(normalize(c.label));
    const directFunctional = /consultor|consultant|funcional|functional|configur|parametriz|implement|implant|sustent|suport|support/.test(row.normalized);
    const work = !list && !training && !nonFunctional && action.test(row.normalized) && (!fiCore || directFunctional);
    let strength = negated ? 0 : certificate ? 1 : work && !c.tokens ? 1 : .5;
    let status = negated ? 'conflict' : strength === 1 ? 'evidence' : 'mention';
    if (c.ambiguous && strength > 0) { status = 'ambiguous'; }
    const rank = strength + (negated ? .1 : 0);
    if (!best.excerpt || rank > best.strength) {
      best = { requirement: c.label, criterionId: c.id, group: c.group, status, strength,
        detail: status === 'evidence' ? 'Evidência declarada no currículo; sujeita a validação.' : status === 'conflict' ? 'Declaração negativa encontrada; conferir.' : status === 'ambiguous' ? 'Equivalência FA/FI usada como hipótese de busca; validar nomenclatura.' : training ? 'Formação/curso, não comprova atuação profissional.' : 'Menção ou declaração parcial; confirmar escopo e domínio.',
        excerpt: evidenceExcerpt(row.text, c), source: row.source };
    }
  }
  return best;
}
function evidenceExcerpt(text, criterion) {
  const limit = 420;
  if (text.length <= limit) return text.trim();
  // Locate the matching clause before shortening display; matching itself uses full text.
  const words = text.match(/\S+\s*/g) || [];
  let offset = 0, anchor = 0;
  for (let i = 0; i < words.length; i++) {
    const window = normalize(words.slice(i, i + 12).join(''));
    if (criterion.re ? criterion.re.test(window) : criterion.tokens.some(token => window.includes(token))) { anchor = offset; break; }
    offset += words[i].length;
  }
  const start = Math.max(0, anchor - 80);
  return `${start ? '…' : ''}${text.slice(start, start + limit).trim()}${start + limit < text.length ? '…' : ''}`;
}
function languageLevel(value) {
  const text = normalize(value);
  if (/cursando|em andamento|em desenvolvimento|estudando/.test(text)) return 0;
  const levels = [[1, /\bbasic\w*\b|\ba[12]\b|limited working/], [2, /intermedi\w*|\bb[12]\b|professional working/], [3, /avancad\w*|advanced|\bc1\b|full professional/], [4, /fluen\w*|native|nativ\w*|\bc2\b|bilingual/]];
  const hits = levels.filter(([, re]) => re.test(text)).map(([level]) => level);
  return hits.length ? Math.min(...hits) : 0;
}
function operationalChecks(cv, f, sources, rows, coreCriterion) {
  const checks = [];
  const add = (requirement, status, detail, excerpt = '', source = '') => checks.push({ requirement, group: 'operational', status, detail, excerpt, source, strength: status === 'evidence' ? 1 : 0 });
  if (f.language) {
    const english = /english|ingles/.test(normalize(f.language));
    const spanish = /espanhol|spanish|espanol/.test(normalize(f.language));
    const structured = english ? cv.nivel_ingles || cv.englishLevel : spanish ? cv.nivel_espanhol : '';
    const scoped = rows.filter(r => (english ? /ingles|english/ : spanish ? /espanhol|spanish|espanol/ : /idioma|language/).test(r.normalized));
    const text = structured || scoped.map(r => {
      const target = english ? /(?:ingles|english)\b/ : /(?:espanhol|spanish|espanol)\b/;
      const other = english ? /espanhol|spanish|espanol|frances|french|portugues|portuguese|alemao|german/ : /ingles|english|frances|french|portugues|portuguese/;
      const normalized = normalize(r.text), at = normalized.search(target);
      const relevant = at >= 0 ? normalized.slice(at) : normalized;
      const stop = relevant.search(other);
      return stop >= 0 ? relevant.slice(0, stop) : relevant;
    }).join('\n');
    const actual = languageLevel(text), required = languageLevel(f.language);
    add(`Idioma: ${f.language}`, !actual ? 'unknown' : required && actual < required ? 'conflict' : 'evidence', !actual ? 'Nível completo não comprovado; validar conversação.' : actual < required ? 'Nível declarado abaixo do solicitado; validar antes de apresentar.' : 'Nível declarado compatível; validar conversação.', text, structured ? 'Idioma cadastrado' : 'Textos do currículo');
  }
  if (f.minimumYears) {
    const timePattern = /\b(\d+)\s*(?:anos|years)(?:(?: de| em| of| in| experiencia| experience| projetos| projects?))*\s+(?:implement\w*|implant\w*)/;
    const explicit = rows.find(r => coreCriterion?.re.test(r.normalized) && timePattern.test(r.normalized) && [...r.normalized.matchAll(/\b\d+\s*(?:anos|years)\b/g)].length === 1 && !/sem experiencia|curso|training/.test(r.normalized));
    const years = explicit ? Number(explicit.normalized.match(timePattern)[1]) : 0;
    add(`Experiência: ${f.minimumYears} anos em implementação`, years >= Number(f.minimumYears) ? 'evidence' : 'unknown', years ? `${years} anos declarados em contexto de implementação; confirmar dedicação e escopo.` : 'Não há declaração inequívoca do tempo específico em implementação. Períodos de atuação no módulo não comprovam duração exclusiva em implementação.', explicit?.text || '', explicit?.source || '');
  }
  const currentTitle = cv.currentTitle || cv.cargo_atual || '';
  if (f.seniority) add(`Senioridade: ${f.seniority}`, 'unknown', 'Nível da vaga não determina automaticamente o nível do candidato. Validar autonomia e entregas.', currentTitle, currentTitle ? 'Cargo atual' : '');
  if (f.workModel) {
    const explicit = rows.find(r => /disponibilidade|disponivel|available|somente|apenas/.test(r.normalized) && /presencial|remoto|hibrido/.test(r.normalized));
    const incompatible = explicit && /somente remoto|apenas remoto|remote only|nao.*presencial/.test(explicit.normalized) && f.workModel === 'Presencial';
    add(`Modalidade: ${f.workModel}`, incompatible ? 'conflict' : 'unknown', incompatible ? 'Disponibilidade declarada diverge da modalidade.' : 'Confirmar disponibilidade atual; histórico de trabalho não confirma disponibilidade.', explicit?.text || '', explicit?.source || '');
  }
  if (f.city || f.state) add(`Local: ${[f.city, f.state].filter(Boolean).join('/')}`, 'unknown', 'Confirmar município e deslocamento. Endereço ou projeto anterior não comprova disponibilidade presencial.', textOf(cv.endereco || [cv.city, cv.state].filter(Boolean).join('/')), 'Endereço cadastrado');
  if (f.start) add(`Início: ${f.start}`, 'unknown', 'Confirmar disponibilidade na data solicitada.');
  if (f.duration) add(`Duração: ${f.duration}`, 'unknown', 'Confirmar disponibilidade para todo o período.');
  add('Contratação: PJ', 'unknown', 'Confirmar aceite e condições para contratação PJ.');
  return checks;
}

export function compareIntakeCurriculum(cv, fields, plan = compileIntakeRequirements(fields)) {
  const sources = curriculumSources(cv), rows = segments(sources);
  const core = plan.criteria.find(c => c.id === 'core');
  const related = !!core && rows.some(r => core.re.test(r.normalized));
  if (!related) return null;
  const location = locationEligibility(cv, fields);
  if (location.status === 'outside') return null;
  const matrix = plan.criteria.map(c => compareCriterion(c, rows));
  // A project in an unrelated ERP or infrastructure area is not evidence of
  // functional work in the requested module. Keep related mentions for review.
  if (/sap fi/.test(normalize(plan.core)) && matrix.find(c => c.criterionId === 'core')?.status !== 'evidence') {
    for (const item of matrix) if (item.status === 'evidence' && item.criterionId !== 'certification') {
      item.status = 'mention'; item.strength = .5;
      item.detail = 'Atividade localizada, mas atuação funcional em SAP FI não comprovada no contexto; confirmar escopo.';
    }
  }
  const operations = operationalChecks(cv, fields, sources, rows, core);
  operations.push({ requirement: 'Raio geográfico de até 100 km', group: 'operational', status: location.allowed ? 'evidence' : 'unknown', detail: location.detail, excerpt: '', source: 'Localização cadastrada', strength: 0 });
  const required = matrix.filter(c => c.group === 'mandatory');
  const groups = new Map();
  for (let i = 0; i < plan.criteria.length; i++) {
    const c = plan.criteria[i]; if (c.group !== 'mandatory' || !c.weight) continue;
    if (!groups.has(c.scoreGroup)) groups.set(c.scoreGroup, { weight: c.weight, items: [] });
    groups.get(c.scoreGroup).items.push(matrix[i]);
  }
  let totalWeight = 0, assessedWeight = 0, earned = 0;
  for (const group of groups.values()) {
    totalWeight += group.weight;
    const assessed = group.items.filter(c => c.status !== 'unknown');
    const weight = group.weight * assessed.length / group.items.length;
    assessedWeight += weight;
    earned += assessed.length ? weight * assessed.reduce((sum, c) => sum + c.strength, 0) / assessed.length : 0;
  }
  const score = assessedWeight ? Math.round(100 * earned / assessedWeight) : null;
  const evidenceCoverage = totalWeight ? Math.round(100 * assessedWeight / totalWeight) : 0;
  const rankingScore = totalWeight ? earned / totalWeight : 0;
  const evidence = matrix.filter(c => c.status === 'evidence');
  const pending = [...matrix, ...operations].filter(c => c.status !== 'evidence').map(c => `${c.requirement}: ${c.detail}`);
  return { score, evidenceCoverage, rankingScore, location, scoring: { totalWeight, assessedWeight, earned, groups: groups.size }, classification: required.length && required.every(c => c.status === 'evidence') && location.allowed ? 'approved' : 'review',
    evidence, pending, operationalChecks: operations, comparison: [...matrix, ...operations],
    coverage: plan.coverage, processInstructions: plan.processInstructions,
    sourcesRead: sources.map(s => s.label), charactersRead: sources.reduce((sum, s) => sum + s.text.length, 0),
    cvText: sources.map(s => `[${s.label}]\n${s.text}`).join('\n\n'),
    experience: experienceEvidence(sources.map(s => s.text).join('\n\n'), plan.core),
    sourceNotice: 'Análise contextual local por critérios e equivalências. Nenhuma ausência é tratada como prova de falta de experiência.' };
}
