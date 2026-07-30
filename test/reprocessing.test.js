import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('email reprocessing can run bounded folder batches', () => {
  const serverSource = readRepoFile('server.js');
  const readerSource = readRepoFile('legacy_banco_talentos/modules/email_reader.py');

  assert.match(serverSource, /EMAIL_MAX_MESSAGES/);
  assert.match(serverSource, /maxMessages/);
  assert.match(readerSource, /self\.max_messages/);
  assert.match(readerSource, /emails\[:self\.max_messages\]/);
});

test('candidate reprocessing preserves existing non-empty data when extraction returns blanks', () => {
  const deduplicationSource = readRepoFile('legacy_banco_talentos/modules/deduplication.py');
  const updateCandidateSource = deduplicationSource.slice(deduplicationSource.indexOf('    def update_candidate'));

  assert.match(deduplicationSource, /def _has_value/);
  assert.match(deduplicationSource, /def _set_if_filled/);
  assert.match(deduplicationSource, /existing_doc = self\.collection\.find_one/);
  assert.match(deduplicationSource, /Campos existentes preservados/);
  assert.match(updateCandidateSource, /for field_name, value in field_map\.items\(\):\s+self\._set_if_filled/s);
  assert.doesNotMatch(updateCandidateSource, /'experiencia_profissional': candidate_data\.get\('Experiencia_Profissional', ''\)\.strip\(\)/);
});
