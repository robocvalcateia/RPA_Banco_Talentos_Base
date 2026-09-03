// Evidence-based screening. Unknown information is never treated as confirmation.
export const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim().replace(/\s+/g, ' ');
export const phrases = (value = '') => [...new Set(String(value).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean))];
const aliases = {
  'sap fi': ['sap fico', 'fi co', 'fi ap', 'fi ar', 'fi gl'],
  'sap ap': ['fi ap', 'accounts payable', 'contas a pagar'],
  'sap ar': ['fi ar', 'accounts receivable', 'contas a receber'],
  'sap gl': ['fi gl', 'general ledger', 'razao geral'],
  'sap mm': ['mm sap', 'mm wm', 'sap materials management'],
  'localizacao brasil': ['localizacao brasileira', 'brazil localization', 'brazilian localization'],
  'pl sql': ['plsql'], 'sap s4hana': ['s4hana', 's 4hana', 's4 hana', 's 4 hana'],
  'sap s 4hana': ['s4hana', 's 4hana', 's4 hana', 's 4 hana'],
  's 4hana': ['s4hana', 's4 hana', 's 4 hana'],
  'net': ['dotnet', 'asp net'], 'dotnet': ['net', 'asp net'],
  pmp: ['project management professional'],
  'contas a pagar': ['accounts payable', 'fi ap'],
  'contas a receber': ['accounts receivable', 'fi ar'],
  'razao geral': ['general ledger', 'fi gl'],
  'reforma tributaria': ['tax reform'],
  'sap activate': ['activate'], 'sap ecc': ['ecc'],
  'revisao de faturas': ['invoice verification', 'invoice review', 'verificacao de faturas'],
  'impostos retidos': ['withholding tax', 'retencao de impostos'],
  greenfield: ['green field'], brownfield: ['brown field']
};
export function skillAlternatives(skill) { return [skill, ...(aliases[normalize(skill)] || [])]; }
export function hasSkill(text, skill) {
  const haystack = ` ${normalize(text)} `;
  return skillAlternatives(skill).some(item => haystack.includes(` ${normalize(item)} `));
}
export function coreKeyword(filter) {
  const explicit = phrases(filter.coreSkill)[0] || phrases(filter.mandatorySkills)[0];
  if (explicit) return explicit;
  return String(filter.jobDescription || '').match(/\bSAP\s+(?:FI(?:CO)?|MM|SD|ABAP|CO)\b/i)?.[0] || '';
}
const technicalCatalog = ['SAP FI', 'SAP MM', 'SAP SD', 'SAP CO', 'SAP ECC', 'S/4HANA', 'contas a pagar', 'contas a receber', 'razão geral', 'plano de contas', 'impostos retidos', 'reforma tributária', 'localização Brasil', 'J1BTAX', 'OBYC', 'CNAB', 'R2R', 'P2P', 'CBT', 'TAXBRA', 'TAXBRJ', 'CFOP', 'CST', 'ICMS', 'PIS', 'COFINS', 'IPI', 'CBS', 'IBS', 'revisão de faturas', 'SAP Activate', 'ASAP', 'Agile', 'rollout', 'greenfield', 'brownfield', 'SPED', 'ECF', 'SAP DRC', 'SAP TDF', 'Synchro', 'Avalara', 'debug'];
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
    const cities = alternatives.length === 1 && !filter.locations && filter.cityRadiusCities?.length ? filter.cityRadiusCities : [target.city];
    return (!target.state || !state || normalize(target.state) === normalize(state)) && (!target.city || cities.some(c => normalize(c) === normalize(city)));
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
  const core = coreKeyword(filter);
  const mandatory = scoreGroup(text, phrases(filter.mandatorySkills));
  const technical = scoreGroup(text, technicalTerms(filter), true);
  const desirable = scoreGroup(text, phrases(filter.desirableSkills));
  const pending = [], failed = [];
  const coreMet = core ? hasSkill(text, core) : technical.hits.length > 0;
  if (!coreMet) failed.push(`competência principal não evidenciada: ${core || 'informe a competência principal'}`);
  for (const skill of mandatory.missing) {
    const indirectLocalization = normalize(skill) === 'localizacao brasil' && ['J1BTAX', 'TAXBRA', 'TAXBRJ'].some(term => hasSkill(text, term));
    (publicSummary || indirectLocalization ? pending : failed).push(`habilidade obrigatoria ausente como declaração explícita: ${skill}${indirectLocalization ? '; há indícios técnicos de localização, validar escopo no CV' : publicSummary ? '; confirmar no CV completo' : ''}`);
  }
  // Tax codes alone are supporting evidence, not synonyms that prove localization expertise.
  const location = locationEvidence(text, filter, candidate);
  if (location === 'unknown') pending.push('localidade nao evidente; confirmar residência e disponibilidade presencial');
  if (location === 'outside') pending.push('localidade fora da região solicitada; confirmar mobilidade, sem presumir disponibilidade');
  const englishRequired = englishEvidence('', filter.englishLevel || '');
  const english = englishEvidence(text, candidate.englishLevel || '');
  if (englishRequired && !english) pending.push('nivel de ingles nao evidente; confirmar conversação');
  if (englishRequired && english && english < englishRequired) failed.push(`filtro obrigatorio: inglês informado abaixo de ${filter.englishLevel}`);
  const groups = [[20, coreMet ? 100 : 0], [60, technical.score]];
  if (location !== 'not_required') groups.push([5, location === 'met' ? 100 : 0]);
  if (englishRequired) groups.push([10, english >= englishRequired ? 100 : 0]);
  if (desirable.required.length) groups.push([5, desirable.score]);
  const weightedScore = Math.round(groups.reduce((sum, [weight, value]) => sum + weight * value, 0) / groups.reduce((sum, [weight]) => sum + weight, 0));
  const criticalTerms = normalize(core) === 'sap fi' ? ['SAP AP', 'SAP AR', 'SAP GL'] : normalize(core) === 'sap mm' ? ['J1BTAX', 'revisão de faturas'] : [];
  const criticalMissing = criticalTerms.filter(term => technical.required.some(required => normalize(required) === normalize(term)) && !technical.hits.some(hit => normalize(hit) === normalize(term)));
  const technicalMet = technical.required.length > 0 && technical.score >= 60 && !criticalMissing.length;
  const score = technicalMet ? weightedScore : Math.min(weightedScore, 49);
  if (!technicalMet) pending.push('requisitos técnicos centrais insuficientemente evidenciados; não priorizar por diferenciais');
  if (criticalMissing.length) pending.push(`confirmar requisitos centrais: ${criticalMissing.join(', ')}`);
  const headline = publicSummary ? String(text).split('\n')[0] : '';
  const currentTitle = String(candidate.currentTitle || (headline.includes(' - ') ? headline.split(' - ').slice(1).join(' - ') : headline));
  if (/s[eê]nior|\bsr\b/i.test(filter.jobDescription || '') && /\bj[uú]nior\b|\bjr\b|\btrainee\b|\bestagi[aá]ri/i.test(currentTitle)) failed.push('senioridade atual declarada incompatível com a vaga sênior');
  const experience = experienceEvidence(text, core);
  // The score describes evidence, not a hiring approval. Years, travel and exclusive availability need validation.
  if (/\b\d+\s*(?:\+\s*)?anos\b/i.test(filter.jobDescription || '')) pending.push(`confirmar experiência total e no módulo separadamente; ${experience.months} meses evidenciados no módulo por datas sem sobreposição (cronologia pode estar incompleta)`);
  if (/viagens|exclusiv|presencial|h[ií]brid/i.test(filter.jobDescription || '')) pending.push('confirmar viagens, regime presencial e disponibilidade exigidos pela vaga');
  if (publicSummary) pending.push('resumo público: obter CV completo antes de validar aderência');
  if (!publicSummary && score < Number(filter.matchPercent || 0)) pending.push(`evidência ${score}% abaixo do mínimo ${filter.matchPercent}%; revisar lacunas no currículo`);
  const classification = failed.length ? 'rejected' : pending.length ? 'review' : 'approved';
  const explanation = [...failed, ...pending].join('; ');
  return {
    score, classification, accepted: classification === 'approved', review: classification === 'review',
    technicalScore: technical.score,
    triageGroup: failed.length ? 'não aderente' : technicalMet && !mandatory.missing.length && !publicSummary ? 'prioridade de entrevista' : 'validação documental pendente',
    evidence: technical.required.map(term => ({ requirement: term, found: technical.hits.includes(term), kind: trainingOnly(text, term) ? 'somente formação; atuação não comprovada' : technical.hits.includes(term) ? 'menção no currículo; validar escopo' : 'não evidenciado', excerpt: evidenceExcerpt(text, term) })),
    experience,
    scoreType: publicSummary ? 'evidência pública parcial' : 'evidência do currículo',
    matchedMandatorySkills: mandatory.hits, missingMandatorySkills: mandatory.missing,
    jobDescriptionHits: technical.hits, jobDescriptionMissing: technical.missing,
    missingListFilters: failed.filter(s => s.includes('filtro obrigatorio')), pendingChecks: pending,
    reason: explanation,
    observation: `${classification === 'approved' ? 'Compatível com os critérios documentados' : classification === 'review' ? 'A confirmar' : 'Não compatível com os critérios documentados'}. Evidência: ${score}%. ${explanation}. Técnicos: ${technical.hits.join(', ') || 'não evidentes'}. Diferenciais: ${desirable.hits.join(', ') || 'não evidentes'}.`,
    mandatory: { ...mandatory, accepted: !mandatory.missing.length }, job: technical,
    publicSignals: technical.hits, publicGaps: pending
  };
}
export function screeningStats(rows, found = rows.length) {
  return { found, evaluated: rows.length, compatible: rows.filter(r => r.classification === 'approved').length, pending: rows.filter(r => r.classification === 'review').length, rejected: rows.filter(r => r.classification === 'rejected').length };
}
