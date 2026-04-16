import express from 'express';

export function createArticlesPublicRouter(deps) {
  const {
    Article,
    ArticleReaction,
    ArticleView,
    Category,
    articleReactionLimiter,
    articleReactionWindowMs,
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
    hashBrowserClientFingerprint,
    hashClientFingerprint,
    invalidateCacheTags,
    isMongoDuplicateKeyError,
    isProd = false,
    normalizeText,
    parseCookies = () => ({}),
    parsePositiveInt,
    randomUUID = () => String(Date.now()),
    resolveShareFallbackSource,
    serializeCookie = (_name, value) => String(value),
    transparentPng1x1,
  } = deps;

  const articlesRouter = express.Router();
  const VALID_REACTIONS = ['fire', 'shock', 'laugh', 'skull', 'clap'];
  const REACTION_CACHE_TAGS = ['article-detail', 'author-stats'];
  const REACTION_CLIENT_COOKIE_NAME = 'zn_react_id';
  const REACTION_CLIENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
  const ACTIVE_REACTION_FILTER = {
    $or: [
      { active: { $exists: false } },
      { active: true },
    ],
  };
  const CLIENT_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,120}$/;

  function appendSetCookie(res, cookie) {
    if (!cookie) return;
    const current = res.getHeader?.('Set-Cookie');
    if (!current) {
      res.setHeader('Set-Cookie', cookie);
      return;
    }
    const next = Array.isArray(current) ? [...current, cookie] : [current, cookie];
    res.setHeader('Set-Cookie', next);
  }

  function readReactionClientIdFromHeader(req) {
    const value = typeof req.headers?.['x-zn-client-id'] === 'string'
      ? req.headers['x-zn-client-id'].trim()
      : '';
    return CLIENT_ID_PATTERN.test(value) ? value : '';
  }

  function readReactionClientIdFromCookie(req) {
    const cookies = typeof parseCookies === 'function' ? parseCookies(req) : {};
    const raw = typeof cookies?.[REACTION_CLIENT_COOKIE_NAME] === 'string'
      ? cookies[REACTION_CLIENT_COOKIE_NAME].trim()
      : '';
    return CLIENT_ID_PATTERN.test(raw) ? raw : '';
  }

  function getReactionClientId(req) {
    const headerValue = readReactionClientIdFromHeader(req);
    if (headerValue) return headerValue;
    const cookieValue = readReactionClientIdFromCookie(req);
    if (!cookieValue) return '';
    req.headers = req.headers || {};
    req.headers['x-zn-client-id'] = cookieValue;
    return cookieValue;
  }

  function ensureReactionClientId(req, res) {
    const cookieValue = readReactionClientIdFromCookie(req);
    const existing = getReactionClientId(req);
    if (existing) {
      if (!cookieValue) {
        appendSetCookie(res, serializeCookie(REACTION_CLIENT_COOKIE_NAME, existing, {
          path: '/',
          maxAge: REACTION_CLIENT_COOKIE_MAX_AGE_SECONDS,
          httpOnly: true,
          secure: isProd,
          sameSite: 'Lax',
        }));
      }
      return existing;
    }

    const created = `zn-browser-${randomUUID()}`;
    req.headers = req.headers || {};
    req.headers['x-zn-client-id'] = created;
    appendSetCookie(res, serializeCookie(REACTION_CLIENT_COOKIE_NAME, created, {
      path: '/',
      maxAge: REACTION_CLIENT_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
    }));
    return created;
  }

  function hasBrowserClientId(req) {
    return Boolean(getReactionClientId(req));
  }

  function hashReactionFingerprint(req, scope) {
    return hasBrowserClientId(req)
      ? hashBrowserClientFingerprint(req, scope)
      : hashClientFingerprint(req, scope);
  }

  function buildReactionState(docs) {
    const reacted = {
      fire: false,
      shock: false,
      laugh: false,
      skull: false,
      clap: false,
    };
    for (const doc of docs) {
      if (!VALID_REACTIONS.includes(doc?.emoji)) continue;
      reacted[doc.emoji] = true;
    }
    return {
      reacted,
      hasReacted: Object.values(reacted).some(Boolean),
    };
  }

  async function loadReactionDocs(req, articleId, windowKey) {
    const docs = await ArticleReaction.find({
      articleId,
      windowKey,
      voterHash: { $in: getReactionHashCandidates(req, articleId) },
      ...ACTIVE_REACTION_FILTER,
    })
      .select({ _id: 0, emoji: 1 })
      .lean();
    return Array.isArray(docs) ? docs : [];
  }

  async function loadReactionState(req, articleId, windowKey) {
    return buildReactionState(await loadReactionDocs(req, articleId, windowKey));
  }

  function buildReactionStateWithEmoji(docs, emoji, active = true) {
    const normalizedDocs = Array.isArray(docs) ? docs : [];
    const nextDocs = active
      ? normalizedDocs.some((doc) => doc?.emoji === emoji)
        ? normalizedDocs
        : [...normalizedDocs, { emoji }]
      : normalizedDocs.filter((doc) => doc?.emoji !== emoji);
    return buildReactionState(nextDocs);
  }

  function invalidateReactionCache(articleId, emoji) {
    if (typeof invalidateCacheTags !== 'function') return;
    invalidateCacheTags(REACTION_CACHE_TAGS, {
      reason: `article-reaction:${articleId}:${emoji || 'state'}`,
    });
  }

  function getReactionHashCandidates(req, articleId, emoji = null) {
    const hashes = new Set([hashReactionFingerprint(req, `react:${articleId}`)]);
    if (emoji && VALID_REACTIONS.includes(emoji)) {
      hashes.add(hashReactionFingerprint(req, `react:${articleId}:${emoji}`));
      return [...hashes];
    }
    VALID_REACTIONS.forEach((item) => {
      hashes.add(hashReactionFingerprint(req, `react:${articleId}:${item}`));
    });
    return [...hashes];
  }

  function parseCategoryList(rawValue) {
    const raw = typeof rawValue === 'string' ? rawValue : '';
    if (!raw.trim()) return [];
    return raw
      .split(',')
      .map((value) => normalizeText(value, 64).toLowerCase())
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index);
  }

  articlesRouter.get('/author-stats/:authorId', cacheMiddleware, async (req, res) => {
    const authorId = Number.parseInt(req.params.authorId, 10);
    if (!Number.isInteger(authorId)) return res.status(400).json({ error: 'Invalid authorId' });
    res.setCacheTags(['authors', 'author-stats']);
    res.setHeader('Cache-Control', 'public, max-age=300');

    const filter = { ...getPublishedFilter(), authorId };
    const [result] = await Article.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalArticles: { $sum: 1 },
          totalViews: { $sum: { $ifNull: ['$views', 0] } },
          totalReactions: {
            $sum: {
              $add: [
                { $ifNull: ['$reactions.fire', 0] },
                { $ifNull: ['$reactions.shock', 0] },
                { $ifNull: ['$reactions.laugh', 0] },
                { $ifNull: ['$reactions.skull', 0] },
                { $ifNull: ['$reactions.clap', 0] },
              ],
            },
          },
          categories: { $addToSet: '$category' },
        },
      },
    ]);

    return res.json({
      totalArticles: result?.totalArticles || 0,
      totalViews: result?.totalViews || 0,
      totalReactions: result?.totalReactions || 0,
      categoryCount: result?.categories?.length || 0,
    });
  });

  articlesRouter.get('/', cacheMiddleware, async (req, res) => {
    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const includeArchived = canSeeDrafts && req.query.status === 'archived';
    const filter = canSeeDrafts
      ? (includeArchived ? { status: 'archived' } : { status: { $ne: 'archived' } })
      : getPublishedFilter();
    const category = normalizeText(req.query.category, 64);
    const categories = parseCategoryList(req.query.categories);
    const q = normalizeText(req.query.q, 160);
    const sectionFilter = getArticleSectionFilter(req.query.section);
    const fieldsProjection = buildArticleProjection(req.query.fields);
    const shouldPaginate = hasOwn(req.query, 'page') || hasOwn(req.query, 'limit');
    const page = parsePositiveInt(req.query.page, 1, { min: 1, max: 2000 });
    const limit = parsePositiveInt(req.query.limit, 24, { min: 1, max: 120 });

    if (categories.length > 0) filter.category = { $in: categories };
    else if (category) filter.category = category;
    if (sectionFilter) Object.assign(filter, sectionFilter);
    const authorId = parsePositiveInt(req.query.authorId, null);
    if (authorId) filter.authorId = authorId;
    if (q) filter.$text = { $search: q };
    res.setCacheTags(q ? ['articles', 'article-list', 'search'] : ['articles', 'article-list']);
    res.setHeader('Cache-Control', maybeUser ? 'private, max-age=60' : 'public, max-age=300');

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

    if (!shouldPaginate) {
      const items = await query.lean();
      items.forEach((item) => {
        delete item._id;
        delete item.__v;
      });
      return res.json(items);
    }

    const [items, total] = await Promise.all([
      query.lean(),
      Article.countDocuments(filter),
    ]);
    items.forEach((item) => {
      delete item._id;
      delete item.__v;
    });
    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  // Express 5 no longer supports regexp sub-expressions in string paths.
  // We keep numeric validation inside the handler to preserve behavior.
  articlesRouter.get('/:id', cacheMiddleware, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    res.setCacheTags(['articles', 'article-detail']);

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
  });

  articlesRouter.get('/:id/reactions/me', async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const filter = { id, ...getPublishedFilter() };
    const exists = await Article.exists(filter);
    if (!exists) return res.status(404).json({ error: 'Not found' });

    ensureReactionClientId(req, res);
    const windowKey = getWindowKey(articleReactionWindowMs);
    return res.json(await loadReactionState(req, id, windowKey));
  });

  articlesRouter.get('/:id/share.png', async (req, res) => {
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
  });

  articlesRouter.post('/:id/view', async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const filter = { id, ...getPublishedFilter() };
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
      ? await Article.findOne(filter).lean()
      : await Article.findOneAndUpdate(filter, { $inc: { views: 1 } }, { returnDocument: 'after' }).lean();

    if (!item) return res.status(404).json({ error: 'Not found' });
    delete item._id;
    delete item.__v;
    return res.json({ ...item, deduped });
  });

  articlesRouter.post('/:id/react', articleReactionLimiter, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const emoji = String(req.body.emoji || '').trim();
    if (!VALID_REACTIONS.includes(emoji)) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }

    const filter = { id, ...getPublishedFilter() };

    // Verify article exists and is published before consuming a dedup slot
    const exists = await Article.exists(filter);
    if (!exists) return res.status(404).json({ error: 'Not found' });

    ensureReactionClientId(req, res);
    const windowKey = getWindowKey(articleReactionWindowMs);
    const currentReactionDocs = await loadReactionDocs(req, id, windowKey);
    if (currentReactionDocs.some((doc) => doc?.emoji === emoji)) {
      const reactionState = buildReactionStateWithEmoji(currentReactionDocs, emoji, true);
      return res.status(429).json({
        error: 'Already reacted',
        emoji,
        ...reactionState,
      });
    }

    const voterHash = hashReactionFingerprint(req, `react:${id}:${emoji}`);
    const expiresAt = new Date(Date.now() + articleReactionWindowMs + (15 * 60 * 1000));

    try {
      await ArticleReaction.create({ articleId: id, emoji, voterHash, windowKey, expiresAt });
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        const reactionState = buildReactionStateWithEmoji(currentReactionDocs, emoji, true);
        return res.status(429).json({ error: 'Already reacted', emoji, ...reactionState });
      }
      throw error;
    }

    const item = await Article.findOneAndUpdate(
      filter,
      { $inc: { [`reactions.${emoji}`]: 1 } },
      { returnDocument: 'after' },
    ).lean();

    if (!item) {
      await ArticleReaction.deleteOne({ articleId: id, emoji, voterHash, windowKey }).catch(() => {});
      return res.status(404).json({ error: 'Not found' });
    }
    delete item._id;
    delete item.__v;
    const reactionState = buildReactionStateWithEmoji(currentReactionDocs, emoji, true);
    invalidateReactionCache(id, emoji);
    return res.json({ reactions: item.reactions, emoji, ...reactionState });
  });

  articlesRouter.delete('/:id/react', async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const emoji = String(req.body?.emoji || '').trim();
    if (!VALID_REACTIONS.includes(emoji)) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }

    const filter = { id, ...getPublishedFilter() };
    const exists = await Article.exists(filter);
    if (!exists) return res.status(404).json({ error: 'Not found' });

    ensureReactionClientId(req, res);
    const windowKey = getWindowKey(articleReactionWindowMs);
    const currentReactionDocs = await loadReactionDocs(req, id, windowKey);
    if (!currentReactionDocs.some((doc) => doc?.emoji === emoji)) {
      const reactionState = buildReactionState(currentReactionDocs);
      return res.status(404).json({ error: 'Reaction not found', emoji, ...reactionState });
    }
    const reaction = await ArticleReaction.findOneAndDelete({
      articleId: id,
      emoji,
      windowKey,
      voterHash: { $in: getReactionHashCandidates(req, id, emoji) },
      ...ACTIVE_REACTION_FILTER,
    })
      .select({ _id: 0, articleId: 1, emoji: 1, voterHash: 1, windowKey: 1, expiresAt: 1, createdAt: 1 })
      .lean();

    if (!reaction) {
      const reactionState = buildReactionStateWithEmoji(currentReactionDocs, emoji, false);
      return res.status(404).json({ error: 'Reaction not found', emoji, ...reactionState });
    }

    const item = await Article.findOneAndUpdate(
      filter,
      { $inc: { [`reactions.${emoji}`]: -1 } },
      { returnDocument: 'after' },
    ).lean();

    if (!item) {
      await ArticleReaction.create(reaction).catch(() => {});
      return res.status(404).json({ error: 'Not found' });
    }
    delete item._id;
    delete item.__v;
    const reactionState = buildReactionStateWithEmoji(currentReactionDocs, emoji, false);
    invalidateReactionCache(id, emoji);
    return res.json({ reactions: item.reactions, emoji, removed: true, ...reactionState });
  });

  return articlesRouter;
}
