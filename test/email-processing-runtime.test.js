import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmailProcessingScheduler } from '../email-processing-runtime.js';

function createFakeStore() {
  const state = {
    due: true,
    leased: false,
    claims: [],
    jobs: [],
    finishes: [],
    defers: [],
    lastSuccessAt: null
  };
  return {
    state,
    async claim({ trigger }) {
      if (!state.due || state.leased) return null;
      const claim = {
        runId: `run-${state.claims.length + 1}`,
        owner: `owner-${state.claims.length + 1}`,
        trigger,
        ...(state.lastSuccessAt ? { lastSuccessAt: state.lastSuccessAt } : {})
      };
      state.leased = true;
      state.claims.push(claim);
      return claim;
    },
    async markJob(claim, jobId) {
      state.jobs.push({ claim, jobId });
    },
    async defer(claim, reason) {
      state.leased = false;
      state.defers.push({ claim, reason });
    },
    async finish(claim, outcome) {
      state.leased = false;
      state.due = false;
      state.finishes.push({ claim, outcome });
    }
  };
}

test('persistent email scheduler checks immediately when the service starts', async () => {
  const store = createFakeStore();
  let processingOptions;
  const scheduler = createEmailProcessingScheduler({
    store,
    pollMs: 600000,
    startProcessing(options) {
      processingOptions = options;
      return 'job-1';
    },
    logger: { log() {}, error() {} }
  });

  const stop = scheduler.start();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  stop();

  assert.equal(store.state.claims.length, 1);
  assert.equal(store.state.claims[0].trigger, 'startup');
  assert.equal(store.state.jobs[0].jobId, 'job-1');
  assert.ok(processingOptions?.onSettled);

  await processingOptions.onSettled({ status: 'success', result: { success: true } });
  assert.equal(store.state.finishes.length, 1);
  assert.equal(store.state.finishes[0].outcome.status, 'success');
});

test('persistent claim prevents a restart from duplicating a run that is not due', async () => {
  const store = createFakeStore();
  let firstOptions;
  const first = createEmailProcessingScheduler({
    store,
    startProcessing(options) {
      firstOptions = options;
      return 'job-1';
    },
    logger: { log() {}, error() {} }
  });
  assert.equal((await first.tick('startup')).started, true);
  await firstOptions.onSettled({ status: 'success', result: { success: true } });

  const second = createEmailProcessingScheduler({
    store,
    startProcessing() {
      throw new Error('nao deve iniciar');
    },
    logger: { log() {}, error() {} }
  });
  const result = await second.tick('startup');

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'not_due_or_leased');
  assert.equal(store.state.claims.length, 1);
});

test('timeout is persisted and sends one operational alert', async () => {
  const store = createFakeStore();
  const alerts = [];
  let processingOptions;
  const scheduler = createEmailProcessingScheduler({
    store,
    startProcessing(options) {
      processingOptions = options;
      return 'job-timeout';
    },
    notifyFailure: async (outcome) => alerts.push(outcome),
    logger: { log() {}, error() {} }
  });

  await scheduler.tick('startup');
  await processingOptions.onSettled({ status: 'timeout', error: 'prazo excedido' });

  assert.equal(store.state.finishes.length, 1);
  assert.equal(store.state.finishes[0].outcome.status, 'timeout');
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].status, 'timeout');
});

test('busy processor releases the persistent lease for a safe retry', async () => {
  const store = createFakeStore();
  const scheduler = createEmailProcessingScheduler({
    store,
    isProcessing: () => true,
    startProcessing() {
      throw new Error('nao deve iniciar');
    },
    logger: { log() {}, error() {} }
  });

  const result = await scheduler.tick('startup');

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'processor_busy');
  assert.equal(store.state.defers.length, 1);
  assert.equal(store.state.leased, false);
});

test('persistent-store outage raises one throttled operational alert', async () => {
  const alerts = [];
  const scheduler = createEmailProcessingScheduler({
    store: {
      async claim() { throw new Error('mongo indisponivel'); }
    },
    startProcessing() {
      throw new Error('nao deve iniciar');
    },
    notifyFailure: async (outcome) => alerts.push(outcome),
    logger: { log() {}, error() {} }
  });

  const first = await scheduler.tick('startup');
  const second = await scheduler.tick('schedule');

  assert.equal(first.started, false);
  assert.equal(second.started, false);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].error, /controle persistente/);
});

test('successful checkpoint is read with a two-hour overlap', async () => {
  const store = createFakeStore();
  store.state.lastSuccessAt = '2026-11-06T12:00:00.000Z';
  let processingOptions;
  const scheduler = createEmailProcessingScheduler({
    store,
    startProcessing(options) {
      processingOptions = options;
      return 'job-window';
    },
    logger: { log() {}, error() {} }
  });

  const result = await scheduler.tick('schedule');

  assert.equal(result.started, true);
  assert.equal(processingOptions.receivedSince, '2026-11-06T10:00:00.000Z');
});

test('first run falls back to a 48-hour safety window', async () => {
  const store = createFakeStore();
  let processingOptions;
  const before = Date.now();
  const scheduler = createEmailProcessingScheduler({
    store,
    startProcessing(options) {
      processingOptions = options;
      return 'job-first-window';
    },
    logger: { log() {}, error() {} }
  });

  await scheduler.tick('startup');
  const after = Date.now();
  const since = Date.parse(processingOptions.receivedSince);

  assert.ok(since >= before - 48 * 60 * 60 * 1000 - 1000);
  assert.ok(since <= after - 48 * 60 * 60 * 1000 + 1000);
});
