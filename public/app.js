const state = {
  clients: [],
  contactClients: [],
  opportunities: [],
  faturamento: [],
  cvFilters: [],
  selectedCandidates: [],
  curriculums: [],
  curriculumObservations: [],
  curriculumTemplates: [],
  candidates: [],
  allocateds: [],
  rateCards: [],
  candidatePool: [],
  users: [],
  currentUser: null,
  talentSource: 'local_json',
  talentStats: {},
  talentError: '',
  emailProcessing: null,
  stages: [],
  aderenciaOptions: [0, 25, 50, 75, 100],
  opportunityModels: ['Alocação', 'Hunting', 'Projeto', 'Consultoria'],
  opportunityStatuses: [],
  brazilUfs: [],
  opportunityFilter: { type: '', value: '', status: '', closingMonth: '' },
  faturamentoFilter: { monthYear: '' },
  faturamentoChartOffset: 0,
  dashboardMonth: '',
  dashboardModel: '',
  dashboardAnalyticsCsvUrl: '',
  selectedCandidateFilter: { type: '', value: '' },
  whatsappQueue: [],
  allocatedFilter: { type: '', value: '', status: '' },
  selectedAllocatedIds: new Set(),
  huntingFilter: { type: '', value: '' },
  rateCardFilter: { clientId: '' },
  candidatePoolFilter: { clientId: '' },
  candidatePoolProfiles: ['Técnico', 'Funcional'],
  candidatePoolSkillFields: [],
  curriculumSearch: { name: '', skills: '', hasSearched: false },
  selectedCurriculumId: '',
  curriculumEditing: false,
  curriculumActiveTab: 'list',
  editing: {
    clientId: '',
    contactClientId: '',
    faturamentoId: '',
    opportunityId: '',
    cvFilterId: '',
    candidateId: '',
    allocatedId: '',
    rateCardId: '',
    candidatePoolId: '',
    huntingId: '',
    userId: '',
    selectingCandidateId: '',
    movingCandidateId: '',
    observingCurriculumId: ''
  },
  indicators: null
};

const FATURAMENTO_DASHBOARD_CHART_SERIES = [
  { key: 'forecast', label: 'Previsto', color: '#ed7d31' },
  { key: 'realized', label: 'Realizado', color: '#70ad47' }
];
function setCvSearchInlineStatus(message, statusClass = '') {
  const element = $('#cvSearchInlineStatus');
  if (!element) return;

  element.textContent = message;
  element.className = `search-inline-status full ${statusClass}`.trim();
}
function readStorage(key) {
  try {
    if (!globalThis.localStorage) return '';
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStorage(key, value) {
  try {
    if (globalThis.localStorage) {
      localStorage.setItem(key, value);
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function removeStorage(key) {
  try {
    if (globalThis.localStorage) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function readStoredUser() {
  const rawUser = readStorage('talentos_user');
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    removeStorage('talentos_user');
    removeStorage('talentos_token');
    return null;
  }
}

const session = {
  token: readStorage('talentos_token'),
  user: readStoredUser()
};

function passwordResetTokenFromUrl() {
  return new URLSearchParams(window.location.search).get('reset') || '';
}

const viewTitles = {
  dashboard: 'Dashboard',
  clients: 'Clientes',
  faturamento: 'Contratos/Faturamento',
  opportunities: 'Deals/Oportunidades',
  candidatePool: 'Deals/Bolsão de Candidatos',
  huntings: 'Contratos/Huntings',
  rateCards: 'Contratos/Rate Cards',
  cvFilters: 'Deals/Filtro de CVs',
  selectedCandidates: 'Deals/Candidatos Selecionados',
  curriculums: 'Banco de Talentos',
  candidates: 'Deals/Candidatos Entrevistados',
  allocateds: 'Contratos/Alocados',
  users: 'Usuários',
};

const defaultCandidatePoolSkillFields = [
  ['protheusFinanceiro', 'Protheus Financeiro'],
  ['protheusFiscal', 'Protheus Fiscal'],
  ['protheusContabil', 'Protheus Contábil'],
  ['protheusCompras', 'Protheus Compras'],
  ['protheusEstoque', 'Protheus Estoque'],
  ['protheusFaturamento', 'Protheus Faturamento'],
  ['protheusPcp', 'Protheus PCP'],
  ['protheusRh', 'Protheus RH'],
  ['rmFolha', 'RM Folha'],
  ['rmPonto', 'RM Ponto'],
  ['rmContabil', 'RM Contábil'],
  ['rmFiscal', 'RM Fiscal'],
  ['rmFinanceiro', 'RM Financeiro'],
  ['rmEducacional', 'RM Educacional'],
  ['datasulManufatura', 'Datasul Manufatura'],
  ['datasulPcp', 'Datasul PCP'],
  ['datasulWms', 'Datasul WMS'],
  ['datasulCq', 'Datasul CQ'],
  ['fluigBpm', 'Fluig BPM'],
  ['fluigEcm', 'Fluig ECM'],
  ['fluigFormularios', 'Fluig Formulários'],
  ['fluigIntegracoes', 'Fluig Integrações'],
  ['tecnicoAdvpl', 'Técnico ADVPL'],
  ['scrumMaster', 'Scrum Master']
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const fallbackCitiesByUf = {
  AC: ['Rio Branco'],
  AL: ['Maceió'],
  AP: ['Macapá'],
  AM: ['Manaus'],
  BA: ['Salvador', 'Feira de Santana'],
  CE: ['Fortaleza'],
  DF: ['Brasília'],
  ES: ['Vitória', 'Vila Velha'],
  GO: ['Goiânia', 'Aparecida de Goiânia'],
  MA: ['São Luís'],
  MT: ['Cuiabá'],
  MS: ['Campo Grande'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Contagem'],
  PA: ['Belém'],
  PB: ['João Pessoa'],
  PR: ['Curitiba', 'Londrina'],
  PE: ['Recife'],
  PI: ['Teresina'],
  RJ: ['Rio de Janeiro', 'Niterói'],
  RN: ['Natal'],
  RS: ['Porto Alegre', 'Caxias do Sul'],
  RO: ['Porto Velho'],
  RR: ['Boa Vista'],
  SC: ['Florianópolis', 'Joinville'],
  SP: ['São Paulo', 'Campinas', 'Santos', 'Barueri'],
  SE: ['Aracaju'],
  TO: ['Palmas']
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers ?? {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      showLogin();
    }
    if (response.status === 403 && payload.error?.includes('senha')) {
      showPasswordChange();
    }
    throw new Error(payload.error || 'Não foi possível concluir a ação.');
  }
  return payload;
}


async function apiDownload(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers ?? {})
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Não foi possível baixar o arquivo.');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || 'curriculo.docx';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  window.setTimeout(() => element.classList.remove('visible'), 2800);
}

function setAuthMessage(selector, message = '') {
  const element = $(selector);
  if (element) {
    element.textContent = message;
  }
}

function formPayload(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function refresh() {
  const payload = await api('/api/bootstrap');
  Object.assign(state, payload);
  state.currentUser = payload.currentUser ?? state.currentUser;
  render();
  showApp();
}

function upsertStateItem(collectionName, item) {
  const collection = state[collectionName];
  if (!Array.isArray(collection) || !item?.id) return;

  const currentIndex = collection.findIndex((current) => current.id === item.id);
  if (currentIndex >= 0) {
    collection[currentIndex] = item;
  } else {
    collection.push(item);
  }
}

function removeStateItem(collectionName, itemId) {
  const collection = state[collectionName];
  if (!Array.isArray(collection) || !itemId) return;

  state[collectionName] = collection.filter((item) => item.id !== itemId);
}

function setSession(token, user) {
  session.token = token;
  session.user = user;
  writeStorage('talentos_token', token);
  writeStorage('talentos_user', JSON.stringify(user));
}

function updateSessionUser(user) {
  session.user = user;
  writeStorage('talentos_user', JSON.stringify(user));
}

function clearSession() {
  session.token = '';
  session.user = null;
  removeStorage('talentos_token');
  removeStorage('talentos_user');
}

function showLogin() {
  document.body.classList.add('auth-locked');
  $('#authScreen').classList.remove('hidden');
  $('#passwordRecoverScreen')?.classList.add('hidden');
  $('#passwordChangeScreen').classList.add('hidden');
  $('#passwordResetScreen')?.classList.add('hidden');
}

function showPasswordChange() {
  document.body.classList.add('auth-locked');
  $('#authScreen').classList.add('hidden');
  $('#passwordRecoverScreen')?.classList.add('hidden');
  $('#passwordChangeScreen').classList.remove('hidden');
  $('#passwordResetScreen')?.classList.add('hidden');
}

function showPasswordRecover() {
  document.body.classList.add('auth-locked');
  $('#authScreen').classList.add('hidden');
  $('#passwordRecoverScreen')?.classList.remove('hidden');
  $('#passwordChangeScreen').classList.add('hidden');
  $('#passwordResetScreen')?.classList.add('hidden');
}

function showPasswordReset() {
  document.body.classList.add('auth-locked');
  $('#authScreen').classList.add('hidden');
  $('#passwordRecoverScreen')?.classList.add('hidden');
  $('#passwordChangeScreen').classList.add('hidden');
  $('#passwordResetScreen')?.classList.remove('hidden');
}

function showApp() {
  document.body.classList.remove('auth-locked');
  $('#authScreen').classList.add('hidden');
  $('#passwordRecoverScreen')?.classList.add('hidden');
  $('#passwordChangeScreen').classList.add('hidden');
  $('#passwordResetScreen')?.classList.add('hidden');
  $('#currentUserLabel').textContent = `${state.currentUser?.name ?? session.user?.name ?? 'Usuário'} · ${state.currentUser?.role ?? session.user?.role ?? 'Admin'}`;
}

function opportunityLabel(opportunity) {
  return [opportunity.opportunityCode, opportunity.opportunity].filter(Boolean).join(' - ');
}

function byOpportunityCode(first, second) {
  return String(first.opportunityCode || first.opportunity).localeCompare(String(second.opportunityCode || second.opportunity), 'pt-BR', {
    numeric: true,
    sensitivity: 'base'
  });
}

function curriculumLabel(curriculum) {
  return [curriculum.id_controle, curriculum.nome].filter(Boolean).join(' - ');
}

function byCurriculumControl(first, second) {
  return String(first.id_controle || first.nome).localeCompare(String(second.id_controle || second.nome), 'pt-BR', {
    numeric: true,
    sensitivity: 'base'
  });
}


function normalizeSearchValue(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function splitSearchTerms(value) {
  return normalizeSearchValue(value)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function splitRawSearchTerms(value) {
  return String(value ?? '')
    .split(/[\s,;|/]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function searchableTextFromValue(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => searchableTextFromValue(item, seen)).filter(Boolean).join(' ');
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '';
    seen.add(value);

    return Object.entries(value)
      .filter(([key]) => key !== '_id')
      .map(([, item]) => searchableTextFromValue(item, seen))
      .filter(Boolean)
      .join(' ');
  }

  return String(value);
}

function curriculumFullText(curriculum) {
  return searchableTextFromValue(curriculum);
}

function matchesEveryTerm(text, rawQuery) {
  const terms = splitSearchTerms(rawQuery);
  if (!terms.length) return true;
  const normalizedText = normalizeSearchValue(text);
  return terms.every((term) => normalizedText.includes(term));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSearchTerms(value, query) {
  const text = String(value ?? '');
  const terms = [...new Set(splitRawSearchTerms(query))]
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (!text || !terms.length) return escapeHtml(text);

  const expression = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  let output = '';
  let lastIndex = 0;
  for (const match of text.matchAll(expression)) {
    output += escapeHtml(text.slice(lastIndex, match.index));
    output += `<mark class="search-highlight">${escapeHtml(match[0])}</mark>`;
    lastIndex = match.index + match[0].length;
  }
  output += escapeHtml(text.slice(lastIndex));
  return output;
}

function formatCurriculumDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString('pt-BR');
}

function renderOptions() {
  const emptyOption = '<option value="">Selecione</option>';
  const clientOptions = emptyOption + state.clients.map((client) => `<option value="${client.id}">${client.customerName}</option>`).join('');
  const opportunityOptions = emptyOption + state.opportunities
    .sort(byOpportunityCode)
    .map((opportunity) => `<option value="${opportunity.id}">${opportunityLabel(opportunity)}</option>`)
    .join('');
  const statusOptions = emptyOption + state.opportunityStatuses.map((status) => `<option>${status}</option>`).join('');
  const modelOptions = emptyOption + state.opportunityModels.map((model) => `<option>${model}</option>`).join('');
  const stageOptions = emptyOption + state.stages.map((stage) => `<option>${stage}</option>`).join('');
  const aderenciaOptions = emptyOption + state.aderenciaOptions.map((value) => `<option value="${value}">${value}</option>`).join('');
  const userOptions = emptyOption + state.users
    .slice()
    .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR', { sensitivity: 'base' }))
    .map((user) => `<option value="${escapeHtml(user.name)}">${escapeHtml(user.name)}</option>`)
    .join('');
  const ufOptions = emptyOption + (state.brazilUfs?.length ? state.brazilUfs : Object.keys(fallbackCitiesByUf)).map((uf) => `<option value="${uf}">${uf}</option>`).join('');
  const curriculumOptions = emptyOption + state.curriculums
    .slice()
    .sort(byCurriculumControl)
    .map((curriculum) => `<option value="${curriculum.id}">${curriculumLabel(curriculum)}</option>`)
    .join('');
  const curriculumNameOptions = state.curriculums
    .slice()
    .sort((first, second) => String(first.nome || '').localeCompare(String(second.nome || ''), 'pt-BR', { sensitivity: 'base' }))
    .map((curriculum) => `<option value="${escapeHtml(curriculum.nome || '')}"></option>`)
    .join('');

  $$('select[name="clientId"]').forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = clientOptions;
    if (currentValue && [...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
  });
  $$('select[name="opportunityId"]').forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = opportunityOptions;
    if (currentValue && [...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
  });
  $$('select[name="curriculumId"]').forEach((select) => {
    select.innerHTML = curriculumOptions;
  });
  const candidatePoolNameOptions = $('#candidatePoolNameOptions');
  if (candidatePoolNameOptions) {
    candidatePoolNameOptions.innerHTML = curriculumNameOptions;
  }
  $$('select[name="status"]').forEach((select) => {
    select.innerHTML = statusOptions;
  });
  $$('select[name="model"]').forEach((select) => {
    select.innerHTML = modelOptions;
  });
  $$('select[name="owner"]').forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = userOptions;
    if (currentValue && [...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
  });
  $$('select[name="stage"]').forEach((select) => {
    select.innerHTML = stageOptions;
  });
  $$('select[name="aderencia"]').forEach((select) => {
    select.innerHTML = aderenciaOptions;
  });
  $$('select[name="state"]').forEach((select) => {
    select.innerHTML = ufOptions;
  });

  updateOpportunityContactOptions();
}

function contactClientLabel(contact) {
  return [contact.name, contact.area, contact.role].filter(Boolean).join(' - ') || contact.id;
}

function updateOpportunityContactOptions(selectedValue = $('#opportunityForm select[name="contactClientId"]')?.value || '') {
  const form = $('#opportunityForm');
  const contactSelect = form?.elements.contactClientId;
  if (!contactSelect) return;

  const clientId = form.elements.clientId?.value || '';
  const contacts = state.contactClients
    .filter((contact) => contact.clientId === clientId)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR', { sensitivity: 'base' }));
  const options = contacts.map((contact) => `<option value="${contact.id}">${escapeHtml(contactClientLabel(contact))}</option>`).join('');
  contactSelect.innerHTML = `<option value="">${clientId ? 'Selecione' : 'Selecione um cliente'}</option>${options}`;
  contactSelect.disabled = !clientId || !contacts.length;
  contactSelect.value = contacts.some((contact) => contact.id === selectedValue) ? selectedValue : '';
}

function monthKeyFromValue(value) {
  return String(value || '').trim().slice(0, 7);
}

function getWonOpportunityMonth(opportunity) {
  return monthKeyFromValue(opportunity.closingDate || opportunity.monthYear);
}

function matchesDashboardModel(opportunity) {
  return !state.dashboardModel || opportunity.model === state.dashboardModel;
}

function getDashboardMonthOptions() {
  const months = new Set();
  state.opportunities
    .filter((opportunity) => opportunity.status === 'WON' && matchesDashboardModel(opportunity))
    .forEach((opportunity) => {
      const month = getWonOpportunityMonth(opportunity);
      if (month) months.add(month);
    });

  return [...months].sort().reverse();
}

function getDashboardModelOptions() {
  const models = new Set(state.opportunityModels);
  state.opportunities
    .filter((opportunity) => opportunity.status === 'WON' && opportunity.model)
    .forEach((opportunity) => models.add(opportunity.model));

  return [...models].filter(Boolean).sort();
}

function ensureDashboardMonth() {
  const months = getDashboardMonthOptions();
  if (!months.length && state.dashboardMonth) {
    state.dashboardMonth = '';
    return months;
  }
  if (state.dashboardMonth && !months.includes(state.dashboardMonth)) {
    state.dashboardMonth = '';
  }
  return months;
}

function getSelectedWonOpportunities() {
  return state.opportunities.filter((opportunity) => (
    opportunity.status === 'WON'
    && (!state.dashboardMonth || getWonOpportunityMonth(opportunity) === state.dashboardMonth)
    && matchesDashboardModel(opportunity)
  ));
}

function isDashboardOpenOpportunity(opportunity) {
  return Boolean(opportunity) && !['Closed', 'LOST', 'WON'].includes(opportunity.status);
}

function getDashboardOpenCandidates() {
  return state.candidates
    .filter((candidate) => isDashboardOpenOpportunity(opportunityById(candidate.opportunityId)))
    .sort((first, second) => String(first.name).localeCompare(String(second.name), 'pt-BR', { sensitivity: 'base' }));
}

function getDashboardCandidatesByStage() {
  const values = Object.fromEntries(state.stages.map((stage) => [stage, 0]));
  for (const candidate of getDashboardOpenCandidates()) {
    values[candidate.stage] = (values[candidate.stage] ?? 0) + 1;
  }
  return values;
}

function getDashboardOpportunitiesByStatus() {
  const values = Object.fromEntries(state.opportunityStatuses.map((status) => [status, 0]));
  for (const opportunity of getDashboardStatusOpportunities()) {
    values[opportunity.status] = (values[opportunity.status] ?? 0) + 1;
  }
  return values;
}

function matchesDashboardStatusFilters(opportunity) {
  if (!matchesDashboardModel(opportunity)) return false;

  if (opportunity.status === 'WON') {
    return !state.dashboardMonth || getWonOpportunityMonth(opportunity) === state.dashboardMonth;
  }

  if (['LOST', 'Closed'].includes(opportunity.status)) {
    const month = monthKeyFromValue(opportunity.closingDate || opportunity.monthYear);
    return !state.dashboardMonth || month === state.dashboardMonth;
  }

  return isDashboardOpenOpportunity(opportunity);
}

function getDashboardStatusOpportunities() {
  return state.opportunities
    .filter(matchesDashboardStatusFilters)
    .sort(byOpportunityCode);
}

function calculateWonContractValue(opportunities) {
  return opportunities.reduce((sum, opportunity) => {
    return sum + Number(opportunity.closedQuantity ?? 0) * Number(opportunity.contractValue ?? 0);
  }, 0);
}

function clientNameById(clientId) {
  return state.clients.find((client) => client.id === clientId)?.customerName || 'Cliente nao encontrado';
}

function opportunityById(opportunityId) {
  return state.opportunities.find((opportunity) => opportunity.id === opportunityId);
}

function formatDateBR(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function opportunityAnalyticsRow(opportunity, includeClosedValue = false) {
  const closedValue = Number(opportunity.closedQuantity ?? 0) * Number(opportunity.contractValue ?? 0);
  const row = {
    __meta: { type: 'opportunity', id: opportunity.id },
    'Código': opportunity.opportunityCode || '',
    'Oportunidade': opportunity.opportunity || '',
    'Cliente': clientNameById(opportunity.clientId),
    'Status': opportunity.status || '',
    'Modelo': opportunity.model || '',
    'Responsável': opportunity.owner || '',
    'Abertura': formatDateBR(opportunity.openingDate),
    'Fechamento': formatDateBR(opportunity.closingDate),
    'Qtde vagas': opportunity.quantity ?? 0,
    'Qtde fechada': opportunity.closedQuantity ?? 0,
    'Valor contrato': formatCurrency(opportunity.contractValue)
  };

  if (includeClosedValue) {
    row['Valor fechado'] = formatCurrency(closedValue);
  }

  return row;
}

function candidateAnalyticsRow(candidate) {
  const opportunity = opportunityById(candidate.opportunityId);
  return {
    __meta: { type: 'candidate', id: candidate.id },
    'Candidato': candidate.name || '',
    'Oportunidade': opportunity?.opportunity || candidate.opportunityName || '',
    'Código oportunidade': opportunity?.opportunityCode || candidate.opportunityCode || '',
    'Cliente': opportunity ? clientNameById(opportunity.clientId) : '',
    'Etapa': candidate.stage || '',
    'Status': candidate.status || '',
    'Aderência': `${candidate.aderencia ?? 0}%`,
    'Aprovado': candidate.approved ? 'Sim' : 'Não',
    'Valor hora': formatCurrency(candidate.hourlyRate),
    'Criado em': formatDateBR(candidate.createdAt),
    'Observação': candidate.observation || ''
  };
}

function clientAnalyticsRow(client) {
  const clientOpportunities = state.opportunities.filter((opportunity) => opportunity.clientId === client.id);
  const clientAllocateds = state.allocateds.filter((allocated) => allocated.clientId === client.id && allocated.active === true);

  return {
    __meta: { type: 'client', id: client.id },
    'Cliente': client.customerName || '',
    'Contato principal': client.primaryContactName || '',
    'E-mail': client.primaryContactEmail || '',
    'Telefone': client.primaryContactPhone || '',
    'Oportunidades': clientOpportunities.length,
    'Oportunidades abertas': clientOpportunities.filter((opportunity) => opportunity.status === 'Open').length,
    'Alocados ativos': clientAllocateds.length,
    'Observação': client.observation || ''
  };
}

function buildDashboardAnalytics(metricId) {
  const wonOpportunities = getSelectedWonOpportunities().slice().sort(byOpportunityCode);
  const activeOpportunities = state.opportunities
    .filter(isDashboardOpenOpportunity)
    .sort(byOpportunityCode);
  const statusOpportunities = getDashboardStatusOpportunities();
  const openOpportunities = state.opportunities
    .filter((opportunity) => opportunity.status === 'Open')
    .sort(byOpportunityCode);
  const openCandidates = getDashboardOpenCandidates();
  const selectedMonthLabel = state.dashboardMonth ? formatMonthLabel(state.dashboardMonth) : 'todos os meses/anos';
  const selectedModelLabel = state.dashboardModel || 'todos os modelos';

  if (metricId?.startsWith('candidateStage:')) {
    const stage = metricId.slice('candidateStage:'.length);
    const rows = openCandidates
      .filter((candidate) => candidate.stage === stage)
      .map(candidateAnalyticsRow);
    return {
      title: `Candidatos em ${stage}`,
      summary: `${rows.length} candidato(s) em vagas em aberto nesta etapa.`,
      rows,
      filename: `dashboard-candidatos-${stage}`
    };
  }

  if (metricId?.startsWith('opportunityStatus:')) {
    const status = metricId.slice('opportunityStatus:'.length);
    const rows = statusOpportunities
      .filter((opportunity) => opportunity.status === status)
      .sort(byOpportunityCode)
      .map((opportunity) => opportunityAnalyticsRow(opportunity, status === 'WON'));
    return {
      title: `Oportunidades ${status}`,
      summary: `${rows.length} oportunidade(s) com status ${status} no filtro do dashboard.`,
      rows,
      filename: `dashboard-oportunidades-${status}`
    };
  }

  const configs = {
    won: {
      title: `WON em ${selectedMonthLabel} (${selectedModelLabel})`,
      summary: `${wonOpportunities.length} oportunidade(s) WON no filtro selecionado.`,
      rows: wonOpportunities.map((opportunity) => opportunityAnalyticsRow(opportunity, true)),
      filename: `dashboard-won-${state.dashboardMonth || 'sem-periodo'}`
    },
    wonValue: {
      title: `Valor fechado em ${selectedMonthLabel} (${selectedModelLabel})`,
      summary: `Total fechado: ${formatCurrency(calculateWonContractValue(wonOpportunities))}.`,
      rows: wonOpportunities.map((opportunity) => opportunityAnalyticsRow(opportunity, true)),
      filename: `dashboard-valor-fechado-${state.dashboardMonth || 'sem-periodo'}`
    },
    activeValue: {
      title: 'Oportunidades em aberto',
      summary: `Valor total em aberto: ${formatCurrency(activeOpportunities.reduce((sum, opportunity) => sum + Number(opportunity.contractValue ?? 0), 0))}.`,
      rows: activeOpportunities.map((opportunity) => opportunityAnalyticsRow(opportunity, false)),
      filename: 'dashboard-oportunidades-em-aberto'
    },
    openOpportunities: {
      title: 'Oportunidades abertas',
      summary: `${openOpportunities.length} oportunidade(s) com status Open.`,
      rows: openOpportunities.map((opportunity) => opportunityAnalyticsRow(opportunity, false)),
      filename: 'dashboard-oportunidades-abertas'
    },
    candidates: {
      title: 'Candidatos',
      summary: `${openCandidates.length} candidato(s) relacionado(s) com vagas em aberto.`,
      rows: openCandidates.map(candidateAnalyticsRow),
      filename: 'dashboard-candidatos'
    },
    clients: {
      title: 'Clientes',
      summary: `${state.clients.length} cliente(s) cadastrado(s).`,
      rows: state.clients.slice().sort((first, second) => String(first.customerName).localeCompare(String(second.customerName), 'pt-BR', { sensitivity: 'base' })).map(clientAnalyticsRow),
      filename: 'dashboard-clientes'
    }
  };

  return configs[metricId] || null;
}

function analyticsDisplayColumns(rows) {
  return rows.length ? Object.keys(rows[0]).filter((column) => !column.startsWith('__')) : [];
}

function analyticsHasEditableRows(rows) {
  return rows.some((row) => row.__meta?.type && row.__meta?.id);
}

function renderAnalyticsEditAction(row) {
  const meta = row.__meta || {};
  if (!meta.type || !meta.id) return '-';

  return `
    <button
      class="secondary-action compact-action"
      type="button"
      data-dashboard-analytics-edit="${escapeHtml(meta.type)}"
      data-dashboard-analytics-id="${escapeHtml(meta.id)}"
    >Editar</button>
  `;
}

function renderAnalyticsTable(rows) {
  if (!rows.length) {
    return '<p class="empty-state">Nenhum registro encontrado para este indicador.</p>';
  }

  const columns = analyticsDisplayColumns(rows);
  const hasActions = analyticsHasEditableRows(rows);
  return `
    <div class="dashboard-analytics-toolbar">
      <label>
        Filtrar em todos os campos
        <input
          type="search"
          id="dashboardAnalyticsGlobalFilter"
          class="dashboard-analytics-global-filter"
          placeholder="Digite para filtrar a tabela"
        >
      </label>
      <button class="secondary-action compact-action" type="button" data-clear-dashboard-analytics-filters>Limpar filtros</button>
      <button class="primary-action compact-action" type="button" data-apply-dashboard-analytics-filters>Aplicar filtros</button>
      <span id="dashboardAnalyticsFilterCount">${rows.length} registro(s)</span>
    </div>
    <div class="table-wrap dashboard-analytics-table-wrap">
      <table class="dashboard-analytics-table">
        <thead>
          <tr>
            ${hasActions ? '<th>Ações</th>' : ''}
            ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}
          </tr>
          <tr class="dashboard-analytics-filter-row">
            ${hasActions ? '<th></th>' : ''}
            ${columns.map((column) => `
              <th>
                <input
                  type="search"
                  class="dashboard-analytics-filter"
                  data-dashboard-analytics-filter="${escapeHtml(column)}"
                  placeholder="Filtrar ${escapeHtml(column)}"
                  aria-label="Filtrar ${escapeHtml(column)}"
                >
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr data-dashboard-analytics-row>
              ${hasActions ? `<td>${renderAnalyticsEditAction(row)}</td>` : ''}
              ${columns.map((column) => `<td data-dashboard-analytics-column="${escapeHtml(column)}">${escapeHtml(row[column] ?? '')}</td>`).join('')}
            </tr>
          `).join('')}
          <tr class="dashboard-analytics-empty-row hidden">
            <td colspan="${columns.length + (hasActions ? 1 : 0)}">Nenhum registro encontrado para os filtros informados.</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function buildDashboardAnalyticsCsv(analytics) {
  const rows = analytics.rows || [];
  const columns = rows.length ? analyticsDisplayColumns(rows) : ['Mensagem'];
  const bodyRows = rows.length ? rows : [{ Mensagem: 'Nenhum registro encontrado para este indicador.' }];
  return [
    columns.map(csvEscape).join(';'),
    ...bodyRows.map((row) => columns.map((column) => csvEscape(row[column])).join(';'))
  ].join('\r\n');
}

function buildRowsCsv(rows, fallbackMessage = 'Nenhum registro encontrado para este filtro.') {
  const columns = rows.length ? Object.keys(rows[0]) : ['Mensagem'];
  const bodyRows = rows.length ? rows : [{ Mensagem: fallbackMessage }];
  return [
    columns.map(csvEscape).join(';'),
    ...bodyRows.map((row) => columns.map((column) => csvEscape(row[column])).join(';'))
  ].join('\r\n');
}

function downloadCsv(filename, rows) {
  const csv = buildRowsCsv(rows);
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function revokeDashboardAnalyticsCsvUrl(delay = 0) {
  if (!state.dashboardAnalyticsCsvUrl) return;

  const url = state.dashboardAnalyticsCsvUrl;
  state.dashboardAnalyticsCsvUrl = '';
  setTimeout(() => URL.revokeObjectURL(url), delay);
}

function prepareDashboardAnalyticsCsvLink(analytics) {
  const link = $('#dashboardAnalyticsExportButton');
  if (!link) return;

  revokeDashboardAnalyticsCsvUrl();
  const csv = buildDashboardAnalyticsCsv(analytics);
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  state.dashboardAnalyticsCsvUrl = url;
  link.href = url;
  link.download = `${analytics.filename || 'dashboard-analitico'}-${new Date().toISOString().slice(0, 10)}.csv`;
}

function ensureDashboardAnalyticsModal() {
  let modal = $('#dashboardAnalyticsModal');
  if (modal) return modal;

  modal = document.createElement('section');
  modal.id = 'dashboardAnalyticsModal';
  modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'dashboardAnalyticsTitle');
  modal.innerHTML = `
    <div class="modal-card dashboard-analytics-modal-card">
      <div class="modal-heading">
        <div>
          <h2 id="dashboardAnalyticsTitle">Detalhamento analítico</h2>
          <span id="dashboardAnalyticsSummary"></span>
        </div>
        <button class="ghost-action" type="button" data-close-dashboard-analytics aria-label="Fechar">×</button>
      </div>
      <div class="modal-actions">
        <a class="primary-action" href="#" id="dashboardAnalyticsExportButton" download role="button">Gerar CSV</a>
      </div>
      <div id="dashboardAnalyticsContent"></div>
    </div>
  `;
  document.body.appendChild(modal);
  initPanelMaximizeControls();
  return modal;
}

function closeDashboardAnalytics() {
  closeSurfaceDialog('#dashboardAnalyticsModal');
  revokeDashboardAnalyticsCsvUrl(5000);
}

function applyDashboardAnalyticsFilters() {
  const modal = $('#dashboardAnalyticsModal');
  if (!modal || modal.classList.contains('hidden')) return;

  const globalFilter = normalizeText($('#dashboardAnalyticsGlobalFilter', modal)?.value);
  const filters = $$('.dashboard-analytics-filter', modal)
    .map((input) => ({
      column: input.dataset.dashboardAnalyticsFilter,
      value: normalizeText(input.value)
    }))
    .filter((filter) => filter.column && filter.value);
  const rows = $$('[data-dashboard-analytics-row]', modal);
  let visibleRows = 0;

  rows.forEach((row) => {
    const rowText = normalizeText(row.textContent);
    const matchesGlobal = !globalFilter || rowText.includes(globalFilter);
    const matchesColumns = filters.every((filter) => {
      const cell = $$('[data-dashboard-analytics-column]', row)
        .find((item) => item.dataset.dashboardAnalyticsColumn === filter.column);
      return normalizeText(cell?.textContent).includes(filter.value);
    });
    const matches = matchesGlobal && matchesColumns;
    row.classList.toggle('hidden', !matches);
    if (matches) visibleRows += 1;
  });

  $('.dashboard-analytics-empty-row', modal)?.classList.toggle('hidden', visibleRows > 0);
  const countElement = $('#dashboardAnalyticsFilterCount', modal);
  if (countElement) countElement.textContent = `${visibleRows} de ${rows.length} registro(s)`;
}

function clearDashboardAnalyticsFilters() {
  const modal = $('#dashboardAnalyticsModal');
  if (!modal) return;
  $$('.dashboard-analytics-filter, .dashboard-analytics-global-filter', modal)
    .forEach((input) => { input.value = ''; });
  applyDashboardAnalyticsFilters();
}

function editDashboardAnalyticsRecord(type, id) {
  if (!type || !id) return;

  if (type === 'opportunity') {
    const opportunity = state.opportunities.find((item) => item.id === id);
    if (!opportunity) {
      toast('Oportunidade não encontrada para edição.');
      return;
    }
    closeDashboardAnalytics();
    showView('opportunities');
    loadOpportunityForEdit(opportunity);
    return;
  }

  if (type === 'candidate') {
    const candidate = state.candidates.find((item) => item.id === id);
    if (!candidate) {
      toast('Candidato não encontrado para edição.');
      return;
    }
    closeDashboardAnalytics();
    showView('candidates');
    loadCandidateForEdit(candidate);
    return;
  }

  if (type === 'client') {
    const client = state.clients.find((item) => item.id === id);
    if (!client) {
      toast('Cliente não encontrado para edição.');
      return;
    }
    closeDashboardAnalytics();
    showView('clients');
    loadClientForEdit(client);
  }
}

function openDashboardAnalytics(metricId) {
  const analytics = buildDashboardAnalytics(metricId);
  if (!analytics) return;

  const modal = ensureDashboardAnalyticsModal();
  $('#dashboardAnalyticsTitle').textContent = analytics.title;
  $('#dashboardAnalyticsSummary').textContent = analytics.summary;
  $('#dashboardAnalyticsContent').innerHTML = renderAnalyticsTable(analytics.rows);
  const exportButton = $('#dashboardAnalyticsExportButton');
  prepareDashboardAnalyticsCsvLink(analytics);
  modal.classList.remove('hidden');
  applyDashboardAnalyticsFilters();
  exportButton?.focus();
}

function renderDashboardFilters() {
  const monthSelect = $('#dashboardMonthFilter');
  const modelSelect = $('#dashboardModelFilter');
  if (!monthSelect || !modelSelect) return;

  const models = getDashboardModelOptions();
  if (state.dashboardModel && !models.includes(state.dashboardModel)) {
    state.dashboardModel = '';
  }
  modelSelect.innerHTML = [
    '<option value="">Todos os modelos</option>',
    ...models.map((model) => `<option value="${model}">${model}</option>`)
  ].join('');
  modelSelect.value = state.dashboardModel;

  const months = ensureDashboardMonth();
  monthSelect.innerHTML = [
    '<option value="">Todos os meses/anos</option>',
    ...months.map((month) => `<option value="${month}">${formatMonthLabel(month)}</option>`)
  ].join('');
  monthSelect.value = state.dashboardMonth;
  monthSelect.disabled = false;
}

function faturamentoChartRows() {
  const rows = state.faturamento
    .slice()
    .filter((item) => item.monthYear)
    .sort((first, second) => String(first.monthYear).localeCompare(String(second.monthYear)));
  const lastRealizedIndex = rows.reduce((last, item, index) => (
    Number(item.realized || 0) > 0 ? index : last
  ), -1);

  return rows.map((item, index) => ({
    monthYear: item.monthYear,
    forecast: Number(item.forecast || 0),
    realized: index <= lastRealizedIndex ? Number(item.realized || 0) : null
  }));
}

function faturamentoChartWindowSize(total) {
  const width = window.innerWidth || 1280;
  if (width <= 680) return Math.min(total, 5);
  if (width <= 1024) return Math.min(total, 7);
  return Math.min(total, 10);
}

function clampFaturamentoChartOffset(total, windowSize) {
  const maxOffset = Math.max(0, total - windowSize);
  state.faturamentoChartOffset = Math.min(Math.max(0, Number(state.faturamentoChartOffset || 0)), maxOffset);
  return maxOffset;
}

function chartAxisMax(value) {
  const maxValue = Math.max(1, Number(value || 0));
  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalized = maxValue / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

function formatChartAxisValue(value) {
  const number = Number(value || 0);
  if (number >= 1000) return `${Math.round(number / 1000).toLocaleString('pt-BR')}K`;
  return number.toLocaleString('pt-BR');
}

function buildFaturamentoChartPath(rows, key, xForIndex, yForValue) {
  let drawing = false;
  return rows
    .map((row, index) => {
      const value = row[key];
      if (value === null || value === undefined || Number.isNaN(Number(value))) {
        drawing = false;
        return '';
      }
      const point = `${xForIndex(index).toFixed(2)} ${yForValue(Number(value)).toFixed(2)}`;
      const command = drawing ? 'L' : 'M';
      drawing = true;
      return `${command} ${point}`;
    })
    .filter(Boolean)
    .join(' ');
}

function renderFaturamentoChart() {
  const chart = $('#faturamentoDashboardChart');
  const legend = $('#faturamentoDashboardChartLegend');
  const scroll = $('#faturamentoDashboardChartScroll');
  const rangeLabel = $('#faturamentoDashboardChartRange');
  if (!chart || !legend || !scroll || !rangeLabel) return;

  const rows = faturamentoChartRows();
  if (!rows.length) {
    chart.innerHTML = '<div class="empty-state">Nenhum dado de faturamento carregado para montar o grafico.</div>';
    legend.innerHTML = '';
    scroll.disabled = true;
    rangeLabel.textContent = 'Sem dados';
    return;
  }

  const windowSize = faturamentoChartWindowSize(rows.length);
  const maxOffset = clampFaturamentoChartOffset(rows.length, windowSize);
  const visibleRows = rows.slice(state.faturamentoChartOffset, state.faturamentoChartOffset + windowSize);
  const chartValues = visibleRows.flatMap((row) => FATURAMENTO_DASHBOARD_CHART_SERIES
    .map((series) => row[series.key])
    .filter((value) => value !== null && value !== undefined));
  const yMax = chartAxisMax(Math.max(...chartValues, 1));
  const width = 960;
  const height = 360;
  const margin = { top: 26, right: 28, bottom: 52, left: 70 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xForIndex = (index) => margin.left + (visibleRows.length === 1 ? plotWidth / 2 : (index / (visibleRows.length - 1)) * plotWidth);
  const yForValue = (value) => margin.top + plotHeight - (value / yMax) * plotHeight;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(yMax * ratio));

  scroll.max = String(maxOffset);
  scroll.value = String(state.faturamentoChartOffset);
  scroll.disabled = maxOffset === 0;
  rangeLabel.textContent = `${formatMonthLabel(visibleRows[0].monthYear)} ate ${formatMonthLabel(visibleRows[visibleRows.length - 1].monthYear)}`;
  legend.innerHTML = FATURAMENTO_DASHBOARD_CHART_SERIES
    .map((series) => `
      <span class="faturamento-chart-legend-item">
        <i style="background: ${series.color}"></i>${escapeHtml(series.label)}
      </span>
    `)
    .join('');

  const gridLines = yTicks
    .map((tick) => {
      const y = yForValue(tick);
      return `
        <g class="faturamento-chart-gridline">
          <line x1="${margin.left}" x2="${width - margin.right}" y1="${y.toFixed(2)}" y2="${y.toFixed(2)}"></line>
          <text x="${margin.left - 12}" y="${(y + 4).toFixed(2)}">${formatChartAxisValue(tick)}</text>
        </g>
      `;
    })
    .join('');
  const xLabels = visibleRows
    .map((row, index) => `
      <text class="faturamento-chart-x-label" x="${xForIndex(index).toFixed(2)}" y="${height - 18}">${escapeHtml(formatMonthLabel(row.monthYear))}</text>
    `)
    .join('');
  const paths = FATURAMENTO_DASHBOARD_CHART_SERIES
    .map((series) => {
      const path = buildFaturamentoChartPath(visibleRows, series.key, xForIndex, yForValue);
      return path ? `<path class="faturamento-chart-line" d="${path}" stroke="${series.color}"></path>` : '';
    })
    .join('');

  chart.innerHTML = `
    <svg class="faturamento-chart-svg" viewBox="0 0 ${width} ${height}" role="presentation" aria-hidden="true">
      <rect class="faturamento-chart-background" x="0" y="0" width="${width}" height="${height}"></rect>
      ${gridLines}
      <line class="faturamento-chart-axis" x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}"></line>
      ${xLabels}
      ${paths}
    </svg>
  `;
}

function renderMetrics() {
  const totals = state.indicators.totals;
  const wonOpportunities = getSelectedWonOpportunities();
  const wonContractValue = calculateWonContractValue(wonOpportunities);
  const openCandidates = getDashboardOpenCandidates();
  const selectedMonthLabel = state.dashboardMonth ? formatMonthLabel(state.dashboardMonth) : 'todos os meses/anos';
  const selectedModelLabel = state.dashboardModel || 'todos os modelos';
  $('#metrics').innerHTML = [
    ['won', `WON em ${selectedMonthLabel} (${selectedModelLabel})`, wonOpportunities.length],
    ['wonValue', `Valor fechado em ${selectedMonthLabel} (${selectedModelLabel})`, formatCurrencyK(wonContractValue)],
    ['activeValue', 'Oportunidades em aberto', formatCurrencyK(totals.activeContractValue ?? 0)],
    ['openOpportunities', 'Oportunidades abertas', totals.openOpportunities],
    ['candidates', 'Candidatos', openCandidates.length],
    ['clients', 'Clientes', totals.clients]
  ]
    .map(([id, label, value]) => `
      <button class="metric-card metric-card-button" type="button" data-dashboard-analytics="${id}" aria-label="Abrir detalhe de ${escapeHtml(label)}">
        <span>${escapeHtml(label)}</span>
        ${String(value).includes('mini-bars') ? value : `<strong>${value}</strong>`}
        <small>Clique para ver detalhes</small>
      </button>
    `)
    .join('');
}

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function calculateWonContractValueCurrentMonth() {
  const currentMonth = currentMonthKey();
  return calculateWonContractValue(
    state.opportunities.filter((opportunity) => (
      opportunity.status === 'WON' && getWonOpportunityMonth(opportunity) === currentMonth
    ))
  );
}

function renderMiniBars(values) {
  const entries = Object.entries(values);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return `
    <div class="mini-bars">
      ${entries
        .map(([label, value]) => {
          const width = Math.max(4, (value / max) * 100);
          return `
            <div class="mini-bar-row">
              <span>${label}</span>
              <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
              <b>${value}</b>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit'
  }).replace('.', '');
}

function formatCurrencyK(value) {
  const thousands = Math.round(Number(value || 0) / 1000);
  return `R$ ${thousands.toLocaleString('pt-BR')}K`;
}

function renderValueMiniBars(values) {
  const entries = Object.entries(values);
  const max = Math.max(1, ...entries.map(([, value]) => Number(value || 0)));
  return `
    <div class="mini-bars">
      ${entries
        .map(([label, value]) => {
          const numericValue = Number(value || 0);
          const width = Math.max(4, (numericValue / max) * 100);
          return `
            <div class="mini-bar-row value-row">
              <span>${formatMonthLabel(label)}</span>
              <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
              <b>${formatCurrencyK(numericValue)}</b>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderBars(containerId, values, analyticsPrefix = '') {
  const max = Math.max(1, ...Object.values(values));
  $(`#${containerId}`).innerHTML = Object.entries(values)
    .map(([label, value]) => {
      const width = Math.max(4, (value / max) * 100);
      const analyticsId = analyticsPrefix ? `${analyticsPrefix}:${label}` : '';
      const tag = analyticsId ? 'button' : 'div';
      const analyticsAttribute = analyticsId ? ` type="button" data-dashboard-analytics="${escapeHtml(analyticsId)}"` : '';
      return `
        <${tag} class="bar-row ${analyticsId ? 'bar-row-button' : ''}"${analyticsAttribute}>
          <span>${escapeHtml(label)}</span>
          <span class="bar-track"><span class="bar-fill" style="width: ${width}%"></span></span>
          <strong>${value}</strong>
        </${tag}>
      `;
    })
    .join('');
}

function renderAllocatedPie() {
  const values = getAllocatedsByClient();
  const entries = Object.entries(values).filter(([, value]) => Number(value || 0) > 0);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const container = $('#allocatedPie');

  if (!entries.length || !total) {
    container.innerHTML = '<p class="empty-state">Sem alocados cadastrados.</p>';
    return;
  }

  const colors = ['#00b894', '#121212', '#2d9cdb', '#f5a524', '#dc4c64', '#7b61ff', '#20c997', '#6c757d'];

  container.innerHTML = `
    ${renderPieSvg(entries, total, colors)}
    <div class="pie-legend">
      ${entries
        .map(([label, value], index) => `
          <div class="pie-legend-row">
            <span class="legend-dot" style="background: ${colors[index % colors.length]}"></span>
            <strong>${label}</strong>
            <b>${value} (${formatPercent(Number(value || 0), total)})</b>
          </div>
        `)
        .join('')}
    </div>
  `;
}

function getAllocatedsByClient() {
  const serverValues = state.indicators.allocatedsByClient ?? {};
  const serverTotal = Object.values(serverValues).reduce((sum, value) => sum + Number(value || 0), 0);
  if (serverTotal > 0) return serverValues;

  const values = Object.fromEntries(state.clients.map((client) => [client.customerName, 0]));
  state.allocateds
    .filter((allocated) => allocated.active === true)
    .forEach((allocated) => {
      const client = state.clients.find((item) => item.id === allocated.clientId);
      const clientName = client?.customerName || allocated.clientName || 'Sem cliente';
      values[clientName] = (values[clientName] ?? 0) + 1;
    });
  return values;
}

function renderPieSvg(entries, total, colors) {
  let offset = 25;
  const slices = entries
    .map(([, value], index) => {
      const percentage = (Number(value || 0) / total) * 100;
      const circle = `
        <circle
          class="pie-slice"
          cx="20"
          cy="20"
          r="15.915"
          fill="transparent"
          stroke="${colors[index % colors.length]}"
          stroke-width="11"
          stroke-dasharray="${percentage} ${100 - percentage}"
          stroke-dashoffset="${offset}"
        />
      `;
      offset -= percentage;
      return circle;
    })
    .join('');

  return `
    <svg class="pie-chart" viewBox="0 0 40 40" role="img" aria-label="Alocados ativos por cliente">
      <circle cx="20" cy="20" r="15.915" fill="transparent" stroke="#e4eeee" stroke-width="11"></circle>
      ${slices}
    </svg>
  `;
}

function formatPercent(value, total) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function renderAverageTable() {
  $('#averageStageTable').innerHTML = state.stages
    .map((stage) => {
      const average = state.indicators.averageDaysByStage[stage] ?? 0;
      const volume = state.indicators.candidatesByStage[stage] ?? 0;
      return `<tr><td>${stage}</td><td>${average} dia(s)</td><td>${volume}</td></tr>`;
    })
    .join('');
}

function renderClients() {
  $('#clientCount').textContent = state.clients.length;
  $('#clientTable').innerHTML = state.clients
    .map(
      (client) => `
        <tr class="clickable-row" data-edit-client="${client.id}">
          <td><strong>${escapeHtml(client.customerName)}</strong></td>
          <td>${escapeHtml(client.primaryContactName || '-')}</td>
          <td>${escapeHtml(client.primaryContactEmail || '-')}</td>
          <td>${escapeHtml(client.primaryContactPhone || '-')}</td>
          <td>${escapeHtml(client.observation || '-')}</td>
          <td>
            <div class="row-actions">
              <button class="primary-action table-action" type="button" data-contact-client-for="${client.id}">
                Cadastrar contato
              </button>
              <button class="primary-action table-action" type="button" data-consult-contact-client-for="${client.id}">
                Consultar contatos
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');
}

function selectedClientForContacts() {
  return state.clients.find((client) => client.id === state.editing.clientId) || null;
}

function openContactClientModal(contact = null) {
  const client = selectedClientForContacts();
  if (!client) {
    toast('Salve ou selecione um cliente antes de cadastrar contatos.');
    return;
  }

  const modal = $('#contactClientModal');
  const context = $('#contactClientModalContext');
  const title = $('#contactClientModalTitle');
  const form = $('#contactClientForm');
  if (!modal || !form) return;

  if (contact) {
    state.editing.contactClientId = contact.id;
    fillForm('#contactClientForm', {
      clientId: contact.clientId,
      name: contact.name,
      area: contact.area,
      role: contact.role,
      phone: contact.phone,
      email: contact.email
    }, 'Atualizar contato');
    if (title) title.textContent = 'Atualizar contato';
  } else {
    clearEditing(form, 'contactClientId', 'Cadastrar contato');
    form.elements.clientId.value = client.id;
    if (title) title.textContent = 'Cadastrar contato';
  }

  if (context) context.textContent = `Cliente: ${client.customerName}`;
  modal.classList.remove('hidden');
  form.elements.name?.focus();
}

function closeContactClientModal() {
  $('#contactClientModal')?.classList.add('hidden');
}

function renderContactClientListModal() {
  const client = selectedClientForContacts();
  const table = $('#contactClientListModalTable');
  const context = $('#contactClientListModalContext');
  if (!table || !context) return;

  if (!client) {
    context.textContent = 'Cliente não selecionado';
    table.innerHTML = '<tr><td colspan="6">Selecione um cliente para consultar contatos.</td></tr>';
    return;
  }

  const contacts = state.contactClients
    .filter((contact) => contact.clientId === client.id)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR', { sensitivity: 'base' }));

  context.textContent = `Cliente: ${client.customerName} · ${contacts.length} contato(s)`;
  table.innerHTML = contacts.length
    ? contacts.map((contact) => `
      <tr>
        <td><strong>${escapeHtml(contact.name || '-')}</strong></td>
        <td>${escapeHtml(contact.area || '-')}</td>
        <td>${escapeHtml(contact.role || '-')}</td>
        <td>${escapeHtml(contact.phone || '-')}</td>
        <td>${escapeHtml(contact.email || '-')}</td>
        <td>
          <div class="row-actions">
            <button class="primary-action table-action" type="button" data-modal-edit-contact-client="${contact.id}">Alterar</button>
            <button class="ghost-action table-action" type="button" data-modal-delete-contact-client="${contact.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">Nenhum contato cadastrado para este cliente.</td></tr>';
}

function openContactClientListModal(client) {
  if (!client) {
    toast('Cliente não encontrado.');
    return;
  }

  state.editing.clientId = client.id;
  state.editing.contactClientId = '';
  closeContactClientModal();
  renderContactClients();
  renderContactClientListModal();
  $('#contactClientListModal')?.classList.remove('hidden');
}

function closeContactClientListModal() {
  $('#contactClientListModal')?.classList.add('hidden');
}

function renderContactClients() {
  const client = selectedClientForContacts();
  const contacts = client
    ? state.contactClients.filter((contact) => contact.clientId === client.id)
    : [];
  const table = $('#contactClientTable');
  const count = $('#contactClientCount');
  const context = $('#contactClientContext');

  if (!table || !count || !context) return;

  count.textContent = contacts.length;
  context.textContent = client
    ? `Cliente: ${client.customerName}`
    : 'Selecione um cliente para cadastrar contatos';

  if (!client) {
    table.innerHTML = '<tr><td colspan="6">Selecione um cliente para visualizar contatos.</td></tr>';
    return;
  }

  table.innerHTML = contacts.length
    ? contacts.map((contact) => `
      <tr class="clickable-row" data-edit-contact-client="${contact.id}">
        <td><strong>${escapeHtml(contact.name || '-')}</strong></td>
        <td>${escapeHtml(contact.area || '-')}</td>
        <td>${escapeHtml(contact.role || '-')}</td>
        <td>${escapeHtml(contact.phone || '-')}</td>
        <td>${escapeHtml(contact.email || '-')}</td>
        <td><button class="ghost-action" type="button" data-delete-contact-client="${contact.id}" aria-label="Excluir contato">Excluir</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">Nenhum contato cadastrado para este cliente.</td></tr>';
}

function formatFaturamentoMonth(monthYear) {
  return formatMonthLabel(monthYear || '');
}

function getFilteredFaturamento() {
  const monthYear = state.faturamentoFilter.monthYear || $('#faturamentoMonthFilter')?.value || '';
  if (!monthYear) return state.faturamento;
  return state.faturamento.filter((item) => item.monthYear === monthYear);
}

function renderFaturamento() {
  const monthFilter = $('#faturamentoMonthFilter');
  if (monthFilter) {
    monthFilter.value = state.faturamentoFilter.monthYear || '';
  }

  const faturamento = getFilteredFaturamento().slice().sort((first, second) => String(second.monthYear).localeCompare(String(first.monthYear)));
  const countElement = $('#faturamentoCount');
  const table = $('#faturamentoTable');
  if (!countElement || !table) return;

  countElement.textContent = faturamento.length;
  table.innerHTML = faturamento
    .map((item) => `
      <tr class="clickable-row" data-edit-faturamento="${item.id}">
        <td><strong>${formatFaturamentoMonth(item.monthYear)}</strong></td>
        <td>${formatCurrency(item.forecast)}</td>
        <td>${formatCurrency(item.realized)}</td>
        <td>${formatCurrency(item.accumulatedGrowth)}</td>
        <td>${formatCurrency(item.accumulatedRealized)}</td>
      </tr>
    `)
    .join('');
}

function renderOpportunityFilters() {
  const typeSelect = $('#opportunityFilterType');
  const valueInput = $('#opportunityFilterValue');
  const statusSelect = $('#opportunityStatusFilter');
  const closingMonthInput = $('#opportunityClosingMonthFilter');
  if (!typeSelect || !valueInput) return;

  const type = state.opportunityFilter.type || typeSelect.value;
  const selectedStatus = state.opportunityFilter.status || statusSelect?.value || '';

  typeSelect.value = type;
  valueInput.disabled = !type;
  valueInput.placeholder = type ? 'Digite para filtrar' : 'Todos';
  valueInput.value = type ? state.opportunityFilter.value : '';
  state.opportunityFilter.value = valueInput.value;

  if (statusSelect) {
    const statusOptions = [{ value: '', label: 'Todos' }].concat(
      state.opportunityStatuses.map((status) => ({ value: status, label: status }))
    );
    statusSelect.innerHTML = statusOptions.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
    statusSelect.value = statusOptions.some((option) => option.value === selectedStatus) ? selectedStatus : '';
    state.opportunityFilter.status = statusSelect.value;
  }

  if (closingMonthInput) {
    closingMonthInput.value = state.opportunityFilter.closingMonth || closingMonthInput.value || '';
  }
}

function getFilteredOpportunities() {
  const { type, value, status, closingMonth } = state.opportunityFilter;
  const normalizedValue = normalizeText(value);
  let opportunities = state.opportunities;

  if (type === 'client') {
    opportunities = opportunities.filter((opportunity) => {
      if (!normalizedValue) return true;
      const client = state.clients.find((item) => item.id === opportunity.clientId);
      return normalizeText(client?.customerName).includes(normalizedValue);
    });
  }

  if (type === 'opportunity') {
    opportunities = opportunities.filter((opportunity) => {
      if (!normalizedValue) return true;
      return normalizeText(`${opportunity.opportunity || ''} ${opportunity.opportunityCode || ''}`).includes(normalizedValue);
    });
  }

  if (status) {
    opportunities = opportunities.filter((opportunity) => opportunity.status === status);
  }

  if (closingMonth) {
    opportunities = opportunities.filter((opportunity) => String(opportunity.closingDate || '').slice(0, 7) === closingMonth);
  }

  return opportunities;
}

function renderOpportunities() {
  const opportunities = getFilteredOpportunities();
  $('#opportunityCount').textContent = opportunities.length;
  $('#opportunityTable').innerHTML = opportunities
    .map((opportunity) => {
      const client = state.clients.find((item) => item.id === opportunity.clientId);
      const contact = state.contactClients.find((item) => item.id === opportunity.contactClientId);
      return `
        <tr class="clickable-row" data-edit-opportunity="${opportunity.id}">
          <td><strong>${opportunity.opportunity}</strong></td>
          <td>${opportunity.opportunityCode || '-'}</td>
          <td>${client?.customerName || 'Cliente nao encontrado'}</td>
          <td>${contact ? escapeHtml(contactClientLabel(contact)) : '-'}</td>
          <td>${opportunity.status}</td>
          <td>${opportunity.openingDate || '-'}</td>
          <td>${opportunity.closingDate || '-'}</td>
          <td>${opportunity.model || '-'}</td>
          <td>${opportunity.owner || '-'}</td>
          <td>${opportunity.quantity ?? 0}</td>
          <td>${opportunity.closedQuantity ?? 0}</td>
          <td>${formatCurrency(opportunity.contractValue)}</td>
          <td>${opportunity.observation || '-'}</td>
        </tr>
      `;
    })
    .join('');
}

function getHuntingOpportunities() {
  return state.opportunities
    .filter((opportunity) => opportunity.model === 'Hunting')
    .sort(byOpportunityCode);
}

function getHuntingRows() {
  return getHuntingOpportunities().flatMap((opportunity) => {
    const linkedCandidates = state.candidates.filter((candidate) => candidate.opportunityId === opportunity.id);
    if (!linkedCandidates.length) {
      return [{ opportunity, candidate: null }];
    }
    return linkedCandidates.map((candidate) => ({ opportunity, candidate }));
  });
}

function renderHuntingFilters() {
  const typeSelect = $('#huntingFilterType');
  const valueSelect = $('#huntingFilterValue');
  if (!typeSelect || !valueSelect) return;

  const type = state.huntingFilter.type || typeSelect.value;
  const selected = state.huntingFilter.value || valueSelect.value;
  const huntingRows = getHuntingRows();
  let options = [{ value: '', label: 'Todos' }];

  typeSelect.value = type;

  if (type === 'candidate') {
    const candidates = [...new Set(huntingRows.map(({ candidate }) => candidate?.name).filter(Boolean))];
    options = options.concat(
      candidates
        .sort((first, second) => first.localeCompare(second, 'pt-BR', { sensitivity: 'base' }))
        .map((candidate) => ({ value: candidate, label: candidate }))
    );
  }

  if (type === 'client') {
    const clientIds = new Set(huntingRows.map(({ opportunity }) => opportunity.clientId).filter(Boolean));
    options = options.concat(
      state.clients
        .filter((client) => clientIds.has(client.id))
        .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
        .map((client) => ({ value: client.id, label: client.customerName }))
    );
  }

  valueSelect.disabled = !type;
  valueSelect.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  valueSelect.value = options.some((option) => option.value === selected) ? selected : '';
  state.huntingFilter.value = valueSelect.value;
}

function getFilteredHuntingRows() {
  const rows = getHuntingRows();
  const { type, value } = state.huntingFilter;
  if (!type || !value) return rows;

  if (type === 'candidate') {
    return rows.filter(({ candidate }) => candidate?.name === value);
  }

  if (type === 'client') {
    return rows.filter(({ opportunity }) => opportunity.clientId === value);
  }

  return rows;
}

function huntingCsvRows() {
  return getFilteredHuntingRows().map(({ opportunity, candidate }) => {
    const client = state.clients.find((item) => item.id === opportunity.clientId);
    return {
      Candidato: candidate?.name || '-',
      Perfil: opportunity.opportunity || '-',
      'Data de início': opportunity.openingDate || '-',
      Cliente: client?.customerName || '-',
      Salário: formatCurrency(candidate?.hourlyRate ?? 0),
      Faturamento: formatCurrency(opportunity.contractValue ?? 0),
      Taxa: candidate?.huntingTax || '-',
      Fonte: candidate?.source || opportunity.source || '-',
      Status: opportunity.status || '-'
    };
  });
}

function exportHuntingCsv() {
  downloadCsv('huntings', huntingCsvRows());
}

function calculateHuntingTax(candidate, opportunity) {
  const salary = Number(candidate?.hourlyRate ?? 0);
  const revenue = Number(opportunity?.contractValue ?? 0);
  if (!salary || !revenue) return null;
  return revenue - salary;
}

function formatHuntingTax(candidate, opportunity) {
  const importedTax = String(candidate?.huntingTax ?? '').trim();
  if (importedTax) return importedTax;
  const calculatedTax = calculateHuntingTax(candidate, opportunity);
  return calculatedTax === null ? '-' : formatCurrency(calculatedTax);
}

function renderHuntings() {
  const huntings = getFilteredHuntingRows();
  const countElement = $('#huntingCount');
  const table = $('#huntingTable');
  if (!countElement || !table) return;

  countElement.textContent = huntings.length;
  table.innerHTML = huntings
    .map(({ opportunity, candidate }) => {
      const client = state.clients.find((item) => item.id === opportunity.clientId);
      return `
        <tr class="clickable-row" data-edit-hunting="${opportunity.id}" data-edit-hunting-candidate="${candidate?.id || ''}" data-client-id="${opportunity.clientId || ''}">
          <td><strong>${renderBlackflagName(candidate?.name, candidate)}</strong></td>
          <td>${opportunity.opportunity || '-'}</td>
          <td>${opportunity.openingDate || '-'}</td>
          <td>${client?.customerName || 'Cliente sem FK'}</td>
          <td>${candidate ? formatCurrency(candidate.hourlyRate) : '-'}</td>
          <td>${formatCurrency(opportunity.contractValue)}</td>
          <td>${formatHuntingTax(candidate, opportunity)}</td>
          <td>${candidate?.source || '-'}</td>
        </tr>
      `;
    })
    .join('');
}

function shortText(value, maxLength = 90) {
  const text = String(value || '').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function renderCvFilters() {
  $('#cvFilterCount').textContent = state.cvFilters.length;
  $('#cvFilterTable').innerHTML = state.cvFilters
    .map((filter) => {
      const opportunity = state.opportunities.find((item) => item.id === filter.opportunityId);
      return `
        <tr class="clickable-row" data-edit-cv-filter="${filter.id}">
          <td><strong>${filter.opportunityCode || opportunity?.opportunityCode || '-'}</strong><br>${filter.opportunityName || opportunity?.opportunity || '-'}</td>
          <td>${shortText(filter.jobDescription)}</td>
          <td>${shortText(filter.mandatorySkills)}</td>
          <td>${filter.state || '-'}</td>
          <td>${filter.city || '-'}</td>
          <td>${filter.englishLevel || '-'}</td>
          <td>${filter.matchPercent ?? 0}%</td>
          <td>${filter.resultLimit ?? 10}</td>
          <td>${enabledSourceLabels(filter).join(', ') || '-'}</td>
          <td><button class="ghost-action" type="button" data-delete-cv-filter="${filter.id}" aria-label="Excluir filtro">Excluir</button></td>
        </tr>
      `;
    })
    .join('');
}

function enabledSourceLabels(filter) {
  return [
    filter.searchApinfo ? 'APINFO' : '',
    filter.searchLinkedin ? 'LINKEDIN' : '',
    filter.searchAlcateia ? 'ALCATEIA' : ''
  ].filter(Boolean);
}

function selectedCvFilter() {
  return state.cvFilters.find((filter) => filter.id === state.editing.cvFilterId);
}

function candidateLinkHtml(candidate) {
  const curriculum = findCurriculumForCandidate(candidate);
  const curriculumId = String(
    curriculumIdentifier(curriculum)
    || candidate.curriculumId
    || candidate.curriculumControlId
    || ''
  ).trim();
  const externalLink = String(candidate.link || '').trim();

  if (curriculumId) {
    return `<button class="link-action" type="button" data-open-curriculum="${escapeHtml(curriculumId)}">Abrir</button>`;
  }

  if (externalLink) {
    return `<a href="${escapeHtml(externalLink)}" target="_blank" rel="noopener">Abrir</a>`;
  }

  return '-';
}

function findCurriculumForCandidate(candidate) {
  const candidateCurriculumId = String(candidate?.curriculumId || candidate?.curriculumControlId || '').trim();
  if (candidateCurriculumId) {
    const byId = state.curriculums.find((curriculum) => (
      curriculumIdentifier(curriculum) === candidateCurriculumId
      || curriculum.id === candidateCurriculumId
      || curriculum.id_controle === candidateCurriculumId
      || curriculum.mongoId === candidateCurriculumId
    ));
    if (byId) return byId;
  }

  const candidateName = normalizeText(candidate?.name || candidate?.nome);
  if (!candidateName) return null;

  return state.curriculums.find((curriculum) => normalizeText(curriculum.nome) === candidateName) || null;
}

function candidateCurriculumDisplay(curriculum, fallback = '') {
  if (!curriculum && !fallback) return '';
  return String(curriculum?.id_controle || curriculum?.mongoId || curriculum?.id || fallback || '').trim();
}

function findCurriculumByIdentifier(curriculumId) {
  const id = String(curriculumId || '').trim();
  if (!id) return null;
  return state.curriculums.find((curriculum) => (
    curriculumIdentifier(curriculum) === id
    || curriculum.id === id
    || curriculum.id_controle === id
    || curriculum.mongoId === id
  )) || null;
}

function curriculumObservationAliases(curriculumOrId) {
  const curriculum = typeof curriculumOrId === 'string'
    ? findCurriculumByIdentifier(curriculumOrId)
    : curriculumOrId;
  const values = [
    typeof curriculumOrId === 'string' ? curriculumOrId : '',
    curriculum?.id,
    curriculum?.id_controle,
    curriculum?.mongoId,
    curriculumIdentifier(curriculum)
  ];
  return new Set(values.filter(Boolean).map((value) => String(value).trim()));
}

function curriculumForObservationSubject(subject) {
  if (!subject) return null;
  if (subject.nome || subject.id_controle || subject.mongoId) {
    return findCurriculumByIdentifier(curriculumIdentifier(subject)) || subject;
  }
  if (subject.candidateName) {
    return findCurriculumForCandidate({ name: subject.candidateName, curriculumId: subject.curriculumId });
  }
  return findCurriculumForCandidate(subject);
}

function curriculumObservationId(subject) {
  if (typeof subject === 'string') return subject.trim();
  const curriculum = curriculumForObservationSubject(subject);
  return String(
    curriculumIdentifier(curriculum)
    || subject?.curriculumId
    || subject?.curriculumControlId
    || ''
  ).trim();
}

function curriculumObservationCount(subject) {
  const id = curriculumObservationId(subject);
  if (!id) return 0;
  const aliases = curriculumObservationAliases(id);
  return state.curriculumObservations.filter((observation) => aliases.has(String(observation.curriculumId || '').trim())).length;
}

function renderCurriculumObservationsButton(subject, label = 'Observações') {
  const id = curriculumObservationId(subject);
  if (!id) return '';
  const count = curriculumObservationCount(id);
  const suffix = count ? ` (${count})` : '';
  return `<button class="ghost-action compact-action" type="button" data-open-curriculum-observations="${escapeHtml(id)}">${label}${suffix}</button>`;
}

function renderCvResultRows(results, emptyMessage, group) {
  if (!results.length) {
    return `<tr><td colspan="6">${emptyMessage}</td></tr>`;
  }

  return results
    .map((result) => {
      const curriculum = findCurriculumForCandidate(result);
      return `
      <tr>
        <td><input type="checkbox" data-select-cv-result="${result.id}" data-result-group="${group}" aria-label="Selecionar ${result.name || 'candidato'}" /></td>
        <td><strong>${renderBlackflagName(result.name, curriculum || result)}</strong></td>
        <td>${result.source || 'APINFO'}</td>
        <td>${candidateLinkHtml(result)}</td>
        <td>${result.score ?? 0}</td>
        <td>${result.observation || '-'}</td>
      </tr>
    `;
    })
    .join('');
}

function renderCvSearchResults() {
  const filter = selectedCvFilter();
  const status = $('#cvSearchStatus');
  const table = $('#cvSearchResultTable');
  const rejectedStatus = $('#cvRejectedStatus');
  const rejectedTable = $('#cvRejectedResultTable');
  const button = $('#cvSearchButton');
  const saveButton = $('#saveSelectedCandidatesButton');

  if (button) {
    button.disabled = !filter;
  }
  if (saveButton) {
    saveButton.disabled = true;
  }
  if (!status || !table) return;

  if (!filter) {
    status.textContent = 'Selecione um filtro salvo';
    table.innerHTML = '<tr><td colspan="6">Salve ou clique em um filtro para buscar candidatos.</td></tr>';
    if (rejectedStatus) rejectedStatus.textContent = 'Selecione um filtro salvo';
    if (rejectedTable) rejectedTable.innerHTML = '<tr><td colspan="6">Salve ou clique em um filtro para visualizar rejeitados.</td></tr>';
    setCvSearchInlineStatus('Nenhuma busca executada.');
    return;
  }

  status.textContent = filter.searchMessage || `Pronto para buscar em ${enabledSourceLabels(filter).join(', ') || 'nenhuma fonte'}`;
  const results = Array.isArray(filter.searchResults) ? filter.searchResults : [];
  const rejectedResults = Array.isArray(filter.searchRejectedResults) ? filter.searchRejectedResults : [];
    if (filter.searchStatus === 'running') {
    setCvSearchInlineStatus('Busca de Candidatos em Andamento', 'running');
  } else if (filter.searchStatus === 'completed') {
    setCvSearchInlineStatus(
      `Busca finalizada. Aprovados: ${results.length}; Rejeitados: ${rejectedResults.length}; Total analisado: ${results.length + rejectedResults.length}.`,
      'done'
    );
  } else if (filter.searchStatus === 'no_sources') {
    setCvSearchInlineStatus('Nenhuma fonte de busca selecionada.', 'error');
  } else if (filter.searchStatus === 'pending_credentials') {
    setCvSearchInlineStatus(filter.searchMessage || 'Busca pendente de credenciais.', 'error');
  } else {
    setCvSearchInlineStatus('Pronto para buscar candidatos.');
  }

  table.innerHTML = renderCvResultRows(results, 'Nenhum candidato aprovado pela regra.', 'resultado');
  if (rejectedStatus) {
    rejectedStatus.textContent = rejectedResults.length ? `${rejectedResults.length} rejeitados analisados` : 'Nenhum rejeitado registrado';
  }
  if (rejectedTable) {
    rejectedTable.innerHTML = renderCvResultRows(rejectedResults, 'Nenhum candidato rejeitado registrado.', 'rejeitado');
  }
}

function getFilteredCurriculums() {
  const name = state.curriculumSearch.name || '';
  const curriculumKeyword = state.curriculumSearch.skills || '';

  return state.curriculums.filter((curriculum) => {
    const matchesName = !name || matchesEveryTerm(curriculum.nome, name);
    const matchesCurriculumKeyword = !curriculumKeyword || matchesEveryTerm(curriculumFullText(curriculum), curriculumKeyword);
    return matchesName && matchesCurriculumKeyword;
  });
}


function talentSourceLabel() {
  const labels = {
    mongodb: 'MongoDB Banco_de_Talentos/curriculums',
    local_json: 'data/database.json',
    local_json_fallback: 'data/database.json (fallback)'
  };
  return labels[state.talentSource] || state.talentSource || 'data/database.json';
}

function renderEmailProcessingStatus() {
  const sourceLabel = $('#curriculumSourceLabel');
  const statusElement = $('#emailProcessingStatus');
  const button = $('#processEmailsButton');

  // Remove a informação de fonte/banco/tela do front
  if (sourceLabel) {
    sourceLabel.textContent = '';
    sourceLabel.style.display = 'none';
  }

  if (!statusElement) return;

  if (state.talentError) {
    statusElement.textContent = state.talentError;
    return;
  }

  const processing = state.emailProcessing;

  if (!processing || processing.status === 'idle') {
    statusElement.textContent = 'Último processamento: -';
    if (button) button.disabled = false;
    return;
  }

  if (button) button.disabled = Boolean(processing.running);

  if (processing.running) {
    const dataInicio = processing.startedAt || processing.started_at || '-';
    statusElement.textContent = `Leitura de e-mails em andamento desde ${dataInicio}.`;
    return;
  }

  const dataHoraUltimoProcessamento =
    processing.finishedAt ||
    processing.finished_at ||
    processing.startedAt ||
    processing.started_at ||
    '';

  statusElement.textContent = dataHoraUltimoProcessamento
    ? `Último processamento: ${dataHoraUltimoProcessamento}`
    : 'Último processamento: -';
}

function curriculumIdentifier(curriculum) {
  return String(curriculum?.id || curriculum?.mongoId || curriculum?.id_controle || '').trim();
}

function selectedCurriculum() {
  if (!state.selectedCurriculumId) return null;
  return state.curriculums.find((curriculum) => curriculumIdentifier(curriculum) === state.selectedCurriculumId) || null;
}

function isFlagEnabled(value) {
  if (value === true || value === 1) return true;
  return ['true', '1', 'sim', 'yes', 'on'].includes(normalizeText(value));
}

function isCurriculumBlacklisted(curriculum) {
  return isFlagEnabled(
    curriculum?.blackflag
    ?? curriculum?.blackFlag
    ?? curriculum?.black_flag
    ?? curriculum?.blacklist
    ?? curriculum?.blackList
    ?? curriculum?.black_list
    ?? false
  );
}

function curriculumBlacklistObservation(curriculum) {
  return String(
    curriculum?.blackflagObservation
    ?? curriculum?.blackFlagObservation
    ?? curriculum?.blackflag_observation
    ?? curriculum?.blacklistObservation
    ?? curriculum?.blackListObservation
    ?? curriculum?.blacklist_observation
    ?? ''
  ).trim();
}

function renderBlackflagName(name, source) {
  const label = escapeHtml(name || '-');
  return isCurriculumBlacklisted(source)
    ? `<span class="blackflag-name">${label}</span>`
    : label;
}

function setCurriculumDetailEditing(isEditing) {
  state.curriculumEditing = Boolean(isEditing);
  const form = $('#curriculumDetailForm');
  if (form) {
    Array.from(form.elements).forEach((field) => {
      field.disabled = !state.curriculumEditing;
    });
  }

  const editButton = $('#editCurriculumButton');
  const saveButton = $('#saveCurriculumButton');
  const cancelButton = $('#cancelCurriculumEditButton');
  if (editButton) editButton.disabled = state.curriculumEditing;
  if (saveButton) saveButton.disabled = !state.curriculumEditing;
  if (cancelButton) cancelButton.disabled = !state.curriculumEditing;
}

function fillCurriculumDetailForm(curriculum) {
  const form = $('#curriculumDetailForm');
  if (!form || !curriculum) return;

  [
    'id_controle',
    'nome',
    'email',
    'telefone',
    'linkedin',
    'nacionalidade',
    'estado_civil',
    'idade',
    'data_nascimento',
    'fonte',
    'endereco',
    'skills',
    'conhecimento_tecnico',
    'formacao_academica',
    'cursos_certificacoes',
    'experiencia_profissional',
    'nivel_ingles',
    'nivel_espanhol',
    'cargo_alvo',
    'disponibilidade_viagem',
    'feedback_entrevista_ingles',
    'observacoes_entrevista',
    'blackflag',
    'blackflagObservation'
  ].forEach((fieldName) => setFieldValue(form, fieldName, curriculum[fieldName] || ''));

  setFieldValue(form, 'blackflag', isCurriculumBlacklisted(curriculum) ? 'true' : 'false');
  setFieldValue(form, 'blackflagObservation', curriculumBlacklistObservation(curriculum));
}

function readCurriculumDetailForm() {
  const form = $('#curriculumDetailForm');
  const payload = formPayload(form);
  const current = selectedCurriculum();
  return {
    ...payload,
    id: current?.id || '',
    mongoId: current?.mongoId || '',
    blackflag: isFlagEnabled(payload.blackflag),
    blackflagObservation: payload.blackflagObservation || curriculumBlacklistObservation(current) || '',
    data_criação: current?.data_criação || '',
    data_origem: current?.data_origem || ''
  };
}

function selectCurriculum(curriculumId) {
  const curriculum = state.curriculums.find((item) => curriculumIdentifier(item) === String(curriculumId || '').trim());

  if (!curriculum) {
    toast('Candidato nao encontrado na lista atual.');
    return;
  }

  state.selectedCurriculumId = curriculumIdentifier(curriculum);
  state.curriculumEditing = false;
  state.curriculumActiveTab = 'detail';

  setCurriculumDetailEditing(false);
  renderCurriculums();
}

function openCurriculumFromLink(curriculumId) {
  const id = String(curriculumId || '').trim();
  const curriculum = state.curriculums.find((item) => (
    curriculumIdentifier(item) === id
    || item.id === id
    || item.id_controle === id
    || item.mongoId === id
  ));

  if (!curriculum) {
    toast('Currículo não encontrado na base interna.');
    return;
  }

  state.curriculumSearch = { name: '', skills: '', hasSearched: false };
  showView('curriculums');
  selectCurriculum(curriculumIdentifier(curriculum));
}

function openCurriculumTab(tab) {
  if (tab === 'detail' && !selectedCurriculum()) {
    toast('Selecione um candidato antes de abrir os detalhes.');
    return;
  }

  state.curriculumActiveTab = tab;
  renderCurriculums();
}

function renderCurriculumTabs() {
  const listButton = $('#curriculumListTabButton');
  const detailButton = $('#curriculumDetailTabButton');
  const hasSelected = Boolean(selectedCurriculum());

  if (listButton) {
    listButton.classList.toggle('active', state.curriculumActiveTab === 'list');
  }

  if (detailButton) {
    detailButton.disabled = !hasSelected;
    detailButton.classList.toggle('active', state.curriculumActiveTab === 'detail');
  }

  const listPanel = $('#curriculumListPanel');
  if (listPanel) {
    listPanel.classList.toggle('hidden', state.curriculumActiveTab !== 'list');
  }
}

function renderCurriculumDetail() {
  const panel = $('#curriculumDetailPanel');
  const curriculum = selectedCurriculum();

  if (!panel) return;

const shouldShowDetail = Boolean(curriculum) && state.curriculumActiveTab === 'detail';

if (!shouldShowDetail) {
  panel.classList.add('hidden');
  return;
}

panel.classList.remove('hidden');
  const selectedNameElement = $('#selectedCurriculumName');
  if (selectedNameElement) {
    selectedNameElement.textContent = curriculum.nome || 'Candidato sem nome';
    selectedNameElement.classList.toggle('blackflag-name', isCurriculumBlacklisted(curriculum));
  }
  $('#selectedCurriculumId').textContent = curriculum.id_controle || curriculum.id || curriculum.mongoId || '';
  const blacklisted = isCurriculumBlacklisted(curriculum);
  const banner = $('#curriculumBlacklistBanner');
  if (banner) {
    const observation = curriculumBlacklistObservation(curriculum) || curriculum.observacoes_entrevista || 'Candidato marcado em Black Flag.';
    banner.textContent = blacklisted ? `BLACK FLAG: ${observation}` : '';
    banner.classList.toggle('hidden', !blacklisted);
  }

  const blacklistButton = $('#blacklistCurriculumButton');
  if (blacklistButton) {
    blacklistButton.classList.remove('primary-action', 'danger-action', 'secondary-action');
    blacklistButton.classList.add(blacklisted ? 'danger-action' : 'primary-action');
    blacklistButton.textContent = 'Black Flag';
    blacklistButton.setAttribute('aria-label', blacklisted ? 'Remover Black Flag do candidato' : 'Marcar candidato com Black Flag');
  }
  const observationsButton = $('#curriculumObservationsButton');
  if (observationsButton) {
    const count = curriculumObservationCount(curriculum);
    observationsButton.textContent = count ? `Observações (${count})` : 'Observações';
    observationsButton.dataset.openCurriculumObservations = curriculumObservationId(curriculum);
    observationsButton.disabled = false;
  }
  fillCurriculumDetailForm(curriculum);
  setCurriculumDetailEditing(state.curriculumEditing);
}

async function saveCurriculumDetail() {
  const current = selectedCurriculum();
  if (!current) {
    toast('Selecione um candidato antes de salvar.');
    return;
  }

  const payload = readCurriculumDetailForm();
  if (!payload.nome?.trim()) {
    toast('Informe o nome do candidato.');
    return;
  }

  const saveButton = $('#saveCurriculumButton');
  const originalText = saveButton?.textContent || 'Salvar dados';
  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Salvando...';
      saveButton.setAttribute('aria-busy', 'true');
    }
    const updated = await api(`/api/curriculums/${encodeURIComponent(curriculumIdentifier(current))}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    const currentIndex = state.curriculums.findIndex((item) => curriculumIdentifier(item) === curriculumIdentifier(current));
    if (currentIndex >= 0) {
      state.curriculums[currentIndex] = updated;
    }
    state.selectedCurriculumId = curriculumIdentifier(updated);
    setCurriculumDetailEditing(false);
    state.selectedCurriculumId = curriculumIdentifier(updated);
    state.curriculumActiveTab = 'detail';
    state.curriculumEditing = false;
    renderCurriculums();
    toast('Dados do candidato salvos com sucesso.');
  } catch (error) {
    toast(error.message || 'Não foi possível salvar o candidato.');
  } finally {
    if (saveButton) {
      saveButton.disabled = !state.curriculumEditing;
      saveButton.textContent = originalText;
      saveButton.removeAttribute('aria-busy');
    }
  }
}

async function exportSelectedCurriculumTemplate(templateId, button) {
  const current = selectedCurriculum();

  if (!current) {
    toast('Selecione um candidato antes de exportar.');
    return;
  }

  const originalText = button?.textContent || 'Gerar documento';
  const generationButtons = [$('#exportAlcateiaButton'), $('#exportDttButton')].filter(Boolean);
  try {
    generationButtons.forEach((item) => { item.disabled = true; });
    if (button) button.textContent = 'Gerando com IA...';

    const curriculumPayload = $('#curriculumDetailForm') ? readCurriculumDetailForm() : current;
    await apiDownload(`/api/curriculums/${encodeURIComponent(curriculumIdentifier(current))}/export-template`, {
      method: 'POST',
      body: JSON.stringify({ templateId, curriculum: curriculumPayload })
    });
    toast(templateId === 'dtt'
      ? 'Pacote DTT gerado: CV em português, CV em inglês e resumo da entrevista.'
      : 'CV Alcateia gerado com sucesso.');
  } catch (error) {
    toast(error.message || 'Não foi possível gerar os documentos.');
  } finally {
    generationButtons.forEach((item) => { item.disabled = false; });
    if (button) button.textContent = originalText;
  }
}

function openOpportunitiesForCurriculumSelection() {
  return state.opportunities
    .filter((opportunity) => isDashboardOpenOpportunity(opportunity) && opportunity.status === 'Open')
    .sort(byOpportunityCode);
}

function ensureCurriculumOpportunityModal() {
  let modal = $('#curriculumOpportunityModal');
  if (modal) return modal;

  modal = document.createElement('section');
  modal.id = 'curriculumOpportunityModal';
  modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'curriculumOpportunityTitle');
  modal.innerHTML = `
    <div class="modal-card curriculum-opportunity-modal-card">
      <div class="modal-heading">
        <div>
          <h2 id="curriculumOpportunityTitle">Selecionar candidato</h2>
          <span id="curriculumOpportunitySummary"></span>
        </div>
        <button class="ghost-action" type="button" data-close-curriculum-opportunity aria-label="Fechar">×</button>
      </div>
      <form id="curriculumOpportunityForm" class="form-grid">
        <label class="full">Oportunidade em aberto
          <select name="opportunityId" required></select>
        </label>
        <label class="full">Observação
          <textarea name="observation" rows="3" placeholder="Observação para Candidatos Selecionados"></textarea>
        </label>
        <button class="primary-action" type="submit">Salvar em Candidatos Selecionados</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  $('#curriculumOpportunityForm', modal)?.addEventListener('submit', saveSelectedCurriculumCandidate);
  initPanelMaximizeControls();
  return modal;
}

function closeCurriculumOpportunityModal() {
  closeSurfaceDialog('#curriculumOpportunityModal');
}

function openCurriculumOpportunityModal() {
  const current = selectedCurriculum();
  if (!current) {
    toast('Selecione um candidato antes de vincular a uma oportunidade.');
    return;
  }

  const opportunities = openOpportunitiesForCurriculumSelection();
  if (!opportunities.length) {
    toast('Não há oportunidades em aberto para seleção.');
    return;
  }

  const modal = ensureCurriculumOpportunityModal();
  $('#curriculumOpportunitySummary', modal).textContent = current.nome || 'Candidato selecionado';
  const select = $('#curriculumOpportunityForm select[name="opportunityId"]', modal);
  select.innerHTML = [
    '<option value="">Selecione</option>',
    ...opportunities.map((opportunity) => `<option value="${escapeHtml(opportunity.id)}">${escapeHtml(opportunityLabel(opportunity))}</option>`)
  ].join('');
  $('#curriculumOpportunityForm textarea[name="observation"]', modal).value = '';
  modal.classList.remove('hidden');
  select.focus();
}

async function saveSelectedCurriculumCandidate(event) {
  event.preventDefault();
  const current = selectedCurriculum();
  if (!current) {
    toast('Selecione um candidato antes de salvar.');
    return;
  }

  const form = event.currentTarget;
  const payload = formPayload(form);
  const opportunityId = String(payload.opportunityId || '').trim();
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  if (!opportunity || !isDashboardOpenOpportunity(opportunity)) {
    toast('Selecione uma oportunidade em aberto.');
    return;
  }

  const button = $('button[type="submit"]', form);
  const originalText = button?.textContent || 'Salvar em Candidatos Selecionados';
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando...';
    }

    const selectedCandidates = await api('/api/selected-candidates', {
      method: 'POST',
      body: JSON.stringify({
        opportunityId,
        cvFilterId: '',
        candidateMessage: '',
        candidates: [{
          name: current.nome,
          source: 'ALCATEIA',
          link: '',
          linkedinLink: current.linkedin || '',
          apinfoLink: '',
          curriculumId: current.id_controle || current.id || current.mongoId || '',
          score: 100,
          origin: 'Banco de Talentos',
          observation: payload.observation || `Selecionado no Banco de Talentos para ${opportunityLabel(opportunity)}`
        }]
      })
    });

    closeCurriculumOpportunityModal();
    selectedCandidates.forEach((selectedCandidate) => upsertStateItem('selectedCandidates', selectedCandidate));
    state.selectedCandidateFilter = { type: 'name', value: current.nome || '' };
    showView('selectedCandidates');
    renderSelectedCandidates();
    toast('Candidato enviado para Candidatos Selecionados.');
  } catch (error) {
    toast(error.message || 'Não foi possível selecionar o candidato.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function ensureCurriculumBlacklistModal() {
  let modal = $('#curriculumBlacklistModal');
  if (modal) return modal;

  modal = document.createElement('section');
  modal.id = 'curriculumBlacklistModal';
  modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'curriculumBlacklistTitle');
  modal.innerHTML = `
    <div class="modal-card curriculum-opportunity-modal-card">
      <div class="modal-heading">
        <div>
          <h2 id="curriculumBlacklistTitle">Black Flag</h2>
          <span id="curriculumBlacklistSummary"></span>
        </div>
        <button class="ghost-action" type="button" data-close-curriculum-blacklist aria-label="Fechar">×</button>
      </div>
      <form id="curriculumBlacklistForm" class="form-grid">
        <label class="full">Observação obrigatória
          <textarea name="blackflagObservation" rows="4" required></textarea>
        </label>
        <button class="danger-action" type="submit">Salvar Black Flag</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  $('#curriculumBlacklistForm', modal)?.addEventListener('submit', saveCurriculumBlacklist);
  initPanelMaximizeControls();
  return modal;
}

function closeCurriculumBlacklistModal() {
  closeSurfaceDialog('#curriculumBlacklistModal');
}

function openCurriculumBlacklistModal() {
  const current = selectedCurriculum();
  if (!current) {
    toast('Selecione um candidato antes de marcar Black Flag.');
    return;
  }

  const modal = ensureCurriculumBlacklistModal();
  const blacklisted = isCurriculumBlacklisted(current);
  const nextBlacklisted = !blacklisted;
  modal.dataset.nextBlacklist = nextBlacklisted ? 'true' : 'false';
  $('#curriculumBlacklistTitle', modal).textContent = blacklisted ? 'Remover Black Flag' : 'Black Flag';
  $('#curriculumBlacklistSummary', modal).textContent = blacklisted
    ? `${current.nome || 'Candidato selecionado'} está com Black Flag. Salve para remover a flag.`
    : `${current.nome || 'Candidato selecionado'} será marcado com Black Flag.`;
  $('#curriculumBlacklistForm textarea[name="blackflagObservation"]', modal).value = curriculumBlacklistObservation(current);
  const submitButton = $('#curriculumBlacklistForm button[type="submit"]', modal);
  if (submitButton) {
    submitButton.classList.remove('primary-action', 'danger-action', 'secondary-action');
    submitButton.classList.add(nextBlacklisted ? 'danger-action' : 'primary-action');
    submitButton.textContent = nextBlacklisted ? 'Salvar Black Flag' : 'Salvar e remover Black Flag';
  }
  modal.classList.remove('hidden');
  $('#curriculumBlacklistForm textarea[name="blackflagObservation"]', modal).focus();
}

async function saveCurriculumBlacklist(event) {
  event.preventDefault();
  const current = selectedCurriculum();
  if (!current) {
    toast('Selecione um candidato antes de marcar Black Flag.');
    return;
  }

  const form = event.currentTarget;
  const observation = String(form.elements.blackflagObservation?.value || '').trim();
  if (!observation) {
    toast('A observação é obrigatória para Black Flag.');
    return;
  }

  const existingObservation = String(current.observacoes_entrevista || '').trim();
  const nextBlacklisted = $('#curriculumBlacklistModal')?.dataset.nextBlacklist === 'true';
  const blacklistLine = `Black Flag: ${observation}`;
  const removalLine = `Black Flag removida: ${observation}`;
  const auditLine = nextBlacklisted ? blacklistLine : removalLine;
  const nextObservation = existingObservation.includes(auditLine)
    ? existingObservation
    : [existingObservation, auditLine].filter(Boolean).join('\n');

  const button = $('button[type="submit"]', form);
  const originalText = button?.textContent || (nextBlacklisted ? 'Salvar Black Flag' : 'Salvar e remover Black Flag');
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando...';
    }

    const updated = await api(`/api/curriculums/${encodeURIComponent(curriculumIdentifier(current))}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...current,
        blackflag: nextBlacklisted,
        blackflagObservation: observation,
        observacoes_entrevista: nextObservation
      })
    });

    const currentIndex = state.curriculums.findIndex((item) => curriculumIdentifier(item) === curriculumIdentifier(current));
    if (currentIndex >= 0) state.curriculums[currentIndex] = updated;
    state.selectedCurriculumId = curriculumIdentifier(updated);
    state.curriculumActiveTab = 'detail';
    closeCurriculumBlacklistModal();
    renderCurriculums();
    toast(nextBlacklisted ? 'Candidato marcado com Black Flag.' : 'Candidato removido da Black Flag.');
  } catch (error) {
    toast(error.message || 'Não foi possível atualizar Black Flag.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function formatObservationDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
}

function renderCurriculumObservationsTable(observations) {
  const table = $('#curriculumObservationsTable');
  if (!table) return;

  if (!observations.length) {
    table.innerHTML = '<tr><td colspan="3">Nenhuma observação registrada para este candidato.</td></tr>';
    return;
  }

  table.innerHTML = observations
    .map((observation) => `
      <tr>
        <td>${formatObservationDate(observation.date || observation.createdAt)}</td>
        <td>${escapeHtml(observation.userName || observation.userEmail || observation.userId || '-')}</td>
        <td>${escapeHtml(observation.observation || '-')}</td>
      </tr>
    `)
    .join('');
}

function observationsForCurriculum(curriculumId) {
  const aliases = curriculumObservationAliases(curriculumId);
  return state.curriculumObservations
    .filter((observation) => aliases.has(String(observation.curriculumId || '').trim()))
    .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')));
}

function mergeCurriculumObservations(curriculumId, observations) {
  const aliases = curriculumObservationAliases(curriculumId);
  state.curriculumObservations = state.curriculumObservations
    .filter((observation) => !aliases.has(String(observation.curriculumId || '').trim()))
    .concat(observations);
}

function closeCurriculumObservationsModal() {
  state.editing.observingCurriculumId = '';
  closeSurfaceDialog('#curriculumObservationsModal');
}

async function openCurriculumObservationsModal(curriculumId) {
  const id = String(curriculumId || '').trim();
  if (!id) {
    toast('Currículo não identificado para observações.');
    return;
  }

  const modal = $('#curriculumObservationsModal');
  const form = $('#curriculumObservationForm');
  const curriculum = findCurriculumByIdentifier(id);
  state.editing.observingCurriculumId = id;
  if (form) form.reset();
  $('#curriculumObservationsSummary').textContent = curriculum
    ? `${curriculum.nome || 'Candidato'} · ${candidateCurriculumDisplay(curriculum)}`
    : `Currículo ${id}`;
  renderCurriculumObservationsTable(observationsForCurriculum(id));
  modal?.classList.remove('hidden');

  try {
    const observations = await api(`/api/curriculums/${encodeURIComponent(id)}/observations`);
    mergeCurriculumObservations(id, observations);
    renderCurriculumObservationsTable(observationsForCurriculum(id));
    render();
  } catch (error) {
    toast(error.message || 'Não foi possível carregar observações.');
  }
}

async function saveCurriculumObservation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const curriculumId = state.editing.observingCurriculumId;
  const observation = String(form.elements.observation?.value || '').trim();

  if (!curriculumId) {
    toast('Currículo não identificado para observações.');
    return;
  }
  if (!observation) {
    toast('Informe a observação do candidato.');
    return;
  }

  const button = $('button[type="submit"]', form);
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Inserindo...';
    }
    const saved = await api(`/api/curriculums/${encodeURIComponent(curriculumId)}/observations`, {
      method: 'POST',
      body: JSON.stringify({ observation })
    });
    state.curriculumObservations.push(saved);
    form.reset();
    renderCurriculumObservationsTable(observationsForCurriculum(curriculumId));
    render();
    toast('Observação inserida.');
  } catch (error) {
    toast(error.message || 'Não foi possível inserir a observação.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Inserir observação';
    }
  }
}

function obterUltimoEmpregoComDatas(curriculum) {
  const experiencia = String(curriculum.experiencia_profissional || '').trim();

  if (!experiencia) {
    return '-';
  }

  const linhas = experiencia
    .split(/\n+/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (!linhas.length) {
    return '-';
  }

  // Procura uma linha que tenha padrão de data, exemplo:
  // 01/2020, 2020, 2020 - 2022, Jan/2020, Atual, Presente
  const padraoData = /(\d{2}\/\d{4}|\d{4}|atual|presente|até o momento|atualmente)/i;

  const linhaComData = linhas.find((linha) => padraoData.test(linha));

  if (linhaComData) {
    return linhaComData;
  }

  // Fallback: retorna a primeira linha da experiência profissional
  return linhas[0];
}

function trimSearchSnippet(text, query, maxLength = 180) {
  const rawText = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (rawText.length <= maxLength) return rawText;

  const terms = splitRawSearchTerms(query);
  const lowerText = rawText.toLowerCase();
  const firstIndex = terms
    .map((term) => lowerText.indexOf(term.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, firstIndex - 55);
  const end = Math.min(rawText.length, start + maxLength);
  return `${start > 0 ? '...' : ''}${rawText.slice(start, end)}${end < rawText.length ? '...' : ''}`;
}

function curriculumSearchSnippets(curriculum, query) {
  const terms = splitSearchTerms(query);
  if (!terms.length) return [];

  const fields = [
    ['Skill', curriculum.skills],
    ['Conhecimento técnico', curriculum.conhecimento_tecnico],
    ['Experiência profissional', curriculum.experiencia_profissional],
    ['Cursos/certificações', curriculum.cursos_certificacoes],
    ['Formação', curriculum.formacao_academica],
    ['Cargo alvo', curriculum.cargo_alvo]
  ];

  const snippets = [];
  for (const [label, value] of fields) {
    const lines = String(value ?? '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const line = lines.find((item) => {
      const normalizedLine = normalizeSearchValue(item);
      return terms.some((term) => normalizedLine.includes(term));
    });
    if (line) {
      snippets.push({ label, text: trimSearchSnippet(line, query) });
    }
    if (snippets.length >= 3) break;
  }
  return snippets;
}

function renderCurriculumSearchSnippets(curriculum, query) {
  const snippets = curriculumSearchSnippets(curriculum, query);
  if (!snippets.length) return '';

  return `
    <div class="talent-match-snippets">
      ${snippets.map((snippet) => `
        <div><span>${escapeHtml(snippet.label)}:</span> ${highlightSearchTerms(snippet.text, query)}</div>
      `).join('')}
    </div>
  `;
}

function renderCurriculums() {
  renderEmailProcessingStatus();
  const curriculums = getFilteredCurriculums();
  const highlightQuery = `${state.curriculumSearch.name || ''} ${state.curriculumSearch.skills || ''}`.trim();
  $('#curriculumCount').textContent = curriculums.length;
  const searchStatus = $('#curriculumSearchStatus');

  if (searchStatus) {
    if (state.curriculumSearch.hasSearched) {
      searchStatus.textContent = curriculums.length
        ? `${curriculums.length} talento(s) encontrado(s).`
        : `Nenhum talento encontrado para os filtros informados. A base atual possui ${state.curriculums.length} talento(s).`;
    } else {
      searchStatus.textContent = `${state.curriculums.length} talento(s) disponível(is) para pesquisa.`;
    }
  }

  if (!curriculums.some((curriculum) => curriculumIdentifier(curriculum) === state.selectedCurriculumId)) {
    state.selectedCurriculumId = '';
    state.curriculumEditing = false;
  }
  if (!state.selectedCurriculumId && state.curriculumActiveTab === 'detail') {
    state.curriculumActiveTab = 'list';
  }

  renderCurriculumTabs();
const curriculumRows = curriculums
  .slice()
  .sort(byCurriculumControl)
  .map((curriculum) => {
    const id = curriculumIdentifier(curriculum);
    const isSelected = id === state.selectedCurriculumId;

    const skillCompleto =
      curriculum.skills ||
      curriculum.conhecimento_tecnico ||
      '-';

    const ultimoEmprego = obterUltimoEmpregoComDatas(curriculum);

    return `
      <tr class="${isSelected ? 'selected-row' : ''}" data-select-curriculum="${escapeHtml(id)}">
        <td>
          <strong class="${isCurriculumBlacklisted(curriculum) ? 'blackflag-name' : ''}">${highlightSearchTerms(curriculum.nome || '-', highlightQuery)}</strong>
        </td>

        <td class="talent-long-text">
          ${highlightSearchTerms(skillCompleto, highlightQuery)}
          ${renderCurriculumSearchSnippets(curriculum, highlightQuery)}
        </td>

        <td class="talent-long-text">
          ${highlightSearchTerms(ultimoEmprego, highlightQuery)}
        </td>
      </tr>
    `;
  })
  .join('');

$('#curriculumTable').innerHTML = curriculumRows || `
  <tr>
    <td colspan="3">Nenhum talento encontrado para os filtros informados.</td>
  </tr>
`;

  renderCurriculumDetail();
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function renderAllocatedFilters() {
  const typeSelect = $('#allocatedFilterType');
  const valueSelect = $('#allocatedFilterValue');
  const activeFilter = $('#allocatedActiveFilter');
  const inactiveFilter = $('#allocatedInactiveFilter');
  if (!typeSelect || !valueSelect) return;

  const type = state.allocatedFilter.type || typeSelect.value;
  const selected = state.allocatedFilter.value || valueSelect.value;
  const status = state.allocatedFilter.status || '';
  let options = [{ value: '', label: 'Todos' }];

  typeSelect.value = type;
  if (activeFilter) activeFilter.checked = status === 'active';
  if (inactiveFilter) inactiveFilter.checked = status === 'inactive';

  if (type === 'consultant') {
    const consultants = [...new Set(state.allocateds.map((allocated) => allocated.consultant).filter(Boolean))];
    options = options.concat(
      consultants
        .sort((first, second) => first.localeCompare(second, 'pt-BR', { sensitivity: 'base' }))
        .map((consultant) => ({ value: consultant, label: consultant }))
    );
  }

  if (type === 'client') {
    options = options.concat(
      state.clients
        .slice()
        .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
        .map((client) => ({ value: client.id, label: client.customerName }))
    );
  }

  valueSelect.disabled = !type;
  valueSelect.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  valueSelect.value = options.some((option) => option.value === selected) ? selected : '';
  state.allocatedFilter.value = valueSelect.value;
  state.allocatedFilter.status = status;
}

function getFilteredAllocateds() {
  const { type, value, status } = state.allocatedFilter;
  let allocateds = state.allocateds;

  if (status === 'active') {
    allocateds = allocateds.filter((allocated) => allocated.active === true);
  }

  if (status === 'inactive') {
    allocateds = allocateds.filter((allocated) => allocated.active !== true);
  }

  if (!type || !value) return allocateds;

  if (type === 'consultant') {
    return allocateds.filter((allocated) => allocated.consultant === value);
  }

  if (type === 'client') {
    return allocateds.filter((allocated) => allocated.clientId === value);
  }

  return allocateds;
}

function updateAllocatedSelectionState(allocateds) {
  const visibleIds = new Set(allocateds.map((allocated) => allocated.id));
  state.selectedAllocatedIds = new Set([...state.selectedAllocatedIds].filter((id) => visibleIds.has(id)));

  const selectedCount = state.selectedAllocatedIds.size;
  const selectAll = $('#allocatedSelectAll');
  const selectedCountElement = $('#allocatedSelectedCount');
  if (selectAll) {
    selectAll.checked = allocateds.length > 0 && selectedCount === allocateds.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < allocateds.length;
    selectAll.disabled = allocateds.length === 0;
  }
  if (selectedCountElement) {
    selectedCountElement.textContent = `${selectedCount} selecionado${selectedCount === 1 ? '' : 's'}`;
  }
}

function allocatedCsvRows(rows = getFilteredAllocateds()) {
  return rows.map((allocated) => {
    const client = state.clients.find((item) => item.id === allocated.clientId);
    return {
      ID: allocated.externalId || allocated.id,
      'Codigo': allocated.code || '',
      Consultor: allocated.consultant || '',
      Skill: allocated.skill || '',
      Cliente: allocated.clientName || client?.customerName || '',
      'Valor Hora': formatCurrency(allocated.hourlyRate),
      'Valor Venda Hora': formatCurrency(allocated.saleHourlyRate),
      'Horas Mes': allocated.monthlyHours || '',
      Fone: allocated.phone || '',
      'Email Consultor': allocated.consultantEmail || '',
      'Inicio': allocated.startDate || '',
      Ativo: allocated.active ? 'Sim' : 'Nao',
      'Termino': allocated.endDate || '',
      Gestor: allocated.manager || '',
      'Email Gestor': allocated.managerEmail || '',
      'Fone Gestor': allocated.managerPhone || ''
    };
  });
}

function exportAllocatedCsv() {
  const allocateds = getFilteredAllocateds();
  const selected = allocateds.filter((allocated) => state.selectedAllocatedIds.has(allocated.id));
  const rows = selected.length ? selected : allocateds;
  downloadCsv('alocados', allocatedCsvRows(rows));
  toast(selected.length ? `${selected.length} alocado${selected.length === 1 ? '' : 's'} exportado${selected.length === 1 ? '' : 's'}.` : 'CSV gerado com o filtro atual.');
}

async function exportAllocatedDocuments(button) {
  const allocatedIds = [...state.selectedAllocatedIds];
  const templateId = $('#allocatedDocumentTemplate')?.value || 'all';

  if (!allocatedIds.length) {
    toast('Selecione ao menos um alocado para gerar os formul?rios.');
    return;
  }

  const originalLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Gerando...';
  }

  try {
    await apiDownload('/api/allocateds/export-documents', {
      method: 'POST',
      body: JSON.stringify({
        allocatedIds,
        templateIds: [templateId]
      })
    });
    toast('Formul?rios gerados.');
  } catch (error) {
    toast(error.message || 'N?o foi poss?vel gerar os formul?rios.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

function renderAllocateds() {
  const allocateds = getFilteredAllocateds();
  $('#allocatedCount').textContent = allocateds.length;
  $('#allocatedTable').innerHTML = allocateds
    .map((allocated) => {
      const client = state.clients.find((item) => item.id === allocated.clientId);
      const checked = state.selectedAllocatedIds.has(allocated.id) ? 'checked' : '';
      return `
        <tr class="clickable-row" data-edit-allocated="${allocated.id}">
          <td><input type="checkbox" data-select-allocated="${allocated.id}" aria-label="Selecionar ${allocated.consultant || allocated.code || 'alocado'}" ${checked} /></td>
          <td>${allocated.externalId || allocated.id}</td>
          <td><strong>${allocated.code}</strong></td>
          <td>${allocated.consultant || '-'}</td>
          <td>${allocated.skill || '-'}</td>
          <td>${allocated.clientName || client?.customerName || '-'}</td>
          <td>${formatCurrency(allocated.hourlyRate)}</td>
          <td>${formatCurrency(allocated.saleHourlyRate)}</td>
          <td>${allocated.monthlyHours || '-'}</td>
          <td>${allocated.phone || '-'}</td>
          <td>${allocated.consultantEmail || '-'}</td>
          <td>${allocated.startDate || '-'}</td>
          <td>${allocated.active ? 'Sim' : 'N?o'}</td>
          <td>${allocated.endDate || '-'}</td>
          <td>${allocated.manager || '-'}</td>
          <td>${allocated.managerEmail || '-'}</td>
          <td>${allocated.managerPhone || '-'}</td>
        </tr>
      `;
    })
    .join('');
  updateAllocatedSelectionState(allocateds);
}

function rateCardMaximum(rate) {
  return Number((Number(rate || 0) * 0.7).toFixed(2));
}

function formatRateValue(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderRateCardFilters() {
  const select = $('#rateCardClientFilter');
  if (!select) return;

  const selected = state.rateCardFilter.clientId || select.value;
  const clientIds = new Set(state.rateCards.map((rateCard) => rateCard.clientId).filter(Boolean));
  const options = [
    { value: '', label: 'Todos' },
    ...state.clients
      .filter((client) => clientIds.has(client.id))
      .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
      .map((client) => ({ value: client.id, label: client.customerName }))
  ];

  select.innerHTML = options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('');
  select.value = options.some((option) => option.value === selected) ? selected : '';
  state.rateCardFilter.clientId = select.value;
}

function getFilteredRateCards() {
  const clientId = state.rateCardFilter.clientId || '';
  if (!clientId) return state.rateCards;
  return state.rateCards.filter((rateCard) => rateCard.clientId === clientId);
}

function syncRateCardMaximum(form = $('#rateCardForm')) {
  if (!form) return;
  const rate = Number(form.elements.rate?.value || 0);
  const maximumField = form.elements.maximum;
  if (maximumField) maximumField.value = rate ? rateCardMaximum(rate).toFixed(2) : '';
}

function renderRateCards() {
  const rateCards = getFilteredRateCards()
    .slice()
    .sort((first, second) => {
      const firstClient = first.clientName || state.clients.find((client) => client.id === first.clientId)?.customerName || '';
      const secondClient = second.clientName || state.clients.find((client) => client.id === second.clientId)?.customerName || '';
      return firstClient.localeCompare(secondClient, 'pt-BR', { sensitivity: 'base' })
        || first.skill.localeCompare(second.skill, 'pt-BR', { sensitivity: 'base' });
    });
  const countElement = $('#rateCardCount');
  const table = $('#rateCardTable');
  if (!countElement || !table) return;

  countElement.textContent = rateCards.length;
  table.innerHTML = rateCards.length
    ? rateCards.map((rateCard) => {
      const client = state.clients.find((item) => item.id === rateCard.clientId);
      return `
        <tr class="clickable-row" data-edit-rate-card="${escapeHtml(rateCard.id)}">
          <td><strong>${escapeHtml(rateCard.skill || '-')}</strong></td>
          <td>${formatRateValue(rateCard.rate)}</td>
          <td>${formatRateValue(rateCard.maximum)}</td>
          <td>${rateCard.active ? 'Sim' : 'Não'}</td>
          <td>${escapeHtml(rateCard.clientName || client?.customerName || '-')}</td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="5">Nenhum Rate Card encontrado para o filtro informado.</td></tr>';
}

function candidatePoolSkillFields() {
  return Array.isArray(state.candidatePoolSkillFields) && state.candidatePoolSkillFields.length
    ? state.candidatePoolSkillFields
    : defaultCandidatePoolSkillFields;
}

function candidatePoolSkills(item) {
  if (Array.isArray(item.activeSkills) && item.activeSkills.length) return item.activeSkills;
  return candidatePoolSkillFields()
    .filter(([field]) => item[field])
    .map(([, label]) => label);
}

function renderCandidatePoolFilters() {
  const select = $('#candidatePoolClientFilter');
  if (!select) return;

  const selected = state.candidatePoolFilter.clientId || select.value;
  const clientIds = new Set(state.candidatePool.map((item) => item.clientId).filter(Boolean));
  const options = [
    { value: '', label: 'Todos' },
    ...state.clients
      .filter((client) => clientIds.has(client.id))
      .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
      .map((client) => ({ value: client.id, label: client.customerName }))
  ];

  select.innerHTML = options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('');
  select.value = options.some((option) => option.value === selected) ? selected : '';
  state.candidatePoolFilter.clientId = select.value;
}

function getFilteredCandidatePool() {
  const clientId = state.candidatePoolFilter.clientId || '';
  if (!clientId) return state.candidatePool;
  return state.candidatePool.filter((item) => item.clientId === clientId);
}

function renderCandidatePool() {
  const countElement = $('#candidatePoolCount');
  const table = $('#candidatePoolTable');
  if (!countElement || !table) return;

  const rows = getFilteredCandidatePool()
    .slice()
    .sort((first, second) => {
      const firstClient = first.clientName || state.clients.find((client) => client.id === first.clientId)?.customerName || '';
      const secondClient = second.clientName || state.clients.find((client) => client.id === second.clientId)?.customerName || '';
      return firstClient.localeCompare(secondClient, 'pt-BR', { sensitivity: 'base' })
        || first.candidateName.localeCompare(second.candidateName, 'pt-BR', { sensitivity: 'base' });
    });

  countElement.textContent = rows.length;
  table.innerHTML = rows.length
    ? rows.map((item) => {
      const client = state.clients.find((clientItem) => clientItem.id === item.clientId);
      const skills = candidatePoolSkills(item);
      return `
        <tr class="clickable-row" data-edit-candidate-pool="${escapeHtml(item.id)}">
          <td>${escapeHtml(item.clientName || client?.customerName || '-')}</td>
          <td><strong>${renderBlackflagName(item.candidateName, item)}</strong></td>
          <td>${escapeHtml(item.profile || '-')}</td>
          <td>${formatCurrency(item.hourlyRate)}</td>
          <td>${item.agreementDate ? new Date(`${item.agreementDate}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
          <td>${item.active ? 'Sim' : 'Não'}</td>
          <td>${skills.length ? escapeHtml(skills.join(', ')) : '-'}</td>
          <td>${renderCurriculumObservationsButton(item)}</td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="8">Nenhum candidato encontrado para o filtro informado.</td></tr>';
}

function renderCandidateFilters() {
  const typeSelect = $('#candidateFilterType');
  const valueSelect = $('#candidateFilterValue');
  if (!typeSelect || !valueSelect) return;

  const type = typeSelect.value;
  const selected = valueSelect.value;
  let options = [{ value: '', label: 'Todos' }];

  if (type === 'opportunity') {
    options = options.concat(
      state.opportunities
        .slice()
        .sort(byOpportunityCode)
        .map((opportunity) => ({
          value: opportunity.id,
          label: opportunityLabel(opportunity)
        }))
    );
  }

  if (type === 'consultor') {
    options = options.concat(
      state.candidates
        .slice()
        .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR', { sensitivity: 'base' }))
        .map((candidate) => ({
          value: candidate.id,
          label: candidate.name
        }))
    );
  }

  valueSelect.disabled = !type;
  valueSelect.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join('');
  valueSelect.value = options.some((option) => option.value === selected) ? selected : '';
}

function allocatedCodeFromCandidate(candidate) {
  const source = candidate.curriculumControlId || candidate.opportunityCode || candidate.id || candidate.name || 'alocado';
  return String(source)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .toUpperCase();
}

function getFilteredCandidates() {
  const type = $('#candidateFilterType')?.value;
  const value = $('#candidateFilterValue')?.value;
  if (!type || !value) return state.candidates;

  if (type === 'opportunity') {
    return state.candidates.filter((candidate) => candidate.opportunityId === value);
  }

  if (type === 'consultor') {
    return state.candidates.filter((candidate) => candidate.id === value);
  }

  return state.candidates;
}

function renderCandidates() {
  const candidates = getFilteredCandidates();
  $('#candidateCount').textContent = candidates.length;
  $('#candidateTable').innerHTML = candidates
    .map(
      (candidate) => {
        const opportunity = state.opportunities.find((item) => item.id === candidate.opportunityId);
        return `
        <tr class="clickable-row" data-edit-candidate="${candidate.id}">
          <td><strong>${renderBlackflagName(candidate.name, candidate)}</strong></td>
          <td>${candidate.curriculumControlId || candidate.curriculumId || '-'}</td>
          <td>${candidate.opportunityName || opportunity?.opportunity || '-'}</td>
          <td>${candidate.opportunityCode || opportunity?.opportunityCode || '-'}</td>
          <td><span class="tag">${candidate.stage || 'Triagem'}</span></td>
          <td><span class="score">${candidate.aderencia ?? 0}%</span></td>
          <td>${formatCurrency(candidate.hourlyRate)}</td>
          <td>${candidate.observation || '-'}</td>
          <td>${candidate.approved ? 'Sim' : 'Não'}</td>
          <td>
            <div class="stage-actions">
              ${renderCurriculumObservationsButton(candidate)}
              <button class="primary-action compact-action" type="button" data-select-candidate="${candidate.id}">Selecionado</button>
              ${renderCandidateStageActions(candidate)}
            </div>
          </td>
        </tr>
      `;
      }
    )
    .join('');
}

function getFilteredSelectedCandidates() {
  const type = state.selectedCandidateFilter.type || $('#selectedCandidateFilterType')?.value || '';
  const value = state.selectedCandidateFilter.value
    || $('#selectedCandidateFilterClientValue')?.value
    || $('#selectedCandidateFilterOpportunityValue')?.value
    || $('#selectedCandidateFilterValue')?.value
    || '';
  const normalizedValue = normalizeText(value);

  return state.selectedCandidates.filter((candidate) => {
    if (!type || !value) return true;

    const opportunity = state.opportunities.find((item) => item.id === candidate.opportunityId);
    const client = state.clients.find((item) => item.id === opportunity?.clientId);

    if (type === 'name') {
      return normalizeText(candidate.name).includes(normalizedValue);
    }

    if (type === 'client') {
      return client?.id === value;
    }

    if (type === 'opportunity') {
      return candidate.opportunityId === value;
    }

    return true;
  });
}

function selectedCandidateFilterForOpportunity(opportunityId) {
  return {
    type: 'opportunity',
    value: opportunityId || ''
  };
}

function uniqueOpportunityIdFromSelectedCandidates(candidates) {
  const ids = new Set(candidates.map((candidate) => candidate.opportunityId).filter(Boolean));
  return ids.size === 1 ? [...ids][0] : '';
}

function renderSelectedCandidates() {
  const typeSelect = $('#selectedCandidateFilterType');
  const valueInput = $('#selectedCandidateFilterValue');
  const clientSelect = $('#selectedCandidateFilterClientValue');
  const opportunitySelect = $('#selectedCandidateFilterOpportunityValue');
  const form = $('#selectedCandidateMessageForm');
  const table = $('#selectedCandidateTable');
  const count = $('#selectedCandidateCount');
  if (!typeSelect || !valueInput || !clientSelect || !opportunitySelect || !table || !count) return;

  const type = state.selectedCandidateFilter.type || '';
  typeSelect.value = type;
  const clientOptions = '<option value="">Todos</option>' + state.clients
    .slice()
    .sort((first, second) => String(first.customerName || '').localeCompare(String(second.customerName || ''), 'pt-BR', { sensitivity: 'base' }))
    .map((client) => `<option value="${client.id}">${escapeHtml(client.customerName || client.id)}</option>`)
    .join('');
  clientSelect.innerHTML = clientOptions;
  const opportunityOptions = '<option value="">Todos</option>' + state.opportunities
    .slice()
    .sort(byOpportunityCode)
    .map((opportunity) => `<option value="${opportunity.id}">${escapeHtml(opportunityLabel(opportunity))}</option>`)
    .join('');
  opportunitySelect.innerHTML = opportunityOptions;

  const isClientFilter = type === 'client';
  const isOpportunityFilter = type === 'opportunity';
  valueInput.classList.toggle('hidden', isClientFilter || isOpportunityFilter);
  clientSelect.classList.toggle('hidden', !isClientFilter);
  opportunitySelect.classList.toggle('hidden', !isOpportunityFilter);
  valueInput.disabled = !type || isClientFilter || isOpportunityFilter;
  clientSelect.disabled = !isClientFilter;
  opportunitySelect.disabled = !isOpportunityFilter;
  valueInput.placeholder = type ? 'Digite para filtrar' : 'Todos';
  valueInput.value = type && !isClientFilter && !isOpportunityFilter ? state.selectedCandidateFilter.value : '';
  clientSelect.value = isClientFilter ? state.selectedCandidateFilter.value : '';
  opportunitySelect.value = isOpportunityFilter ? state.selectedCandidateFilter.value : '';

  const candidates = getFilteredSelectedCandidates();
  count.textContent = candidates.length;
  if (form) {
    form.elements.candidateMessage.value = candidates[0]?.candidateMessage || '';
  }

  if (!candidates.length) {
    table.innerHTML = '<tr><td colspan="11">Nenhum candidato selecionado encontrado para o filtro informado.</td></tr>';
    return;
  }

  table.innerHTML = candidates
    .map((candidate) => `
      <tr>
        <td><input type="checkbox" data-send-selected-candidate="${candidate.id}" aria-label="Selecionar para envio" /></td>
        <td><strong>${renderBlackflagName(candidate.name, candidate)}</strong></td>
        <td>${candidate.source || 'APINFO'}</td>
        <td>${candidateLinkHtml(candidate)}</td>
        <td>${candidate.score ?? 0}</td>
        <td>${candidate.opportunityCode || '-'}<br>${candidate.opportunityName || '-'}</td>
        <td>${candidate.origin || '-'}</td>
        <td>${candidate.candidateMessage || '-'}</td>
        <td>${candidate.observation || '-'}</td>
        <td>${candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
        <td>
          <div class="stage-actions">
            ${renderCurriculumObservationsButton(candidate)}
            <button class="primary-action compact-action" type="button" data-advance-selected-candidate="${candidate.id}">Avançar</button>
            <button class="ghost-action" type="button" data-delete-selected-candidate="${candidate.id}" aria-label="Excluir candidato selecionado">Excluir</button>
          </div>
        </td>
      </tr>
    `)
    .join('');
}

function renderUsers() {
  $('#userCount').textContent = state.users.length;
  $('#userTable').innerHTML = state.users
    .map(
      (user) => `
        <tr class="clickable-row" data-edit-user="${user.id}">
          <td><strong>${user.name}</strong></td>
          <td>${user.email}</td>
          <td>${user.role}</td>
          <td>${user.mustChangePassword ? 'Sim' : 'Não'}</td>
        </tr>
      `
    )
    .join('');
}

function stageIndex(stage) {
  return state.stages.indexOf(stage);
}

function renderCandidateStageActions(candidate) {
  const current = stageIndex(candidate.stage);
  const previous = state.stages[current - 1];
  const next = state.stages[current + 1];
  if (!previous && !next) return '';

  return `
    <div class="stage-actions">
      <button class="ghost-action" type="button" data-open-candidate-stage-move="${candidate.id}">Mover</button>
    </div>
  `;
}

function render() {
  renderOptions();
  renderDashboardFilters();
  renderFaturamentoChart();
  renderMetrics();
  renderBars('stageBars', getDashboardCandidatesByStage(), 'candidateStage');
  renderBars('statusBars', getDashboardOpportunitiesByStatus(), 'opportunityStatus');
  renderAllocatedPie();
  renderAverageTable();
  renderClients();
  renderContactClients();
  renderFaturamento();
  renderOpportunityFilters();
  renderOpportunities();
  renderHuntingFilters();
  renderHuntings();
  renderCvFilters();
  renderCvSearchResults();
  renderCurriculums();
  renderCandidateFilters();
  renderCandidates();
  renderSelectedCandidates();
  renderAllocatedFilters();
  renderAllocateds();
  renderRateCardFilters();
  renderRateCards();
  renderCandidatePoolFilters();
  renderCandidatePool();
  renderUsers();
}

function setNavGroupOpen(groupId, open) {
  const group = $(`[data-nav-group="${groupId}"]`);
  const toggle = $(`[data-nav-toggle="${groupId}"]`);
  const submenu = $(`[data-nav-submenu="${groupId}"]`);
  if (!group || !toggle || !submenu) return;

  group.classList.toggle('open', open);
  toggle.classList.toggle('active', open && $$('.nav-item.active', submenu).length > 0);
  toggle.setAttribute('aria-expanded', String(open));
  submenu.hidden = !open;
}

function syncNavGroups(viewId) {
  $$('[data-nav-group]').forEach((group) => {
    const groupId = group.dataset.navGroup;
    const hasActiveView = Boolean($(`.nav-item[data-view="${viewId}"]`, group));
    setNavGroupOpen(groupId, hasActiveView || group.classList.contains('open'));
  });
}

function showView(viewId) {
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === viewId));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewId));
  syncNavGroups(viewId);
  $('#viewTitle').textContent = viewTitles[viewId] || 'Gestão do Negócio Alcateia';
}

function setSubmitLabel(form, label) {
  const button = $('button[type="submit"]', form);
  if (button) button.textContent = label;
}

function setSubmitButtonBusy(button, busyLabel) {
  if (!button) return '';
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  button.setAttribute('aria-busy', 'true');
  return originalText;
}

function restoreSubmitButton(button, label) {
  if (!button) return;
  button.disabled = false;
  button.textContent = label;
  button.removeAttribute('aria-busy');
}

function setFieldValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (!field) return;

  if (field.type === 'checkbox') {
    field.checked = Boolean(value);
    return;
  }

  field.value = value ?? '';
}

function fillForm(selector, values, submitLabel) {
  const form = $(selector);

  if (!form) {
    toast(`Formulario nao encontrado: ${selector}`);
    return;
  }

  Object.entries(values).forEach(([name, value]) => setFieldValue(form, name, value));
  setSubmitLabel(form, submitLabel);

  if (!form.closest('.modal-backdrop')) {
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function clearEditing(form, key, submitLabel) {
  if (key) {
    state.editing[key] = '';
  }

  if (form) {
    form.reset();
    setSubmitLabel(form, submitLabel);
  }
}

function loadClientForEdit(client) {
  state.editing.clientId = client.id;
  state.editing.contactClientId = '';
  fillForm('#clientForm', {
    customerName: client.customerName,
    primaryContactName: client.primaryContactName,
    primaryContactEmail: client.primaryContactEmail,
    primaryContactPhone: client.primaryContactPhone,
    observation: client.observation
  }, 'Atualizar cliente');
  closeContactClientModal();
  renderContactClients();
  toast('Cliente carregado para atualização.');
}

function loadContactClientForEdit(contact) {
  openContactClientModal(contact);
  toast('Contato carregado para atualização.');
}

function loadFaturamentoForEdit(item) {
  state.editing.faturamentoId = item.id;
  fillForm('#faturamentoForm', {
    monthYear: item.monthYear,
    forecast: item.forecast,
    realized: item.realized,
    accumulatedGrowth: item.accumulatedGrowth,
    accumulatedRealized: item.accumulatedRealized
  }, 'Atualizar faturamento');
  toast('Faturamento carregado para atualização.');
}

function loadOpportunityForEdit(opportunity) {
  state.editing.opportunityId = opportunity.id;
  fillForm('#opportunityForm', {
    opportunity: opportunity.opportunity,
    opportunityCode: opportunity.opportunityCode,
    clientId: opportunity.clientId,
    contactClientId: opportunity.contactClientId || '',
    status: opportunity.status,
    openingDate: opportunity.openingDate,
    closingDate: opportunity.closingDate,
    model: opportunity.model,
    owner: opportunity.owner,
    quantity: opportunity.quantity,
    closedQuantity: opportunity.closedQuantity,
    contractValue: opportunity.contractValue,
    observation: opportunity.observation
  }, 'Atualizar oportunidade');
  updateOpportunityContactOptions(opportunity.contactClientId || '');
  toast('Oportunidade carregada para atualização.');
}

async function loadCvFilterForEdit(filter, options = {}) {
  state.editing.cvFilterId = filter.id;
  fillForm('#cvFilterForm', {
    opportunityId: filter.opportunityId,
    jobDescription: filter.jobDescription,
    mandatorySkills: filter.mandatorySkills,
    searchApinfo: filter.searchApinfo,
    searchLinkedin: filter.searchLinkedin,
    searchAlcateia: filter.searchAlcateia,
    state: filter.state,
    englishLevel: filter.englishLevel,
    matchPercent: filter.matchPercent,
    resultLimit: filter.resultLimit ?? 10
  }, 'Atualizar filtro');
  await populateCityOptions(filter.state, filter.city);
  renderCvSearchResults();
  if (!options.silent) {
    toast('Filtro de CV carregado para atualização.');
  }
}

function loadCandidateForEdit(candidate) {
  const curriculum = findCurriculumForCandidate(candidate);
  const curriculumId = curriculumIdentifier(curriculum) || candidate.curriculumId || '';
  state.editing.candidateId = candidate.id;
  fillForm('#candidateForm', {
    name: candidate.name,
    curriculumDisplay: candidateCurriculumDisplay(curriculum, candidate.curriculumControlId || candidate.curriculumId),
    curriculumId,
    opportunityId: candidate.opportunityId,
    stage: candidate.stage,
    aderencia: candidate.aderencia,
    hourlyRate: candidate.hourlyRate,
    observation: candidate.observation,
    approved: candidate.approved
  }, 'Atualizar candidato');
  const observationsButton = $('#candidateFormObservationsButton');
  if (observationsButton) {
    observationsButton.disabled = !curriculumId;
    observationsButton.dataset.openCurriculumObservations = curriculumId;
    observationsButton.textContent = curriculumId && curriculumObservationCount(curriculumId)
      ? `Observações (${curriculumObservationCount(curriculumId)})`
      : 'Observações';
  }
  toast('Candidato carregado para atualização.');
}

function loadAllocatedForEdit(allocated) {
  state.editing.allocatedId = allocated.id;
  fillForm('#allocatedForm', {
    externalId: allocated.externalId,
    code: allocated.code,
    consultant: allocated.consultant,
    skill: allocated.skill,
    clientId: allocated.clientId,
    hourlyRate: allocated.hourlyRate,
    saleHourlyRate: allocated.saleHourlyRate,
    monthlyHours: allocated.monthlyHours,
    phone: allocated.phone,
    consultantEmail: allocated.consultantEmail,
    startDate: allocated.startDate,
    active: allocated.active,
    endDate: allocated.endDate,
    manager: allocated.manager,
    managerEmail: allocated.managerEmail,
    managerPhone: allocated.managerPhone
  }, 'Atualizar alocado');
  toast('Alocado carregado para atualização.');
}

function loadRateCardForEdit(rateCard) {
  state.editing.rateCardId = rateCard.id;
  fillForm('#rateCardForm', {
    skill: rateCard.skill,
    rate: rateCard.rate,
    maximum: rateCard.maximum,
    active: rateCard.active,
    clientId: rateCard.clientId
  }, 'Atualizar Rate Card');
  syncRateCardMaximum();
  toast('Rate Card carregado para atualização.');
}

function loadCandidatePoolForEdit(item) {
  state.editing.candidatePoolId = item.id;
  const values = {
    clientId: item.clientId,
    candidateName: item.candidateName,
    profile: item.profile,
    hourlyRate: item.hourlyRate,
    agreementDate: item.agreementDate,
    active: item.active
  };
  for (const [field] of candidatePoolSkillFields()) {
    values[field] = Boolean(item[field]);
  }
  fillForm('#candidatePoolForm', values, 'Atualizar candidato');
  toast('Candidato do bolsão carregado para atualização.');
}

function loadHuntingForEdit(opportunity, candidate = null) {
  state.editing.huntingId = opportunity.id;
  fillForm('#huntingForm', {
    candidateId: candidate?.id || '',
    candidateName: candidate?.name || '',
    profile: opportunity.opportunity,
    startDate: opportunity.openingDate,
    clientId: opportunity.clientId,
    salary: candidate?.hourlyRate ?? 0,
    revenue: opportunity.contractValue,
    tax: candidate?.huntingTax || '',
    source: candidate?.source || opportunity.source || ''
  }, 'Atualizar hunting');
  toast('Hunting carregado para atualização.');
}

function closeCandidateSelectModal() {
  const modal = $('#candidateSelectModal');
  const form = $('#candidateSelectForm');
  state.editing.selectingCandidateId = '';
  if (modal) closeSurfaceDialog(modal);
  form?.reset();
}

function openCandidateSelectModal(candidate) {
  const modal = $('#candidateSelectModal');
  const form = $('#candidateSelectForm');
  if (!modal || !form) return;

  const curriculum = state.curriculums.find((item) => item.id === candidate.curriculumId || item.id_controle === candidate.curriculumId);
  const opportunity = state.opportunities.find((item) => item.id === candidate.opportunityId);
  state.editing.selectingCandidateId = candidate.id;
  $('#candidateSelectSummary').textContent = `Candidato: ${candidate.name}. Complete os campos para criar o alocado.`;
  fillForm('#candidateSelectForm', {
    externalId: '',
    code: allocatedCodeFromCandidate(candidate),
    consultant: candidate.name,
    skill: curriculum?.skills || candidate.observation,
    clientId: opportunity?.clientId || '',
    hourlyRate: candidate.hourlyRate,
    phone: curriculum?.telefone || '',
    consultantEmail: curriculum?.email || '',
    startDate: new Date().toISOString().slice(0, 10),
    active: true,
    endDate: '',
    manager: '',
    managerEmail: '',
    managerPhone: ''
  }, 'Criar alocado');
  modal.classList.remove('hidden');
}

function candidateStageMoveOptions(candidate) {
  const current = stageIndex(candidate.stage);
  return {
    previous: state.stages[current - 1] || '',
    next: state.stages[current + 1] || ''
  };
}

function ensureCandidateStageMoveModal() {
  let modal = $('#candidateStageMoveModal');
  if (modal) return modal;

  modal = document.createElement('section');
  modal.id = 'candidateStageMoveModal';
  modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'candidateStageMoveTitle');
  modal.innerHTML = `
    <div class="modal-card candidate-stage-move-card">
      <div class="modal-heading">
        <div>
          <h2 id="candidateStageMoveTitle">Mover candidato</h2>
          <span id="candidateStageMoveSummary"></span>
        </div>
        <button class="ghost-action" type="button" data-close-candidate-stage-move aria-label="Fechar">×</button>
      </div>
      <div class="candidate-stage-move-actions">
        <button class="ghost-action" type="button" data-candidate-stage-direction="previous"></button>
        <button class="primary-action compact-action" type="button" data-candidate-stage-direction="next"></button>
        <button class="ghost-action" type="button" data-close-candidate-stage-move>Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  initPanelMaximizeControls();
  return modal;
}

function closeCandidateStageMoveModal() {
  state.editing.movingCandidateId = '';
  closeSurfaceDialog('#candidateStageMoveModal');
}

function openCandidateStageMoveModal(candidate) {
  const modal = ensureCandidateStageMoveModal();
  const summary = $('#candidateStageMoveSummary', modal);
  const previousButton = $('[data-candidate-stage-direction="previous"]', modal);
  const nextButton = $('[data-candidate-stage-direction="next"]', modal);
  const { previous, next } = candidateStageMoveOptions(candidate);

  state.editing.movingCandidateId = candidate.id;
  if (summary) {
    summary.textContent = `${candidate.name || 'Candidato'} está em ${candidate.stage || '-'}.`;
  }

  if (previousButton) {
    previousButton.hidden = !previous;
    previousButton.textContent = previous ? `Voltar para ${previous}` : '';
    previousButton.dataset.stage = previous;
  }

  if (nextButton) {
    nextButton.hidden = !next;
    nextButton.textContent = next ? `Avançar para ${next}` : '';
    nextButton.dataset.stage = next;
  }

  modal.classList.remove('hidden');
}

async function moveCandidateToStage(candidateId, stage) {
  if (!candidateId || !stage) return;

  const savedCandidate = await api(`/api/candidates/${candidateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ stage })
  });
  upsertStateItem('candidates', savedCandidate);
  closeCandidateStageMoveModal();
  toast(`Candidato movido para ${stage}.`);
  render();
}

function loadUserForEdit(user) {
  state.editing.userId = user.id;
  fillForm('#userForm', {
    name: user.name,
    email: user.email,
    role: user.role
  }, 'Atualizar usuário');
  toast('Usuário carregado para atualização.');
}

function getSurfaceMaximizeButton(surface) {
  return $('[data-panel-maximize]', surface);
}

function getSurfaceMinimizeButton(surface) {
  return $('[data-panel-minimize]', surface);
}

function updateSurfaceMaximizeButton(surface, isMaximized) {
  const button = getSurfaceMaximizeButton(surface);
  if (!button) return;
  button.textContent = '';
  button.dataset.windowState = isMaximized ? 'restore' : 'maximize';
  button.title = isMaximized ? 'Restaurar' : 'Maximizar';
  button.setAttribute('aria-label', isMaximized ? 'Restaurar painel' : 'Maximizar painel');
}

function updateSurfaceMinimizeButton(surface, isMinimized) {
  const button = getSurfaceMinimizeButton(surface);
  if (!button) return;
  button.textContent = '';
  button.dataset.windowState = isMinimized ? 'open' : 'minimize';
  button.title = isMinimized ? 'Abrir' : 'Minimizar';
  button.setAttribute('aria-label', isMinimized ? 'Abrir painel' : 'Minimizar painel');
}

function setSurfaceMinimized(surface, isMinimized) {
  if (!surface) return;
  if (isMinimized) {
    surface.classList.remove('panel-maximized');
    updateSurfaceMaximizeButton(surface, false);
  }
  surface.classList.toggle('surface-minimized', isMinimized);
  updateSurfaceMinimizeButton(surface, isMinimized);
  document.body.classList.toggle('panel-is-maximized', Boolean($('.panel-maximized')));
}

function setSurfaceMaximized(surface, isMaximized) {
  if (!surface) return;
  if (isMaximized) {
    surface.classList.remove('surface-minimized');
    updateSurfaceMinimizeButton(surface, false);
  }
  surface.classList.toggle('panel-maximized', isMaximized);
  updateSurfaceMaximizeButton(surface, isMaximized);
  document.body.classList.toggle('panel-is-maximized', Boolean($('.panel-maximized')));
}

function closeSurfaceDialog(dialogOrSelector) {
  const dialog = typeof dialogOrSelector === 'string' ? $(dialogOrSelector) : dialogOrSelector;
  if (!dialog) return;
  $$('.panel-maximized', dialog).forEach((surface) => setSurfaceMaximized(surface, false));
  $$('.surface-minimized', dialog).forEach((surface) => setSurfaceMinimized(surface, false));
  dialog.classList.add('hidden');
  document.body.classList.toggle('panel-is-maximized', Boolean($('.panel-maximized')));
}

function isSurfaceCloseControl(element) {
  if (!element || element.tagName !== 'BUTTON') return false;
  const attributes = Array.from(element.attributes || []);
  return element.id === 'closeCandidateSelectModal'
    || element.getAttribute('aria-label') === 'Fechar'
    || attributes.some((attribute) => attribute.name.startsWith('data-close-') || attribute.name === 'data-surface-collapse-close');
}

function surfaceHeadingActions(heading) {
  let actions = Array.from(heading.children)
    .find((child) => child.classList?.contains('surface-heading-actions'));
  if (actions) return actions;

  actions = document.createElement('div');
  actions.className = 'surface-heading-actions';
  heading.append(actions);
  return actions;
}

function standardizeSurfaceCloseButton(surface, heading, actions) {
  const isModalSurface = surface.classList.contains('modal-panel') || surface.classList.contains('modal-card');

  const closeButton = Array.from(heading.querySelectorAll('button')).find(isSurfaceCloseControl);
  if (!closeButton) return;

  closeButton.classList.remove('ghost-action', 'primary-action');
  closeButton.classList.add('surface-window-control', 'surface-close-button');
  closeButton.textContent = '';
  closeButton.title = isModalSurface ? 'Fechar' : 'Recolher';
  closeButton.setAttribute('aria-label', isModalSurface ? 'Fechar painel' : 'Recolher painel');
  actions.append(closeButton);
}

function initPanelMaximizeControls() {
  $$('.panel, .modal-panel, .modal-card').forEach((surface) => {
    const heading = $('.panel-heading, .modal-heading', surface);
    if (!heading) return;

    const actions = surfaceHeadingActions(heading);
    actions.classList.add('surface-window-actions');

    let minimizeButton = getSurfaceMinimizeButton(surface);
    if (!minimizeButton) {
      minimizeButton = document.createElement('button');
      minimizeButton.className = 'surface-window-control surface-minimize-button';
      minimizeButton.type = 'button';
      minimizeButton.dataset.panelMinimize = 'true';
      minimizeButton.addEventListener('click', () => {
        setSurfaceMinimized(surface, !surface.classList.contains('surface-minimized'));
      });
    }

    let button = getSurfaceMaximizeButton(surface);
    if (!button) {
      button = document.createElement('button');
      button.className = 'surface-window-control panel-maximize-button';
      button.type = 'button';
      button.dataset.panelMaximize = 'true';
      button.addEventListener('click', () => {
        const shouldMaximize = !surface.classList.contains('panel-maximized');
        $$('.panel-maximized')
          .filter((item) => item !== surface)
          .forEach((item) => setSurfaceMaximized(item, false));
        setSurfaceMaximized(surface, shouldMaximize);
      });
    }

    button.classList.remove('ghost-action', 'primary-action');
    button.classList.add('surface-window-control', 'panel-maximize-button');

    const isModalSurface = surface.classList.contains('modal-panel') || surface.classList.contains('modal-card');
    let closeButton = Array.from(heading.querySelectorAll('button')).find(isSurfaceCloseControl);
    if (!closeButton && !isModalSurface) {
      closeButton = document.createElement('button');
      closeButton.className = 'surface-window-control surface-close-button';
      closeButton.type = 'button';
      closeButton.dataset.surfaceCollapseClose = 'true';
      closeButton.addEventListener('click', () => setSurfaceMinimized(surface, true));
      heading.append(closeButton);
    }

    actions.append(minimizeButton);
    actions.append(button);
    updateSurfaceMaximizeButton(surface, surface.classList.contains('panel-maximized'));
    updateSurfaceMinimizeButton(surface, surface.classList.contains('surface-minimized'));
    standardizeSurfaceCloseButton(surface, heading, actions);
  });
}

function initSurfaceControlsObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => Array.from(mutation.addedNodes || []).some((node) => (
      node.nodeType === Node.ELEMENT_NODE
      && (
        node.matches?.('.panel, .modal-panel, .modal-card')
        || node.querySelector?.('.panel, .modal-panel, .modal-card')
      )
    )))) {
      return;
    }

    initPanelMaximizeControls();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function bindNavigation() {
  $$('[data-nav-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const groupId = button.dataset.navToggle;
      const submenu = $(`[data-nav-submenu="${groupId}"]`);
      setNavGroupOpen(groupId, submenu?.hidden ?? true);
    });
  });

  $$('.nav-item').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });
}

async function getCitiesForUf(uf) {
  if (!uf) return [];

  try {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    if (!response.ok) throw new Error('IBGE indisponível');
    const cities = await response.json();
    return cities.map((city) => city.nome).filter(Boolean);
  } catch {
    return fallbackCitiesByUf[uf] ?? [];
  }
}

async function populateCityOptions(uf, selectedCity = '') {
  const citySelect = $('#cvFilterForm select[name="city"]');
  if (!citySelect) return;

  if (!uf) {
    citySelect.disabled = false;
    delete citySelect.dataset.loading;
    citySelect.innerHTML = '<option value="">Todas</option>';
    return;
  }

  citySelect.disabled = true;
  citySelect.dataset.loading = 'true';
  citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
  const cities = await getCitiesForUf(uf);
  const options = cities.includes(selectedCity) || !selectedCity ? cities : [selectedCity, ...cities];
  citySelect.innerHTML = '<option value="">Todas</option>' + options.map((city) => `<option value="${city}">${city}</option>`).join('');
  citySelect.value = selectedCity && options.includes(selectedCity) ? selectedCity : '';
  citySelect.disabled = false;
  delete citySelect.dataset.loading;
}

function bindForms() {
  $('#clientForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const editingId = state.editing.clientId;

    try {
      if (submitButton) submitButton.disabled = true;
      const savedClient = await api(editingId ? `/api/clients/${editingId}` : '/api/clients', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(formPayload(form))
      });
      upsertStateItem('clients', savedClient);
      clearEditing(form, 'clientId', 'Salvar cliente');
      toast(editingId ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o cliente.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $('#contactClientForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const client = selectedClientForContacts();
    if (!client) {
      toast('Selecione um cliente antes de cadastrar contatos.');
      return;
    }

    const editingId = state.editing.contactClientId;
    const payload = {
      ...formPayload(event.currentTarget),
      clientId: client.id
    };

    try {
      const savedContact = await api(editingId ? `/api/contact-clients/${editingId}` : '/api/contact-clients', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('contactClients', savedContact);
      clearEditing(event.currentTarget, 'contactClientId', 'Cadastrar contato');
      state.editing.clientId = client.id;
      closeContactClientModal();
      toast(editingId ? 'Contato atualizado.' : 'Contato cadastrado.');
      state.editing.clientId = client.id;
      renderContactClients();
      renderContactClientListModal();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o contato.');
    }
  });

  $('#addContactFromListButton')?.addEventListener('click', () => {
    closeContactClientListModal();
    openContactClientModal();
  });

  $('#closeContactClientListModal')?.addEventListener('click', closeContactClientListModal);
  $('#contactClientListModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'contactClientListModal') {
      closeContactClientListModal();
    }
  });

  $('#closeContactClientModal')?.addEventListener('click', closeContactClientModal);
  $('#contactClientModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'contactClientModal') {
      closeContactClientModal();
    }
  });

  $('#faturamentoForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const editingId = state.editing.faturamentoId;
    const payload = formPayload(form);

    if (!String(payload.monthYear || '').trim()) {
      toast('Informe o mês/ano do faturamento.');
      return;
    }

    const originalText = setSubmitButtonBusy(submitButton, editingId ? 'Atualizando...' : 'Salvando...');
    try {
      const savedFaturamento = await api(editingId ? `/api/faturamento/${encodeURIComponent(editingId)}` : '/api/faturamento', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('faturamento', savedFaturamento);
      clearEditing(form, 'faturamentoId', 'Salvar faturamento');
      toast(editingId ? 'Faturamento atualizado.' : 'Faturamento cadastrado.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o faturamento.');
    } finally {
      restoreSubmitButton(submitButton, state.editing.faturamentoId ? (originalText || 'Atualizar faturamento') : 'Salvar faturamento');
    }
  });

  $('#opportunityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const editingId = state.editing.opportunityId;

    try {
      if (submitButton) submitButton.disabled = true;
      await api(editingId ? `/api/opportunities/${editingId}` : '/api/opportunities', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(formPayload(form))
      });
      clearEditing(form, 'opportunityId', 'Salvar oportunidade');
      toast(editingId ? 'Oportunidade atualizada.' : 'Oportunidade cadastrada.');
      await refresh();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar a oportunidade.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $('#cvFilterForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const cityField = form.elements.city;

    if (cityField?.dataset.loading === 'true') {
      toast('Aguarde carregar as cidades antes de salvar.');
      return;
    }

    const submitButton = $('button[type="submit"]', form);
    if (submitButton) submitButton.disabled = true;

    try {
      const payload = formPayload(form);
      payload.city = cityField?.value ?? payload.city ?? '';
      payload.searchApinfo = form.elements.searchApinfo.checked;
      payload.searchLinkedin = form.elements.searchLinkedin.checked;
      payload.searchAlcateia = form.elements.searchAlcateia.checked;
      const editingId = state.editing.cvFilterId;
      const savedFilter = await api(editingId ? `/api/cv-filters/${editingId}` : '/api/cv-filters', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('cvFilters', savedFilter);
      toast(editingId ? 'Filtro de CV atualizado.' : 'Filtro de CV cadastrado.');
      const currentFilter = state.cvFilters.find((filter) => filter.id === savedFilter.id);
      if (currentFilter) {
        await loadCvFilterForEdit(currentFilter, { silent: true });
      }
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o filtro de CV.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $('#candidateForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const payload = formPayload(form);
    delete payload.curriculumDisplay;
    payload.approved = form.elements.approved.checked;
    const matchedCurriculum = findCurriculumForCandidate({
      name: payload.name,
      curriculumId: payload.curriculumId
    });
    if (!payload.curriculumId && matchedCurriculum) {
      payload.curriculumId = curriculumIdentifier(matchedCurriculum);
      setFieldValue(form, 'curriculumId', payload.curriculumId);
      setFieldValue(form, 'curriculumDisplay', candidateCurriculumDisplay(matchedCurriculum));
    }
    const editingId = state.editing.candidateId;

    if (!String(payload.name || '').trim()) {
      toast('Informe o nome do candidato.');
      return;
    }
    if (!String(payload.opportunityId || '').trim()) {
      toast('Selecione uma oportunidade válida.');
      return;
    }

    try {
      if (submitButton) submitButton.disabled = true;
      const savedCandidate = await api(editingId ? `/api/candidates/${editingId}` : '/api/candidates', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      clearEditing(form, 'candidateId', 'Salvar candidato');
      const observationsButton = $('#candidateFormObservationsButton');
      if (observationsButton) {
        observationsButton.disabled = true;
        observationsButton.textContent = 'Observações';
        delete observationsButton.dataset.openCurriculumObservations;
      }
      if (savedCandidate.placement?.type === 'allocated') {
        toast(savedCandidate.placement.action === 'created' ? 'Candidato aprovado e alocado criado.' : 'Candidato aprovado e alocado atualizado.');
      } else if (savedCandidate.placement?.type === 'hunting') {
        toast('Candidato aprovado e hunting atualizado.');
      } else {
        toast(editingId ? 'Candidato atualizado.' : 'Candidato cadastrado.');
      }
      upsertStateItem('candidates', savedCandidate);
      if (savedCandidate.placement) {
        await refresh();
      } else {
        render();
      }
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o candidato.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $('#allocatedForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const payload = formPayload(form);
    payload.active = form.elements.active.checked;
    const editingId = state.editing.allocatedId;

    if (!String(payload.code || '').trim()) {
      toast('Informe o código do alocado.');
      return;
    }
    if (!String(payload.consultant || '').trim()) {
      toast('Informe o consultor.');
      return;
    }
    if (!String(payload.clientId || '').trim()) {
      toast('Selecione um cliente válido.');
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = editingId ? 'Atualizando...' : 'Salvando...';
      }
      const savedAllocated = await api(editingId ? `/api/allocateds/${encodeURIComponent(editingId)}` : '/api/allocateds', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('allocateds', savedAllocated);
      clearEditing(form, 'allocatedId', 'Salvar alocado');
      if (form.elements.active) form.elements.active.checked = true;
      toast(editingId ? 'Alocado atualizado.' : 'Alocado cadastrado.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o alocado.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = state.editing.allocatedId ? 'Atualizar alocado' : 'Salvar alocado';
      }
    }
  });

  $('#rateCardForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    syncRateCardMaximum(form);
    const payload = formPayload(form);
    payload.active = form.elements.active.checked;
    payload.maximum = rateCardMaximum(payload.rate);
    const editingId = state.editing.rateCardId;

    if (!String(payload.clientId || '').trim()) {
      toast('Selecione um cliente válido.');
      return;
    }
    if (!String(payload.skill || '').trim()) {
      toast('Informe a skill do Rate Card.');
      return;
    }
    if (!Number.isFinite(Number(payload.rate)) || Number(payload.rate) <= 0) {
      toast('Informe uma taxa válida.');
      return;
    }

    const originalText = setSubmitButtonBusy(submitButton, editingId ? 'Atualizando...' : 'Salvando...');
    try {
      const savedRateCard = await api(editingId ? `/api/rate-cards/${encodeURIComponent(editingId)}` : '/api/rate-cards', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('rateCards', savedRateCard);
      clearEditing(form, 'rateCardId', 'Salvar Rate Card');
      syncRateCardMaximum(form);
      toast(editingId ? 'Rate Card atualizado.' : 'Rate Card cadastrado.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o Rate Card.');
    } finally {
      restoreSubmitButton(submitButton, state.editing.rateCardId ? (originalText || 'Atualizar Rate Card') : 'Salvar Rate Card');
    }
  });

  $('#candidatePoolForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const payload = formPayload(form);
    payload.active = form.elements.active.checked;
    for (const [field] of candidatePoolSkillFields()) {
      payload[field] = Boolean(form.elements[field]?.checked);
    }
    const editingId = state.editing.candidatePoolId;

    if (!String(payload.clientId || '').trim()) {
      toast('Selecione um cliente válido.');
      return;
    }
    if (!String(payload.candidateName || '').trim()) {
      toast('Informe o nome do candidato.');
      return;
    }
    if (!String(payload.profile || '').trim()) {
      toast('Selecione um perfil válido.');
      return;
    }

    const originalText = setSubmitButtonBusy(submitButton, editingId ? 'Atualizando...' : 'Salvando...');
    try {
      const savedCandidatePoolItem = await api(editingId ? `/api/candidate-pool/${encodeURIComponent(editingId)}` : '/api/candidate-pool', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('candidatePool', savedCandidatePoolItem);
      clearEditing(form, 'candidatePoolId', 'Salvar candidato');
      if (form.elements.active) form.elements.active.checked = true;
      toast(editingId ? 'Candidato do bolsão atualizado.' : 'Candidato cadastrado no bolsão.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o candidato do bolsão.');
    } finally {
      restoreSubmitButton(submitButton, state.editing.candidatePoolId ? (originalText || 'Atualizar candidato') : 'Salvar candidato');
    }
  });

  $('#opportunityForm select[name="clientId"]')?.addEventListener('change', () => {
    updateOpportunityContactOptions('');
  });

  $('#huntingForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const editingId = state.editing.huntingId;
    const payload = formPayload(form);

    if (!String(payload.candidateName || '').trim()) {
      toast('Informe o candidato do hunting.');
      return;
    }
    if (!String(payload.profile || '').trim()) {
      toast('Informe o perfil do hunting.');
      return;
    }
    if (!String(payload.clientId || '').trim()) {
      toast('Selecione um cliente válido.');
      return;
    }

    const originalText = setSubmitButtonBusy(submitButton, editingId ? 'Atualizando...' : 'Salvando...');
    try {
      const savedHunting = await api(editingId ? `/api/huntings/${encodeURIComponent(editingId)}` : '/api/huntings', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('opportunities', savedHunting.opportunity);
      upsertStateItem('candidates', savedHunting.candidate);
      clearEditing(form, 'huntingId', 'Salvar hunting');
      toast(editingId ? 'Hunting atualizado.' : 'Hunting cadastrado.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o hunting.');
    } finally {
      restoreSubmitButton(submitButton, state.editing.huntingId ? (originalText || 'Atualizar hunting') : 'Salvar hunting');
    }
  });

  $('#candidateSelectForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const candidateId = state.editing.selectingCandidateId;
    if (!candidateId) {
      toast('Selecione um candidato antes de criar o alocado.');
      return;
    }

    if (!form.reportValidity()) return;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Criando alocado...';
    }

    try {
      const payload = formPayload(form);
      payload.active = form.elements.active.checked;
      const selectedCandidate = await api(`/api/candidates/${candidateId}/select`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('candidates', selectedCandidate.candidate);
      upsertStateItem('allocateds', selectedCandidate.allocated);
      closeCandidateSelectModal();
      toast('Candidato aprovado e migrado para alocados.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível criar o alocado.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Criar alocado';
      }
    }
  });

  $('#userForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const editingId = state.editing.userId;
    const payload = formPayload(form);

    if (!String(payload.name || '').trim()) {
      toast('Informe o nome do usuário.');
      return;
    }
    if (!String(payload.email || '').trim()) {
      toast('Informe o e-mail do usuário.');
      return;
    }

    const originalText = setSubmitButtonBusy(submitButton, editingId ? 'Atualizando...' : 'Salvando...');
    try {
      const savedUser = await api(editingId ? `/api/users/${encodeURIComponent(editingId)}` : '/api/users', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('users', savedUser);
      if (state.currentUser?.id === savedUser.id) {
        state.currentUser = savedUser;
        updateSessionUser(savedUser);
      }
      clearEditing(form, 'userId', 'Salvar usuário');
      toast(editingId ? 'Usuário atualizado.' : 'Usuário cadastrado com senha inicial Alcateia123.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o usuário.');
    } finally {
      restoreSubmitButton(submitButton, state.editing.userId ? (originalText || 'Atualizar usuário') : 'Salvar usuário');
    }
  });
}

function bindAuth() {
  const resetToken = passwordResetTokenFromUrl();
  if (resetToken) {
    clearSession();
    showPasswordReset();
  }

  async function handleLogin() {
    document.body.dataset.loginAttempted = 'true';
    const form = $('#loginForm');
    const button = $('#loginButton');
    setAuthMessage('#loginError');
    if (!form.reportValidity()) return;
    if (button?.disabled) return;

    const originalText = setSubmitButtonBusy(button, 'Entrando...');

    try {
      const payload = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify(formPayload(form))
      });

      setSession(payload.token, payload.user);
      form.reset();

      if (payload.user.mustChangePassword) {
        showPasswordChange();
        return;
      }

      await refresh();
    } catch (error) {
      setAuthMessage('#loginError', error.message);
    } finally {
      restoreSubmitButton(button, originalText || 'Entrar');
    }
  }

  $('#loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    handleLogin();
  });

  $('#loginButton').onclick = () => handleLogin();

  $('#loginForm input[name="password"]').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleLogin();
    }
  });

  async function handlePasswordChange() {
    document.body.dataset.passwordChangeAttempted = 'true';
    const form = $('#passwordChangeForm');
    const button = $('#passwordChangeButton');
    setAuthMessage('#passwordChangeError');
    if (!form.reportValidity()) return;
    if (button?.disabled) return;

    const originalText = setSubmitButtonBusy(button, 'Salvando...');

    try {
      const payload = await api('/api/change-password', {
        method: 'POST',
        body: JSON.stringify(formPayload(form))
      });

      updateSessionUser(payload.user);
      form.reset();
      toast('Senha alterada.');
      await refresh();
    } catch (error) {
      setAuthMessage('#passwordChangeError', error.message);
    } finally {
      restoreSubmitButton(button, originalText || 'Salvar nova senha');
    }
  }

  $('#passwordChangeForm').addEventListener('submit', (event) => {
    event.preventDefault();
    handlePasswordChange();
  });

  $('#passwordChangeButton').onclick = () => handlePasswordChange();

  $('#passwordChangeForm input[name="confirmPassword"]').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handlePasswordChange();
    }
  });

  async function handlePasswordRecover() {
    const form = $('#passwordRecoverForm');
    const button = $('#passwordRecoverButton');
    setAuthMessage('#passwordRecoverMessage');
    if (!form.reportValidity()) return;
    if (button?.disabled) return;

    const originalText = setSubmitButtonBusy(button, 'Enviando...');
    try {
      await api('/api/request-password-reset', {
        method: 'POST',
        body: JSON.stringify(formPayload(form))
      });
      form.reset();
      setAuthMessage('#passwordRecoverMessage', 'Se o e-mail estiver cadastrado, enviaremos o link de alteração.');
    } catch (error) {
      setAuthMessage('#passwordRecoverMessage', error.message);
    } finally {
      restoreSubmitButton(button, originalText || 'Enviar link');
    }
  }

  $('#showRecoverPasswordButton')?.addEventListener('click', () => {
    setAuthMessage('#loginError');
    showPasswordRecover();
  });

  $('#backToLoginButton')?.addEventListener('click', () => showLogin());

  $('#passwordRecoverForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlePasswordRecover();
  });

  $('#passwordRecoverButton')?.addEventListener('click', () => handlePasswordRecover());

  async function handlePasswordReset() {
    const form = $('#passwordResetForm');
    const button = $('#passwordResetButton');
    setAuthMessage('#passwordResetError');
    if (!form.reportValidity()) return;
    if (button?.disabled) return;

    const originalText = setSubmitButtonBusy(button, 'Alterando...');
    try {
      await api('/api/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          ...formPayload(form),
          token: resetToken
        })
      });
      form.reset();
      window.history.replaceState({}, document.title, window.location.pathname);
      toast('Senha alterada. Faça login com a nova senha.');
      showLogin();
    } catch (error) {
      setAuthMessage('#passwordResetError', error.message);
    } finally {
      restoreSubmitButton(button, originalText || 'Alterar senha');
    }
  }

  $('#passwordResetForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handlePasswordReset();
  });

  $('#passwordResetButton')?.addEventListener('click', () => handlePasswordReset());

  $('#logoutButton').addEventListener('click', async () => {
    if (session.token) {
      await api('/api/logout', { method: 'POST' }).catch(() => {});
    }
    clearSession();
    showLogin();
  });
}

function bindCandidateStageActions() {
  $('#candidateTable').addEventListener('click', async (event) => {
    const selectButton = event.target.closest('[data-select-candidate]');
    if (selectButton) {
      const candidate = state.candidates.find((item) => item.id === selectButton.dataset.selectCandidate);
      if (!candidate) return;
      if (!window.confirm(`Confirmar ${candidate.name} como selecionado e migrar para Alocados?`)) return;
      openCandidateSelectModal(candidate);
      return;
    }

    const moveButton = event.target.closest('[data-open-candidate-stage-move]');
    if (!moveButton) return;

    const candidate = state.candidates.find((item) => item.id === moveButton.dataset.openCandidateStageMove);
    if (candidate) openCandidateStageMoveModal(candidate);
  });

  $('#closeCandidateSelectModal')?.addEventListener('click', closeCandidateSelectModal);
  $('#candidateSelectModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'candidateSelectModal') {
      closeCandidateSelectModal();
    }
  });

  document.addEventListener('click', async (event) => {
    const closeButton = event.target.closest('[data-close-candidate-stage-move]');
    if (closeButton || event.target.id === 'candidateStageMoveModal') {
      closeCandidateStageMoveModal();
      return;
    }

    const directionButton = event.target.closest('[data-candidate-stage-direction]');
    if (!directionButton) return;

    directionButton.disabled = true;
    try {
      await moveCandidateToStage(state.editing.movingCandidateId, directionButton.dataset.stage);
    } catch (error) {
      toast(error.message || 'Não foi possível mover o candidato.');
    } finally {
      directionButton.disabled = false;
    }
  });
}

function bindCandidateFilters() {
  $('#candidateFilterType')?.addEventListener('change', () => {
    const valueSelect = $('#candidateFilterValue');
    if (valueSelect) valueSelect.value = '';
    renderCandidateFilters();
    renderCandidates();
  });

  $('#candidateFilterValue')?.addEventListener('change', () => {
    renderCandidates();
  });
}

function bindSelectedCandidateFilters() {
  $('#selectedCandidateFilterType')?.addEventListener('change', (event) => {
    state.selectedCandidateFilter = {
      type: event.currentTarget.value,
      value: ''
    };
    renderSelectedCandidates();
  });

  $('#selectedCandidateFilterValue')?.addEventListener('input', (event) => {
    state.selectedCandidateFilter.value = event.currentTarget.value;
    renderSelectedCandidates();
  });

  ['#selectedCandidateFilterClientValue', '#selectedCandidateFilterOpportunityValue'].forEach((selector) => {
    $(selector)?.addEventListener('change', (event) => {
      state.selectedCandidateFilter.value = event.currentTarget.value;
      renderSelectedCandidates();
    });
  });

  $('#selectedCandidateSearchButton')?.addEventListener('click', () => {
    const type = $('#selectedCandidateFilterType')?.value || '';
    state.selectedCandidateFilter.type = type;
    state.selectedCandidateFilter.value = type === 'client'
      ? $('#selectedCandidateFilterClientValue')?.value || ''
      : type === 'opportunity'
        ? $('#selectedCandidateFilterOpportunityValue')?.value || ''
        : $('#selectedCandidateFilterValue')?.value || '';
    renderSelectedCandidates();
  });
}

function bindOpportunityFilters() {
  $('#opportunityFilterType')?.addEventListener('change', (event) => {
    state.opportunityFilter = {
      type: event.currentTarget.value,
      value: '',
      status: state.opportunityFilter.status,
      closingMonth: state.opportunityFilter.closingMonth
    };
    renderOpportunityFilters();
    renderOpportunities();
  });

  $('#opportunityFilterValue')?.addEventListener('input', (event) => {
    state.opportunityFilter.value = event.currentTarget.value;
    renderOpportunities();
  });

  $('#opportunityStatusFilter')?.addEventListener('change', (event) => {
    state.opportunityFilter.status = event.currentTarget.value;
    renderOpportunities();
  });

  $('#opportunityClosingMonthFilter')?.addEventListener('change', (event) => {
    state.opportunityFilter.closingMonth = event.currentTarget.value;
    renderOpportunities();
  });

  $('#opportunitySearchButton')?.addEventListener('click', () => {
    state.opportunityFilter = {
      type: $('#opportunityFilterType')?.value || '',
      value: $('#opportunityFilterValue')?.value || '',
      status: $('#opportunityStatusFilter')?.value || '',
      closingMonth: $('#opportunityClosingMonthFilter')?.value || ''
    };
    renderOpportunities();
  });
}

function bindFaturamentoFilters() {
  $('#faturamentoMonthFilter')?.addEventListener('change', (event) => {
    state.faturamentoFilter.monthYear = event.currentTarget.value;
    renderFaturamento();
  });
}

function bindAllocatedFilters() {
  $('#allocatedFilterType')?.addEventListener('change', (event) => {
    state.allocatedFilter = {
      type: event.currentTarget.value,
      value: '',
      status: state.allocatedFilter.status || ''
    };
    renderAllocatedFilters();
    renderAllocateds();
  });

  $('#allocatedFilterValue')?.addEventListener('change', (event) => {
    state.allocatedFilter.value = event.currentTarget.value;
    renderAllocateds();
  });

  $('#allocatedActiveFilter')?.addEventListener('change', (event) => {
    state.allocatedFilter.status = event.currentTarget.checked ? 'active' : '';
    if (event.currentTarget.checked) {
      const inactiveFilter = $('#allocatedInactiveFilter');
      if (inactiveFilter) inactiveFilter.checked = false;
    }
    renderAllocatedFilters();
    renderAllocateds();
  });

  $('#allocatedInactiveFilter')?.addEventListener('change', (event) => {
    state.allocatedFilter.status = event.currentTarget.checked ? 'inactive' : '';
    if (event.currentTarget.checked) {
      const activeFilter = $('#allocatedActiveFilter');
      if (activeFilter) activeFilter.checked = false;
    }
    renderAllocatedFilters();
    renderAllocateds();
  });

  $('#allocatedSelectAll')?.addEventListener('change', (event) => {
    const visibleAllocateds = getFilteredAllocateds();
    if (event.currentTarget.checked) {
      visibleAllocateds.forEach((allocated) => state.selectedAllocatedIds.add(allocated.id));
    } else {
      visibleAllocateds.forEach((allocated) => state.selectedAllocatedIds.delete(allocated.id));
    }
    renderAllocateds();
  });

  $('#allocatedTable')?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-select-allocated]');
    if (!checkbox) return;
    if (checkbox.checked) {
      state.selectedAllocatedIds.add(checkbox.dataset.selectAllocated);
    } else {
      state.selectedAllocatedIds.delete(checkbox.dataset.selectAllocated);
    }
    updateAllocatedSelectionState(getFilteredAllocateds());
  });

  $('#allocatedCsvButton')?.addEventListener('click', exportAllocatedCsv);
  $('#allocatedDocumentsButton')?.addEventListener('click', (event) => {
    exportAllocatedDocuments(event.currentTarget);
  });
}

function bindRateCardFilters() {
  $('#rateCardClientFilter')?.addEventListener('change', (event) => {
    state.rateCardFilter.clientId = event.currentTarget.value;
    renderRateCards();
  });

  $('#rateCardForm input[name="rate"]')?.addEventListener('input', (event) => {
    syncRateCardMaximum(event.currentTarget.form);
  });
}

function bindCandidatePoolFilters() {
  $('#candidatePoolClientFilter')?.addEventListener('change', (event) => {
    state.candidatePoolFilter.clientId = event.currentTarget.value;
    renderCandidatePool();
  });
}

function bindHuntingFilters() {
  $('#huntingFilterType')?.addEventListener('change', (event) => {
    state.huntingFilter = {
      type: event.currentTarget.value,
      value: ''
    };
    renderHuntingFilters();
    renderHuntings();
  });

  $('#huntingFilterValue')?.addEventListener('change', (event) => {
    state.huntingFilter.value = event.currentTarget.value;
    renderHuntings();
  });

  $('#huntingCsvButton')?.addEventListener('click', exportHuntingCsv);
}

function bindDashboardFilters() {
  $('#metrics')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-dashboard-analytics]');
    if (!card) return;
    event.stopPropagation();
    openDashboardAnalytics(card.dataset.dashboardAnalytics);
  });

  $('#stageBars')?.addEventListener('click', (event) => {
    const bar = event.target.closest('[data-dashboard-analytics]');
    if (!bar) return;
    event.stopPropagation();
    openDashboardAnalytics(bar.dataset.dashboardAnalytics);
  });

  $('#statusBars')?.addEventListener('click', (event) => {
    const bar = event.target.closest('[data-dashboard-analytics]');
    if (!bar) return;
    event.stopPropagation();
    openDashboardAnalytics(bar.dataset.dashboardAnalytics);
  });

  document.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-dashboard-analytics-edit]');
    if (editButton) {
      editDashboardAnalyticsRecord(
        editButton.dataset.dashboardAnalyticsEdit,
        editButton.dataset.dashboardAnalyticsId
      );
      return;
    }

    if (event.target.closest('[data-clear-dashboard-analytics-filters]')) {
      clearDashboardAnalyticsFilters();
      return;
    }

    if (event.target.closest('[data-apply-dashboard-analytics-filters]')) {
      applyDashboardAnalyticsFilters();
      return;
    }

    if (event.target.closest('[data-close-dashboard-analytics]')) {
      closeDashboardAnalytics();
      return;
    }

    if (event.target.id === 'dashboardAnalyticsModal') {
      closeDashboardAnalytics();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDashboardAnalytics();
      closeCurriculumOpportunityModal();
      closeCurriculumBlacklistModal();
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.closest('.dashboard-analytics-filter, .dashboard-analytics-global-filter')) {
      applyDashboardAnalyticsFilters();
    }
  });

  $('#dashboardMonthFilter')?.addEventListener('change', (event) => {
    state.dashboardMonth = event.currentTarget.value;
    renderDashboardFilters();
    renderMetrics();
    renderBars('statusBars', getDashboardOpportunitiesByStatus(), 'opportunityStatus');
    renderBars('stageBars', getDashboardCandidatesByStage(), 'candidateStage');
  });

  $('#dashboardModelFilter')?.addEventListener('change', (event) => {
    state.dashboardModel = event.currentTarget.value;
    renderDashboardFilters();
    renderMetrics();
    renderBars('statusBars', getDashboardOpportunitiesByStatus(), 'opportunityStatus');
    renderBars('stageBars', getDashboardCandidatesByStage(), 'candidateStage');
  });

  $('#faturamentoDashboardChartScroll')?.addEventListener('input', (event) => {
    state.faturamentoChartOffset = Number(event.currentTarget.value || 0);
    renderFaturamentoChart();
  });

  window.addEventListener('resize', () => {
    renderFaturamentoChart();
  });
}

function bindCvFilterLocation() {
  $('#cvFilterForm select[name="state"]')?.addEventListener('change', (event) => {
    populateCityOptions(event.currentTarget.value);
  });
}

function selectedCvSearchRows() {
  const filter = selectedCvFilter();
  if (!filter) return [];

  return $$('[data-select-cv-result]:checked')
    .map((checkbox) => {
      const group = checkbox.dataset.resultGroup;
      const rows = group === 'rejeitado' ? filter.searchRejectedResults : filter.searchResults;
      const result = (rows ?? []).find((item) => item.id === checkbox.dataset.selectCvResult);
      if (!result) return null;
      return {
        ...result,
        origin: group === 'rejeitado' ? 'Rejeitado' : 'Resultado'
      };
    })
    .filter(Boolean);
}

function updateSaveSelectedCandidatesState() {
  const button = $('#saveSelectedCandidatesButton');
  if (!button) return;
  button.disabled = selectedCvSearchRows().length === 0;
}

function currentCvSearchSourcePayload() {
  const form = $('#cvFilterForm');
  return {
    searchApinfo: Boolean(form?.elements.searchApinfo?.checked),
    searchLinkedin: Boolean(form?.elements.searchLinkedin?.checked),
    searchAlcateia: Boolean(form?.elements.searchAlcateia?.checked)
  };
}

function bindCvSearch() {
  $('#cvSearchButton')?.addEventListener('click', async () => {
    const filter = selectedCvFilter();
    if (!filter) {
      toast('Salve ou selecione um filtro antes de buscar candidatos.');
      return;
    }

    const button = $('#cvSearchButton');
    const status = $('#cvSearchStatus');
    const table = $('#cvSearchResultTable');
    const rejectedStatus = $('#cvRejectedStatus');
    const rejectedTable = $('#cvRejectedResultTable');

    Object.assign(filter, currentCvSearchSourcePayload());
    filter.searchResults = [];
    filter.searchRejectedResults = [];
    filter.searchStatus = 'running';
    filter.searchMessage = `Buscando candidatos em ${enabledSourceLabels(filter).join(', ') || 'nenhuma fonte'}...`;

    if (status) status.textContent = filter.searchMessage;

    setCvSearchInlineStatus('Busca de Candidatos em Andamento', 'running');
    if (table) table.innerHTML = '<tr><td colspan="6">Buscando candidatos...</td></tr>';
    if (rejectedStatus) rejectedStatus.textContent = 'Limpando rejeitados da busca anterior';
    if (rejectedTable) rejectedTable.innerHTML = '<tr><td colspan="6">Buscando candidatos...</td></tr>';
    updateSaveSelectedCandidatesState();

    if (button) {
      button.disabled = true;
      button.textContent = 'Buscando...';
    }

    try {
      const updatedFilter = await api(`/api/cv-filters/${filter.id}/search`, {
        method: 'POST',
        body: JSON.stringify(currentCvSearchSourcePayload())
      });
      Object.assign(filter, updatedFilter);
      state.editing.cvFilterId = filter.id;
      renderCvSearchResults();
      toast(updatedFilter.searchMessage || 'Busca concluída.');
    } catch (error) {
      filter.searchStatus = 'error';
      filter.searchMessage = error.message || 'Não foi possível concluir a busca.';
      setCvSearchInlineStatus(filter.searchMessage, 'error');
      renderCvSearchResults();
      toast(filter.searchMessage);
    } finally {
      if (button) {
        button.textContent = 'Buscar Candidatos';
        button.disabled = !selectedCvFilter();
      }
    }
  });

  $('#cvSearchResultTable')?.addEventListener('change', updateSaveSelectedCandidatesState);
  $('#cvRejectedResultTable')?.addEventListener('change', updateSaveSelectedCandidatesState);
}

function bindSaveSelectedCandidates() {
  $('#saveSelectedCandidatesButton')?.addEventListener('click', async () => {
    const filter = selectedCvFilter();
    const candidates = selectedCvSearchRows();

    if (!filter) {
      toast('Selecione um filtro salvo antes de salvar candidatos.');
      return;
    }
    if (!candidates.length) {
      toast('Marque pelo menos um candidato para salvar.');
      return;
    }

    const button = $('#saveSelectedCandidatesButton');
    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando...';
    }

    try {
      const saved = await api('/api/selected-candidates', {
        method: 'POST',
        body: JSON.stringify({
          opportunityId: filter.opportunityId,
          cvFilterId: filter.id,
          candidateMessage: '',
          candidates
        })
      });

      for (const candidate of saved) {
        const index = state.selectedCandidates.findIndex((item) => item.id === candidate.id);
        if (index >= 0) {
          state.selectedCandidates[index] = candidate;
        } else {
          state.selectedCandidates.push(candidate);
        }
      }

      state.selectedCandidateFilter = selectedCandidateFilterForOpportunity(filter.opportunityId);
      renderSelectedCandidates();
      const savedToMongo = saved.filter((candidate) => candidate.savedToMongo).length;

      if (savedToMongo > 0) {
        toast(`${saved.length} candidato(s) salvo(s). ${savedToMongo} também gravado(s) no MongoDB.`);
      } else {
        toast(`${saved.length} candidato(s) salvo(s).`);
      }
    } catch (error) {
      toast(error.message || 'Não foi possível salvar os candidatos selecionados.');
    } finally {
      if (button) {
        button.textContent = 'Salvar Selecionados';
        updateSaveSelectedCandidatesState();
      }
    }
  });
}

function bindSelectedCandidateMessage() {
  $('#selectedCandidateMessageForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const candidates = getFilteredSelectedCandidates();
    const opportunityId = uniqueOpportunityIdFromSelectedCandidates(candidates);
    if (!opportunityId) {
      toast('Filtre uma única oportunidade antes de salvar a mensagem.');
      return;
    }

    const originalText = setSubmitButtonBusy(submitButton, 'Salvando...');
    try {
      const updated = await api('/api/selected-candidates/message', {
        method: 'POST',
        body: JSON.stringify({
          opportunityId,
          candidateMessage: form.elements.candidateMessage.value
        })
      });

      for (const candidate of updated) {
        const index = state.selectedCandidates.findIndex((item) => item.id === candidate.id);
        if (index >= 0) {
          state.selectedCandidates[index] = candidate;
        }
      }

      renderSelectedCandidates();
      toast('Mensagem salva para os candidatos selecionados.');
    } catch (error) {
      toast(error.message || 'Não foi possível salvar a mensagem.');
    } finally {
      restoreSubmitButton(submitButton, originalText || 'Salvar mensagem');
    }
  });
}

function selectedCandidateIdsForSending() {
  return $$('[data-send-selected-candidate]:checked').map((checkbox) => checkbox.dataset.sendSelectedCandidate);
}

function openNextWhatsappLink() {
  const next = state.whatsappQueue.shift();
  if (!next) return false;

  window.open(next.url, '_blank', 'noopener');
  const button = $('#openSelectedCandidateWhatsappButton');
  if (button) {
    button.textContent = state.whatsappQueue.length
      ? `Enviar próximo WhatsApp (${state.whatsappQueue.length})`
      : 'Enviar WhatsApp';
  }
  toast(state.whatsappQueue.length
    ? `WhatsApp aberto para ${next.name || next.phone}. Restam ${state.whatsappQueue.length}.`
    : `WhatsApp aberto para ${next.name || next.phone}.`);
  return true;
}

function bindSelectedCandidateActions() {
  $('#selectedCandidateTable')?.addEventListener('click', async (event) => {
    const advanceButton = event.target.closest('[data-advance-selected-candidate]');
    if (advanceButton) {
      const candidate = state.selectedCandidates.find((item) => item.id === advanceButton.dataset.advanceSelectedCandidate);
      if (!candidate) return;

      advanceButton.disabled = true;
      advanceButton.textContent = 'Avançando...';

      try {
        const advanced = await api(`/api/selected-candidates/${candidate.id}/advance`, { method: 'POST' });
        upsertStateItem('candidates', advanced);
        render();
        const typeSelect = $('#candidateFilterType');
        const valueSelect = $('#candidateFilterValue');
        if (typeSelect && valueSelect) {
          typeSelect.value = 'opportunity';
          renderCandidateFilters();
          valueSelect.value = advanced.opportunityId || '';
          renderCandidates();
        }
        showView('candidates');
        toast(`${advanced.name || candidate.name} avançado para Candidatos Entrevistados.`);
      } catch (error) {
        toast(error.message || 'Não foi possível avançar o candidato.');
      } finally {
        advanceButton.disabled = false;
        advanceButton.textContent = 'Avançar';
      }
      return;
    }

    const button = event.target.closest('[data-delete-selected-candidate]');
    if (!button) return;

    const candidate = state.selectedCandidates.find((item) => item.id === button.dataset.deleteSelectedCandidate);
    if (!candidate) return;
    if (!window.confirm(`Excluir ${candidate.name || 'candidato selecionado'}?`)) return;

    try {
      await api(`/api/selected-candidates/${candidate.id}`, { method: 'DELETE' });
      state.selectedCandidates = state.selectedCandidates.filter((item) => item.id !== candidate.id);
      renderSelectedCandidates();
      toast('Candidato selecionado excluído.');
    } catch (error) {
      toast(error.message || 'Não foi possível excluir o candidato.');
    }
  });

  $('#sendSelectedCandidateMessageButton')?.addEventListener('click', async () => {
    const ids = selectedCandidateIdsForSending();
    if (!ids.length) {
      toast('Marque ao menos um candidato com Enviar.');
      return;
    }

    const button = $('#sendSelectedCandidateMessageButton');
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparando envio...';
    }

    try {
      const payload = {
        ids,
        candidateMessage: $('#selectedCandidateMessageForm')?.elements.candidateMessage.value || ''
      };
      let result;
      try {
        result = await api('/api/selected-candidates/send-test', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (error) {
        if (!/rota não encontrada|rota não encontrada/i.test(error.message || '')) throw error;
        result = await api('/api/selected-candidates/send', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      if (result.sent) {
        toast(`E-mail enviado para ${result.to} com ${result.found.length} candidato(s) com e-mail encontrado.`);
      } else if (result.mailto) {
        window.location.href = result.mailto;
        toast(`E-mail aberto para ${result.found.length} candidato(s) com endereço encontrado.`);
      } else {
        toast('Envio preparado, mas nenhuma forma de entrega foi configurada.');
      }
    } catch (error) {
      toast(error.message || 'Não foi possível preparar o envio.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Enviar email';
      }
    }
  });

  $('#openSelectedCandidateWhatsappButton')?.addEventListener('click', async () => {
    if (state.whatsappQueue.length && openNextWhatsappLink()) return;

    const ids = selectedCandidateIdsForSending();
    if (!ids.length) {
      toast('Marque ao menos um candidato com Enviar.');
      return;
    }

    const button = $('#openSelectedCandidateWhatsappButton');
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparando WhatsApp...';
    }

    try {
      const result = await api('/api/selected-candidates/whatsapp', {
        method: 'POST',
        body: JSON.stringify({
          ids,
          candidateMessage: $('#selectedCandidateMessageForm')?.elements.candidateMessage.value || ''
        })
      });
      state.whatsappQueue = Array.isArray(result.links) ? result.links.slice() : [];
      if (result.missing?.length) {
        toast(`${result.missing.length} candidato(s) sem telefone/WhatsApp encontrado.`);
      }
      openNextWhatsappLink();
    } catch (error) {
      toast(error.message || 'Não foi possível preparar o WhatsApp.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = state.whatsappQueue.length
          ? `Enviar próximo WhatsApp (${state.whatsappQueue.length})`
          : 'Enviar WhatsApp';
      }
    }
  });
}

function bindEditableRows() {
  $('#clientTable').addEventListener('click', (event) => {
    const contactButton = event.target.closest('[data-contact-client-for]');
    if (contactButton) {
      const client = state.clients.find((item) => item.id === contactButton.dataset.contactClientFor);
      if (!client) return;
      state.editing.clientId = client.id;
      state.editing.contactClientId = '';
      renderContactClients();
      openContactClientModal();
      return;
    }

    const consultContactButton = event.target.closest('[data-consult-contact-client-for]');
    if (consultContactButton) {
      const client = state.clients.find((item) => item.id === consultContactButton.dataset.consultContactClientFor);
      openContactClientListModal(client);
      return;
    }

    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-client]');
    const client = state.clients.find((item) => item.id === row?.dataset.editClient);
    if (client) loadClientForEdit(client);
  });

  $('#contactClientTable')?.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('[data-delete-contact-client]');
    if (deleteButton) {
      const contact = state.contactClients.find((item) => item.id === deleteButton.dataset.deleteContactClient);
      if (!contact) return;
      if (!window.confirm(`Excluir contato ${contact.name || 'selecionado'}?`)) return;

      try {
        await api(`/api/contact-clients/${contact.id}`, { method: 'DELETE' });
        removeStateItem('contactClients', contact.id);
        if (state.editing.contactClientId === contact.id) {
          clearEditing($('#contactClientForm'), 'contactClientId', 'Cadastrar contato');
        }
        renderContactClients();
        toast('Contato excluído.');
      } catch (error) {
        toast(error.message || 'Não foi possível excluir o contato.');
      }
      return;
    }

    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-contact-client]');
    const contact = state.contactClients.find((item) => item.id === row?.dataset.editContactClient);
    if (contact) loadContactClientForEdit(contact);
  });

  $('#contactClientListModalTable')?.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-modal-edit-contact-client]');
    if (editButton) {
      const contact = state.contactClients.find((item) => item.id === editButton.dataset.modalEditContactClient);
      if (!contact) return;
      state.editing.clientId = contact.clientId;
      closeContactClientListModal();
      loadContactClientForEdit(contact);
      return;
    }

    const deleteButton = event.target.closest('[data-modal-delete-contact-client]');
    if (!deleteButton) return;

    const contact = state.contactClients.find((item) => item.id === deleteButton.dataset.modalDeleteContactClient);
    if (!contact) return;
    if (!window.confirm(`Excluir contato ${contact.name || 'selecionado'}?`)) return;

    try {
      await api(`/api/contact-clients/${contact.id}`, { method: 'DELETE' });
      removeStateItem('contactClients', contact.id);
      if (state.editing.contactClientId === contact.id) {
        clearEditing($('#contactClientForm'), 'contactClientId', 'Cadastrar contato');
      }
      renderContactClients();
      renderContactClientListModal();
      toast('Contato excluído.');
    } catch (error) {
      toast(error.message || 'Não foi possível excluir o contato.');
    }
  });

  $('#faturamentoTable')?.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-faturamento]');
    const item = state.faturamento.find((faturamentoItem) => faturamentoItem.id === row?.dataset.editFaturamento);
    if (item) loadFaturamentoForEdit(item);
  });

  $('#opportunityTable').addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-opportunity]');
    const opportunity = state.opportunities.find((item) => item.id === row?.dataset.editOpportunity);
    if (opportunity) loadOpportunityForEdit(opportunity);
  });

  $('#huntingTable')?.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-hunting]');
    const opportunity = state.opportunities.find((item) => item.id === row?.dataset.editHunting);
    if (opportunity) {
      const candidate = state.candidates.find((item) => item.id === row?.dataset.editHuntingCandidate)
        ?? state.candidates.find((item) => item.opportunityId === opportunity.id);
      loadHuntingForEdit(opportunity, candidate);
    }
  });

  $('#cvFilterTable').addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-cv-filter]');
    if (deleteButton) {
      const filter = state.cvFilters.find((item) => item.id === deleteButton.dataset.deleteCvFilter);
      if (!filter) return;
      if (!window.confirm('Apagar este filtro de CV?')) return;
      api(`/api/cv-filters/${filter.id}`, { method: 'DELETE' })
        .then(() => {
          if (state.editing.cvFilterId === filter.id) state.editing.cvFilterId = '';
          removeStateItem('cvFilters', filter.id);
          toast('Filtro de CV apagado.');
          render();
        })
        .catch((error) => toast(error.message || 'Não foi possível apagar o filtro.'));
      return;
    }
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-cv-filter]');
    const filter = state.cvFilters.find((item) => item.id === row?.dataset.editCvFilter);
    if (filter) loadCvFilterForEdit(filter);
  });

  $('#candidateTable').addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-candidate]');
    const candidate = state.candidates.find((item) => item.id === row?.dataset.editCandidate);
    if (candidate) loadCandidateForEdit(candidate);
  });

  $('#allocatedTable').addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-allocated]');
    const allocated = state.allocateds.find((item) => item.id === row?.dataset.editAllocated);
    if (allocated) loadAllocatedForEdit(allocated);
  });

  $('#rateCardTable')?.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-rate-card]');
    const rateCard = state.rateCards.find((item) => item.id === row?.dataset.editRateCard);
    if (rateCard) loadRateCardForEdit(rateCard);
  });

  $('#candidatePoolTable')?.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-candidate-pool]');
    const item = state.candidatePool.find((candidatePoolItem) => candidatePoolItem.id === row?.dataset.editCandidatePool);
    if (item) loadCandidatePoolForEdit(item);
  });

  $('#userTable').addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-user]');
    const user = state.users.find((item) => item.id === row?.dataset.editUser);
    if (user) loadUserForEdit(user);
  });
}

function bindCurriculumSearch() {
  const search = async () => {
    const button = $('#curriculumSearchButton');
    if (button?.disabled) return;

    const name = $('#curriculumSearchName')?.value.trim() ?? '';
    const skills = $('#curriculumSearchSkills')?.value.trim() ?? '';

    if (button) {
      button.disabled = true;
      button.textContent = 'Pesquisando...';
      button.setAttribute('aria-busy', 'true');
    }

    try {
      // Permite que o navegador apresente o estado de carregamento antes do filtro local.
      await new Promise((resolve) => window.setTimeout(resolve, 500));

      state.curriculumSearch = {
        name,
        skills,
        hasSearched: Boolean(name || skills)
      };
      renderCurriculums();
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Pesquisar';
        button.removeAttribute('aria-busy');
      }
    }
  };

  $('#curriculumSearchButton')?.addEventListener('click', () => {
    void search();
  });
  ['#curriculumSearchName', '#curriculumSearchSkills'].forEach((selector) => {
    $(selector)?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void search();
      }
    });
  });
}


function pollEmailProcessing(jobId) {
  if (!jobId) return;

  const poll = async () => {
    try {
      const response = await api(`/api/processamento-status/${jobId}`);
      state.emailProcessing = {
        running: response.running,
        status: response.status,
        startedAt: response.started_at,
        finishedAt: response.finished_at,
        resultado: response.resultado,
        erro: response.erro,
        logs: response.logs
      };
      renderCurriculums();

      if (response.running) {
        window.setTimeout(poll, 5000);
      } else {
        await refresh();
        toast(response.erro || response.resultado?.message || 'Processamento de e-mails finalizado.');
      }
    } catch (error) {
      toast(error.message || 'Não foi possível consultar o status do processamento.');
    }
  };

  window.setTimeout(poll, 1500);
}
function formatDateTimeBR(date = new Date()) {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function bindEmailProcessing() {
  $('#processEmailsButton')?.addEventListener('click', async () => {
    const button = $('#processEmailsButton');
    try {
      if (button) button.disabled = true;
      const response = await api('/api/processar-emails', { method: 'POST', body: JSON.stringify({}) });
      state.emailProcessing = {
        running: true,
        status: response.status,
        startedAt: formatDateTimeBR(),
        resultado: null,
        erro: ''
      };
      renderCurriculums();
      toast(response.message || 'Processamento iniciado.');
      pollEmailProcessing(response.job_id);
    } catch (error) {
      if (button) button.disabled = false;
      toast(error.message || 'Não foi possível iniciar a leitura de e-mails.');
    }
  });
}

function bindCurriculumSelection() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-curriculum-opportunity]') || event.target.id === 'curriculumOpportunityModal') {
      closeCurriculumOpportunityModal();
      return;
    }

    if (event.target.closest('[data-close-curriculum-blacklist]') || event.target.id === 'curriculumBlacklistModal') {
      closeCurriculumBlacklistModal();
      return;
    }

    if (event.target.closest('[data-close-curriculum-observations]') || event.target.id === 'curriculumObservationsModal') {
      closeCurriculumObservationsModal();
      return;
    }

    const observationsButton = event.target.closest('[data-open-curriculum-observations]');
    if (observationsButton) {
      event.preventDefault();
      openCurriculumObservationsModal(observationsButton.dataset.openCurriculumObservations);
      return;
    }

    const link = event.target.closest('[data-open-curriculum]');
    if (!link) return;
    event.preventDefault();
    openCurriculumFromLink(link.dataset.openCurriculum);
  });

  $('#curriculumObservationForm')?.addEventListener('submit', saveCurriculumObservation);

  $('#candidateForm select[name="curriculumId"]')?.addEventListener('change', (event) => {
    syncCandidateNameFromCurriculum(event.currentTarget.value, true);
  });
  $('#curriculumListTabButton')?.addEventListener('click', () => {
    openCurriculumTab('list');
  });

  $('#curriculumDetailTabButton')?.addEventListener('click', () => {
    openCurriculumTab('detail');
  });
  $('#curriculumTable')?.addEventListener('click', (event) => {
    const selectButton = event.target.closest('[data-select-curriculum-button]');
    if (selectButton) {
      selectCurriculum(selectButton.dataset.selectCurriculumButton);
      return;
    }

    if (event.target.closest('a, button, input, select, textarea')) return;
    const row = event.target.closest('[data-select-curriculum]');
    if (row) selectCurriculum(row.dataset.selectCurriculum);
  });

  $('#editCurriculumButton')?.addEventListener('click', () => {
    if (!selectedCurriculum()) {
      toast('Selecione um candidato antes de editar.');
      return;
    }
    setCurriculumDetailEditing(true);
    toast('Edicao liberada.');
  });

  $('#cancelCurriculumEditButton')?.addEventListener('click', () => {
    const current = selectedCurriculum();
    if (current) fillCurriculumDetailForm(current);
    setCurriculumDetailEditing(false);
  });

  $('#saveCurriculumButton')?.addEventListener('click', saveCurriculumDetail);
  $('#selectCurriculumCandidateButton')?.addEventListener('click', openCurriculumOpportunityModal);
  $('#blacklistCurriculumButton')?.addEventListener('click', openCurriculumBlacklistModal);
  $('#exportAlcateiaButton')?.addEventListener('click', (event) => {
    exportSelectedCurriculumTemplate('alcateia', event.currentTarget);
  });
  $('#exportDttButton')?.addEventListener('click', (event) => {
    exportSelectedCurriculumTemplate('dtt', event.currentTarget);
  });
}

function syncCandidateNameFromCurriculum(curriculumId = $('#candidateForm select[name="curriculumId"]')?.value, force = false) {
  const curriculum = state.curriculums.find((item) => item.id === curriculumId);
  const nameInput = $('#candidateForm input[name="name"]');
  if (curriculum && nameInput && (force || !nameInput.value)) {
    nameInput.value = curriculum.nome;
  }
}

bindNavigation();
bindForms();
bindAuth();
bindCandidateStageActions();
bindCandidateFilters();
bindSelectedCandidateFilters();
bindFaturamentoFilters();
bindOpportunityFilters();
bindAllocatedFilters();
bindRateCardFilters();
bindCandidatePoolFilters();
bindHuntingFilters();
bindDashboardFilters();
bindCvFilterLocation();
bindCvSearch();
bindSaveSelectedCandidates();
bindSelectedCandidateMessage();
bindSelectedCandidateActions();
bindEditableRows();
bindCurriculumSearch();
bindEmailProcessing();
bindCurriculumSelection();
initPanelMaximizeControls();
initSurfaceControlsObserver();
document.body.dataset.appReady = 'true';

if (passwordResetTokenFromUrl()) {
  showPasswordReset();
} else if (session.token) {
  refresh().catch((error) => {
    toast(error.message);
    if (error.message.includes('senha')) {
      showPasswordChange();
    } else {
      showLogin();
    }
  });
} else {
  showLogin();
}


