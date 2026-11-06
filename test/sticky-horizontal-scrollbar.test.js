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
  assert.match(styles, /\.sticky-horizontal-scrollbar\s*\{[\s\S]*bottom:\s*max\(8px, env\(safe-area-inset-bottom\)\)[\s\S]*position:\s*fixed[\s\S]*z-index:\s*10000/);
  assert.match(styles, /\.sticky-horizontal-scrollbar-track\s*\{[\s\S]*cursor:\s*pointer[\s\S]*touch-action:\s*none/);
  assert.match(styles, /\.sticky-horizontal-scrollbar-thumb\s*\{[\s\S]*cursor:\s*grab[\s\S]*position:\s*absolute/);
  assert.match(styles, /\.horizontal-scroll-target\.horizontal-scroll-controlled\s*\{[\s\S]*scrollbar-width:\s*auto/);
  assert.match(styles, /\.horizontal-scroll-target\.horizontal-scroll-controlled::\-webkit-scrollbar:horizontal\s*\{[\s\S]*height:\s*0/);
  assert.match(styles, /\.horizontal-scroll-target\.horizontal-scroll-controlled::\-webkit-scrollbar:vertical\s*\{[\s\S]*width:\s*14px/);
  assert.doesNotMatch(styles, /\.horizontal-scroll-target\.horizontal-scroll-controlled::\-webkit-scrollbar\s*\{[\s\S]*width:\s*0/);
  assert.match(app, /track\.addEventListener\('pointerdown'/);
  assert.match(app, /track\.addEventListener\('pointermove'/);
  assert.match(app, /target\.scrollLeft = Math\.max/);
  assert.match(app, /updateStickyHorizontalScrollbarThumb\(\)/);
  assert.doesNotMatch(app, /sticky-horizontal-scrollbar-viewport/);
  assert.match(app, /document\.addEventListener\('scroll',[\s\S]*capture:\s*true/);
  assert.match(app, /initStickyHorizontalScrollbar\(\)/);
});

test('a barra aceita mouse, toque, teclado e roda sem depender da barra nativa', () => {
  assert.match(app, /setPointerCapture/);
  assert.match(app, /releasePointerCapture/);
  assert.match(app, /track\.addEventListener\('keydown'/);
  assert.match(app, /ArrowLeft:[\s\S]*ArrowRight:[\s\S]*Home:\s*0,[\s\S]*End:\s*maximum/);
  assert.match(app, /track\.addEventListener\('wheel'/);
  assert.match(app, /aria-orientation="horizontal"/);
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
