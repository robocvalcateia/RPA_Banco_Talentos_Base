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

test('reprocessing stores original CV files with candidate links', () => {
  const mainSource = readRepoFile('legacy_banco_talentos/main.py');
  const storeSource = readRepoFile('legacy_banco_talentos/modules/original_file_store.py');

  assert.match(mainSource, /save_original_cv_file/);
  assert.match(mainSource, /arquivos_originais_gravados/);
  assert.match(mainSource, /arquivos_originais_ja_existentes/);
  assert.match(storeSource, /gridfs\.GridFS/);
  assert.match(storeSource, /metadata\.document_hash/);
  assert.match(storeSource, /unique=True/);
  assert.match(storeSource, /arquivos_originais/);
  assert.match(storeSource, /tem_arquivo_original/);
});

test('curriculum detail exposes original CV download from GridFS without bootstrapping blobs', () => {
  const serverSource = readRepoFile('server.js');
  const mongoSource = readRepoFile('mongo_talentos.js');
  const indexSource = readRepoFile('public/index.html');
  const appSource = readRepoFile('public/app.js');

  assert.match(indexSource, /openOriginalCurriculumButton/);
  assert.match(indexSource, /CV Original/);
  assert.match(appSource, /hasOriginalCurriculumFile/);
  assert.match(appSource, /apiDownload\(`\/api\/curriculums\/\$\{encodeURIComponent\(curriculumIdentifier\(current\)\)\}\/original-file`/);
  assert.match(serverSource, /original-file\$\//);
  assert.match(serverSource, /sendStreamDownload/);
  assert.match(mongoSource, /GridFSBucket/);
  assert.match(mongoSource, /getOriginalCurriculumFileFromMongo/);
  assert.match(mongoSource, /candidate_original_files/);
  assert.doesNotMatch(mongoSource, /data: 1/);
});

test('black flag is edited as a logical field with current observation', () => {
  const appSource = readRepoFile('public/app.js');
  const indexSource = readRepoFile('public/index.html');

  assert.match(indexSource, /blacklistCurriculumButton/);
  assert.match(appSource, /select name="blackflag"/);
  assert.match(appSource, /blacklistButton\.classList\.add\(blacklisted \? 'danger-action' : 'primary-action'\)/);
  assert.match(appSource, /blackflag: nextBlacklisted/);
  assert.match(appSource, /blackflagObservation: observation/);
  assert.doesNotMatch(appSource, /dataset\.nextBlacklist/);
});
