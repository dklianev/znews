import { describe, expect, it } from 'vitest';

import { createDiagnosticsService } from '../../server/services/diagnosticsService.js';

describe('diagnostics service', () => {
  it('builds a healthy diagnostics payload from injected dependencies', async () => {
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
      getApiCacheStats: () => ({
        keyCount: 2,
        ttlSeconds: 60,
        countsByTag: { homepage: 1 },
        recentInvalidations: [],
        performance: { hits: 3, misses: 1, writes: 1, hitRate: 0.75, hitsByTag: { homepage: 3 }, missesByTag: { homepage: 1 } },
      }),
      getImagePipelineStatus: async () => ({ total: 10, ready: 8, pending: 2, engine: 'sharp', updatedAt: '2026-03-12T00:00:00.000Z' }),
      getMongoHealthState: () => 'connected',
      getRecentUploadResults: () => new Map(),
      getRequestMetricsSnapshot: () => ({
        totals: { requests: 4, errors: 1, cacheHits: 2, cacheMisses: 1, hitRate: 0.667 },
        groups: [{ name: 'api-homepage', avgDurationMs: 120 }],
        recentRequests: [],
        slowRequests: [],
        slowRequestThresholdMs: 900,
      }),
      getUploadRequestInFlight: () => new Set(),
      isRemoteStorage: false,
      mongoose: { connection: { name: 'znews', host: 'localhost' } },
      sanitizeMonitoringMetadata: (value) => value,
      storageDriver: 'disk',
      storagePublicBaseUrl: '',
      toBucketDate: (value) => value,
    });

    const payload = await service.buildDiagnosticsPayload();
    expect(payload.mongo.state).toBe('connected');
    expect(payload.cache.performance.hits).toBe(3);
    expect(payload.requestMetrics.totals.requests).toBe(4);
    expect(payload.requestMetrics.groups[0].name).toBe('api-homepage');
  });

  it('degrades gracefully when optional diagnostics dependencies fail', async () => {
    const service = createDiagnosticsService({
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
      getApiCacheStats: () => ({
        keyCount: 0,
        ttlSeconds: 60,
        countsByTag: {},
        recentInvalidations: [],
        performance: { hits: 0, misses: 0, writes: 0, hitRate: 0, hitsByTag: {}, missesByTag: {} },
      }),
      getImagePipelineStatus: async () => { throw new Error('pipeline failed'); },
      getMongoHealthState: () => 'degraded',
      getRecentUploadResults: () => new Map(),
      getRequestMetricsSnapshot: () => ({
        totals: { requests: 0, errors: 0, cacheHits: 0, cacheMisses: 0, hitRate: 0 },
        groups: [],
        recentRequests: [],
        slowRequests: [],
        slowRequestThresholdMs: 900,
      }),
      getUploadRequestInFlight: () => new Set(),
      isRemoteStorage: true,
      mongoose: { connection: { name: '', host: '' } },
      sanitizeMonitoringMetadata: (value) => value,
      storageDriver: 'spaces',
      storagePublicBaseUrl: 'https://cdn.example.com',
      toBucketDate: (value) => value,
    });

    const payload = await service.buildDiagnosticsPayload();
    expect(payload.mediaPipeline).toBeNull();
    expect(payload.monitoring.recentErrors).toEqual([]);
    expect(payload.jobs).toEqual([]);
    expect(payload.adAnalytics).toEqual({
      last7Days: { impressions: 0, clicks: 0, rows: 0 },
      latestBucket: null,
    });
  });
});
