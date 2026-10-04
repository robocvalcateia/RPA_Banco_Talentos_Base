// Curated market evidence, checked on the client date. No claim of live research per email.
export const SENIORITY_REFERENCE_DATE = '2026-10-01';
export const SENIORITY_SOURCES = [
  { title: 'Indra Group — Consultor FI Senior (Brasil)', url: 'https://careers.indragroup.com/job/Brazil-Consultor-FI-Senior-BA/1369814255/', market: 'Brasil', summary: 'Anúncio sênior com 4–5 anos em FI e suporte funcional; inclui especificações, testes, homologação e fechamento financeiro.' },
  { title: 'Capgemini — SAP FI/CO Senior Consultant', url: 'https://careers.capgemini.com/job/Madrid-SAP-FICO-Senior-Consultant/1413691433/', market: 'Espanha — referência complementar', summary: 'Exige 5–10 anos em FI/CO e participação em três implementações completas; engloba análise funcional, configuração e interação com Finanças.' },
  { title: 'NTT DATA — SAP FI Senior Consultant', url: 'https://it.nttdata.com/jobs/a1jka000000ucmy2a0-sap-fi-senior-consultant', market: 'Itália — referência complementar', summary: 'Exige pelo menos cinco anos em FI, com GL/AP/AR/AA, desenho funcional, testes e projetos de implementação.' }
];
const plain = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function senioritySuggestion(fields) {
  const years = Number(fields.minimumYears || 0);
  const fi = /sap\s*fi|fico/i.test(fields.coreSkill + ' ' + fields.profile);
  const text = plain(fields.requirements);
  const scope = [/implement|implant/, /especifica|functional specification/, /configura|parametriza/, /homologa|key.?users|\buat\b/, /causa raiz|root cause/].filter(re => re.test(text)).length;
  const applicable = fi && years >= 4 && scope >= 2;
  return {
    suggested: applicable ? 'Sênior' : '', referenceDate: SENIORITY_REFERENCE_DATE,
    origin: applicable ? 'market' : 'pending', confidence: applicable ? 'Moderada — sugestão, não regra universal' : 'Referência insuficiente',
    rationale: applicable
      ? `${years} anos exigidos em ${fields.coreSkill || 'SAP FI'}, combinados ao escopo de implementação e responsabilidades funcionais. A comparação com anúncios oficiais favorece Sênior. O nível varia entre empresas; valide e ajuste se necessário.`
      : 'Não há referência pesquisada suficiente para classificar este perfil e escopo. A sugestão automática pesquisada nesta versão cobre SAP FI/FICO com pelo menos quatro anos e responsabilidades funcionais comparáveis. Informe o nível ou amplie a pesquisa.',
    sources: fi ? SENIORITY_SOURCES : []
  };
}
export function applySeniority(fields, previous = null, previousFields = null, explicit = false) {
  const assessment = senioritySuggestion(fields);
  const canSuggest = !fields.seniority || (previous?.origin === 'market' && fields.seniority === previousFields?.seniority);
  if (canSuggest) fields.seniority = assessment.suggested;
  else assessment.origin = explicit ? 'email' : previous?.origin === 'email' && fields.seniority === previousFields?.seniority ? 'email' : 'manual';
  assessment.selected = fields.seniority;
  return assessment;
}
