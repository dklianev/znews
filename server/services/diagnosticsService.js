export function createDiagnosticsService(deps) {
  const {
    AdAnalyticsAggregate,
    BackgroundJobState,
    SystemEvent,
    getApiCacheStats,
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

  async function buildDiagnosticsPayload() {
    const [mediaPipeline, recentErrors, jobStates, adAnalytics] = await Promise.all([
      getImagePipelineStatus().catch(() => null),
      SystemEvent.find().sort({ lastSeenAt: -1 }).limit(12).lean().catch(() => []),
      BackgroundJobState.find().sort({ name: 1 }).lean().catch(() => []),
      getAdAnalyticsAggregateDiagnostics().catch(() => ({ last7Days: { impressions: 0, clicks: 0, rows: 0 }, latestBucket: null })),
    ]);
    const recentUploadResults = getRecentUploadResults();
    const uploadRequestInFlight = getUploadRequestInFlight();

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
