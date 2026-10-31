import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function extract(source, name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, `Função não encontrada: ${name}`);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\n(?:export )?(?:async )?function |\nconst server =/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('lista mensal ordena do início ao fim do mês e totaliza as horas', () => {
  const state = { workHours: [
    { id: '3', allocatedId: 'a', date: '2026-10-25', hours: 4, createdAt: '2026-10-25T12:00:00Z' },
    { id: '1', allocatedId: 'a', date: '2026-10-02', hours: 8, createdAt: '2026-10-02T12:00:00Z' },
    { id: '2', allocatedId: 'a', date: '2026-10-02', startTime: '09:00', hours: 2, createdAt: '2026-10-02T11:00:00Z' },
    { id: 'other-month', allocatedId: 'a', date: '2026-09-30', hours: 7 },
    { id: 'other-consultant', allocatedId: 'b', date: '2026-10-10', hours: 6 }
  ] };
  const context = vm.createContext({ state, currentMonthValue: () => '2026-10' });
  vm.runInContext(extract(app, 'monthlyWorkHourRows'), context);
  const result = context.monthlyWorkHourRows('a', '2026-10-15');
  assert.deepEqual(Array.from(result.rows, (entry) => entry.id), ['1', '2', '3']);
  assert.equal(result.total, 14);
});

test('edição usa PATCH e novo lançamento usa POST', () => {
  assert.match(app, /editingId \? `\/api\/work-hours\/\$\{encodeURIComponent\(editingId\)\}` : '\/api\/work-hours'/);
  assert.match(app, /method: editingId \? 'PATCH' : 'POST'/);
  assert.match(app, /data-edit-work-hour/);
});
