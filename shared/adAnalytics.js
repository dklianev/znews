export const AD_EVENT_TYPES = Object.freeze(['impression', 'click']);
export const AD_IMPRESSION_WINDOW_MS = 15 * 60 * 1000;
export const AD_ANALYTICS_RETENTION_DAYS = 180;
export const DEFAULT_AD_ANALYTICS_DAYS = 30;

export function getAnalyticsWindowKey(windowMs = AD_IMPRESSION_WINDOW_MS, now = Date.now()) {
  const normalizedWindowMs = Math.max(60 * 1000, Number(windowMs) || AD_IMPRESSION_WINDOW_MS);
  const timestamp = typeof now === 'number' ? now : new Date(now).getTime();
  const safeNow = Number.isFinite(timestamp) ? timestamp : Date.now();
  return Math.floor(safeNow / normalizedWindowMs);
}

export function buildAdImpressionStorageKey({ adId, slot, pageType, articleId = null, categoryId = '' }, windowKey) {
  const normalizedAdId = Number.parseInt(adId, 10) || 0;
  const parsedArticleId = Number.parseInt(articleId, 10);
  const normalizedArticleId = Number.isInteger(parsedArticleId) && parsedArticleId > 0 ? parsedArticleId : 'na';
  const normalizedCategoryId = String(categoryId || '').trim().toLowerCase() || 'na';
  const normalizedSlot = String(slot || '').trim();
  const normalizedPageType = String(pageType || '').trim().toLowerCase();
  return `zn_ad_imp_${normalizedAdId}_${normalizedSlot}_${normalizedPageType}_${normalizedArticleId}_${normalizedCategoryId}_${windowKey}`;
}
