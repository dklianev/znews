import express from 'express';
import { asyncHandler } from '../services/expressAsyncService.js';

const COMMENT_COPY = Object.freeze({
  invalidPayload: '\u041f\u043e\u043f\u044a\u043b\u043d\u0438 \u0438\u043c\u0435 \u0438 \u0442\u0435\u043a\u0441\u0442, \u0437\u0430 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0442\u0438\u0448 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440.',
  invalidArticle: '\u0421\u0442\u0430\u0442\u0438\u044f\u0442\u0430 \u043d\u0435 \u0435 \u0432\u0430\u043b\u0438\u0434\u043d\u0430.',
  articleNotFound: '\u0421\u0442\u0430\u0442\u0438\u044f\u0442\u0430 \u043d\u0435 \u0435 \u043d\u0430\u043c\u0435\u0440\u0435\u043d\u0430.',
  authorRequired: '\u0418\u043c\u0435\u0442\u043e \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u043e.',
  textRequired: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u044a\u0442 \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u0435\u043d.',
  blockedTerms: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u044a\u0442 \u0441\u044a\u0434\u044a\u0440\u0436\u0430 \u0437\u0430\u0431\u0440\u0430\u043d\u0435\u043d\u0438 \u0434\u0443\u043c\u0438.',
  blockedTermsField: '\u041f\u0440\u0435\u043c\u0430\u0445\u043d\u0438 \u0437\u0430\u0431\u0440\u0430\u043d\u0435\u043d\u0438\u0442\u0435 \u0434\u0443\u043c\u0438 \u0438 \u043e\u043f\u0438\u0442\u0430\u0439 \u043f\u0430\u043a.',
  invalidParent: '\u0420\u043e\u0434\u0438\u0442\u0435\u043b\u0441\u043a\u0438\u044f\u0442 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440 \u043d\u0435 \u0435 \u0432\u0430\u043b\u0438\u0434\u0435\u043d.',
  parentMissing: '\u0420\u043e\u0434\u0438\u0442\u0435\u043b\u0441\u043a\u0438\u044f\u0442 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440 \u0432\u0435\u0447\u0435 \u043d\u0435 \u0435 \u043d\u0430\u043b\u0438\u0447\u0435\u043d \u0437\u0430 \u043e\u0442\u0433\u043e\u0432\u043e\u0440.',
  noValidUpdate: '\u041d\u044f\u043c\u0430 \u0432\u0430\u043b\u0438\u0434\u043d\u0438 \u043f\u043e\u043b\u0435\u0442\u0430 \u0437\u0430 \u043f\u0440\u043e\u043c\u044f\u043d\u0430.',
});

function authorTooLongMessage(maxLength) {
  return `\u0418\u043c\u0435\u0442\u043e \u0435 \u0442\u0432\u044a\u0440\u0434\u0435 \u0434\u044a\u043b\u0433\u043e (\u043c\u0430\u043a\u0441. ${maxLength} \u0437\u043d\u0430\u043a\u0430).`;
}

function textTooLongMessage(maxLength) {
  return `\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u0442\u043e \u0435 \u0442\u0432\u044a\u0440\u0434\u0435 \u0434\u044a\u043b\u0433\u043e (\u043c\u0430\u043a\u0441. ${maxLength} \u0437\u043d\u0430\u043a\u0430).`;
}

function buildFieldErrors(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => typeof value === 'string' && value.trim())
  );
}

export function createCommentsRouter(deps) {
  const {
    Article,
    AuditLog,
    collectCommentThreadIds,
    commentContainsBlockedTerms,
    commentCreateLimiter,
    commentReactionLimiter,
    Comment,
    CommentReaction,
    decodeTokenFromRequest,
    getPublishedFilter,
    hasOwn,
    hasPermissionForSection,
    hashClientFingerprint,
    nextNumericId,
    normalizeCommentReaction,
    normalizeText,
    parseCollectionPagination,
    requireAuth,
    requirePermission,
    syncCommentReactionTotals,
  } = deps;

  const commentsRouter = express.Router();
  const COMMENT_AUTHOR_MAX_LEN = 50;
  const COMMENT_TEXT_MAX_LEN = 1200;

  commentsRouter.get('/', asyncHandler(async (req, res) => {
    const maybeUser = decodeTokenFromRequest(req);
    const canModerate = maybeUser ? await hasPermissionForSection(maybeUser, 'comments') : false;
    const filter = canModerate ? {} : { approved: true };

    if (hasOwn(req.query, 'articleId')) {
      const articleId = Number.parseInt(req.query.articleId, 10);
      if (!Number.isInteger(articleId)) return res.status(400).json({ error: 'Invalid articleId' });
      filter.articleId = articleId;
    }

    if (canModerate && hasOwn(req.query, 'approved')) {
      const approvedRaw = normalizeText(String(req.query.approved), 10).toLowerCase();
      if (approvedRaw === 'true') filter.approved = true;
      else if (approvedRaw === 'false') filter.approved = false;
    }

    const pagination = parseCollectionPagination(req.query, { defaultLimit: 80, maxLimit: 250 });
    let query = Comment.find(filter).sort({ id: -1 });
    if (pagination.shouldPaginate) {
      query = query.skip(pagination.skip).limit(pagination.limit);
    }

    if (!pagination.shouldPaginate) {
      const items = await query.lean();
      items.forEach((item) => {
        delete item._id;
        delete item.__v;
      });
      return res.json(items);
    }

    const [items, total] = await Promise.all([
      query.lean(),
      Comment.countDocuments(filter),
    ]);
    items.forEach((item) => {
      delete item._id;
      delete item.__v;
    });
    return res.json({
      items,
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    });
  }));

  commentsRouter.post('/', commentCreateLimiter, asyncHandler(async (req, res) => {
    const articleId = Number.parseInt(req.body.articleId, 10);
    const parentIdRaw = hasOwn(req.body, 'parentId') ? Number.parseInt(req.body.parentId, 10) : null;
    const authorRaw = typeof req.body.author === 'string'
      ? req.body.author.replace(/\u0000/g, '').trim()
      : '';
    const textRaw = typeof req.body.text === 'string'
      ? req.body.text.replace(/\u0000/g, '').trim()
      : '';

    if (!Number.isInteger(articleId) || !authorRaw || !textRaw) {
      return res.status(400).json({
        error: COMMENT_COPY.invalidPayload,
        fieldErrors: buildFieldErrors({
          articleId: Number.isInteger(articleId) ? '' : COMMENT_COPY.invalidArticle,
          author: authorRaw ? '' : COMMENT_COPY.authorRequired,
          text: textRaw ? '' : COMMENT_COPY.textRequired,
        }),
      });
    }

    if (authorRaw.length > COMMENT_AUTHOR_MAX_LEN) {
      return res.status(400).json({
        error: authorTooLongMessage(COMMENT_AUTHOR_MAX_LEN),
        fieldErrors: {
          author: authorTooLongMessage(COMMENT_AUTHOR_MAX_LEN),
        },
      });
    }

    if (textRaw.length > COMMENT_TEXT_MAX_LEN) {
      return res.status(400).json({
        error: textTooLongMessage(COMMENT_TEXT_MAX_LEN),
        fieldErrors: {
          text: textTooLongMessage(COMMENT_TEXT_MAX_LEN),
        },
      });
    }

    const author = authorRaw;
    const text = textRaw;

    if (commentContainsBlockedTerms(`${author} ${text}`)) {
      return res.status(400).json({
        error: COMMENT_COPY.blockedTerms,
        fieldErrors: {
          text: COMMENT_COPY.blockedTermsField,
        },
      });
    }

    const articleExists = await Article.exists({ id: articleId, ...getPublishedFilter() });
    if (!articleExists) {
      return res.status(404).json({
        error: COMMENT_COPY.articleNotFound,
        fieldErrors: {
          articleId: COMMENT_COPY.articleNotFound,
        },
      });
    }

    let parentId = null;
    if (parentIdRaw !== null) {
      if (!Number.isInteger(parentIdRaw)) {
        return res.status(400).json({
          error: COMMENT_COPY.invalidParent,
          fieldErrors: {
            parentId: COMMENT_COPY.invalidParent,
          },
        });
      }
      const parentComment = await Comment.findOne({
        id: parentIdRaw,
        articleId,
        approved: true,
      }).lean();
      if (!parentComment) {
        return res.status(400).json({
          error: COMMENT_COPY.parentMissing,
          fieldErrors: {
            parentId: COMMENT_COPY.parentMissing,
          },
        });
      }
      parentId = parentIdRaw;
    }

    const id = await nextNumericId(Comment);
    const item = await Comment.create({
      id,
      articleId,
      parentId,
      author,
      avatar: author.charAt(0).toUpperCase() || 'A',
      text,
      date: new Date().toISOString().slice(0, 10),
      likes: 0,
      dislikes: 0,
      approved: false,
    });

    res.status(201).json(item.toJSON());
  }));

  commentsRouter.post('/:id/reaction', commentReactionLimiter, asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    if (!hasOwn(payload, 'reaction')) {
      return res.status(400).json({ error: 'reaction is required' });
    }

    const reactionRaw = normalizeText(payload.reaction, 16).toLowerCase();
    let reaction = null;
    if (!reactionRaw || reactionRaw === 'none' || reactionRaw === 'clear') {
      reaction = null;
    } else {
      reaction = normalizeCommentReaction(reactionRaw);
      if (!reaction) return res.status(400).json({ error: 'Invalid reaction value' });
    }

    const maybeUser = decodeTokenFromRequest(req);
    const canModerate = maybeUser ? await hasPermissionForSection(maybeUser, 'comments') : false;
    const commentFilter = canModerate ? { id } : { id, approved: true };
    const commentExists = await Comment.exists(commentFilter);
    if (!commentExists) return res.status(404).json({ error: 'Comment not found' });

    const voterHash = hashClientFingerprint(req, `comment:${id}`);
    if (reaction) {
      await CommentReaction.findOneAndUpdate(
        { commentId: id, voterHash },
        {
          $set: {
            value: reaction,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    } else {
      await CommentReaction.deleteOne({ commentId: id, voterHash });
    }

    const updated = await syncCommentReactionTotals(id);
    if (!updated) return res.status(404).json({ error: 'Comment not found' });
    const asJson = updated.toJSON();
    asJson.userReaction = reaction;
    return res.json(asJson);
  }));

  commentsRouter.put('/:id', requireAuth, requirePermission('comments'), asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const updates = {};
    if (hasOwn(req.body, 'approved')) updates.approved = Boolean(req.body.approved);
    if (hasOwn(req.body, 'text')) {
      const textRaw = typeof req.body.text === 'string'
        ? req.body.text.replace(/\u0000/g, '').trim()
        : '';
      if (!textRaw) {
        return res.status(400).json({
          error: COMMENT_COPY.invalidPayload,
          fieldErrors: {
            text: COMMENT_COPY.textRequired,
          },
        });
      }
      if (textRaw.length > COMMENT_TEXT_MAX_LEN) {
        return res.status(400).json({
          error: textTooLongMessage(COMMENT_TEXT_MAX_LEN),
          fieldErrors: {
            text: textTooLongMessage(COMMENT_TEXT_MAX_LEN),
          },
        });
      }
      updates.text = textRaw;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: COMMENT_COPY.noValidUpdate });
    }

    const item = await Comment.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (updates.approved === false) {
      const threadIds = await collectCommentThreadIds(id);
      const descendantIds = threadIds.filter((commentId) => commentId !== id);
      if (descendantIds.length > 0) {
        await Comment.updateMany(
          { id: { $in: descendantIds } },
          { $set: { approved: false } }
        );
      }
    }

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'comments',
      resourceId: id,
      details: '',
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    res.json(item.toJSON());
  }));

  commentsRouter.delete('/:id', requireAuth, requirePermission('comments'), asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const exists = await Comment.exists({ id });
    if (!exists) return res.status(404).json({ error: 'Not found' });

    const threadIds = await collectCommentThreadIds(id);
    await Promise.all([
      Comment.deleteMany({ id: { $in: threadIds } }),
      CommentReaction.deleteMany({ commentId: { $in: threadIds } }),
    ]);

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'comments',
      resourceId: id,
      details: threadIds.length > 1 ? `cascade:${threadIds.length}` : '',
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    res.json({ ok: true });
  }));

  return commentsRouter;
}
