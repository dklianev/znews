import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createDiagnosticsService } from '../server/services/diagnosticsService.js';

describe('diagnosticsService', () => {
  it('covers legacy scenarios', async () => {
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
    
      const degradedService = createDiagnosticsService({
        AdAnalyticsAggregate: {
          aggregate: async () => { throw new Error('aggregate failed'); },
          findOne: () => ({ sort: () => ({ lean: async () => null }) }),
        },
        BackgroundJobState: {
          find: () => ({ sort: () => ({ lean: async () => { throw new Error('jobs failed'); } }) }),
        },
        SystemEvent: {
          find: () => ({ sort: () => ({ limit: () => ({ lean: async () => { throw new Error('events failed'); } }) }) }),
        },
        getApiCacheStats: () => ({ keyCount: 0, ttlSeconds: 60, countsByTag: {}, recentInvalidations: [], performance: { hits: 0, misses: 0, writes: 0, hitRate: 0, hitsByTag: {}, missesByTag: {} } }),
        getImagePipelineStatus: async () => { throw new Error('pipeline failed'); },
        getMongoHealthState: () => 'degraded',
        getRecentUploadResults: () => new Map(),
        getRequestMetricsSnapshot: () => ({ totals: { requests: 0, errors: 0, cacheHits: 0, cacheMisses: 0, hitRate: 0 }, groups: [], recentRequests: [], slowRequests: [], slowRequestThresholdMs: 900 }),
        getUploadRequestInFlight: () => new Set(),
        isRemoteStorage: true,
        mongoose: { connection: { name: '', host: '' } },
        sanitizeMonitoringMetadata: (value) => value,
        storageDriver: 'spaces',
        storagePublicBaseUrl: 'https://cdn.example.com',
        toBucketDate: (value) => value,
      });
    
      const degradedPayload = await degradedService.buildDiagnosticsPayload();
      assert.equal(degradedPayload.mediaPipeline, null);
      assert.deepEqual(degradedPayload.monitoring.recentErrors, []);
      assert.deepEqual(degradedPayload.jobs, []);
      assert.deepEqual(degradedPayload.adAnalytics, {
        last7Days: { impressions: 0, clicks: 0, rows: 0 },
        latestBucket: null,
      });
  });
});
