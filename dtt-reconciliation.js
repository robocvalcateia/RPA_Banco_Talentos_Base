import { strFromU8, unzipSync } from 'fflate';

const FINAL_AUTO_STATUSES = new Set(['Closed', 'LOST', 'Freezing']);

function decodeXml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function xmlAttributes(tag = '') {
  const attributes = {};
  for (const match of String(tag).matchAll(/([:\w.-]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function xmlText(fragment = '') {
  return Array.from(String(fragment).matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
    .map((match) => decodeXml(match[1]))
    .join('');
}

function columnIndex(reference = '') {
  const letters = String(reference).match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function normalizedZipPath(base, target) {
  const parts = `${base}/${String(target || '').replace(/^\//, '')}`.replace(/\\/g, '/').split('/');
  const normalized = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') normalized.pop();
    else normalized.push(part);
  }
  return normalized.join('/');
}

function worksheetRows(xml, sharedStrings) {
  const result = [];
  for (const rowMatch of String(xml).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttributes = xmlAttributes(rowMatch[1]);
    const rowNumber = Number(rowAttributes.r || result.length + 1);
    const values = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = xmlAttributes(cellMatch[1]);
      const body = cellMatch[2] || '';
      const index = columnIndex(attributes.r || 'A1');
      const rawValue = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1] || '';
      let value = decodeXml(rawValue);
      if (attributes.t === 's') value = sharedStrings[Number(value)] ?? '';
      else if (attributes.t === 'inlineStr') value = xmlText(body);
      else if (attributes.t === 'str') value = decodeXml(rawValue);
      else if (attributes.t === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
      values[index] = String(value ?? '').trim();
    }
    if (values.some((value) => String(value || '').trim())) result.push({ rowNumber, values });
  }
  return result;
}

export function parseXlsxWorkbook(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const read = (name) => files[name] ? strFromU8(files[name]) : '';
  const workbookXml = read('xl/workbook.xml');
  const relationshipXml = read('xl/_rels/workbook.xml.rels');
  if (!workbookXml || !relationshipXml) throw new Error('A planilha XLSX não contém uma estrutura válida.');

  const relationships = new Map();
  for (const tag of relationshipXml.match(/<Relationship\b[^>]*\/?\s*>/g) || []) {
    const attributes = xmlAttributes(tag);
    if (attributes.Id && attributes.Target) relationships.set(attributes.Id, normalizedZipPath('xl', attributes.Target));
  }

  const sharedStrings = [];
  for (const match of read('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) {
    sharedStrings.push(xmlText(match[1]));
  }

  const sheets = [];
  for (const tag of workbookXml.match(/<sheet\b[^>]*\/?\s*>/g) || []) {
    const attributes = xmlAttributes(tag);
    const relationshipId = attributes['r:id'];
    const target = relationships.get(relationshipId);
    const xml = target ? read(target) : '';
    if (!xml) continue;
    sheets.push({ name: attributes.name || `Aba ${sheets.length + 1}`, rows: worksheetRows(xml, sharedStrings) });
  }
  if (!sheets.length) throw new Error('Nenhuma aba legível foi encontrada no arquivo XLSX.');
  return sheets;
}

export function normalizeDttText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

function normalizedCode(value = '') {
  return normalizeDttText(String(value).replace(/\.0+$/, '')).replace(/\s+/g, '');
}

export function dttStatusFromValue(value = '') {
  const status = normalizeDttText(value);
  if (!status) return '';
  if (/\b(cancel|canceladas?|cancelados?|canceled|cancelled|lost|perdidas?|perdidos?)\b/.test(status)) return 'LOST';
  if (/\b(closed|fechadas?|fechados?|encerradas?|encerrados?|concluidas?|concluidos?|finalizadas?|finalizados?)\b/.test(status)) return 'Closed';
  if (/\b(suspensas?|suspensos?|freezing|congeladas?|congelados?|pausadas?|pausados?|hold)\b/.test(status)) return 'Freezing';
  if (/\b(won|ganhas?|ganhos?|contratadas?|contratados?|preenchidas?|preenchidos?)\b/.test(status)) return 'WON';
  if (/\b(open|abertas?|abertos?|ativas?|ativos?|em aberto)\b/.test(status)) return 'Open';
  return '';
}

const HEADER_ALIASES = {
  code: new Set(['codigo', 'cod', 'codigo vaga', 'cod vaga', 'codigo da vaga', 'codigo oportunidade', 'cod oportunidade', 'codigo requisicao', 'requisicao', 'id requisicao', 'job id', 'id vaga', 'n vaga', 'no vaga', 'n da vaga', 'no da vaga', 'numero vaga', 'numero da vaga', 'codigo dtt', 'cod dtt', 'id']),
  name: new Set(['vaga', 'nome vaga', 'nome da vaga', 'oportunidade', 'descricao vaga', 'descricao da vaga', 'descricao oportunidade', 'titulo vaga', 'titulo da vaga', 'job title', 'cargo', 'perfil', 'perfil profissional', 'perfil especializado', 'perfil profissional especializado', 'posicao']),
  status: new Set(['status', 'situacao', 'situacao vaga', 'situacao da vaga', 'status vaga', 'status da vaga', 'estado', 'andamento'])
};

function identifyHeaders(values = []) {
  const mapping = {};
  values.forEach((value, index) => {
    const header = normalizeDttText(value);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (mapping[key] === undefined && aliases.has(header)) mapping[key] = index;
    }
  });
  return mapping;
}

function inferSheetStatus(sheetName) {
  return dttStatusFromValue(sheetName);
}

export function extractDttSpreadsheetRows(buffer) {
  const rows = [];
  const seenRows = new Set();
  const sheets = parseXlsxWorkbook(buffer);
  for (const sheet of sheets) {
    const sheetStatus = inferSheetStatus(sheet.name);
    let header = null;
    for (const row of sheet.rows.slice(0, 25)) {
      const mapping = identifyHeaders(row.values);
      if ((mapping.code !== undefined || mapping.name !== undefined) && (mapping.status !== undefined || sheetStatus)) {
        header = { ...mapping, rowNumber: row.rowNumber };
        break;
      }
    }
    if (!header) continue;
    for (const row of sheet.rows) {
      if (row.rowNumber <= header.rowNumber) continue;
      const code = header.code === undefined ? '' : String(row.values[header.code] || '').trim().replace(/\.0+$/, '');
      const name = header.name === undefined ? '' : String(row.values[header.name] || '').trim();
      const rawStatus = header.status === undefined ? sheet.name : String(row.values[header.status] || '').trim();
      if (!code && !name) continue;
      const proposedStatus = dttStatusFromValue(rawStatus);
      const rowIdentity = [
        normalizeDttText(sheet.name).replace(/\b\d{1,4}\b/g, '').trim(),
        normalizedCode(code),
        normalizeDttText(name),
        proposedStatus
      ].join('|');
      if (seenRows.has(rowIdentity)) continue;
      seenRows.add(rowIdentity);
      rows.push({
        key: `${sheet.name}:${row.rowNumber}`,
        sheet: sheet.name,
        rowNumber: row.rowNumber,
        code,
        name,
        sourceStatus: rawStatus,
        proposedStatus
      });
    }
  }
  if (!rows.length) throw new Error('Não foram encontradas linhas com código/nome e status nas abas da planilha.');
  return rows;
}

function isDttClientName(value = '') {
  const name = normalizeDttText(value);
  return name === 'dtt' || name.includes('deloitte');
}

function candidateIdentity(record = {}) {
  const curriculumId = String(record.curriculumId || record.curriculumControlId || '').trim();
  return curriculumId ? `cv:${curriculumId}` : `name:${normalizeDttText(record.name)}`;
}

export function reconcileDttSpreadsheet({ buffer, opportunities = [], clients = [], candidates = [], selectedCandidates = [] }) {
  const sourceRows = extractDttSpreadsheetRows(buffer);
  const dttClientIds = new Set(clients.filter((client) => isDttClientName(client.customerName || client.name)).map((client) => String(client.id)));
  const dttOpportunities = opportunities.filter((opportunity) => (
    dttClientIds.has(String(opportunity.clientId))
    || isDttClientName(opportunity.clientName)
  ));
  const byCode = new Map();
  const byName = new Map();
  for (const opportunity of dttOpportunities) {
    const code = normalizedCode(opportunity.clientOpportunityCode);
    const name = normalizeDttText(opportunity.opportunity);
    if (code) byCode.set(code, [...(byCode.get(code) || []), opportunity]);
    if (name) byName.set(name, [...(byName.get(name) || []), opportunity]);
  }

  const linked = [...candidates, ...selectedCandidates];
  return sourceRows.map((source) => {
    const codeMatches = source.code ? (byCode.get(normalizedCode(source.code)) || []) : [];
    const nameMatches = !codeMatches.length && source.name ? (byName.get(normalizeDttText(source.name)) || []) : [];
    const matches = codeMatches.length ? codeMatches : nameMatches;
    const opportunity = matches.length === 1 ? matches[0] : null;
    const linkedIdentities = opportunity
      ? new Set(linked.filter((record) => record.opportunityId === opportunity.id).map(candidateIdentity).filter((identity) => identity !== 'name:'))
      : new Set();
    let result = 'unmatched';
    if (matches.length > 1) result = 'ambiguous';
    else if (opportunity && !source.proposedStatus) result = 'unknown-status';
    else if (opportunity && opportunity.status === source.proposedStatus) result = 'aligned';
    else if (opportunity && opportunity.status === 'Open' && FINAL_AUTO_STATUSES.has(source.proposedStatus)) result = 'divergence';
    else if (opportunity) result = 'manual-review';
    return {
      ...source,
      result,
      selectable: result === 'divergence',
      matchType: codeMatches.length ? 'code' : nameMatches.length ? 'name' : '',
      opportunityId: opportunity?.id || '',
      opportunityCode: opportunity?.opportunityCode || '',
      opportunityName: opportunity?.opportunity || '',
      systemStatus: opportunity?.status || '',
      linkedCandidateCount: linkedIdentities.size
    };
  });
}

export function reconciliationSummary(rows = []) {
  return {
    total: rows.length,
    divergences: rows.filter((row) => row.result === 'divergence').length,
    aligned: rows.filter((row) => row.result === 'aligned').length,
    unmatched: rows.filter((row) => row.result === 'unmatched').length,
    ambiguous: rows.filter((row) => row.result === 'ambiguous').length,
    manualReview: rows.filter((row) => ['manual-review', 'unknown-status'].includes(row.result)).length
  };
}

export const dttReconciliationInternals = { FINAL_AUTO_STATUSES, candidateIdentity, isDttClientName };
