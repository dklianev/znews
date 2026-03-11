import express from 'express';

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
    publicError,
    requireAuth,
    requirePermission,
    syncCommentReactionTotals,
  } = deps;

  const commentsRouter = express.Router();
  const COMMENT_AUTHOR_MAX_LEN = 50;
  const COMMENT_TEXT_MAX_LEN = 1200;

  commentsRouter.get('/', async (req, res) => {
    try {
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

      const items = await query.lean();
      items.forEach((item) => {
        delete item._id;
        delete item.__v;
      });
      if (!pagination.shouldPaginate) {
        return res.json(items);
      }

      const total = await Comment.countDocuments(filter);
      return res.json({
        items,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  commentsRouter.post('/', commentCreateLimiter, async (req, res) => {
    try {
      const articleId = Number.parseInt(req.body.articleId, 10);
      const parentIdRaw = hasOwn(req.body, 'parentId') ? Number.parseInt(req.body.parentId, 10) : null;
      const authorRaw = typeof req.body.author === 'string'
        ? req.body.author.replace(/\u0000/g, '').trim()
        : '';
      const textRaw = typeof req.body.text === 'string'
        ? req.body.text.replace(/\u0000/g, '').trim()
        : '';

      if (!Number.isInteger(articleId) || !authorRaw || !textRaw) {
        return res.status(400).json({ error: 'Invalid comment payload' });
      }

      if (authorRaw.length > COMMENT_AUTHOR_MAX_LEN) {
        return res.status(400).json({ error: `Author too long (max ${COMMENT_AUTHOR_MAX_LEN} characters)` });
      }

      if (textRaw.length > COMMENT_TEXT_MAX_LEN) {
        return res.status(400).json({ error: `Comment too long (max ${COMMENT_TEXT_MAX_LEN} characters)` });
      }

      const author = authorRaw;
      const text = textRaw;

      if (commentContainsBlockedTerms(`${author} ${text}`)) {
        return res.status(400).json({ error: 'Comment contains blocked terms' });
      }

      const articleExists = await Article.exists({ id: articleId, ...getPublishedFilter() });
      if (!articleExists) return res.status(404).json({ error: 'Article not found' });

      let parentId = null;
      if (parentIdRaw !== null) {
        if (!Number.isInteger(parentIdRaw)) {
          return res.status(400).json({ error: 'Invalid parentId' });
        }
        const parentComment = await Comment.findOne({
          id: parentIdRaw,
          articleId,
          approved: true,
        }).lean();
        if (!parentComment) {
          return res.status(400).json({ error: 'Parent comment not found or not approved' });
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
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  commentsRouter.post('/:id/reaction', commentReactionLimiter, async (req, res) => {
    try {
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
    } catch (e) {
      return res.status(500).json({ error: publicError(e) });
    }
  });

  commentsRouter.put('/:id', requireAuth, requirePermission('comments'), async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

      const updates = {};
      if (hasOwn(req.body, 'approved')) updates.approved = Boolean(req.body.approved);
      if (hasOwn(req.body, 'text')) {
        const textRaw = typeof req.body.text === 'string'
          ? req.body.text.replace(/\u0000/g, '').trim()
          : '';
        if (textRaw.length > COMMENT_TEXT_MAX_LEN) {
          return res.status(400).json({ error: `Comment too long (max ${COMMENT_TEXT_MAX_LEN} characters)` });
        }
        updates.text = textRaw;
      }

      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

      const item = await Comment.findOneAndUpdate({ id }, { $set: updates }, { new: true });
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
      }).catch(() => { });

      res.json(item.toJSON());
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  commentsRouter.delete('/:id', requireAuth, requirePermission('comments'), async (req, res) => {
    try {
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
      }).catch(() => { });

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  return commentsRouter;
}
