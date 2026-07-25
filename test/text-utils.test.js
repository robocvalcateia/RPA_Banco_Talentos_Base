import test from 'node:test';
import assert from 'node:assert/strict';

import { repairUnicodeText, sanitizeUnicodeValue } from '../text-utils.js';

test('corrige mojibake e artefatos comuns de acentuacao', () => {
  assert.equal(repairUnicodeText('Gest\u00c3\u00a3o'), 'Gestão');
  assert.equal(repairUnicodeText('Experi\u00c3\u00aancia'), 'Experiência');
  assert.equal(repairUnicodeText('Aloca\u00c3\u00a7\u00c3\u00a3o'), 'Alocação');
  assert.equal(repairUnicodeText('Observa??o'), 'Observação');
  assert.equal(repairUnicodeText('migra??o'), 'migração');
  assert.equal(repairUnicodeText('requisi??o'), 'requisição');
  assert.equal(repairUnicodeText('S??o Paulo'), 'São Paulo');
  assert.equal(repairUnicodeText('N?o'), 'Não');
  assert.equal(repairUnicodeText('n?o'), 'não');
  assert.equal(repairUnicodeText('V?nculo'), 'Vínculo');
  assert.equal(repairUnicodeText('poss?vel'), 'possível');
  assert.equal(repairUnicodeText('Ingl?s'), 'Inglês');
});

test('saneia estruturas aninhadas preservando valores nao textuais', () => {
  const payload = {
    title: 'Formul?rios',
    nested: [{ label: 'Op??o', amount: 10, active: true }]
  };

  assert.deepEqual(sanitizeUnicodeValue(payload), {
    title: 'Formulários',
    nested: [{ label: 'Opção', amount: 10, active: true }]
  });
});
