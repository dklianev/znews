function normalizePathname(rawUrl) {
  return String(rawUrl || '').split('?')[0].split('#')[0] || '/';
}

function shouldTrackRequest(pathname) {
  if (!pathname || pathname === '/favicon.ico' || pathname === '/manifest.webmanifest') return false;
  if (pathname.startsWith('/assets/')) return false;
  if (pathname.startsWith('/uploads/')) return false;
  if (pathname === '/sw.js' || pathname.startsWith('/workbox-')) return false;
  return pathname === '/' || pathname.startsWith('/api/') || pathname.startsWith('/article/') || pathname.startsWith('/games') || pathname.startsWith('/gallery') || pathname.startsWith('/jobs') || pathname.startsWith('/court') || pathname.startsWith('/events') || pathname.startsWith('/category/') || pathname.startsWith('/search') || pathname.startsWith('/tipline') || pathname.startsWith('/about') || pathname.startsWith('/admin');
}

function classifyRequestGroup(pathname) {
  if (pathname === '/') return 'web-home';
  if (pathname === '/api/homepage') return 'api-homepage';
  if (pathname === '/api/bootstrap') return 'api-bootstrap';
  if (pathname.startsWith('/api/search')) return 'api-search';
  if (pathname.startsWith('/api/articles')) return 'api-articles';
  if (pathname.startsWith('/api/ads')) return 'api-ads';
  if (pathname.startsWith('/api/games')) return 'api-games';
  if (pathname.startsWith('/api/auth')) return 'api-auth';
  if (pathname.startsWith('/api/media') || pathname.startsWith('/api/upload')) return 'api-media';
  if (pathname.startsWith('/api/admin/')) return 'api-admin';
  if (pathname.startsWith('/api/')) return 'api-other';
  if (pathname.startsWith('/article/')) return 'web-article';
  if (pathname.startsWith('/games')) return 'web-games';
  if (pathname.startsWith('/gallery')) return 'web-gallery';
  if (pathname.startsWith('/jobs')) return 'web-jobs';
  if (pathname.startsWith('/court')) return 'web-court';
  if (pathname.startsWith('/events')) return 'web-events';
  if (pathname.startsWith('/category/')) return 'web-category';
  if (pathname.startsWith('/search')) return 'web-search';
  if (pathname.startsWith('/tipline')) return 'web-tipline';
  if (pathname.startsWith('/admin')) return 'web-admin';
  return 'web-other';
}

function roundDuration(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric);
}

export function createRequestMetricsService({
  slowRequestThresholdMs = 900,
  maxRecentEntries = 60,
  maxSlowEntries = 30,
} = {}) {
  const groups = new Map();
  const recentRequests = [];
  const slowRequests = [];
  const totals = {
    requests: 0,
    errors: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  function recordRequestMetric({ method = 'GET', path = '/', statusCode = 200, durationMs = 0, cacheStatus = '', at = new Date().toISOString() } = {}) {
    const pathname = normalizePathname(path);
    if (!shouldTrackRequest(pathname)) return null;

    const duration = roundDuration(durationMs);
    const cache = String(cacheStatus || '').toUpperCase();
    const groupName = classifyRequestGroup(pathname);
    const group = groups.get(groupName) || {
      name: groupName,
      count: 0,
      errorCount: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      maxDurationMs: 0,
      minDurationMs: null,
      lastDurationMs: 0,
      lastStatusCode: 0,
      lastPath: pathname,
      lastAt: at,
      cacheHits: 0,
      cacheMisses: 0,
    };

    group.count += 1;
    group.totalDurationMs += duration;
    group.avgDurationMs = Math.round(group.totalDurationMs / group.count);
    group.maxDurationMs = Math.max(group.maxDurationMs, duration);
    group.minDurationMs = group.minDurationMs === null ? duration : Math.min(group.minDurationMs, duration);
    group.lastDurationMs = duration;
    group.lastStatusCode = Number(statusCode) || 0;
    group.lastPath = pathname;
    group.lastAt = at;
    if (Number(statusCode) >= 400) group.errorCount += 1;
    if (cache === 'HIT') group.cacheHits += 1;
    if (cache === 'MISS') group.cacheMisses += 1;
    groups.set(groupName, group);

    totals.requests += 1;
    if (Number(statusCode) >= 400) totals.errors += 1;
    if (cache === 'HIT') totals.cacheHits += 1;
    if (cache === 'MISS') totals.cacheMisses += 1;

    const entry = {
      at,
      method: String(method || 'GET').toUpperCase(),
      path: pathname,
      group: groupName,
      statusCode: Number(statusCode) || 0,
      durationMs: duration,
      cacheStatus: cache || 'SKIP',
    };

    recentRequests.unshift(entry);
    if (recentRequests.length > maxRecentEntries) recentRequests.length = maxRecentEntries;

    if (duration >= slowRequestThresholdMs) {
      slowRequests.unshift(entry);
      if (slowRequests.length > maxSlowEntries) slowRequests.length = maxSlowEntries;
    }

    return entry;
  }

  function requestMetricsMiddleware(req, res, next) {
    if (String(req.method || '').toUpperCase() === 'OPTIONS') {
      return next();
    }
    const startedAt = process.hrtime.bigint();
    const finish = () => {
      res.removeListener('finish', finish);
      res.removeListener('close', finish);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      recordRequestMetric({
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs,
        cacheStatus: typeof res.getHeader === 'function' ? res.getHeader('X-Cache') : '',
      });
    };
    res.on('finish', finish);
    res.on('close', finish);
    next();
  }

  function getRequestMetricsSnapshot() {
    const groupRows = [...groups.values()]
      .map((group) => ({
        ...group,
        errorRate: group.count > 0 ? Number((group.errorCount / group.count).toFixed(3)) : 0,
      }))
      .sort((left, right) => right.avgDurationMs - left.avgDurationMs);

    const cacheTrackedRequests = totals.cacheHits + totals.cacheMisses;
    return {
      totals: {
        ...totals,
        hitRate: cacheTrackedRequests > 0 ? Number((totals.cacheHits / cacheTrackedRequests).toFixed(3)) : null,
      },
      slowRequestThresholdMs,
      groups: groupRows,
      recentRequests: recentRequests.slice(0, maxRecentEntries),
      slowRequests: slowRequests.slice(0, maxSlowEntries),
    };
  }

  return {
    classifyRequestGroup,
    getRequestMetricsSnapshot,
    normalizePathname,
    recordRequestMetric,
    requestMetricsMiddleware,
    shouldTrackRequest,
  };
}
