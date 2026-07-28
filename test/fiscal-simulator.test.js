import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('simulador financeiro separa CBS, IBS e legado por ano de transicao', () => {
  assert.match(appSource, /2027:\s*\{\s*pisCofinsLegacy:\s*0,\s*issLegacy:\s*1,\s*cbs:\s*1,\s*ibs:\s*0/);
  assert.match(appSource, /2029:\s*\{\s*pisCofinsLegacy:\s*0,\s*issLegacy:\s*0\.9,\s*cbs:\s*1,\s*ibs:\s*0\.1/);
  assert.match(appSource, /2033:\s*\{\s*pisCofinsLegacy:\s*0,\s*issLegacy:\s*0,\s*cbs:\s*1,\s*ibs:\s*1/);
  assert.doesNotMatch(appSource, /ibsCbsRate/);
});

test('parametrizacao fiscal reflete matriz Sao Paulo e filial Barueri dos documentos', () => {
  assert.match(appSource, /cnpj:\s*'26\.119\.211\/0001-31'/);
  assert.match(appSource, /cnpj:\s*'26\.119\.211\/0002-12'/);
  assert.match(appSource, /municipalCode:\s*'170401220'/);
  assert.match(appSource, /municipalCode:\s*'170501220'/);
  assert.match(appSource, /municipalCode:\s*'010602217'/);
  assert.match(appSource, /issRate:\s*0\.02/);
  assert.match(appSource, /issRate:\s*0\.029/);
});

test('telas financeiras expõem estabelecimento, servico e aliquotas separadas', () => {
  assert.match(indexSource, /name="establishment"/);
  assert.match(indexSource, /name="service"/);
  assert.match(indexSource, /name="cbsRate"/);
  assert.match(indexSource, /name="ibsRate"/);
  assert.match(indexSource, /name="taxProfile"/);
  assert.match(indexSource, /barueri-filial:alocacao/);
});
