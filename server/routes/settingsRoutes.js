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
    publicError,
    requireAuth,
    requirePermission,
    sanitizeHeroSettingsPayload,
    sanitizeSiteSettingsPayload,
    serializeHeroSettings,
    serializeSiteSettings,
    SettingsRevision,
    SiteSettings,
  } = deps;

  app.get('/api/breaking', cacheMiddleware, async (_req, res) => {
    try {
      const doc = await Breaking.findOne().lean();
      res.json(doc?.items || []);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.put('/api/breaking', requireAuth, requirePermission('breaking'), async (req, res) => {
    try {
      const items = Array.isArray(req.body)
        ? req.body.map((i) => normalizeText(i, 140)).filter(Boolean).slice(0, 20)
        : [];
      await Breaking.deleteMany({});
      const doc = await Breaking.create({ items });

      invalidateCacheGroup('breaking', 'breaking-mutation');

      res.json(doc.items);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.get('/api/hero-settings', async (_req, res) => {
    try {
      const doc = await HeroSettings.findOne({ key: 'main' }).lean();
      res.json(serializeHeroSettings(doc || DEFAULT_HERO_SETTINGS));
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.put('/api/hero-settings', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
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

      res.json(serialized);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.get('/api/hero-settings/revisions', requireAuth, requirePermission('articles'), async (_req, res) => {
    try {
      const revisions = await SettingsRevision.find({ scope: 'hero' })
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();
      res.json(formatSettingsRevisionList(revisions));
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.post('/api/hero-settings/revisions/restore', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
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

      res.json(serialized);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.get('/api/site-settings/revisions', requireAuth, requirePermission('permissions'), async (_req, res) => {
    try {
      const revisions = await SettingsRevision.find({ scope: 'site' })
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();
      res.json(formatSettingsRevisionList(revisions));
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.post('/api/site-settings/revisions/restore', requireAuth, requirePermission('permissions'), async (req, res) => {
    try {
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

      res.json(serialized);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.get('/api/site-settings', async (_req, res) => {
    try {
      const doc = await SiteSettings.findOne({ key: 'main' }).lean();
      res.json(serializeSiteSettings(doc || DEFAULT_SITE_SETTINGS));
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.put('/api/site-settings', requireAuth, requirePermission('permissions'), async (req, res) => {
    try {
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

      res.json(serialized);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.post('/api/site-settings/cache/homepage/refresh', requireAuth, requirePermission('permissions'), async (req, res) => {
    try {
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

      res.json({
        ok: true,
        refreshedAt: new Date().toISOString(),
        cleared: {
          homepage: homepageCleared,
          bootstrap: bootstrapCleared,
          total: totalCleared,
        },
      });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });
}
