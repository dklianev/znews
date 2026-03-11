export function createRateLimitHelpers({
  createHash,
  getTrustedClientIp,
  ipKeyGenerator,
  isIP,
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

  return {
    getClientIpForRateLimit,
    parseRateLimitPositiveInt,
    rateLimitKeyGenerator,
  };
}
