export function createBackgroundJobsService(deps) {
  const {
    BackgroundJobState,
    backgroundJobLockMs,
    recordSystemEvent,
    sanitizeMonitoringMetadata,
    serializeErrorForMonitoring,
    shouldDisableBackgroundJobs,
    truncateMonitoringText,
  } = deps;

  const backgroundJobDefinitions = [];
  const backgroundJobIntervals = [];
  const backgroundJobTimeouts = [];
  let backgroundJobsStarted = false;

  function registerBackgroundJob(definition) {
    backgroundJobDefinitions.push(definition);
  }

  async function runBackgroundJob(definition) {
    if (!definition?.name || typeof definition?.run !== 'function') return false;
    await BackgroundJobState.updateOne({ name: definition.name }, { $setOnInsert: { name: definition.name } }, { upsert: true });
    const now = new Date();
    const lockUntil = new Date(now.getTime() + backgroundJobLockMs);
    const state = await BackgroundJobState.findOneAndUpdate(
      { name: definition.name, enabled: { $ne: false }, $or: [{ lockUntil: null }, { lockUntil: { $lte: now } }] },
      { $set: { running: true, lockUntil, lastStartedAt: now, updatedAt: now } },
      { new: true }
    ).lean();
    if (!state) return false;

    const startedAt = Date.now();
    try {
      const result = await definition.run(state);
      const finishedAt = new Date();
      const durationMs = Date.now() - startedAt;
      await BackgroundJobState.updateOne(
        { name: definition.name },
        {
          $set: {
            running: false,
            lockUntil: null,
            lastFinishedAt: finishedAt,
            lastSuccessAt: finishedAt,
            lastFailureAt: state.lastFailureAt || null,
            lastDurationMs: durationMs,
            lastMessage: truncateMonitoringText(result?.message || 'Completed', 300),
            metrics: sanitizeMonitoringMetadata(result?.metrics || state.metrics || null),
            updatedAt: finishedAt,
          },
          $inc: { runCount: 1, successCount: 1 },
        }
      );
      return true;
    } catch (error) {
      const finishedAt = new Date();
      const durationMs = Date.now() - startedAt;
      await BackgroundJobState.updateOne(
        { name: definition.name },
        {
          $set: {
            running: false,
            lockUntil: null,
            lastFinishedAt: finishedAt,
            lastFailureAt: finishedAt,
            lastDurationMs: durationMs,
            lastMessage: truncateMonitoringText(error?.message || 'Failed', 300),
            updatedAt: finishedAt,
          },
          $inc: { runCount: 1, failureCount: 1 },
        }
      );
      await recordSystemEvent({
        level: 'error',
        source: 'job',
        component: definition.name,
        message: error?.message || 'Background job failed',
        metadata: { error: serializeErrorForMonitoring(error) },
      });
      return false;
    }
  }

  function startBackgroundJobs() {
    if (backgroundJobsStarted || shouldDisableBackgroundJobs()) return;
    backgroundJobsStarted = true;
    backgroundJobDefinitions.forEach((definition) => {
      const runOnce = () => {
        runBackgroundJob(definition).catch((error) => {
          console.error(`Background job ${definition.name} failed:`, error);
        });
      };
      const configuredInitialDelayMs = Number(definition.initialDelayMs || 1500);
      const initialDelayMs = Number.isFinite(configuredInitialDelayMs) ? Math.max(500, configuredInitialDelayMs) : 1500;
      const configuredIntervalMs = Number(definition.intervalMs || 60 * 1000);
      const intervalMs = Number.isFinite(configuredIntervalMs) ? Math.max(1000, configuredIntervalMs) : 60 * 1000;
      const timeout = setTimeout(runOnce, initialDelayMs);
      const interval = setInterval(runOnce, intervalMs);
      backgroundJobTimeouts.push(timeout);
      backgroundJobIntervals.push(interval);
    });
  }

  function stopBackgroundJobs() {
    while (backgroundJobTimeouts.length > 0) {
      clearTimeout(backgroundJobTimeouts.pop());
    }
    while (backgroundJobIntervals.length > 0) {
      clearInterval(backgroundJobIntervals.pop());
    }
    backgroundJobsStarted = false;
  }

  return {
    registerBackgroundJob,
    startBackgroundJobs,
    stopBackgroundJobs,
  };
}
