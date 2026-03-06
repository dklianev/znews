import { useCallback, useEffect, useMemo } from 'react';
import { AdBannerHorizontal, AdBannerInline, AdBannerSide } from '../AdBanner';
import { getAdSlot } from '../../../shared/adSlots.js';
import { resolveAdForSlot } from '../../../shared/adResolver.js';
import { AD_IMPRESSION_WINDOW_MS, buildAdImpressionStorageKey, getAnalyticsWindowKey } from '../../../shared/adAnalytics.js';
import { api } from '../../utils/api';

const BANNERS_BY_VARIANT = {
  horizontal: AdBannerHorizontal,
  inline: AdBannerInline,
  side: AdBannerSide,
};

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
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
  const resolvedAd = useMemo(() => {
    if (!slotMeta) return null;
    return resolveAdForSlot(ads, {
      slot,
      pageType: pageType || slotMeta.pageType,
      articleId,
      categoryId,
    });
  }, [ads, articleId, categoryId, pageType, slot, slotMeta]);

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

  const content = <Banner ad={resolvedAd} onClick={handleClick} />;
  if (!className) return content;
  return <div className={className}>{content}</div>;
}
