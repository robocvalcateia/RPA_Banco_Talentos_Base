import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { CANDIDATE_FIT_ALERT_RECIPIENTS } from '../candidate-fit-alerts.js';
import { DTT_REVIEWERS } from '../intake-hourly.js';
import { DTT_REVIEWER_EMAILS } from '../opportunity-intake.js';
import {
  INTERNAL_NOTIFICATION_EMAILS,
  INTERNAL_NOTIFICATION_RECIPIENTS,
  INTERNAL_NOTIFICATION_TO
} from '../internal-notifications.js';

const expectedEmails = [
  'gerson@alcateiaconsulting.com.br',
  'bruno@alcateiaconsulting.com.br',
  'emerson.viana@alcateiaconsulting.com.br',
  'luiz.cesar@alcateiaconsulting.com.br'
];

test('all internal alerts share the four approved recipients', () => {
  assert.deepEqual(INTERNAL_NOTIFICATION_EMAILS, expectedEmails);
  assert.deepEqual(INTERNAL_NOTIFICATION_RECIPIENTS.map((recipient) => recipient.email), expectedEmails);
  assert.equal(INTERNAL_NOTIFICATION_TO, expectedEmails.join(','));
  assert.deepEqual(CANDIDATE_FIT_ALERT_RECIPIENTS, expectedEmails);
  assert.deepEqual(DTT_REVIEWERS.map((recipient) => recipient.email), expectedEmails);
  assert.deepEqual(DTT_REVIEWER_EMAILS, expectedEmails);
});

test('every internal notification feature uses the centralized recipients', () => {
  const server = readFileSync(path.resolve(import.meta.dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /notifyDttOpportunityCreated[\s\S]*?const recipients = INTERNAL_NOTIFICATION_RECIPIENTS/);
  assert.match(server, /notifyOpportunityResponsibilityTransfer[\s\S]*?const recipients = INTERNAL_NOTIFICATION_RECIPIENTS/);
  assert.match(server, /notifyFormRequest[\s\S]*?const to = INTERNAL_NOTIFICATION_TO/);
  assert.match(server, /sendDailyFormRequestReminders[\s\S]*?to: INTERNAL_NOTIFICATION_TO/);
  assert.match(server, /notifyAdminsAboutWorkHourClosure[\s\S]*?const to = INTERNAL_NOTIFICATION_TO/);
  assert.match(server, /PROCESSING_LOG_RECIPIENTS\s*=\s*INTERNAL_NOTIFICATION_EMAILS/);
});
