import {
  AD_PAGE_TYPES,
  AD_STATUS_OPTIONS,
  AD_TYPES,
  getAdSlot,
  getDefaultPlacementsForType,
  isAdTypeAllowedInSlot,
  isKnownAdSlot,
} from './adSlots.js';
import { AD_ROTATION_WINDOW_MS, getAnalyticsWindowKey } from './adAnalytics.js';

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

function normalizeText(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeContext(context) {
  const slotId = normalizeText(context?.slotId ?? context?.slot, 120);
  const slot = getAdSlot(slotId);
  const rawPageType = normalizeText(context?.pageType, 24).toLowerCase();
  const pageType = AD_PAGE_TYPES.includes(rawPageType)
    ? rawPageType
    : (slot?.pageType || '');
  const parsedArticleId = Number.parseInt(context?.articleId, 10);
  const articleId = Number.isInteger(parsedArticleId) ? parsedArticleId : null;
  const categoryId = normalizeText(context?.categoryId, 64).toLowerCase();
  const parsedNow = new Date(context?.now || Date.now());
  const now = Number.isNaN(parsedNow.getTime()) ? new Date() : parsedNow;
  const rotationKey = normalizeText(context?.rotationKey, 240);
  const rotationSeed = normalizeText(context?.rotationSeed, 120);
  const parsedWindowKey = Number.parseInt(context?.rotationWindowKey, 10);
  const rotationWindowKey = Number.isInteger(parsedWindowKey) ? parsedWindowKey : null;

  return {
    slotId,
    slot,
    pageType,
    articleId,
    categoryId,
    now,
    rotationKey,
    rotationSeed,
    rotationWindowKey,
  };
}

function stableHash(value) {
  const input = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getAdSortKey(ad) {
  const parsedId = Number.parseInt(ad?.id, 10);
  if (Number.isInteger(parsedId)) return parsedId;
  return stableHash(String(ad?.id || 'preview'));
}

function getSpecificityScore(targeting, pageType, articleId, categoryId) {
  let score = 0;
  if (targeting.pageTypes.includes(pageType)) score += 50;
  if (Number.isInteger(articleId) && targeting.articleIds.includes(articleId)) score += 500;
  if (categoryId && targeting.categoryIds.includes(categoryId)) score += 200;
  score += Math.min(30, targeting.excludeArticleIds.length + targeting.excludeCategoryIds.length);
  return score;
}

function getCandidateScore(ad, context) {
  return getSpecificityScore(ad.targeting, context.pageType, context.articleId, context.categoryId);
}

function compareEligibleAds(left, right, context) {
  const scoreDiff = getCandidateScore(right, context) - getCandidateScore(left, context);
  if (scoreDiff !== 0) return scoreDiff;

  const priorityDiff = (right.priority || 0) - (left.priority || 0);
  if (priorityDiff !== 0) return priorityDiff;

  const weightDiff = (right.weight || 1) - (left.weight || 1);
  if (weightDiff !== 0) return weightDiff;

  return getAdSortKey(right) - getAdSortKey(left);
}

function comparePoolAds(left, right) {
  return getAdSortKey(left) - getAdSortKey(right);
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

function buildEligibilityState(ads, context) {
  const normalizedContext = normalizeContext(context);
  if (!normalizedContext.slot) {
    return {
      context: normalizedContext,
      eligibleAds: [],
      rotationPool: [],
      rotationKey: '',
      topScore: null,
      topPriority: null,
    };
  }

  const eligibleAds = (Array.isArray(ads) ? ads : [])
    .map(normalizeAdRecord)
    .filter((ad) => isAdPubliclyAvailable(ad, normalizedContext.now))
    .filter((ad) => ad.placements.includes(normalizedContext.slotId))
    .filter((ad) => matchesExclusions(ad.targeting, normalizedContext.articleId, normalizedContext.categoryId))
    .filter((ad) => matchesPositiveTargeting(ad.targeting, normalizedContext.pageType, normalizedContext.articleId, normalizedContext.categoryId))
    .sort((left, right) => compareEligibleAds(left, right, normalizedContext));

  const topCandidate = eligibleAds[0] || null;
  const topScore = topCandidate ? getCandidateScore(topCandidate, normalizedContext) : null;
  const topPriority = topCandidate ? (topCandidate.priority || 0) : null;
  const rotationPool = topCandidate
    ? eligibleAds
      .filter((ad) => getCandidateScore(ad, normalizedContext) === topScore)
      .filter((ad) => (ad.priority || 0) === topPriority)
      .sort(comparePoolAds)
    : [];

  return {
    context: normalizedContext,
    eligibleAds,
    rotationPool,
    rotationKey: buildAdRotationKey(normalizedContext),
    topScore,
    topPriority,
  };
}

function pickWeightedAd(pool, rotationKey) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  const normalizedPool = [...pool].sort(comparePoolAds);
  const totalWeight = normalizedPool.reduce(
    (sum, ad) => sum + Math.max(1, Number(ad?.weight) || 1),
    0
  );
  if (totalWeight <= 0) return normalizedPool[0] || null;

  let cursor = stableHash(rotationKey || 'global') % totalWeight;
  for (const ad of normalizedPool) {
    cursor -= Math.max(1, Number(ad?.weight) || 1);
    if (cursor < 0) return ad;
  }

  return normalizedPool[normalizedPool.length - 1] || null;
}

export function buildAdRotationKey(context) {
  const normalizedContext = normalizeContext(context);
  if (!normalizedContext.slot) return '';
  if (normalizedContext.rotationKey) return normalizedContext.rotationKey;

  const windowKey = Number.isInteger(normalizedContext.rotationWindowKey)
    ? normalizedContext.rotationWindowKey
    : getAnalyticsWindowKey(AD_ROTATION_WINDOW_MS, normalizedContext.now);

  return [
    normalizedContext.slotId,
    normalizedContext.pageType || normalizedContext.slot?.pageType || 'global',
    Number.isInteger(normalizedContext.articleId) ? normalizedContext.articleId : 'na',
    normalizedContext.categoryId || 'na',
    normalizedContext.rotationSeed || 'global',
    windowKey,
  ].join('|');
}

export function normalizeAdImageMeta(value) {
  const source = value && typeof value === 'object' ? value : {};
  const match = String(source.objectPosition || '').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  const positionX = normalizeNumber(match?.[1], 50, { min: 0, max: 100 });
  const positionY = normalizeNumber(match?.[2], 50, { min: 0, max: 100 });

  return {
    objectPosition: `${Math.round(positionX)}% ${Math.round(positionY)}%`,
    objectScale: normalizeNumber(source.objectScale, 1, { min: 1, max: 2.4 }),
  };
}

export function normalizeAdRecord(ad) {
  const normalizedType = normalizeType(ad?.type);
  const normalizedTargeting = normalizeTargeting(ad?.targeting);
  const normalizedPlacements = normalizePlacements(ad?.placements, normalizedType)
    .filter((slotId) => isAdTypeAllowedInSlot(normalizedType, slotId));
  const showButton = ad?.showButton !== false;
  const clickable = ad?.clickable !== false;
  const showTitle = ad?.showTitle !== false;

  return {
    ...(ad || {}),
    id: Number.parseInt(ad?.id, 10) || ad?.id,
    type: normalizedType,
    status: normalizeStatus(ad?.status),
    campaignName: String(ad?.campaignName || '').trim(),
    notes: String(ad?.notes || '').trim(),
    imageMeta: normalizeAdImageMeta(ad?.imageMeta),
    placements: normalizedPlacements,
    targeting: normalizedTargeting,
    showTitle,
    showButton,
    clickable,
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

export function getEligibleAds(ads, context) {
  return buildEligibilityState(ads, context).eligibleAds;
}

export function getAdRotationPool(ads, context) {
  return buildEligibilityState(ads, context).rotationPool;
}

export function explainAdResolution(ads, context) {
  const state = buildEligibilityState(ads, context);
  const resolvedAd = pickWeightedAd(state.rotationPool, state.rotationKey);
  const totalWeight = state.rotationPool.reduce(
    (sum, ad) => sum + Math.max(1, Number(ad?.weight) || 1),
    0
  );

  return {
    context: {
      slot: state.context.slotId,
      pageType: state.context.pageType,
      articleId: state.context.articleId,
      categoryId: state.context.categoryId,
      rotationKey: state.rotationKey,
    },
    eligibleAds: state.eligibleAds,
    rotationPool: state.rotationPool,
    resolvedAd,
    topSpecificityScore: state.topScore,
    topPriority: state.topPriority,
    totalWeight,
  };
}

export function resolveAdForSlot(ads, context) {
  const state = buildEligibilityState(ads, context);
  return pickWeightedAd(state.rotationPool, state.rotationKey);
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
