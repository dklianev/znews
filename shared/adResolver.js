import {
  AD_PAGE_TYPES,
  AD_STATUS_OPTIONS,
  AD_TYPES,
  getAdSlot,
  getDefaultPlacementsForType,
  isAdTypeAllowedInSlot,
  isKnownAdSlot,
} from './adSlots.js';

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))];
}

function uniqueLowercaseStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean))];
}

function uniqueIntegers(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0))];
}

function normalizePageTypes(values) {
  return uniqueLowercaseStrings(values)
    .filter((value) => AD_PAGE_TYPES.includes(value));
}

function normalizeTargeting(targeting) {
  const source = targeting && typeof targeting === 'object' ? targeting : {};
  return {
    pageTypes: normalizePageTypes(source.pageTypes),
    articleIds: uniqueIntegers(source.articleIds),
    categoryIds: uniqueLowercaseStrings(source.categoryIds),
    excludeArticleIds: uniqueIntegers(source.excludeArticleIds),
    excludeCategoryIds: uniqueLowercaseStrings(source.excludeCategoryIds),
  };
}

function normalizePlacements(placements, type) {
  const normalized = uniqueStrings(placements).filter(isKnownAdSlot);
  if (normalized.length > 0) return normalized;
  return getDefaultPlacementsForType(type);
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (AD_STATUS_OPTIONS.includes(normalized)) return normalized;
  return 'active';
}

function normalizeType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  if (AD_TYPES.includes(normalized)) return normalized;
  return 'horizontal';
}

function normalizeNumber(value, fallback, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeAdRecord(ad) {
  const normalizedType = normalizeType(ad?.type);
  const normalizedTargeting = normalizeTargeting(ad?.targeting);
  const normalizedPlacements = normalizePlacements(ad?.placements, normalizedType)
    .filter((slotId) => isAdTypeAllowedInSlot(normalizedType, slotId));

  return {
    ...(ad || {}),
    id: Number.parseInt(ad?.id, 10) || ad?.id,
    type: normalizedType,
    status: normalizeStatus(ad?.status),
    campaignName: String(ad?.campaignName || '').trim(),
    notes: String(ad?.notes || '').trim(),
    placements: normalizedPlacements,
    targeting: normalizedTargeting,
    priority: normalizeNumber(ad?.priority, 0, { min: -1000, max: 1000 }),
    weight: normalizeNumber(ad?.weight, 1, { min: 1, max: 100 }),
    startAt: normalizeDate(ad?.startAt),
    endAt: normalizeDate(ad?.endAt),
  };
}

export function isAdPubliclyAvailable(ad, now = new Date()) {
  const normalized = normalizeAdRecord(ad);
  if (normalized.status !== 'active') return false;
  if (normalized.placements.length === 0) return false;

  const nowMs = new Date(now).getTime();
  const startMs = normalized.startAt ? new Date(normalized.startAt).getTime() : null;
  const endMs = normalized.endAt ? new Date(normalized.endAt).getTime() : null;

  if (Number.isFinite(startMs) && nowMs < startMs) return false;
  if (Number.isFinite(endMs) && nowMs > endMs) return false;
  return true;
}

function matchesExclusions(targeting, articleId, categoryId) {
  if (Number.isInteger(articleId) && targeting.excludeArticleIds.includes(articleId)) return false;
  if (categoryId && targeting.excludeCategoryIds.includes(categoryId)) return false;
  return true;
}

function matchesPositiveTargeting(targeting, pageType, articleId, categoryId) {
  if (targeting.pageTypes.length > 0 && !targeting.pageTypes.includes(pageType)) return false;
  if (targeting.articleIds.length > 0 && !targeting.articleIds.includes(articleId)) return false;
  if (targeting.categoryIds.length > 0 && !targeting.categoryIds.includes(categoryId)) return false;
  return true;
}

function getSpecificityScore(targeting, pageType, articleId, categoryId) {
  let score = 0;
  if (targeting.pageTypes.includes(pageType)) score += 50;
  if (Number.isInteger(articleId) && targeting.articleIds.includes(articleId)) score += 500;
  if (categoryId && targeting.categoryIds.includes(categoryId)) score += 200;
  score += Math.min(30, targeting.excludeArticleIds.length + targeting.excludeCategoryIds.length);
  return score;
}

export function getEligibleAds(ads, context) {
  const slotId = String(context?.slot || '').trim();
  const slot = getAdSlot(slotId);
  if (!slot) return [];

  const pageType = String(context?.pageType || slot.pageType || '').trim().toLowerCase();
  const parsedArticleId = Number.parseInt(context?.articleId, 10);
  const articleId = Number.isInteger(parsedArticleId) ? parsedArticleId : null;
  const categoryId = String(context?.categoryId || '').trim().toLowerCase();
  const now = context?.now || new Date();

  return (Array.isArray(ads) ? ads : [])
    .map(normalizeAdRecord)
    .filter((ad) => isAdPubliclyAvailable(ad, now))
    .filter((ad) => ad.placements.includes(slotId))
    .filter((ad) => matchesExclusions(ad.targeting, articleId, categoryId))
    .filter((ad) => matchesPositiveTargeting(ad.targeting, pageType, articleId, categoryId))
    .sort((left, right) => {
      const scoreDiff = getSpecificityScore(right.targeting, pageType, articleId, categoryId)
        - getSpecificityScore(left.targeting, pageType, articleId, categoryId);
      if (scoreDiff !== 0) return scoreDiff;

      const priorityDiff = (right.priority || 0) - (left.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;

      const weightDiff = (right.weight || 1) - (left.weight || 1);
      if (weightDiff !== 0) return weightDiff;

      return (Number(right.id) || 0) - (Number(left.id) || 0);
    });
}

export function resolveAdForSlot(ads, context) {
  return getEligibleAds(ads, context)[0] || null;
}

export function resolveAdsForSlots(ads, requests) {
  return (Array.isArray(requests) ? requests : []).map((request) => ({
    slot: request?.slot || '',
    ad: resolveAdForSlot(ads, request),
  }));
}

export function filterPublicAds(ads, now = new Date()) {
  return (Array.isArray(ads) ? ads : [])
    .map(normalizeAdRecord)
    .filter((ad) => isAdPubliclyAvailable(ad, now));
}
