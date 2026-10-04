import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'intake-local');
await fs.mkdir(directory, { recursive: true });
const target = path.join(directory, 'database.json');
try {
  await fs.access(target);
} catch {
  // Existing local data only. Never read a remote database or mailbox for the pilot.
  const snapshot = JSON.parse(await fs.readFile(path.join(root, 'data', 'database.json'), 'utf8'));
  snapshot.opportunityIntakes = [];
  await fs.writeFile(target, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
}
// Allowlist OS variables; do not pass any integration credentials to the child.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(path|systemroot|windir|temp|tmp|userprofile|appdata|localappdata|comspec|pathext|home)$/i.test(key)));
Object.assign(env, { LOCAL_INTAKE_MODE: 'true', NODE_ENV: 'development', PORT: '3010', MONGODB_APP_COLLECTIONS: 'false', MONGODB_APP_REQUIRED: 'false', EMAIL_INBOX_SCHEDULE_ENABLED: 'false', STATUS_REPORT_REMINDER_ENABLED: 'false', FORM_REMINDER_ENABLED: 'false' });
console.log('Piloto LOCAL: http://127.0.0.1:3010/?view=opportunityIntake — base separada, integrações e e-mails desativados.');
const child = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.on('exit', code => { process.exitCode = code || 0; });
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
