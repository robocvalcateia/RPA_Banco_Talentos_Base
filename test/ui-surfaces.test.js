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
