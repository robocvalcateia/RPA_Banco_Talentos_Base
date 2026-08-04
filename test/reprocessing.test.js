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

test('email reprocessing filter also matches attachment filenames', () => {
  const readerSource = readRepoFile('legacy_banco_talentos/modules/email_reader.py');

  assert.match(readerSource, /def _normalize_filter_text/);
  assert.match(readerSource, /def _attachment_names_for_filter/);
  assert.match(readerSource, /attachment_text = self\._normalize_filter_text/);
  assert.match(readerSource, /filter_text in attachment_text/);
  assert.match(readerSource, /unicodedata\.normalize\('NFD'/);
});

test('email processing can repeat 100-message batches until folder is empty', () => {
  const serverSource = readRepoFile('server.js');

  assert.match(serverSource, /repeatUntilEmpty/);
  assert.match(serverSource, /emailProcessingCapturedAnything/);
  assert.match(serverSource, /Repetir em lotes ate a pasta esvaziar/);
  assert.match(serverSource, /maxMessages/);
  assert.match(serverSource, /EMAIL_PROCESSING_SYNC_TIMEOUT_MS/);
  assert.match(serverSource, /sync_error/);
});

test('production inbox processing is scheduled every six hours with log recipients', () => {
  const serverSource = readRepoFile('server.js');

  assert.match(serverSource, /EMAIL_INBOX_PROCESSING_INTERVAL_MS/);
  assert.match(serverSource, /EMAIL_INBOX_INTERVAL_HOURS \|\| 6/);
  assert.match(serverSource, /startScheduledInboxEmailProcessingJob/);
  assert.match(serverSource, /folders: 'inbox'/);
  assert.match(serverSource, /GRAPH_EMAIL_TO: buildGraphLogRecipients/);
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

test('reprocessing does not mark email as success when original CV storage fails', () => {
  const mainSource = readRepoFile('legacy_banco_talentos/main.py');
  const storeSource = readRepoFile('legacy_banco_talentos/modules/original_file_store.py');

  assert.match(mainSource, /motivo_original = original_file_result\.get\('reason'/);
  assert.match(mainSource, /Move_Folder = Folder_Mail_Erro/);
  assert.match(mainSource, /E-mail movido para \{Folder_Mail_Erro\} para novo reprocessamento/);
  assert.match(storeSource, /return False/);
  assert.match(storeSource, /falha_vincular_candidato/);
  assert.match(storeSource, /result\.matched_count/);
});

test('reprocessing blocks sparse CV extraction before moving email to success', () => {
  const mainSource = readRepoFile('legacy_banco_talentos/main.py');
  const gateSource = readRepoFile('legacy_banco_talentos/modules/cv_quality_gate.py');
  const deduplicationSource = readRepoFile('legacy_banco_talentos/modules/deduplication.py');
  const emailSource = readRepoFile('legacy_banco_talentos/utils/email_sender.py');

  assert.match(mainSource, /from modules\.cv_quality_gate import validate_cv_quality/);
  assert.match(mainSource, /quality_result = validate_cv_quality\(candidate_data\)/);
  assert.match(mainSource, /gate_qualidade_cv/);
  assert.match(mainSource, /Folder_Mail_Erro/);
  assert.match(mainSource, /nao gravado\/atualizado como sucesso/);
  assert.match(gateSource, /experiencia_profissional_incompleta_frente_ao_anexo_original/);
  assert.match(gateSource, /experiencia_profissional_menor_que_25_porcento_da_fonte/);
  assert.match(deduplicationSource, /texto_integral_original/);
  assert.match(deduplicationSource, /cv_quality_status/);
  assert.match(emailSource, /Reprovados no gate de qualidade/);
});

test('curriculum detail exposes original CV download from GridFS without bootstrapping blobs', () => {
  const serverSource = readRepoFile('server.js');
  const mongoSource = readRepoFile('mongo_talentos.js');
  const indexSource = readRepoFile('public/index.html');
  const appSource = readRepoFile('public/app.js');

  assert.match(indexSource, /openOriginalCurriculumButton/);
  assert.match(indexSource, /CV Original/);
  assert.match(appSource, /hasOriginalCurriculumFile/);
  assert.match(appSource, /originalButton\.disabled = false/);
  assert.match(appSource, /apiDownload\(`\/api\/curriculums\/\$\{encodeURIComponent\(curriculumIdentifier\(current\)\)\}\/original-file`/);
  assert.match(serverSource, /original-file\$\//);
  assert.match(serverSource, /sendStreamDownload/);
  assert.match(mongoSource, /GridFSBucket/);
  assert.match(mongoSource, /getOriginalCurriculumFileFromMongo/);
  assert.match(mongoSource, /metadata\.candidate_name/);
  assert.match(mongoSource, /originalFileNameFallbackQuery/);
  assert.match(mongoSource, /originalFileMatchesCandidate/);
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

test('curriculum detail action buttons stay green except variable black flag', () => {
  const appSource = readRepoFile('public/app.js');
  const indexSource = readRepoFile('public/index.html');
  const greenActionIds = [
    'selectCurriculumCandidateButton',
    'editCurriculumButton',
    'saveCurriculumButton',
    'cancelCurriculumEditButton',
    'exportAlcateiaButton',
    'exportDttButton',
    'openOriginalCurriculumButton',
    'curriculumObservationsButton'
  ];

  for (const actionId of greenActionIds) {
    assert.match(indexSource, new RegExp(`class="primary-action" id="${actionId}"`));
  }

  assert.match(appSource, /blacklistButton\.classList\.add\(blacklisted \? 'danger-action' : 'primary-action'\)/);
});
