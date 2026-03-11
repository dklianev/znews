export function createHealthService(deps) {
  const {
    getApiCacheStats,
    getShuttingDown,
    mongoose,
  } = deps;

  function getMongoHealthState() {
    const state = mongoose.connection?.readyState;
    return state === 1
      ? 'connected'
      : state === 2
        ? 'connecting'
        : state === 3
          ? 'disconnecting'
          : 'disconnected';
  }

  function buildHealthPayload(kind = 'ready') {
    const mongo = getMongoHealthState();
    const shuttingDown = getShuttingDown();
    const live = !shuttingDown;
    const ready = live && mongo === 'connected';
    return {
      ok: kind === 'live' ? live : ready,
      mongo,
      shuttingDown,
      uptime: Math.round(process.uptime()),
      cache: (() => { const stats = getApiCacheStats(); return { keyCount: stats.keyCount, ttlSeconds: stats.ttlSeconds }; })(),
      timestamp: new Date().toISOString(),
    };
  }

  return {
    buildHealthPayload,
    getMongoHealthState,
  };
}
