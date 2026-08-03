import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('smtp envia corpo em base64 UTF-8 para preservar acentuacao', () => {
  const source = readFileSync(path.join(repoRoot, 'smtp.js'), 'utf8');

  assert.match(source, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(source, /Content-Transfer-Encoding: base64/);
  assert.match(source, /encodeBodyBase64\(text\)/);
  assert.doesNotMatch(source, /Content-Transfer-Encoding: 8bit/);
});
