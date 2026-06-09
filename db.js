import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.join(__dirname, 'data', 'database.json');

export const CANDIDATE_STAGES = [
  'Triagem',
  'Entrevista Alcateia',
  'Entrevista tecnica/gestor',
  'Proposta',
  'Aprovado',
  'Reprovado'
];

export const CANDIDATE_ADERENCIA_OPTIONS = [0, 25, 50, 75, 100];

const LEGACY_CANDIDATE_STAGES = ['Inscrito', ...CANDIDATE_STAGES];

export const OPPORTUNITY_STATUSES = ['WON', 'LOST', 'Freezing', 'Closed', 'Open'];
export const OPPORTUNITY_MODELS = ['Alocação', 'Hunting', 'Projeto', 'Consultoria'];
export const BRAZIL_UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO'
];

const LEGACY_OPPORTUNITY_STATUS_MAP = {
  Aberta: 'Open',
  Pausada: 'Freezing',
  Fechada: 'Closed',
  Cancelada: 'LOST'
};

const LEGACY_OPPORTUNITY_MODEL_MAP = {
  Alocacao: 'Alocação',
  Remoto: 'Alocação',
  Hibrido: 'Alocação',
  'Híbrido': 'Alocação',
  'Sao Paulo / Hibrido': 'Alocação',
  'São Paulo / Híbrido': 'Alocação'
};

const REQUIRED_COLLECTIONS = [
  'clients',
  'users',
  'opportunities',
  'curriculums',
  'candidates',
  'allocateds',
  'cvFilters',
  'selectedCandidates'
];

export async function readDatabase(file = DATA_FILE) {
  let content = '';

  try {
    content = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    const initialData = {
      clients: [],
      users: [],
      opportunities: [],
      curriculums: [],
      candidates: [],
      allocateds: [],
      cvFilters: [],
      selectedCandidates: []
    };

    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(initialData, null, 2)}\n`, 'utf8');

    content = JSON.stringify(initialData);
  }

  const data = JSON.parse(content);

  if (!Array.isArray(data.clients) && Array.isArray(data.companies)) {
    data.clients = data.companies.map((company) => ({
      id: company.id?.replace(/^comp_/, 'client_') ?? createId('client', company.name),
      customerName: company.name ?? '',
      primaryContactName: company.contactName ?? '',
      primaryContactEmail: company.contactEmail ?? '',
      primaryContactPhone: company.contactPhone ?? '',
      observation: company.segment ?? '',
      createdAt: company.createdAt ?? toISODate()
    }));
    delete data.companies;
  }

  if (!Array.isArray(data.opportunities) && Array.isArray(data.jobs)) {
    data.opportunities = data.jobs.map((job, index) => ({
      id: job.id?.replace(/^job_/, 'opp_') ?? createId('opp', job.title),
      clientId: job.clientId ?? job.companyId?.replace(/^comp_/, 'client_') ?? '',
      opportunity: job.title ?? '',
      opportunityCode: job.opportunityCode ?? `OPP-${String(index + 1).padStart(3, '0')}`,
      status: normalizeOpportunityStatus(LEGACY_OPPORTUNITY_STATUS_MAP[job.status] ?? job.status ?? 'Open'),
      openingDate: job.openedAt ?? '',
      closingDate: job.closedAt ?? '',
      monthYear: monthYearFromDate(job.openedAt),
      model: normalizeOpportunityModel(job.model ?? job.location ?? 'Alocação'),
      owner: job.owner ?? '',
      quantity: Number(job.quantity ?? 1),
      closedQuantity: Number(job.closedQuantity ?? 0),
      contractValue: Number(job.contractValue ?? 0),
      observation: [job.description, job.requirements ? `Requisitos: ${job.requirements}` : ''].filter(Boolean).join(' '),
      createdAt: job.createdAt ?? toISODate()
    }));
    delete data.jobs;
  }

  for (const collection of REQUIRED_COLLECTIONS) {
    if (!Array.isArray(data[collection])) {
      data[collection] = [];
    }
  }

  data.opportunities = data.opportunities.map((opportunity) => ({
    ...opportunity,
    status: normalizeOpportunityStatus(LEGACY_OPPORTUNITY_STATUS_MAP[opportunity.status] ?? opportunity.status ?? 'Open'),
    model: normalizeOpportunityModel(opportunity.model ?? 'Alocação')
  }));

  data.curriculums = data.curriculums.map((curriculum) => normalizeCurriculum(curriculum));
  data.candidates = data.candidates.map((candidate) => normalizeCandidate(candidate));
  syncCandidatesWithOpportunityClosures(data);
  data.allocateds = data.allocateds.map((allocated) => normalizeAllocated(allocated));
  data.cvFilters = data.cvFilters.map((filter) => normalizeCvFilter(filter));
  data.selectedCandidates = data.selectedCandidates.map((candidate) => normalizeSelectedCandidate(candidate));
  delete data.applications;

  return data;
}

export async function writeDatabase(data, file = DATA_FILE) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
}

export function createId(prefix, label = '') {
  const slug = String(label)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${slug || 'item'}_${random}`;
}

export function toISODate(date = new Date()) {
  return date.toISOString();
}

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [scheme, salt, storedHash] = String(passwordHash ?? '').split(':');
  if (scheme !== 'scrypt' || !salt || !storedHash) return false;

  const attempted = Buffer.from(scryptSync(String(password), salt, 32).toString('hex'), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return stored.length === attempted.length && timingSafeEqual(stored, attempted);
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export function monthYearFromDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyFromValue(value) {
  const raw = String(value ?? '').trim().replace('--', '-');
  const match = raw.match(/^(\d{4})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
  }
  return monthYearFromDate(raw);
}

function rollingMonthKeys(now, months = 6) {
  const base = new Date(now);
  if (Number.isNaN(base.getTime())) return [];

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (months - index - 1), 1);
    return monthYearFromDate(date);
  });
}

export function normalizeStage(stage) {
  if (!CANDIDATE_STAGES.includes(stage)) {
    throw new Error(`Etapa invalida: ${stage}`);
  }
  return stage;
}

function normalizeHistoricalStage(stage) {
  if (!LEGACY_CANDIDATE_STAGES.includes(stage)) {
    throw new Error(`Etapa invalida: ${stage}`);
  }
  return stage;
}

export function normalizeOpportunityStatus(status) {
  if (!OPPORTUNITY_STATUSES.includes(status)) {
    throw new Error(`Status de oportunidade invalido: ${status}`);
  }
  return status;
}

export function normalizeOpportunityModel(model) {
  const value = String(model ?? '').trim();
  const normalized = LEGACY_OPPORTUNITY_MODEL_MAP[value] ?? value;

  if (!OPPORTUNITY_MODELS.includes(normalized)) {
    throw new Error(`Modelo de oportunidade invalido: ${model}`);
  }
  return normalized;
}

export function normalizeCurriculum(curriculum) {
  const nome = String(curriculum.nome ?? curriculum.name ?? '').trim();
  const idControle = String(curriculum.id_controle ?? curriculum.idControle ?? curriculum.curriculumId ?? '').trim();
  const id = String(curriculum.id ?? (idControle || createId('curr', nome))).trim();

  return {
    id,
    mongoId: String(curriculum.mongoId ?? curriculum._id ?? '').trim(),
    nome,
    email: String(curriculum.email ?? '').trim(),
    telefone: String(curriculum.telefone ?? curriculum.phone ?? '').trim(),
    endereco: String(curriculum.endereco ?? '').trim(),
    nacionalidade: String(curriculum.nacionalidade ?? '').trim(),
    estado_civil: String(curriculum.estado_civil ?? '').trim(),
    idade: String(curriculum.idade ?? '').trim(),
    linkedin: String(curriculum.linkedin ?? '').trim(),
    skills: String(curriculum.skills ?? '').trim(),
    formacao_academica: String(curriculum.formacao_academica ?? '').trim(),
    nivel_ingles: String(curriculum.nivel_ingles ?? '').trim(),
    nivel_espanhol: String(curriculum.nivel_espanhol ?? '').trim(),
    cursos_certificacoes: String(curriculum.cursos_certificacoes ?? '').trim(),
    conhecimento_tecnico: String(curriculum.conhecimento_tecnico ?? '').trim(),
    experiencia_profissional: String(curriculum.experiencia_profissional ?? '').trim(),
    hash_documento: String(curriculum.hash_documento ?? '').trim(),
    fonte: String(curriculum.fonte ?? '').trim(),
    data_criacao: String(curriculum.data_criacao ?? curriculum.createdAt ?? toISODate()).trim(),
    data_atualizacao: String(curriculum.data_atualizacao ?? '').trim(),
    data_origem: String(curriculum.data_origem ?? '').trim(),
    versoes: Array.isArray(curriculum.versoes) ? curriculum.versoes : [],
    data_nascimento: String(curriculum.data_nascimento ?? '').trim(),
    id_controle: idControle || id
  };
}

export function normalizeCandidate(candidate) {
  const opportunityId = String(candidate.opportunityId ?? '').trim();
  const stage = normalizeStage(candidate.stage ?? 'Triagem');
  const timestamp = toISODate();
  const createdAt = candidate.createdAt ?? timestamp;
  const stageEnteredAt = candidate.stageEnteredAt ?? createdAt;
  const rawHistory = candidate.stageHistory ?? candidate.history;
  const stageHistory = normalizeStageHistory(rawHistory, stage, stageEnteredAt);

  return {
    ...candidate,
    name: String(candidate.name ?? '').trim(),
    curriculumId: String(candidate.curriculumId ?? candidate.idNome ?? candidate.id?.replace(/^cand_/, 'curr_') ?? '').trim(),
    opportunityId,
    hourlyRate: Number(candidate.hourlyRate ?? candidate.valorHora ?? 0),
    observation: String(candidate.observation ?? candidate.notes ?? candidate.skills ?? '').trim(),
    approved: normalizeBoolean(candidate.approved ?? candidate.aprovado ?? false) || stage === 'Aprovado',
    stage,
    aderencia: normalizeAderencia(candidate.aderencia ?? candidate.adherence ?? 50),
    source: String(candidate.source ?? '').trim(),
    notes: String(candidate.notes ?? '').trim(),
    status: stage === 'Aprovado' || stage === 'Reprovado' ? stage : 'Em andamento',
    stageEnteredAt,
    createdAt,
    stageHistory
  };
}

export function normalizeAllocated(allocated) {
  const active = allocated.active ?? allocated.ativo ?? true;

  return {
    ...allocated,
    id: String(allocated.id ?? createId('alloc', allocated.code ?? allocated.codigo ?? allocated.consultant ?? allocated.consultor)).trim(),
    externalId: String(allocated.externalId ?? allocated.Id ?? allocated.idOriginal ?? '').trim(),
    code: String(allocated.code ?? allocated.codigo ?? '').trim(),
    consultant: String(allocated.consultant ?? allocated.consultor ?? '').trim(),
    skill: String(allocated.skill ?? '').trim(),
    clientId: String(allocated.clientId ?? '').trim(),
    hourlyRate: Number(allocated.hourlyRate ?? allocated.valorHora ?? 0),
    phone: String(allocated.phone ?? allocated.fone ?? '').trim(),
    consultantEmail: String(allocated.consultantEmail ?? allocated.emailConsultor ?? '').trim(),
    startDate: String(allocated.startDate ?? allocated.inicio ?? '').trim(),
    active: normalizeBoolean(active),
    endDate: String(allocated.endDate ?? allocated.termino ?? '').trim(),
    manager: String(allocated.manager ?? allocated.gestor ?? '').trim(),
    managerEmail: String(allocated.managerEmail ?? allocated.emailGestor ?? '').trim(),
    managerPhone: String(allocated.managerPhone ?? allocated.foneGestor ?? '').trim(),
    createdAt: String(allocated.createdAt ?? toISODate()).trim()
  };
}

export function normalizeCvFilter(filter) {
  const state = String(filter.state ?? filter.estado ?? '').trim().toUpperCase();
  const matchPercent = Number(filter.matchPercent ?? filter.percentualAcerto ?? filter.percentual_acerto ?? 0);
  const mandatorySkills = String(filter.mandatorySkills ?? filter.habilidadesObrigatorias ?? filter.habilidades_obrigatorias ?? '').trim().slice(0, 20);
  const requestedLimit = Number(filter.resultLimit ?? filter.qtdeRetorno ?? filter.quantidadeRetorno ?? filter.quantidade_retorno ?? 10);
  const sourceValue = (camelName, snakeName) => filter[camelName] ?? filter.searchSources?.[camelName.replace(/^search/, '').toLowerCase()] ?? filter[snakeName];
  const defaultChecked = (value) => value === undefined ? true : normalizeBoolean(value);
  const resultLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(50, Math.trunc(requestedLimit)))
    : 10;

  if (state && !BRAZIL_UFS.includes(state)) {
    throw new Error(`UF invalida: ${state}`);
  }
  if (!Number.isFinite(matchPercent) || matchPercent < 0 || matchPercent > 100) {
    throw new Error(`Percentual de acerto invalido: ${matchPercent}`);
  }

  return {
    ...filter,
    id: String(filter.id ?? createId('cvf', filter.jobDescription ?? filter.job_description ?? filter.opportunityId)).trim(),
    opportunityId: String(filter.opportunityId ?? '').trim(),
    jobDescription: String(filter.jobDescription ?? filter.job_description ?? '').trim(),
    mandatorySkills,
    candidateMessage: undefined,
    searchApinfo: defaultChecked(sourceValue('searchApinfo', 'busca_apinfo')),
    searchLinkedin: defaultChecked(sourceValue('searchLinkedin', 'busca_linkedin')),
    searchAlcateia: defaultChecked(sourceValue('searchAlcateia', 'busca_alcateia')),
    englishLevel: String(filter.englishLevel ?? filter.nivelIngles ?? filter.nivel_ingles ?? '').trim(),
    state,
    city: String(filter.city ?? filter.cidade ?? '').trim(),
    available: normalizeBoolean(filter.available ?? filter.disponivel ?? false),
    ageRange: String(filter.ageRange ?? filter.faixaEtaria ?? filter.faixa_etaria ?? '').trim(),
    matchPercent,
    resultLimit,
    searchStatus: '',
    searchMessage: '',
    searchSource: '',
    searchExecutedAt: '',
    searchResults: [],
    searchRejectedResults: [],
    createdAt: String(filter.createdAt ?? toISODate()).trim()
  };
}

export function normalizeCvSearchResult(result) {
  const score = Number(result.score ?? 0);

  return {
    id: String(result.id ?? createId('match', result.name ?? result.nome ?? result.link ?? 'candidato')).trim(),
    name: String(result.name ?? result.nome ?? '').trim(),
    source: String(result.source ?? result.fonte ?? 'APINFO').trim(),
    link: String(result.link ?? '').trim(),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    observation: String(result.observation ?? result.observacao ?? result.observação ?? '').trim()
  };
}

export function normalizeSelectedCandidate(candidate) {
  const score = Number(candidate.score ?? 0);

  return {
    id: String(candidate.id ?? createId('sel', candidate.name ?? candidate.nome ?? candidate.link ?? 'candidato')).trim(),
    opportunityId: String(candidate.opportunityId ?? '').trim(),
    cvFilterId: String(candidate.cvFilterId ?? '').trim(),
    name: String(candidate.name ?? candidate.nome ?? '').trim(),
    source: String(candidate.source ?? candidate.fonte ?? 'APINFO').trim(),
    link: String(candidate.link ?? '').trim(),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    origin: String(candidate.origin ?? candidate.origem ?? 'Resultado').trim(),
    candidateMessage: String(candidate.candidateMessage ?? candidate.mensagemCandidato ?? '').trim(),
    observation: String(candidate.observation ?? candidate.observacao ?? candidate['observação'] ?? candidate['observaÃ§Ã£o'] ?? '').trim(),
    createdAt: String(candidate.createdAt ?? toISODate()).trim(),
    updatedAt: String(candidate.updatedAt ?? '').trim()
  };
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1' || value === 'Sim';
}

export function normalizeAderencia(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || !CANDIDATE_ADERENCIA_OPTIONS.includes(number)) {
    throw new Error(`Aderencia invalida: ${value}`);
  }
  return number;
}

function normalizeStageHistory(history, currentStage, enteredAt) {
  const normalized = Array.isArray(history)
    ? history
        .map((item) => ({
          stage: normalizeHistoricalStage(item.stage),
          enteredAt: item.enteredAt || enteredAt,
          leftAt: item.leftAt || ''
        }))
        .filter((item) => item.enteredAt)
    : [];

  if (!normalized.length) {
    normalized.push({
      stage: currentStage,
      enteredAt,
      leftAt: ''
    });
  }

  if (!normalized.some((item) => item.stage === currentStage && !item.leftAt)) {
    normalized.push({
      stage: currentStage,
      enteredAt,
      leftAt: ''
    });
  }

  return normalized;
}

export function enrichCandidate(candidate, db) {
  const opportunity = db.opportunities.find((item) => item.id === candidate.opportunityId);
  const curriculum = db.curriculums.find((item) => item.id === candidate.curriculumId || item.id_controle === candidate.curriculumId);

  return {
    ...candidate,
    curriculumName: curriculum?.nome ?? '',
    curriculumControlId: curriculum?.id_controle ?? candidate.curriculumId,
    opportunityName: opportunity?.opportunity ?? '',
    opportunityCode: opportunity?.opportunityCode ?? '',
    opportunityStatus: opportunity?.status ?? ''
  };
}

export function enrichAllocated(allocated, db) {
  const client = db.clients.find((item) => item.id === allocated.clientId);

  return {
    ...allocated,
    clientName: client?.customerName ?? ''
  };
}

export function enrichCvFilter(filter, db) {
  const opportunity = db.opportunities.find((item) => item.id === filter.opportunityId);

  return {
    ...filter,
    opportunityName: opportunity?.opportunity ?? '',
    opportunityCode: opportunity?.opportunityCode ?? ''
  };
}

export function enrichSelectedCandidate(candidate, db) {
  const opportunity = db.opportunities.find((item) => item.id === candidate.opportunityId);
  const filter = db.cvFilters.find((item) => item.id === candidate.cvFilterId);

  return {
    ...candidate,
    opportunityName: opportunity?.opportunity ?? '',
    opportunityCode: opportunity?.opportunityCode ?? '',
    cvFilterName: filter?.jobDescription ?? ''
  };
}

export function calculateIndicators(db, now = new Date()) {
  const openOpportunities = db.opportunities.filter((opportunity) => opportunity.status === 'Open').length;
  const currentMonth = monthYearFromDate(now);
  const lastSixMonths = rollingMonthKeys(now);
  const wonCurrentMonth = db.opportunities.filter(
    (opportunity) => opportunity.status === 'WON' && monthKeyFromValue(opportunity.closingDate) === currentMonth
  );
  const wonContractValueCurrentMonth = wonCurrentMonth.reduce(
    (sum, opportunity) => sum + Number(opportunity.closedQuantity ?? 0) * Number(opportunity.contractValue ?? 0),
    0
  );
  const wonByModelCurrentMonth = Object.fromEntries(OPPORTUNITY_MODELS.map((model) => [model, 0]));
  for (const opportunity of wonCurrentMonth) {
    wonByModelCurrentMonth[opportunity.model] = (wonByModelCurrentMonth[opportunity.model] ?? 0) + 1;
  }
  const wonContractValueByMonth = Object.fromEntries(lastSixMonths.map((month) => [month, 0]));
  for (const opportunity of db.opportunities) {
    const month = monthKeyFromValue(opportunity.closingDate || opportunity.monthYear);
    if (opportunity.status === 'WON' && Object.hasOwn(wonContractValueByMonth, month)) {
      wonContractValueByMonth[month] += Number(opportunity.closedQuantity ?? 0) * Number(opportunity.contractValue ?? 0);
    }
  }
  const activeContractValue = db.opportunities
    .filter((opportunity) => !['Closed', 'LOST', 'WON'].includes(opportunity.status))
    .reduce((sum, opportunity) => sum + Number(opportunity.contractValue ?? 0), 0);

  const candidatesByStage = Object.fromEntries(CANDIDATE_STAGES.map((stage) => [stage, 0]));
  for (const candidate of db.candidates) {
    candidatesByStage[candidate.stage] = (candidatesByStage[candidate.stage] ?? 0) + 1;
  }

  const opportunitiesByStatus = Object.fromEntries(OPPORTUNITY_STATUSES.map((status) => [status, 0]));
  for (const opportunity of db.opportunities) {
    opportunitiesByStatus[opportunity.status] = (opportunitiesByStatus[opportunity.status] ?? 0) + 1;
  }

  const activeAllocateds = db.allocateds.filter((allocated) => allocated.active === true);
  const allocatedsByClient = Object.fromEntries(db.clients.map((client) => [client.customerName, 0]));
  for (const allocated of activeAllocateds) {
    const client = db.clients.find((item) => item.id === allocated.clientId);
    const clientName = client?.customerName || 'Sem cliente';
    allocatedsByClient[clientName] = (allocatedsByClient[clientName] ?? 0) + 1;
  }

  const timeByStage = Object.fromEntries(CANDIDATE_STAGES.map((stage) => [stage, []]));
  for (const candidate of db.candidates) {
    for (const history of candidate.stageHistory ?? []) {
      const enteredAt = new Date(history.enteredAt);
      const leftAt = history.leftAt ? new Date(history.leftAt) : now;
      const diffDays = Math.max(0, (leftAt - enteredAt) / (1000 * 60 * 60 * 24));
      if (Number.isFinite(diffDays)) {
        timeByStage[history.stage]?.push(diffDays);
      }
    }
  }

  const averageDaysByStage = Object.fromEntries(
    Object.entries(timeByStage).map(([stage, values]) => [
      stage,
      values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0
    ])
  );

  const approvedByMonth = {};
  for (const candidate of db.candidates) {
    const approvedHistory = (candidate.stageHistory ?? []).find((item) => item.stage === 'Aprovado');
    if (!approvedHistory) continue;
    const date = new Date(approvedHistory.enteredAt);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    approvedByMonth[month] = (approvedByMonth[month] ?? 0) + 1;
  }

  return {
    totals: {
      openOpportunities,
      wonCurrentMonth: wonCurrentMonth.length,
      wonContractValueCurrentMonth,
      activeAllocateds: activeAllocateds.length,
      activeContractValue,
      candidates: db.candidates.length,
      clients: db.clients.length,
      averageAderencia: db.candidates.length
        ? Number((db.candidates.reduce((sum, candidate) => sum + Number(candidate.aderencia ?? 0), 0) / db.candidates.length).toFixed(1))
        : 0
    },
    candidatesByStage,
    opportunitiesByStatus,
    wonByModelCurrentMonth,
    wonContractValueByMonth,
    allocatedsByClient,
    averageDaysByStage,
    approvedByMonth
  };
}

export function syncCandidatesWithOpportunityClosures(db, now = new Date()) {
  const closedRejectedOpportunities = new Set(
    db.opportunities
      .filter((opportunity) => opportunity.status !== 'WON' && String(opportunity.closingDate ?? '').trim())
      .map((opportunity) => opportunity.id)
  );

  for (const candidate of db.candidates) {
    if (!closedRejectedOpportunities.has(candidate.opportunityId) || candidate.stage === 'Reprovado') {
      continue;
    }
    moveCandidateStage(candidate, 'Reprovado', now);
    candidate.approved = false;
    candidate.status = 'Reprovado';
  }

  return db;
}

export function moveCandidateStage(candidate, nextStage, now = new Date()) {
  normalizeStage(nextStage);
  const timestamp = toISODate(now);

  if (candidate.stage === nextStage) {
    return candidate;
  }

  const history = Array.isArray(candidate.stageHistory) ? candidate.stageHistory : [];
  const currentEntry = history.findLast?.((item) => item.stage === candidate.stage && !item.leftAt);

  if (currentEntry) {
    currentEntry.leftAt = timestamp;
  } else if (candidate.stageEnteredAt) {
    history.push({
      stage: candidate.stage,
      enteredAt: candidate.stageEnteredAt,
      leftAt: timestamp
    });
  }

  history.push({
    stage: nextStage,
    enteredAt: timestamp,
    leftAt: ''
  });

  candidate.stage = nextStage;
  candidate.stageEnteredAt = timestamp;
  candidate.status = nextStage === 'Aprovado' || nextStage === 'Reprovado' ? nextStage : 'Em andamento';
  candidate.approved = nextStage === 'Aprovado' ? true : candidate.approved;
  candidate.stageHistory = history;

  return candidate;
}
