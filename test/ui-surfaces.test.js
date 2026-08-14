import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('dialogos abrem pelo fluxo maximizado padronizado', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /function openSurfaceDialog\(dialogOrSelector\)/);
  assert.match(appSource, /\$\$\(\'\.modal-panel, \.modal-card\', dialog\)\.forEach\(\(surface\) => setSurfaceMaximized\(surface, true\)\);/);
  assert.doesNotMatch(appSource, /modal\??\.classList\.remove\('hidden'\);/);
  assert.doesNotMatch(appSource, /contactClientListModal'\)\?\.classList\.remove\('hidden'\);/);
});

test('views comuns limpam paineis antigos sem maximizar painel interno ao entrar', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = appSource.indexOf('function maximizeActiveViewPrimaryPanel(viewId)');
  const end = appSource.indexOf('function closeSurfaceDialog', start);
  const functionBody = appSource.slice(start, end);

  assert.match(functionBody, /\$\$\(\'\.panel\.panel-maximized\'\)\.forEach/);
  assert.match(functionBody, /\$\$\(\'\.panel\.surface-minimized\'\)\.forEach/);
  assert.doesNotMatch(functionBody, /setSurfaceMaximized\(targetPanel,\s*true\)/);
  assert.doesNotMatch(functionBody, /hasAttribute\('data-no-auto-maximize'\)/);
});

test('cards de Deals mantem Filtro de CVs antes de Candidatos', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /children:\s*\['opportunities',\s*'cvFilters',\s*'dealCandidates'\]/);
});

test('cadastro de oportunidade gera Id_Oportunidade sem exigir digitacao', () => {
  const indexSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const serverSource = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

  assert.match(indexSource, /input name="opportunityCode"[^>]*readonly/);
  assert.doesNotMatch(indexSource, /input name="opportunityCode" required/);
  assert.match(appSource, /form\.elements\.opportunityCode\.readOnly = true/);
  assert.match(serverSource, /function nextOpportunityCode\(db\)/);
  assert.match(serverSource, /if \(!opportunity\.opportunityCode\) opportunity\.opportunityCode = nextOpportunityCode\(db\);/);
  assert.doesNotMatch(serverSource, /Informe o Id_Oportunidade/);
});

test('dashboard e faturamento expõem gross margin e exportação completa', () => {
  const indexSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(indexSource, /id="exportFaturamentoDashboardCsvButton"/);
  assert.match(indexSource, /id="grossMarginDashboardChart"/);
  assert.match(indexSource, /class="dashboard-chart-grid"/);
  assert.match(indexSource, /Resultado/);
  assert.match(indexSource, /Gross Margin/);
  assert.match(appSource, /function grossMarginChartRows\(\)/);
  assert.match(appSource, /axisMin: 500/);
  assert.match(appSource, /axisMax: 1500/);
  assert.match(appSource, /axisMin: 5/);
  assert.match(appSource, /axisMax: 30/);
  assert.match(appSource, /formatMonthShortLabel/);
  assert.match(appSource, /showPointLabels: true/);
  assert.match(appSource, /String\(item\.monthYear\)\.startsWith\(`\$\{currentYear\}-`\)/);
  assert.match(appSource, /downloadCsv\('faturamento', faturamentoCsvRows\(state\.faturamento\)\)/);
});

test('consulta de talentos busca por identidade completa do curriculo', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /function curriculumIdentityText\(curriculum = \{\}\)/);
  assert.match(appSource, /curriculum\.email/);
  assert.match(appSource, /curriculum\.id_controle/);
  assert.match(appSource, /matchesEveryTerm\(curriculumIdentityText\(curriculum\), name\)/);
  assert.doesNotMatch(appSource, /matchesEveryTerm\(curriculum\.nome, name\)/);
});
