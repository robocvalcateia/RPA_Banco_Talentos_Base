const state = {
  clients: [],
  contactClients: [],
  opportunities: [],
  faturamento: [],
  formDefinitions: [],
  formRequests: [],
  formRequestObservations: [],
  cvFilters: [],
  selectedCandidates: [],
  curriculums: [],
  curriculumObservations: [],
  curriculumTemplates: [],
  candidates: [],
  allocateds: [],
  workHours: [],
  workHourClosures: [],
  businessCalendar: [],
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
  activeFormsPanel: 'request',
  activeBillingReportPanel: 'query',
  launcherReturnNodeId: 'root',
  pendingWonOpportunitySave: null,
  taxReformSimulation: null,
  selectedCandidateFilter: { type: '', value: '' },
  clientListFilter: '',
  whatsappQueue: [],
  allocatedFilter: { type: '', value: '', status: '' },
  workHourFilter: { allocatedId: '', clientId: '', dateFrom: '', dateTo: '' },
  billingReportFilter: { monthYear: '', clientId: '', allocatedId: '' },
  selectedAllocatedIds: new Set(),
  huntingFilter: { type: '', value: '' },
  rateCardFilter: { clientId: '' },
  candidatePoolFilter: { clientId: '' },
  candidatePoolProfiles: ['Técnico', 'Funcional'],
  candidatePoolStatuses: ['Ativo', 'Inativo', 'Alocado'],
  candidatePoolSkillFields: [],
  curriculumSearch: { name: '', skills: '', hasSearched: false },
  selectedCurriculumId: '',
  curriculumEditing: false,
  curriculumActiveTab: 'list',
  editing: {
    clientId: '',
    contactClientId: '',
    businessCalendarId: '',
    faturamentoId: '',
    opportunityId: '',
    cvFilterId: '',
    candidateId: '',
    allocatedId: '',
    rateCardId: '',
    candidatePoolId: '',
    huntingId: '',
    userId: '',
    formDefinitionId: '',
    formRequestId: '',
    selectingCandidateId: '',
    movingCandidateId: '',
    observingCurriculumId: ''
  },
  indicators: null
};

let initialRouteApplied = false;

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

function applyInitialRoute() {
  if (initialRouteApplied) return;
  initialRouteApplied = true;

  const params = new URLSearchParams(window.location.search);
  const viewId = params.get('view');
  const formsPanel = params.get('panel');

  if (viewId === 'forms' && ['builder', 'request', 'requests', 'pending'].includes(formsPanel)) {
    state.activeFormsPanel = formsPanel === 'builder' && isCurrentUserAdmin() ? 'builder' : formsPanel;
  }

  if (viewId === 'billingReport' && ['query', 'entry'].includes(formsPanel)) {
    state.activeBillingReportPanel = formsPanel;
  }

  if (viewId && viewTitles[viewId]) {
    rememberLauncherReturnForView(viewId, formsPanel);
    showView(viewId);
  }
}

const viewTitles = {
  dashboard: 'Alcateia',
  clients: 'Clientes',
  billingReport: 'Billing Report',
  faturamento: 'Financeiro/Faturamento',
  taxReformSimulator: 'Financeiro/Simuladores / Reforma',
  allocationPrices: 'Financeiro/Preços / Alocações',
  financeProjection: 'Financeiro/Projeção',
  forms: 'Formulários',
  opportunities: 'Deals/Oportunidades',
  candidatePool: 'Contratos/Bolsão de Candidatos',
  huntings: 'Contratos/Huntings',
  rateCards: 'Contratos/Rate Cards',
  cvFilters: 'Deals/Filtro de CVs',
  selectedCandidates: 'Deals/Candidatos Selecionados',
  curriculums: 'Banco de Talentos',
  candidates: 'Deals/Candidatos Entrevistados',
  allocateds: 'Contratos/Alocados',
  workHours: 'Contratos/Horas Trabalhadas',
  users: 'Usuários',
  businessCalendar: 'Cadastros/Calendário',
};

const launcherFavoriteStorageKey = 'talentos_launcher_favorites';
const launcherRootId = 'root';
const defaultLauncherFavoriteIds = ['opportunities', 'curriculums', 'selectedCandidates', 'allocateds'];
const launcherNodes = {
  root: {
    label: 'Seções',
    eyebrow: 'Menu',
    description: 'Menu operacional',
    children: ['deals', 'contracts', 'finance', 'billingReports', 'formsSection', 'talents', 'admin', 'businessDashboard']
  },
  deals: {
    label: 'Deals',
    eyebrow: 'Seção',
    description: 'Oportunidades, candidatos e filtros de CV',
    children: ['opportunities', 'dealCandidates', 'cvFilters']
  },
  dealCandidates: {
    label: 'Candidatos',
    eyebrow: 'Deals',
    description: 'Triagem, seleção, entrevista e vínculo com oportunidades',
    children: ['selectedCandidates', 'candidates']
  },
  contracts: {
    label: 'Contratos',
    eyebrow: 'Seção',
    description: 'Alocados, horas trabalhadas, bolsão de candidatos, huntings e rate cards',
    children: ['allocateds', 'workHours', 'candidatePool', 'huntings', 'rateCards']
  },
  finance: {
    label: 'Financeiro',
    eyebrow: 'Seção',
    description: 'Faturamento e controles financeiros',
    children: ['faturamento', 'taxReformSimulator', 'allocationPrices', 'financeProjection'],
    roles: ['Admin']
  },
  billingReports: {
    label: 'Billing Report',
    eyebrow: 'Seção',
    description: 'Relatórios de billing',
    children: ['billingReportQuery', 'billingReportEntry']
  },
  billingReportQuery: {
    label: 'Consultas / Relatórios',
    eyebrow: 'Billing Report',
    description: 'Consulta mensal, filtros e exportação',
    view: 'billingReport',
    panel: 'query'
  },
  billingReportEntry: {
    label: 'Apontamento',
    eyebrow: 'Billing Report',
    description: 'Registro de horas por consultor ativo',
    view: 'billingReport',
    panel: 'entry'
  },
  formsSection: {
    label: 'Formulários',
    eyebrow: 'Seção',
    description: 'Requisições, workflows e aprovações',
    children: ['formBuilder', 'formRequest', 'formPendingRequests']
  },
  talents: {
    label: 'Banco de Talentos',
    eyebrow: 'Seção',
    description: 'Currículos, busca e manutenção da base',
    children: ['curriculums']
  },
  admin: {
    label: 'Cadastros',
    eyebrow: 'Seção',
    description: 'Clientes, usuários e apoio operacional',
    children: ['clients', 'users', 'businessCalendar']
  },
  opportunities: {
    label: 'Oportunidades',
    eyebrow: 'Deals',
    description: 'Pipeline, status, responsáveis e fechamento',
    view: 'opportunities'
  },
  candidatePool: {
    label: 'Bolsão de Candidatos',
    eyebrow: 'Contratos',
    description: 'Disponíveis por cliente, perfil e skills',
    view: 'candidatePool'
  },
  cvFilters: {
    label: 'Filtro de CVs',
    eyebrow: 'Deals',
    description: 'Critérios de busca e resultados filtrados',
    view: 'cvFilters'
  },
  selectedCandidates: {
    label: 'Candidatos Selecionados',
    eyebrow: 'Pipeline',
    description: 'Lista curta, envio e avanço para entrevista',
    view: 'selectedCandidates'
  },
  candidates: {
    label: 'Candidatos Entrevistados',
    eyebrow: 'Deals',
    description: 'Etapas, aderência, aprovação e alocação',
    view: 'candidates'
  },
  faturamento: {
    label: 'Faturamento',
    eyebrow: 'Financeiro',
    description: 'Previsto, realizado e evolução mensal',
    view: 'faturamento',
    roles: ['Admin']
  },
  taxReformSimulator: {
    label: 'Simuladores / Reforma',
    eyebrow: 'Financeiro',
    description: 'Composição de preço, transição 2026-2033 e margem efetiva',
    view: 'taxReformSimulator',
    roles: ['Admin']
  },
  allocationPrices: {
    label: 'Preços / Alocações',
    eyebrow: 'Financeiro',
    description: 'Valor compra, valor venda, razão e resultado',
    view: 'allocationPrices',
    roles: ['Admin']
  },
  financeProjection: {
    label: 'Projeção',
    eyebrow: 'Financeiro',
    description: 'Alocados ativos, custo operacional e venda projetada',
    view: 'financeProjection',
    roles: ['Admin']
  },
  formBuilder: {
    label: 'Criar novo formulário',
    eyebrow: 'Admin',
    description: 'Campos, workflow de aprovação e destinatários',
    view: 'forms',
    panel: 'builder',
    roles: ['Admin']
  },
  formRequest: {
    label: 'Fazer requisição',
    eyebrow: 'Formulários',
    description: 'Abrir uma nova solicitação e acompanhar aprovações',
    view: 'forms',
    panel: 'request'
  },
  formPendingRequests: {
    label: 'Requisições Pendentes',
    eyebrow: 'Formulários',
    description: 'Itens aguardando minha ação, SLA e consulta dos anexos',
    view: 'forms',
    panel: 'pending'
  },
  allocateds: {
    label: 'Alocados',
    eyebrow: 'Contratos',
    description: 'Contratos ativos, documentos e exportação',
    view: 'allocateds'
  },
  workHours: {
    label: 'Horas Trabalhadas',
    eyebrow: 'Contratos',
    description: 'Apontamento mensal, fechamento e exportação',
    view: 'workHours'
  },
  huntings: {
    label: 'Huntings',
    eyebrow: 'Contratos',
    description: 'Processos contratados por vaga fechada',
    view: 'huntings'
  },
  rateCards: {
    label: 'Rate Cards',
    eyebrow: 'Contratos',
    description: 'Tabelas comerciais por cliente',
    view: 'rateCards'
  },
  curriculums: {
    label: 'Banco de Talentos',
    eyebrow: 'Talentos',
    description: 'Busca, edição e documentos de currículos',
    view: 'curriculums'
  },
  clients: {
    label: 'Clientes',
    eyebrow: 'Cadastros',
    description: 'Clientes, contatos e relacionamento',
    view: 'clients'
  },
  users: {
    label: 'Usuários',
    eyebrow: 'Admin',
    description: 'Acessos, perfis e recuperação de senha',
    view: 'users'
  },
  businessCalendar: {
    label: 'Feriados',
    eyebrow: 'Cadastros',
    description: 'Dias e horários sem expediente por cliente',
    view: 'businessCalendar',
    roles: ['Admin']
  },
  businessDashboard: {
    label: 'Dashboard',
    eyebrow: 'Indicadores',
    description: 'Indicadores e acompanhamento do negócio',
    action: 'dashboard'
  }
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

function parseCurrencyInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrencyInput(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function bindCurrencyInputs(root = document) {
  $$('.currency-input', root).forEach((input) => {
    if (input.dataset.currencyBound === 'true') return;
    input.dataset.currencyBound = 'true';
    input.addEventListener('focus', () => {
      const numericValue = parseCurrencyInput(input.value);
      input.value = numericValue ? String(numericValue).replace('.', ',') : '';
    });
    input.addEventListener('blur', () => {
      input.value = formatCurrencyInput(parseCurrencyInput(input.value));
    });
  });
}

function currentUserRole() {
  return String(state.currentUser?.role || session.user?.role || 'Gestão').trim();
}

function isCurrentUserAdmin() {
  return currentUserRole().toLowerCase() === 'admin';
}

function currentUserEmail() {
  return String(state.currentUser?.email || session.user?.email || '').trim().toLowerCase();
}

function currentUserNameKey() {
  return normalizeText(state.currentUser?.name || session.user?.name || '');
}

function activeAllocatedsForCurrentUser() {
  const email = currentUserEmail();
  const name = currentUserNameKey();
  return state.allocateds.filter((allocated) => {
    if (allocated.active !== true) return false;
    const allocatedEmail = String(allocated.consultantEmail || '').trim().toLowerCase();
    if (email && allocatedEmail && allocatedEmail === email) return true;
    return name && normalizeText(allocated.consultant || '') === name;
  });
}

function canCurrentUserAccessWorkHours() {
  return isCurrentUserAdmin() || activeAllocatedsForCurrentUser().length > 0;
}

function canAccessLauncherNode(node) {
  if (node?.view === 'workHours') return canCurrentUserAccessWorkHours();
  if (node?.view === 'billingReport' || node === launcherNodes.billingReports) return canCurrentUserAccessWorkHours();
  if (!node?.roles?.length) return true;
  const role = currentUserRole().toLowerCase();
  return node.roles.some((allowedRole) => String(allowedRole).toLowerCase() === role);
}

function canAccessView(viewId) {
  if (viewId === 'faturamento') return isCurrentUserAdmin();
  if (viewId === 'taxReformSimulator') return isCurrentUserAdmin();
  if (viewId === 'allocationPrices') return isCurrentUserAdmin();
  if (viewId === 'financeProjection') return isCurrentUserAdmin();
  if (viewId === 'businessCalendar') return isCurrentUserAdmin();
  if (viewId === 'billingReport') return canCurrentUserAccessWorkHours();
  if (viewId === 'workHours') return canCurrentUserAccessWorkHours();
  return true;
}

function applyRoleVisibility() {
  $$('[data-admin-only]').forEach((element) => {
    element.hidden = !isCurrentUserAdmin();
  });
  $$('[data-nav-group="finance"], [data-view="faturamento"]').forEach((element) => {
    element.hidden = !isCurrentUserAdmin();
  });
  $$('[data-view="taxReformSimulator"]').forEach((element) => {
    element.hidden = !isCurrentUserAdmin();
  });
  $$('[data-view="allocationPrices"]').forEach((element) => {
    element.hidden = !isCurrentUserAdmin();
  });
  $$('[data-view="financeProjection"]').forEach((element) => {
    element.hidden = !isCurrentUserAdmin();
  });
  $$('[data-nav-group="billingReport"], [data-view="billingReport"]').forEach((element) => {
    element.hidden = !canCurrentUserAccessWorkHours();
  });
  $$('[data-view="workHours"]').forEach((element) => {
    element.hidden = !canCurrentUserAccessWorkHours();
  });
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

function repairEncodingArtifacts(value) {
  let text = String(value ?? '');
  if (!text) return text;

  const artifactScore = (candidate) => (
    ((candidate.match(/[ÃÂ�]/g) || []).length * 3)
    + ((candidate.match(/(?:â€|â€“|â€”|â€¢|ï¿½)/g) || []).length * 3)
    + ((candidate.match(/\?\?(?:o|a|es|ao|oes|cao)/gi) || []).length * 2)
  );

  const decodeLatin1AsUtf8 = (candidate) => {
    if (!/[ÃÂâï]/.test(candidate)) return candidate;
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(
        Uint8Array.from(Array.from(candidate, (char) => char.charCodeAt(0) & 0xff))
      );
    } catch {
      return candidate;
    }
  };

  for (let index = 0; index < 3; index += 1) {
    const decoded = decodeLatin1AsUtf8(text);
    if (decoded === text || artifactScore(decoded) >= artifactScore(text)) break;
    text = decoded;
  }

  const repairs = [
    [/\bFormul\?rios\b/g, 'Formulários'],
    [/\bformul\?rios\b/g, 'formulários'],
    [/\bUsu\?rios\b/g, 'Usuários'],
    [/\busu\?rios\b/g, 'usuários'],
    [/\bCurr\?culo\b/g, 'Currículo'],
    [/\bcurr\?culo\b/g, 'currículo'],
    [/\bCurr\?culos\b/g, 'Currículos'],
    [/\bcurr\?culos\b/g, 'currículos'],
    [/\bIngl\?s\b/g, 'Inglês'],
    [/\bingl\?s\b/g, 'inglês'],
    [/\bN\?vel\b/g, 'Nível'],
    [/\bn\?vel\b/g, 'nível'],
    [/\bT\?cnico\b/g, 'Técnico'],
    [/\bt\?cnico\b/g, 'técnico'],
    [/\bGest\?\?o\b/g, 'Gestão'],
    [/\bgest\?\?o\b/g, 'gestão'],
    [/\bS\?\?o\b/g, 'São'],
    [/\bs\?\?o\b/g, 'são'],
    [/\bS\?o\b/g, 'São'],
    [/\bs\?o\b/g, 'são'],
    [/\bN\?\?o\b/g, 'Não'],
    [/\bn\?\?o\b/g, 'não'],
    [/\bN\?o\b/g, 'Não'],
    [/\bn\?o\b/g, 'não'],
    [/\bJo\?\?o\b/g, 'João'],
    [/\bjo\?\?o\b/g, 'joão'],
    [/\bJo\?o\b/g, 'João'],
    [/\bjo\?o\b/g, 'joão'],
    [/\bM\?\?s\b/g, 'Mês'],
    [/\bm\?\?s\b/g, 'mês'],
    [/\bM\?s\b/g, 'Mês'],
    [/\bm\?s\b/g, 'mês'],
    [/\bV\?nculo\b/g, 'Vínculo'],
    [/\bv\?nculo\b/g, 'vínculo'],
    [/\bposs\?vel\b/g, 'possível'],
    [/\bPoss\?vel\b/g, 'Possível'],
    [/\bManuten\?\?o\b/g, 'Manutenção'],
    [/\bmanuten\?\?o\b/g, 'manutenção'],
    [/\bOp\?\?o\b/g, 'Opção'],
    [/\bop\?\?o\b/g, 'opção'],
    [/([Aa])\?\?es/g, '$1ções'],
    [/([Ee])\?\?es/g, '$1ções'],
    [/([Ii])\?\?es/g, '$1ções'],
    [/([Oo])\?\?es/g, '$1ções'],
    [/([Uu])\?\?es/g, '$1ções'],
    [/([Aa])\?\?o/g, '$1ção'],
    [/([Ee])\?\?o/g, '$1ção'],
    [/([Ii])\?\?o/g, '$1ção'],
    [/([Oo])\?\?o/g, '$1ção'],
    [/([Uu])\?\?o/g, '$1ção']
  ];

  text = text
    .replace(/_x000D_/gi, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  for (const [pattern, replacement] of repairs) {
    text = text.replace(pattern, replacement);
  }

  return text.normalize('NFC');
}

function sanitizeApiPayload(value) {
  if (typeof value === 'string') return repairEncodingArtifacts(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeApiPayload(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeApiPayload(item)]));
  }
  return value;
}

function isFormDataBody(body) {
  return typeof FormData !== 'undefined'
    && (body instanceof FormData || Object.prototype.toString.call(body) === '[object FormData]');
}

async function api(path, options = {}) {
  const isFormData = isFormDataBody(options.body);
  const headers = {
    ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(options.headers ?? {})
  };
  if (!isFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (isFormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  }
  const { headers: _ignoredHeaders, ...requestOptions } = options;
  const response = await fetch(path, {
    ...requestOptions,
    headers
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
    throw new Error(repairEncodingArtifacts(payload.error || 'Não foi possível concluir a ação.'));
  }
  return sanitizeApiPayload(payload);
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
  element.textContent = repairEncodingArtifacts(message);
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
  applyInitialRoute();
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
  applyRoleVisibility();
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
  return repairEncodingArtifacts(value)
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
  const candidatePoolStatusOptions = (state.candidatePoolStatuses?.length ? state.candidatePoolStatuses : ['Ativo', 'Inativo', 'Alocado'])
    .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`)
    .join('');
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
  const candidatePoolStatusSelect = $('#candidatePoolForm select[name="status"]');
  if (candidatePoolStatusSelect) {
    const currentValue = candidatePoolStatusSelect.value || 'Ativo';
    candidatePoolStatusSelect.innerHTML = candidatePoolStatusOptions;
    candidatePoolStatusSelect.value = [...candidatePoolStatusSelect.options].some((option) => option.value === currentValue)
      ? currentValue
      : 'Ativo';
  }
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

function contactById(contactId) {
  return state.contactClients.find((contact) => contact.id === contactId) || null;
}

function contactsForClient(clientId) {
  return state.contactClients
    .filter((contact) => contact.clientId === clientId)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR', { sensitivity: 'base' }));
}

function contactTreeRows(contacts = []) {
  const byParent = new Map();
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const rows = [];
  const visited = new Set();

  contacts.forEach((contact) => {
    const parentId = byId.has(contact.parentContactId) ? contact.parentContactId : '';
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(contact);
  });

  const visit = (contact, level) => {
    if (!contact || visited.has(contact.id)) return;
    visited.add(contact.id);
    rows.push({ contact, level: Math.min(level, 5) });
    (byParent.get(contact.id) || []).forEach((child) => visit(child, level + 1));
  };

  (byParent.get('') || []).forEach((contact) => visit(contact, 1));
  contacts.forEach((contact) => visit(contact, 1));
  return rows;
}

function contactManagerName(contact) {
  const manager = contactById(contact?.parentContactId);
  return manager && manager.clientId === contact?.clientId ? manager.name : '';
}

function clientManagerName(client) {
  const manager = contactById(client?.managerContactId);
  return manager && manager.clientId === client?.id ? manager.name : '';
}

function updateClientOrgChartOptions() {
  const orgSelect = $('#clientOrgChartSelect');
  const csvSelect = $('#clientCsvSelect');
  const listFilter = $('#clientListFilter');
  if (!orgSelect && !csvSelect && !listFilter) return;

  const options = state.clients
    .slice()
    .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
    .map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.customerName)}</option>`)
    .join('');
  if (orgSelect) {
    const current = orgSelect.value || state.editing.clientId || '';
    orgSelect.innerHTML = '<option value="">Selecione</option>' + options;
    orgSelect.value = current && state.clients.some((client) => client.id === current) ? current : '';
  }
  if (csvSelect) {
    const current = csvSelect.value || '';
    csvSelect.innerHTML = '<option value="">Todos</option>' + options;
    csvSelect.value = current && state.clients.some((client) => client.id === current) ? current : '';
  }
  if (listFilter) {
    const current = state.clientListFilter || listFilter.value || '';
    listFilter.innerHTML = '<option value="">Todos</option>' + options;
    listFilter.value = current && state.clients.some((client) => client.id === current) ? current : '';
    state.clientListFilter = listFilter.value;
  }
}

function renderContactNameWithLevel(contact, level = 1) {
  const prefix = level > 1 ? `${'- '.repeat(level - 1)}` : '';
  return `${prefix}${escapeHtml(contact.name || '-')}`;
}

function updateClientManagerContactOptions(selectedValue = $('#clientManagerContactSelect')?.value || '') {
  const select = $('#clientManagerContactSelect');
  if (!select) return;

  const clientId = state.editing.clientId || '';
  const contacts = contactsForClient(clientId);
  select.innerHTML = `<option value="">${clientId ? 'Sem gestor definido' : 'Selecione um cliente'}</option>${contactTreeRows(contacts)
    .map(({ contact, level }) => `<option value="${escapeHtml(contact.id)}">${'-- '.repeat(Math.max(0, level - 1))}${escapeHtml(contact.name || contact.id)}</option>`)
    .join('')}`;
  select.disabled = !clientId || !contacts.length;
  select.value = contacts.some((contact) => contact.id === selectedValue) ? selectedValue : '';
}

function updateContactParentOptions(selectedValue = '', excludedContactId = state.editing.contactClientId || '') {
  const select = $('#contactParentContactSelect');
  const client = selectedClientForContacts();
  if (!select) return;

  const contacts = contactsForClient(client?.id || '').filter((contact) => contact.id !== excludedContactId);
  select.innerHTML = '<option value="">Sem gestor</option>' + contactTreeRows(contacts)
    .map(({ contact, level }) => `<option value="${escapeHtml(contact.id)}">${'-- '.repeat(Math.max(0, level - 1))}${escapeHtml(contact.name || contact.id)}</option>`)
    .join('');
  select.disabled = !contacts.length;
  select.value = contacts.some((contact) => contact.id === selectedValue) ? selectedValue : '';
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

function formatDateOnlyBR(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return formatDateBR(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
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
  downloadBlob(blob, `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadHtml(filename, html) {
  const blob = new Blob([`\ufeff${html}`], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${filename}-${new Date().toISOString().slice(0, 10)}.html`);
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
          <button class="pie-legend-row pie-legend-button" type="button" data-open-allocated-client="${escapeHtml(label)}" aria-label="Abrir alocados do cliente ${escapeHtml(label)}">
            <span class="legend-dot" style="background: ${colors[index % colors.length]}"></span>
            <strong>${label}</strong>
            <b>${value} (${formatPercent(Number(value || 0), total)})</b>
          </button>
        `)
        .join('')}
    </div>
  `;
}

function allocatedPersonTokens(value) {
  return normalizeText(value).split(' ').filter((token) => token.length > 1);
}

function allocatedNamesLikelyReferToSamePerson(firstName, secondName) {
  const firstTokens = allocatedPersonTokens(firstName);
  const secondTokens = allocatedPersonTokens(secondName);
  if (!firstTokens.length || !secondTokens.length) return false;

  const first = firstTokens.join(' ');
  const second = secondTokens.join(' ');
  if (first === second) return true;

  const firstSet = new Set(firstTokens);
  const secondSet = new Set(secondTokens);
  return firstTokens.every((token) => secondSet.has(token))
    || secondTokens.every((token) => firstSet.has(token));
}

function isAllocatedAlsoActiveInCandidatePool(allocated) {
  return state.candidatePool.some((poolItem) => (
    candidatePoolIsAvailable(poolItem)
    && poolItem.clientId === allocated.clientId
    && allocatedNamesLikelyReferToSamePerson(allocated.consultant, poolItem.candidateName)
  ));
}

function getAllocatedsByClient() {
  const serverValues = state.indicators.allocatedsByClient ?? {};
  const serverTotal = Object.values(serverValues).reduce((sum, value) => sum + Number(value || 0), 0);
  if (serverTotal > 0) return serverValues;

  const values = Object.fromEntries(state.clients.map((client) => [client.customerName, 0]));
  state.allocateds
    .filter((allocated) => allocated.active === true && !isAllocatedAlsoActiveInCandidatePool(allocated))
    .forEach((allocated) => {
      const client = state.clients.find((item) => item.id === allocated.clientId);
      const clientName = client?.customerName || allocated.clientName || 'Sem cliente';
      values[clientName] = (values[clientName] ?? 0) + 1;
    });
  return values;
}

function openAllocatedMaintenance(clientName = '') {
  const client = state.clients.find((item) => normalizeText(item.customerName) === normalizeText(clientName));
  state.allocatedFilter = {
    type: client ? 'client' : '',
    value: client?.id || '',
    status: 'active'
  };
  showView('allocateds');
  renderAllocatedFilters();
  renderAllocateds();
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
  updateClientOrgChartOptions();
  const filteredClients = state.clientListFilter
    ? state.clients.filter((client) => client.id === state.clientListFilter)
    : state.clients;
  $('#clientCount').textContent = filteredClients.length;
  $('#clientTable').innerHTML = filteredClients.length ? filteredClients
    .map(
      (client) => `
        <tr class="clickable-row" data-edit-client="${client.id}">
          <td><strong>${escapeHtml(client.customerName)}</strong></td>
          <td>${escapeHtml(client.primaryContactName || '-')}</td>
          <td>${escapeHtml(client.primaryContactEmail || '-')}</td>
          <td>${escapeHtml(client.primaryContactPhone || '-')}</td>
          <td>${escapeHtml(clientManagerName(client) || '-')}</td>
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
    .join('') : '<tr><td colspan="7">Nenhum cliente encontrado para o filtro selecionado.</td></tr>';
}

function clientCsvRows(clientId = $('#clientCsvSelect')?.value || '') {
  return state.clients
    .filter((client) => !clientId || client.id === clientId)
    .slice()
    .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
    .map((client) => {
      const contacts = contactsForClient(client.id);
      return {
        Cliente: client.customerName || '',
        'Contato principal': client.primaryContactName || '',
        'Email contato principal': client.primaryContactEmail || '',
        'Telefone contato principal': client.primaryContactPhone || '',
        'Nome do gestor': clientManagerName(client) || '',
        'Qtd contatos cadastrados': contacts.length,
        Observacao: client.observation || ''
      };
    });
}

function contactOrgCard(contact, level, children = []) {
  const managerName = contactManagerName(contact);
  const ledNames = children.map((child) => child.name).filter(Boolean);
  return `
    <article class="client-org-card client-org-level-${Math.min(level, 5)}">
      <em>${children.length ? 'Gestor' : 'Contato'}</em>
      <strong>${escapeHtml(contact.name || '-')}</strong>
      <span>${escapeHtml(contact.role || 'Cargo não informado')}</span>
      <small>${escapeHtml(contact.area || 'Área não informada')}</small>
      <small><b>Gestor direto:</b> ${escapeHtml(managerName || 'Raiz do organograma')}</small>
      <small><b>Lidera:</b> ${ledNames.length ? escapeHtml(ledNames.join(', ')) : 'Sem liderados cadastrados'}</small>
      ${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>` : ''}
      ${contact.phone ? `<small>${escapeHtml(contact.phone)}</small>` : ''}
    </article>
  `;
}

function contactsGroupedByManager(contacts = []) {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  const byParent = new Map();
  contacts.forEach((contact) => {
    const parentId = byId.has(contact.parentContactId) ? contact.parentContactId : '';
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(contact);
  });

  const sortContacts = (items = []) => items
    .slice()
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR', { sensitivity: 'base' }));

  return { byId, byParent, sortContacts };
}

function clientOrgTree(contacts = [], client = null) {
  const { byId, byParent, sortContacts } = contactsGroupedByManager(contacts);
  const build = (contact, level = 1, visited = new Set()) => {
    if (!contact || visited.has(contact.id)) return '';
    const nextVisited = new Set(visited);
    nextVisited.add(contact.id);
    const children = sortContacts(byParent.get(contact.id) || []);
    return `
      <section class="client-org-node client-org-node-level-${Math.min(level, 5)}">
        ${contactOrgCard(contact, level, children)}
        ${children.length ? `
          <div class="client-org-children" aria-label="Liderados por ${escapeHtml(contact.name || 'contato')}">
            ${children.map((child) => build(child, level + 1, nextVisited)).join('')}
          </div>
        ` : ''}
      </section>
    `;
  };

  const roots = sortContacts(byParent.get('') || contacts.filter((contact) => !byId.has(contact.parentContactId)));
  const managerRootId = client?.managerContactId || '';
  const orderedRoots = managerRootId && roots.some((contact) => contact.id === managerRootId)
    ? [roots.find((contact) => contact.id === managerRootId), ...roots.filter((contact) => contact.id !== managerRootId)]
    : roots;

  return orderedRoots
    .map((contact) => build(contact, 1))
    .join('');
}

function clientOrgManagerSummary(contacts = []) {
  const { byParent, sortContacts } = contactsGroupedByManager(contacts);
  const managerRows = contacts
    .map((contact) => ({
      manager: contact,
      children: sortContacts(byParent.get(contact.id) || [])
    }))
    .filter((row) => row.children.length)
    .sort((first, second) => String(first.manager.name || '').localeCompare(String(second.manager.name || ''), 'pt-BR', { sensitivity: 'base' }));

  if (!managerRows.length) {
    return '<p class="empty-state">Nenhuma relação gestor/liderado cadastrada para este cliente.</p>';
  }

  return `
    <section class="client-org-manager-summary">
      <h3>Relação gestor / liderados</h3>
      <div class="client-org-manager-grid">
        ${managerRows.map(({ manager, children }) => `
          <article>
            <strong>Gestor: ${escapeHtml(manager.name || '-')}</strong>
            <span>Liderados diretos: ${escapeHtml(children.map((child) => child.name || '-').join(', '))}</span>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function buildClientOrgChartMarkup(client) {
  if (!client) return '<p class="empty-state">Selecione um cliente para gerar o organograma de contatos.</p>';

  const contacts = contactsForClient(client.id);

  if (!contacts.length) {
    return `
      <div class="client-org-heading">
        <strong>${escapeHtml(client.customerName)}</strong>
        <span>Sem contatos cadastrados para organograma.</span>
      </div>
    `;
  }

  return `
    <div class="client-org-heading">
      <strong>${escapeHtml(client.customerName)}</strong>
      <span>Gestor do cliente: ${escapeHtml(clientManagerName(client) || 'não definido')}</span>
    </div>
    <div class="client-org-chart">
      ${clientOrgTree(contacts, client)}
    </div>
    ${clientOrgManagerSummary(contacts)}
  `;
}

function renderClientOrgChartReport(clientId = $('#clientOrgChartSelect')?.value || '') {
  const report = $('#clientOrgChartReport');
  if (!report) return;

  const client = state.clients.find((item) => item.id === clientId);
  report.innerHTML = buildClientOrgChartMarkup(client);
}

function safeFilename(value) {
  return normalizeSearchValue(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'relatorio';
}

function buildClientOrgChartDocument(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return '';
  const generatedAt = new Date().toLocaleString('pt-BR');
  const markup = buildClientOrgChartMarkup(client);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Organograma - ${escapeHtml(client.customerName)}</title>
  <style>
    :root { --accent: #00b894; --accent-dark: #008f73; --border: #d9e7e7; --muted: #5f7070; --text: #101820; }
    * { box-sizing: border-box; }
    body { color: var(--text); font-family: Arial, Helvetica, sans-serif; margin: 28px; }
    header { border-bottom: 2px solid var(--border); margin-bottom: 24px; padding-bottom: 14px; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    header p { color: var(--muted); margin: 0; }
    .client-org-heading { align-items: baseline; border-bottom: 1px solid var(--border); display: flex; gap: 16px; margin-bottom: 18px; padding-bottom: 12px; }
    .client-org-heading strong { font-size: 20px; }
    .client-org-heading span { color: var(--muted); }
    .client-org-chart { align-items: start; display: flex; gap: 28px; justify-content: center; min-width: 760px; padding: 6px 0 12px; }
    .client-org-node { align-items: center; display: flex; flex-direction: column; page-break-inside: avoid; position: relative; }
    .client-org-children { display: flex; gap: 16px; justify-content: center; margin-top: 34px; position: relative; }
    .client-org-children::before { background: var(--border); content: ""; height: 18px; left: 50%; position: absolute; top: -34px; width: 2px; }
    .client-org-children::after { background: var(--border); content: ""; height: 2px; left: 8%; position: absolute; right: 8%; top: -16px; }
    .client-org-children > .client-org-node::before { background: var(--border); content: ""; height: 16px; left: 50%; position: absolute; top: -16px; width: 2px; }
    .client-org-level { position: relative; page-break-inside: avoid; }
    .client-org-level + .client-org-level::before { background: var(--border); content: ""; height: 22px; left: 50%; position: absolute; top: -22px; width: 2px; }
    .client-org-level-label { color: var(--muted); display: block; font-size: 12px; font-weight: 800; margin-bottom: 8px; text-transform: uppercase; }
    .client-org-row { align-items: stretch; display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; position: relative; }
    .client-org-level + .client-org-level .client-org-row::before { background: var(--border); content: ""; height: 2px; left: 10%; position: absolute; right: 10%; top: -12px; }
    .client-org-card { background: #fff; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06); display: grid; gap: 5px; min-height: 112px; padding: 14px; position: relative; width: 230px; }
    .client-org-card em { color: var(--accent-dark); font-size: 11px; font-style: normal; font-weight: 900; text-transform: uppercase; }
    .client-org-card::before { background: var(--border); content: ""; height: 12px; left: 50%; position: absolute; top: -13px; width: 2px; }
    .client-org-level:first-child .client-org-card::before { display: none; }
    .client-org-card strong { font-size: 16px; }
    .client-org-card span, .client-org-card small, .client-org-card a { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
    .client-org-card a { color: var(--accent-dark); text-decoration: none; }
    .client-org-level-1 { border-color: var(--accent); box-shadow: 0 10px 24px rgba(0, 184, 148, 0.14); }
    .client-org-level-1::after { background: var(--accent); content: ""; inset: 0 auto 0 0; position: absolute; width: 5px; }
    .client-org-manager-summary { border-top: 1px solid var(--border); margin-top: 18px; padding-top: 18px; }
    .client-org-manager-summary h3 { font-size: 16px; margin: 0 0 12px; }
    .client-org-manager-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .client-org-manager-grid article { background: #f7fbfb; border: 1px solid var(--border); border-radius: 8px; display: grid; gap: 6px; padding: 12px; }
    .client-org-manager-grid span { color: var(--muted); overflow-wrap: anywhere; }
    .empty-state { color: var(--muted); }
    @media print { body { margin: 14mm; } .client-org-card { box-shadow: none; } }
  </style>
</head>
<body>
  <header>
    <h1>Organograma de contatos</h1>
    <p>Cliente: ${escapeHtml(client.customerName)} | Gerado em ${escapeHtml(generatedAt)}</p>
  </header>
  <main>${markup}</main>
</body>
</html>`;
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
    updateContactParentOptions(contact.parentContactId || '', contact.id);
    fillForm('#contactClientForm', {
      clientId: contact.clientId,
      name: contact.name,
      area: contact.area,
      role: contact.role,
      parentContactId: contact.parentContactId || '',
      phone: contact.phone,
      email: contact.email
    }, 'Atualizar contato');
    if (title) title.textContent = 'Atualizar contato';
  } else {
    clearEditing(form, 'contactClientId', 'Cadastrar contato');
    form.elements.clientId.value = client.id;
    updateContactParentOptions('', '');
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
    table.innerHTML = '<tr><td colspan="7">Selecione um cliente para consultar contatos.</td></tr>';
    return;
  }

  const contacts = contactsForClient(client.id);
  const rows = contactTreeRows(contacts);

  context.textContent = `Cliente: ${client.customerName} · ${contacts.length} contato(s)`;
  table.innerHTML = contacts.length
    ? rows.map(({ contact, level }) => `
      <tr>
        <td><strong>${renderContactNameWithLevel(contact, level)}</strong></td>
        <td>${escapeHtml(contact.area || '-')}</td>
        <td>${escapeHtml(contact.role || '-')}</td>
        <td>${escapeHtml(contactManagerName(contact) || '-')}</td>
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
    : '<tr><td colspan="7">Nenhum contato cadastrado para este cliente.</td></tr>';
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
    table.innerHTML = '<tr><td colspan="7">Selecione um cliente para visualizar contatos.</td></tr>';
    return;
  }

  const rows = contactTreeRows(contactsForClient(client.id));
  table.innerHTML = contacts.length
    ? rows.map(({ contact, level }) => `
      <tr class="clickable-row" data-edit-contact-client="${contact.id}">
        <td><strong>${renderContactNameWithLevel(contact, level)}</strong></td>
        <td>${escapeHtml(contact.area || '-')}</td>
        <td>${escapeHtml(contact.role || '-')}</td>
        <td>${escapeHtml(contactManagerName(contact) || '-')}</td>
        <td>${escapeHtml(contact.phone || '-')}</td>
        <td>${escapeHtml(contact.email || '-')}</td>
        <td><button class="ghost-action" type="button" data-delete-contact-client="${contact.id}" aria-label="Excluir contato">Excluir</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="7">Nenhum contato cadastrado para este cliente.</td></tr>';
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
  const valueSelect = $('#opportunityFilterValue');
  const statusSelect = $('#opportunityStatusFilter');
  const closingMonthInput = $('#opportunityClosingMonthFilter');
  if (!typeSelect || !valueSelect) return;

  const type = state.opportunityFilter.type || typeSelect.value;
  const selectedValue = state.opportunityFilter.value || valueSelect.value || '';
  const selectedStatus = state.opportunityFilter.status || statusSelect?.value || '';
  let valueOptions = [{ value: '', label: 'Todos' }];

  typeSelect.value = type;
  if (type === 'client') {
    const clientIds = new Set(state.opportunities.map((opportunity) => opportunity.clientId).filter(Boolean));
    valueOptions = valueOptions.concat(
      state.clients
        .filter((client) => clientIds.has(client.id))
        .slice()
        .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
        .map((client) => ({ value: client.id, label: client.customerName }))
    );
  }

  if (type === 'name') {
    const owners = [...new Set(state.opportunities.map((opportunity) => String(opportunity.owner || '').trim()).filter(Boolean))];
    valueOptions = valueOptions.concat(
      owners
        .sort((first, second) => first.localeCompare(second, 'pt-BR', { sensitivity: 'base' }))
        .map((owner) => ({ value: owner, label: owner }))
    );
  }

  if (type === 'opportunity') {
    valueOptions = valueOptions.concat(
      state.opportunities
        .slice()
        .sort(byOpportunityCode)
        .map((opportunity) => ({
          value: opportunity.id,
          label: opportunityLabel(opportunity)
        }))
    );
  }

  valueSelect.disabled = !type;
  valueSelect.innerHTML = valueOptions
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join('');
  valueSelect.value = type && valueOptions.some((option) => option.value === selectedValue) ? selectedValue : '';
  state.opportunityFilter.value = valueSelect.value;

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
      return opportunity.clientId === value || normalizeText(client?.customerName).includes(normalizedValue);
    });
  }

  if (type === 'name') {
    opportunities = opportunities.filter((opportunity) => {
      if (!normalizedValue) return true;
      return normalizeText(opportunity.owner).includes(normalizedValue);
    });
  }

  if (type === 'opportunity') {
    opportunities = opportunities.filter((opportunity) => {
      if (!normalizedValue) return true;
      return opportunity.id === value
        || normalizeText(`${opportunity.opportunity || ''} ${opportunity.opportunityCode || ''}`).includes(normalizedValue);
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

function isApprovedOpportunityCandidate(candidate) {
  return candidate?.approved === true || candidate?.stage === 'Aprovado' || candidate?.status === 'Aprovado';
}

function approvedCandidatesForOpportunity(opportunityId) {
  return state.candidates.filter((candidate) => (
    candidate.opportunityId === opportunityId && isApprovedOpportunityCandidate(candidate)
  ));
}

function wonApprovalOptionsForOpportunity(opportunityId) {
  const existingCandidateKeys = new Set(state.candidates
    .filter((candidate) => candidate.opportunityId === opportunityId)
    .flatMap((candidate) => [
      `id:${candidate.id}`,
      `curr:${candidate.curriculumId || ''}`,
      `name:${normalizeText(candidate.name || '')}`
    ]));

  const interviewed = state.candidates
    .filter((candidate) => candidate.opportunityId === opportunityId && !isApprovedOpportunityCandidate(candidate))
    .map((candidate) => ({
      type: 'candidate',
      id: candidate.id,
      name: candidate.name || '-',
      detail: `Etapa atual: ${candidate.stage || '-'}`
    }));

  const selected = state.selectedCandidates
    .filter((candidate) => {
      if (candidate.opportunityId !== opportunityId) return false;
      const keys = [
        `curr:${candidate.curriculumId || candidate.curriculumControlId || ''}`,
        `name:${normalizeText(candidate.name || '')}`
      ];
      return !keys.some((key) => existingCandidateKeys.has(key));
    })
    .map((candidate) => ({
      type: 'selected',
      id: candidate.id,
      name: candidate.name || '-',
      detail: `Candidato selecionado${candidate.score !== undefined ? ` - aderência ${candidate.score}%` : ''}`
    }));

  return [...interviewed, ...selected].sort((first, second) => (
    String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR', { sensitivity: 'base' })
  ));
}

function ensureWonApprovalModal() {
  let modal = $('#wonApprovalModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'wonApprovalModal';
  modal.className = 'modal-backdrop hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'wonApprovalTitle');
  modal.innerHTML = `
    <section class="modal-card won-approval-card">
      <div class="modal-heading">
        <div>
          <h2 id="wonApprovalTitle">Aprovar consultor</h2>
          <span id="wonApprovalSummary">Obrigatório para alterar a oportunidade para WON</span>
        </div>
        <button class="surface-window-control surface-close-button" type="button" data-close-won-approval aria-label="Fechar painel" title="Fechar"></button>
      </div>
      <div class="won-approval-body">
        <p class="helper-text" id="wonApprovalMessage"></p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Consultor</th>
                <th>Origem / etapa</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody id="wonApprovalTable"></tbody>
          </table>
        </div>
      </div>
      <div class="modal-actions">
        <button class="secondary-action" type="button" data-close-won-approval>Voltar</button>
      </div>
    </section>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const approveButton = event.target.closest('[data-approve-won-consultant]');
    if (approveButton) {
      approveWonConsultantAndSave(approveButton);
      return;
    }
    if (event.target === modal || event.target.closest('[data-close-won-approval]')) {
      closeWonApprovalModal();
    }
  });
  initPanelMaximizeControls();
  return modal;
}

function closeWonApprovalModal() {
  state.pendingWonOpportunitySave = null;
  closeSurfaceDialog('#wonApprovalModal');
}

function openWonApprovalModal(opportunityId, payload, editingId) {
  const modal = ensureWonApprovalModal();
  const opportunity = state.opportunities.find((item) => item.id === opportunityId);
  const options = wonApprovalOptionsForOpportunity(opportunityId);
  state.pendingWonOpportunitySave = { opportunityId, payload, editingId };

  const summary = $('#wonApprovalSummary');
  if (summary) summary.textContent = opportunity ? opportunityLabel(opportunity) : 'Obrigatório para alterar a oportunidade para WON';

  const message = $('#wonApprovalMessage');
  if (message) {
    message.textContent = options.length
      ? 'Escolha o consultor que ficará aprovado nessa oportunidade. Depois da confirmação, a oportunidade será salva como WON.'
      : 'Não há consultor selecionado ou em andamento para essa oportunidade. Selecione um consultor antes de alterar para WON.';
  }

  const table = $('#wonApprovalTable');
  if (table) {
    table.innerHTML = options.length
      ? options.map((option) => `
        <tr>
          <td><strong>${escapeHtml(option.name)}</strong></td>
          <td>${escapeHtml(option.detail)}</td>
          <td><button class="primary-action compact-action" type="button" data-approve-won-consultant="${escapeHtml(option.id)}" data-won-option-type="${escapeHtml(option.type)}">Aprovar</button></td>
        </tr>
      `).join('')
      : '<tr><td colspan="3">Nenhum consultor disponível para aprovação.</td></tr>';
  }

  modal.classList.remove('hidden');
}

async function approveWonConsultantAndSave(button) {
  const pending = state.pendingWonOpportunitySave;
  if (!pending || !button) return;

  const optionId = button.dataset.approveWonConsultant;
  const optionType = button.dataset.wonOptionType;
  const originalText = setSubmitButtonBusy(button, 'Aprovando...');

  try {
    let candidateId = optionId;
    if (optionType === 'selected') {
      const advanced = await api(`/api/selected-candidates/${encodeURIComponent(optionId)}/advance`, { method: 'POST' });
      upsertStateItem('candidates', advanced);
      candidateId = advanced.id;
    }

    const approved = await api(`/api/candidates/${encodeURIComponent(candidateId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ approved: true, stage: 'Aprovado' })
    });
    upsertStateItem('candidates', approved);
    await saveOpportunityPayload(pending.payload, pending.editingId, { skipWonApprovalCheck: true });
    closeWonApprovalModal();
    toast(`${approved.name || 'Consultor'} aprovado e oportunidade salva como WON.`);
  } catch (error) {
    toast(error.message || 'Não foi possível aprovar o consultor para WON.');
  } finally {
    restoreSubmitButton(button, originalText || 'Aprovar');
  }
}

async function saveOpportunityPayload(payload, editingId, options = {}) {
  if (
    payload.status === 'WON'
    && !options.skipWonApprovalCheck
    && !approvedCandidatesForOpportunity(editingId).length
  ) {
    if (!editingId) {
      toast('Cadastre a oportunidade antes de alterar para WON.');
      return;
    }
    openWonApprovalModal(editingId, payload, editingId);
    return;
  }

  await api(editingId ? `/api/opportunities/${editingId}` : '/api/opportunities', {
    method: editingId ? 'PATCH' : 'POST',
    body: JSON.stringify(payload)
  });
  clearEditing($('#opportunityForm'), 'opportunityId', 'Salvar oportunidade');
  toast(editingId ? 'Oportunidade atualizada.' : 'Oportunidade cadastrada.');
  await refresh();
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
      Consultor: candidate?.name || '-',
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

function formatRatio(value, digits = 2) {
  return `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}%`;
}

const taxReformEstablishments = {
  'sp-consultoria': {
    label: 'Alcateia Sao Paulo - Consultoria / Alocacao',
    municipalCode: '02881',
    issRate: 0.029,
    irrfRate: 0.015,
    csrfRate: 0.0465,
    origin: 'Nota fiscal observada - draft'
  },
  'barueri-hunting': {
    label: 'Alcateia Barueri - Hunting',
    municipalCode: '170401220',
    issRate: 0.02,
    irrfRate: 0.015,
    csrfRate: 0,
    origin: 'Nota fiscal observada - draft'
  },
  'barueri-consultoria': {
    label: 'Alcateia Barueri - Consultoria / Alocacao',
    municipalCode: '010601220',
    issRate: 0.02,
    irrfRate: 0.015,
    csrfRate: 0.0465,
    origin: 'Nota fiscal observada - draft'
  }
};

const taxReformScenarioPresets = {
  legal: { label: 'Legal / Base', ibsCbsRate: 26.5, creditUtilization: 90, risk: 'Medio' },
  conservative: { label: 'Conservador', ibsCbsRate: 28, creditUtilization: 80, risk: 'Alto' },
  probable: { label: 'Provavel', ibsCbsRate: 26.5, creditUtilization: 90, risk: 'Medio' },
  optimistic: { label: 'Otimista', ibsCbsRate: 25, creditUtilization: 100, risk: 'Baixo' },
  custom: { label: 'Personalizado', ibsCbsRate: 26.5, creditUtilization: 90, risk: 'A validar' }
};

const taxReformTransitionFactors = {
  2026: { legacy: 1, reform: 0, note: 'Ano-teste: IBS/CBS destacados, sem efeito economico no draft.' },
  2027: { legacy: 1, reform: 0, note: 'Premissa draft: manter comparacao economica ate parametrizacao CBS definitiva.' },
  2028: { legacy: 1, reform: 0, note: 'Premissa draft: preparar transicao IBS sem alterar snapshot historico.' },
  2029: { legacy: 0.9, reform: 0.1, note: 'Transicao IBS 10% e legado 90%.' },
  2030: { legacy: 0.8, reform: 0.2, note: 'Transicao IBS 20% e legado 80%.' },
  2031: { legacy: 0.7, reform: 0.3, note: 'Transicao IBS 30% e legado 70%.' },
  2032: { legacy: 0.6, reform: 0.4, note: 'Transicao IBS 40% e legado 60%.' },
  2033: { legacy: 0, reform: 1, note: 'Modelo integral pos-Reforma no draft.' }
};

function numericFormValue(form, name, fallback = 0) {
  const element = form?.elements?.[name];
  if (!element) return fallback;
  if (element.classList?.contains('currency-input')) return parseCurrencyInput(element.value);
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}

function taxReformFormInputs(form) {
  const startYear = Math.max(2026, Math.min(2033, Math.trunc(numericFormValue(form, 'startYear', 2026))));
  const endYear = Math.max(startYear, Math.min(2033, Math.trunc(numericFormValue(form, 'endYear', 2033))));
  return {
    establishmentKey: form.elements.establishment.value,
    service: form.elements.service.value,
    mode: form.elements.mode.value,
    scenarioKey: form.elements.scenario.value,
    targetPrice: numericFormValue(form, 'targetPrice', 0),
    priceCeiling: numericFormValue(form, 'priceCeiling', 0),
    directCost: numericFormValue(form, 'directCost', 0),
    indirectCost: numericFormValue(form, 'indirectCost', 0),
    creditableExpenses: numericFormValue(form, 'creditableExpenses', 0),
    targetMargin: numericFormValue(form, 'targetMargin', 0) / 100,
    ibsCbsRate: numericFormValue(form, 'ibsCbsRate', 0) / 100,
    creditUtilization: numericFormValue(form, 'creditUtilization', 0) / 100,
    annualAdjustment: numericFormValue(form, 'annualAdjustment', 0) / 100,
    costInflation: numericFormValue(form, 'costInflation', 0) / 100,
    startYear,
    endYear,
    assumption: form.elements.assumption.value.trim()
  };
}

function taxReformYearRows(inputs) {
  const establishment = taxReformEstablishments[inputs.establishmentKey] || taxReformEstablishments['sp-consultoria'];
  const scenario = taxReformScenarioPresets[inputs.scenarioKey] || taxReformScenarioPresets.probable;
  const baseCost = inputs.directCost + inputs.indirectCost;
  const rows = [];

  for (let year = inputs.startYear; year <= inputs.endYear; year += 1) {
    const elapsed = year - inputs.startYear;
    const transition = taxReformTransitionFactors[year] || taxReformTransitionFactors[2033];
    const costGross = baseCost * ((1 + inputs.costInflation) ** elapsed);
    const creditableExpenses = inputs.creditableExpenses * ((1 + inputs.costInflation) ** elapsed);
    const legacyEconomicRate = (establishment.issRate + 0.0925) * transition.legacy;
    const reformEconomicRate = inputs.ibsCbsRate * transition.reform;
    const economicRate = legacyEconomicRate + reformEconomicRate;
    const credits = Math.min(creditableExpenses * inputs.ibsCbsRate * inputs.creditUtilization * Math.max(transition.reform, 0), reformEconomicRate * Math.max(inputs.targetPrice, 1));
    const netCost = Math.max(costGross - credits, 0);
    const denominator = 1 - inputs.targetMargin - economicRate;
    const mathematicallyViable = denominator > 0;
    let priceBase = inputs.targetPrice * ((1 + inputs.annualAdjustment) ** elapsed);

    if (inputs.mode === 'preserveMargin') {
      priceBase = mathematicallyViable ? netCost / denominator : 0;
    }
    if (inputs.mode === 'ceiling' && inputs.priceCeiling > 0) {
      priceBase = inputs.priceCeiling * ((1 + inputs.annualAdjustment) ** elapsed);
    }

    const reformHighlighted = priceBase * reformEconomicRate;
    const noteTotal = priceBase + reformHighlighted;
    const grossEconomicTax = priceBase * economicRate;
    const netEconomicTax = Math.max(grossEconomicTax - credits, 0);
    const retentions = priceBase * (establishment.irrfRate + establishment.csrfRate);
    const cashReceived = noteTotal - retentions;
    const profit = priceBase - costGross - netEconomicTax;
    const effectiveMargin = priceBase > 0 ? profit / priceBase : 0;
    const netTaxRate = priceBase > 0 ? netEconomicTax / priceBase : 0;

    rows.push({
      year,
      establishment,
      scenario,
      transition,
      priceBase,
      noteTotal,
      costGross,
      credits,
      grossEconomicTax,
      netEconomicTax,
      retentions,
      cashReceived,
      profit,
      effectiveMargin,
      netTaxRate,
      mathematicallyViable
    });
  }

  return rows;
}

function classifyTaxReformRisk(lastRow, inputs) {
  if (!lastRow?.mathematicallyViable) return 'Critico';
  if (lastRow.effectiveMargin < 0) return 'Critico';
  if (lastRow.effectiveMargin < inputs.targetMargin * 0.75) return 'Alto';
  if (lastRow.netTaxRate >= 0.2) return 'Medio';
  return taxReformScenarioPresets[inputs.scenarioKey]?.risk || 'Medio';
}

function calculateTaxReformSimulation(form) {
  const inputs = taxReformFormInputs(form);
  const rows = taxReformYearRows(inputs);
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  return {
    inputs,
    rows,
    firstRow,
    lastRow,
    risk: classifyTaxReformRisk(lastRow, inputs)
  };
}

function renderTaxReformSimulator() {
  const simulation = state.taxReformSimulation;
  const table = $('#taxReformResultTable');
  if (!table) return;

  if (!simulation?.rows?.length) {
    table.innerHTML = '<tr><td colspan="9">Informe os parametros e calcule a simulacao.</td></tr>';
    return;
  }

  const { rows, inputs, firstRow, lastRow, risk } = simulation;
  $('#taxReformResultSummary').textContent = `${taxReformScenarioPresets[inputs.scenarioKey]?.label || 'Cenario'} - ${inputs.startYear} a ${inputs.endYear}`;

  table.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${row.year}</strong></td>
      <td>${formatCurrency(row.priceBase)}</td>
      <td>${formatCurrency(row.noteTotal)}</td>
      <td>${formatCurrency(row.netEconomicTax)}</td>
      <td>${formatCurrency(row.credits)}</td>
      <td>${formatCurrency(row.retentions)}</td>
      <td>${formatCurrency(row.cashReceived)}</td>
      <td>${formatCurrency(row.profit)}</td>
      <td>${formatRatio(row.effectiveMargin * 100)}</td>
    </tr>
  `).join('');

  const marginDelta = (lastRow.effectiveMargin - firstRow.effectiveMargin) * 100;
  const taxDelta = (lastRow.netTaxRate - firstRow.netTaxRate) * 100;
  const modeLabel = inputs.mode === 'preserveMargin' ? 'preservar margem' : inputs.mode === 'preservePrice' ? 'preservar preco' : 'respeitar preco-teto';
  $('#taxReformConclusion').textContent = `No cenario ${taxReformScenarioPresets[inputs.scenarioKey]?.label || 'selecionado'}, a simulacao de ${modeLabel} encerra ${inputs.endYear} com margem efetiva de ${formatRatio(lastRow.effectiveMargin * 100)} e carga liquida de ${formatRatio(lastRow.netTaxRate * 100)}. A variacao frente ao ano inicial e de ${formatRatio(marginDelta)} na margem e ${formatRatio(taxDelta)} p.p. na carga. Risco ${risk}: validar creditos, retencoes e fonte fiscal antes de converter em proposta.`;

  $('#taxReformMemory').innerHTML = [
    `Filial: ${lastRow.establishment.label}; codigo municipal ${lastRow.establishment.municipalCode}; origem ${lastRow.establishment.origin}.`,
    `Servico: ${inputs.service}; modo: ${modeLabel}; cenario: ${taxReformScenarioPresets[inputs.scenarioKey]?.label || '-'}.`,
    `Custo bruto final: ${formatCurrency(lastRow.costGross)}; credito estimado: ${formatCurrency(lastRow.credits)}; custo liquido economico: ${formatCurrency(Math.max(lastRow.costGross - lastRow.credits, 0))}.`,
    `Tributos economicos liquidos: ${formatCurrency(lastRow.netEconomicTax)}; retencoes: ${formatCurrency(lastRow.retentions)}; caixa recebido: ${formatCurrency(lastRow.cashReceived)}.`,
    `Transicao ${lastRow.year}: ${lastRow.transition.note}`,
    inputs.assumption ? `Premissa informada: ${inputs.assumption}` : 'Premissa: parametros em draft exigem validacao contabil/fiscal antes de publicacao.'
  ].map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function allocationPurchaseShare(value) {
  const [purchaseShare] = String(value || '50/50').split('/').map((part) => Number(part));
  return Number.isFinite(purchaseShare) && purchaseShare > 0 ? purchaseShare / 100 : 0.5;
}

function calculateAllocationPriceResult(form = $('#allocationPriceForm')) {
  if (!form) return 0;
  const saleValue = parseCurrencyInput(form.elements.saleValue?.value || '');
  const purchaseValue = parseCurrencyInput(form.elements.purchaseValue?.value || '');
  const purchaseShare = allocationPurchaseShare(form.elements.ratio?.value);
  const result = purchaseValue > 0
    ? purchaseValue / purchaseShare
    : saleValue * purchaseShare;
  return Number.isFinite(result) ? result : 0;
}

function allocationPriceInputs(form = $('#allocationPriceForm')) {
  if (!form) {
    return {
      purchaseValue: 0,
      saleValue: 0,
      ratio: '50/50',
      purchaseShare: 0.5,
      annualAdjustment: 0.04
    };
  }

  const saleValue = parseCurrencyInput(form.elements.saleValue?.value || '');
  const purchaseValue = parseCurrencyInput(form.elements.purchaseValue?.value || '');
  const ratio = form.elements.ratio?.value || '50/50';
  const purchaseShare = allocationPurchaseShare(ratio);
  const annualAdjustment = numericFormValue(form, 'annualAdjustment', 4) / 100;
  return {
    purchaseValue: purchaseValue > 0 ? purchaseValue : saleValue * purchaseShare,
    saleValue: saleValue > 0 ? saleValue : (purchaseValue > 0 ? purchaseValue / purchaseShare : 0),
    ratio,
    purchaseShare,
    annualAdjustment
  };
}

const allocationPriceTaxProfile = Object.freeze({
  label: 'Alcateia Sao Paulo - Alocacao',
  issRate: 0.029,
  pisCofinsRate: 0.0925,
  ibsCbsRate: 0.265,
  creditableExpenseShare: 0.2,
  creditUtilization: 0.9
});

function allocationForecastRows(form = $('#allocationPriceForm')) {
  const inputs = allocationPriceInputs(form);
  const currentBaselineTaxRate = allocationPriceTaxProfile.issRate + allocationPriceTaxProfile.pisCofinsRate;

  return Object.entries(taxReformTransitionFactors)
    .map(([year, transition]) => {
      const numericYear = Number(year);
      const yearsAfterBase = Math.max(numericYear - 2026, 0);
      const adjustedPurchaseValue = inputs.purchaseValue * ((1 + inputs.annualAdjustment) ** yearsAfterBase);
      const legacyEconomicRate = currentBaselineTaxRate * transition.legacy;
      const reformGrossRate = allocationPriceTaxProfile.ibsCbsRate * transition.reform;
      const estimatedCreditRate = allocationPriceTaxProfile.creditableExpenseShare
        * allocationPriceTaxProfile.ibsCbsRate
        * allocationPriceTaxProfile.creditUtilization
        * transition.reform;
      const netTaxRate = Math.max(legacyEconomicRate + reformGrossRate - estimatedCreditRate, 0);
      const incrementalTaxRate = Math.max(netTaxRate - currentBaselineTaxRate, 0);
      const denominator = inputs.purchaseShare - incrementalTaxRate;
      const requiredSaleValue = denominator > 0 && adjustedPurchaseValue > 0
        ? adjustedPurchaseValue / denominator
        : 0;
      const variation = inputs.saleValue > 0 ? (requiredSaleValue / inputs.saleValue) - 1 : 0;

      return {
        year: numericYear,
        ratio: inputs.ratio,
        purchaseValue: adjustedPurchaseValue,
        baseSaleValue: inputs.saleValue,
        netTaxRate,
        incrementalTaxRate,
        requiredSaleValue,
        variation,
        viable: denominator > 0
      };
    })
    .filter((row) => row.year >= 2027 && row.year <= 2033)
    .sort((first, second) => first.year - second.year);
}

function renderAllocationPriceResult() {
  const resultField = $('#allocationPriceResult');
  if (!resultField) return;
  const form = $('#allocationPriceForm');
  resultField.value = formatCurrencyInput(calculateAllocationPriceResult(form));

  const inputs = allocationPriceInputs(form);
  const summary = $('#allocationPriceForecastSummary');
  if (summary) {
    summary.textContent = inputs.purchaseValue > 0
      ? `${allocationPriceTaxProfile.label}; razão ${inputs.ratio}, reajuste ${formatRatio(inputs.annualAdjustment * 100)} ao ano`
      : 'Informe valor compra ou venda para projetar';
  }

  const strip = $('#allocationPriceForecastStrip');
  if (!strip) return;
  if (inputs.purchaseValue <= 0) {
    strip.innerHTML = '<p class="empty-state">Informe valor compra ou valor venda para gerar a previsão anual.</p>';
    return;
  }
  const rows = allocationForecastRows(form);
  strip.innerHTML = rows.map((row) => `
    <article class="allocation-forecast-card">
      <span>${row.year}</span>
      <strong>${row.viable ? formatCurrency(row.requiredSaleValue) : 'Inviavel'}</strong>
      <small>Compra ${formatCurrency(row.purchaseValue)}</small>
      <small>Impacto ${formatRatio(row.incrementalTaxRate * 100)}</small>
      <small>Var. ${formatRatio(row.variation * 100)}</small>
    </article>
  `).join('');
}

function dateOnly(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function timeOptionsHtml() {
  const options = [];
  for (let minute = 0; minute < 24 * 60; minute += 1) {
    const hours = Math.floor(minute / 60);
    const minutes = minute % 60;
    const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    options.push(`<option value="${value}">${value}</option>`);
  }
  return options.join('');
}

function businessCalendarApplies(entry, dateValue, clientId = '') {
  if (String(entry.date || '') !== dateValue) return false;
  const entryClientId = String(entry.clientId || '').trim();
  return !entryClientId || entryClientId === clientId;
}

function businessCalendarUnavailableHours(dateValue, clientId = '') {
  const entries = (state.businessCalendar || []).filter((entry) => businessCalendarApplies(entry, dateValue, clientId));
  if (entries.some((entry) => entry.allDay === true)) return 8;

  const blockedHours = entries.reduce((total, entry) => {
    const start = timeToMinutes(entry.startTime);
    const end = timeToMinutes(entry.endTime);
    if (start === null || end === null || end <= start) return total;
    return total + ((end - start) / 60);
  }, 0);
  return Math.min(8, blockedHours);
}

function businessCalendarAvailableHoursForDate(year, month, day, clientId = '') {
  const date = new Date(year, month - 1, day);
  const weekDay = date.getDay();
  const iso = dateOnly(year, month, day);
  if (weekDay === 0 || weekDay === 6) return 0;
  if (nationalHolidaySet(year).has(iso)) return 0;
  return Math.max(0, 8 - businessCalendarUnavailableHours(iso, clientId));
}

function businessCalendarMonthAvailability(year, month, clientId = '') {
  const days = new Date(year, month, 0).getDate();
  let businessDays = 0;
  let availableHours = 0;

  for (let day = 1; day <= days; day += 1) {
    const hours = businessCalendarAvailableHoursForDate(year, month, day, clientId);
    if (hours > 0) businessDays += 1;
    availableHours += hours;
  }

  return { businessDays, availableHours };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function nationalHolidaySet(year) {
  const easter = easterSunday(year);
  const movable = [
    addDays(easter, -48), // Segunda-feira de Carnaval
    addDays(easter, -47), // Terça-feira de Carnaval
    addDays(easter, -2), // Sexta-feira Santa
    addDays(easter, 60) // Corpus Christi
  ].map((date) => dateOnly(date.getFullYear(), date.getMonth() + 1, date.getDate()));

  return new Set([
    dateOnly(year, 1, 1),
    dateOnly(year, 4, 21),
    dateOnly(year, 5, 1),
    dateOnly(year, 9, 7),
    dateOnly(year, 10, 12),
    dateOnly(year, 11, 2),
    dateOnly(year, 11, 15),
    dateOnly(year, 11, 20),
    dateOnly(year, 12, 25),
    ...movable
  ]);
}

function businessDaysInMonth(year, month) {
  return businessCalendarMonthAvailability(year, month).businessDays;
}

function nextProjectionMonths(count = 6, baseDate = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth() + index + 1, 1);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      monthYear: dateOnly(date.getFullYear(), date.getMonth() + 1, 1).slice(0, 7),
      label: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
    };
  });
}

function allocatedActiveInMonth(allocated, year, month) {
  if (allocated.active !== true) return false;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const startDate = allocated.startDate ? new Date(`${allocated.startDate}T00:00:00`) : null;
  const endDate = allocated.endDate ? new Date(`${allocated.endDate}T00:00:00`) : null;

  if (startDate && !Number.isNaN(startDate.getTime()) && startDate > monthEnd) return false;
  if (endDate && !Number.isNaN(endDate.getTime()) && endDate < monthStart) return false;
  return true;
}

function financeProjectionRows() {
  return nextProjectionMonths(6).map((monthInfo) => {
    const { businessDays, availableHours: globalAvailableHours } = businessCalendarMonthAvailability(monthInfo.year, monthInfo.month);
    const monthlyAllocateds = state.allocateds.filter((allocated) => allocatedActiveInMonth(allocated, monthInfo.year, monthInfo.month));
    const invalidAllocateds = monthlyAllocateds.filter((allocated) => !isValidProjectionAllocated(allocated));
    const validAllocateds = monthlyAllocateds.filter((allocated) => isValidProjectionAllocated(allocated));
    const operationalCost = validAllocateds.reduce((total, allocated) => (
      total + Number(allocated.hourlyRate || 0) * businessCalendarMonthAvailability(monthInfo.year, monthInfo.month, allocated.clientId).availableHours
    ), 0);
    const projectedSale = validAllocateds.reduce((total, allocated) => (
      total + Number(allocated.saleHourlyRate || 0) * businessCalendarMonthAvailability(monthInfo.year, monthInfo.month, allocated.clientId).availableHours
    ), 0);
    const projectedHours = validAllocateds.reduce((total, allocated) => (
      total + businessCalendarMonthAvailability(monthInfo.year, monthInfo.month, allocated.clientId).availableHours
    ), 0);

    return {
      ...monthInfo,
      businessDays,
      globalAvailableHours,
      projectedHours,
      allocatedCount: monthlyAllocateds.length,
      projectedAllocatedCount: validAllocateds.length,
      invalidAllocateds,
      operationalCost,
      projectedSale,
      marginPercent: projectedSale > 0 ? ((projectedSale - operationalCost) / projectedSale) * 100 : 0
    };
  });
}

function isValidProjectionAllocated(allocated) {
  const hourlyRate = Number(allocated.hourlyRate || 0);
  const saleHourlyRate = Number(allocated.saleHourlyRate || 0);
  if (!Number.isFinite(hourlyRate) || !Number.isFinite(saleHourlyRate)) return false;
  if (hourlyRate <= 0 || saleHourlyRate <= 0) return false;
  if (hourlyRate > 1000 || saleHourlyRate > 1000) return false;
  if (hourlyRate > saleHourlyRate) return false;
  return true;
}

function renderFinanceProjection() {
  const grid = $('#financeProjectionCards');
  if (!grid) return;

  const rows = financeProjectionRows();
  const summary = $('#financeProjectionSummary');
  if (summary) {
    const first = rows[0]?.label || '';
    const last = rows[rows.length - 1]?.label || '';
    summary.textContent = first && last
      ? `${first} até ${last}; calendário nacional`
      : 'Próximos 6 meses';
  }

  grid.innerHTML = rows.map((row) => `
    <button class="finance-projection-card" type="button" data-open-active-allocateds="${escapeHtml(row.monthYear)}">
      <span>${escapeHtml(row.label)}</span>
      <strong>${row.allocatedCount}</strong>
      <small>Qtde de alocados</small>
      <div class="finance-projection-values">
        <div>
          <small>Custo operacional</small>
          <b>${formatCurrency(row.operationalCost)}</b>
        </div>
        <div>
          <small>Venda projetada</small>
          <b>${formatCurrency(row.projectedSale)}</b>
        </div>
      </div>
      ${row.invalidAllocateds.length ? `
        <div class="finance-projection-alert">
          ${row.invalidAllocateds.length} cadastro(s) fora da projeção por valor inconsistente
        </div>
      ` : ''}
      <small>${row.businessDays} dias úteis / ${formatWorkHours(row.globalAvailableHours)} padrão</small>
      <small>${formatWorkHours(row.projectedHours)} projetadas no calendário</small>
      <small>Margem ${formatRatio(row.marginPercent)}</small>
    </button>
  `).join('');
}

function businessCalendarClientName(clientId) {
  if (!clientId) return 'Todos';
  return state.clients.find((client) => client.id === clientId)?.customerName || 'Cliente não encontrado';
}

function businessCalendarPeriodLabel(entry) {
  return entry.allDay ? 'Dia inteiro' : `${entry.startTime || '00:00'} - ${entry.endTime || '23:59'}`;
}

function renderBusinessCalendarOptions() {
  const startSelect = $('#businessCalendarStartTime');
  const endSelect = $('#businessCalendarEndTime');
  const options = timeOptionsHtml();
  if (startSelect && !startSelect.options.length) {
    startSelect.innerHTML = options;
    startSelect.value = '00:00';
  }
  if (endSelect && !endSelect.options.length) {
    endSelect.innerHTML = options;
    endSelect.value = '23:59';
  }

  const clientSelect = $('#businessCalendarClientSelect');
  if (clientSelect) {
    const current = clientSelect.value || '';
    clientSelect.innerHTML = '<option value="">Todos</option>' + state.clients
      .slice()
      .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
      .map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.customerName)}</option>`)
      .join('');
    clientSelect.value = current && state.clients.some((client) => client.id === current) ? current : '';
  }
}

function syncBusinessCalendarTimeState() {
  const form = $('#businessCalendarForm');
  if (!form) return;
  const allDay = form.elements.allDay?.checked ?? true;
  ['startTime', 'endTime'].forEach((fieldName) => {
    if (form.elements[fieldName]) form.elements[fieldName].disabled = allDay;
  });
}

function renderBusinessCalendar() {
  renderBusinessCalendarOptions();
  syncBusinessCalendarTimeState();
  const count = $('#businessCalendarCount');
  if (count) count.textContent = state.businessCalendar.length;
  const table = $('#businessCalendarTable');
  if (!table) return;

  const rows = (state.businessCalendar || [])
    .slice()
    .sort((first, second) => (
      String(first.date || '').localeCompare(String(second.date || ''))
      || businessCalendarClientName(first.clientId).localeCompare(businessCalendarClientName(second.clientId), 'pt-BR', { sensitivity: 'base' })
    ));

  table.innerHTML = rows.length
    ? rows.map((entry) => `
      <tr class="clickable-row" data-edit-business-calendar="${escapeHtml(entry.id)}">
        <td><strong>${escapeHtml(formatDateOnlyBR(entry.date))}</strong></td>
        <td>${escapeHtml(businessCalendarPeriodLabel(entry))}</td>
        <td>${escapeHtml(businessCalendarClientName(entry.clientId))}</td>
        <td>${escapeHtml(entry.reason || '-')}</td>
        <td>${escapeHtml(entry.observation || '-')}</td>
        <td><button class="ghost-action table-action" type="button" data-delete-business-calendar="${escapeHtml(entry.id)}">Excluir</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">Nenhum feriado cadastrado.</td></tr>';
}

function loadBusinessCalendarForEdit(entry) {
  state.editing.businessCalendarId = entry.id;
  fillForm('#businessCalendarForm', {
    date: entry.date,
    allDay: entry.allDay ? 'on' : '',
    startTime: entry.startTime || '00:00',
    endTime: entry.endTime || '23:59',
    clientId: entry.clientId || '',
    reason: entry.reason,
    observation: entry.observation
  }, 'Atualizar feriado');
  const form = $('#businessCalendarForm');
  if (form?.elements.allDay) form.elements.allDay.checked = entry.allDay === true;
  syncBusinessCalendarTimeState();
  toast('Feriado carregado para atualização.');
}

function openActiveAllocatedsFromProjection() {
  state.allocatedFilter = {
    ...state.allocatedFilter,
    type: '',
    value: '',
    status: 'active'
  };
  showView('allocateds');
  renderAllocatedFilters();
  renderAllocateds();
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
    allocateds = allocateds.filter((allocated) => (
      allocated.active === true
      && !isAllocatedAlsoActiveInCandidatePool(allocated)
    ));
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
      'ID origem': allocated.externalId || '',
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
    toast('Selecione ao menos um alocado para gerar os formulários.');
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
      toast('Formulários gerados.');
  } catch (error) {
    toast(error.message || 'Não foi possível gerar os formulários.');
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
          <td>${allocated.externalId || '-'}</td>
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
          <td>${allocated.active ? 'Sim' : 'Não'}</td>
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

function workHourAllocatedOptions() {
  const rows = isCurrentUserAdmin()
    ? state.allocateds.filter((allocated) => allocated.active === true)
    : activeAllocatedsForCurrentUser();
  return rows
    .slice()
    .sort((first, second) => String(first.consultant || '').localeCompare(String(second.consultant || ''), 'pt-BR', { sensitivity: 'base' }));
}

function workHourClientName(allocatedId) {
  const allocated = state.allocateds.find((item) => item.id === allocatedId);
  const client = state.clients.find((item) => item.id === allocated?.clientId);
  return allocated?.clientName || client?.customerName || '';
}

function formatWorkHours(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '-';
  const sign = number < 0 ? '-' : '';
  const absolute = Math.abs(number);
  const hours = Math.trunc(absolute);
  const minutes = Math.round((absolute - hours) * 60);
  return `${sign}${hours}H${String(minutes).padStart(2, '0')}`;
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function renderWorkHourSelectors() {
  const allocateds = workHourAllocatedOptions();
  const options = allocateds.map((allocated) => {
    const clientName = workHourClientName(allocated.id);
    return `<option value="${escapeHtml(allocated.id)}">${escapeHtml([allocated.consultant, clientName].filter(Boolean).join(' - '))}</option>`;
  }).join('');

  ['#workHourAllocatedSelect', '#workHourCloseAllocatedSelect'].forEach((selector) => {
    const select = $(selector);
    if (!select) return;
    const current = select.value || allocateds[0]?.id || '';
    select.innerHTML = options || '<option value="">Nenhum alocado ativo disponível</option>';
    select.value = allocateds.some((allocated) => allocated.id === current) ? current : allocateds[0]?.id || '';
  });

  const filterAllocated = $('#workHourFilterAllocated');
  if (filterAllocated) {
    const current = state.workHourFilter.allocatedId || filterAllocated.value || '';
    filterAllocated.innerHTML = '<option value="">Todos</option>' + options;
    filterAllocated.value = allocateds.some((allocated) => allocated.id === current) ? current : '';
    state.workHourFilter.allocatedId = filterAllocated.value;
  }

  const filterClient = $('#workHourFilterClient');
  if (filterClient) {
    const clientIds = new Set(allocateds.map((allocated) => allocated.clientId).filter(Boolean));
    const current = state.workHourFilter.clientId || filterClient.value || '';
    filterClient.innerHTML = '<option value="">Todos</option>' + state.clients
      .filter((client) => clientIds.has(client.id))
      .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
      .map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.customerName)}</option>`)
      .join('');
    filterClient.value = clientIds.has(current) ? current : '';
    state.workHourFilter.clientId = filterClient.value;
  }

  const selectedAllocatedId = $('#workHourAllocatedSelect')?.value || '';
  const clientField = $('#workHourClientName');
  if (clientField) clientField.value = workHourClientName(selectedAllocatedId);

  const closeMonth = $('#workHourCloseMonth');
  if (closeMonth && !closeMonth.value) closeMonth.value = currentMonthValue();
  renderWorkHourClosureStatus();
}

function getFilteredWorkHours() {
  const allowedAllocatedIds = new Set(workHourAllocatedOptions().map((allocated) => allocated.id));
  let rows = state.workHours.filter((entry) => allowedAllocatedIds.has(entry.allocatedId));
  const { allocatedId, clientId, dateFrom, dateTo } = state.workHourFilter;

  if (allocatedId) rows = rows.filter((entry) => entry.allocatedId === allocatedId);
  if (clientId) rows = rows.filter((entry) => entry.clientId === clientId);
  if (dateFrom) rows = rows.filter((entry) => String(entry.date || '') >= dateFrom);
  if (dateTo) rows = rows.filter((entry) => String(entry.date || '') <= dateTo);

  return rows.sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')));
}

function workHourCsvRows(rows = getFilteredWorkHours()) {
  return rows.map((entry) => ({
    allocatedId: entry.allocatedId || '',
    Consultor: entry.consultantName || '',
    Data: entry.date || '',
    'Horas Trabalhadas': formatWorkHours(entry.hours),
    Cliente: workHourClientName(entry.allocatedId),
    Projeto: entry.project || '',
    Observacao: entry.observation || ''
  }));
}

function renderWorkHourClosureStatus() {
  const element = $('#workHourClosureStatus');
  if (!element) return;
  const allocatedId = $('#workHourCloseAllocatedSelect')?.value || '';
  const monthYear = $('#workHourCloseMonth')?.value || '';
  const closure = state.workHourClosures.find((item) => item.allocatedId === allocatedId && item.monthYear === monthYear);
  if (!allocatedId || !monthYear) {
    element.textContent = '';
    return;
  }
  if (!closure) {
    element.textContent = 'Período ainda não finalizado.';
    return;
  }
  const missing = closure.missingBusinessDays?.length
    ? ` Dias úteis sem apontamento: ${closure.missingBusinessDays.join(', ')}.`
    : ' Todos os dias úteis preenchidos.';
  const finalizedAt = new Date(closure.finalizedAt || closure.updatedAt || Date.now());
  element.textContent = `Finalizado em ${formatDateTimeBR(finalizedAt)}.${missing}`;
}

function renderWorkHours() {
  renderWorkHourSelectors();
  const accessSummary = $('#workHourAccessSummary');
  if (accessSummary) {
    accessSummary.textContent = isCurrentUserAdmin()
      ? 'Admin: consulta, importação e exportação geral'
      : 'Consultor: apontamento dos seus contratos ativos';
  }

  const rows = getFilteredWorkHours();
  const count = $('#workHourCount');
  if (count) count.textContent = rows.length;
  const table = $('#workHourTable');
  if (!table) return;

  table.innerHTML = rows.map((entry) => `
    <tr>
      <td>${escapeHtml(entry.consultantName || '-')}</td>
      <td>${escapeHtml(entry.date || '-')}</td>
      <td>${escapeHtml(formatWorkHours(entry.hours))}</td>
      <td>${escapeHtml(workHourClientName(entry.allocatedId) || '-')}</td>
      <td>${escapeHtml(entry.project || '-')}</td>
      <td>${escapeHtml(entry.observation || '-')}</td>
    </tr>
  `).join('');
}

function parseWorkHourCsv(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map((header) => normalizeText(header));
  const keyFor = (aliases) => headers.findIndex((header) => aliases.includes(header));
  const indexes = {
    allocatedId: keyFor(['allocatedid', 'consultorid', 'idconsultor', 'id']),
    date: keyFor(['date', 'data']),
    hours: keyFor(['hours', 'horas', 'horastrabalhadas', 'horas trabalhadas']),
    project: keyFor(['project', 'projeto']),
    observation: keyFor(['observation', 'observacao'])
  };
  return lines.slice(1).map((line) => {
    const cells = line.split(separator).map((cell) => cell.trim());
    return {
      allocatedId: cells[indexes.allocatedId] || '',
      date: cells[indexes.date] || '',
      hours: String(cells[indexes.hours] || '').replace(',', '.'),
      project: indexes.project >= 0 ? cells[indexes.project] || '' : '',
      observation: indexes.observation >= 0 ? cells[indexes.observation] || '' : ''
    };
  });
}

async function importWorkHoursFromFile(button) {
  const file = $('#workHourImportFile')?.files?.[0];
  if (!file) {
    toast('Selecione um arquivo CSV para importar.');
    return;
  }
  const originalText = setSubmitButtonBusy(button, 'Importando...');
  try {
    const rows = parseWorkHourCsv(await file.text());
    const result = await api('/api/work-hours/import', {
      method: 'POST',
      body: JSON.stringify({ rows })
    });
    await refresh();
    toast(`${result.imported || 0} apontamento(s) importado(s).`);
  } catch (error) {
    toast(error.message || 'Não foi possível importar as horas.');
  } finally {
    restoreSubmitButton(button, originalText || 'Importar CSV');
  }
}

async function finalizeWorkHourPeriod(button, confirmMissingDays = false) {
  const allocatedId = $('#workHourCloseAllocatedSelect')?.value || '';
  const monthYear = $('#workHourCloseMonth')?.value || '';
  if (!allocatedId || !monthYear) {
    toast('Informe consultor e mês para finalizar.');
    return;
  }

  const originalText = setSubmitButtonBusy(button, 'Finalizando...');
  try {
    const response = await fetch('/api/work-hours/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {})
      },
      body: JSON.stringify({ allocatedId, monthYear, confirmMissingDays })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 409 && payload.missingBusinessDays?.length) {
      const confirmed = window.confirm(`Existem dias úteis sem apontamento: ${payload.missingBusinessDays.join(', ')}. Deseja finalizar mesmo assim?`);
      if (confirmed) {
        await finalizeWorkHourPeriod(button, true);
      }
      return;
    }
    if (!response.ok) {
      throw new Error(repairEncodingArtifacts(payload.error || 'Não foi possível finalizar o período.'));
    }
    upsertStateItem('workHourClosures', sanitizeApiPayload(payload));
    renderWorkHours();
    toast('Período finalizado e ADMINs notificados.');
  } catch (error) {
    toast(error.message || 'Não foi possível finalizar o período.');
  } finally {
    restoreSubmitButton(button, originalText || 'Finalizar período');
  }
}

function billingReportRows() {
  const grouped = new Map();
  for (const entry of state.workHours || []) {
    const allocated = state.allocateds.find((item) => item.id === entry.allocatedId);
    if (!allocated) continue;
    const monthYear = String(entry.date || '').slice(0, 7);
    if (!monthYear) continue;
    const key = `${entry.allocatedId}|${monthYear}`;
    const current = grouped.get(key) || {
      allocated,
      client: state.clients.find((item) => item.id === allocated.clientId),
      monthYear,
      hours: 0
    };
    current.hours += Number(entry.hours || 0);
    grouped.set(key, current);
  }

  let rows = Array.from(grouped.values()).map((row) => {
    const saleHourlyRate = Number(row.allocated.saleHourlyRate || 0);
    const closure = state.workHourClosures.find((item) => item.allocatedId === row.allocated.id && item.monthYear === row.monthYear);
    const [year, month] = String(row.monthYear || '').split('-').map(Number);
    const calendarHours = year && month
      ? businessCalendarMonthAvailability(year, month, row.allocated.clientId).availableHours
      : 0;
    return {
      ...row,
      saleHourlyRate,
      calendarHours,
      hourBalance: Number((row.hours - calendarHours).toFixed(2)),
      total: Number((row.hours * saleHourlyRate).toFixed(2)),
      closureStatus: closure ? 'Finalizado' : 'Aberto'
    };
  });

  const { monthYear, clientId, allocatedId } = state.billingReportFilter;
  if (monthYear) rows = rows.filter((row) => row.monthYear === monthYear);
  if (clientId) rows = rows.filter((row) => row.allocated.clientId === clientId);
  if (allocatedId) rows = rows.filter((row) => row.allocated.id === allocatedId);

  return rows.sort((first, second) => (
    String(first.client?.customerName || '').localeCompare(String(second.client?.customerName || ''), 'pt-BR', { sensitivity: 'base' })
    || String(first.allocated.consultant || '').localeCompare(String(second.allocated.consultant || ''), 'pt-BR', { sensitivity: 'base' })
    || String(second.monthYear || '').localeCompare(String(first.monthYear || ''))
  ));
}

function renderBillingReportFilters() {
  const monthFilter = $('#billingReportMonthFilter');
  if (monthFilter) monthFilter.value = state.billingReportFilter.monthYear || '';

  const clientFilter = $('#billingReportClientFilter');
  if (clientFilter) {
    const clientIds = new Set((state.workHours || []).map((entry) => {
      const allocated = state.allocateds.find((item) => item.id === entry.allocatedId);
      return allocated?.clientId || '';
    }).filter(Boolean));
    const current = state.billingReportFilter.clientId || '';
    clientFilter.innerHTML = '<option value="">Todos</option>' + state.clients
      .filter((client) => clientIds.has(client.id))
      .sort((first, second) => first.customerName.localeCompare(second.customerName, 'pt-BR', { sensitivity: 'base' }))
      .map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.customerName)}</option>`)
      .join('');
    clientFilter.value = clientIds.has(current) ? current : '';
    state.billingReportFilter.clientId = clientFilter.value;
  }

  const allocatedFilter = $('#billingReportAllocatedFilter');
  if (allocatedFilter) {
    const allocatedIds = new Set((state.workHours || []).map((entry) => entry.allocatedId).filter(Boolean));
    const current = state.billingReportFilter.allocatedId || '';
    allocatedFilter.innerHTML = '<option value="">Todos</option>' + state.allocateds
      .filter((allocated) => allocatedIds.has(allocated.id))
      .sort((first, second) => String(first.consultant || '').localeCompare(String(second.consultant || ''), 'pt-BR', { sensitivity: 'base' }))
      .map((allocated) => `<option value="${escapeHtml(allocated.id)}">${escapeHtml(allocated.consultant || allocated.code || allocated.id)}</option>`)
      .join('');
    allocatedFilter.value = allocatedIds.has(current) ? current : '';
    state.billingReportFilter.allocatedId = allocatedFilter.value;
  }
}

function renderBillingEntrySelectors() {
  const select = $('#billingEntryAllocatedSelect');
  if (!select) return;

  const allocateds = workHourAllocatedOptions();
  const current = select.value || allocateds[0]?.id || '';
  select.innerHTML = allocateds.length
    ? allocateds.map((allocated) => {
      const clientName = workHourClientName(allocated.id);
      return `<option value="${escapeHtml(allocated.id)}">${escapeHtml([allocated.consultant, clientName].filter(Boolean).join(' - '))}</option>`;
    }).join('')
    : '<option value="">Nenhum alocado ativo disponível</option>';
  select.value = allocateds.some((allocated) => allocated.id === current) ? current : allocateds[0]?.id || '';

  const clientField = $('#billingEntryClientName');
  if (clientField) clientField.value = workHourClientName(select.value);

  const summary = $('#billingEntryAccessSummary');
  if (summary) {
    summary.textContent = isCurrentUserAdmin()
      ? 'Admin: apontamento para todos os consultores ativos'
      : 'Apontamento restrito ao seu contrato ativo';
  }
}

function renderBillingReportPanels() {
  const activePanel = ['query', 'entry'].includes(state.activeBillingReportPanel)
    ? state.activeBillingReportPanel
    : 'query';
  state.activeBillingReportPanel = activePanel;

  $$('[data-billing-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.billingPanel !== activePanel;
  });
}

function billingReportCsvRows(rows = billingReportRows()) {
  return rows.map((row) => ({
    Cliente: row.client?.customerName || '',
    Consultor: row.allocated.consultant || '',
    Mes: row.monthYear,
    'Horas apontadas': row.hours,
    'Horas calendario': row.calendarHours,
    'Saldo horas': row.hourBalance,
    'Valor hora venda': formatCurrency(row.saleHourlyRate),
    'Total billing': formatCurrency(row.total),
    'Status fechamento': row.closureStatus
  }));
}

function renderBillingReport() {
  renderBillingReportPanels();
  renderBillingEntrySelectors();
  renderBillingReportFilters();
  const rows = billingReportRows();
  const count = $('#billingReportCount');
  if (count) count.textContent = rows.length;
  const table = $('#billingReportTable');
  if (!table) return;

  if (!rows.length) {
    table.innerHTML = '<tr><td colspan="9">Nenhum apontamento encontrado para o filtro atual.</td></tr>';
    return;
  }

  table.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.client?.customerName || '-')}</td>
      <td>${escapeHtml(row.allocated.consultant || '-')}</td>
      <td>${escapeHtml(row.monthYear || '-')}</td>
      <td>${escapeHtml(formatWorkHours(row.hours))}</td>
      <td>${escapeHtml(formatWorkHours(row.calendarHours))}</td>
      <td>${escapeHtml(formatWorkHours(row.hourBalance))}</td>
      <td>${escapeHtml(formatCurrency(row.saleHourlyRate))}</td>
      <td>${escapeHtml(formatCurrency(row.total))}</td>
      <td>${escapeHtml(row.closureStatus)}</td>
    </tr>
  `).join('');
}

function rateCardMaximum(rate) {
  return Number((Number(rate || 0) * 0.7).toFixed(2));
}

function formatRateValue(value) {
  return formatCurrency(value);
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
  const rate = parseCurrencyInput(form.elements.rate?.value || 0);
  const maximumField = form.elements.maximum;
  if (maximumField) maximumField.value = rate ? formatCurrencyInput(rateCardMaximum(rate)) : '';
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

function candidatePoolStatus(item) {
  if (item.status) return item.status;
  return item.active === false ? 'Inativo' : 'Ativo';
}

function candidatePoolIsAvailable(item) {
  return candidatePoolStatus(item) === 'Ativo';
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
          <td>${escapeHtml(candidatePoolStatus(item))}</td>
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
    .filter((client) => client.active !== false)
    .sort((first, second) => String(first.customerName || '').localeCompare(String(second.customerName || ''), 'pt-BR', { sensitivity: 'base' }))
    .map((client) => `<option value="${client.id}">${escapeHtml(client.customerName || client.id)}</option>`)
    .join('');
  clientSelect.innerHTML = clientOptions;
  const opportunityOptions = '<option value="">Todos</option>' + state.opportunities
    .slice()
    .filter((opportunity) => opportunity.status === 'Open')
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
  if (
    (isClientFilter && state.selectedCandidateFilter.value && clientSelect.value !== state.selectedCandidateFilter.value)
    || (isOpportunityFilter && state.selectedCandidateFilter.value && opportunitySelect.value !== state.selectedCandidateFilter.value)
  ) {
    state.selectedCandidateFilter.value = '';
    clientSelect.value = '';
    opportunitySelect.value = '';
  }

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
          <td>${String(user.emailSignature || '').trim() ? 'Sim' : 'Não'}</td>
          <td>${user.mustChangePassword ? 'Sim' : 'Não'}</td>
        </tr>
      `
    )
    .join('');
}

function formDefinitionOptionLabel(definition) {
  return `${definition.title} (${definition.fields?.length || 0} campo(s))`;
}

function activeFormDefinitions() {
  return (state.formDefinitions || [])
    .filter((definition) => definition.active !== false)
    .slice()
    .sort((first, second) => String(first.title || '').localeCompare(String(second.title || ''), 'pt-BR', { sensitivity: 'base' }));
}

function currentFormDefinition() {
  const select = $('#formRequestDefinitionSelect');
  return state.formDefinitions.find((definition) => definition.id === select?.value && definition.active !== false) || null;
}

function renderFormRequestPicker() {
  const picker = $('#formRequestPicker');
  const form = $('#formRequestForm');
  const selectedTitle = $('#formRequestSelectedTitle');
  const select = $('#formRequestDefinitionSelect');
  if (!picker || !form || !select) return;

  const definitions = activeFormDefinitions();
  const selectedDefinition = currentFormDefinition();
  if (select.value && !selectedDefinition) {
    select.value = '';
  }

  if (!definitions.length) {
    picker.hidden = false;
    form.hidden = true;
    picker.innerHTML = '<p class="empty-state">Nenhum formulário ativo disponível para requisição.</p>';
    if (selectedTitle) selectedTitle.textContent = '';
    select.value = '';
    return;
  }

  if (selectedDefinition) {
    picker.hidden = true;
    form.hidden = false;
    if (selectedTitle) selectedTitle.textContent = state.editing.formRequestId ? `Ajustar ${selectedDefinition.title || 'Formulário'}` : selectedDefinition.title || 'Formulário';
    return;
  }

  picker.hidden = false;
  form.hidden = true;
  if (selectedTitle) selectedTitle.textContent = '';
  picker.innerHTML = definitions.map((definition) => `
    <button class="module-card form-request-card" type="button" data-select-form-request="${escapeHtml(definition.id)}">
      <strong>${escapeHtml(definition.title || '-')}</strong>
    </button>
  `).join('');
}

function renderFormRequestOtherFields(root = $('#formRequestFields')) {
  if (!root) return;
  $$('[data-other-field-for]', root).forEach((otherField) => {
    const source = $(`[name="field_${otherField.dataset.otherFieldFor}"]`, root);
    const shouldShow = source?.value === 'Outro';
    otherField.hidden = !shouldShow;
    const input = $('input, textarea', otherField);
    if (!shouldShow && input) input.value = '';
  });
}

function renderFormRequestFields() {
  const shell = $('#formRequestFields');
  const definition = currentFormDefinition();
  if (!shell) return;

  if (!definition) {
    shell.innerHTML = '';
    return;
  }

  shell.innerHTML = (definition.fields || []).map((field) => {
    const required = field.required ? 'required' : '';
    const label = `${escapeHtml(field.label)}${field.required ? ' *' : ''}`;
    if (field.type === 'lista') {
      const options = (field.options || []).map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      const otherOption = field.otherObservation ? '<option value="Outro">Outro</option>' : '';
      return `
        <label>${label}<select name="field_${field.id}" ${required}>
          <option value="">Selecione</option>
          ${options}
          ${otherOption}
        </select></label>
        ${field.otherObservation ? `<label class="form-request-other-field" data-other-field-for="${escapeHtml(field.id)}" hidden>Observação - ${escapeHtml(field.label)}<input name="field_${field.id}_other" /></label>` : ''}
      `;
    }
    if (field.type === 'arquivo') {
      return `<label>${label}<input name="field_${field.id}" type="file" ${required} /></label>`;
    }
    if (field.type === 'textarea') {
      return `<label>${label}<textarea name="field_${field.id}" rows="3" ${required}></textarea></label>`;
    }
    if (field.type === 'moeda') {
      return `<label>${label}<input class="currency-input" name="field_${field.id}" inputmode="decimal" placeholder="R$ 0,00" ${required} /></label>`;
    }
    const type = field.type === 'numero' ? 'number' : field.type === 'data' ? 'date' : field.type === 'email' ? 'email' : 'text';
    return `<label>${label}<input name="field_${field.id}" type="${type}" ${required} /></label>`;
  }).join('');
  bindCurrencyInputs(shell);
  renderFormRequestOtherFields(shell);
}

function collectFormRequestPayload(form, definition, existingRequest = null) {
  const values = {};
  const files = [];
  for (const field of definition.fields || []) {
    const element = form.elements[`field_${field.id}`];
    if (element?.type === 'file') {
      const file = element.files?.[0];
      if (file) {
        files.push({ fieldId: field.id, file });
        values[field.id] = {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size
        };
      } else {
        values[field.id] = existingRequest?.values?.[field.id] || '';
      }
    } else {
      values[field.id] = element?.classList?.contains('currency-input')
        ? formatCurrencyInput(parseCurrencyInput(element.value))
        : element?.value || '';
    }
    if (field.otherObservation) {
      const otherValue = form.elements[`field_${field.id}_other`]?.value || '';
      if (element?.value === 'Outro' && otherValue) {
        values[`${field.id}_other`] = otherValue;
      }
    }
  }
  return { values, files };
}

async function fileToDataUrl(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

async function attachFormRequestFiles(values, files) {
  for (const item of files || []) {
    values[item.fieldId] = {
      name: item.file.name,
      type: item.file.type || 'application/octet-stream',
      size: item.file.size,
      dataUrl: await fileToDataUrl(item.file),
      uploadedAt: new Date().toISOString()
    };
  }
  return values;
}

function buildFormRequestBody(definition, values, extra = {}) {
  return JSON.stringify({
    formDefinitionId: definition.id,
    values,
    ...extra
  });
}

function fillFormRequestValues(requestItem, definition) {
  const form = $('#formRequestForm');
  if (!form || !requestItem || !definition) return;
  for (const field of definition.fields || []) {
    const element = form.elements[`field_${field.id}`];
    if (!element || element.type === 'file') continue;
    const value = requestItem.values?.[field.id] || '';
    element.value = element.classList?.contains('currency-input') ? formatCurrencyInput(parseCurrencyInput(value)) : value;
    if (field.otherObservation) {
      const otherElement = form.elements[`field_${field.id}_other`];
      if (otherElement) otherElement.value = requestItem.values?.[`${field.id}_other`] || '';
    }
  }
  renderFormRequestOtherFields();
}

function openFormRequestAdjustment(requestItem) {
  const definition = state.formDefinitions.find((item) => item.id === requestItem?.formDefinitionId);
  const select = $('#formRequestDefinitionSelect');
  if (!requestItem || !definition || !select) return;
  state.activeFormsPanel = 'request';
  state.editing.formRequestId = requestItem.id;
  select.value = definition.id;
  renderFormsPanel();
  fillFormRequestValues(requestItem, definition);
  const submitButton = $('button[type="submit"]', $('#formRequestForm'));
  if (submitButton) submitButton.textContent = formRequestCurrentAction(requestItem) === 'Ajuste' ? 'Enviar ajuste' : 'Salvar alterações';
}

function canDecideFormRequest(requestItem) {
  if (!requestItem) return false;
  const status = String(requestItem.status || '').toLowerCase();
  if (!status.includes('pendente') && status !== 'em processamento') return false;
  const currentEmail = String(state.currentUser?.email || session.user?.email || '').trim().toLowerCase();
  const approverEmail = String(requestItem.currentApproverEmail || '').trim().toLowerCase();
  return Boolean(currentEmail && approverEmail && approverEmail === currentEmail);
}

function isFormRequestInProcessing(requestItem) {
  return String(requestItem?.status || '').toLowerCase() === 'em processamento';
}

function normalizeWorkflowActionLabel(action) {
  const value = String(action || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (value.includes('ajuste') || value.includes('corrigir') || value.includes('correcao')) return 'Ajuste';
  if (value.includes('process')) return 'Processado';
  if (value.includes('final')) return 'Finalizado';
  return 'Aprovar';
}

function formRequestCurrentAction(requestItem) {
  if (requestItem?.currentAction) return requestItem.currentAction;
  const definition = state.formDefinitions.find((item) => item.id === requestItem?.formDefinitionId);
  return definition?.workflowSteps?.[requestItem?.currentStepIndex || 0]?.action || 'Aprovar';
}

function formRequestSlaLabel(requestItem) {
  const slaDays = Number(requestItem?.currentSlaDays || 0);
  if (!requestItem?.currentDueAt) return slaDays ? `${slaDays} dia(s)` : '-';
  const dueDate = new Date(requestItem.currentDueAt);
  if (!Number.isFinite(dueDate.getTime())) return slaDays ? `${slaDays} dia(s)` : '-';
  const overdue = dueDate.getTime() < Date.now();
  const prefix = slaDays ? `${slaDays} dia(s) - ` : '';
  return `${prefix}${dueDate.toLocaleDateString('pt-BR')}${overdue ? ' vencida' : ''}`;
}

function formRequestElapsedLabel(requestItem) {
  const startedAt = requestItem?.currentStepStartedAt || requestItem?.processingStartedAt || requestItem?.createdAt;
  const startDate = new Date(startedAt || '');
  if (!Number.isFinite(startDate.getTime())) return '-';
  const elapsedMs = Math.max(0, Date.now() - startDate.getTime());
  const elapsedHours = Math.floor(elapsedMs / (60 * 60 * 1000));
  const elapsedDays = Math.floor(elapsedHours / 24);
  const remainingHours = elapsedHours % 24;
  if (elapsedDays > 0) return `${elapsedDays} dia(s) ${remainingHours}h`;
  return `${elapsedHours}h`;
}

function formRequestFieldDisplayValue(field, requestItem) {
  const value = requestItem?.values?.[field.id];
  if (field.type === 'arquivo') {
    if (value && typeof value === 'object') {
      return value.name || 'Arquivo anexado';
    }
    if (String(value || '') === '[object Object]') {
      return 'Arquivo sem conteúdo armazenado';
    }
    return value || '-';
  }
  return value || '-';
}

function renderFormRequestAttachment(field, requestItem) {
  const value = requestItem?.values?.[field.id];
  if (field.type !== 'arquivo') return '';
  const fileUrl = value && typeof value === 'object' ? value.url || value.dataUrl : '';
  if (fileUrl) {
    return `
      <div class="stage-actions form-request-attachment-actions">
        <a class="secondary-action compact-action" href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener">Abrir</a>
        <a class="secondary-action compact-action" href="${escapeHtml(fileUrl)}" download="${escapeHtml(value.name || 'anexo')}">Baixar</a>
      </div>
    `;
  }
  if (String(value || '') === '[object Object]') {
    return '<small class="muted-text">Este anexo foi gravado sem conteúdo. Reanexe o arquivo para habilitar abrir/baixar.</small>';
  }
  if (value) {
    return '<small class="muted-text">Arquivo legado sem conteúdo armazenado para download.</small>';
  }
  return '';
}

function formRequestObservationsForRequest(requestItem) {
  const requestId = String(requestItem?.id || '');
  const observationKey = (observation = {}) => [
    observation.requestId || '',
    observation.date || observation.createdAt || '',
    observation.userId || observation.userEmail || observation.userName || '',
    observation.action || '',
    observation.observation || ''
  ].map((part) => String(part).trim()).join('|');
  const stored = (state.formRequestObservations || [])
    .filter((observation) => String(observation.requestId || '') === requestId);
  const storedKeys = new Set(stored.map((observation) => observationKey(observation)));
  const legacy = (Array.isArray(requestItem?.history) ? requestItem.history : [])
    .filter((entry) => String(entry.observation || '').trim())
    .map((entry) => ({
      id: entry.id || [
        requestId,
        entry.date || entry.createdAt,
        entry.userId || entry.userName,
        entry.observation
      ].join('|'),
      requestId,
      observation: entry.observation,
      date: entry.date || entry.createdAt || requestItem.createdAt,
      userId: entry.userId || '',
      userName: entry.userName || '',
      userEmail: entry.userEmail || '',
      action: entry.status || ''
    }))
    .filter((observation) => !storedKeys.has(observationKey(observation)));
  return stored.concat(legacy)
    .filter((observation) => String(observation.observation || '').trim())
    .sort((left, right) => String(left.date || '').localeCompare(String(right.date || '')));
}

function renderFormRequestObservations(requestItem) {
  const observations = formRequestObservationsForRequest(requestItem);
  if (!observations.length) {
    return '<p class="empty-state">Nenhuma observação registrada.</p>';
  }
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Usuário</th>
            <th>Ação</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          ${observations.map((observation) => `
            <tr>
              <td>${formatObservationDate(observation.date || observation.createdAt)}</td>
              <td>${escapeHtml(observation.userName || observation.userEmail || observation.userId || '-')}</td>
              <td>${escapeHtml(observation.action || '-')}</td>
              <td>${escapeHtml(observation.observation || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderFormRequestDetail(requestItem) {
  const panel = $('#formRequestDetailPanel');
  if (!panel) return;
  const definition = state.formDefinitions.find((item) => item.id === requestItem?.formDefinitionId);
  if (!requestItem || !definition) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }

  const fields = (definition.fields || []).map((field) => `
    <div class="detail-field">
      <strong>${escapeHtml(field.label || '-')}</strong>
      <span>${escapeHtml(formRequestFieldDisplayValue(field, requestItem))}</span>
      ${renderFormRequestAttachment(field, requestItem)}
    </div>
  `).join('');
  panel.hidden = false;
  panel.innerHTML = `
    <div class="panel-heading compact-heading">
      <h3>${escapeHtml(requestItem.formTitle || definition.title || 'Requisição')}</h3>
      <button class="secondary-action compact-action" type="button" data-close-form-request-detail>Fechar</button>
    </div>
    <div class="form-request-detail-grid">
      <div class="detail-field"><strong>Status</strong><span>${escapeHtml(requestItem.status || '-')}</span></div>
      <div class="detail-field"><strong>Solicitante</strong><span>${escapeHtml(requestItem.requesterName || '-')}</span></div>
      <div class="detail-field"><strong>Responsável atual</strong><span>${escapeHtml(requestItem.currentApproverEmail || '-')}</span></div>
      <div class="detail-field"><strong>Pagto previsto</strong><span>${requestItem.expectedPaymentDate ? new Date(`${requestItem.expectedPaymentDate}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</span></div>
      ${fields}
    </div>
    <div class="form-request-observations">
      <h4>Observações</h4>
      ${renderFormRequestObservations(requestItem)}
    </div>
  `;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function normalizePromptDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return text;
}

function requestFormDecisionDetails(decision) {
  if (decision === 'approve') {
    const observation = window.prompt('Observação da aprovação:', '') ?? null;
    if (observation === null) return null;
    const expectedPaymentDate = window.prompt('Data prevista para pagamento (aaaa-mm-dd):', new Date().toISOString().slice(0, 10)) ?? null;
    if (expectedPaymentDate === null) return null;
    return { observation, expectedPaymentDate: normalizePromptDate(expectedPaymentDate) };
  }
  if (decision === 'finish') {
    const observation = window.prompt('Observação de finalização:', '') ?? null;
    if (observation === null) return null;
    return { observation };
  }
  if (decision === 'process') {
    const observation = window.prompt('Observação do processamento:', '') ?? null;
    if (observation === null) return null;
    const expectedPaymentDate = window.prompt('Data prevista para pagamento (aaaa-mm-dd):', new Date().toISOString().slice(0, 10)) ?? null;
    if (expectedPaymentDate === null) return null;
    return { observation, expectedPaymentDate: normalizePromptDate(expectedPaymentDate) };
  }
  if (decision === 'reject') {
    const observation = window.prompt('Observação da reprovação:', '') ?? null;
    if (observation === null) return null;
    return { observation };
  }
  return {};
}

function renderFormRequestActions(requestItem) {
  const openButton = `<button class="secondary-action compact-action" type="button" data-open-form-request="${escapeHtml(requestItem.id)}">Abrir</button>`;
  if (!canDecideFormRequest(requestItem)) return openButton;
  const action = normalizeWorkflowActionLabel(formRequestCurrentAction(requestItem));
  if (action === 'Ajuste') {
    return `<div class="stage-actions">${openButton}<button class="primary-action compact-action" type="button" data-adjust-form-request="${escapeHtml(requestItem.id)}">Ajustar</button></div>`;
  }
  if (action === 'Processado') {
    return `
      <div class="stage-actions">
        ${openButton}
        <button class="primary-action compact-action" type="button" data-process-form-request="${escapeHtml(requestItem.id)}">Processado</button>
        <button class="danger-action compact-action" type="button" data-reject-form-request="${escapeHtml(requestItem.id)}">Reprovar</button>
      </div>
    `;
  }
  if (action === 'Finalizado') {
    return `<div class="stage-actions">${openButton}<button class="primary-action compact-action" type="button" data-finish-form-request="${escapeHtml(requestItem.id)}">Finalizar</button></div>`;
  }
  return `
    <div class="stage-actions">
      ${openButton}
      <button class="primary-action compact-action" type="button" data-approve-form-request="${escapeHtml(requestItem.id)}">Aprovar</button>
      <button class="danger-action compact-action" type="button" data-reject-form-request="${escapeHtml(requestItem.id)}">Reprovar</button>
    </div>
  `;
}

function renderFormRequests() {
  const table = $('#formRequestTable');
  const count = $('#formRequestCount');
  const title = $('#formRequestPanelTitle');
  if (!table || !count) return;

  const allRequests = state.activeFormsPanel === 'pending'
    ? (state.formRequests || []).filter(canDecideFormRequest)
    : (state.formRequests || []);
  const requests = allRequests.slice().sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)));
  if (title) {
    title.textContent = state.activeFormsPanel === 'pending'
      ? 'Requisições Pendentes'
      : isCurrentUserAdmin() ? 'Todas as requisições' : 'Minhas requisições';
  }
  count.textContent = requests.length;
  table.innerHTML = requests.length
    ? requests.map((requestItem) => `
      <tr>
        <td><strong>${escapeHtml(requestItem.formTitle || '-')}</strong></td>
        <td>${escapeHtml(requestItem.requesterName || '-')}</td>
        <td>${escapeHtml(requestItem.status || '-')}</td>
        <td>${escapeHtml(requestItem.currentApproverEmail || '-')}</td>
        <td>${escapeHtml(formRequestSlaLabel(requestItem))}</td>
        <td>${escapeHtml(formRequestElapsedLabel(requestItem))}</td>
        <td>${requestItem.expectedPaymentDate ? new Date(`${requestItem.expectedPaymentDate}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
        <td>${requestItem.createdAt ? new Date(requestItem.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
        <td>${renderFormRequestActions(requestItem)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="9">${state.activeFormsPanel === 'pending' ? 'Nenhuma requisição pendente para sua ação.' : 'Nenhuma requisição cadastrada.'}</td></tr>`;
}

function renderFormDefinitions() {
  const count = $('#formDefinitionCount');
  const table = $('#formDefinitionTable');
  if (!count || !table) return;

  const definitions = (state.formDefinitions || [])
    .slice()
    .sort((first, second) => String(first.title || '').localeCompare(String(second.title || ''), 'pt-BR', { sensitivity: 'base' }));

  count.textContent = definitions.length;
  table.innerHTML = definitions.length
    ? definitions.map((definition) => `
      <tr class="clickable-row" data-edit-form-definition="${escapeHtml(definition.id)}">
        <td><strong>${escapeHtml(definition.title || '-')}</strong><br>${escapeHtml(definition.description || '')}</td>
        <td>${definition.fields?.length || 0}</td>
        <td>${definition.workflowSteps?.length || 0}</td>
        <td>${definition.active === false ? 'Não' : 'Sim'}</td>
        <td>${definition.updatedAt ? new Date(definition.updatedAt).toLocaleDateString('pt-BR') : '-'}</td>
        <td><button class="danger-action compact-action" type="button" data-delete-form-definition="${escapeHtml(definition.id)}">Excluir</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">Nenhum formulário cadastrado.</td></tr>';
}

function adminUserOptions(selectedEmail = '') {
  const admins = (state.users || []).filter((user) => String(user.role || '').toLowerCase() === 'admin');
  return '<option value="">Selecione</option>' + admins
    .map((user) => `<option value="${escapeHtml(user.email)}" ${user.email === selectedEmail ? 'selected' : ''}>${escapeHtml(user.name)} - ${escapeHtml(user.email)}</option>`)
    .join('');
}

function workflowResponsibleOptions(selectedEmail = '') {
  return `<option value="__requester__" ${selectedEmail === '__requester__' ? 'selected' : ''}>Solicitante da requisição</option>${adminUserOptions(selectedEmail)}`;
}

function addFormFieldBuilderRow(data = {}) {
  const shell = $('#formFieldBuilderRows');
  if (!shell) return;
  const row = document.createElement('div');
  row.className = 'form-builder-row form-field-builder-row';
  row.innerHTML = `
    <label>Nome do campo<input data-form-field-label value="${escapeHtml(data.label || '')}" placeholder="Ex.: Valor despesa" /></label>
    <label>Tipo<select data-form-field-type>
      ${[
        ['texto', 'Texto'],
        ['textarea', 'Texto longo'],
        ['numero', 'Número'],
        ['moeda', 'Moeda/R$'],
        ['data', 'Data'],
        ['email', 'E-mail'],
        ['lista', 'Lista de valores'],
        ['arquivo', 'Arquivo']
      ].map(([value, label]) => `<option value="${value}" ${data.type === value ? 'selected' : ''}>${label}</option>`).join('')}
    </select></label>
    <label>Obrigatório<select data-form-field-required>
      <option value="sim" ${data.required ? 'selected' : ''}>Sim</option>
      <option value="nao" ${!data.required ? 'selected' : ''}>Não</option>
    </select></label>
    <label>Lista de valores<input data-form-field-options value="${escapeHtml((data.options || []).join(', '))}" placeholder="Quilometragem, Passagem" /></label>
    <label>Outro abre obs.<select data-form-field-other>
      <option value="nao" ${!data.otherObservation ? 'selected' : ''}>Não</option>
      <option value="sim" ${data.otherObservation ? 'selected' : ''}>Sim</option>
    </select></label>
    <button class="danger-action compact-action" type="button" data-remove-builder-row>Remover</button>
  `;
  shell.appendChild(row);
}

function addWorkflowBuilderRow(data = {}) {
  const shell = $('#workflowBuilderRows');
  if (!shell) return;
  const row = document.createElement('div');
  row.className = 'form-builder-row workflow-builder-row';
  row.innerHTML = `
    <label>Tarefa<input data-workflow-task value="${escapeHtml(data.name || '')}" placeholder="Ex.: Aprovar despesa" /></label>
    <label>Ação<select data-workflow-action>
      <option value="Aprovar" ${normalizeWorkflowActionLabel(data.action) === 'Aprovar' ? 'selected' : ''}>Aprovar</option>
      <option value="Ajuste" ${normalizeWorkflowActionLabel(data.action) === 'Ajuste' ? 'selected' : ''}>Ajuste</option>
      <option value="Processado" ${normalizeWorkflowActionLabel(data.action) === 'Processado' ? 'selected' : ''}>Processado</option>
      <option value="Finalizado" ${normalizeWorkflowActionLabel(data.action) === 'Finalizado' ? 'selected' : ''}>Finalizado</option>
    </select></label>
    <label>Responsável<select data-workflow-responsible>${workflowResponsibleOptions(data.approverEmail || '')}</select></label>
    <label>SLA dias<input data-workflow-sla type="number" min="0" step="1" value="${escapeHtml(data.slaDays || '')}" placeholder="Ex.: 2" /></label>
    <button class="danger-action compact-action" type="button" data-remove-builder-row>Remover</button>
  `;
  shell.appendChild(row);
}

function clearFormBuilderRows() {
  $('#formFieldBuilderRows')?.replaceChildren();
  $('#workflowBuilderRows')?.replaceChildren();
}

function loadFormDefinitionForEdit(definition) {
  if (!definition) return;
  state.activeFormsPanel = 'builder';
  state.editing.formDefinitionId = definition.id;
  fillForm('#formDefinitionForm', {
    title: definition.title,
    active: definition.active === false ? 'false' : 'true',
    description: definition.description,
    fieldsText: definition.fieldsText || '',
    workflowText: definition.workflowText || ''
  }, 'Atualizar formulário');
  clearFormBuilderRows();
  (definition.fields || []).forEach((field) => addFormFieldBuilderRow(field));
  (definition.workflowSteps || []).forEach((step) => addWorkflowBuilderRow(step));
  ensureFormBuilderRows();
  renderFormsPanel();
  toast('Formulário carregado para manutenção.');
}

function ensureFormBuilderRows() {
  if ($('#formFieldBuilderRows') && !$$('.form-field-builder-row').length) {
    addFormFieldBuilderRow();
  }
  if ($('#workflowBuilderRows') && !$$('.workflow-builder-row').length) {
    addWorkflowBuilderRow();
  }
}

function buildFormDefinitionStructuredPayload(form) {
  const fieldsText = $$('.form-field-builder-row').map((row) => {
    const label = $('[data-form-field-label]', row)?.value.trim() || '';
    const type = $('[data-form-field-type]', row)?.value || 'texto';
    const required = $('[data-form-field-required]', row)?.value === 'sim' ? 'sim' : 'nao';
    const options = $('[data-form-field-options]', row)?.value.trim() || '';
    const other = $('[data-form-field-other]', row)?.value === 'sim' ? 'sim' : 'nao';
    return label ? `${label}|${type}|${required}|${options}|${other}` : '';
  }).filter(Boolean).join('\n');

  const workflowText = $$('.workflow-builder-row').map((row) => {
    const task = $('[data-workflow-task]', row)?.value.trim() || '';
    const action = $('[data-workflow-action]', row)?.value.trim() || '';
    const responsible = $('[data-workflow-responsible]', row)?.value.trim() || '';
    const slaDays = $('[data-workflow-sla]', row)?.value.trim() || '';
    return task ? `${task}|${action || 'Aprovar'}|${responsible}|${slaDays}` : '';
  }).filter(Boolean).join('\n');

  form.elements.fieldsText.value = fieldsText;
  form.elements.workflowText.value = workflowText;
}

function renderFormsPanel() {
  if (!isCurrentUserAdmin() && state.activeFormsPanel === 'builder') {
    state.activeFormsPanel = 'request';
  }
  $$('[data-admin-only]').forEach((element) => {
    element.hidden = !isCurrentUserAdmin();
  });
  $$('[data-forms-panel]').forEach((element) => {
    const panel = element.dataset.formsPanel;
    const shouldShow = state.activeFormsPanel === 'builder'
      ? panel === 'builder'
      : state.activeFormsPanel === 'pending'
        ? panel === 'requests'
        : panel === 'request' || panel === 'requests';
    element.hidden = element.matches('[data-admin-only]') && !isCurrentUserAdmin() ? true : !shouldShow;
  });

  const select = $('#formRequestDefinitionSelect');
  if (select) {
    const previous = select.dataset.preferredDefinitionId || select.value;
    const activeDefinitions = activeFormDefinitions();
    select.value = activeDefinitions.some((definition) => definition.id === previous) ? previous : '';
    delete select.dataset.preferredDefinitionId;
  }

  renderFormRequestPicker();
  renderFormRequestFields();
  const requestSubmitButton = $('button[type="submit"]', $('#formRequestForm'));
  if (requestSubmitButton) requestSubmitButton.textContent = state.editing.formRequestId ? 'Enviar ajuste' : 'Enviar requisição';
  renderFormRequests();
  renderFormDefinitions();
  ensureFormBuilderRows();
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
  applyRoleVisibility();
  renderFavoriteCards();
  renderFavoriteMaintenance();
  if (!$('#dashboard')?.classList.contains('dashboard-drill-active')) {
    renderLauncherDrill();
  }
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
  renderWorkHours();
  renderBillingReport();
  renderTaxReformSimulator();
  renderAllocationPriceResult();
  renderFinanceProjection();
  renderBusinessCalendar();
  renderRateCardFilters();
  renderRateCards();
  renderCandidatePoolFilters();
  renderCandidatePool();
  renderUsers();
  renderFormsPanel();
  bindCurrencyInputs();
  initResizableTables();
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

function setDashboardInsightsVisible(visible) {
  $('#dashboard')?.classList.toggle('dashboard-insights-active', visible);
  $('#dashboard')?.classList.toggle('dashboard-drill-active', visible);
}

function showView(viewId) {
  if (!canAccessView(viewId)) {
    toast('Acesso restrito a administradores.');
    showView('dashboard');
    return;
  }
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === viewId));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewId));
  syncNavGroups(viewId);
  if (viewId === 'dashboard') setDashboardInsightsVisible(false);
  document.body.classList.toggle('home-view-active', viewId === 'dashboard');
  document.body.classList.toggle('module-view-active', viewId !== 'dashboard');
  $('#viewTitle').textContent = viewTitles[viewId] || 'Gestão do Negócio Alcateia';
  if (viewId === 'forms') renderFormsPanel();
  window.setTimeout(() => maximizeActiveViewPrimaryPanel(viewId), 0);
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  field.value = field.classList?.contains('currency-input')
    ? formatCurrencyInput(value)
    : value ?? '';
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
  state.clientListFilter = client.id;
  const listFilter = $('#clientListFilter');
  if (listFilter) listFilter.value = client.id;
  const reportSelect = $('#clientOrgChartSelect');
  if (reportSelect) reportSelect.value = client.id;
  updateClientManagerContactOptions(client.managerContactId || '');
  fillForm('#clientForm', {
    customerName: client.customerName,
    primaryContactName: client.primaryContactName,
    primaryContactEmail: client.primaryContactEmail,
    primaryContactPhone: client.primaryContactPhone,
    managerContactId: client.managerContactId || '',
    observation: client.observation
  }, 'Atualizar cliente');
  closeContactClientModal();
  renderContactClients();
  renderClientOrgChartReport(client.id);
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
    status: candidatePoolStatus(item)
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
    role: user.role,
    emailSignature: user.emailSignature || ''
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

function maximizeActiveViewPrimaryPanel(viewId) {
  if (viewId === 'dashboard') return;
  const view = $(`.view#${CSS.escape(viewId)}`);
  if (!view) return;
  if (view.hasAttribute('data-no-auto-maximize')) {
    $$('.panel-maximized').forEach((panel) => setSurfaceMaximized(panel, false));
    return;
  }
  const panels = $$('.panel', view).filter((panel) => !panel.hidden);
  if (panels.length !== 1) {
    $$('.panel-maximized').forEach((panel) => setSurfaceMaximized(panel, false));
    return;
  }
  const explicitPanel = panels.find((panel) => panel.hasAttribute('data-auto-maximize-primary'));
  const targetPanel = explicitPanel || panels[0];
  if (!targetPanel || targetPanel.classList.contains('panel-maximized')) return;
  $$('.panel-maximized')
    .filter((panel) => panel !== targetPanel)
    .forEach((panel) => setSurfaceMaximized(panel, false));
  setSurfaceMaximized(targetPanel, true);
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

function removeLegacySurfaceWindowControls(surface) {
  $$('[data-panel-minimize], [data-panel-maximize], [data-surface-collapse-close]', surface)
    .forEach((button) => button.remove());
}

function ensurePanelReturnButton(surface, heading, actions) {
  const view = surface.closest('.view');
  if (!view || view.id === 'dashboard') return;

  let button = $('[data-panel-return]', heading);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.panelReturn = 'true';
    button.textContent = 'Voltar';
    button.addEventListener('click', returnToPreviousLauncherMenu);
  }

  button.className = 'secondary-action panel-return-button';
  actions.append(button);
}

function initPanelMaximizeControls() {
  $$('.panel, .modal-panel, .modal-card').forEach((surface) => {
    const heading = $('.panel-heading, .modal-heading', surface);
    if (!heading) return;

    const actions = surfaceHeadingActions(heading);
    actions.classList.remove('surface-window-actions');
    removeLegacySurfaceWindowControls(surface);

    const isModalSurface = surface.classList.contains('modal-panel') || surface.classList.contains('modal-card');
    if (isModalSurface) {
      standardizeSurfaceCloseButton(surface, heading, actions);
      return;
    }

    ensurePanelReturnButton(surface, heading, actions);
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
    initResizableTables();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function tableColumnStorageKey(table, columnIndex) {
  const view = table.closest('.view')?.id || 'global';
  const surface = table.closest('.panel, .modal-panel, .modal-card');
  const panelTitle = surface?.querySelector('.panel-heading h2, .modal-heading h2')?.textContent?.trim() || 'panel';
  const headerText = table.tHead?.rows?.[0]?.cells?.[columnIndex]?.textContent?.trim() || columnIndex;
  return `talentos_table_col_${view}_${panelTitle}_${columnIndex}_${headerText}`;
}

function applyTableColumnWidth(table, columnIndex, width) {
  if (!table || !Number.isFinite(width) || width < 48) return;
  let colgroup = $('colgroup', table);
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    const columnCount = table.tHead?.rows?.[0]?.cells?.length || table.rows?.[0]?.cells?.length || 0;
    Array.from({ length: columnCount }).forEach(() => colgroup.appendChild(document.createElement('col')));
    table.prepend(colgroup);
  }
  const column = colgroup.children[columnIndex];
  if (column) column.style.width = `${Math.round(width)}px`;
  table.style.tableLayout = 'fixed';
}

function initResizableTables(root = document) {
  $$('table', root).forEach((table) => {
    if (table.dataset.resizableColumns === 'true') return;
    const headerRow = table.tHead?.rows?.[0];
    if (!headerRow) return;
    table.dataset.resizableColumns = 'true';
    table.classList.add('resizable-table');

    Array.from(headerRow.cells).forEach((cell, columnIndex) => {
      const savedWidth = Number(readStorage(tableColumnStorageKey(table, columnIndex)));
      if (savedWidth) applyTableColumnWidth(table, columnIndex, savedWidth);
      if ($('.column-resize-handle', cell)) return;

      const handle = document.createElement('span');
      handle.className = 'column-resize-handle';
      handle.setAttribute('aria-hidden', 'true');
      cell.appendChild(handle);

      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = cell.getBoundingClientRect().width;
        handle.setPointerCapture?.(event.pointerId);
        document.body.classList.add('is-resizing-table-column');

        const onPointerMove = (moveEvent) => {
          const nextWidth = Math.max(48, startWidth + moveEvent.clientX - startX);
          applyTableColumnWidth(table, columnIndex, nextWidth);
        };
        const onPointerUp = () => {
          document.removeEventListener('pointermove', onPointerMove);
          document.removeEventListener('pointerup', onPointerUp);
          document.body.classList.remove('is-resizing-table-column');
          const width = table.querySelector(`colgroup col:nth-child(${columnIndex + 1})`)?.style.width || '';
          writeStorage(tableColumnStorageKey(table, columnIndex), width.replace('px', ''));
        };

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp, { once: true });
      });
    });
  });
}

function launcherLeafIds(nodeId = launcherRootId) {
  const node = launcherNodes[nodeId];
  if (!node || !canAccessLauncherNode(node)) return [];
  if (node.view || node.action) return [nodeId];
  return (node.children || []).flatMap((childId) => launcherLeafIds(childId));
}

function launcherPathTo(targetId, nodeId = launcherRootId, path = []) {
  const node = launcherNodes[nodeId];
  if (!node) return [];
  const nextPath = [...path, nodeId];
  if (nodeId === targetId) return nextPath;
  for (const childId of node.children || []) {
    const childPath = launcherPathTo(targetId, childId, nextPath);
    if (childPath.length) return childPath;
  }
  return [];
}

function launcherParentId(nodeId) {
  const path = launcherPathTo(nodeId);
  return path.length > 1 ? path[path.length - 2] : launcherRootId;
}

function launcherLeafIdForView(viewId, panel = '') {
  return launcherLeafIds().find((nodeId) => {
    const node = launcherNodes[nodeId];
    return node?.view === viewId && (!panel || node.panel === panel);
  }) || launcherLeafIds().find((nodeId) => launcherNodes[nodeId]?.view === viewId) || '';
}

function rememberLauncherReturnForNode(nodeId) {
  state.launcherReturnNodeId = launcherParentId(nodeId);
}

function rememberLauncherReturnForView(viewId, panel = '') {
  const nodeId = launcherLeafIdForView(viewId, panel);
  state.launcherReturnNodeId = nodeId ? launcherParentId(nodeId) : launcherRootId;
}

function returnToPreviousLauncherMenu() {
  $$('.panel-maximized').forEach((panel) => setSurfaceMaximized(panel, false));
  $$('.surface-minimized').forEach((panel) => setSurfaceMinimized(panel, false));
  showView('dashboard');
  renderLauncherDrill(state.launcherReturnNodeId || launcherRootId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function readLauncherFavoriteIds() {
  const validLeafIds = new Set(launcherLeafIds());
  const rawFavorites = readStorage(launcherFavoriteStorageKey);
  if (!rawFavorites) return defaultLauncherFavoriteIds;

  try {
    const parsed = JSON.parse(rawFavorites);
    if (!Array.isArray(parsed)) return defaultLauncherFavoriteIds;
    const favoriteIds = parsed.filter((id) => validLeafIds.has(id));
    return favoriteIds.length ? favoriteIds : defaultLauncherFavoriteIds;
  } catch {
    return defaultLauncherFavoriteIds;
  }
}

function createLauncherCard(nodeId, className) {
  const node = launcherNodes[nodeId];
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';

  const eyebrow = document.createElement('span');
  eyebrow.textContent = node.eyebrow || 'Menu';
  const label = document.createElement('strong');
  label.textContent = node.label;
  const description = document.createElement('small');
  description.textContent = node.description || '';

  button.append(eyebrow, label, description);
  button.addEventListener('click', () => {
    if (node.view) {
      if (node.view === 'forms' && node.panel) {
        state.activeFormsPanel = node.panel;
      }
      if (node.view === 'billingReport' && node.panel) {
        state.activeBillingReportPanel = node.panel;
      }
      rememberLauncherReturnForNode(nodeId);
      showView(node.view);
      return;
    }
    if (node.action === 'dashboard') {
      openDashboardDrill();
      return;
    }
    renderLauncherDrill(nodeId);
  });

  return button;
}

function renderFavoriteCards() {
  const grid = $('#favoriteCards');
  if (!grid) return;

  grid.replaceChildren();
  readLauncherFavoriteIds().forEach((favoriteId) => {
    const node = launcherNodes[favoriteId];
    if (node?.view) {
      grid.appendChild(createLauncherCard(favoriteId, 'shortcut-card'));
    }
  });
}

function renderFavoriteMaintenance() {
  const grid = $('#favoriteMaintenanceGrid');
  if (!grid) return;

  const selected = new Set(readLauncherFavoriteIds());
  grid.replaceChildren();
  launcherLeafIds().forEach((nodeId) => {
    const node = launcherNodes[nodeId];
    const label = document.createElement('label');
    label.className = 'favorite-option';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = nodeId;
    checkbox.checked = selected.has(nodeId);

    const text = document.createElement('span');
    text.textContent = node.label;

    label.append(checkbox, text);
    grid.appendChild(label);
  });
}

function saveFavoriteMaintenance() {
  const checkedIds = $$('#favoriteMaintenanceGrid input:checked').map((input) => input.value);
  writeStorage(launcherFavoriteStorageKey, JSON.stringify(checkedIds));
  renderFavoriteCards();
  renderFavoriteMaintenance();
  const panel = $('#favoriteMaintenancePanel');
  if (panel) panel.hidden = true;
}

function resetFavoriteMaintenance() {
  removeStorage(launcherFavoriteStorageKey);
  renderFavoriteCards();
  renderFavoriteMaintenance();
}

function openDashboardDrill() {
  const title = $('#moduleWorkspaceTitle');
  const subtitle = $('#moduleWorkspaceSubtitle');
  const backButton = $('#moduleBackButton');
  const cards = $('#moduleDrillCards');

  setDashboardInsightsVisible(true);
  if (title) title.textContent = 'Dashboard';
  if (subtitle) subtitle.textContent = 'Indicadores e acompanhamento do negócio';
  $('#moduleBreadcrumb')?.replaceChildren();
  if (cards) cards.replaceChildren();
  if (backButton) {
    backButton.hidden = false;
    backButton.onclick = () => {
      setDashboardInsightsVisible(false);
      renderLauncherDrill(launcherRootId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }
  $('#dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderLauncherBreadcrumb(nodeId) {
  const breadcrumb = $('#moduleBreadcrumb');
  if (!breadcrumb) return;

  breadcrumb.replaceChildren();
  launcherPathTo(nodeId).forEach((pathNodeId, index, path) => {
    const node = launcherNodes[pathNodeId];
    const item = document.createElement(pathNodeId === nodeId ? 'span' : 'button');
    item.textContent = pathNodeId === launcherRootId ? 'Início' : node.label;
    if (item.tagName === 'BUTTON') {
      item.type = 'button';
      item.addEventListener('click', () => renderLauncherDrill(pathNodeId));
    }
    breadcrumb.appendChild(item);
    if (index < path.length - 1) {
      const separator = document.createElement('span');
      separator.textContent = '/';
      separator.className = 'module-breadcrumb-separator';
      breadcrumb.appendChild(separator);
    }
  });
}

function renderLauncherDrill(nodeId = launcherRootId) {
  setDashboardInsightsVisible(false);
  const node = launcherNodes[nodeId] || launcherNodes[launcherRootId];
  const title = $('#moduleWorkspaceTitle');
  const subtitle = $('#moduleWorkspaceSubtitle');
  const backButton = $('#moduleBackButton');
  const cards = $('#moduleDrillCards');
  if (!cards) return;

  if (title) title.textContent = node.label;
  if (subtitle) subtitle.textContent = node.description || '';
  if (backButton) {
    const path = launcherPathTo(nodeId);
    const parentId = path.length > 1 ? path[path.length - 2] : launcherRootId;
    backButton.hidden = nodeId === launcherRootId;
    backButton.onclick = () => renderLauncherDrill(parentId);
  }

  renderLauncherBreadcrumb(nodeId);
  cards.replaceChildren();
  (node.children || []).forEach((childId) => {
    if (canAccessLauncherNode(launcherNodes[childId])) {
      cards.appendChild(createLauncherCard(childId, 'module-card'));
    }
  });
}

function bindLauncherHome() {
  renderFavoriteCards();
  renderFavoriteMaintenance();
  renderLauncherDrill();

  $('#manageFavoritesButton')?.addEventListener('click', () => {
    const panel = $('#favoriteMaintenancePanel');
    if (!panel) return;
    renderFavoriteMaintenance();
    panel.hidden = !panel.hidden;
  });
  $('#saveFavoritesButton')?.addEventListener('click', saveFavoriteMaintenance);
  $('#resetFavoritesButton')?.addEventListener('click', resetFavoriteMaintenance);
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
    button.addEventListener('click', () => {
      if (button.dataset.view === 'billingReport' && button.dataset.billingPanel) {
        state.activeBillingReportPanel = button.dataset.billingPanel;
      }
      rememberLauncherReturnForView(button.dataset.view, button.dataset.billingPanel || '');
      showView(button.dataset.view);
    });
  });

  $$('[data-module-view]').forEach((button) => {
    button.addEventListener('click', () => {
      rememberLauncherReturnForView(button.dataset.moduleView);
      showView(button.dataset.moduleView);
    });
  });

  bindLauncherHome();
  $('#homeViewButton')?.addEventListener('click', returnToPreviousLauncherMenu);
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
      updateClientManagerContactOptions('');
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
      updateClientManagerContactOptions(selectedClientForContacts()?.managerContactId || '');
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
    if (state.faturamento.some((item) => item.id !== editingId && item.monthYear === payload.monthYear)) {
      toast('Já existe faturamento cadastrado para esse mês/ano.');
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
    const payload = formPayload(form);
    payload.contractValue = parseCurrencyInput(payload.contractValue);

    try {
      if (submitButton) submitButton.disabled = true;
      await saveOpportunityPayload(payload, editingId);
    } catch (error) {
      const errorText = String(error.message || '');
      if (payload.status === 'WON' && editingId && /consultor.*oportunidade.*WON|WON.*consultor/i.test(errorText)) {
        openWonApprovalModal(editingId, payload, editingId);
      } else {
        toast(error.message || 'Não foi possível salvar a oportunidade.');
      }
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
        toast('Consultor aprovado e hunting atualizado.');
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
    payload.status = payload.status || 'Ativo';
    payload.active = payload.status === 'Ativo';
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
    payload.rate = parseCurrencyInput(payload.rate);
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
    if (!String(payload.status || '').trim()) {
      toast('Selecione um status válido.');
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
      toast('Informe o consultor do hunting.');
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
    if (!String(payload.email || '').trim().toLowerCase().endsWith('@alcateiaconsulting.com.br')) {
      toast('O e-mail do usuário deve ser @alcateiaconsulting.com.br.');
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

  $('#formDefinitionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const editingId = state.editing.formDefinitionId;
    buildFormDefinitionStructuredPayload(form);
    const payload = formPayload(form);
    payload.active = payload.active !== 'false';

    if (!String(payload.title || '').trim()) {
      toast('Informe o nome do formulário.');
      return;
    }
    if (!String(payload.fieldsText || '').trim()) {
      toast('Inclua ao menos um campo no formulário.');
      return;
    }

    const originalText = setSubmitButtonBusy(submitButton, editingId ? 'Atualizando...' : 'Salvando...');
    try {
      const savedDefinition = await api(editingId ? `/api/form-definitions/${encodeURIComponent(editingId)}` : '/api/form-definitions', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('formDefinitions', savedDefinition);
      clearEditing(form, 'formDefinitionId', 'Salvar formulário');
      clearFormBuilderRows();
      addFormFieldBuilderRow();
      addWorkflowBuilderRow();
      state.activeFormsPanel = 'builder';
      toast(editingId ? 'Formulário atualizado.' : 'Formulário cadastrado.');
      render();
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o formulário.');
    } finally {
      restoreSubmitButton(submitButton, state.editing.formDefinitionId ? (originalText || 'Atualizar formulário') : 'Salvar formulário');
    }
  });

  $('#addFormFieldButton')?.addEventListener('click', () => addFormFieldBuilderRow());
  $('#addWorkflowStepButton')?.addEventListener('click', () => addWorkflowBuilderRow());
  $('#formDefinitionForm')?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-builder-row]');
    if (!removeButton) return;
    removeButton.closest('.form-builder-row')?.remove();
    ensureFormBuilderRows();
  });

  $('#formDefinitionForm')?.addEventListener('change', (event) => {
    const actionSelect = event.target.closest('[data-workflow-action]');
    if (!actionSelect) return;
    const row = actionSelect.closest('.workflow-builder-row');
    const responsible = $('[data-workflow-responsible]', row);
    if (responsible && actionSelect.value === 'Ajuste') {
      responsible.value = '__requester__';
    }
  });

  $('#formRequestPicker')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-select-form-request]');
    if (!card) return;
    const form = $('#formRequestForm');
    const select = $('#formRequestDefinitionSelect');
    state.editing.formRequestId = '';
    if (form) form.reset();
    if (select) select.value = card.dataset.selectFormRequest || '';
    renderFormsPanel();
  });

  $('#formRequestBackButton')?.addEventListener('click', () => {
    const form = $('#formRequestForm');
    const select = $('#formRequestDefinitionSelect');
    state.editing.formRequestId = '';
    if (form) form.reset();
    if (select) select.value = '';
    renderFormsPanel();
  });

  $('#formRequestFields')?.addEventListener('change', () => renderFormRequestOtherFields());

  $('#formRequestForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const definition = currentFormDefinition();
    if (!definition) {
      toast('Selecione um formulário válido.');
      return;
    }

    const editingRequestId = state.editing.formRequestId;
    const existingRequest = state.formRequests.find((item) => item.id === editingRequestId) || null;

    const originalText = setSubmitButtonBusy(submitButton, editingRequestId ? 'Enviando ajuste...' : 'Enviando...');
    try {
      const { values, files } = collectFormRequestPayload(form, definition, existingRequest);
      await attachFormRequestFiles(values, files);
      const adjustmentObservation = editingRequestId
        ? window.prompt('Observação do ajuste:', '') ?? null
        : '';
      if (adjustmentObservation === null) {
        return;
      }
      const body = buildFormRequestBody(definition, values, editingRequestId ? { observation: adjustmentObservation } : {});
      const savedRequest = editingRequestId
        ? await api(`/api/form-requests/${encodeURIComponent(editingRequestId)}/values`, {
          method: 'PATCH',
          body
        })
        : await api('/api/form-requests', {
          method: 'POST',
          body
        });
      upsertStateItem('formRequests', savedRequest);
      form.reset();
      state.editing.formRequestId = '';
      const select = $('#formRequestDefinitionSelect');
      if (select) select.value = '';
      renderFormsPanel();
      toast(editingRequestId ? 'Requisição atualizada.' : 'Requisição enviada.');
    } catch (error) {
      toast(error.message || 'Não foi possível enviar a requisição.');
    } finally {
      restoreSubmitButton(submitButton, originalText || (editingRequestId ? 'Enviar ajuste' : 'Enviar requisição'));
    }
  });

  $('#formRequestTable')?.addEventListener('click', async (event) => {
    const openButton = event.target.closest('[data-open-form-request]');
    if (openButton) {
      const requestItem = state.formRequests.find((item) => item.id === openButton.dataset.openFormRequest);
      renderFormRequestDetail(requestItem);
      return;
    }

    const adjustButton = event.target.closest('[data-adjust-form-request]');
    if (adjustButton) {
      const requestItem = state.formRequests.find((item) => item.id === adjustButton.dataset.adjustFormRequest);
      openFormRequestAdjustment(requestItem);
      return;
    }

    const approveButton = event.target.closest('[data-approve-form-request]');
    const rejectButton = event.target.closest('[data-reject-form-request]');
    const processButton = event.target.closest('[data-process-form-request]');
    const finishButton = event.target.closest('[data-finish-form-request]');
    const actionButton = approveButton || rejectButton || processButton || finishButton;
    if (!actionButton) return;

    const decision = approveButton ? 'approve' : processButton ? 'process' : finishButton ? 'finish' : 'reject';
    const decisionDetails = requestFormDecisionDetails(decision);
    if (!decisionDetails) return;

    actionButton.disabled = true;
    try {
      const requestId = actionButton.dataset.approveFormRequest || actionButton.dataset.rejectFormRequest || actionButton.dataset.processFormRequest || actionButton.dataset.finishFormRequest;
      const savedRequest = await api(`/api/form-requests/${encodeURIComponent(requestId)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, ...decisionDetails })
      });
      upsertStateItem('formRequests', savedRequest);
      toast(approveButton ? 'Aprovação registrada.' : processButton ? 'Requisição processada.' : finishButton ? 'Requisição finalizada.' : 'Requisição reprovada.');
      renderFormsPanel();
    } catch (error) {
      toast(error.message || 'Não foi possível registrar a decisão.');
    } finally {
      actionButton.disabled = false;
    }
  });

  $('#formRequestDetailPanel')?.addEventListener('click', (event) => {
    if (!event.target.closest('[data-close-form-request-detail]')) return;
    const panel = $('#formRequestDetailPanel');
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
    }
  });

  $('#formDefinitionTable')?.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('[data-delete-form-definition]');
    if (deleteButton) {
      const definition = state.formDefinitions.find((item) => item.id === deleteButton.dataset.deleteFormDefinition);
      if (!definition) return;
      if (!window.confirm(`Excluir o formulário "${definition.title || '-'}"?`)) return;

      deleteButton.disabled = true;
      try {
        await api(`/api/form-definitions/${encodeURIComponent(definition.id)}`, { method: 'DELETE' });
        removeStateItem('formDefinitions', definition.id);
        if (state.editing.formDefinitionId === definition.id) {
          clearEditing($('#formDefinitionForm'), 'formDefinitionId', 'Salvar formulário');
          clearFormBuilderRows();
          addFormFieldBuilderRow();
          addWorkflowBuilderRow();
        }
        toast('Formulário excluído.');
        renderFormsPanel();
      } catch (error) {
        toast(error.message || 'Não foi possível excluir o formulário.');
      } finally {
        deleteButton.disabled = false;
      }
      return;
    }

    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-form-definition]');
    const definition = state.formDefinitions.find((item) => item.id === row?.dataset.editFormDefinition);
    if (definition) loadFormDefinitionForEdit(definition);
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

  $('#opportunityFilterValue')?.addEventListener('change', (event) => {
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

function bindWorkHourActions() {
  $('#workHourAllocatedSelect')?.addEventListener('change', () => {
    const clientField = $('#workHourClientName');
    if (clientField) clientField.value = workHourClientName($('#workHourAllocatedSelect')?.value || '');
  });

  $('#workHourForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const payload = formPayload(form);
    payload.hours = String(payload.hours || '').replace(',', '.');
    delete payload.clientName;

    const originalText = setSubmitButtonBusy(submitButton, 'Salvando...');
    try {
      const saved = await api('/api/work-hours', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('workHours', saved);
      form.reset();
      renderWorkHours();
      toast('Apontamento salvo.');
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o apontamento.');
    } finally {
      restoreSubmitButton(submitButton, originalText || 'Salvar apontamento');
    }
  });

  ['#workHourFilterAllocated', '#workHourFilterClient', '#workHourFilterDateFrom', '#workHourFilterDateTo'].forEach((selector) => {
    $(selector)?.addEventListener('change', () => {
      state.workHourFilter = {
        allocatedId: $('#workHourFilterAllocated')?.value || '',
        clientId: $('#workHourFilterClient')?.value || '',
        dateFrom: $('#workHourFilterDateFrom')?.value || '',
        dateTo: $('#workHourFilterDateTo')?.value || ''
      };
      renderWorkHours();
    });
  });

  ['#workHourCloseAllocatedSelect', '#workHourCloseMonth'].forEach((selector) => {
    $(selector)?.addEventListener('change', renderWorkHourClosureStatus);
  });

  $('#workHourExportButton')?.addEventListener('click', () => {
    downloadCsv('horas-trabalhadas', workHourCsvRows());
    toast('CSV de horas trabalhadas gerado.');
  });

  $('#workHourImportButton')?.addEventListener('click', (event) => {
    importWorkHoursFromFile(event.currentTarget);
  });

  $('#workHourFinalizeButton')?.addEventListener('click', (event) => {
    finalizeWorkHourPeriod(event.currentTarget);
  });
}

function bindBillingReportActions() {
  $('#billingEntryAllocatedSelect')?.addEventListener('change', () => {
    const clientField = $('#billingEntryClientName');
    if (clientField) clientField.value = workHourClientName($('#billingEntryAllocatedSelect')?.value || '');
  });

  $('#billingEntryForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const payload = formPayload(form);
    payload.hours = String(payload.hours || '').replace(',', '.');
    delete payload.clientName;

    const originalText = setSubmitButtonBusy(submitButton, 'Salvando...');
    try {
      const saved = await api('/api/work-hours', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('workHours', saved);
      form.reset();
      renderBillingReport();
      toast('Apontamento salvo.');
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o apontamento.');
    } finally {
      restoreSubmitButton(submitButton, originalText || 'Salvar apontamento');
    }
  });

  ['#billingReportMonthFilter', '#billingReportClientFilter', '#billingReportAllocatedFilter'].forEach((selector) => {
    $(selector)?.addEventListener('change', () => {
      state.billingReportFilter = {
        monthYear: $('#billingReportMonthFilter')?.value || '',
        clientId: $('#billingReportClientFilter')?.value || '',
        allocatedId: $('#billingReportAllocatedFilter')?.value || ''
      };
      renderBillingReport();
    });
  });

  $('#billingReportExportButton')?.addEventListener('click', () => {
    downloadCsv('billing-report', billingReportCsvRows());
    toast('Billing Report exportado.');
  });
}

function bindClientReportActions() {
  $('#clientListFilter')?.addEventListener('change', (event) => {
    state.clientListFilter = event.currentTarget.value || '';
    renderClients();
  });

  $('#exportClientsCsvButton')?.addEventListener('click', () => {
    downloadCsv('clientes', clientCsvRows($('#clientCsvSelect')?.value || ''));
    toast('CSV de clientes exportado.');
  });

  $('#generateClientOrgChartButton')?.addEventListener('click', () => {
    const clientId = $('#clientOrgChartSelect')?.value || '';
    const client = state.clients.find((item) => item.id === clientId);
    if (!client) {
      toast('Selecione um cliente para gerar o organograma.');
      renderClientOrgChartReport('');
      return;
    }
    renderClientOrgChartReport(clientId);
    downloadHtml(`organograma-${safeFilename(client.customerName)}`, buildClientOrgChartDocument(clientId));
    toast('Organograma gerado e arquivo baixado.');
  });

  $('#clientOrgChartSelect')?.addEventListener('change', (event) => {
    renderClientOrgChartReport(event.currentTarget.value);
  });
}

function bindBusinessCalendarActions() {
  $('#businessCalendarForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = $('button[type="submit"]', form);
    const editingId = state.editing.businessCalendarId;
    const payload = formPayload(form);
    payload.allDay = Boolean(form.elements.allDay?.checked);
    if (payload.allDay) {
      payload.startTime = '00:00';
      payload.endTime = '23:59';
    }

    const originalText = setSubmitButtonBusy(submitButton, 'Salvando...');
    let savedOk = false;
    try {
      const saved = await api(editingId ? `/api/business-calendar/${editingId}` : '/api/business-calendar', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      upsertStateItem('businessCalendar', saved);
      clearEditing(form, 'businessCalendarId', 'Salvar feriado');
      if (form.elements.allDay) form.elements.allDay.checked = true;
      if (form.elements.startTime) form.elements.startTime.value = '00:00';
      if (form.elements.endTime) form.elements.endTime.value = '23:59';
      syncBusinessCalendarTimeState();
      renderBusinessCalendar();
      renderFinanceProjection();
      savedOk = true;
      toast(editingId ? 'Feriado atualizado.' : 'Feriado cadastrado.');
    } catch (error) {
      toast(error.message || 'Não foi possível salvar o feriado.');
    } finally {
      restoreSubmitButton(submitButton, savedOk ? 'Salvar feriado' : originalText || 'Salvar feriado');
    }
  });

  $('#businessCalendarForm input[name="allDay"]')?.addEventListener('change', syncBusinessCalendarTimeState);

  $('#businessCalendarTable')?.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('[data-delete-business-calendar]');
    if (deleteButton) {
      const entry = state.businessCalendar.find((item) => item.id === deleteButton.dataset.deleteBusinessCalendar);
      if (!entry) return;
      if (!window.confirm(`Excluir feriado ${formatDateOnlyBR(entry.date)}?`)) return;
      try {
        await api(`/api/business-calendar/${entry.id}`, { method: 'DELETE' });
        removeStateItem('businessCalendar', entry.id);
        if (state.editing.businessCalendarId === entry.id) {
          clearEditing($('#businessCalendarForm'), 'businessCalendarId', 'Salvar feriado');
        }
        renderBusinessCalendar();
        renderFinanceProjection();
        toast('Feriado excluído.');
      } catch (error) {
        toast(error.message || 'Não foi possível excluir o feriado.');
      }
      return;
    }

    if (event.target.closest('button, a, input, select, textarea')) return;
    const row = event.target.closest('[data-edit-business-calendar]');
    const entry = state.businessCalendar.find((item) => item.id === row?.dataset.editBusinessCalendar);
    if (entry) loadBusinessCalendarForEdit(entry);
  });

  $('#openBusinessCalendarFromProjection')?.addEventListener('click', () => {
    rememberLauncherReturnForView('businessCalendar');
    showView('businessCalendar');
  });
}

function applyTaxReformScenarioPreset() {
  const form = $('#taxReformSimulatorForm');
  if (!form) return;
  const scenarioKey = form.elements.scenario.value || 'probable';
  const preset = taxReformScenarioPresets[scenarioKey] || taxReformScenarioPresets.probable;
  if (scenarioKey !== 'custom') {
    form.elements.ibsCbsRate.value = preset.ibsCbsRate;
    form.elements.creditUtilization.value = preset.creditUtilization;
  }
}

function bindTaxReformSimulatorActions() {
  const form = $('#taxReformSimulatorForm');
  if (!form) return;

  $('#taxReformScenarioSelect')?.addEventListener('change', applyTaxReformScenarioPreset);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    applyTaxReformScenarioPreset();
    state.taxReformSimulation = calculateTaxReformSimulation(form);
    renderTaxReformSimulator();
    toast('Simulacao calculada.');
  });
}

function bindAllocationPriceActions() {
  const form = $('#allocationPriceForm');
  if (!form) return;

  ['purchaseValue', 'saleValue', 'ratio', 'annualAdjustment'].forEach((name) => {
    form.elements[name]?.addEventListener('input', renderAllocationPriceResult);
    form.elements[name]?.addEventListener('change', renderAllocationPriceResult);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    renderAllocationPriceResult();
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
  $('#openAllocatedDashboardButton')?.addEventListener('click', () => openAllocatedMaintenance());
  $('#financeProjectionCards')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-open-active-allocateds]');
    if (card) openActiveAllocatedsFromProjection();
  });

  $('#allocatedPie')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-allocated-client]');
    if (!button) return;
    openAllocatedMaintenance(button.dataset.openAllocatedClient || '');
  });

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

function openNextWhatsappLink(targetWindow = null) {
  const next = state.whatsappQueue.shift();
  if (!next) return false;

  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.href = next.url;
  } else {
    window.open(next.url, '_blank', 'noopener');
  }

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
    let pendingWhatsappWindow = null;
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparando WhatsApp...';
    }
    pendingWhatsappWindow = window.open('about:blank', '_blank');
    if (pendingWhatsappWindow) {
      pendingWhatsappWindow.opener = null;
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
      openNextWhatsappLink(pendingWhatsappWindow);
      pendingWhatsappWindow = null;
    } catch (error) {
      if (pendingWhatsappWindow && !pendingWhatsappWindow.closed) {
        pendingWhatsappWindow.close();
      }
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
        updateClientManagerContactOptions(selectedClientForContacts()?.managerContactId || '');
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
      updateClientManagerContactOptions(selectedClientForContacts()?.managerContactId || '');
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
bindWorkHourActions();
bindBillingReportActions();
bindClientReportActions();
bindBusinessCalendarActions();
bindTaxReformSimulatorActions();
bindAllocationPriceActions();
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


