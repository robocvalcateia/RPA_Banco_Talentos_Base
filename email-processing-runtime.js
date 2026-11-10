import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

const RUNTIME_ID = 'inbox';
const EMAIL_PROCESSING_STAT_FIELDS = Object.freeze([
  'emails_processados',
  'arquivos_baixados',
  'arquivos_processados',
  'novos_candidatos',
  'candidatos_atualizados',
  'sem_mudancas',
  'gate_qualidade_reprovados',
  'erros'
]);

function asDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  return Number.isFinite(date.getTime()) ? date : new Date(fallback);
}

function conciseResult(result = {}) {
  const stats = result?.stats && typeof result.stats === 'object' ? result.stats : {};
  return {
    success: result?.success === true,
    message: String(result?.message || '').slice(0, 1000),
    totalCandidates: Number(result?.total_candidatos || 0),
    stats: Object.fromEntries(EMAIL_PROCESSING_STAT_FIELDS.map((field) => [field, Number(stats[field] || 0)]))
  };
}

export function summarizeEmailProcessingCycle(runs = [], receivedSinceAt = '') {
  const targetTime = asDate(receivedSinceAt, new Date(0)).getTime();
  const matchingRuns = (Array.isArray(runs) ? runs : [])
    .filter((run) => run?.status === 'success')
    .filter((run) => asDate(run?.receivedSinceAt, new Date(0)).getTime() === targetTime)
    .sort((first, second) => asDate(first.startedAt).getTime() - asDate(second.startedAt).getTime());
  const stats = Object.fromEntries(EMAIL_PROCESSING_STAT_FIELDS.map((field) => [field, 0]));

  for (const run of matchingRuns) {
    const runStats = run?.result?.stats || {};
    for (const field of EMAIL_PROCESSING_STAT_FIELDS) {
      stats[field] += Number(runStats[field] || 0);
    }
  }

  const first = matchingRuns[0] || {};
  const last = matchingRuns[matchingRuns.length - 1] || {};
  return {
    receivedSinceAt: receivedSinceAt || '',
    runCount: matchingRuns.length,
    startedAt: first.startedAt || '',
    finishedAt: last.finishedAt || '',
    totalCandidates: Number(last?.result?.totalCandidates || 0),
    stats
  };
}

export function createEmailProcessingRuntimeStore({
  env = process.env,
  clientFactory = (url) => new MongoClient(url, { serverSelectionTimeoutMS: 10000 })
} = {}) {
  let connection;

  async function connect() {
    if (!connection) {
      connection = (async () => {
        const url = env.MONGODB_URL || env.MONGODB_URI;
        if (!url) throw new Error('MongoDB obrigatorio para o agendador persistente de e-mails.');
        const client = await clientFactory(url).connect();
        const database = client.db(env.MONGODB_DB || 'Banco_de_Talentos');
        const prefix = env.MONGODB_APP_COLLECTION_PREFIX || '';
        const runtime = database.collection(`${prefix}emailProcessingRuntime`);
        const runs = database.collection(`${prefix}emailProcessingRuns`);
        await runtime.createIndex({ id: 1 }, { unique: true });
        await runs.createIndex({ runId: 1 }, { unique: true });
        await runs.createIndex({ startedAt: -1 });
        return { client, runtime, runs };
      })().catch((error) => {
        connection = null;
        throw error;
      });
    }
    return connection;
  }

  async function seedRuntime(now) {
    const { runtime } = await connect();
    await runtime.updateOne(
      { id: RUNTIME_ID },
      {
        $setOnInsert: {
          id: RUNTIME_ID,
          enabled: true,
          status: 'idle',
          createdAt: now,
          nextRunAt: new Date(0),
          updatedAt: now
        }
      },
      { upsert: true }
    );
  }

  return {
    async claim({ now = new Date(), intervalMs, leaseMs, trigger = 'schedule' } = {}) {
      const startedAt = asDate(now);
      await seedRuntime(startedAt);
      const { runtime, runs } = await connect();
      const owner = randomUUID();
      const runId = randomUUID();
      const leaseExpiresAt = new Date(startedAt.getTime() + Math.max(60000, Number(leaseMs || 0)));
      const claimed = await runtime.findOneAndUpdate(
        {
          id: RUNTIME_ID,
          enabled: { $ne: false },
          $and: [
            { $or: [{ nextRunAt: { $exists: false } }, { nextRunAt: { $lte: startedAt } }] },
            { $or: [{ leaseExpiresAt: { $exists: false } }, { leaseExpiresAt: null }, { leaseExpiresAt: { $lte: startedAt } }] }
          ]
        },
        {
          $set: {
            status: 'running',
            lastRunId: runId,
            lastStartedAt: startedAt,
            lastHeartbeatAt: startedAt,
            leaseOwner: owner,
            leaseExpiresAt,
            intervalMs: Number(intervalMs || 0),
            updatedAt: startedAt
          },
          $unset: { lastError: '', lastFinishedAt: '', lastResult: '' }
        },
        { returnDocument: 'after' }
      );
      if (!claimed) return null;

      await runs.updateMany(
        { status: 'running', leaseExpiresAt: { $lte: startedAt } },
        {
          $set: {
            status: 'abandoned',
            finishedAt: startedAt,
            error: 'Execucao anterior interrompida antes da conclusao; retomada automatica iniciada.'
          }
        }
      );
      await runs.insertOne({
        runId,
        runtimeId: RUNTIME_ID,
        owner,
        trigger,
        status: 'running',
        startedAt,
        lastHeartbeatAt: startedAt,
        leaseExpiresAt,
        createdAt: startedAt
      });
      return {
        runId,
        owner,
        trigger,
        startedAt: startedAt.toISOString(),
        lastSuccessAt: claimed.lastSuccessAt
          ? asDate(claimed.lastSuccessAt, startedAt).toISOString()
          : '',
        resumeReceivedSinceAt: claimed.catchUpPending && claimed.receivedSinceAt
          ? asDate(claimed.receivedSinceAt, startedAt).toISOString()
          : '',
        leaseExpiresAt: leaseExpiresAt.toISOString()
      };
    },

    async markJob(claim, jobId, now = new Date(), metadata = {}) {
      if (!claim?.owner || !claim?.runId) return;
      const at = asDate(now);
      const receivedSinceAt = metadata?.receivedSinceAt
        ? asDate(metadata.receivedSinceAt, at)
        : null;
      const { runtime, runs } = await connect();
      await Promise.all([
        runtime.updateOne(
          { id: RUNTIME_ID, leaseOwner: claim.owner, lastRunId: claim.runId },
          {
            $set: {
              jobId: String(jobId || ''),
              ...(receivedSinceAt ? { receivedSinceAt } : {}),
              lastHeartbeatAt: at,
              updatedAt: at
            }
          }
        ),
        runs.updateOne(
          { runId: claim.runId, owner: claim.owner },
          {
            $set: {
              jobId: String(jobId || ''),
              ...(receivedSinceAt ? { receivedSinceAt } : {}),
              lastHeartbeatAt: at,
              updatedAt: at
            }
          }
        )
      ]);
    },

    async heartbeat(claim, { leaseMs, now = new Date() } = {}) {
      if (!claim?.owner || !claim?.runId) return false;
      const at = asDate(now);
      const leaseExpiresAt = new Date(at.getTime() + Math.max(60000, Number(leaseMs || 0)));
      const { runtime, runs } = await connect();
      const runtimeResult = await runtime.updateOne(
        {
          id: RUNTIME_ID,
          status: 'running',
          leaseOwner: claim.owner,
          lastRunId: claim.runId
        },
        {
          $set: {
            lastHeartbeatAt: at,
            leaseExpiresAt,
            updatedAt: at
          }
        }
      );
      if (!runtimeResult.matchedCount) return false;
      await runs.updateOne(
        { runId: claim.runId, owner: claim.owner, status: 'running' },
        { $set: { lastHeartbeatAt: at, leaseExpiresAt, updatedAt: at } }
      );
      return true;
    },

    async recoverOrphaned({ now = new Date(), staleAfterMs = 3 * 60 * 1000 } = {}) {
      const at = asDate(now);
      const staleBefore = new Date(at.getTime() - Math.max(60000, Number(staleAfterMs || 0)));
      const { runtime, runs } = await connect();
      const reason = 'Execucao sem sinal de atividade; processo perdido recuperado automaticamente.';
      const orphaned = await runtime.findOneAndUpdate(
        {
          id: RUNTIME_ID,
          status: 'running',
          $or: [
            { lastHeartbeatAt: { $lte: staleBefore } },
            {
              $and: [
                { $or: [{ lastHeartbeatAt: { $exists: false } }, { lastHeartbeatAt: null }] },
                { updatedAt: { $lte: staleBefore } }
              ]
            }
          ]
        },
        {
          $set: {
            status: 'abandoned',
            lastFinishedAt: at,
            lastError: reason,
            nextRunAt: at,
            updatedAt: at
          },
          $unset: { leaseOwner: '', leaseExpiresAt: '', jobId: '' }
        },
        { returnDocument: 'before' }
      );
      if (!orphaned) return null;
      if (orphaned.lastRunId) {
        await runs.updateOne(
          {
            runId: orphaned.lastRunId,
            ...(orphaned.leaseOwner ? { owner: orphaned.leaseOwner } : {}),
            status: 'running'
          },
          {
            $set: {
              status: 'abandoned',
              finishedAt: at,
              error: reason,
              updatedAt: at
            }
          }
        );
      }
      return { runId: orphaned.lastRunId || '', recoveredAt: at.toISOString() };
    },

    async defer(claim, reason, retryMs, now = new Date()) {
      if (!claim?.owner || !claim?.runId) return;
      const finishedAt = asDate(now);
      const nextRunAt = new Date(finishedAt.getTime() + Math.max(60000, Number(retryMs || 0)));
      const { runtime, runs } = await connect();
      await Promise.all([
        runtime.updateOne(
          { id: RUNTIME_ID, leaseOwner: claim.owner, lastRunId: claim.runId },
          {
            $set: {
              status: 'deferred',
              lastFinishedAt: finishedAt,
              lastError: String(reason || '').slice(0, 2000),
              nextRunAt,
              updatedAt: finishedAt
            },
            $unset: { leaseOwner: '', leaseExpiresAt: '', jobId: '' }
          }
        ),
        runs.updateOne(
          { runId: claim.runId, owner: claim.owner },
          {
            $set: {
              status: 'deferred',
              finishedAt,
              nextRunAt,
              error: String(reason || '').slice(0, 2000)
            }
          }
        )
      ]);
    },

    async finish(claim, {
      status,
      result,
      error,
      intervalMs,
      failureRetryMs,
      successDelayMs,
      catchUp = false,
      finishedAt = new Date()
    } = {}) {
      if (!claim?.owner || !claim?.runId) return;
      const completedAt = asDate(finishedAt);
      const normalizedStatus = status === 'success' ? 'success' : (status === 'timeout' ? 'timeout' : 'failed');
      const delayMs = normalizedStatus === 'success'
        ? Math.max(60000, Number(successDelayMs || intervalMs || 0))
        : Math.max(60000, Number(failureRetryMs || 0));
      const nextRunAt = new Date(completedAt.getTime() + delayMs);
      const resultSummary = conciseResult(result);
      const errorText = String(error || '').slice(0, 2000);
      const successFields = normalizedStatus === 'success' && !catchUp
        ? { lastSuccessAt: completedAt }
        : {};
      const { runtime, runs } = await connect();
      await Promise.all([
        runtime.updateOne(
          { id: RUNTIME_ID, leaseOwner: claim.owner, lastRunId: claim.runId },
          {
            $set: {
              status: normalizedStatus,
              lastFinishedAt: completedAt,
              lastResult: resultSummary,
              lastError: errorText,
              nextRunAt,
              catchUpPending: normalizedStatus === 'success' && catchUp,
              ...successFields,
              updatedAt: completedAt
            },
            $unset: { leaseOwner: '', leaseExpiresAt: '', jobId: '' }
          }
        ),
        runs.updateOne(
          { runId: claim.runId, owner: claim.owner },
          {
            $set: {
              status: normalizedStatus,
              finishedAt: completedAt,
              result: resultSummary,
              error: errorText,
              catchUp: normalizedStatus === 'success' && catchUp,
              nextRunAt
            }
          }
        )
      ]);
      return { status: normalizedStatus, nextRunAt: nextRunAt.toISOString() };
    },

    async status() {
      const now = new Date();
      await seedRuntime(now);
      const { runtime } = await connect();
      const row = await runtime.findOne({ id: RUNTIME_ID }, { projection: { _id: 0 } });
      return row || null;
    },

    async recentRuns(limit = 20) {
      const { runs } = await connect();
      return runs.find({}, { projection: { _id: 0 } })
        .sort({ startedAt: -1 })
        .limit(Math.max(1, Math.min(100, Number(limit || 20))))
        .toArray();
    }
  };
}

export function createEmailProcessingScheduler({
  store,
  startProcessing,
  isProcessing = () => false,
  notifyFailure = async () => {},
  onSuccess = async () => {},
  intervalMs = 6 * 60 * 60 * 1000,
  pollMs = 60 * 1000,
  maxRuntimeMs = 45 * 60 * 1000,
  failureRetryMs = 15 * 60 * 1000,
  busyRetryMs = 5 * 60 * 1000,
  catchUpMs = 2 * 60 * 1000,
  batchSize = 0,
  heartbeatMs = 30 * 1000,
  orphanStaleMs = 3 * 60 * 1000,
  overlapMs = 2 * 60 * 60 * 1000,
  initialLookbackMs = 48 * 60 * 60 * 1000,
  logger = console
} = {}) {
  if (!store || typeof store.claim !== 'function') throw new Error('Store persistente do agendador nao informado.');
  if (typeof startProcessing !== 'function') throw new Error('Processador de e-mails nao informado.');
  let checking = false;
  let timer;
  let lastInfrastructureAlertAt = 0;
  const heartbeatTimers = new Map();

  function stopHeartbeat(runId) {
    const heartbeatTimer = heartbeatTimers.get(runId);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimers.delete(runId);
  }

  function startHeartbeat(claim) {
    if (typeof store.heartbeat !== 'function') return;
    stopHeartbeat(claim.runId);
    const heartbeatTimer = setInterval(() => {
      store.heartbeat(claim, {
        leaseMs: maxRuntimeMs + 5 * 60 * 1000,
        now: new Date()
      }).then((active) => {
        if (!active) {
          stopHeartbeat(claim.runId);
          logger.error(`[email-scheduler] Lease perdida para a execucao ${claim.runId}.`);
        }
      }).catch((error) => {
        logger.error('[email-scheduler] Falha ao registrar atividade:', error.message);
      });
    }, Math.max(1000, Number(heartbeatMs || 30000)));
    heartbeatTimer.unref?.();
    heartbeatTimers.set(claim.runId, heartbeatTimer);
  }

  async function finishAndAlert(claim, outcome = {}) {
    stopHeartbeat(claim.runId);
    const status = outcome.status === 'success' ? 'success' : (outcome.status === 'timeout' ? 'timeout' : 'failed');
    const emailsProcessed = Number(outcome?.result?.stats?.emails_processados || 0);
    const catchUp = status === 'success'
      && Number(batchSize || 0) > 0
      && emailsProcessed >= Number(batchSize);
    await store.finish(claim, {
      status,
      result: outcome.result,
      error: outcome.error,
      intervalMs,
      failureRetryMs,
      successDelayMs: catchUp ? catchUpMs : intervalMs,
      catchUp,
      finishedAt: outcome.finishedAt || new Date()
    });
    if (status === 'success') {
      try {
        await onSuccess({
          runId: claim.runId,
          receivedSinceAt: claim.receivedSinceAt || '',
          catchUp,
          result: outcome.result
        });
      } catch (error) {
        logger.error('[email-scheduler] Falha ao iniciar reconciliacao de aderencia:', error.message);
      }
    }
    logger.log(
      `[email-scheduler] Execucao ${claim.runId} finalizada: ${status}`
      + `${catchUp ? '; proximo lote agendado' : ''}.`
    );
    if (status !== 'success') {
      try {
        await notifyFailure({ ...outcome, status, runId: claim.runId });
      } catch (error) {
        logger.error('[email-scheduler] Falha ao enviar alerta operacional:', error.message);
      }
    }
  }

  async function tick(trigger = 'schedule') {
    if (checking) return { skipped: true, reason: 'local_check_running' };
    checking = true;
    let claim;
    try {
      const processorAlreadyRunning = isProcessing();
      if (!processorAlreadyRunning && typeof store.recoverOrphaned === 'function') {
        const recovered = await store.recoverOrphaned({
          now: new Date(),
          staleAfterMs: orphanStaleMs
        });
        if (recovered) {
          logger.log(`[email-scheduler] Execucao orfa recuperada: ${recovered.runId || 'sem identificador'}.`);
        }
      }
      claim = await store.claim({
        now: new Date(),
        intervalMs,
        leaseMs: maxRuntimeMs + 5 * 60 * 1000,
        trigger
      });
      if (!claim) return { skipped: true, reason: 'not_due_or_leased' };
      if (processorAlreadyRunning || isProcessing()) {
        await store.defer(claim, 'Outro processamento de e-mails esta em andamento.', busyRetryMs, new Date());
        logger.log('[email-scheduler] Execucao adiada porque ja existe processamento em andamento.');
        return { skipped: true, reason: 'processor_busy' };
      }

      if (typeof store.heartbeat === 'function') {
        const active = await store.heartbeat(claim, {
          leaseMs: maxRuntimeMs + 5 * 60 * 1000,
          now: new Date()
        });
        if (!active) throw new Error('A reserva persistente da execucao foi perdida antes do inicio.');
      }
      startHeartbeat(claim);

      const startedAt = asDate(claim.startedAt, new Date());
      const lastSuccessAt = claim.lastSuccessAt ? asDate(claim.lastSuccessAt, startedAt) : null;
      const receivedSinceAt = claim.resumeReceivedSinceAt
        ? asDate(claim.resumeReceivedSinceAt, startedAt).toISOString()
        : new Date(
          lastSuccessAt
            ? lastSuccessAt.getTime() - Math.max(0, Number(overlapMs || 0))
            : startedAt.getTime() - Math.max(60000, Number(initialLookbackMs || 0))
        ).toISOString();
      claim.receivedSinceAt = receivedSinceAt;
      const jobId = startProcessing({
        scheduledRunId: claim.runId,
        receivedSince: receivedSinceAt,
        maxRuntimeMs,
        onSettled: (outcome) => finishAndAlert(claim, outcome).catch((error) => {
          logger.error('[email-scheduler] Falha ao persistir conclusao:', error.message);
        })
      });
      await store.markJob(claim, jobId, new Date(), { receivedSinceAt });
      logger.log(
        `[email-scheduler] Execucao persistente iniciada: run=${claim.runId}, job=${jobId}, `
        + `desde=${receivedSinceAt}.`
      );
      return { started: true, runId: claim.runId, jobId, receivedSinceAt };
    } catch (error) {
      logger.error('[email-scheduler] Falha ao iniciar ciclo:', error.message);
      if (claim) {
        await finishAndAlert(claim, { status: 'failed', error: error.message, finishedAt: new Date() }).catch(() => {});
      } else if (Date.now() - lastInfrastructureAlertAt >= 60 * 60 * 1000) {
        lastInfrastructureAlertAt = Date.now();
        await notifyFailure({
          status: 'failed',
          runId: `scheduler-${new Date().toISOString()}`,
          error: `O agendador nao conseguiu acessar o controle persistente: ${error.message}`,
          finishedAt: new Date()
        }).catch((notificationError) => {
          logger.error('[email-scheduler] Falha ao alertar indisponibilidade do agendador:', notificationError.message);
        });
      }
      return { started: false, error: error.message };
    } finally {
      checking = false;
    }
  }

  return {
    tick,
    start() {
      tick('startup').catch((error) => logger.error('[email-scheduler] Falha no ciclo inicial:', error.message));
      timer = setInterval(() => {
        tick('schedule').catch((error) => logger.error('[email-scheduler] Falha no ciclo agendado:', error.message));
      }, Math.max(1000, Number(pollMs || 60000)));
      timer.unref?.();
      return () => {
        if (timer) clearInterval(timer);
        timer = undefined;
        for (const runId of heartbeatTimers.keys()) stopHeartbeat(runId);
      };
    }
  };
}
