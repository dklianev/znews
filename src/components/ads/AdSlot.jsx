import { useCallback, useEffect, useMemo } from 'react';
import { AdBannerHorizontal, AdBannerInline, AdBannerSide } from '../AdBanner';
import { getAdSlot } from '../../../shared/adSlots.js';
import { AD_IMPRESSION_WINDOW_MS, AD_ROTATION_WINDOW_MS, buildAdImpressionStorageKey, getAnalyticsWindowKey } from '../../../shared/adAnalytics.js';
import { buildAdRotationKey, resolveAdForSlot } from '../../../shared/adResolver.js';
import { api } from '../../utils/api';

const BANNERS_BY_VARIANT = {
  horizontal: AdBannerHorizontal,
  inline: AdBannerInline,
  side: AdBannerSide,
};

const AD_ROTATION_SEED_KEY = 'zn_ad_rotation_seed';

function getWebStorage(type) {
  if (typeof window === 'undefined') return null;
  try {
    return window[type];
  } catch {
    return null;
  }
}

function getSessionStorage() {
  return getWebStorage('sessionStorage');
}

function getPersistentRotationSeed() {
  const storage = getWebStorage('localStorage');
  if (!storage) return 'viewer-anon';

  try {
    const existing = storage.getItem(AD_ROTATION_SEED_KEY);
    if (existing) return existing;

    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `viewer-${Math.random().toString(36).slice(2, 12)}`;
    storage.setItem(AD_ROTATION_SEED_KEY, generated);
    return generated;
  } catch {
    return 'viewer-anon';
  }
}

export default function AdSlot({
  ads,
  slot,
  pageType,
  articleId = null,
  categoryId = '',
  className = '',
}) {
  const slotMeta = getAdSlot(slot);
  const rotationSeed = useMemo(() => getPersistentRotationSeed(), []);
  const rotationWindowKey = useMemo(
    () => getAnalyticsWindowKey(AD_ROTATION_WINDOW_MS),
    [articleId, categoryId, pageType, slot]
  );
  const rotationKey = useMemo(() => {
    if (!slotMeta) return '';
    return buildAdRotationKey({
      slot,
      pageType: pageType || slotMeta.pageType,
      articleId,
      categoryId,
      rotationSeed,
      rotationWindowKey,
    });
  }, [articleId, categoryId, pageType, rotationSeed, rotationWindowKey, slot, slotMeta]);

  const resolvedAd = useMemo(() => {
    if (!slotMeta) return null;
    return resolveAdForSlot(ads, {
      slot,
      pageType: pageType || slotMeta.pageType,
      articleId,
      categoryId,
      rotationKey,
      rotationWindowKey,
    });
  }, [ads, articleId, categoryId, pageType, rotationKey, rotationWindowKey, slot, slotMeta]);

  const analyticsContext = useMemo(() => {
    if (!slotMeta || !resolvedAd) return null;
    const parsedArticleId = Number.parseInt(articleId, 10);
    return {
      slot,
      pageType: pageType || slotMeta.pageType,
      articleId: Number.isInteger(parsedArticleId) ? parsedArticleId : null,
      categoryId: String(categoryId || '').trim().toLowerCase(),
    };
  }, [articleId, categoryId, pageType, resolvedAd, slot, slotMeta]);

  useEffect(() => {
    if (!resolvedAd || !analyticsContext) return;

    const sessionStorage = getSessionStorage();
    const windowKey = getAnalyticsWindowKey(AD_IMPRESSION_WINDOW_MS);
    const storageKey = buildAdImpressionStorageKey({
      adId: resolvedAd.id,
      ...analyticsContext,
    }, windowKey);

    if (sessionStorage?.getItem(storageKey)) return;
    try {
      sessionStorage?.setItem(storageKey, '1');
    } catch {
      // ignore storage quota/privacy mode errors
    }

    void api.ads.trackImpression(resolvedAd.id, analyticsContext).catch(() => {
      try {
        sessionStorage?.removeItem(storageKey);
      } catch {
        // ignore storage failures on rollback
      }
    });
  }, [analyticsContext, resolvedAd]);

  const handleClick = useCallback(() => {
    if (!resolvedAd || !analyticsContext) return;
    void api.ads.trackClick(resolvedAd.id, analyticsContext).catch(() => {});
  }, [analyticsContext, resolvedAd]);

  if (!slotMeta || !resolvedAd) return null;

  const Banner = BANNERS_BY_VARIANT[slotMeta.variant];
  if (!Banner) return null;

  const content = <Banner ad={resolvedAd} slotMeta={slotMeta} onClick={handleClick} />;
  if (!className) return content;
  return <div className={className}>{content}</div>;
}
