import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import {
  dttStatusFromValue,
  extractDttSpreadsheetRows,
  reconcileDttSpreadsheet,
  reconciliationSummary
} from '../dtt-reconciliation.js';

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function columnName(index) {
  let value = index + 1;
  let result = '';
  while (value) {
    value -= 1;
    result = String.fromCharCode(65 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function worksheet(rows) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
}

function workbook(sheets) {
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`;
  const files = {
    'xl/workbook.xml': strToU8(workbookXml),
    'xl/_rels/workbook.xml.rels': strToU8(rels)
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheet(sheet.rows)); });
  return Buffer.from(zipSync(files));
}

test('mapeia os status operacionais da planilha sem transformar WON automaticamente', () => {
  assert.equal(dttStatusFromValue('Cancelada'), 'LOST');
  assert.equal(dttStatusFromValue('Vagas Encerradas'), 'Closed');
  assert.equal(dttStatusFromValue('Suspensa / on hold'), 'Freezing');
  assert.equal(dttStatusFromValue('Em aberto'), 'Open');
  assert.equal(dttStatusFromValue('Ganha'), 'WON');
  assert.equal(dttStatusFromValue('Sem definição'), '');
});

test('lê todas as abas e usa o nome da aba quando não há coluna de status', () => {
  const file = workbook([
    { name: 'Vagas Abertas', rows: [['Código', 'Nome da vaga'], ['2095', 'Consultor Coupa']] },
    { name: 'Canceladas', rows: [['Código', 'Oportunidade'], ['2096', 'Consultor SAP CPQ']] }
  ]);
  assert.deepEqual(extractDttSpreadsheetRows(file).map(({ code, name, proposedStatus, sheet }) => ({ code, name, proposedStatus, sheet })), [
    { code: '2095', name: 'Consultor Coupa', proposedStatus: 'Open', sheet: 'Vagas Abertas' },
    { code: '2096', name: 'Consultor SAP CPQ', proposedStatus: 'LOST', sheet: 'Canceladas' }
  ]);
});

test('concilia primeiro pelo código DTT, usa nome exato como fallback e só habilita divergência segura', () => {
  const file = workbook([
    { name: 'Relação geral', rows: [
      ['Código da vaga', 'Descrição da vaga', 'Status'],
      ['2095', 'Nome divergente', 'Cancelada'],
      ['', 'Analista Pleno', 'Fechada'],
      ['9999', 'Inexistente', 'Cancelada'],
      ['2097', 'Gerente', 'Ganha']
    ] }
  ]);
  const rows = reconcileDttSpreadsheet({
    buffer: file,
    clients: [{ id: 'dtt', customerName: 'Deloitte' }, { id: 'other', customerName: 'Outro' }],
    opportunities: [
      { id: 'a', clientId: 'dtt', clientOpportunityCode: '2095', opportunityCode: '211', opportunity: 'Consultor Coupa', status: 'Open' },
      { id: 'b', clientId: 'dtt', clientOpportunityCode: '', opportunityCode: '213', opportunity: 'Analista Pleno', status: 'Open' },
      { id: 'c', clientId: 'dtt', clientOpportunityCode: '2097', opportunityCode: '217', opportunity: 'Gerente', status: 'Open' },
      { id: 'x', clientId: 'other', clientOpportunityCode: '9999', opportunity: 'Inexistente', status: 'Open' }
    ],
    candidates: [{ id: 'candidate', opportunityId: 'a', curriculumId: 'cv-1', name: 'Pessoa' }],
    selectedCandidates: [{ id: 'selected', opportunityId: 'a', curriculumId: 'cv-1', name: 'Pessoa' }]
  });
  assert.deepEqual(rows.map((row) => [row.opportunityId, row.proposedStatus, row.result, row.selectable]), [
    ['a', 'LOST', 'divergence', true],
    ['b', 'Closed', 'divergence', true],
    ['', 'LOST', 'unmatched', false],
    ['c', 'WON', 'manual-review', false]
  ]);
  assert.equal(rows[0].matchType, 'code');
  assert.equal(rows[0].linkedCandidateCount, 1);
  assert.equal(rows[1].matchType, 'name');
  assert.deepEqual(reconciliationSummary(rows), { total: 4, divergences: 2, aligned: 0, unmatched: 1, ambiguous: 0, manualReview: 1 });
});
