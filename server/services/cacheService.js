export function createCacheService(deps) {
  const {
    apiCache,
    apiCacheInvalidationLog,
    apiCacheMeta,
    apiCacheTagPatterns,
    cacheInvalidationLogLimit,
    cacheTagGroups,
    log = () => {},
  } = deps;

  const cachePerformance = {
    hits: 0,
    misses: 0,
    writes: 0,
    hitsByTag: {},
    missesByTag: {},
  };

  function normalizeCacheUrl(rawUrl) {
    return String(rawUrl || '').split('#')[0].trim();
  }

  function getCacheTagsForUrl(rawUrl) {
    const normalized = normalizeCacheUrl(rawUrl);
    const pathname = normalized.split('?')[0] || normalized;
    const tags = new Set();

    Object.entries(apiCacheTagPatterns).forEach(([tag, patterns]) => {
      if (patterns.some((pattern) => pathname.startsWith(pattern))) tags.add(tag);
    });

    if (pathname === '/api/homepage') {
      ['articles', 'ads', 'breaking', 'categories', 'games', 'hero', 'polls', 'site-settings', 'wanted'].forEach((tag) => tags.add(tag));
    }
    if (pathname === '/api/bootstrap') {
      ['articles', 'ads', 'breaking', 'categories', 'games', 'hero', 'jobs', 'court', 'events', 'gallery', 'polls', 'site-settings', 'wanted'].forEach((tag) => tags.add(tag));
    }
    if (pathname.startsWith('/api/articles')) tags.add('articles');
    if (pathname.startsWith('/api/search')) tags.add('search');

    return [...tags];
  }

  function countCacheEvent(tags, bucket) {
    const safeBucket = bucket === 'hits' ? 'hitsByTag' : 'missesByTag';
    const uniqueTags = [...new Set((Array.isArray(tags) ? tags : []).filter(Boolean))];
    uniqueTags.forEach((tag) => {
      cachePerformance[safeBucket][tag] = (cachePerformance[safeBucket][tag] || 0) + 1;
    });
  }

  function deleteTrackedCacheMeta(keyOrKeys) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    keys.filter(Boolean).forEach((key) => apiCacheMeta.delete(key));
  }

  function rememberApiCacheEntry(key, url) {
    apiCacheMeta.set(key, {
      key,
      url,
      tags: getCacheTagsForUrl(url),
      cachedAt: new Date().toISOString(),
    });
  }

  function appendCacheInvalidationLog(entry) {
    apiCacheInvalidationLog.unshift(entry);
    if (apiCacheInvalidationLog.length > cacheInvalidationLogLimit) {
      apiCacheInvalidationLog.length = cacheInvalidationLogLimit;
    }
  }

  function removeApiCacheKeys(keys, { reason = '', tags = [] } = {}) {
    const uniqueKeys = [...new Set((Array.isArray(keys) ? keys : []).filter(Boolean))];
    if (uniqueKeys.length === 0) return 0;
    apiCache.del(uniqueKeys);
    deleteTrackedCacheMeta(uniqueKeys);
    appendCacheInvalidationLog({
      reason: reason || 'manual',
      tags: [...new Set(tags.filter(Boolean))],
      keyCount: uniqueKeys.length,
      at: new Date().toISOString(),
    });
    return uniqueKeys.length;
  }

  function getApiCacheStats() {
    const countsByTag = {};
    for (const meta of apiCacheMeta.values()) {
      const tags = Array.isArray(meta?.tags) ? meta.tags : [];
      tags.forEach((tag) => {
        countsByTag[tag] = (countsByTag[tag] || 0) + 1;
      });
    }

    const trackedRequests = cachePerformance.hits + cachePerformance.misses;

    return {
      ttlSeconds: apiCache.options.stdTTL,
      keyCount: apiCache.keys().length,
      trackedKeyCount: apiCacheMeta.size,
      countsByTag,
      recentInvalidations: apiCacheInvalidationLog.slice(0, 12),
      performance: {
        hits: cachePerformance.hits,
        misses: cachePerformance.misses,
        writes: cachePerformance.writes,
        hitRate: trackedRequests > 0 ? Number((cachePerformance.hits / trackedRequests).toFixed(3)) : null,
        hitsByTag: { ...cachePerformance.hitsByTag },
        missesByTag: { ...cachePerformance.missesByTag },
      },
    };
  }

  function cacheMiddleware(req, res, next) {
    if (req.method !== 'GET') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return next();
    }

    const url = req.originalUrl || req.url;
    const key = `api_cache_${url}`;
    const cachedBody = apiCache.get(key);

    const tags = getCacheTagsForUrl(url);

    if (cachedBody) {
      cachePerformance.hits += 1;
      countCacheEvent(tags, 'hits');
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cachedBody));
    }

    cachePerformance.misses += 1;
    countCacheEvent(tags, 'misses');
    res.setHeader('X-Cache', 'MISS');
    const originalSend = res.json;
    res.json = function cacheResponse(body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        apiCache.set(key, JSON.stringify(body));
        cachePerformance.writes += 1;
        rememberApiCacheEntry(key, url);
      }
      return originalSend.call(this, body);
    };
    next();
  }

  function clearApiCacheKeys(pattern) {
    const keys = apiCache.keys();
    const keysToDelete = keys.filter((key) => key.includes(pattern));
    const cleared = removeApiCacheKeys(keysToDelete, { reason: `pattern:${pattern}` });
    if (cleared > 0) {
      log(`Cache cleared for pattern: ${pattern} (${cleared} keys)`);
    }
    return cleared;
  }

  function invalidateCacheTags(tags, { reason = '' } = {}) {
    const requestedTags = [...new Set((Array.isArray(tags) ? tags : [tags]).filter(Boolean))];
    if (requestedTags.length === 0) return 0;

    const keys = apiCache.keys();
    const keysToDelete = keys.filter((key) => {
      const meta = apiCacheMeta.get(key);
      if (meta?.tags?.some((tag) => requestedTags.includes(tag))) return true;
      return requestedTags.some((tag) => {
        const patterns = apiCacheTagPatterns[tag] || [];
        return patterns.some((pattern) => key.includes(pattern));
      });
    });

    const cleared = removeApiCacheKeys(keysToDelete, { reason: reason || 'tag-invalidation', tags: requestedTags });
    if (cleared > 0) {
      log(`Cache cleared for tags: ${requestedTags.join(', ')} (${cleared} keys)`);
    }
    return cleared;
  }

  function invalidateCacheGroup(group, reason = '') {
    return invalidateCacheTags(cacheTagGroups[group] || [], { reason: reason || `group:${group}` });
  }

  apiCache.on('expired', (key) => {
    deleteTrackedCacheMeta(key);
  });

  apiCache.on('del', (key) => {
    deleteTrackedCacheMeta(key);
  });

  return {
    cacheMiddleware,
    clearApiCacheKeys,
    getApiCacheStats,
    invalidateCacheGroup,
    invalidateCacheTags,
  };
}
