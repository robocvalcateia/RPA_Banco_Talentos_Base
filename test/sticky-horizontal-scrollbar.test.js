import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('todas as tabelas estaticas estao dentro de uma area horizontal monitorada', () => {
  const tableCount = (html.match(/<table\b/g) || []).length;
  const tableWrapCount = (html.match(/class="[^"]*table-wrap/g) || []).length;
  assert.equal(tableCount, 27);
  assert.equal(tableWrapCount, tableCount);
});

test('a barra horizontal flutuante cobre tabelas, formularios largos e DTT', () => {
  assert.match(app, /const horizontalScrollContainerSelector = \[/);
  assert.match(app, /'\.table-wrap'/);
  assert.match(app, /'\.intake-comparison'/);
  assert.match(app, /'\.client-org-report'/);
  assert.match(app, /'\.allocation-forecast-strip'/);
  assert.match(app, /'\.status-report-one-page'/);
  assert.match(app, /\$\$\('div, section, article, main'\)\s*\.filter\(isHorizontalScrollContainer\)/);
});

test('a barra permanece fixa na area visivel e sincroniza nos dois sentidos', () => {
  assert.match(styles, /\.sticky-horizontal-scrollbar\s*\{[\s\S]*bottom:\s*max\(8px, env\(safe-area-inset-bottom\)\)[\s\S]*position:\s*fixed[\s\S]*z-index:\s*100/);
  assert.match(styles, /\.sticky-horizontal-scrollbar-viewport\s*\{[\s\S]*overflow-x:\s*scroll/);
  assert.match(app, /target\.scrollLeft = viewport\.scrollLeft/);
  assert.match(app, /viewport\.scrollLeft = target\.scrollLeft/);
  assert.match(app, /Math\.abs\(target\.scrollLeft - viewport\.scrollLeft\) > 0\.5/);
  assert.match(app, /Math\.abs\(viewport\.scrollLeft - target\.scrollLeft\) > 0\.5/);
  assert.doesNotMatch(app, /if \(!target \|\| stickyHorizontalScrollbarState\.syncing\) return/);
  assert.match(app, /document\.addEventListener\('scroll',[\s\S]*capture:\s*true/);
  assert.match(app, /initStickyHorizontalScrollbar\(\)/);
});

test('mudancas de tela, modal, conteudo e tamanho recalculam a barra', () => {
  assert.match(app, /new MutationObserver/);
  assert.match(app, /attributeFilter:\s*\['class', 'hidden', 'open', 'style'\]/);
  assert.match(app, /new ResizeObserver\(scheduleStickyHorizontalScrollbarUpdate\)/);
  assert.match(app, /window\.addEventListener\('resize', scheduleStickyHorizontalScrollbarRefresh/);
});

test('o detalhamento do dashboard mantem a rolagem dentro da area visivel', () => {
  assert.match(styles, /\.dashboard-analytics-modal-card\s*\{[\s\S]*height:\s*92vh[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /#dashboardAnalyticsContent\s*\{[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/);
  assert.match(styles, /\.dashboard-analytics-table-wrap\s*\{[\s\S]*flex:\s*1 1 auto[\s\S]*overflow:\s*auto/);
});
