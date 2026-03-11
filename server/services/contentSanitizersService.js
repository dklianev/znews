export function createContentSanitizers() {
  function normalizeText(value, maxLen = 255) {
    return String(value ?? '').trim().slice(0, maxLen);
  }

  function sanitizeDate(value) {
    const date = normalizeText(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  }

  function sanitizeDateTime(value) {
    if (value === null || value === undefined || value === '') return null;
    const raw = normalizeText(String(value), 40);
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function sanitizeMediaUrl(value) {
    const url = normalizeText(value, 2048);
    if (!url) return '';
    if (url.startsWith('/')) return url;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch { }
    return '';
  }

  function sanitizeExternalUrl(value) {
    const url = normalizeText(value, 2048);
    if (!url) return '#';
    if (url === '#') return '#';
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch { }
    return '#';
  }

  function sanitizeImageWidth(value) {
    const normalized = normalizeText(String(value || ''), 8).replace('%', '');
    return ['25', '50', '75', '100'].includes(normalized) ? normalized : '100';
  }

  function sanitizeImageAlign(value) {
    const normalized = normalizeText(String(value || ''), 16).toLowerCase();
    return ['left', 'center', 'right'].includes(normalized) ? normalized : 'center';
  }

  function sanitizeTags(value) {
    const rawTags = Array.isArray(value)
      ? value
      : String(value || '').split(',');
    return rawTags
      .map((tag) => normalizeText(String(tag), 32))
      .filter(Boolean)
      .slice(0, 12);
  }

  return {
    normalizeText,
    sanitizeDate,
    sanitizeDateTime,
    sanitizeExternalUrl,
    sanitizeImageAlign,
    sanitizeImageWidth,
    sanitizeMediaUrl,
    sanitizeTags,
  };
}
