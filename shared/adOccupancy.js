import { AD_SLOT_DEFINITIONS } from './adSlots.js';
import { normalizeAdRecord } from './adResolver.js';

function toTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isActiveInWindow(ad, nowMs) {
  if (ad.status !== 'active') return false;
  const startMs = toTimestamp(ad.startAt);
  const endMs = toTimestamp(ad.endAt);
  if (startMs !== null && startMs > nowMs) return false;
  if (endMs !== null && endMs < nowMs) return false;
  return true;
}

function isScheduledForFuture(ad, nowMs) {
  if (ad.status !== 'active') return false;
  const startMs = toTimestamp(ad.startAt);
  return startMs !== null && startMs > nowMs;
}

function normalizeList(ads) {
  return (Array.isArray(ads) ? ads : []).map((ad) => normalizeAdRecord(ad));
}

function sortBySchedule(left, right) {
  const leftStart = toTimestamp(left.startAt);
  const rightStart = toTimestamp(right.startAt);
  if (leftStart !== rightStart) {
    if (leftStart === null) return -1;
    if (rightStart === null) return 1;
    return leftStart - rightStart;
  }

  const priorityDiff = (right.priority || 0) - (left.priority || 0);
  if (priorityDiff !== 0) return priorityDiff;

  return String(left.campaignName || left.title || left.id).localeCompare(String(right.campaignName || right.title || right.id), 'bg');
}

function buildTargetingFingerprint(ad) {
  const targeting = ad.targeting || {};
  return JSON.stringify({
    pageTypes: targeting.pageTypes || [],
    articleIds: targeting.articleIds || [],
    categoryIds: targeting.categoryIds || [],
    excludeArticleIds: targeting.excludeArticleIds || [],
    excludeCategoryIds: targeting.excludeCategoryIds || [],
  });
}

export function buildAdSlotOccupancy(ads, { now = new Date() } = {}) {
  const normalizedAds = normalizeList(ads);
  const nowMs = toTimestamp(now) ?? Date.now();

  return AD_SLOT_DEFINITIONS.map((slot) => {
    const slotAds = normalizedAds
      .filter((ad) => Array.isArray(ad.placements) && ad.placements.includes(slot.id))
      .sort(sortBySchedule);

    const currentAds = slotAds.filter((ad) => isActiveInWindow(ad, nowMs));
    const upcomingAds = slotAds.filter((ad) => isScheduledForFuture(ad, nowMs));
    const inactiveAds = slotAds.filter((ad) => !currentAds.includes(ad) && !upcomingAds.includes(ad));
    const warnings = [];

    const targetingGroups = new Map();
    currentAds.forEach((ad) => {
      const key = buildTargetingFingerprint(ad);
      const group = targetingGroups.get(key) || [];
      group.push(ad);
      targetingGroups.set(key, group);
    });

    targetingGroups.forEach((group) => {
      if (group.length < 2) return;

      const uniquePriorities = new Set(group.map((ad) => ad.priority || 0));
      if (uniquePriorities.size > 1) {
        warnings.push({
          type: 'overlap',
          message: `${group.length} активни реклами споделят един и същ targeting на този slot. По-високият priority ще измести по-ниския.`,
        });
      }

      if (uniquePriorities.size === 1) {
        warnings.push({
          type: 'rotation',
          message: `${group.length} активни реклами се въртят за един и същ targeting на този slot при priority ${group[0]?.priority || 0}.`,
        });
      }
    });

    return {
      slot,
      currentAds,
      upcomingAds,
      inactiveAds,
      warnings,
      isOccupied: currentAds.length > 0,
    };
  });
}
