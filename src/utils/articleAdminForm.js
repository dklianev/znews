function toFormString(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  }
  return toFormString(value);
}

function normalizeRelatedArticles(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isInteger(item));
}

export function trimArticleAdminText(value) {
  return String(value ?? '').trim();
}

export function normalizeArticleAdminForm(source = {}, fallback = {}) {
  const merged = {
    ...fallback,
    ...(source && typeof source === 'object' ? source : {}),
  };

  const normalizedStatus = toFormString(merged.status) || fallback.status || 'draft';
  const shareAccent = toFormString(merged.shareAccent) || fallback.shareAccent || 'auto';

  return {
    ...merged,
    title: toFormString(merged.title),
    slug: toFormString(merged.slug),
    excerpt: toFormString(merged.excerpt),
    content: toFormString(merged.content) || '<p></p>',
    category: trimArticleAdminText(merged.category) || fallback.category || 'crime',
    authorId: toPositiveNumber(merged.authorId, fallback.authorId || 1),
    date: toFormString(merged.date) || fallback.date || '',
    readTime: toPositiveNumber(merged.readTime, fallback.readTime || 1),
    views: toNonNegativeNumber(merged.views, fallback.views || 0),
    image: toFormString(merged.image),
    youtubeUrl: toFormString(merged.youtubeUrl),
    featured: Boolean(merged.featured),
    breaking: Boolean(merged.breaking),
    sponsored: Boolean(merged.sponsored),
    hero: Boolean(merged.hero),
    tags: normalizeTags(merged.tags),
    relatedArticles: normalizeRelatedArticles(merged.relatedArticles),
    status: ['published', 'draft', 'archived'].includes(normalizedStatus)
      ? normalizedStatus
      : (fallback.status || 'draft'),
    publishAt: toFormString(merged.publishAt),
    cardSticker: toFormString(merged.cardSticker),
    shareTitle: toFormString(merged.shareTitle),
    shareSubtitle: toFormString(merged.shareSubtitle),
    shareBadge: toFormString(merged.shareBadge),
    shareAccent,
    shareImage: toFormString(merged.shareImage),
    imageMeta: merged.imageMeta ?? null,
  };
}
