import express from 'express';
import { asyncHandler } from '../services/expressAsyncService.js';

export function createArticlesPublicRouter(deps) {
  const {
    Article,
    ArticleView,
    Category,
    articleViewWindowMs,
    buildArticleProjection,
    cacheMiddleware,
    decodeTokenFromRequest,
    ensureArticleShareCard,
    getArticleSectionFilter,
    getPublishedFilter,
    getWindowKey,
    hasOwn,
    hasPermissionForSection,
    hashClientFingerprint,
    isMongoDuplicateKeyError,
    normalizeText,
    parsePositiveInt,
    resolveShareFallbackSource,
    transparentPng1x1,
  } = deps;

  const articlesRouter = express.Router();

  articlesRouter.get('/', cacheMiddleware, asyncHandler(async (req, res) => {
    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const filter = canSeeDrafts ? {} : getPublishedFilter();
    const category = normalizeText(req.query.category, 64);
    const q = normalizeText(req.query.q, 160);
    const sectionFilter = getArticleSectionFilter(req.query.section);
    const fieldsProjection = buildArticleProjection(req.query.fields);
    const shouldPaginate = hasOwn(req.query, 'page') || hasOwn(req.query, 'limit');
    const page = parsePositiveInt(req.query.page, 1, { min: 1, max: 2000 });
    const limit = parsePositiveInt(req.query.limit, 24, { min: 1, max: 120 });

    if (category) filter.category = category;
    if (sectionFilter) Object.assign(filter, sectionFilter);
    if (q) filter.$text = { $search: q };

    let query = Article.find(filter);
    query = q
      ? query.sort({ score: { $meta: 'textScore' }, id: -1 })
      : query.sort({ id: -1 });
    if (fieldsProjection) {
      query = query.select(fieldsProjection);
    } else {
      query = query.select({ _id: 0, __v: 0 });
    }
    if (shouldPaginate) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const items = await query.lean();
    items.forEach((item) => {
      delete item._id;
      delete item.__v;
    });

    if (!shouldPaginate) {
      return res.json(items);
    }

    const total = await Article.countDocuments(filter);
    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }));

  // Express 5 no longer supports regexp sub-expressions in string paths.
  // We keep numeric validation inside the handler to preserve behavior.
  articlesRouter.get('/:id', cacheMiddleware, asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const filter = canSeeDrafts ? { id } : { id, ...getPublishedFilter() };
    const fieldsProjection = buildArticleProjection(req.query.fields);

    let query = Article.findOne(filter);
    if (fieldsProjection) {
      query = query.select(fieldsProjection);
    } else {
      query = query.select({ _id: 0, __v: 0 });
    }

    const item = await query.lean();
    if (!item) return res.status(404).json({ error: 'Not found' });
    delete item._id;
    delete item.__v;
    return res.json(item);
  }));

  articlesRouter.get('/:id/share.png', asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const filter = canSeeDrafts ? { id } : { id, ...getPublishedFilter() };
    const article = await Article.findOne(filter).lean();
    if (!article) return res.status(404).json({ error: 'Not found' });

    const category = await Category.findOne({ id: article.category }).select({ _id: 0, name: 1 }).lean();
    const card = await ensureArticleShareCard(article, { categoryLabel: category?.name || article.category || '' });
    if (card?.generated) {
      if (card.absolutePath) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(card.absolutePath);
      }
      if (card.url) {
        return res.redirect(302, card.url);
      }
    }

    const fallback = await resolveShareFallbackSource(article);
    if (fallback?.type === 'file' && fallback.path) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(fallback.path);
    }
    if (fallback?.type === 'redirect' && fallback.url) {
      return res.redirect(302, fallback.url);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=120');
    return res.send(transparentPng1x1);
  }));

  articlesRouter.post('/:id/view', asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const filter = { id, ...getPublishedFilter() };
    const existing = await Article.findOne(filter).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const viewerHash = hashClientFingerprint(req, `view:${id}`);
    const windowKey = getWindowKey(articleViewWindowMs);
    const expiresAt = new Date(Date.now() + articleViewWindowMs + (15 * 60 * 1000));

    let deduped = false;
    try {
      await ArticleView.create({
        articleId: id,
        viewerHash,
        windowKey,
        expiresAt,
      });
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) deduped = true;
      else throw error;
    }

    const item = deduped
      ? existing
      : await Article.findOneAndUpdate(filter, { $inc: { views: 1 } }, { new: true }).lean();

    if (!item) return res.status(404).json({ error: 'Not found' });
    delete item._id;
    delete item.__v;
    return res.json({ ...item, deduped });
  }));

  return articlesRouter;
}
