import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('processing summary log is restricted to PROD and approved recipients', () => {
  const serverSource = readRepoFile('server.js');
  const environmentSource = readRepoFile('legacy_banco_talentos/utils/environment.py');
  const emailSenderSource = readRepoFile('legacy_banco_talentos/utils/email_sender.py');
  const combinedSource = `${serverSource}\n${environmentSource}\n${emailSenderSource}`;

  assert.match(serverSource, /rpa-banco-talentos-5v5r\.onrender\.com/);
  assert.match(serverSource, /APP_ENV:\s*isProductionRuntime\(\)\s*\?\s*'production'\s*:\s*'local'/);

  assert.doesNotMatch(environmentSource, /PROCESSING_LOGS_ENABLED|SEND_PROCESSING_LOG_EMAIL/);
  assert.match(environmentSource, /PRODUCTION_HOSTS/);
  assert.match(environmentSource, /PRODUCTION_SERVICE_NAMES/);

  assert.match(emailSenderSource, /PROCESSING_LOG_ALLOWED_RECIPIENTS/);
  assert.match(emailSenderSource, /gerson@alcateiaconsulting\.com\.br/);
  assert.match(emailSenderSource, /bruno@alcateiaconsulting\.com\.br/);
  assert.doesNotMatch(combinedSource, /joao\.buso|buso@gmail|joao.*gmail/i);
});
