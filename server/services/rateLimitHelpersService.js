export function createRateLimitHelpers({
  createHash,
  getTrustedClientIp,
  ipKeyGenerator,
  isIP,
  isProd = false,
  rateLimitEnabledInDev = false,
}) {
  function getClientIpForRateLimit(req) {
    return getTrustedClientIp(req);
  }

  function rateLimitKeyGenerator(req) {
    const ip = getClientIpForRateLimit(req);
    if (isIP(ip)) return ipKeyGenerator(ip, 56);

    const normalized = String(ip || '').trim();
    if (normalized && normalized !== 'unknown') return normalized;

    const fallbackFingerprint = [
      String(req.headers?.['x-forwarded-for'] || ''),
      String(req.headers?.['x-arr-clientip'] || ''),
      String(req.headers?.['cf-connecting-ip'] || ''),
      String(req.ip || ''),
      String(req.socket?.remoteAddress || ''),
      String(req.headers?.['user-agent'] || ''),
    ].join('|');

    return `fp:${createHash('sha1').update(fallbackFingerprint || 'unknown').digest('hex').slice(0, 32)}`;
  }

  function parseRateLimitPositiveInt(value, fallback, min = 1) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed < min) return fallback;
    return parsed;
  }

  function shouldSkipRateLimit() {
    return !isProd && !rateLimitEnabledInDev;
  }

  function isReadOnlyMethod(method) {
    const normalized = String(method || '').toUpperCase();
    return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
  }

  function getApiPath(req) {
    return String(req.path || '').toLowerCase();
  }

  function isAuthApiPath(req) {
    return getApiPath(req).startsWith('/auth');
  }

  function isMediaApiPath(req) {
    const pathValue = getApiPath(req);
    return pathValue.startsWith('/upload') || pathValue.startsWith('/media');
  }

  function isAdminApiPath(req) {
    const pathValue = getApiPath(req);
    return pathValue.startsWith('/users')
      || pathValue.startsWith('/permissions')
      || pathValue.startsWith('/audit-log')
      || pathValue.startsWith('/tips')
      || pathValue.startsWith('/hero-settings/revisions')
      || pathValue.startsWith('/site-settings/revisions')
      || pathValue.startsWith('/site-settings/cache/homepage/refresh');
  }

  return {
    getApiPath,
    getClientIpForRateLimit,
    isAdminApiPath,
    isAuthApiPath,
    isMediaApiPath,
    isReadOnlyMethod,
    parseRateLimitPositiveInt,
    rateLimitKeyGenerator,
    shouldSkipRateLimit,
  };
}
