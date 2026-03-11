export function createCoreHelpers({ isProd }) {
  function publicError(error, fallback = 'Server error') {
    return isProd ? fallback : (error?.message || fallback);
  }

  function parseDurationToMs(value, fallbackMs) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!raw) return fallbackMs;
    if (/^\d+$/.test(raw)) {
      const numeric = Number.parseInt(raw, 10);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : fallbackMs;
    }
    const match = raw.match(/^(\d+)\s*(ms|s|m|h|d)$/);
    if (!match) return fallbackMs;
    const amount = Number.parseInt(match[1], 10);
    if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;
    const unit = match[2];
    const map = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * (map[unit] || 1);
  }

  function getPublishedFilter(now = new Date()) {
    return {
      $and: [
        { $or: [{ status: 'published' }, { status: { $exists: false } }] },
        { $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }] },
      ],
    };
  }

  function parsePositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function escapeRegexForSearch(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return {
    escapeRegexForSearch,
    getPublishedFilter,
    parseDurationToMs,
    parsePositiveInt,
    publicError,
  };
}
