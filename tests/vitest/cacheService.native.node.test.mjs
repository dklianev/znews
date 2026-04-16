import NodeCache from 'node-cache';
import { describe, expect, it } from 'vitest';

import { createCacheService } from '../../server/services/cacheService.js';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    locals: {},
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
    end() {
      this.ended = true;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('cache service', () => {
  it('tracks cache misses, hits, tagged invalidation, and auth bypass helpers', async () => {
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

    const req = { method: 'GET', originalUrl: '/api/homepage', headers: {} };
    const res1 = createResponse();
    await new Promise((resolve) => service.cacheMiddleware(req, res1, resolve));
    expect(res1.getHeader('X-Cache')).toBe('MISS');
    res1.json({ ok: true });
    expect(typeof res1.getHeader('ETag')).toBe('string');

    const statsAfterMiss = service.getApiCacheStats();
    expect(statsAfterMiss.performance.misses).toBe(1);
    expect(statsAfterMiss.performance.writes).toBe(1);
    expect(statsAfterMiss.performance.hits).toBe(0);
    expect(statsAfterMiss.performance.missesByTag.homepage).toBe(1);

    const res2 = createResponse();
    service.cacheMiddleware(req, res2, () => {});
    expect(res2.getHeader('X-Cache')).toBe('HIT');
    expect(res2.body).toEqual({ ok: true });
    expect(res2.getHeader('ETag')).toBe(res1.getHeader('ETag'));

    const statsAfterHit = service.getApiCacheStats();
    expect(statsAfterHit.performance.hits).toBe(1);
    expect(statsAfterHit.performance.hitRate).toBe(0.5);
    expect(statsAfterHit.performance.hitsByTag.homepage).toBe(1);

    const res3 = createResponse();
    service.cacheMiddleware({
      method: 'GET',
      originalUrl: '/api/homepage',
      headers: { 'if-none-match': res1.getHeader('ETag') },
    }, res3, () => {});
    expect(res3.getHeader('X-Cache')).toBe('HIT');
    expect(res3.statusCode).toBe(304);
    expect(res3.ended).toBe(true);
    expect(res3.body).toBeUndefined();

    const detailReq = { method: 'GET', originalUrl: '/api/articles/7', headers: {} };
    const detailRes1 = createResponse();
    await new Promise((resolve) => service.cacheMiddleware(detailReq, detailRes1, resolve));
    expect(detailRes1.getHeader('X-Cache')).toBe('MISS');
    detailRes1.setCacheTags(['articles', 'article-detail']);
    detailRes1.json({ id: 7 });

    const detailRes2 = createResponse();
    service.cacheMiddleware(detailReq, detailRes2, () => {});
    expect(detailRes2.getHeader('X-Cache')).toBe('HIT');
    expect(detailRes2.body).toEqual({ id: 7 });

    const statsAfterDetailHit = service.getApiCacheStats();
    expect(statsAfterDetailHit.performance.hitsByTag['article-detail']).toBe(1);
    expect(statsAfterDetailHit.countsByTag['article-detail']).toBe(1);

    const invalidated = service.invalidateCacheTags(['article-detail'], { reason: 'reaction-test' });
    expect(invalidated).toBe(1);
    expect(apiCache.keys()).toHaveLength(1);
    expect(service.getApiCacheStats().recentInvalidations[0].tags).toEqual(['article-detail']);

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
    expect(authNextCalled).toBe(true);
    expect(typeof authRes.setCacheTags).toBe('function');
    authRes.setCacheTags(['articles', 'article-detail']);
    expect(authRes.locals.apiCacheTags).toEqual(['articles', 'article-detail']);
  });
});
