import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('painel de oportunidades oferece upload XLSX ao lado das ações DTT', () => {
  assert.match(html, /id="openIntake"[\s\S]*id="runDttIntake"[\s\S]*id="uploadDttReconciliation"/);
  assert.match(html, /id="dttReconciliationFile"[^>]*accept="\.xlsx/);
});

test('prévia não altera dados e aplicação recebe somente os checks confirmados', () => {
  assert.match(app, /\/api\/opportunities\/dtt-reconciliation\/preview/);
  assert.match(app, /data-dtt-reconciliation-key/);
  assert.match(app, /id="dttReconciliationSelectAll"/);
  assert.match(app, /window\.confirm\(`Confirma a atualização/);
  assert.match(app, /\/api\/opportunities\/dtt-reconciliation\/apply/);
  assert.match(app, /selectedKeys:\s*selectedRows\.map/);
  assert.match(server, /pathname === '\/api\/opportunities\/dtt-reconciliation\/preview'/);
  assert.match(server, /pathname === '\/api\/opportunities\/dtt-reconciliation\/apply'/);
});

test('modal é largo, tem rolagem monitorada e mantém ações fora da área rolável', () => {
  assert.match(app, /class="table-wrap dtt-reconciliation-table-wrap" data-horizontal-scroll/);
  assert.match(styles, /\.dtt-reconciliation-card\s*\{[\s\S]*height:\s*92vh[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /\.dtt-reconciliation-table-wrap\s*\{[\s\S]*flex:\s*1 1 auto[\s\S]*overflow:\s*auto/);
  assert.match(styles, /\.dtt-reconciliation-table-wrap table\s*\{[\s\S]*min-width:\s*1600px/);
});

test('aplicação registra observações, reprova vínculos finais e dispara aviso DTT sem duplicidade', () => {
  assert.match(server, /appendRecordObservationOnce\(db, 'opportunity'/);
  assert.match(server, /appendCurriculumObservationOnce\(db, curriculum, candidateObservation/);
  assert.match(server, /rejectCandidateRecord\(record, user, candidateObservation/);
  assert.match(server, /type:\s*'dtt-closed'/);
  assert.match(server, /item\.type === type[\s\S]*item\.opportunityId === record\.opportunityId/);
});
