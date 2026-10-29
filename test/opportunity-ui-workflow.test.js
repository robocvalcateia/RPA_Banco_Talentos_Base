import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('Voltar usa histórico de uma tela e preserva a tela anterior', () => {
  assert.match(app, /navigationHistory:\s*\[\]/);
  assert.match(app, /function goBackOneScreen\(\)/);
  assert.match(app, /state\.navigationHistory\.pop\(\)/);
  assert.match(app, /showView\(previous\.viewId, \{ skipHistory: true, restoreScrollY: previous\.scrollY \}\)/);
  assert.match(app, /button\.addEventListener\('click', returnToPreviousLauncherMenu\)/);
});

test('oportunidades Open com menos de tres candidatos ficam vermelhas e a tabela rola horizontalmente', () => {
  assert.match(app, /opportunity\.status === 'Open' && linkedCandidateCount < 3/);
  assert.match(app, /opportunity-needs-candidates/);
  assert.match(styles, /\.opportunity-needs-candidates > td/);
  assert.match(styles, /\.dashboard-analytics-table\s*\{[\s\S]*min-width: 1680px/);
  assert.match(styles, /#opportunities \.table-wrap\s*\{[\s\S]*overflow-x: auto/);
});

test('edicao oferece candidatos vinculados e busca exclusiva no Banco Alcateia', () => {
  assert.match(html, /id="opportunityLinkedCandidatesButton"/);
  assert.match(html, /id="opportunitySearchCandidatesButton"/);
  assert.match(app, /openOpportunityCandidateSearch/);
  assert.match(app, /Vincular selecionados/);
  assert.match(server, /candidate-search\$\/\.test\(pathname\)/);
  assert.match(server, /searchAlcateia: true/);
  assert.match(server, /searchApinfo: false/);
  assert.match(server, /searchLinkedin: false/);
  assert.match(server, /Este profissional ja esta vinculado a oportunidade/);
});
