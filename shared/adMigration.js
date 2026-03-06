import { AD_STATUS_OPTIONS } from './adSlots.js';
import { normalizeAdRecord } from './adResolver.js';

function arraysEqual(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function normalizeTargetingShape(targeting) {
  const source = targeting && typeof targeting === 'object' ? targeting : {};
  return {
    pageTypes: Array.isArray(source.pageTypes) ? source.pageTypes.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean) : [],
    articleIds: Array.isArray(source.articleIds)
      ? source.articleIds.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value) && value > 0)
      : [],
    categoryIds: Array.isArray(source.categoryIds) ? source.categoryIds.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean) : [],
    excludeArticleIds: Array.isArray(source.excludeArticleIds)
      ? source.excludeArticleIds.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value) && value > 0)
      : [],
    excludeCategoryIds: Array.isArray(source.excludeCategoryIds) ? source.excludeCategoryIds.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean) : [],
  };
}

function targetingEqual(left, right) {
  const normalizedLeft = normalizeTargetingShape(left);
  const normalizedRight = normalizeTargetingShape(right);
  return arraysEqual(normalizedLeft.pageTypes, normalizedRight.pageTypes)
    && arraysEqual(normalizedLeft.articleIds, normalizedRight.articleIds)
    && arraysEqual(normalizedLeft.categoryIds, normalizedRight.categoryIds)
    && arraysEqual(normalizedLeft.excludeArticleIds, normalizedRight.excludeArticleIds)
    && arraysEqual(normalizedLeft.excludeCategoryIds, normalizedRight.excludeCategoryIds);
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function shouldPatchDateField(rawValue, normalizedValue) {
  if (rawValue === undefined) return false;
  const normalizedRaw = normalizeDate(rawValue);
  if (normalizedRaw === null && rawValue !== null && rawValue !== '') return true;
  return normalizedRaw !== normalizedValue;
}

function hasMeaningfulTargeting(targeting) {
  const normalized = normalizeTargetingShape(targeting);
  return Object.values(normalized).some((values) => values.length > 0);
}

export function buildAdMigrationPatch(ad) {
  const source = ad && typeof ad === 'object' ? ad : {};
  const normalized = normalizeAdRecord(source);
  const patch = {};

  if (!Array.isArray(source.placements) || source.placements.length === 0 || !arraysEqual(source.placements, normalized.placements)) {
    patch.placements = normalized.placements;
  }

  const rawStatus = String(source.status || '').trim().toLowerCase();
  if (!AD_STATUS_OPTIONS.includes(rawStatus)) {
    patch.status = normalized.status;
  }

  if ((source.targeting && !targetingEqual(source.targeting, normalized.targeting))
    || (!source.targeting && hasMeaningfulTargeting(normalized.targeting))) {
    patch.targeting = normalized.targeting;
  }

  const rawWeight = Number(source.weight);
  if (!Number.isFinite(rawWeight) || rawWeight < 1 || rawWeight !== normalized.weight) {
    patch.weight = normalized.weight;
  }

  if (shouldPatchDateField(source.startAt, normalized.startAt)) {
    patch.startAt = normalized.startAt;
  }

  if (shouldPatchDateField(source.endAt, normalized.endAt)) {
    patch.endAt = normalized.endAt;
  }

  return patch;
}

export function buildAdMigrationPlan(ad) {
  const normalized = normalizeAdRecord(ad);
  const patch = buildAdMigrationPatch(ad);
  return {
    id: normalized.id,
    title: normalized.campaignName || normalized.title || `Ad ${normalized.id}`,
    patch,
    hasChanges: Object.keys(patch).length > 0,
  };
}

export function getAdMigrationPlans(ads) {
  return (Array.isArray(ads) ? ads : []).map(buildAdMigrationPlan);
}
