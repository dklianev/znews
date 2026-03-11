import assert from 'node:assert/strict';
import { createDiagnosticsService } from '../server/services/diagnosticsService.js';

export async function runDiagnosticsServiceTests() {
  const service = createDiagnosticsService({
    AdAnalyticsAggregate: {
      aggregate: async () => [{ impressions: 10, clicks: 2, rows: 1 }],
      findOne: () => ({ sort: () => ({ lean: async () => ({ bucketDate: '2026-03-12', aggregatedAt: '2026-03-12T00:00:00.000Z' }) }) }),
    },
    BackgroundJobState: {
      find: () => ({ sort: () => ({ lean: async () => [{ name: 'job-a', runCount: 1 }] }) }),
    },
    SystemEvent: {
      find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ fingerprint: 'a', level: 'error', lastSeenAt: '2026-03-12T00:00:00.000Z' }] }) }) }),
    },
    getApiCacheStats: () => ({ keyCount: 2, ttlSeconds: 60, countsByTag: { homepage: 1 }, recentInvalidations: [], performance: { hits: 3, misses: 1, writes: 1, hitRate: 0.75, hitsByTag: { homepage: 3 }, missesByTag: { homepage: 1 } } }),
    getImagePipelineStatus: async () => ({ total: 10, ready: 8, pending: 2, engine: 'sharp', updatedAt: '2026-03-12T00:00:00.000Z' }),
    getMongoHealthState: () => 'connected',
    getRecentUploadResults: () => new Map(),
    getRequestMetricsSnapshot: () => ({ totals: { requests: 4, errors: 1, cacheHits: 2, cacheMisses: 1, hitRate: 0.667 }, groups: [{ name: 'api-homepage', avgDurationMs: 120 }], recentRequests: [], slowRequests: [], slowRequestThresholdMs: 900 }),
    getUploadRequestInFlight: () => new Set(),
    isRemoteStorage: false,
    mongoose: { connection: { name: 'znews', host: 'localhost' } },
    sanitizeMonitoringMetadata: (value) => value,
    storageDriver: 'disk',
    storagePublicBaseUrl: '',
    toBucketDate: (value) => value,
  });

  const payload = await service.buildDiagnosticsPayload();
  assert.equal(payload.mongo.state, 'connected');
  assert.equal(payload.cache.performance.hits, 3);
  assert.equal(payload.requestMetrics.totals.requests, 4);
  assert.equal(payload.requestMetrics.groups[0].name, 'api-homepage');
}
