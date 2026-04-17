export function createArticleHelpers(deps) {
  const {
    ArticleRevision,
    hasOwn,
    normalizeText,
    randomUUID,
    resolveImageMetaFromUrl,
    sanitizeDate,
    sanitizeDateTime,
    sanitizeMediaUrl,
    sanitizeSafeHtml,
    sanitizeShareAccent,
    sanitizeTags,
  } = deps;
  const ARTICLE_REVISION_RETRY_LIMIT = 5;

  function sanitizeArticlePayload(payload, { partial = false } = {}) {
    const out = {};

    if (!partial || hasOwn(payload, 'title')) out.title = normalizeText(payload.title, 180);
    if (!partial || hasOwn(payload, 'excerpt')) out.excerpt = normalizeText(payload.excerpt, 450);
    if (!partial || hasOwn(payload, 'content')) out.content = sanitizeSafeHtml(payload.content);
    if (!partial || hasOwn(payload, 'category')) out.category = normalizeText(payload.category, 64);

    if (!partial || hasOwn(payload, 'authorId')) {
      const authorId = Number.parseInt(payload.authorId, 10);
      if (Number.isInteger(authorId) && authorId > 0) out.authorId = authorId;
      else if (!partial) out.authorId = 1;
    }

    if (!partial || hasOwn(payload, 'date')) out.date = sanitizeDate(payload.date);

    if (!partial || hasOwn(payload, 'readTime')) {
      const readTime = Number(payload.readTime);
      out.readTime = Number.isFinite(readTime) ? Math.max(1, Math.min(120, Math.round(readTime))) : 3;
    }

    if (!partial || hasOwn(payload, 'image')) out.image = sanitizeMediaUrl(payload.image);
    if (!partial || hasOwn(payload, 'imageMeta')) {
      out.imageMeta = payload.imageMeta && typeof payload.imageMeta === 'object' ? payload.imageMeta : null;
    }
    if (!partial || hasOwn(payload, 'youtubeUrl')) {
      out.youtubeUrl = payload.youtubeUrl ? normalizeText(payload.youtubeUrl, 500) : '';
    }
    if (!partial || hasOwn(payload, 'featured')) out.featured = Boolean(payload.featured);
    if (!partial || hasOwn(payload, 'breaking')) out.breaking = Boolean(payload.breaking);
    if (!partial || hasOwn(payload, 'sponsored')) out.sponsored = Boolean(payload.sponsored);
    if (!partial || hasOwn(payload, 'hero')) out.hero = Boolean(payload.hero);

    if (!partial || hasOwn(payload, 'tags')) out.tags = sanitizeTags(payload.tags);

    if (!partial || hasOwn(payload, 'status')) {
      out.status = payload.status === 'draft' ? 'draft' : 'published';
    }

    if (!partial || hasOwn(payload, 'publishAt')) {
      out.publishAt = sanitizeDateTime(payload.publishAt);
    }

    if (!partial || hasOwn(payload, 'views')) {
      const views = Number(payload.views);
      out.views = Number.isFinite(views) ? Math.max(0, Math.floor(views)) : 0;
    }

    if (!partial || hasOwn(payload, 'shareTitle')) {
      out.shareTitle = normalizeText(payload?.shareTitle, 120);
    }

    if (!partial || hasOwn(payload, 'shareSubtitle')) {
      out.shareSubtitle = normalizeText(payload?.shareSubtitle, 180);
    }

    if (!partial || hasOwn(payload, 'shareBadge')) {
      out.shareBadge = normalizeText(payload?.shareBadge, 36);
    }

    if (!partial || hasOwn(payload, 'shareAccent')) {
      out.shareAccent = sanitizeShareAccent(payload?.shareAccent);
    }

    if (!partial || hasOwn(payload, 'shareImage')) {
      out.shareImage = sanitizeMediaUrl(payload?.shareImage);
    }

    if (!partial || hasOwn(payload, 'cardSticker')) {
      out.cardSticker = normalizeText(payload?.cardSticker, 24);
    }

    return out;
  }

  function buildArticleSnapshot(articleLike) {
    return {
      title: normalizeText(articleLike?.title, 180),
      excerpt: normalizeText(articleLike?.excerpt, 450),
      content: sanitizeSafeHtml(articleLike?.content),
      category: normalizeText(articleLike?.category, 64),
      authorId: Number.isInteger(Number.parseInt(articleLike?.authorId, 10)) ? Number.parseInt(articleLike.authorId, 10) : 1,
      date: sanitizeDate(articleLike?.date),
      readTime: Number.isFinite(Number(articleLike?.readTime)) ? Math.max(1, Math.min(120, Math.round(Number(articleLike.readTime)))) : 3,
      image: sanitizeMediaUrl(articleLike?.image),
      imageMeta: articleLike?.imageMeta && typeof articleLike.imageMeta === 'object' ? articleLike.imageMeta : null,
      featured: Boolean(articleLike?.featured),
      breaking: Boolean(articleLike?.breaking),
      sponsored: Boolean(articleLike?.sponsored),
      hero: Boolean(articleLike?.hero),
      views: Number.isFinite(Number(articleLike?.views)) ? Math.max(0, Math.floor(Number(articleLike.views))) : 0,
      tags: sanitizeTags(articleLike?.tags),
      status: articleLike?.status === 'draft' ? 'draft' : 'published',
      publishAt: sanitizeDateTime(articleLike?.publishAt),
      shareTitle: normalizeText(articleLike?.shareTitle, 120),
      shareSubtitle: normalizeText(articleLike?.shareSubtitle, 180),
      shareBadge: normalizeText(articleLike?.shareBadge, 36),
      shareAccent: sanitizeShareAccent(articleLike?.shareAccent),
      shareImage: sanitizeMediaUrl(articleLike?.shareImage),
      cardSticker: normalizeText(articleLike?.cardSticker, 24),
    };
  }

  async function enrichArticlePayloadWithImageMeta(payload, { partial = false } = {}) {
    if (!payload || typeof payload !== 'object') return payload;
    if (!partial || hasOwn(payload, 'image')) {
      const resolvedMeta = await resolveImageMetaFromUrl(payload.image, { queueIfMissing: true });
      if (resolvedMeta) {
        payload.imageMeta = { ...(payload.imageMeta || {}), ...resolvedMeta };
      }
    }
    return payload;
  }

  function snapshotsEqual(left, right) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  function isDuplicateRevisionError(error) {
    return Boolean(error && (error.code === 11000 || error?.name === 'MongoServerError' && error?.code === 11000));
  }

  async function pruneArticleRevisions(articleId) {
    const recentRevisions = await ArticleRevision.find({ articleId })
      .sort({ createdAt: -1, version: -1 })
      .select({ _id: 0, createdAt: 1, version: 1 })
      .limit(80)
      .lean();

    if (!Array.isArray(recentRevisions) || recentRevisions.length < 80) return;

    const cutoff = recentRevisions[recentRevisions.length - 1];
    if (!cutoff?.createdAt) return;

    await ArticleRevision.deleteMany({
      articleId,
      $or: [
        { createdAt: { $lt: cutoff.createdAt } },
        {
          createdAt: cutoff.createdAt,
          version: { $lt: cutoff.version },
        },
      ],
    });
  }

  async function createArticleRevision(articleId, snapshot, { source = 'update', user = null } = {}) {
    const normalizedSnapshot = buildArticleSnapshot(snapshot);
    for (let attempt = 0; attempt < ARTICLE_REVISION_RETRY_LIMIT; attempt += 1) {
      const latest = await ArticleRevision.findOne({ articleId }).sort({ version: -1 }).lean();
      if (latest?.snapshot && snapshotsEqual(latest.snapshot, normalizedSnapshot)) {
        return latest;
      }

      const nextVersion = (latest?.version || 0) + 1;

      try {
        const revision = await ArticleRevision.create({
          revisionId: randomUUID(),
          articleId,
          version: nextVersion,
          source,
          editorName: user?.name || '',
          editorId: Number.isInteger(user?.userId) ? user.userId : null,
          snapshot: normalizedSnapshot,
          createdAt: new Date(),
        });

        await pruneArticleRevisions(articleId);
        return revision.toJSON();
      } catch (error) {
        if (isDuplicateRevisionError(error) && attempt < ARTICLE_REVISION_RETRY_LIMIT - 1) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Неуспешно създаване на ревизия на статия.');
  }

  return {
    buildArticleSnapshot,
    createArticleRevision,
    enrichArticlePayloadWithImageMeta,
    sanitizeArticlePayload,
  };
}
