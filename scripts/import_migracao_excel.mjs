import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'database.json');

const args = process.argv.slice(2);
const excelArg = args.find((arg) => !arg.startsWith('--'));
const EXCEL_FILE = path.resolve(process.cwd(), excelArg || 'migracao.xlsx');
const MERGE_MODE = args.includes('--merge');

const REQUIRED_SHEETS = ['Oportunidades', 'Candidatos', 'Alocados'];

function nowIso() {
  return new Date().toISOString();
}

function text(value) {
  if (value === undefined || value === null) return '';
  const valueText = String(value).trim();

  if (['nan', 'nat', 'null', 'undefined'].includes(valueText.toLowerCase())) {
    return '';
  }

  return valueText;
}

function removeAccents(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function slug(value) {
  const clean = removeAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

  return clean || 'item';
}

function headerKey(value) {
  return removeAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pick(row, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && text(row[key]) !== '') {
      return row[key];
    }
  }

  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [headerKey(key), value])
  );

  for (const key of keys) {
    const value = normalized.get(headerKey(key));
    if (text(value) !== '') return value;
  }

  return '';
}

function toNumber(value, defaultValue = 0) {
  const raw = text(value);

  if (!raw) return defaultValue;

  const normalized = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function toInteger(value, defaultValue = 0) {
  const parsed = toNumber(value, defaultValue);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : defaultValue;
}

function toBoolean(value) {
  const raw = text(value).toLowerCase();

  return [
    'true',
    '1',
    'sim',
    'yes',
    'on',
    'x',
    'ativo',
    'aprovado',
    's'
  ].includes(raw);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function excelSerialToDate(value) {
  const parsed = XLSX.SSF.parse_date_code(Number(value));

  if (!parsed) return '';

  return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
}

function toDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToDate(value);
  }

  const raw = text(value);

  if (!raw) return '';

  if (/^\d+(\.\d+)?$/.test(raw) && Number(raw) > 30000) {
    return excelSerialToDate(raw);
  }

  const br = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);

  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${pad2(br[2])}-${pad2(br[1])}`;
  }

  const iso = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);

  if (iso) {
    return `${iso[1]}-${pad2(iso[2])}-${pad2(iso[3])}`;
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return '';
}

function toMonthYear(value, fallbackDate = '') {
  const raw = text(value).replace('--', '-');

  const yyyymm = raw.match(/^(\d{4})[\-\/](\d{1,2})/);

  if (yyyymm) {
    return `${yyyymm[1]}-${pad2(yyyymm[2])}`;
  }

  const mmyyyy = raw.match(/^(\d{1,2})[\-\/](\d{4})/);

  if (mmyyyy) {
    return `${mmyyyy[2]}-${pad2(mmyyyy[1])}`;
  }

  const fromDate = toDateOnly(value) || fallbackDate;

  return fromDate ? fromDate.slice(0, 7) : '';
}

function normalizeOpportunityStatus(value) {
  const raw = text(value) || 'Open';
  const key = removeAccents(raw).toLowerCase();

  const map = {
    won: 'WON',
    ganho: 'WON',
    ganha: 'WON',
    fechada_ganha: 'WON',
    lost: 'LOST',
    perdido: 'LOST',
    perdida: 'LOST',
    cancelada: 'LOST',
    freezing: 'Freezing',
    pausada: 'Freezing',
    congelada: 'Freezing',
    closed: 'Closed',
    fechada: 'Closed',
    open: 'Open',
    aberta: 'Open'
  };

  return map[key] || raw;
}

function normalizeOpportunityModel(value) {
  const raw = text(value) || 'Alocação';
  const key = removeAccents(raw).toLowerCase();

  const map = {
    alocacao: 'Alocação',
    hunting: 'Hunting',
    projeto: 'Projeto',
    consultoria: 'Consultoria'
  };

  return map[key] || raw;
}

function uniqueId(base, usedIds) {
  let candidate = base;
  let index = 2;

  while (usedIds.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function upsertById(existingItems, importedItems) {
  const map = new Map();

  for (const item of existingItems || []) {
    if (item?.id) {
      map.set(item.id, item);
    }
  }

  for (const item of importedItems || []) {
    if (item?.id) {
      map.set(item.id, {
        ...(map.get(item.id) || {}),
        ...item
      });
    }
  }

  return Array.from(map.values());
}

function sheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Aba obrigatória não encontrada no Excel: ${sheetName}`);
  }

  return XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: true,
    blankrows: false
  });
}

async function readJsonDatabase() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    return {
      clients: [],
      users: [],
      opportunities: [],
      curriculums: [],
      candidates: [],
      allocateds: [],
      cvFilters: [],
      selectedCandidates: []
    };
  }
}

async function writeBackup() {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(
      path.dirname(DATA_FILE),
      `database.backup-${stamp}.json`
    );

    await fs.copyFile(DATA_FILE, backupFile);

    return backupFile;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

function buildImportedData(workbook) {
  const timestamp = nowIso();

  const rowsOportunidades = sheetRows(workbook, 'Oportunidades');
  const rowsCandidatos = sheetRows(workbook, 'Candidatos');
  const rowsAlocados = sheetRows(workbook, 'Alocados');

  const clients = [];
  const clientsByKey = new Map();

  function getClientId(clientName) {
    const name = text(clientName) || 'Cliente não informado';
    const key = slug(name);

    if (clientsByKey.has(key)) {
      return clientsByKey.get(key).id;
    }

    const client = {
      id: `client_${key}`,
      customerName: name,
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      observation: 'Criado automaticamente pela importação da planilha migracao.xlsx.',
      createdAt: timestamp
    };

    clients.push(client);
    clientsByKey.set(key, client);

    return client.id;
  }

  function guessClientIdByOpportunityName(opportunityName) {
    const normalized = slug(opportunityName);

    for (const [clientKey, client] of clientsByKey.entries()) {
      if (normalized.includes(clientKey)) {
        return client.id;
      }
    }

    return getClientId('Cliente não informado');
  }

  const opportunities = [];
  const opportunityIdByCode = new Map();
  const opportunityIdByName = new Map();
  const usedOpportunityIds = new Set();

  for (const [index, row] of rowsOportunidades.entries()) {
    const opportunityName = text(pick(row, 'Oportunidade'));
    const clientName = text(pick(row, 'Cliente'));

    if (!opportunityName && !clientName) {
      continue;
    }

    const code = text(pick(row, 'Id_Oportunidade', 'ID Oportunidade')) || String(index + 1);
    const openingDate = toDateOnly(pick(row, 'Abertura'));
    const closingDate = toDateOnly(pick(row, 'Fechamento'));

    const baseId = `opp_${slug(code || opportunityName)}`;
    const opportunityId = uniqueId(baseId, usedOpportunityIds);

    opportunityIdByCode.set(String(code), opportunityId);
    opportunityIdByName.set(slug(opportunityName), opportunityId);

    opportunities.push({
      id: opportunityId,
      clientId: getClientId(clientName),
      opportunity: opportunityName,
      opportunityCode: code,
      status: normalizeOpportunityStatus(pick(row, 'Status')),
      openingDate,
      closingDate,
      monthYear: toMonthYear(
        pick(row, 'Ano_Mês', 'Ano_Mes', 'Ano Mês'),
        closingDate || openingDate
      ),
      model: normalizeOpportunityModel(pick(row, 'Modelo')),
      owner: text(pick(row, 'Responsável', 'Responsavel')),
      quantity: toInteger(pick(row, 'Qtde Vagas', 'Quantidade Vagas'), 0),
      closedQuantity: toInteger(pick(row, 'Qtde Fechada', 'Quantidade Fechada'), 0),
      contractValue: toNumber(pick(row, 'Valor Ano'), 0),
      observation: text(pick(row, 'Observação', 'Observacao')),
      createdAt: timestamp
    });
  }

  const candidates = [];
  const usedCandidateIds = new Set();

  for (const [index, row] of rowsCandidatos.entries()) {
    const consultantName = text(pick(row, 'Consultor'));
    const opportunityName = text(pick(row, 'Oportunidade'));
    const opportunityCode = text(pick(row, 'Id_Oportunidade', 'ID Oportunidade'));

    if (!consultantName && !opportunityName) {
      continue;
    }

    let opportunityId =
      opportunityIdByCode.get(opportunityCode) ||
      opportunityIdByName.get(slug(opportunityName));

    if (!opportunityId) {
      opportunityId = uniqueId(
        `opp_missing_${slug(opportunityName || opportunityCode || index + 1)}`,
        usedOpportunityIds
      );

      opportunityIdByCode.set(opportunityCode, opportunityId);
      opportunityIdByName.set(slug(opportunityName), opportunityId);

      opportunities.push({
        id: opportunityId,
        clientId: guessClientIdByOpportunityName(opportunityName),
        opportunity: opportunityName || `Oportunidade sem nome ${index + 1}`,
        opportunityCode,
        status: 'Open',
        openingDate: '',
        closingDate: '',
        monthYear: '',
        model: 'Alocação',
        owner: '',
        quantity: 0,
        closedQuantity: 0,
        contractValue: 0,
        observation: 'Criada automaticamente porque havia candidato vinculado sem registro na aba Oportunidades.',
        createdAt: timestamp
      });
    }

    const approved = toBoolean(pick(row, 'aprovado', 'Aprovado'));
    const stage = approved ? 'Aprovado' : 'Triagem';
    const rawConsultantId = text(pick(row, 'Id_consultor', 'ID Consultor'));

    const curriculumId =
      rawConsultantId && rawConsultantId !== '0'
        ? rawConsultantId
        : '';

    const baseId = `cand_${slug(consultantName)}_${slug(opportunityCode || opportunityName || index + 1)}`;
    const candidateId = uniqueId(baseId, usedCandidateIds);

    candidates.push({
      id: candidateId,
      name: consultantName,
      curriculumId,
      opportunityId,
      hourlyRate: toNumber(pick(row, 'Valor Hora'), 0),
      observation: text(pick(row, 'Observação', 'Observacao')),
      approved,
      stage,
      aderencia: 50,
      source: 'migracao.xlsx',
      notes: '',
      status: approved ? 'Aprovado' : 'Em andamento',
      stageEnteredAt: timestamp,
      createdAt: timestamp,
      stageHistory: [
        {
          stage,
          enteredAt: timestamp,
          leftAt: ''
        }
      ]
    });
  }

  const allocateds = [];
  const usedAllocatedIds = new Set();

  for (const [index, row] of rowsAlocados.entries()) {
    const consultant = text(pick(row, 'consultor', 'Consultor'));
    const code = text(pick(row, 'codigo', 'Código', 'Codigo')) || String(index + 1);
    const externalId = text(pick(row, 'Id', 'ID'));

    if (!consultant && !code) {
      continue;
    }

    const baseId =
      externalId && externalId !== '0'
        ? `alloc_${slug(externalId)}`
        : `alloc_${slug(code || consultant || index + 1)}`;

    allocateds.push({
      id: uniqueId(baseId, usedAllocatedIds),
      externalId,
      code,
      consultant,
      skill: text(pick(row, 'skill', 'Skill')),
      clientId: getClientId(pick(row, 'cliente', 'Cliente')),
      hourlyRate: toNumber(pick(row, 'valor hora', 'Valor Hora'), 0),

      // Quando existem colunas duplicadas no Excel, o xlsx normalmente gera email_1, phone_1 etc.
      phone: text(pick(row, 'phone', 'telefone', 'phone_1')),
      consultantEmail: text(pick(row, 'email', 'email consultor', 'email_1')),

      startDate: toDateOnly(pick(row, 'inicio', 'início', 'Inicio')),
      active: toBoolean(pick(row, 'ativo', 'Ativo')),
      endDate: toDateOnly(pick(row, 'termino', 'término', 'Termino')),

      manager: text(pick(row, 'gestor', 'Gestor')),
      managerEmail: text(pick(row, 'email do gestor', 'email gestor', 'email_1', 'email_2')),
      managerPhone: text(pick(row, 'phone do gestor', 'telefone do gestor', 'phone_1', 'phone_2')),

      createdAt: timestamp
    });
  }

  return {
    clients,
    opportunities,
    candidates,
    allocateds
  };
}

async function main() {
  await fs.access(EXCEL_FILE);

  const workbook = XLSX.readFile(EXCEL_FILE, {
    cellDates: false
  });

  for (const sheetName of REQUIRED_SHEETS) {
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Aba obrigatória não encontrada: ${sheetName}`);
    }
  }

  const db = await readJsonDatabase();
  const imported = buildImportedData(workbook);
  const backupFile = await writeBackup();

  for (const collection of [
    'clients',
    'users',
    'opportunities',
    'curriculums',
    'candidates',
    'allocateds',
    'cvFilters',
    'selectedCandidates'
  ]) {
    if (!Array.isArray(db[collection])) {
      db[collection] = [];
    }
  }

  if (MERGE_MODE) {
    db.clients = upsertById(db.clients, imported.clients);
    db.opportunities = upsertById(db.opportunities, imported.opportunities);
    db.candidates = upsertById(db.candidates, imported.candidates);
    db.allocateds = upsertById(db.allocateds, imported.allocateds);
  } else {
    db.clients = imported.clients;
    db.opportunities = imported.opportunities;
    db.candidates = imported.candidates;
    db.allocateds = imported.allocateds;
  }

  await fs.mkdir(path.dirname(DATA_FILE), {
    recursive: true
  });

  await fs.writeFile(DATA_FILE, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        mode: MERGE_MODE ? 'merge/upsert' : 'replace modules',
        excelFile: EXCEL_FILE,
        databaseFile: DATA_FILE,
        backupFile: backupFile || null,
        imported: {
          clients: imported.clients.length,
          opportunities: imported.opportunities.length,
          candidates: imported.candidates.length,
          allocateds: imported.allocateds.length
        },
        final: {
          clients: db.clients.length,
          opportunities: db.opportunities.length,
          candidates: db.candidates.length,
          allocateds: db.allocateds.length
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`Erro na importação: ${error.message}`);
  process.exit(1);
});