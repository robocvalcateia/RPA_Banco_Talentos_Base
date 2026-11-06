import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('a barra vertical usa o mesmo padrao em paginas, formularios, modais e tabelas', () => {
  assert.match(styles, /--scrollbar-track:\s*#dbe7e5/);
  assert.match(styles, /--scrollbar-thumb:\s*var\(--alcateia-green\)/);
  assert.match(styles, /html,[\s\S]*body,[\s\S]*\.sidebar,[\s\S]*\.modal-card,[\s\S]*\.modal-panel,[\s\S]*\.table-wrap,[\s\S]*\.panel\.panel-maximized,[\s\S]*#opportunityIntake pre,[\s\S]*\[data-vertical-scroll\][\s\S]*scrollbar-gutter:\s*stable/);
  assert.match(styles, /html,[\s\S]*\.modal-card,[\s\S]*\.modal-panel,[\s\S]*\.panel\.panel-maximized\s*\{[\s\S]*overflow-y:\s*scroll/);
});

test('a barra vertical permanece visivel e operavel em navegadores Chromium', () => {
  assert.match(styles, /::\-webkit-scrollbar:vertical\s*\{[\s\S]*width:\s*14px/);
  assert.match(styles, /::\-webkit-scrollbar-track:vertical\s*\{[\s\S]*background:\s*var\(--scrollbar-track\)/);
  assert.match(styles, /::\-webkit-scrollbar-thumb:vertical\s*\{[\s\S]*background:\s*var\(--scrollbar-thumb\)[\s\S]*min-height:\s*44px/);
});

test('grades altas mantem rolagem vertical independente da horizontal', () => {
  assert.match(styles, /\.dtt-reconciliation-table-wrap\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*scroll/);
  assert.match(styles, /\.dashboard-analytics-table-wrap\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*scroll/);
  assert.match(styles, /\.opportunity-candidate-search-table-wrap\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*scroll/);
});

test('todos os recipientes verticais existentes recebem o padrao visual', () => {
  const requiredContainers = [
    '.sidebar',
    '.modal-card',
    '.modal-panel',
    '.table-wrap',
    '.observation-list',
    '.curriculum-observations-list',
    '.dtt-reconciliation-table-wrap',
    '.dashboard-analytics-table-wrap',
    '.opportunity-candidate-search-table-wrap',
    '.opportunity-details-legend',
    '.panel.panel-maximized',
    '#opportunityIntake pre',
    '[data-vertical-scroll]',
  ];
  const standardRule = styles.match(/:is\(([^)]+)\)::\-webkit-scrollbar:vertical/);
  assert.ok(standardRule, 'regra visual padrao da barra vertical nao encontrada');
  requiredContainers.forEach((selector) => assert.match(standardRule[1], new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('controle horizontal nao pode ocultar a barra vertical', () => {
  assert.match(styles, /\.horizontal-scroll-target\.horizontal-scroll-controlled::\-webkit-scrollbar:horizontal\s*\{[\s\S]*height:\s*0/);
  assert.match(styles, /\.horizontal-scroll-target\.horizontal-scroll-controlled::\-webkit-scrollbar:vertical\s*\{[\s\S]*width:\s*14px/);
  assert.doesNotMatch(styles, /\.horizontal-scroll-target\.horizontal-scroll-controlled\s*\{[\s\S]*scrollbar-width:\s*none/);
  assert.doesNotMatch(styles, /\.horizontal-scroll-target\.horizontal-scroll-controlled::\-webkit-scrollbar\s*\{[\s\S]*width:\s*0/);
});
