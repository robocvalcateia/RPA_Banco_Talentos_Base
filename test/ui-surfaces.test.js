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

test('views comuns nao maximizam um painel interno ao entrar', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = appSource.indexOf('function maximizeActiveViewPrimaryPanel(viewId)');
  const end = appSource.indexOf('function closeSurfaceDialog', start);
  const functionBody = appSource.slice(start, end);

  assert.match(functionBody, /\$\$\(\'\.panel\.panel-maximized\', view\)\.forEach/);
  assert.doesNotMatch(functionBody, /setSurfaceMaximized\(targetPanel,\s*true\)/);
  assert.doesNotMatch(functionBody, /hasAttribute\('data-no-auto-maximize'\)/);
});

test('cards de Deals mantem Filtro de CVs antes de Candidatos', () => {
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /children:\s*\['opportunities',\s*'cvFilters',\s*'dealCandidates'\]/);
});
