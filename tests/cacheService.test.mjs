import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import NodeCache from 'node-cache';
import { createCacheService } from '../server/services/cacheService.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    locals: {},
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

describe('cacheService', () => {
  it('covers legacy scenarios', async () => {
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
    
      const detailReq = { method: 'GET', originalUrl: '/api/articles/7', headers: {} };
      const detailRes1 = createResponse();
      await new Promise((resolve) => service.cacheMiddleware(detailReq, detailRes1, resolve));
      assert.equal(detailRes1.getHeader('X-Cache'), 'MISS');
      detailRes1.setCacheTags(['articles', 'article-detail']);
      detailRes1.json({ id: 7 });
    
      const detailRes2 = createResponse();
      service.cacheMiddleware(detailReq, detailRes2, () => {});
      assert.equal(detailRes2.getHeader('X-Cache'), 'HIT');
      assert.deepEqual(detailRes2.body, { id: 7 });
    
      const statsAfterDetailHit = service.getApiCacheStats();
      assert.equal(statsAfterDetailHit.performance.hitsByTag['article-detail'], 1);
      assert.equal(statsAfterDetailHit.countsByTag['article-detail'], 1);
    
      const invalidated = service.invalidateCacheTags(['article-detail'], { reason: 'reaction-test' });
      assert.equal(invalidated, 1);
      assert.equal(apiCache.keys().length, 1);
      assert.deepEqual(service.getApiCacheStats().recentInvalidations[0].tags, ['article-detail']);
    
      const authReq = {
        method: 'GET',
        originalUrl: '/api/articles/7',
        headers: { authorization: 'Bearer token' },
      };
      const authRes = createResponse();
      let authNextCalled = false;
      service.cacheMiddleware(authReq, authRes, () => {
        authNextCalled = true;
      });
      assert.equal(authNextCalled, true);
      assert.equal(typeof authRes.setCacheTags, 'function');
      authRes.setCacheTags(['articles', 'article-detail']);
      assert.deepEqual(authRes.locals.apiCacheTags, ['articles', 'article-detail']);
  });
});
