import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { createRequestMetricsService } from '../../server/services/requestMetricsService.js';

describe('request metrics service', () => {
  it('tracks grouped API metrics, cache stats, and slow requests', () => {
    const service = createRequestMetricsService({ slowRequestThresholdMs: 500, maxRecentEntries: 3, maxSlowEntries: 2 });

    service.recordRequestMetric({ method: 'GET', path: '/api/homepage?compact=1', statusCode: 200, durationMs: 120, cacheStatus: 'HIT' });
    service.recordRequestMetric({ method: 'GET', path: '/api/search?q=police', statusCode: 200, durationMs: 880, cacheStatus: 'MISS' });
    service.recordRequestMetric({ method: 'GET', path: '/uploads/test.jpg', statusCode: 200, durationMs: 50, cacheStatus: '' });

    const snapshot = service.getRequestMetricsSnapshot();
    expect(snapshot.startedAt).toBeTruthy();
    expect(snapshot.totals.requests).toBe(2);
    expect(snapshot.totals.cacheHits).toBe(1);
    expect(snapshot.totals.cacheMisses).toBe(1);
    expect(snapshot.groups[0].name).toBe('api-search');
    expect(snapshot.groups[0].avgDurationMs).toBe(880);
    expect(snapshot.groups[1].name).toBe('api-homepage');
    expect(snapshot.slowRequests).toHaveLength(1);
    expect(snapshot.slowRequests[0].path).toBe('/api/search');
  });

  it('retains last error details separately from the latest group status', () => {
    const service = createRequestMetricsService();
    service.recordRequestMetric({ method: 'GET', path: '/api/comments?article=42', statusCode: 401, durationMs: 40, cacheStatus: '' });
    service.recordRequestMetric({ method: 'GET', path: '/api/comments?article=42', statusCode: 304, durationMs: 50, cacheStatus: '' });

    const snapshot = service.getRequestMetricsSnapshot();
    const commentsGroup = snapshot.groups.find((group) => group.name === 'api-comments');
    expect(commentsGroup).toBeTruthy();
    expect(commentsGroup.errorCount).toBe(1);
    expect(commentsGroup.lastStatusCode).toBe(304);
    expect(commentsGroup.lastPath).toBe('/api/comments');
    expect(commentsGroup.lastErrorStatusCode).toBe(401);
    expect(commentsGroup.lastErrorPath).toBe('/api/comments');
  });

  it('normalizes grouped admin routes and ignores OPTIONS requests in middleware', () => {
    const service = createRequestMetricsService();
    service.recordRequestMetric({ method: 'GET', path: '/api/admin/diagnostics', statusCode: 200, durationMs: 950, cacheStatus: '' });
    service.recordRequestMetric({ method: 'GET', path: '/api/permissions', statusCode: 401, durationMs: 20, cacheStatus: '' });
    service.recordRequestMetric({ method: 'GET', path: '/api/tips', statusCode: 200, durationMs: 25, cacheStatus: '' });
    service.recordRequestMetric({ method: 'GET', path: '/api/users', statusCode: 200, durationMs: 25, cacheStatus: '' });
    service.recordRequestMetric({ method: 'GET', path: '/api/hero-settings/revisions', statusCode: 200, durationMs: 25, cacheStatus: '' });
    service.recordRequestMetric({ method: 'GET', path: '/api/site-settings/revisions', statusCode: 200, durationMs: 25, cacheStatus: '' });

    const groupingSnapshot = service.getRequestMetricsSnapshot();
    expect(groupingSnapshot.groups.find((group) => group.name === 'api-diagnostics')).toBeTruthy();
    expect(groupingSnapshot.groups.find((group) => group.name === 'api-permissions')).toBeTruthy();
    expect(groupingSnapshot.groups.find((group) => group.name === 'api-tips')).toBeTruthy();
    expect(groupingSnapshot.groups.find((group) => group.name === 'api-users')).toBeTruthy();
    expect(groupingSnapshot.groups.find((group) => group.name === 'api-hero-settings')).toBeTruthy();
    expect(groupingSnapshot.groups.find((group) => group.name === 'api-site-settings')).toBeTruthy();

    const middlewareService = createRequestMetricsService();
    const req = { method: 'GET', originalUrl: '/article/42' };
    const res = new EventEmitter();
    res.statusCode = 200;
    res.getHeader = (name) => (name === 'X-Cache' ? 'MISS' : undefined);
    let nextCalled = false;
    middlewareService.requestMetricsMiddleware(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    res.emit('finish');
    expect(middlewareService.getRequestMetricsSnapshot().groups[0].name).toBe('web-article');

    const optionsService = createRequestMetricsService();
    let optionNextCalled = false;
    optionsService.requestMetricsMiddleware(
      { method: 'OPTIONS', originalUrl: '/api/search' },
      new EventEmitter(),
      () => {
        optionNextCalled = true;
      },
    );
    expect(optionNextCalled).toBe(true);
    expect(optionsService.getRequestMetricsSnapshot().totals.requests).toBe(0);
  });
});
