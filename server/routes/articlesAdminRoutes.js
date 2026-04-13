
export function registerArticlesAdminRoutes(articlesRouter, deps) {
  const {
    Article,
    ArticleRevision,
    AuditLog,
    buildArticleRecencyPipeline,
    buildArticleSnapshot,
    createArticleRevision,
    enrichArticlePayloadWithImageMeta,
    invalidateCacheGroup,
    isImmediateBreakingArticle,
    nextNumericId,
    normalizeText,
    parsePositiveInt,
    requireAuth,
    requirePermission,
    sanitizeArticlePayload,
    sendPushNotificationForArticle,
  } = deps;

  const ADMIN_ARTICLE_LIST_PROJECTION = {
    id: 1,
    title: 1,
    category: 1,
    authorId: 1,
    date: 1,
    readTime: 1,
    views: 1,
    image: 1,
    featured: 1,
    breaking: 1,
    status: 1,
    publishAt: 1,
  };
  const ADMIN_RELATED_PROJECTION = {
    id: 1,
    title: 1,
    image: 1,
    category: 1,
    authorId: 1,
    date: 1,
    status: 1,
  };

  const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parseIdList = (value, maxItems = 30) => String(value || '')
    .split(',')
    .map((item) => Number.parseInt(item, 10))
    .filter((item, index, list) => Number.isInteger(item) && item > 0 && list.indexOf(item) === index)
    .slice(0, maxItems);

  articlesRouter.get('/admin/list', requireAuth, requirePermission('articles'), async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, { min: 1, max: 5000 });
    const limit = parsePositiveInt(req.query.limit, 15, { min: 1, max: 100 });
    const category = normalizeText(req.query.category, 64);
    const q = normalizeText(req.query.q, 160);

    const filter = { status: { $ne: 'archived' } };
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (q) {
      filter.title = new RegExp(escapeRegex(q), 'i');
    }

    const total = await Article.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const pipeline = buildArticleRecencyPipeline(filter, ADMIN_ARTICLE_LIST_PROJECTION, {
      skip: (safePage - 1) * limit,
      limit,
    });
    const items = await Article.aggregate(pipeline);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      items,
      page: safePage,
      limit,
      total,
      totalPages,
    });
  });

  articlesRouter.get('/admin/meta', requireAuth, requirePermission('articles'), async (_req, res) => {
    const filter = { status: { $ne: 'archived' } };
    const [total, categoryCounts, popularTagsRaw] = await Promise.all([
      Article.countDocuments(filter),
      Article.aggregate([
        { $match: filter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { _id: 0, category: '$_id', count: 1 } },
      ]),
      Article.aggregate([
        { $match: filter },
        {
          $project: {
            tags: {
              $cond: [
                { $isArray: '$tags' },
                {
                  $map: {
                    input: '$tags',
                    as: 'tag',
                    in: { $trim: { input: { $toLower: { $toString: '$$tag' } } } },
                  },
                },
                {
                  $map: {
                    input: { $split: [{ $toString: { $ifNull: ['$tags', ''] } }, ','] },
                    as: 'tag',
                    in: { $trim: { input: { $toLower: '$$tag' } } },
                  },
                },
              ],
            },
          },
        },
        { $unwind: '$tags' },
        { $match: { tags: { $ne: '' } } },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 30 },
        { $project: { _id: 0, tag: '$_id', count: 1 } },
      ]),
    ]);

    const byCategory = Object.fromEntries(
      (Array.isArray(categoryCounts) ? categoryCounts : [])
        .filter((item) => item?.category)
        .map((item) => [item.category, Number(item.count) || 0]),
    );
    const popularTags = (Array.isArray(popularTagsRaw) ? popularTagsRaw : [])
      .map((item) => ({
        tag: item?.tag || '',
        count: Number(item?.count) || 0,
      }))
      .filter((item) => item.tag);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      total,
      byCategory,
      popularTags,
    });
  });

  articlesRouter.get('/admin/related', requireAuth, requirePermission('articles'), async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 20, { min: 1, max: 50 });
    const q = normalizeText(req.query.q, 160);
    const requestedIds = parseIdList(req.query.ids, 50);
    const parsedExcludeId = Number.parseInt(req.query.excludeId, 10);
    const excludeId = Number.isInteger(parsedExcludeId) ? parsedExcludeId : null;

    let ids = requestedIds;
    if (Number.isInteger(excludeId)) {
      ids = ids.filter((id) => id !== excludeId);
    }

    if (requestedIds.length > 0 && ids.length === 0) {
      return res.json({ items: [] });
    }

    const filter = { status: { $ne: 'archived' } };
    if (ids.length > 0) {
      filter.id = { $in: ids };
    } else if (Number.isInteger(excludeId)) {
      filter.id = { $ne: excludeId };
    }

    if (q) {
      filter.title = new RegExp(escapeRegex(q), 'i');
    }

    const pipeline = buildArticleRecencyPipeline(filter, ADMIN_RELATED_PROJECTION, {
      limit: ids.length > 0 ? Math.max(limit, ids.length) : limit,
    });
    const items = await Article.aggregate(pipeline);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ items });
  });

  articlesRouter.post('/', requireAuth, requirePermission('articles'), async (req, res) => {
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
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));
    await createArticleRevision(id, obj, { source: 'create', user: req.user });

    if (obj.breaking && obj.status === 'published' && (!obj.publishAt || new Date(obj.publishAt) <= new Date())) {
      sendPushNotificationForArticle(obj);
    }

    invalidateCacheGroup('articles', 'article-mutation');

    res.json(obj);
  });

  articlesRouter.put('/:id', requireAuth, requirePermission('articles'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const data = sanitizeArticlePayload(req.body, { partial: true });
    await enrichArticlePayloadWithImageMeta(data, { partial: true });
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const previous = await Article.findOne({ id }).lean();
    if (!previous) return res.status(404).json({ error: 'Not found' });

    const item = await Article.findOneAndUpdate({ id }, { $set: data }, { returnDocument: 'after' });
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
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

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
  });

  articlesRouter.get('/:id/revisions', requireAuth, requirePermission('articles'), async (req, res) => {
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
  });

  articlesRouter.get('/:id/revisions/:revisionId', requireAuth, requirePermission('articles'), async (req, res) => {
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
  });

  articlesRouter.post('/:id/revisions/autosave', requireAuth, requirePermission('articles'), async (req, res) => {
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
  });

  articlesRouter.post('/:id/revisions/restore', requireAuth, requirePermission('articles'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const revisionId = normalizeText(req.body?.revisionId, 80);
    if (!revisionId) return res.status(400).json({ error: 'revisionId is required' });

    const revision = await ArticleRevision.findOne({ articleId: id, revisionId }).lean();
    if (!revision || !revision.snapshot) return res.status(404).json({ error: 'Revision not found' });

    const snapshot = buildArticleSnapshot(revision.snapshot);
    await enrichArticlePayloadWithImageMeta(snapshot, { partial: false });
    const restored = await Article.findOneAndUpdate({ id }, { $set: snapshot }, { returnDocument: 'after' });
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
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    invalidateCacheGroup('articles', 'article-mutation');

    res.json(restoredObj);
  });

  // Soft delete — moves article to archived status
  articlesRouter.delete('/:id', requireAuth, requirePermission('articles'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const article = await Article.findOneAndUpdate(
      { id, status: { $ne: 'archived' } },
      { $set: { status: 'archived', deletedAt: new Date(), deletedBy: req.user.name } },
      { returnDocument: 'after' },
    );
    if (!article) return res.status(404).json({ error: 'Not found' });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'articles',
      resourceId: id,
      details: 'soft-delete',
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    invalidateCacheGroup('articles', 'article-mutation');

    res.json({ ok: true });
  });

  // Restore archived article back to draft
  articlesRouter.post('/:id/restore', requireAuth, requirePermission('articles'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const article = await Article.findOneAndUpdate(
      { id, status: 'archived' },
      { $set: { status: 'draft', deletedAt: null, deletedBy: null } },
      { returnDocument: 'after' },
    );
    if (!article) return res.status(404).json({ error: 'Not found or not archived' });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'articles',
      resourceId: id,
      details: 'restore-from-archive',
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    invalidateCacheGroup('articles', 'article-mutation');

    res.json(article.toObject());
  });

  // Permanent delete — only for archived articles
  articlesRouter.delete('/:id/permanent', requireAuth, requirePermission('articles'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await Article.deleteOne({ id, status: 'archived' });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found or not archived' });
    await ArticleRevision.deleteMany({ articleId: id });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'articles',
      resourceId: id,
      details: 'permanent-delete',
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    invalidateCacheGroup('articles', 'article-mutation');

    res.json({ ok: true });
  });
}
