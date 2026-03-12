import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequestMetricsService } from '../server/services/requestMetricsService.js';

export async function runRequestMetricsServiceTests() {
  const service = createRequestMetricsService({ slowRequestThresholdMs: 500, maxRecentEntries: 3, maxSlowEntries: 2 });

  service.recordRequestMetric({ method: 'GET', path: '/api/homepage?compact=1', statusCode: 200, durationMs: 120, cacheStatus: 'HIT' });
  service.recordRequestMetric({ method: 'GET', path: '/api/search?q=police', statusCode: 200, durationMs: 880, cacheStatus: 'MISS' });
  service.recordRequestMetric({ method: 'GET', path: '/uploads/test.jpg', statusCode: 200, durationMs: 50, cacheStatus: '' });

  const snapshot = service.getRequestMetricsSnapshot();
  assert.ok(snapshot.startedAt);
  assert.equal(snapshot.totals.requests, 2);
  assert.equal(snapshot.totals.cacheHits, 1);
  assert.equal(snapshot.totals.cacheMisses, 1);
  assert.equal(snapshot.groups[0].name, 'api-search');
  assert.equal(snapshot.groups[0].avgDurationMs, 880);
  assert.equal(snapshot.groups[1].name, 'api-homepage');
  assert.equal(snapshot.slowRequests.length, 1);
  assert.equal(snapshot.slowRequests[0].path, '/api/search');

  const service2 = createRequestMetricsService();
  const req = { method: 'GET', originalUrl: '/article/42' };
  const res = new EventEmitter();
  res.statusCode = 200;
  res.getHeader = (name) => name === 'X-Cache' ? 'MISS' : undefined;
  let nextCalled = false;
  service2.requestMetricsMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  res.emit('finish');
  const snapshot2 = service2.getRequestMetricsSnapshot();
  assert.equal(snapshot2.totals.requests, 1);
  assert.equal(snapshot2.groups[0].name, 'web-article');

  const service3 = createRequestMetricsService();
  let optionNextCalled = false;
  service3.requestMetricsMiddleware({ method: 'OPTIONS', originalUrl: '/api/search' }, new EventEmitter(), () => { optionNextCalled = true; });
  assert.equal(optionNextCalled, true);
  assert.equal(service3.getRequestMetricsSnapshot().totals.requests, 0);
}
