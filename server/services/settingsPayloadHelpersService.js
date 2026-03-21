export function createSettingsPayloadHelpers({
  BREAKING_CATEGORY_LABEL,
  DEFAULT_HERO_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  normalizeText,
}) {
  const allowedSpotlightIcons = new Set(['Flame', 'Megaphone', 'Bell', 'Siren', 'Zap', 'Newspaper', 'ShieldAlert', 'Gamepad2']);
  const allowedLayoutPresets = new Set(['default', 'impact', 'noir', 'classic']);
  const layoutPresetSectionKeys = [
    'homeFeatured',
    'homeCrime',
    'homeReportage',
    'homeEmergency',
    'articleRelated',
    'categoryListing',
    'searchListing',
  ];

  function sanitizeHeroSettingsPayload(payload) {
    const inputCaptions = Array.isArray(payload?.captions) ? payload.captions : [];
    const heroTitleScaleRaw = Number.parseInt(payload?.heroTitleScale, 10);
    const heroTitleScale = Number.isInteger(heroTitleScaleRaw)
      ? Math.min(130, Math.max(70, heroTitleScaleRaw))
      : DEFAULT_HERO_SETTINGS.heroTitleScale;
    const mainPhotoArticleIdRaw = Number.parseInt(payload?.mainPhotoArticleId, 10);
    const mainPhotoArticleId = Number.isInteger(mainPhotoArticleIdRaw) && mainPhotoArticleIdRaw > 0
      ? mainPhotoArticleIdRaw
      : null;
    const inputPhotoIds = Array.isArray(payload?.photoArticleIds) ? payload.photoArticleIds : [];
    const captions = [
      normalizeText(inputCaptions[0] ?? DEFAULT_HERO_SETTINGS.captions[0], 90) || DEFAULT_HERO_SETTINGS.captions[0],
      normalizeText(inputCaptions[1] ?? DEFAULT_HERO_SETTINGS.captions[1], 90) || DEFAULT_HERO_SETTINGS.captions[1],
      normalizeText(inputCaptions[2] ?? DEFAULT_HERO_SETTINGS.captions[2], 90) || DEFAULT_HERO_SETTINGS.captions[2],
    ];
    const photoArticleIds = [...new Set(
      inputPhotoIds
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value > 0)
    )].slice(0, 2);

    return {
      headline: normalizeText(payload?.headline ?? DEFAULT_HERO_SETTINGS.headline, 160) || DEFAULT_HERO_SETTINGS.headline,
      shockLabel: normalizeText(payload?.shockLabel ?? DEFAULT_HERO_SETTINGS.shockLabel, 32) || DEFAULT_HERO_SETTINGS.shockLabel,
      ctaLabel: normalizeText(payload?.ctaLabel ?? DEFAULT_HERO_SETTINGS.ctaLabel, 90) || DEFAULT_HERO_SETTINGS.ctaLabel,
      headlineBoardText: normalizeText(payload?.headlineBoardText ?? DEFAULT_HERO_SETTINGS.headlineBoardText, 90) || DEFAULT_HERO_SETTINGS.headlineBoardText,
      heroTitleScale,
      captions,
      mainPhotoArticleId,
      photoArticleIds,
    };
  }

  function sanitizeInternalPath(value, fallback = '/') {
    const route = normalizeText(value, 200);
    if (!route || !route.startsWith('/')) return fallback;
    return route;
  }

  function sanitizeTilt(value, fallback = '0deg') {
    const tilt = normalizeText(value, 20);
    return /^-?\d+(\.\d+)?deg$/i.test(tilt) ? tilt : fallback;
  }

  function appendMissingSpotlightDefaults(items) {
    const next = Array.isArray(items) ? [...items] : [];
    const seen = new Set(
      next
        .map((item) => (typeof item?.to === 'string' ? item.to : ''))
        .filter(Boolean)
    );

    DEFAULT_SITE_SETTINGS.spotlightLinks.forEach((defaultItem) => {
      if (seen.has(defaultItem.to)) return;
      next.push({ ...defaultItem });
      seen.add(defaultItem.to);
    });

    return next;
  }

  function normalizeBreakingCategoryLabel(route, rawLabel, maxLen = 50) {
    const normalizedLabel = normalizeText(rawLabel, maxLen);
    if (route !== '/category/breaking') return normalizedLabel;
    if (!normalizedLabel || normalizedLabel.toLowerCase() === 'спешни') return BREAKING_CATEGORY_LABEL;
    return normalizedLabel;
  }

  function sanitizeSiteSettingsPayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const breakingBadgeLabel = normalizeText(
      source.breakingBadgeLabel ?? DEFAULT_SITE_SETTINGS.breakingBadgeLabel,
      24
    ) || DEFAULT_SITE_SETTINGS.breakingBadgeLabel;

    const navbarLinksInput = Array.isArray(source.navbarLinks) ? source.navbarLinks : DEFAULT_SITE_SETTINGS.navbarLinks;
    const navbarLinks = navbarLinksInput
      .map((item) => {
        const to = sanitizeInternalPath(item?.to, '/');
        return {
          to,
          label: normalizeBreakingCategoryLabel(to, item?.label, 50),
          hot: Boolean(item?.hot),
        };
      })
      .filter((item) => item.label)
      .slice(0, 16);

    const spotlightLinksInput = appendMissingSpotlightDefaults(
      Array.isArray(source.spotlightLinks) ? source.spotlightLinks : DEFAULT_SITE_SETTINGS.spotlightLinks
    );
    const spotlightLinks = spotlightLinksInput
      .map((item, idx) => {
        const fallback = DEFAULT_SITE_SETTINGS.spotlightLinks[idx] || DEFAULT_SITE_SETTINGS.spotlightLinks[0];
        const iconCandidate = normalizeText(item?.icon, 40) || fallback.icon;
        return {
          to: sanitizeInternalPath(item?.to, fallback.to),
          label: normalizeText(item?.label, 40) || fallback.label,
          icon: allowedSpotlightIcons.has(iconCandidate) ? iconCandidate : fallback.icon,
          hot: Boolean(item?.hot),
          tilt: sanitizeTilt(item?.tilt, fallback.tilt),
        };
      })
      .filter((item) => item.label)
      .filter((item, idx, items) => items.findIndex((candidate) => candidate.to === item.to) === idx)
      .slice(0, 8);

    const footerPillsInput = Array.isArray(source.footerPills) ? source.footerPills : DEFAULT_SITE_SETTINGS.footerPills;
    const footerPills = footerPillsInput
      .map((item, idx) => {
        const fallback = DEFAULT_SITE_SETTINGS.footerPills[idx] || DEFAULT_SITE_SETTINGS.footerPills[0];
        return {
          to: sanitizeInternalPath(item?.to, fallback.to),
          label: normalizeText(item?.label, 40) || fallback.label,
          hot: Boolean(item?.hot),
          tilt: sanitizeTilt(item?.tilt, fallback.tilt),
        };
      })
      .filter((item) => item.label)
      .slice(0, 10);

    const footerQuickLinksInput = Array.isArray(source.footerQuickLinks) ? source.footerQuickLinks : DEFAULT_SITE_SETTINGS.footerQuickLinks;
    const footerQuickLinks = footerQuickLinksInput
      .map((item, idx) => {
        const fallback = DEFAULT_SITE_SETTINGS.footerQuickLinks[idx] || DEFAULT_SITE_SETTINGS.footerQuickLinks[0];
        const to = sanitizeInternalPath(item?.to, fallback.to);
        return {
          to,
          label: normalizeBreakingCategoryLabel(to, item?.label, 50)
            || normalizeBreakingCategoryLabel(to, fallback.label, 50),
        };
      })
      .filter((item) => item.label)
      .slice(0, 20);

    const footerInfoLinksInput = Array.isArray(source.footerInfoLinks) ? source.footerInfoLinks : DEFAULT_SITE_SETTINGS.footerInfoLinks;
    const footerInfoLinks = footerInfoLinksInput
      .map((item, idx) => {
        const fallback = DEFAULT_SITE_SETTINGS.footerInfoLinks[idx] || DEFAULT_SITE_SETTINGS.footerInfoLinks[0];
        return {
          to: sanitizeInternalPath(item?.to, fallback.to),
          label: normalizeText(item?.label, 50) || fallback.label,
        };
      })
      .filter((item) => item.label)
      .slice(0, 20);

    const contactInput = source.contact && typeof source.contact === 'object' ? source.contact : {};
    const contact = {
      address: normalizeText(contactInput.address ?? DEFAULT_SITE_SETTINGS.contact.address, 120) || DEFAULT_SITE_SETTINGS.contact.address,
      phone: normalizeText(contactInput.phone ?? DEFAULT_SITE_SETTINGS.contact.phone, 60) || DEFAULT_SITE_SETTINGS.contact.phone,
      email: normalizeText(contactInput.email ?? DEFAULT_SITE_SETTINGS.contact.email, 120) || DEFAULT_SITE_SETTINGS.contact.email,
    };

    const aboutInput = source.about && typeof source.about === 'object' ? source.about : {};
    const adPlansInput = Array.isArray(aboutInput.adPlans) ? aboutInput.adPlans : DEFAULT_SITE_SETTINGS.about.adPlans;
    const about = {
      heroText: normalizeText(aboutInput.heroText ?? DEFAULT_SITE_SETTINGS.about.heroText, 600) || DEFAULT_SITE_SETTINGS.about.heroText,
      missionTitle: normalizeText(aboutInput.missionTitle ?? DEFAULT_SITE_SETTINGS.about.missionTitle, 70) || DEFAULT_SITE_SETTINGS.about.missionTitle,
      missionParagraph1: normalizeText(aboutInput.missionParagraph1 ?? DEFAULT_SITE_SETTINGS.about.missionParagraph1, 1200) || DEFAULT_SITE_SETTINGS.about.missionParagraph1,
      missionParagraph2: normalizeText(aboutInput.missionParagraph2 ?? DEFAULT_SITE_SETTINGS.about.missionParagraph2, 1200) || DEFAULT_SITE_SETTINGS.about.missionParagraph2,
      adIntro: normalizeText(aboutInput.adIntro ?? DEFAULT_SITE_SETTINGS.about.adIntro, 600) || DEFAULT_SITE_SETTINGS.about.adIntro,
      adPlans: adPlansInput
        .map((plan, idx) => {
          const fallback = DEFAULT_SITE_SETTINGS.about.adPlans[idx] || DEFAULT_SITE_SETTINGS.about.adPlans[0];
          return {
            name: normalizeText(plan?.name, 70) || fallback.name,
            price: normalizeText(plan?.price, 40) || fallback.price,
            desc: normalizeText(plan?.desc, 160) || fallback.desc,
          };
        })
        .filter((plan) => plan.name)
        .slice(0, 6),
    };

    const rawLayoutPresets = source.layoutPresets && typeof source.layoutPresets === 'object'
      ? source.layoutPresets
      : {};
    const layoutPresets = layoutPresetSectionKeys.reduce((acc, sectionKey) => {
      const fallbackPreset = DEFAULT_SITE_SETTINGS.layoutPresets?.[sectionKey] || 'default';
      const candidate = normalizeText(rawLayoutPresets?.[sectionKey], 24) || fallbackPreset;
      acc[sectionKey] = allowedLayoutPresets.has(candidate) ? candidate : fallbackPreset;
      return acc;
    }, {});

    const tipLinePromoInput = source.tipLinePromo && typeof source.tipLinePromo === 'object'
      ? source.tipLinePromo
      : {};
    const tipLinePromo = {
      enabled: Boolean(tipLinePromoInput.enabled ?? DEFAULT_SITE_SETTINGS.tipLinePromo.enabled),
      title: normalizeText(tipLinePromoInput.title ?? DEFAULT_SITE_SETTINGS.tipLinePromo.title, 120) || DEFAULT_SITE_SETTINGS.tipLinePromo.title,
      description: normalizeText(tipLinePromoInput.description ?? DEFAULT_SITE_SETTINGS.tipLinePromo.description, 600) || DEFAULT_SITE_SETTINGS.tipLinePromo.description,
      buttonLabel: normalizeText(tipLinePromoInput.buttonLabel ?? DEFAULT_SITE_SETTINGS.tipLinePromo.buttonLabel, 60) || DEFAULT_SITE_SETTINGS.tipLinePromo.buttonLabel,
      buttonLink: sanitizeInternalPath(tipLinePromoInput.buttonLink, DEFAULT_SITE_SETTINGS.tipLinePromo.buttonLink),
    };

    return {
      breakingBadgeLabel,
      navbarLinks: navbarLinks.length > 0 ? navbarLinks : DEFAULT_SITE_SETTINGS.navbarLinks,
      spotlightLinks: spotlightLinks.length > 0 ? spotlightLinks : DEFAULT_SITE_SETTINGS.spotlightLinks,
      footerPills: footerPills.length > 0 ? footerPills : DEFAULT_SITE_SETTINGS.footerPills,
      footerQuickLinks: footerQuickLinks.length > 0 ? footerQuickLinks : DEFAULT_SITE_SETTINGS.footerQuickLinks,
      footerInfoLinks: footerInfoLinks.length > 0 ? footerInfoLinks : DEFAULT_SITE_SETTINGS.footerInfoLinks,
      contact,
      about,
      layoutPresets,
      tipLinePromo,
    };
  }

  return {
    normalizeBreakingCategoryLabel,
    sanitizeHeroSettingsPayload,
    sanitizeInternalPath,
    sanitizeSiteSettingsPayload,
    sanitizeTilt,
  };
}
