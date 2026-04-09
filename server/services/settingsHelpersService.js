export function createSettingsHelpers({
  DEFAULT_HERO_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  SettingsRevision,
  normalizeText,
  randomUUID,
  sanitizeSiteSettingsPayload,
  snapshotsEqual,
}) {
  function serializeHeroSettings(doc) {
    const source = doc && typeof doc === 'object' ? doc : DEFAULT_HERO_SETTINGS;
    const heroTitleScaleRaw = Number.parseInt(source.heroTitleScale, 10);
    const heroTitleScale = Number.isInteger(heroTitleScaleRaw)
      ? Math.min(130, Math.max(70, heroTitleScaleRaw))
      : DEFAULT_HERO_SETTINGS.heroTitleScale;
    const mainPhotoArticleIdRaw = Number.parseInt(source.mainPhotoArticleId, 10);
    const mainPhotoArticleId = Number.isInteger(mainPhotoArticleIdRaw) && mainPhotoArticleIdRaw > 0
      ? mainPhotoArticleIdRaw
      : null;
    const photoArticleIds = Array.isArray(source.photoArticleIds)
      ? [...new Set(source.photoArticleIds.map(v => Number.parseInt(v, 10)).filter(v => Number.isInteger(v) && v > 0))].slice(0, 2)
      : [];

    return {
      headline: normalizeText(source.headline ?? DEFAULT_HERO_SETTINGS.headline, 160) || DEFAULT_HERO_SETTINGS.headline,
      shockLabel: normalizeText(source.shockLabel ?? DEFAULT_HERO_SETTINGS.shockLabel, 32) || DEFAULT_HERO_SETTINGS.shockLabel,
      ctaLabel: normalizeText(source.ctaLabel ?? DEFAULT_HERO_SETTINGS.ctaLabel, 90) || DEFAULT_HERO_SETTINGS.ctaLabel,
      headlineBoardText: normalizeText(source.headlineBoardText ?? DEFAULT_HERO_SETTINGS.headlineBoardText, 90) || DEFAULT_HERO_SETTINGS.headlineBoardText,
      heroTitleScale,
      captions: Array.isArray(source.captions) && source.captions.length === 3
        ? source.captions.map((caption, idx) => normalizeText(caption, 90) || DEFAULT_HERO_SETTINGS.captions[idx])
        : DEFAULT_HERO_SETTINGS.captions,
      mainPhotoArticleId,
      photoArticleIds,
    };
  }

  function serializeSiteSettings(doc) {
    return sanitizeSiteSettingsPayload(doc || DEFAULT_SITE_SETTINGS);
  }

  function serializeSettingsSnapshot(scope, snapshot) {
    return scope === 'site'
      ? serializeSiteSettings(snapshot)
      : serializeHeroSettings(snapshot);
  }

  function formatSettingsRevisionList(revisions) {
    return revisions.map((revision) => ({
      revisionId: revision.revisionId,
      scope: revision.scope,
      version: revision.version,
      source: revision.source,
      editorName: revision.editorName || '',
      createdAt: revision.createdAt,
      snapshot: serializeSettingsSnapshot(revision.scope, revision.snapshot),
    }));
  }

  async function createSettingsRevision(scope, snapshot, { source = 'update', user = null } = {}) {
    const normalizedScope = scope === 'site' ? 'site' : 'hero';
    const normalizedSnapshot = serializeSettingsSnapshot(normalizedScope, snapshot);
    const latest = await SettingsRevision.findOne({ scope: normalizedScope }).sort({ version: -1 }).lean();
    if (latest?.snapshot && snapshotsEqual(latest.snapshot, normalizedSnapshot)) {
      return latest;
    }

    const nextVersion = (latest?.version || 0) + 1;
    const revision = await SettingsRevision.create({
      revisionId: randomUUID(),
      scope: normalizedScope,
      version: nextVersion,
      source,
      editorName: user?.name || '',
      editorId: Number.isInteger(user?.userId) ? user.userId : null,
      snapshot: normalizedSnapshot,
      createdAt: new Date(),
    });

    const stale = await SettingsRevision.find({ scope: normalizedScope })
      .sort({ createdAt: -1 })
      .skip(60)
      .select({ revisionId: 1, _id: 0 })
      .lean();
    if (stale.length > 0) {
      await SettingsRevision.deleteMany({ revisionId: { $in: stale.map(item => item.revisionId) } });
    }

    return revision.toJSON();
  }

  return {
    createSettingsRevision,
    formatSettingsRevisionList,
    serializeHeroSettings,
    serializeSiteSettings,
  };
}
