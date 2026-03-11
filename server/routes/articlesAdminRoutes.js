export function registerArticlesAdminRoutes(articlesRouter, deps) {
  const {
    Article,
    ArticleRevision,
    AuditLog,
    buildArticleSnapshot,
    createArticleRevision,
    enrichArticlePayloadWithImageMeta,
    invalidateCacheGroup,
    isImmediateBreakingArticle,
    nextNumericId,
    normalizeText,
    publicError,
    requireAuth,
    requirePermission,
    sanitizeArticlePayload,
    sendPushNotificationForArticle,
  } = deps;

  articlesRouter.post('/', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
      const data = sanitizeArticlePayload(req.body, { partial: false });
      await enrichArticlePayloadWithImageMeta(data, { partial: false });
      if (!data.title || !data.excerpt || !data.content || !data.category) {
        return res.status(400).json({ error: 'Missing required article fields' });
      }

      const cleanContentText = data.content.replace(/<[^>]*>?/gm, '').trim();
      if (cleanContentText.length === 0) {
        return res.status(400).json({ error: 'Article content cannot be empty text' });
      }

      if (!req.body.authorId || parseInt(req.body.authorId, 10) === 1) {
        data.authorId = Number.isInteger(req.user?.userId) ? req.user.userId : 1;
      }
      const id = await nextNumericId(Article);
      const item = await Article.create({ ...data, id });
      const obj = item.toJSON();
      if (obj.hero) {
        await Article.updateMany({ id: { $ne: id }, hero: true }, { $set: { hero: false } });
      }
      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'create',
        resource: 'articles',
        resourceId: id,
        details: obj.title || '',
      }).catch(() => { });
      await createArticleRevision(id, obj, { source: 'create', user: req.user });

      if (obj.breaking && obj.status === 'published' && (!obj.publishAt || new Date(obj.publishAt) <= new Date())) {
        sendPushNotificationForArticle(obj);
      }

      invalidateCacheGroup('articles', 'article-mutation');

      res.json(obj);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  articlesRouter.put('/:id', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const data = sanitizeArticlePayload(req.body, { partial: true });
      await enrichArticlePayloadWithImageMeta(data, { partial: true });
      if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

      const previous = await Article.findOne({ id }).lean();
      if (!previous) return res.status(404).json({ error: 'Not found' });

      const item = await Article.findOneAndUpdate({ id }, { $set: data }, { new: true });
      if (!item) return res.status(404).json({ error: 'Not found' });
      if (item.hero) {
        await Article.updateMany({ id: { $ne: id }, hero: true }, { $set: { hero: false } });
      }

      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'update',
        resource: 'articles',
        resourceId: id,
        details: data.title || '',
      }).catch(() => { });

      const updated = item.toJSON();
      await createArticleRevision(id, updated, { source: 'update', user: req.user });

      const now = new Date();
      const wasImmediateBreaking = isImmediateBreakingArticle(previous, now);
      const isNowImmediateBreaking = isImmediateBreakingArticle(updated, now);
      if (isNowImmediateBreaking && !wasImmediateBreaking) {
        sendPushNotificationForArticle(updated);
      }

      invalidateCacheGroup('articles', 'article-mutation');

      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  articlesRouter.get('/:id/revisions', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const revisions = await ArticleRevision.find({ articleId: id })
        .sort({ createdAt: -1 })
        .limit(80)
        .lean();

      const formatted = revisions.map((revision) => ({
        revisionId: revision.revisionId,
        articleId: revision.articleId,
        version: revision.version,
        source: revision.source,
        editorName: revision.editorName || '',
        createdAt: revision.createdAt,
        title: revision.snapshot?.title || '',
        excerpt: revision.snapshot?.excerpt || '',
        status: revision.snapshot?.status || 'published',
        publishAt: revision.snapshot?.publishAt || null,
      }));

      res.json(formatted);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  articlesRouter.get('/:id/revisions/:revisionId', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const revisionId = normalizeText(req.params.revisionId, 80);
      if (!revisionId) return res.status(400).json({ error: 'Invalid revisionId' });

      const revision = await ArticleRevision.findOne({ articleId: id, revisionId }).lean();
      if (!revision || !revision.snapshot) return res.status(404).json({ error: 'Revision not found' });

      res.json({
        revisionId: revision.revisionId,
        articleId: revision.articleId,
        version: revision.version,
        source: revision.source,
        editorName: revision.editorName || '',
        createdAt: revision.createdAt,
        snapshot: buildArticleSnapshot(revision.snapshot),
      });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  articlesRouter.post('/:id/revisions/autosave', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const existing = await Article.findOne({ id }).lean();
      if (!existing) return res.status(404).json({ error: 'Article not found' });

      const draftPatch = sanitizeArticlePayload(req.body, { partial: true });
      await enrichArticlePayloadWithImageMeta(draftPatch, { partial: true });
      const previewSnapshot = buildArticleSnapshot({ ...existing, ...draftPatch });
      const revision = await createArticleRevision(id, previewSnapshot, { source: 'autosave', user: req.user });

      res.json({
        ok: true,
        revision: revision
          ? {
            revisionId: revision.revisionId,
            version: revision.version,
            source: revision.source,
            editorName: revision.editorName,
            createdAt: revision.createdAt,
          }
          : null,
      });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  articlesRouter.post('/:id/revisions/restore', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const revisionId = normalizeText(req.body?.revisionId, 80);
      if (!revisionId) return res.status(400).json({ error: 'revisionId is required' });

      const revision = await ArticleRevision.findOne({ articleId: id, revisionId }).lean();
      if (!revision || !revision.snapshot) return res.status(404).json({ error: 'Revision not found' });

      const snapshot = buildArticleSnapshot(revision.snapshot);
      await enrichArticlePayloadWithImageMeta(snapshot, { partial: false });
      const restored = await Article.findOneAndUpdate({ id }, { $set: snapshot }, { new: true });
      if (!restored) return res.status(404).json({ error: 'Article not found' });

      if (restored.hero) {
        await Article.updateMany({ id: { $ne: id }, hero: true }, { $set: { hero: false } });
      }

      const restoredObj = restored.toJSON();
      await createArticleRevision(id, restoredObj, { source: 'restore', user: req.user });

      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'update',
        resource: 'articles',
        resourceId: id,
        details: `restore:${revisionId}`,
      }).catch(() => { });

      invalidateCacheGroup('articles', 'article-mutation');

      res.json(restoredObj);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  articlesRouter.delete('/:id', requireAuth, requirePermission('articles'), async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const result = await Article.deleteOne({ id });
      if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
      await ArticleRevision.deleteMany({ articleId: id });

      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'delete',
        resource: 'articles',
        resourceId: id,
        details: '',
      }).catch(() => { });

      invalidateCacheGroup('articles', 'article-mutation');

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });
}
