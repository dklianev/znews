export function createDiagnosticsService(deps) {
  const {
    AdAnalyticsAggregate,
    BackgroundJobState,
    SystemEvent,
    getApiCacheStats,
    getRequestMetricsSnapshot,
    getImagePipelineStatus,
    getMongoHealthState,
    getRecentUploadResults,
    getUploadRequestInFlight,
    isRemoteStorage,
    mongoose,
    sanitizeMonitoringMetadata,
    storageDriver,
    storagePublicBaseUrl,
    toBucketDate,
  } = deps;

  function buildEmptyAdAnalyticsDiagnostics() {
    return {
      last7Days: {
        impressions: 0,
        clicks: 0,
        rows: 0,
      },
      latestBucket: null,
    };
  }

  async function withDiagnosticsFallback(task, fallbackValue) {
    try {
      return await task();
    } catch {
      return typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue;
    }
  }

  async function getAdAnalyticsAggregateDiagnostics() {
    const cutoff = toBucketDate(new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)));
    const [totals, latest] = await Promise.all([
      AdAnalyticsAggregate.aggregate([
        { $match: { bucketDate: { $gte: cutoff } } },
        { $group: { _id: null, impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' }, rows: { $sum: 1 } } },
      ]),
      AdAnalyticsAggregate.findOne().sort({ aggregatedAt: -1 }).lean(),
    ]);
    const summary = totals[0] || { impressions: 0, clicks: 0, rows: 0 };
    return {
      last7Days: {
        impressions: Number(summary.impressions || 0),
        clicks: Number(summary.clicks || 0),
        rows: Number(summary.rows || 0),
      },
      latestBucket: latest ? {
        bucketDate: latest.bucketDate,
        aggregatedAt: latest.aggregatedAt,
      } : null,
    };
  }

  function getRecentErrors() {
    return withDiagnosticsFallback(
      async () => SystemEvent.find().sort({ lastSeenAt: -1 }).limit(12).lean(),
      []
    );
  }

  function getBackgroundJobStates() {
    return withDiagnosticsFallback(
      async () => BackgroundJobState.find().sort({ name: 1 }).lean(),
      []
    );
  }

  function getDiagnosticsMediaPipelineStatus() {
    return withDiagnosticsFallback(
      async () => getImagePipelineStatus(),
      null
    );
  }

  function getSafeAdAnalyticsDiagnostics() {
    return withDiagnosticsFallback(
      async () => getAdAnalyticsAggregateDiagnostics(),
      () => buildEmptyAdAnalyticsDiagnostics()
    );
  }

  async function buildDiagnosticsPayload() {
    const [mediaPipeline, recentErrors, jobStates, adAnalytics] = await Promise.all([
      getDiagnosticsMediaPipelineStatus(),
      getRecentErrors(),
      getBackgroundJobStates(),
      getSafeAdAnalyticsDiagnostics(),
    ]);
    const recentUploadResults = getRecentUploadResults();
    const uploadRequestInFlight = getUploadRequestInFlight();
    const requestMetrics = getRequestMetricsSnapshot();

    return {
      generatedAt: new Date().toISOString(),
      app: {
        env: process.env.NODE_ENV || 'development',
        uptimeSeconds: Math.round(process.uptime()),
        memory: sanitizeMonitoringMetadata(process.memoryUsage()),
      },
      mongo: {
        state: getMongoHealthState(),
        name: mongoose.connection?.name || '',
        host: mongoose.connection?.host || '',
      },
      cache: getApiCacheStats(),
      requestMetrics,
      storage: {
        driver: storageDriver,
        remote: isRemoteStorage,
        publicBaseUrl: storagePublicBaseUrl || '',
        uploadDedupCacheSize: recentUploadResults.size,
        uploadInFlight: uploadRequestInFlight.size,
      },
      mediaPipeline,
      jobs: jobStates,
      monitoring: {
        recentErrors,
      },
      adAnalytics,
    };
  }

  return {
    buildDiagnosticsPayload,
    getAdAnalyticsAggregateDiagnostics,
  };
}
