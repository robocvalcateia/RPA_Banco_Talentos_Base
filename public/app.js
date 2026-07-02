const state = {
  clients: [],
  opportunities: [],
  faturamento: [],
  cvFilters: [],
  selectedCandidates: [],
  curriculums: [],
  curriculumTemplates: [],
  candidates: [],
  allocateds: [],
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
  allocatedFilter: { type: '', value: '' },
  huntingFilter: { type: '', value: '' },
  curriculumSearch: { name: '', skills: '', hasSearched: false },
  selectedCurriculumId: '',
  curriculumEditing: false,
  curriculumActiveTab: 'list',
  editing: {
    clientId: '',
    faturamentoId: '',
    opportunityId: '',
    cvFilterId: '',
    candidateId: '',
    allocatedId: '',
    huntingId: '',
    userId: '',
    selectingCandidateId: '',
    movingCandidateId: ''
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

const viewTitles = {
  dashboard: 'Dashboard',
  clients: 'Clientes',
  faturamento: 'Contratos/Faturamento',
  opportunities: 'Deals/Oportunidades',
  huntings: 'Contratos/Huntings',
  cvFilters: 'Deals/Filtro de CVs',
  selectedCandidates: 'Deals/Candidatos Selecionados',
  curriculums: 'Banco de Talentos',
  candidates: 'Deals/Candidatos Entrevistados',
  allocateds: 'Contratos/Alocados',
  users: 'Usuários',
};

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
  $('#passwordChangeScreen').classList.add('hidden');
}

function showPasswordChange() {
  document.body.classList.add('auth-locked');
  $('#authScreen').classList.add('hidden');
  $('#passwordChangeScreen').classList.remove('hidden');
}

function showApp() {
  document.body.classList.remove('auth-locked');
  $('#authScreen').classList.add('hidden');
  $('#passwordChangeScreen').classList.add('hidden');
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
          <td><strong>${client.customerName}</strong></td>
          <td>${client.primaryContactName || '-'}</td>
          <td>${client.primaryContactEmail || '-'}</td>
          <td>${client.primaryContactPhone || '-'}</td>
          <td>${client.observation || '-'}</td>
        </tr>
      `
    )
    .join('');
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
      return `
        <tr class="clickable-row" data-edit-opportunity="${opportunity.id}">
          <td><strong>${opportunity.opportunity}</strong></td>
          <td>${opportunity.opportunityCode || '-'}</td>
          <td>${client?.customerName || 'Cliente nao encontrado'}</td>
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
          <td><strong>${candidate?.name || '-'}</strong></td>
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

function renderCvResultRows(results, emptyMessage, group) {
  if (!results.length) {
    return `<tr><td colspan="6">${emptyMessage}</td></tr>`;
  }

  return results
    .map((result) => `
      <tr>
        <td><input type="checkbox" data-select-cv-result="${result.id}" data-result-group="${group}" aria-label="Selecionar ${result.name || 'candidato'}" /></td>
        <td><strong>${result.name || '-'}</strong></td>
        <td>${result.source || 'APINFO'}</td>
        <td>${candidateLinkHtml(result)}</td>
        <td>${result.score ?? 0}</td>
        <td>${result.observation || '-'}</td>
      </tr>
    `)
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
  return isFlagEnabled(curriculum?.blacklist ?? curriculum?.blackList ?? curriculum?.black_list ?? false);
}

function curriculumBlacklistObservation(curriculum) {
  return String(
    curriculum?.blacklistObservation
    ?? curriculum?.blackListObservation
    ?? curriculum?.blacklist_observation
    ?? ''
  ).trim();
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
    'blacklist',
    'blacklistObservation'
  ].forEach((fieldName) => setFieldValue(form, fieldName, curriculum[fieldName] || ''));

  setFieldValue(form, 'blacklist', isCurriculumBlacklisted(curriculum) ? 'true' : 'false');
  setFieldValue(form, 'blacklistObservation', curriculumBlacklistObservation(curriculum));
}

function readCurriculumDetailForm() {
  const form = $('#curriculumDetailForm');
  const payload = formPayload(form);
  const current = selectedCurriculum();
  return {
    ...payload,
    id: current?.id || '',
    mongoId: current?.mongoId || '',
    blacklist: isFlagEnabled(payload.blacklist),
    blacklistObservation: payload.blacklistObservation || current?.blacklistObservation || '',
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
  $('#selectedCurriculumName').textContent = curriculum.nome || 'Candidato sem nome';
  $('#selectedCurriculumId').textContent = curriculum.id_controle || curriculum.id || curriculum.mongoId || '';
  const blacklisted = isCurriculumBlacklisted(curriculum);
  const banner = $('#curriculumBlacklistBanner');
  if (banner) {
    const observation = curriculumBlacklistObservation(curriculum) || curriculum.observacoes_entrevista || 'Candidato marcado em Black List.';
    banner.textContent = blacklisted ? `BLACK LIST: ${observation}` : '';
    banner.classList.toggle('hidden', !blacklisted);
  }

  const blacklistButton = $('#blacklistCurriculumButton');
  if (blacklistButton) {
    blacklistButton.classList.remove('primary-action', 'danger-action', 'secondary-action');
    blacklistButton.classList.add(blacklisted ? 'danger-action' : 'primary-action');
    blacklistButton.textContent = blacklisted ? 'Remover Black List' : 'Black List';
    blacklistButton.setAttribute('aria-label', blacklisted ? 'Remover candidato da Black List' : 'Marcar candidato como Black List');
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
    await refresh();
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

    await api('/api/selected-candidates', {
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
    await refresh();
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
          <h2 id="curriculumBlacklistTitle">Black List</h2>
          <span id="curriculumBlacklistSummary"></span>
        </div>
        <button class="ghost-action" type="button" data-close-curriculum-blacklist aria-label="Fechar">×</button>
      </div>
      <form id="curriculumBlacklistForm" class="form-grid">
        <label class="full">Observação obrigatória
          <textarea name="blacklistObservation" rows="4" required></textarea>
        </label>
        <button class="danger-action" type="submit">Salvar Black List</button>
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
    toast('Selecione um candidato antes de marcar Black List.');
    return;
  }

  const modal = ensureCurriculumBlacklistModal();
  const blacklisted = isCurriculumBlacklisted(current);
  const nextBlacklisted = !blacklisted;
  modal.dataset.nextBlacklist = nextBlacklisted ? 'true' : 'false';
  $('#curriculumBlacklistTitle', modal).textContent = blacklisted ? 'Remover Black List' : 'Black List';
  $('#curriculumBlacklistSummary', modal).textContent = blacklisted
    ? `${current.nome || 'Candidato selecionado'} está em Black List. Salve para remover a flag.`
    : `${current.nome || 'Candidato selecionado'} será marcado em Black List.`;
  $('#curriculumBlacklistForm textarea[name="blacklistObservation"]', modal).value = curriculumBlacklistObservation(current);
  const submitButton = $('#curriculumBlacklistForm button[type="submit"]', modal);
  if (submitButton) {
    submitButton.classList.remove('primary-action', 'danger-action', 'secondary-action');
    submitButton.classList.add(nextBlacklisted ? 'danger-action' : 'primary-action');
    submitButton.textContent = nextBlacklisted ? 'Salvar Black List' : 'Salvar e remover Black List';
  }
  modal.classList.remove('hidden');
  $('#curriculumBlacklistForm textarea[name="blacklistObservation"]', modal).focus();
}

async function saveCurriculumBlacklist(event) {
  event.preventDefault();
  const current = selectedCurriculum();
  if (!current) {
    toast('Selecione um candidato antes de marcar Black List.');
    return;
  }

  const form = event.currentTarget;
  const observation = String(form.elements.blacklistObservation?.value || '').trim();
  if (!observation) {
    toast('A observação é obrigatória para Black List.');
    return;
  }

  const existingObservation = String(current.observacoes_entrevista || '').trim();
  const nextBlacklisted = $('#curriculumBlacklistModal')?.dataset.nextBlacklist === 'true';
  const blacklistLine = `Black List: ${observation}`;
  const removalLine = `Black List removida: ${observation}`;
  const auditLine = nextBlacklisted ? blacklistLine : removalLine;
  const nextObservation = existingObservation.includes(auditLine)
    ? existingObservation
    : [existingObservation, auditLine].filter(Boolean).join('\n');

  const button = $('button[type="submit"]', form);
  const originalText = button?.textContent || (nextBlacklisted ? 'Salvar Black List' : 'Salvar e remover Black List');
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando...';
    }

    const updated = await api(`/api/curriculums/${encodeURIComponent(curriculumIdentifier(current))}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...current,
        blacklist: nextBlacklisted,
        blacklistObservation: observation,
        observacoes_entrevista: nextObservation
      })
    });

    const currentIndex = state.curriculums.findIndex((item) => curriculumIdentifier(item) === curriculumIdentifier(current));
    if (currentIndex >= 0) state.curriculums[currentIndex] = updated;
    state.selectedCurriculumId = curriculumIdentifier(updated);
    state.curriculumActiveTab = 'detail';
    closeCurriculumBlacklistModal();
    renderCurriculums();
    toast(nextBlacklisted ? 'Candidato marcado como Black List.' : 'Candidato removido da Black List.');
  } catch (error) {
    toast(error.message || 'Não foi possível atualizar Black List.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
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
          <strong>${highlightSearchTerms(curriculum.nome || '-', highlightQuery)}</strong>
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
  if (!typeSelect || !valueSelect) return;

  const type = state.allocatedFilter.type || typeSelect.value;
  const selected = state.allocatedFilter.value || valueSelect.value;
  let options = [{ value: '', label: 'Todos' }];

  typeSelect.value = type;

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
}

function getFilteredAllocateds() {
  const { type, value } = state.allocatedFilter;
  if (!type || !value) return state.allocateds;

  if (type === 'consultant') {
    return state.allocateds.filter((allocated) => allocated.consultant === value);
  }

  if (type === 'client') {
    return state.allocateds.filter((allocated) => allocated.clientId === value);
  }

  return state.allocateds;
}

function allocatedCsvRows() {
  return getFilteredAllocateds().map((allocated) => {
    const client = state.clients.find((item) => item.id === allocated.clientId);
    return {
      ID: allocated.externalId || allocated.id,
      Código: allocated.code || '',
      Consultor: allocated.consultant || '',
      Skill: allocated.skill || '',
      Cliente: allocated.clientName || client?.customerName || '',
      'Valor Hora': formatCurrency(allocated.hourlyRate),
      Fone: allocated.phone || '',
      'Email Consultor': allocated.consultantEmail || '',
      Início: allocated.startDate || '',
      Ativo: allocated.active ? 'Sim' : 'Não',
      Término: allocated.endDate || '',
      Gestor: allocated.manager || '',
      'Email Gestor': allocated.managerEmail || '',
      'Fone Gestor': allocated.managerPhone || ''
    };
  });
}

function exportAllocatedCsv() {
  downloadCsv('alocados', allocatedCsvRows());
}

function renderAllocateds() {
  const allocateds = getFilteredAllocateds();
  $('#allocatedCount').textContent = allocateds.length;
  $('#allocatedTable').innerHTML = allocateds
    .map((allocated) => {
      const client = state.clients.find((item) => item.id === allocated.clientId);
      return `
        <tr class="clickable-row" data-edit-allocated="${allocated.id}">
          <td>${allocated.externalId || allocated.id}</td>
          <td><strong>${allocated.code}</strong></td>
          <td>${allocated.consultant || '-'}</td>
          <td>${allocated.skill || '-'}</td>
          <td>${allocated.clientName || client?.customerName || '-'}</td>
          <td>${formatCurrency(allocated.hourlyRate)}</td>
          <td>${allocated.phone || '-'}</td>
          <td>${allocated.consultantEmail || '-'}</td>
          <td>${allocated.startDate || '-'}</td>
          <td>${allocated.active ? 'Sim' : 'Não'}</td>
          <td>${allocated.endDate || '-'}</td>
          <td>${allocated.manager || '-'}</td>
          <td>${allocated.managerEmail || '-'}</td>
          <td>${allocated.managerPhone || '-'}</td>
        </tr>
      `;
    })
    .join('');
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
          <td><strong>${candidate.name}</strong></td>
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
  const value = state.selectedCandidateFilter.value || $('#selectedCandidateFilterValue')?.value || '';
  const normalizedValue = normalizeText(value);

  return state.selectedCandidates.filter((candidate) => {
    if (!type || !normalizedValue) return true;

    const opportunity = state.opportunities.find((item) => item.id === candidate.opportunityId);
    const client = state.clients.find((item) => item.id === opportunity?.clientId);

    if (type === 'name') {
      return normalizeText(candidate.name).includes(normalizedValue);
    }

    if (type === 'client') {
      return normalizeText(client?.customerName).includes(normalizedValue);
    }

    if (type === 'opportunity') {
      return normalizeText([
        candidate.opportunityName,
        candidate.opportunityCode,
        opportunity?.opportunity,
        opportunity?.opportunityCode
      ].filter(Boolean).join(' ')).includes(normalizedValue);
    }

    return true;
  });
}

function selectedCandidateFilterForOpportunity(opportunityId) {
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  return {
    type: 'opportunity',
    value: opportunityLabel(opportunity || { opportunity: opportunityId })
  };
}

function uniqueOpportunityIdFromSelectedCandidates(candidates) {
  const ids = new Set(candidates.map((candidate) => candidate.opportunityId).filter(Boolean));
  return ids.size === 1 ? [...ids][0] : '';
}

function renderSelectedCandidates() {
  const typeSelect = $('#selectedCandidateFilterType');
  const valueInput = $('#selectedCandidateFilterValue');
  const form = $('#selectedCandidateMessageForm');
  const table = $('#selectedCandidateTable');
  const count = $('#selectedCandidateCount');
  if (!typeSelect || !valueInput || !table || !count) return;

  const type = state.selectedCandidateFilter.type || '';
  typeSelect.value = type;
  valueInput.disabled = !type;
  valueInput.placeholder = type ? 'Digite para filtrar' : 'Todos';
  valueInput.value = type ? state.selectedCandidateFilter.value : '';

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
        <td><strong>${candidate.name || '-'}</strong></td>
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
  fillForm('#clientForm', {
    customerName: client.customerName,
    primaryContactName: client.primaryContactName,
    primaryContactEmail: client.primaryContactEmail,
    primaryContactPhone: client.primaryContactPhone,
    observation: client.observation
  }, 'Atualizar cliente');
  toast('Cliente carregado para atualização.');
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
  toast('Oportunidade carregada para atualização.');
}

async function loadCvFilterForEdit(filter) {
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
  toast('Filtro de CV carregado para atualização.');
}

function loadCandidateForEdit(candidate) {
  const curriculum = state.curriculums.find((item) => item.id === candidate.curriculumId || item.id_controle === candidate.curriculumId);
  state.editing.candidateId = candidate.id;
  fillForm('#candidateForm', {
    name: candidate.name,
    curriculumId: curriculum?.id ?? candidate.curriculumId,
    opportunityId: candidate.opportunityId,
    stage: candidate.stage,
    aderencia: candidate.aderencia,
    hourlyRate: candidate.hourlyRate,
    observation: candidate.observation,
    approved: candidate.approved
  }, 'Atualizar candidato');
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

  await api(`/api/candidates/${candidateId}`, {
    method: 'PATCH',
    body: JSON.stringify({ stage })
  });
  closeCandidateStageMoveModal();
  toast(`Candidato movido para ${stage}.`);
  await refresh();
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

function updateSurfaceMaximizeButton(surface, isMaximized) {
  const button = getSurfaceMaximizeButton(surface);
  if (!button) return;
  button.textContent = isMaximized ? 'Restaurar' : 'Maximizar';
  button.setAttribute('aria-label', isMaximized ? 'Restaurar painel' : 'Maximizar painel');
}

function setSurfaceMaximized(surface, isMaximized) {
  if (!surface) return;
  surface.classList.toggle('panel-maximized', isMaximized);
  updateSurfaceMaximizeButton(surface, isMaximized);
  document.body.classList.toggle('panel-is-maximized', Boolean($('.panel-maximized')));
}

function closeSurfaceDialog(dialogOrSelector) {
  const dialog = typeof dialogOrSelector === 'string' ? $(dialogOrSelector) : dialogOrSelector;
  if (!dialog) return;
  $$('.panel-maximized', dialog).forEach((surface) => setSurfaceMaximized(surface, false));
  dialog.classList.add('hidden');
  document.body.classList.toggle('panel-is-maximized', Boolean($('.panel-maximized')));
}

function isSurfaceCloseControl(element) {
  if (!element || element.tagName !== 'BUTTON') return false;
  const attributes = Array.from(element.attributes || []);
  return element.id === 'closeCandidateSelectModal'
    || element.getAttribute('aria-label') === 'Fechar'
    || attributes.some((attribute) => attribute.name.startsWith('data-close-'));
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
  if (!isModalSurface) return;

  const closeButton = Array.from(heading.querySelectorAll('button')).find(isSurfaceCloseControl);
  if (!closeButton) return;

  closeButton.classList.add('surface-close-button');
  closeButton.textContent = 'Fechar';
  closeButton.setAttribute('aria-label', 'Fechar painel');
  actions.append(closeButton);
}

function initPanelMaximizeControls() {
  $$('.panel, .modal-panel, .modal-card').forEach((surface) => {
    const heading = $('.panel-heading, .modal-heading', surface);
    if (!heading) return;

    const actions = surfaceHeadingActions(heading);
    let button = getSurfaceMaximizeButton(surface);
    if (!button) {
      button = document.createElement('button');
      button.className = 'ghost-action panel-maximize-button';
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

    actions.prepend(button);
    updateSurfaceMaximizeButton(surface, surface.classList.contains('panel-maximized'));
    standardizeSurfaceCloseButton(surface, heading, actions);
  });
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
      await api(editingId ? `/api/clients/${editingId}` : '/api/clients', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(formPayload(form))
      });
      clearEditing(form, 'clientId', 'Salvar cliente');
      toast(editingId ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      await refresh();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o cliente.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $('#faturamentoForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const editingId = state.editing.faturamentoId;
    await api(editingId ? `/api/faturamento/${editingId}` : '/api/faturamento', {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(formPayload(event.currentTarget))
    });
    clearEditing(event.currentTarget, 'faturamentoId', 'Salvar faturamento');
    toast(editingId ? 'Faturamento atualizado.' : 'Faturamento cadastrado.');
    await refresh();
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
      toast(editingId ? 'Filtro de CV atualizado.' : 'Filtro de CV cadastrado.');
      await refresh();
      const currentFilter = state.cvFilters.find((filter) => filter.id === savedFilter.id);
      if (currentFilter) {
        await loadCvFilterForEdit(currentFilter);
      }
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
    payload.approved = form.elements.approved.checked;
    const editingId = state.editing.candidateId;

    try {
      if (submitButton) submitButton.disabled = true;
      const savedCandidate = await api(editingId ? `/api/candidates/${editingId}` : '/api/candidates', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      clearEditing(form, 'candidateId', 'Salvar candidato');
      if (savedCandidate.placement?.type === 'allocated') {
        toast(savedCandidate.placement.action === 'created' ? 'Candidato aprovado e alocado criado.' : 'Candidato aprovado e alocado atualizado.');
      } else if (savedCandidate.placement?.type === 'hunting') {
        toast('Candidato aprovado e hunting atualizado.');
      } else {
        toast(editingId ? 'Candidato atualizado.' : 'Candidato cadastrado.');
      }
      await refresh();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o candidato.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  $('#allocatedForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = formPayload(event.currentTarget);
    payload.active = event.currentTarget.elements.active.checked;
    const editingId = state.editing.allocatedId;
    await api(editingId ? `/api/allocateds/${editingId}` : '/api/allocateds', {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload)
    });
    clearEditing(event.currentTarget, 'allocatedId', 'Salvar alocado');
    toast(editingId ? 'Alocado atualizado.' : 'Alocado cadastrado.');
    await refresh();
  });

  $('#huntingForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const editingId = state.editing.huntingId;
    await api(editingId ? `/api/huntings/${editingId}` : '/api/huntings', {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(formPayload(event.currentTarget))
    });
    clearEditing(event.currentTarget, 'huntingId', 'Salvar hunting');
    toast(editingId ? 'Hunting atualizado.' : 'Hunting cadastrado.');
    await refresh();
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
      await api(`/api/candidates/${candidateId}/select`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      closeCandidateSelectModal();
      toast('Candidato aprovado e migrado para alocados.');
      await refresh();
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
    const editingId = state.editing.userId;
    await api(editingId ? `/api/users/${editingId}` : '/api/users', {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(formPayload(event.currentTarget))
    });
    clearEditing(event.currentTarget, 'userId', 'Salvar usuário');
    toast(editingId ? 'Usuário atualizado.' : 'Usuário cadastrado com senha inicial Alcateia123.');
    await refresh();
  });
}

function bindAuth() {
  async function handleLogin() {
    document.body.dataset.loginAttempted = 'true';
    const form = $('#loginForm');
    setAuthMessage('#loginError');

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
    setAuthMessage('#passwordChangeError');

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

  $('#selectedCandidateSearchButton')?.addEventListener('click', () => {
    state.selectedCandidateFilter.type = $('#selectedCandidateFilterType')?.value || '';
    state.selectedCandidateFilter.value = $('#selectedCandidateFilterValue')?.value || '';
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
      value: ''
    };
    renderAllocatedFilters();
    renderAllocateds();
  });

  $('#allocatedFilterValue')?.addEventListener('change', (event) => {
    state.allocatedFilter.value = event.currentTarget.value;
    renderAllocateds();
  });

  $('#allocatedCsvButton')?.addEventListener('click', exportAllocatedCsv);
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
    const candidates = getFilteredSelectedCandidates();
    const opportunityId = uniqueOpportunityIdFromSelectedCandidates(candidates);
    if (!opportunityId) {
      toast('Filtre uma única oportunidade antes de salvar a mensagem.');
      return;
    }

    const updated = await api('/api/selected-candidates/message', {
      method: 'POST',
      body: JSON.stringify({
        opportunityId,
        candidateMessage: event.currentTarget.elements.candidateMessage.value
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
  });
}

function selectedCandidateIdsForSending() {
  return $$('[data-send-selected-candidate]:checked').map((checkbox) => checkbox.dataset.sendSelectedCandidate);
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
        await refresh();
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
        toast(`SMTP não configurado. E-mail preparado com ${result.found.length} candidato(s) com e-mail encontrado.`);
      } else {
        toast('Envio preparado, mas nenhuma forma de entrega foi configurada.');
      }
    } catch (error) {
      toast(error.message || 'Não foi possível preparar o envio.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Enviar mensagem';
      }
    }
  });
}

function bindEditableRows() {
  $('#clientTable').addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-client]');
    const client = state.clients.find((item) => item.id === row?.dataset.editClient);
    if (client) loadClientForEdit(client);
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
        .then(async () => {
          if (state.editing.cvFilterId === filter.id) state.editing.cvFilterId = '';
          toast('Filtro de CV apagado.');
          await refresh();
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

    const link = event.target.closest('[data-open-curriculum]');
    if (!link) return;
    event.preventDefault();
    openCurriculumFromLink(link.dataset.openCurriculum);
  });

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
document.body.dataset.appReady = 'true';

if (session.token) {
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


