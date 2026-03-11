import assert from 'node:assert/strict';
import NodeCache from 'node-cache';
import { createCacheService } from '../server/services/cacheService.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

export async function runCacheServiceTests() {
  const apiCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
  const service = createCacheService({
    apiCache,
    apiCacheInvalidationLog: [],
    apiCacheMeta: new Map(),
    apiCacheTagPatterns: { homepage: ['/api/homepage'], articles: ['/api/articles'] },
    cacheInvalidationLogLimit: 10,
    cacheTagGroups: { homepage: ['homepage'] },
    log: () => {},
  });

  const req = { method: 'GET', originalUrl: '/api/homepage' , headers: {} };
  const res1 = createResponse();
  await new Promise((resolve) => service.cacheMiddleware(req, res1, resolve));
  assert.equal(res1.getHeader('X-Cache'), 'MISS');
  res1.json({ ok: true });

  const statsAfterMiss = service.getApiCacheStats();
  assert.equal(statsAfterMiss.performance.misses, 1);
  assert.equal(statsAfterMiss.performance.writes, 1);
  assert.equal(statsAfterMiss.performance.hits, 0);
  assert.equal(statsAfterMiss.performance.missesByTag.homepage, 1);

  const res2 = createResponse();
  service.cacheMiddleware(req, res2, () => {});
  assert.equal(res2.getHeader('X-Cache'), 'HIT');
  assert.deepEqual(res2.body, { ok: true });

  const statsAfterHit = service.getApiCacheStats();
  assert.equal(statsAfterHit.performance.hits, 1);
  assert.equal(statsAfterHit.performance.hitRate, 0.5);
  assert.equal(statsAfterHit.performance.hitsByTag.homepage, 1);
}
