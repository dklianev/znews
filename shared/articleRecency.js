export function toNumericArticleId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getArticleRecencyTimestamp(article) {
  if (!article || typeof article !== 'object') return 0;

  if (article.publishAt) {
    const publishAtTs = new Date(article.publishAt).getTime();
    if (Number.isFinite(publishAtTs)) return publishAtTs;
  }

  if (article.date) {
    const dateTs = new Date(article.date).getTime();
    if (Number.isFinite(dateTs)) return dateTs;
  }

  return toNumericArticleId(article.id);
}

export function compareArticlesByRecency(left, right) {
  const tsDiff = getArticleRecencyTimestamp(right) - getArticleRecencyTimestamp(left);
  if (tsDiff !== 0) return tsDiff;
  return toNumericArticleId(right?.id) - toNumericArticleId(left?.id);
}

export function sortArticlesByRecency(items) {
  if (!Array.isArray(items) || items.length <= 1) return Array.isArray(items) ? items : [];
  return [...items].sort(compareArticlesByRecency);
}
