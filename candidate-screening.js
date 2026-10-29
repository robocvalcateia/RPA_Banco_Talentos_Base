// Evidence-based screening. Unknown information is never treated as confirmation.
export const VACANCY_RULE_VERSION = 'technical-triage-v5';
export const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim().replace(/\s+/g, ' ');
export const phrases = (value = '') => [...new Set(String(value).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean))];
const aliases = {
  'tax one': ['TaxOne', 'Mastersaf DW', 'Mastersaf Data Warehouse'],
  'mastersaf dw': ['Tax One', 'TaxOne', 'Mastersaf Data Warehouse'],
  successfactors: ['SAP SuccessFactors', 'Success Factors', 'SAP Success Factors'],
  datasul: ['TOTVS Datasul'],
  'oracle cloud': ['Oracle ERP Cloud', 'Oracle Fusion', 'Fusion', 'ERP Cloud', 'ERP Oracle'],
  'oracle erp cloud': ['Oracle Cloud', 'Oracle Fusion', 'Fusion', 'ERP Cloud', 'ERP Oracle'],
  protheus: ['TOTVS Protheus'],
  'totvs rm': ['RM TOTVS', 'Linha RM'],
  fluig: ['TOTVS Fluig'],
  winthor: ['TOTVS WinThor'],
  'totvs fiscal': ['fiscal totvs'],
  'totvs financeiro': ['financeiro totvs'],
  'totvs contábil': ['contabil totvs', 'totvs contabil'],
  'totvs compras': ['compras totvs'],
  'totvs estoque': ['estoque totvs'],
  'totvs faturamento': ['faturamento totvs'],
  'totvs manufatura': ['manufatura totvs'],
  'totvs rh': ['rh totvs', 'totvs recursos humanos'],
  'sap fi': ['sap fico', 'fi co', 'fi ap', 'fi ar', 'fi gl'],
  'sap ap': ['fi ap', 'accounts payable', 'contas a pagar'],
  'sap ar': ['fi ar', 'accounts receivable', 'contas a receber'],
  'sap gl': ['fi gl', 'general ledger', 'razao geral', 'contabilidade geral'],
  'sap mm': ['mm sap', 'mm wm', 'sap materials management'],
  'localizacao brasil': ['localizacao brasileira', 'brazil localization', 'brazilian localization'],
  'pl sql': ['plsql'], 'sap s4hana': ['s4hana', 's 4hana', 's4 hana', 's 4 hana'],
  'sap s 4hana': ['s4hana', 's 4hana', 's4 hana', 's 4 hana'],
  's 4hana': ['SAP S/4HANA', 's4hana', 's4 hana', 's 4 hana'],
  'net': ['dotnet', 'asp net'], 'dotnet': ['net', 'asp net'],
  pmp: ['project management professional'],
  'contas a pagar': ['accounts payable', 'fi ap'],
  'contas a receber': ['accounts receivable', 'fi ar'],
  'razao geral': ['general ledger', 'fi gl'],
  'reforma tributaria': ['tax reform'],
  'sap activate': ['activate'], 'sap ecc': ['ecc'],
  'revisao de faturas': ['invoice verification', 'invoice review', 'verificacao de faturas'],
  'impostos retidos': ['withholding tax', 'retencao de impostos'],
  greenfield: ['green field'], brownfield: ['brown field'],
  'plano de contas': ['chart of accounts'],
  'fechamento contabil': ['financial closing', 'financial close', 'month end closing', 'fechamento financeiro'],
  conciliacao: ['conciliacoes', 'reconciliation', 'reconciliations'],
  r2r: ['record to report'], p2p: ['procure to pay'],
  'integracao fi mm': ['fi mm', 'mm fi'], 'integracao fi sd': ['fi sd', 'sd fi'],
  'suporte ams': ['ams', 'sustentacao', 'application management services'],
  implementacao: ['implantacao', 'implementation'],
  'suporte funcional': ['suporte aos usuarios', 'suporte a usuarios', 'functional support'],
  'estrutura organizacional': ['organizational structure'],
  'sap drc': ['document and reporting compliance'],
  agile: ['agil', 'scrum'], 'sql server': ['mssql', 'microsoft sql server'],
  aws: ['amazon web services'], azure: ['microsoft azure'],
  kubernetes: ['k8s'], javascript: ['js'], typescript: ['ts']
};
export function skillAlternatives(skill) { return [skill, ...(aliases[normalize(skill)] || [])]; }
export function hasSkill(text, skill) {
  const haystack = ` ${normalize(text)} `;
  return skillAlternatives(skill).some(item => haystack.includes(` ${normalize(item)} `));
}
export function coreCompetencyParts(title) {
  const parts=String(title || '').split(/\s+[–—-]\s+/).map(part=>part
    .replace(/\b(?:s[eê]nior(?:es)?|pleno|j[uú]nior|senior|junior|sr|jr)\b/gi,' ')
    .replace(/\(\s*\d+\s*(?:posi[cç][oõ]es|vagas?)\s*\)/gi,' ').trim()).filter(Boolean);
  let primary=(parts.shift() || '').replace(/^(?:consultor(?:a|es|as)?|analistas?|especialistas?|desenvolvedor(?:a|es|as)?|gerente(?:\s+de\s+projetos)?|coordenador(?:a)?|engenheiro(?:a)?)\s+(?:(?:de|em|funcional|t[eé]cnico)\s+)*/i,'').trim();
  primary=primary.replace(/\bfiscais\b/gi,'fiscal').replace(/[–—-]\s*$/,'').trim();
  if (/\bsuccess\s*factors\b/i.test(primary)) primary='SuccessFactors';
  const key=Object.keys(aliases).find(key=>normalize(key)===normalize(primary));
  return {primary:key || primary,qualifiers:parts};
}
// A skill must be attached to the candidate's own work, never to a nearby
// unrelated activity, desired position, course, or keyword/search index.
export function professionalCoreEvidence(text, core) {
  const absent = { requirement: core, found: false, kind: 'experiência principal não comprovada', excerpt: '', strength: 0 };
  if (!String(core || '').trim()) return absent;
  const esc = value => normalize(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const competency=coreCompetencyParts(core);
  const terms = [...skillAlternatives(core),...skillAlternatives(competency.primary)].map(esc).filter(Boolean).join('|');
  const role = new RegExp('\\b(?:consultor[a]?|analista|especialista|gerente|coordenador[a]?|desenvolvedor[a]?|engenheiro[a]?|administrador[a]?|tecnico|consultant|developer|engineer|manager) (?:funcional |tecnico |senior |pleno |junior |de |em |do |da |na area de ){0,4}(?:'+terms+')\\b');
  const activity = new RegExp('\\b(?:experiencia (?:profissional )?(?:em|com)|atuacao (?:profissional )?(?:em|com)|atuei (?:em|com)|trabalhei (?:em|com)|responsavel (?:por|pela|pelo)|gestao de|implementacao(?: de| do| da)?|implantacao(?: de| do| da)?|parametrizacao(?: de| do| da)?|configuracao(?: de| do| da)?|suporte (?:em|de|ao|a)|desenvolvimento (?:em|com)|experience (?:in|with)|worked (?:in|with)) (?:'+terms+')\\b');
  const trailing = new RegExp('\\b(?:'+terms+') (?:consultant|developer|engineer|manager)\\b');
  let trainingSection = false;
  for (const raw of String(text || '').split(/[\n|•]|(?<=[.;])\s+/)) {
    const line = normalize(raw);
    if (/^(cursos?|formacao|certificacoes|education|training)\b/.test(line)) trainingSection = true;
    if (/^(experiencia|historico profissional|projetos|professional experience|employment)\b/.test(line)) trainingSection = false;
    if (!hasSkill(line, core) && !hasSkill(line, competency.primary)) continue;
    if (competency.qualifiers.some(term=>!hasSkill(line,term))) continue;
    if (trainingSection || /\b(?:curso|cursos|certificacao|certificacoes|objetivo|desejo|pretendo|busco|vaga|sem experiencia|nao tenho|nao possuo|nunca atuei|no experience)\b/.test(line)) continue;
    const procurement = /^(compras|suprimentos|procurement|purchasing)$/.test(normalize(competency.primary));
    if (procurement && /\b(?:sistema|sistemas|portal|software|erp|sap|protheus|requisitos|projeto de implantacao)\b/.test(line) && !role.test(line)) continue;
    const direct = role.test(line) || activity.test(line) || trailing.test(line)
      || (normalize(competency.primary) === 'pmo' && /\bpmo (?:responsavel|atuando)\b/.test(line));
    if (!direct) continue;
    // Existing domain checks still reject training, management-only SAP and data migration.
    const contextual = contextualEvidence(raw, core, core);
    if (contextual.kind === 'negação explícita' || contextual.kind.startsWith('somente formação')) continue;
    return { ...absent, found: true, kind: 'experiência profissional diretamente vinculada', excerpt: raw.trim(), strength: 1 };
  }
  return absent;
}

export function curriculumProfessionalEvidence(curriculum, core) {
  const workText=value=>Array.isArray(value)?value.map(workText).join('\n'):value && typeof value==='object'?Object.values(value).map(workText).join('\n'):String(value || '');
  const sources = [
    ['Cargo atual', curriculum.cargo_atual || curriculum.currentTitle],
    ['Experiência profissional', curriculum.experiencia_profissional],
    ['Currículo original', curriculum.texto_integral_original || curriculum.texto_integral],
    ['Experiências', curriculum.experiencias || curriculum.experiences],
    ['Projetos', curriculum.projetos]
  ];
  for (const [source, text] of sources) {
    const evidence = professionalCoreEvidence(workText(text), core);
    if (evidence.found) return { ...evidence, source };
  }
  return { ...professionalCoreEvidence('', core), source: 'Experiências e currículo original' };
}

export function coreKeyword(filter) {
  const explicit = phrases(filter.coreSkill)[0] || phrases(filter.mandatorySkills)[0];
  if (explicit) return concepts.find(term => hasSkill(explicit, term)) || explicit;
  return concepts.find(term => hasSkill(filter.jobDescription || '', term)) || '';
}
const productCatalog = ['Tax One', 'Mastersaf DW', 'Datasul', 'Oracle Cloud', 'Protheus', 'TOTVS RM', 'Fluig', 'WinThor', 'SAP FI', 'SAP MM', 'SAP SD', 'SAP CO', 'SAP ABAP', 'SAP ECC', 'S/4HANA', 'Synchro', 'Avalara'];
const totvsCatalog = ['TOTVS Fiscal', 'TOTVS Financeiro', 'TOTVS Contábil', 'TOTVS Compras', 'TOTVS Estoque', 'TOTVS Faturamento', 'TOTVS Manufatura', 'TOTVS RH', 'ADVPL', 'Progress 4GL', 'TSS'];
const taxCatalog = ['SPED', 'ECF', 'EFD', 'NFe', 'NFSe', 'CTe', 'eSocial', 'Reinf', 'GIA', 'DCTF', 'DCTFWeb', 'J1BTAX', 'OBYC', 'CNAB', 'R2R', 'P2P', 'CBT', 'TAXBRA', 'TAXBRJ', 'CFOP', 'CST', 'ICMS', 'ISS', 'PIS', 'COFINS', 'IPI', 'CBS', 'IBS', 'SAP DRC', 'SAP TDF'];
const deliveryCatalog = ['levantamento de requisitos', 'mapeamento de processos', 'parametrização', 'configuração', 'implementação', 'implantação', 'sustentação', 'suporte funcional', 'testes integrados', 'UAT', 'homologação', 'treinamento de usuários', 'migração de dados', 'integração', 'API', 'rollout', 'greenfield', 'brownfield', 'Agile', 'Scrum'];
const technicalCatalog = [...productCatalog, ...totvsCatalog, ...taxCatalog, ...deliveryCatalog, 'contas a pagar', 'contas a receber', 'razão geral', 'plano de contas', 'impostos retidos', 'reforma tributária', 'localização Brasil', 'fechamento contábil', 'conciliação', 'revisão de faturas', 'suporte AMS', 'Python', 'Java', 'JavaScript', 'TypeScript', 'C#', '.NET', 'SQL Server', 'PostgreSQL', 'Oracle', 'PL/SQL', 'AWS', 'Azure', 'Kubernetes', 'Docker', 'React', 'Angular', 'Node.js', 'CI/CD', 'REST', 'Git', 'debug'];
const concepts = ['SAP AP', 'SAP AR', 'SAP GL', ...technicalCatalog];
function removeCoveredGenericOracle(terms = []) {
  return terms.some(term => normalize(term) === 'oracle cloud')
    ? terms.filter(term => normalize(term) !== 'oracle')
    : terms;
}
function canonical(term) {
  return concepts.find(item => skillAlternatives(item).some(alias => normalize(alias) === normalize(term))) || term.trim();
}
function uniqueConcepts(terms) { return [...new Map(terms.map(term => [normalize(canonical(term)), canonical(term)])).values()]; }
function mentioned(text, term) {
  if (hasSkill(text, term)) return true;
  const short = { 'SAP AP': 'AP', 'SAP AR': 'AR', 'SAP GL': 'GL' }[term];
  return Boolean(short && /\b(?:SAP|FI|FICO)\b/i.test(text) && new RegExp(`\\b${short}\\b`, 'i').test(text));
}

// Compile the vacancy once, before retrieval. This is an explicit domain-rule
// interpreter, not a claim that an external language model reviewed the vacancy.
export function interpretVacancy(filter) {
  const core = canonical(coreKeyword(filter));
  const mandatoryText = String(filter.mandatorySkills || filter.coreSkill || core);
  const mandatory = uniqueConcepts([core, ...phrases(mandatoryText).flatMap(part => {
    const known = removeCoveredGenericOracle(concepts.filter(term => mentioned(part, term)));
    return known.length ? known : [part];
  })].filter(Boolean));
  if (/sap fi(?:co)?/.test(normalize(core))) {
    for (const term of ['SAP AP', 'SAP AR', 'SAP GL']) if (mentioned(mandatoryText, term) && !mandatory.includes(term)) mandatory.push(term);
  }
  const ranked = new Map();
  const add = (term, group) => {
    term = canonical(term);
    if (mandatory.some(item => normalize(item) === normalize(term))) return;
    const previous = ranked.get(normalize(term));
    if (!previous || group === 'central') ranked.set(normalize(term), { term, group, weight: group === 'central' ? 3 : 1 });
  };
  let section = 'central';
  for (const sentence of String(filter.jobDescription || '').split(/\n|(?<=[.;])\s+/)) {
    if (/conhecimentos.*desej[aá]veis|diferenciais\s*:/i.test(sentence)) section = 'differential';
    if (/conhecimentos.*necess[aá]rios|requisitos.*obrigat[oó]rios/i.test(sentence)) section = 'central';
    const group = /mandat[oó]ri|obrigat[oó]ri/i.test(sentence) ? 'central' : /diferencial|diferenciais|desej[aá]vel|desej[aá]veis/i.test(sentence) ? 'differential' : section;
    removeCoveredGenericOracle(concepts.filter(term => mentioned(sentence, term))).forEach(term => add(term, group));
  }
  for (const term of phrases(filter.desirableSkills)) {
    const key = normalize(canonical(term));
    ranked.set(key, { term: canonical(term), group: 'differential', weight: 1 });
  }
  phrases(filter.technicalSkills).forEach(term => add(term, 'central'));
  const ranking = [...ranked.values()].filter(item => !mandatory.some(term => normalize(term) === normalize(item.term)));
  return { version: VACANCY_RULE_VERSION, core, mandatory, ranking,
    retrievalTerms: [...new Set([core, ...skillAlternatives(core)].filter(Boolean))],
    operational: { englishLevel: filter.englishLevel || ['', 'Básico', 'Intermediário', 'Avançado', 'Fluente'][englishEvidence(filter.jobDescription || '')], locations: filter.locations || [filter.city, filter.state].filter(Boolean).join('/'), minimumYears: Number(String(filter.jobDescription || '').match(/\b(\d+)\s*(?:\+\s*)?anos\b/i)?.[1] || 0), availability: /viagens|exclusiv|presencial|h[ií]brid/i.test(filter.jobDescription || '') },
    warnings: core ? [] : ['Informe o skill obrigatório; a descrição não substitui a definição da competência principal.'] };
}

function prepareEvidence(text) {
  const lines = String(text).split(/\n|(?<=[.;])\s+/).map(line => line.trim()).filter(Boolean);
  const contexts = lines.map((line, index) => lines.slice(Math.max(0, index - 2), index + 1).join(' '));
  return { lines, contexts, normalized: lines.map(line => ` ${normalize(line)} `), normalizedContexts: contexts.map(line => ` ${normalize(line)} `) };
}
export function contextualEvidence(text, term, core = '', prepared = prepareEvidence(text)) {
  const { lines, contexts, normalized, normalizedContexts } = prepared;
  const alternatives = skillAlternatives(term).filter(alias => !(term === 'SAP FI' && normalize(alias) === 'fi co')).map(alias => ` ${normalize(alias)} `);
  const short = { 'SAP AP': 'ap', 'SAP AR': 'ar', 'SAP GL': 'gl' }[term];
  let best = { requirement: term, found: false, kind: 'não evidenciado', excerpt: '', strength: 0 };
  let section = '';
  const sapTerm = /^sap (fi|ap|ar|gl)$/i.test(term);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^(experi[eê]ncia|hist[oó]rico profissional|projetos|professional experience|employment)/i.test(line)) section = 'work';
    else if (/^(cursos|forma[cç][aã]o|certifica[cç][oõ]es|education|training)/i.test(line)) section = 'training';
    else if (/^(habilidades|compet[eê]ncias|conhecimentos?|skills|technologies)/i.test(line)) section = 'list';
    const context = contexts[index];
    const explicitMention = alternatives.some(alias => normalized[index].includes(alias));
    const groupedProcesses = ['ap', 'ar', 'gl'].every(part => normalized[index].includes(` ${part} `));
    const labeledProcess = short && new RegExp(`\\b(?:fi|modulo|submodulo)\\s+(?:de\\s+)?${short}\\b`).test(normalized[index]);
    const shortMention = short && normalized[index].includes(` ${short} `) && (groupedProcesses || labeledProcess) && /\b(?:sap fi|sap fico|fi ap|fi ar|fi gl)\b/.test(normalizedContexts[index]);
    if (!explicitMention && !shortMention) continue;
    const negative = /\b(?:sem experi[eê]ncia|n[aã]o (?:possuo|tenho|atuei|trabalhei)|no experience|never worked)\b/i.test(line);
    const training = /\bcurso\b|\bcourses?\b|\btreinamento\b|\bacademia\b|\bacademy\b|\btraining\b|\bcertified\b|\bcertification\b|\bcertifica[cç][aã]o\b/i.test(line) || section === 'training';
    const workLanguage = /configura|parametriza|implanta|implement|suporte|support|sustenta|atua[cç]|atuei|atuou|atuando|respons[aá]vel|responsible|consultor(?:a)?\s+(?:(?:s[eê]nior|pleno|sr)\s+)?(?:funcional|SAP)|SAP\s+(?:FI(?:CO)?|MM|SD)\s+consultant|functional consultant|experi[eê]ncia\s+(?:profissional|em|com)|experience\s+(?:in|with)|desenvolv|develop|delivered|worked|customiz|rollout\s+(?:de|do|para|com|SAP)/i;
    const action = workLanguage.test(line);
    const nearbyWork = section !== 'list' && workLanguage.test(context);
    const sapContext = !sapTerm || /\b(?:SAP|FICO|FI[- /](?:AP|AR|GL))\b/i.test(context);
    const onlyTechnicalRole = sapTerm && /\b(?:ABAP|developer|desenvolvedor|programador)\b/i.test(context) && !/funcional|functional|configura|parametriza/i.test(context);
    const dataWorkOnly = sapTerm && /\b(?:BW|BI|ETL|Datastage|Fabric)\b|data warehouse|business intelligence|indicadores|data lake/i.test(context) && !/consultor(?:a)?\s+funcional|functional consultant|parametriza[^.]{0,50}\bFI\b/i.test(line);
    const dataTransferPurpose = sapTerm && /\b(?:recuperar|extrair|transferir|migrar)\b[^.;]{0,45}\bdados\b|extra[cç][aã]o de dados|data extraction|data migration|data integration|data pipelines|\bBigQuery\b/i.test(line);
    const managementOnly = sapTerm && /project manager|gerente de projetos|gest[aã]o de projetos|management of|condu[cç][aã]o de projetos/i.test(line) && !/configura|parametriza|customiz|consultor(?:a)? funcional|functional consultant/i.test(line);
    const skillList = /^(?:[•*\-]\s*)?(?:conhecimentos?|habilidades|compet[eê]ncias|skills|technologies)\b/i.test(line);
    const work = (short ? action : action || nearbyWork) && sapContext && !onlyTechnicalRole && !managementOnly && !dataWorkOnly && !dataTransferPurpose && !skillList;
    const strength = negative || training ? 0 : work ? 1 : 0.25;
    const kind = negative ? 'negação explícita' : training ? 'somente formação; atuação não comprovada' : work ? 'atuação profissional descrita' : 'menção sem atuação comprovada';
    if (!best.excerpt || strength > best.strength) {
      let excerpt = line;
      if (line.length > 500) {
        const words = line.split(/\s+/);
        for (let start = 0; start < words.length; start += 15) {
          const fragment = words.slice(start, start + 55).join(' ');
          const haystack = ` ${normalize(fragment)} `;
          if (alternatives.some(alias => haystack.includes(alias)) || (shortMention && haystack.includes(` ${short} `))) { excerpt = `…${fragment}…`; break; }
        }
      }
      best = { requirement: term, found: strength === 1, kind, excerpt, strength };
    }
  }
  return best;
}
const filler = new Set('consultor consultant profissional experiencia conhecimento conhecimentos necessario necessarios desejavel desejaveis senior minimo anos mais atuação atuacao projetos simultaneos disponibilidade viagens nacionais ingles avancado fluente conversacao trabalho hibrido presencial remoto dedicacao exclusiva superior concluido comprovado sera teste aplicado boa comunicacao proatividade horas mes com para que uma dos das nos nas por ate como inicio fim sao paulo rio janeiro'.split(' '));
function technicalTerms(filter) {
  if (phrases(filter.technicalSkills).length) return phrases(filter.technicalSkills);
  const description = String(filter.jobDescription || '').split(/conhecimentos\s+t[eé]cnicos\s+desej[aá]veis/i)[0];
  const known = technicalCatalog.filter(term => hasSkill(description, term));
  if (known.length) return known;
  return [...new Set(normalize(description).split(' ').filter(term => term.length >= 3 && !filler.has(term)))];
}
export function englishEvidence(text = '', structured = '') {
  // Do not confuse Spanish fluency, an advanced technical course, or the job description with English.
  const fragments = structured ? [structured] : (String(text).match(/(?:ingl[eê]s|english)[^\n.;]{0,65}|(?:fluent|advanced|basic|intermediate)\s+english/gi) || []);
  const normalized = normalize(fragments.map(fragment => fragment.split(/espanhol|spanish|franc[eê]s|french|alem[aã]o|german/i)[0]).join(' '));
  const patterns = [[4, /\b(fluente|fluent|native|nativo|c2)\b/], [3, /\b(avancado|advanced|c1|upper intermediate)\b/], [2, /\b(intermediario|intermediate|b1|b2)\b/], [1, /\b(basico|basic|tecnico|elementary|a1|a2)\b/]];
  return patterns.find(([, pattern]) => pattern.test(normalized))?.[0] || 0;
}
function locationEvidence(text, filter, candidate) {
  const alternatives = phrases(String(filter.locations || '').replace(/,/g, ';')).map(value => {
    const [city, state] = value.split('/').map(s => s.trim());
    return { city, state };
  });
  if (!alternatives.length && (filter.city || filter.state)) alternatives.push({ city: filter.city, state: filter.state });
  if (!alternatives.length) return 'not_required';
  const city = candidate.city || '', state = candidate.state || '';
  const matches = alternatives.some(target => {
    const radiusTarget = Array.isArray(filter.cityRadiusLocations)
      ? filter.cityRadiusLocations.find(item => normalize(item.city) === normalize(target.city)
        && (!target.state || normalize(item.state) === normalize(target.state)))
      : null;
    const cities = radiusTarget?.cities?.length
      ? radiusTarget.cities
      : (alternatives.length === 1 && filter.cityRadiusCities?.length ? filter.cityRadiusCities : [target.city]);
    return (!target.state || (state && normalize(target.state) === normalize(state))) && (!target.city || cities.some(c => normalize(c) === normalize(city)));
  });
  if (city && matches) return 'met';
  if (city && state && !matches) return 'outside';
  if (!filter.city && !filter.locations && state) return normalize(state) === normalize(filter.state) ? 'met' : 'outside';
  // Mentions in employment history are leads, not proof of current residence/commuting availability.
  return 'unknown';
}
function trainingOnly(text, term) {
  const mentions = String(text).split(/\n|(?<=[.;])\s+/).filter(line => hasSkill(line, term));
  return mentions.length > 0 && mentions.every(line => /\bcurso\b|\btreinamento\b|\bacademia\b|\btraining\b|\bcertifica[cç][aã]o\b/i.test(line));
}
function scoreGroup(text, terms, requireWorkEvidence = false) {
  const hits = terms.filter(term => hasSkill(text, term) && (!requireWorkEvidence || !trainingOnly(text, term)));
  return { required: terms, hits, missing: terms.filter(term => !hits.includes(term)), score: terms.length ? Math.round(100 * hits.length / terms.length) : 0 };
}
export function evidenceExcerpt(text, term) {
  const lines = String(text).split(/\n|(?<=[.;])\s+/).map(s => s.trim()).filter(Boolean);
  const matching = lines.filter(line => hasSkill(line, term));
  const line = matching.find(line => !trainingOnly(line, term)) || matching[0];
  if (!line) return '';
  if (line.length <= 400) return line;
  const words = line.split(/\s+/);
  for (let start = 0; start < words.length; start += 10) {
    const snippet = words.slice(start, start + 30).join(' ');
    if (hasSkill(snippet, term)) return `…${snippet}…`;
  }
  return line;
}
// Month ranges are evidence only when explicitly attached to the relevant module.
// An incomplete chronology is never evidence of insufficient experience.
export function experienceEvidence(text, core, now = new Date()) {
  const ranges = [];
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  for (const block of String(text).split(/\n\s*\n/)) {
    if (!core || !hasSkill(block, core) || block.length > 1600) continue;
    for (const match of block.matchAll(/\b(0?[1-9]|1[0-2])[\/-](19\d{2}|20\d{2})\s*(?:a|at[eé]|[-–—])\s*(?:(0?[1-9]|1[0-2])[\/-](19\d{2}|20\d{2})|(atual|presente|present|current))\b/gi)) {
      const start = Number(match[2]) * 12 + Number(match[1]) - 1;
      const end = match[5] ? current : Number(match[4]) * 12 + Number(match[3]) - 1;
      if (start <= end && end <= current) ranges.push([start, end + 1]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return { months: merged.reduce((sum, [start, end]) => sum + end - start, 0), ranges: merged, basis: 'períodos explícitos vinculados ao módulo; sem sobreposição' };
}
export function screenCandidate(text, filter, candidate = {}, publicSummary = false) {
  const plan = filter.vacancyAnalysis?.version === VACANCY_RULE_VERSION ? filter.vacancyAnalysis : interpretVacancy(filter);
  const core = plan.core;
  const corePresent = core && mentioned(text, core);
  const prepared = prepareEvidence(corePresent ? text : '');
  const skillEvidence = plan.mandatory.map(term => ({ ...contextualEvidence(text, term, core, prepared), group: 'mandatory' }));
  const evidence = plan.ranking.map(item => ({ ...contextualEvidence(text, item.term, core, prepared), group: item.group, weight: item.weight }));
  const coreExperience = candidate.curriculum ? curriculumProfessionalEvidence(candidate.curriculum, core) : professionalCoreEvidence(text, core);
  const coreItem = skillEvidence.find(item => normalize(item.requirement) === normalize(core));
  if (coreItem && !coreExperience.found) Object.assign(coreItem, coreExperience);
  const mandatory = { hits: skillEvidence.filter(item => item.found).map(item => item.requirement), missing: skillEvidence.filter(item => !item.found).map(item => item.requirement) };
  const pending = mandatory.missing.map(term => `skill obrigatório a confirmar: ${term}`);
  const failed = corePresent ? [] : [`competência principal não evidenciada: ${core || 'não definida'}`];
  const operationalChecks = [];
  const location = locationEvidence(text, filter, candidate);
  if (location !== 'not_required') operationalChecks.push({ requirement: 'Localidade', status: location === 'met' ? 'meets' : location === 'outside' ? 'incompatible' : 'unknown', detail: location === 'met' ? 'Localidade declarada atende ao filtro' : location === 'outside' ? 'Residência fora da região; confirmar mobilidade' : 'Residência não comprovada' });
  const requiredEnglish = plan.operational.englishLevel;
  const englishRequired = englishEvidence('', requiredEnglish);
  const english = englishEvidence(text, candidate.englishLevel || '');
  if (englishRequired) operationalChecks.push({ requirement: 'Inglês', status: !english ? 'unknown' : english >= englishRequired ? 'meets' : 'incompatible', detail: !english ? 'Nível não informado; testar conversação' : english >= englishRequired ? 'Nível declarado atende; conversação ainda sujeita a teste' : `Nível declarado abaixo de ${requiredEnglish}` });
  const totalWeight = evidence.reduce((sum, item) => sum + item.weight, 0);
  const score = totalWeight ? Math.round(100 * evidence.reduce((sum, item) => sum + item.weight * item.strength, 0) / totalWeight) : 0;
  const headline = publicSummary ? String(text).split('\n')[0] : '';
  const currentTitle = String(candidate.currentTitle || (headline.includes(' - ') ? headline.split(' - ').slice(1).join(' - ') : headline));
  if (/s[eê]nior|\bsr\b/i.test(filter.jobDescription || '') && /\bj[uú]nior\b|\bjr\b|\btrainee\b|\bestagi[aá]ri/i.test(currentTitle)) operationalChecks.push({ requirement: 'Senioridade', status: 'incompatible', detail: 'Cargo atual declarado júnior; validar senioridade exigida' });
  const experience = experienceEvidence(text, core);
  if (plan.operational.minimumYears) operationalChecks.push({ requirement: 'Experiência mínima', status: experience.months >= plan.operational.minimumYears * 12 ? 'meets' : 'unknown', detail: experience.months ? `${experience.months} meses documentados no módulo; mínimo solicitado ${plan.operational.minimumYears} anos` : 'Cronologia não comprovada; não significa ausência de experiência' });
  if (plan.operational.availability) operationalChecks.push({ requirement: 'Disponibilidade', status: 'unknown', detail: 'Confirmar viagens, dedicação e regime presencial com o profissional' });
  if (publicSummary) pending.push('resumo público: obter CV completo antes de validar aderência');
  const classification = failed.length ? 'rejected' : pending.length ? 'review' : 'approved';
  const operationalPending = operationalChecks.filter(item => item.status !== 'meets').map(item => `${item.requirement}: ${item.detail}`);
  const explanation = [...failed, ...pending, ...operationalPending].join('; ');
  return {
    score, classification, accepted: classification === 'approved', review: classification === 'review',
    coreExperience, technicalScore: score, operationalChecks, approvalScope: 'technical_triage', presentationStatus: 'requires_validation',
    triageGroup: classification === 'approved' ? 'aprovado na triagem técnica' : classification === 'rejected' ? 'não aderente' : 'skill obrigatório a confirmar',
    evidence: [...skillEvidence, ...evidence], experience,
    scoreType: totalWeight ? 'aderência ponderada à descrição; não define aprovação' : 'descrição sem critérios técnicos de classificação',
    matchedMandatorySkills: mandatory.hits, missingMandatorySkills: mandatory.missing,
    jobDescriptionHits: evidence.filter(item => item.found).map(item => item.requirement), jobDescriptionMissing: evidence.filter(item => !item.found).map(item => item.requirement),
    missingListFilters: operationalChecks.filter(item => item.status === 'incompatible').map(item => item.detail), pendingChecks: [...pending, ...operationalPending],
    reason: explanation,
    observation: `${classification === 'approved' ? 'Aprovado na triagem técnica, não para contratação' : classification === 'review' ? 'Skill obrigatório a confirmar' : 'Competência principal não evidenciada'}. Aderência à descrição: ${score}%. ${explanation}.`,
    mandatory: { ...mandatory, accepted: !mandatory.missing.length }, job: { hits: evidence.filter(item => item.found).map(item => item.requirement), missing: evidence.filter(item => !item.found).map(item => item.requirement), score },
    publicSignals: evidence.filter(item => item.excerpt).map(item => item.requirement), publicGaps: pending
  };
}
export function screeningStats(rows, found = rows.length) {
  return { found, evaluated: rows.length, compatible: rows.filter(r => r.classification === 'approved').length, pending: rows.filter(r => r.classification === 'review').length, rejected: rows.filter(r => r.classification === 'rejected').length };
}
