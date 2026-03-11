export function createAdHelpers(deps) {
  const {
    Ad,
    AdEvent,
    AD_EVENT_TYPES,
    AD_PAGE_TYPES,
    AD_STATUS_OPTIONS,
    AD_TYPES,
    DEFAULT_AD_ANALYTICS_DAYS,
    adAnalyticsRetentionMs,
    adImpressionWindowMs,
    decodeTokenFromRequest,
    filterPublicAds,
    getAdRotationPool,
    getAdSlot,
    getDefaultPlacementsForType,
    getWindowKey,
    hasOwn,
    hasPermissionForSection,
    hashClientFingerprint,
    isKnownAdSlot,
    isMongoDuplicateKeyError,
    normalizeAdFitMode,
    normalizeAdImageMeta,
    normalizeAdRecord,
    normalizeText,
    stripDocumentMetadata,
  } = deps;

  function uniqueNormalizedLowercaseStrings(values, maxLen = 80) {
    const source = Array.isArray(values) ? values : [];
    return [...new Set(source
      .map((value) => normalizeText(value, maxLen).toLowerCase())
      .filter(Boolean))];
  }

  function uniqueNormalizedIntegers(values) {
    const source = Array.isArray(values) ? values : [];
    return [...new Set(source
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0))];
  }

  function normalizeAdTypeInput(value) {
    const normalized = normalizeText(value, 24).toLowerCase();
    return AD_TYPES.includes(normalized) ? normalized : 'horizontal';
  }

  function normalizeAdStatusInput(value) {
    const normalized = normalizeText(value, 24).toLowerCase();
    return AD_STATUS_OPTIONS.includes(normalized) ? normalized : 'active';
  }

  function normalizeAdImagePlacementInput(value) {
    return normalizeText(value, 12).toLowerCase() === 'cover' ? 'cover' : 'circle';
  }

  function clampInteger(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function sanitizeAdDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function sanitizeAdPlacements(value, fallbackType = 'horizontal') {
    const source = Array.isArray(value) ? value : [value];
    const placements = [...new Set(source
      .map((item) => normalizeText(item, 64))
      .filter((item) => isKnownAdSlot(item)))];
    if (placements.length > 0) return placements;
    return getDefaultPlacementsForType(fallbackType);
  }

  function sanitizeAdTargeting(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      pageTypes: uniqueNormalizedLowercaseStrings(source.pageTypes, 24)
        .filter((item) => AD_PAGE_TYPES.includes(item)),
      articleIds: uniqueNormalizedIntegers(source.articleIds),
      categoryIds: uniqueNormalizedLowercaseStrings(source.categoryIds, 64),
      excludeArticleIds: uniqueNormalizedIntegers(source.excludeArticleIds),
      excludeCategoryIds: uniqueNormalizedLowercaseStrings(source.excludeCategoryIds, 64),
    };
  }

  function sanitizeAdPayload(payload, { partial = false } = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const next = {};
    const nextType = hasOwn(source, 'type') ? normalizeAdTypeInput(source.type) : 'horizontal';
    const nextShowButton = hasOwn(source, 'showButton') ? source.showButton !== false : true;
    const nextClickable = hasOwn(source, 'clickable') ? source.clickable !== false : true;
    const nextShowTitle = hasOwn(source, 'showTitle') ? source.showTitle !== false : true;
    const hasDesktopImage = hasOwn(source, 'imageDesktop') || hasOwn(source, 'image');
    const nextDesktopImage = normalizeText(hasOwn(source, 'imageDesktop') ? source.imageDesktop : source.image, 600);
    const hasDesktopImageMeta = hasOwn(source, 'imageMetaDesktop') || hasOwn(source, 'imageMeta');
    const rawDesktopImageMeta = hasOwn(source, 'imageMetaDesktop') ? source.imageMetaDesktop : source.imageMeta;

    if (!partial || hasOwn(source, 'type')) next.type = nextType;
    if (!partial || hasOwn(source, 'title')) next.title = normalizeText(source.title, 140);
    if (!partial || hasOwn(source, 'subtitle')) next.subtitle = normalizeText(source.subtitle, 240);
    if (!partial || hasOwn(source, 'showTitle')) next.showTitle = nextShowTitle;
    if (!partial || hasOwn(source, 'showButton')) next.showButton = nextShowButton;
    if (!partial || hasOwn(source, 'clickable')) next.clickable = nextClickable;
    if (!partial || hasOwn(source, 'cta')) next.cta = normalizeText(source.cta, 80) || '\u041d\u0430\u0443\u0447\u0438 \u043f\u043e\u0432\u0435\u0447\u0435';
    if (!partial || hasOwn(source, 'gradient')) next.gradient = normalizeText(source.gradient, 120);
    if (!partial || hasOwn(source, 'icon')) next.icon = normalizeText(source.icon, 16);
    if (!partial || hasOwn(source, 'link')) next.link = normalizeText(source.link, 400) || '#';
    if (!partial || hasOwn(source, 'color')) next.color = normalizeText(source.color, 40);
    if (!partial || hasDesktopImage) {
      next.imageDesktop = nextDesktopImage;
      next.image = nextDesktopImage;
    }
    if (!partial || hasOwn(source, 'imageMobile')) next.imageMobile = normalizeText(source.imageMobile, 600);
    if (!partial || hasDesktopImageMeta) {
      next.imageMetaDesktop = rawDesktopImageMeta && typeof rawDesktopImageMeta === 'object'
        ? normalizeAdImageMeta(rawDesktopImageMeta)
        : null;
      next.imageMeta = next.imageMetaDesktop;
    }
    if (!partial || hasOwn(source, 'imageMetaMobile')) {
      next.imageMetaMobile = source.imageMetaMobile && typeof source.imageMetaMobile === 'object'
        ? normalizeAdImageMeta(source.imageMetaMobile)
        : null;
    }
    if (!partial || hasOwn(source, 'imagePlacement')) next.imagePlacement = normalizeAdImagePlacementInput(source.imagePlacement);
    if (!partial || hasOwn(source, 'fitMode')) next.fitMode = normalizeAdFitMode(source.fitMode);
    if (!partial || hasOwn(source, 'status')) next.status = normalizeAdStatusInput(source.status);
    if (!partial || hasOwn(source, 'campaignName')) next.campaignName = normalizeText(source.campaignName, 120);
    if (!partial || hasOwn(source, 'notes')) next.notes = normalizeText(source.notes, 2000);
    if (!partial || hasOwn(source, 'placements')) next.placements = sanitizeAdPlacements(source.placements, next.type || nextType);
    if (!partial || hasOwn(source, 'targeting')) next.targeting = sanitizeAdTargeting(source.targeting);
    if (!partial || hasOwn(source, 'priority')) next.priority = clampInteger(source.priority, 0, { min: -1000, max: 1000 });
    if (!partial || hasOwn(source, 'weight')) next.weight = clampInteger(source.weight, 1, { min: 1, max: 100 });
    if (!partial || hasOwn(source, 'startAt')) next.startAt = sanitizeAdDate(source.startAt);
    if (!partial || hasOwn(source, 'endAt')) next.endAt = sanitizeAdDate(source.endAt);

    delete next.id;
    delete next._id;
    delete next.__v;
    return next;
  }

  function buildAdCandidate(existing, patch) {
    const current = existing && typeof existing === 'object' ? stripDocumentMetadata(existing) : {};
    return normalizeAdRecord({
      ...current,
      ...patch,
      targeting: hasOwn(patch, 'targeting') ? patch.targeting : current.targeting,
    });
  }

  function validateAdCandidate(ad) {
    const errors = [];
    const targeting = ad?.targeting || {
      pageTypes: [],
      articleIds: [],
      categoryIds: [],
      excludeArticleIds: [],
      excludeCategoryIds: [],
    };
    const slots = (Array.isArray(ad?.placements) ? ad.placements : [])
      .map((slotId) => getAdSlot(slotId))
      .filter(Boolean);

    if (!ad?.title) errors.push('Ad title is required');
    if (ad?.fitMode && !['cover', 'contain'].includes(ad.fitMode)) errors.push('Invalid ad fit mode');
    if (ad?.showButton !== false && !ad?.cta) errors.push('Ad CTA is required');
    if (ad?.clickable !== false && (!ad?.link || ad?.link === '#')) errors.push('Ad link is required for clickable ads');
    if (!AD_TYPES.includes(ad?.type)) errors.push('Invalid ad type');
    if (!AD_STATUS_OPTIONS.includes(ad?.status)) errors.push('Invalid ad status');
    if (slots.length === 0) errors.push('Select at least one valid placement');
    if (targeting.articleIds.length > 0 && !slots.some((slot) => slot.supportsArticleTargeting)) {
      errors.push('Selected placements do not support article targeting');
    }
    if (targeting.categoryIds.length > 0 && !slots.some((slot) => slot.supportsCategoryTargeting)) {
      errors.push('Selected placements do not support category targeting');
    }
    if (ad?.startAt && ad?.endAt) {
      const startMs = new Date(ad.startAt).getTime();
      const endMs = new Date(ad.endAt).getTime();
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs) {
        errors.push('startAt must be before endAt');
      }
    }

    return errors;
  }

  async function fetchAllAdsSorted() {
    const items = await Ad.find().sort({ priority: -1, id: -1 }).lean();
    return items.map((item) => normalizeAdRecord(stripDocumentMetadata(item)));
  }

  function serializePublicAdRecord(ad, { compact = false } = {}) {
    if (!compact) return ad;

    return {
      id: ad?.id,
      type: ad?.type,
      title: ad?.title,
      subtitle: ad?.subtitle,
      showTitle: ad?.showTitle,
      cta: ad?.cta,
      showButton: ad?.showButton,
      clickable: ad?.clickable,
      gradient: ad?.gradient,
      icon: ad?.icon,
      link: ad?.link,
      color: ad?.color,
      imageDesktop: ad?.imageDesktop,
      imageMobile: ad?.imageMobile,
      imagePlacement: ad?.imagePlacement,
      imageMetaDesktop: ad?.imageMetaDesktop,
      imageMetaMobile: ad?.imageMetaMobile,
      fitMode: ad?.fitMode,
      placements: ad?.placements,
      targeting: ad?.targeting,
      priority: ad?.priority,
      weight: ad?.weight,
      startAt: ad?.startAt,
      endAt: ad?.endAt,
      status: ad?.status,
    };
  }

  async function listPublicAds(options = {}) {
    const items = await fetchAllAdsSorted();
    return filterPublicAds(items).map((item) => serializePublicAdRecord(item, options));
  }

  async function listAdsForRequest(req) {
    const items = await fetchAllAdsSorted();
    const maybeUser = decodeTokenFromRequest(req);
    const canManageAds = maybeUser ? await hasPermissionForSection(maybeUser, 'ads') : false;
    return canManageAds ? items : filterPublicAds(items);
  }

  function sanitizeAdAnalyticsContext(payload) {
    const slotId = normalizeText(payload?.slot, 120);
    if (!isKnownAdSlot(slotId)) {
      return { error: 'Invalid ad slot' };
    }

    const slot = getAdSlot(slotId);
    const rawPageType = normalizeText(payload?.pageType, 24).toLowerCase();
    const pageType = AD_PAGE_TYPES.includes(rawPageType) ? rawPageType : slot.pageType;
    const parsedArticleId = Number.parseInt(payload?.articleId, 10);
    const articleId = Number.isInteger(parsedArticleId) && parsedArticleId > 0 ? parsedArticleId : null;
    const categoryId = normalizeText(payload?.categoryId, 64).toLowerCase();

    return {
      slot: slotId,
      pageType,
      articleId,
      categoryId,
    };
  }

  function clampAdAnalyticsDays(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) return DEFAULT_AD_ANALYTICS_DAYS;
    return Math.min(365, Math.max(1, parsed));
  }

  async function resolveTrackedAdCandidate(adId, context) {
    const publicAds = await listPublicAds();
    const rotationPool = getAdRotationPool(publicAds, context);
    return rotationPool.find((candidate) => Number.parseInt(candidate?.id, 10) === adId) || null;
  }

  async function recordAdAnalyticsEvent({ req, adId, eventType, context }) {
    if (!AD_EVENT_TYPES.includes(eventType)) {
      throw new Error('Invalid ad analytics event type');
    }

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + adAnalyticsRetentionMs);
    const isImpression = eventType === 'impression';
    const payload = {
      adId,
      eventType,
      slot: context.slot,
      pageType: context.pageType,
      articleId: context.articleId,
      categoryId: context.categoryId,
      viewerHash: hashClientFingerprint(req, `ad:${adId}`),
      windowKey: isImpression ? getWindowKey(adImpressionWindowMs) : null,
      createdAt,
      expiresAt,
    };

    try {
      await AdEvent.create(payload);
      return { deduped: false };
    } catch (error) {
      if (isImpression && isMongoDuplicateKeyError(error)) {
        return { deduped: true };
      }
      throw error;
    }
  }

  async function buildAdAnalyticsSummary({ days = DEFAULT_AD_ANALYTICS_DAYS } = {}) {
    const safeDays = clampAdAnalyticsDays(days);
    const cutoff = new Date(Date.now() - (safeDays * 24 * 60 * 60 * 1000));
    const rows = await AdEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: cutoff },
          eventType: { $in: AD_EVENT_TYPES },
        },
      },
      {
        $group: {
          _id: { adId: '$adId', eventType: '$eventType' },
          count: { $sum: 1 },
          lastAt: { $max: '$createdAt' },
        },
      },
    ]);

    const itemsByAdId = new Map();
    rows.forEach((row) => {
      const adId = Number.parseInt(row?._id?.adId, 10);
      if (!Number.isInteger(adId)) return;

      const current = itemsByAdId.get(adId) || {
        adId,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        lastImpressionAt: null,
        lastClickAt: null,
      };

      if (row?._id?.eventType === 'impression') {
        current.impressions = Number(row.count) || 0;
        current.lastImpressionAt = row.lastAt || null;
      }
      if (row?._id?.eventType === 'click') {
        current.clicks = Number(row.count) || 0;
        current.lastClickAt = row.lastAt || null;
      }

      current.ctr = current.impressions > 0
        ? Number(((current.clicks / current.impressions) * 100).toFixed(2))
        : 0;

      itemsByAdId.set(adId, current);
    });

    const items = [...itemsByAdId.values()]
      .sort((left, right) => right.impressions - left.impressions || right.clicks - left.clicks || right.adId - left.adId);
    const totals = items.reduce((acc, item) => {
      acc.impressions += item.impressions;
      acc.clicks += item.clicks;
      return acc;
    }, { impressions: 0, clicks: 0, ctr: 0 });
    totals.ctr = totals.impressions > 0
      ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2))
      : 0;

    return {
      days: safeDays,
      generatedAt: new Date().toISOString(),
      totals,
      items,
    };
  }

  return {
    buildAdAnalyticsSummary,
    buildAdCandidate,
    listAdsForRequest,
    listPublicAds,
    recordAdAnalyticsEvent,
    resolveTrackedAdCandidate,
    sanitizeAdAnalyticsContext,
    sanitizeAdPayload,
    validateAdCandidate,
  };
}
