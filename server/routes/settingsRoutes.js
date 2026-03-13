import { asyncHandler } from '../services/expressAsyncService.js';

export function registerSettingsRoutes(app, deps) {
  const {
    AuditLog,
    Breaking,
    cacheMiddleware,
    createSettingsRevision,
    DEFAULT_HERO_SETTINGS,
    DEFAULT_SITE_SETTINGS,
    formatSettingsRevisionList,
    HeroSettings,
    invalidateCacheGroup,
    invalidateCacheTags,
    normalizeText,
    requireAuth,
    requirePermission,
    sanitizeHeroSettingsPayload,
    sanitizeSiteSettingsPayload,
    serializeHeroSettings,
    serializeSiteSettings,
    SettingsRevision,
    SiteSettings,
  } = deps;

  app.get('/api/breaking', cacheMiddleware, asyncHandler(async (_req, res) => {
    const doc = await Breaking.findOne().lean();
    return res.json(doc?.items || []);
  }));

  app.put('/api/breaking', requireAuth, requirePermission('breaking'), asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body)
      ? req.body.map((i) => normalizeText(i, 140)).filter(Boolean).slice(0, 20)
      : [];
    await Breaking.deleteMany({});
    const doc = await Breaking.create({ items });

    invalidateCacheGroup('breaking', 'breaking-mutation');

    return res.json(doc.items);
  }));

  app.get('/api/hero-settings', asyncHandler(async (_req, res) => {
    const doc = await HeroSettings.findOne({ key: 'main' }).lean();
    return res.json(serializeHeroSettings(doc || DEFAULT_HERO_SETTINGS));
  }));

  app.put('/api/hero-settings', requireAuth, requirePermission('articles'), asyncHandler(async (req, res) => {
    const settings = sanitizeHeroSettingsPayload(req.body);
    const updated = await HeroSettings.findOneAndUpdate(
      { key: 'main' },
      { $set: { key: 'main', ...settings } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const serialized = serializeHeroSettings(updated);
    await createSettingsRevision('hero', serialized, { source: 'update', user: req.user });
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'hero-settings',
      resourceId: 1,
      details: 'save',
    }).catch(() => {});

    invalidateCacheGroup('hero', 'hero-settings-mutation');

    return res.json(serialized);
  }));

  app.get('/api/hero-settings/revisions', requireAuth, requirePermission('articles'), asyncHandler(async (_req, res) => {
    const revisions = await SettingsRevision.find({ scope: 'hero' })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();
    return res.json(formatSettingsRevisionList(revisions));
  }));

  app.post('/api/hero-settings/revisions/restore', requireAuth, requirePermission('articles'), asyncHandler(async (req, res) => {
    const revisionId = normalizeText(req.body?.revisionId, 80);
    if (!revisionId) return res.status(400).json({ error: 'revisionId is required' });

    const revision = await SettingsRevision.findOne({ scope: 'hero', revisionId }).lean();
    if (!revision || !revision.snapshot) return res.status(404).json({ error: 'Revision not found' });

    const snapshot = serializeHeroSettings(revision.snapshot);
    const updated = await HeroSettings.findOneAndUpdate(
      { key: 'main' },
      { $set: { key: 'main', ...snapshot } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const serialized = serializeHeroSettings(updated);
    await createSettingsRevision('hero', serialized, { source: 'restore', user: req.user });
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'hero-settings',
      resourceId: 1,
      details: `restore:${revisionId}`,
    }).catch(() => {});

    invalidateCacheGroup('hero', 'hero-settings-mutation');

    return res.json(serialized);
  }));

  app.get('/api/site-settings/revisions', requireAuth, requirePermission('permissions'), asyncHandler(async (_req, res) => {
    const revisions = await SettingsRevision.find({ scope: 'site' })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();
    return res.json(formatSettingsRevisionList(revisions));
  }));

  app.post('/api/site-settings/revisions/restore', requireAuth, requirePermission('permissions'), asyncHandler(async (req, res) => {
    const revisionId = normalizeText(req.body?.revisionId, 80);
    if (!revisionId) return res.status(400).json({ error: 'revisionId is required' });

    const revision = await SettingsRevision.findOne({ scope: 'site', revisionId }).lean();
    if (!revision || !revision.snapshot) return res.status(404).json({ error: 'Revision not found' });

    const snapshot = serializeSiteSettings(revision.snapshot);
    const updated = await SiteSettings.findOneAndUpdate(
      { key: 'main' },
      { $set: { key: 'main', ...snapshot } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const serialized = serializeSiteSettings(updated);
    await createSettingsRevision('site', serialized, { source: 'restore', user: req.user });
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'site-settings',
      resourceId: 1,
      details: `restore:${revisionId}`,
    }).catch(() => {});

    invalidateCacheGroup('settings', 'site-settings-mutation');

    return res.json(serialized);
  }));

  app.get('/api/site-settings', asyncHandler(async (_req, res) => {
    const doc = await SiteSettings.findOne({ key: 'main' }).lean();
    return res.json(serializeSiteSettings(doc || DEFAULT_SITE_SETTINGS));
  }));

  app.put('/api/site-settings', requireAuth, requirePermission('permissions'), asyncHandler(async (req, res) => {
    const settings = sanitizeSiteSettingsPayload(req.body);
    const updated = await SiteSettings.findOneAndUpdate(
      { key: 'main' },
      { $set: { key: 'main', ...settings } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const serialized = serializeSiteSettings(updated);
    await createSettingsRevision('site', serialized, { source: 'update', user: req.user });
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'site-settings',
      resourceId: 1,
      details: 'save',
    }).catch(() => {});

    invalidateCacheGroup('settings', 'site-settings-mutation');

    return res.json(serialized);
  }));

  app.post('/api/site-settings/cache/homepage/refresh', requireAuth, requirePermission('permissions'), asyncHandler(async (req, res) => {
    const homepageCleared = invalidateCacheTags(['homepage'], { reason: 'manual-homepage-refresh:homepage' });
    const bootstrapCleared = invalidateCacheTags(['bootstrap'], { reason: 'manual-homepage-refresh:bootstrap' });
    const totalCleared = homepageCleared + bootstrapCleared;

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'site-settings',
      resourceId: 1,
      details: `refresh-homepage-cache:${totalCleared}`,
    }).catch(() => {});

    return res.json({
      ok: true,
      refreshedAt: new Date().toISOString(),
      cleared: {
        homepage: homepageCleared,
        bootstrap: bootstrapCleared,
        total: totalCleared,
      },
    });
  }));
}
