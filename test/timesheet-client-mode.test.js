import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('cliente define uma modalidade e projeto deixa de ser texto livre no Billing Report', async () => {
  const html = await readFile(new URL('public/index.html', root), 'utf8');
  assert.match(html, /name="timesheetMode"/);
  assert.match(html, /data-billing-panel="registrations"/);
  assert.match(html, /id="timesheetProjectForm"/);
  assert.match(html, /id="billingEntryProjectSelect"/);
  assert.doesNotMatch(html, /id="billingEntryForm"[\s\S]*?<input name="project"/);
});

test('interface deriva a forma de entrada do cliente e servidor impede modalidade divergente', async () => {
  const [app, server] = await Promise.all([
    readFile(new URL('public/app.js', root), 'utf8'),
    readFile(new URL('server.js', root), 'utf8')
  ]);
  assert.match(app, /timesheetModeForAllocated/);
  assert.match(app, /payload\.mode = timesheetModeForAllocated/);
  assert.match(server, /entry\.mode !== client\.timesheetMode/);
  assert.match(server, /PATCH' && pathname\.startsWith\('\/api\/timesheet-projects\/'\)/);
});
