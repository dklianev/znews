export function normalizeSearchField(value, maxLen = 180) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, maxLen);
}

export function normalizeSearchList(values, maxItemLen = 64, maxItems = 20) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const normalized = [];
  values.forEach((value) => {
    const next = normalizeSearchField(value, maxItemLen);
    if (!next || seen.has(next)) return;
    seen.add(next);
    normalized.push(next);
  });
  return normalized.slice(0, maxItems);
}

export function deriveArticlePublishAtDate(source) {
  const publishAt = source?.publishAt ? new Date(source.publishAt) : null;
  if (publishAt instanceof Date && Number.isFinite(publishAt.getTime())) {
    return publishAt;
  }

  const rawDate = typeof source?.date === 'string' ? source.date.trim() : '';
  if (!rawDate) return null;

  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? `${rawDate}T00:00:00.000Z` : rawDate;
  const parsed = new Date(isoDateOnly);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function normalizeUsernameLower(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeClassifiedPriceValue(value) {
  const digits = String(value || '').match(/\d+/g);
  if (!Array.isArray(digits) || digits.length === 0) return null;
  const parsed = Number.parseInt(digits.join(''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}
