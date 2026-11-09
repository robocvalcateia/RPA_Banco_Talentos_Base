import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('simulador financeiro inicia CBS e IBS em 2026 e separa destaque de efeito economico', () => {
  assert.match(appSource, /2026:\s*\{[\s\S]*?cbsFixedRate:\s*0\.009,[\s\S]*?ibsFixedRate:\s*0\.001,[\s\S]*?newTaxEconomicFactor:\s*0/);
  assert.match(appSource, /2027:\s*\{[\s\S]*?cbsReferenceReduction:\s*0\.001,[\s\S]*?ibsFixedRate:\s*0\.001,[\s\S]*?newTaxEconomicFactor:\s*1/);
  assert.match(appSource, /2028:\s*\{[\s\S]*?cbsReferenceReduction:\s*0\.001,[\s\S]*?ibsFixedRate:\s*0\.001,[\s\S]*?newTaxEconomicFactor:\s*1/);
  assert.match(appSource, /2029:\s*\{\s*pisCofinsLegacy:\s*0,\s*issLegacy:\s*0\.9,\s*cbsReferenceShare:\s*1,\s*ibsReferenceShare:\s*0\.1/);
  assert.match(appSource, /2033:\s*\{\s*pisCofinsLegacy:\s*0,\s*issLegacy:\s*0,\s*cbsReferenceShare:\s*1,\s*ibsReferenceShare:\s*1/);
  assert.match(appSource, /\.filter\(\(row\) => row\.year >= 2026 && row\.year <= 2033\)/);
  assert.doesNotMatch(appSource, /ibsCbsRate/);
});

test('referencias atuais usam CBS calculada pelo TCU e IBS como premissa editavel', () => {
  assert.match(appSource, /cbs2027ReferenceRate:\s*0\.113/);
  assert.match(appSource, /ibsPlanningReferenceRate:\s*0\.187/);
  assert.match(appSource, /probable:\s*\{[^}]*cbsRate:\s*11\.3,\s*ibsRate:\s*18\.7/);
  assert.match(indexSource, /name="cbsRate"[^>]*value="11\.3"/);
  assert.match(indexSource, /name="ibsRate"[^>]*value="18\.7"/);
  assert.match(indexSource, /<th>CBS<\/th>\s*<th>IBS<\/th>/);
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
