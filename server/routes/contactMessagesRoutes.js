import express from 'express';

export function createContactMessagesRouter(deps) {
  const {
    AuditLog,
    Article,
    ContactMessage,
    contactMessageLimiter,
    getPublishedFilter,
    hasOwn,
    nextNumericId,
    normalizeText,
    parsePositiveInt,
    requireAuth,
    requirePermission,
  } = deps;

  const contactMessagesRouter = express.Router();

  function normalizeEmail(value) {
    return normalizeText(String(value || ''), 120).toLowerCase();
  }

  function normalizePhone(value) {
    return normalizeText(String(value || ''), 30);
  }

  function normalizeAssignedEditor(value) {
    return normalizeText(String(value || ''), 80);
  }

  function normalizeRequestKind(value) {
    const normalized = normalizeText(String(value || 'general'), 40).toLowerCase();
    if (['general', 'correction', 'right_of_reply'].includes(normalized)) return normalized;
    return '';
  }

  function normalizeRelatedArticleId(rawValue) {
    if (rawValue == null || rawValue === '') return null;
    const parsed = Number.parseInt(String(rawValue).trim(), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
  }

  function normalizeRelatedArticleTitle(value) {
    return normalizeText(String(value || ''), 220);
  }

  function normalizeResponseArticleStatus(value) {
    const normalized = normalizeText(String(value || ''), 20).toLowerCase();
    if (['', 'draft', 'published', 'archived'].includes(normalized)) return normalized;
    return '';
  }

  function normalizeTags(rawValue) {
    const source = Array.isArray(rawValue)
      ? rawValue
      : typeof rawValue === 'string'
        ? rawValue.split(',')
        : [];

    const uniqueTags = [];
    source.forEach((entry) => {
      const normalized = normalizeText(String(entry || ''), 24);
      if (!normalized) return;
      if (uniqueTags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) return;
      uniqueTags.push(normalized);
    });

    return uniqueTags.slice(0, 8);
  }

  function normalizeDueAt(rawValue) {
    if (rawValue == null || rawValue === '') return null;
    const normalized = String(rawValue).trim();
    if (!normalized) return null;

    const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
    const parsed = new Date(dateOnlyMatch ? `${normalized}T23:59:59.999` : normalized);
    if (!Number.isFinite(parsed.getTime())) return undefined;
    return parsed;
  }

  function getActorName(req) {
    const normalized = normalizeText(String(req?.user?.name || req?.user?.username || ''), 80);
    return normalized || 'Редактор';
  }

  function buildContactAuditDetails(update) {
    const parts = [];
    if (typeof update.status === 'string' && update.status) parts.push(`status:${update.status}`);
    if (typeof update.assignedEditor === 'string' && update.assignedEditor) parts.push(`editor:${update.assignedEditor}`);
    if (typeof update.priority === 'string' && update.priority) parts.push(`priority:${update.priority}`);
    if (typeof update.requestKind === 'string' && update.requestKind) parts.push(`kind:${update.requestKind}`);
    if (Number.isInteger(update.relatedArticleId)) parts.push(`article:${update.relatedArticleId}`);
    if (Number.isInteger(update.responseArticleId)) parts.push(`responseArticle:${update.responseArticleId}`);
    if (typeof update.responseArticleStatus === 'string' && update.responseArticleStatus) {
      parts.push(`responseStatus:${update.responseArticleStatus}`);
    }
    if (Array.isArray(update.tags) && update.tags.length > 0) parts.push(`tags:${update.tags.join('|')}`);
    if (update.dueAt instanceof Date && Number.isFinite(update.dueAt.getTime())) {
      parts.push(`due:${update.dueAt.toISOString().slice(0, 10)}`);
    }
    return parts.join(' | ') || 'update';
  }

  function isValidEmail(email) {
    if (!email) return false;
    if (email.length < 5 || email.length > 120) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    if (!phone) return false;
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 5 && phone.length <= 30;
  }

  function isValidPriority(priority) {
    return ['low', 'normal', 'high', 'urgent'].includes(priority);
  }

  contactMessagesRouter.get('/right-of-reply/:articleId', contactMessageLimiter, async (req, res) => {
    try {
      const articleId = Number.parseInt(req.params.articleId, 10);
      if (!Number.isInteger(articleId) || articleId <= 0) {
        return res.status(400).json({ error: 'Invalid article id' });
      }

      const requestRows = await ContactMessage.find({
        requestKind: 'right_of_reply',
        relatedArticleId: articleId,
        responseArticleStatus: 'published',
      })
        .sort({ lastActionAt: -1, createdAt: -1, id: -1 })
        .limit(6)
        .select({ _id: 0, id: 1, responseArticleId: 1, createdAt: 1 })
        .lean();

      const responseIds = [...new Set(
        (Array.isArray(requestRows) ? requestRows : [])
          .map((row) => Number.parseInt(String(row?.responseArticleId || ''), 10))
          .filter((value) => Number.isInteger(value) && value > 0),
      )];

      if (responseIds.length === 0 || !Article?.find) {
        return res.json([]);
      }

      const publishedFilter = typeof getPublishedFilter === 'function'
        ? getPublishedFilter()
        : { status: 'published' };
      const responseArticles = await Article.find({
        id: { $in: responseIds },
        ...publishedFilter,
      })
        .select({
          _id: 0,
          __v: 0,
          id: 1,
          title: 1,
          excerpt: 1,
          category: 1,
          date: 1,
          image: 1,
          cardSticker: 1,
          shareBadge: 1,
        })
        .lean();

      const responseArticleMap = new Map(
        (Array.isArray(responseArticles) ? responseArticles : [])
          .filter((item) => Number.isInteger(Number(item?.id)))
          .map((item) => [Number(item.id), item]),
      );
      const usedArticleIds = new Set();
      const items = [];

      (Array.isArray(requestRows) ? requestRows : []).forEach((row) => {
        const responseArticleId = Number.parseInt(String(row?.responseArticleId || ''), 10);
        if (!Number.isInteger(responseArticleId) || usedArticleIds.has(responseArticleId)) return;
        const article = responseArticleMap.get(responseArticleId);
        if (!article) return;
        usedArticleIds.add(responseArticleId);
        items.push({
          ...article,
          responseRequestId: Number.parseInt(String(row?.id || ''), 10) || null,
        });
      });

      return res.json(items);
    } catch (error) {
      console.error('[contactMessages] right-of-reply lookup failed:', error);
      return res.status(500).json({ error: 'Failed to load right-of-reply responses' });
    }
  });

  contactMessagesRouter.post('/', contactMessageLimiter, async (req, res) => {
    const name = normalizeText(req.body?.name, 80);
    const phone = normalizePhone(req.body?.phone);
    const email = normalizeEmail(req.body?.email);
    const message = normalizeText(req.body?.message, 4000);
    const requestKind = normalizeRequestKind(req.body?.requestKind);
    const relatedArticleId = normalizeRelatedArticleId(req.body?.relatedArticleId);
    const relatedArticleTitle = normalizeRelatedArticleTitle(req.body?.relatedArticleTitle);

    if (!requestKind) {
      return res.status(400).json({
        error: 'Невалиден тип заявка',
        fieldErrors: {
          requestKind: 'Избери валиден тип заявка.',
        },
      });
    }

    if (!name || !phone || !message) {
      return res.status(400).json({
        error: '\u041b\u0438\u043f\u0441\u0432\u0430\u0442 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u0438 \u043f\u043e\u043b\u0435\u0442\u0430',
        fieldErrors: {
          ...(!name ? { name: '\u0418\u043c\u0435\u0442\u043e \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u043e.' } : {}),
          ...(!phone ? { phone: '\u0422\u0435\u043b\u0435\u0444\u043e\u043d\u044a\u0442 \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u0435\u043d.' } : {}),
          ...(!message ? { message: '\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435\u0442\u043e \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u043e.' } : {}),
        },
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        error: '\u041d\u0435\u0432\u0430\u043b\u0438\u0434\u0435\u043d \u0442\u0435\u043b\u0435\u0444\u043e\u043d',
        fieldErrors: {
          phone: '\u0412\u044a\u0432\u0435\u0434\u0438 \u0432\u0430\u043b\u0438\u0434\u0435\u043d \u0442\u0435\u043b\u0435\u0444\u043e\u043d.',
        },
      });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        error: '\u041d\u0435\u0432\u0430\u043b\u0438\u0434\u0435\u043d \u0438\u043c\u0435\u0439\u043b',
        fieldErrors: {
          email: '\u0412\u044a\u0432\u0435\u0434\u0438 \u0432\u0430\u043b\u0438\u0434\u0435\u043d \u0438\u043c\u0435\u0439\u043b \u0430\u0434\u0440\u0435\u0441.',
        },
      });
    }

    if (typeof relatedArticleId === 'undefined') {
      return res.status(400).json({
        error: 'Невалидна свързана статия',
        fieldErrors: {
          relatedArticleId: 'Избери валидна публикация.',
        },
      });
    }

    if (requestKind === 'right_of_reply' && !Number.isInteger(relatedArticleId)) {
      return res.status(400).json({
        error: 'Липсва свързана публикация',
        fieldErrors: {
          relatedArticleId: 'Правото на отговор трябва да е свързано с публикация.',
        },
      });
    }

    if (Number.isInteger(relatedArticleId) && Article?.exists) {
      const articleExists = await Article.exists({ id: relatedArticleId });
      if (!articleExists) {
        return res.status(400).json({
          error: 'Публикацията не съществува',
          fieldErrors: {
            relatedArticleId: 'Избраната публикация не е намерена.',
          },
        });
      }
    }

    const id = await nextNumericId(ContactMessage);
    const item = await ContactMessage.create({
      id,
      name,
      phone,
      email,
      message,
      requestKind,
      relatedArticleId,
      relatedArticleTitle,
      status: 'new',
      createdAt: new Date(),
    });

    return res.json({ ok: true, id: item.id });
  });

  contactMessagesRouter.get('/', requireAuth, requirePermission('contact'), async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 200, { min: 1, max: 200 });
    const status = normalizeText(req.query.status, 20);
    const requestKind = normalizeRequestKind(req.query.requestKind || 'general');
    const filter = {};
    if (status && ['new', 'read', 'archived'].includes(status)) {
      filter.status = status;
    }
    if (req.query.requestKind && requestKind) {
      filter.requestKind = requestKind;
    }

    const items = await ContactMessage.find(filter)
      .sort({ createdAt: -1, id: -1 })
      .limit(limit)
      .lean();

    items.forEach((item) => {
      delete item._id;
      delete item.__v;
    });
    return res.json(items);
  });

  contactMessagesRouter.put('/:id', requireAuth, requirePermission('contact'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const data = {};
    if (hasOwn(req.body, 'status')) {
      const nextStatus = normalizeText(req.body.status, 20);
      if (!['new', 'read', 'archived'].includes(nextStatus)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      data.status = nextStatus;
    }

    if (hasOwn(req.body, 'assignedEditor')) {
      data.assignedEditor = normalizeAssignedEditor(req.body.assignedEditor);
    }

    if (hasOwn(req.body, 'priority')) {
      const nextPriority = normalizeText(req.body.priority, 20).toLowerCase();
      if (!isValidPriority(nextPriority)) {
        return res.status(400).json({ error: 'Invalid priority' });
      }
      data.priority = nextPriority;
    }

    if (hasOwn(req.body, 'tags')) {
      data.tags = normalizeTags(req.body.tags);
    }

    if (hasOwn(req.body, 'dueAt')) {
      const normalizedDueAt = normalizeDueAt(req.body.dueAt);
      if (typeof normalizedDueAt === 'undefined') {
        return res.status(400).json({ error: 'Invalid due date' });
      }
      data.dueAt = normalizedDueAt;
    }

    if (hasOwn(req.body, 'requestKind')) {
      const nextRequestKind = normalizeRequestKind(req.body.requestKind);
      if (!nextRequestKind) {
        return res.status(400).json({ error: 'Invalid request kind' });
      }
      data.requestKind = nextRequestKind;
    }

    if (hasOwn(req.body, 'relatedArticleId')) {
      const normalizedRelatedArticleId = normalizeRelatedArticleId(req.body.relatedArticleId);
      if (typeof normalizedRelatedArticleId === 'undefined') {
        return res.status(400).json({ error: 'Invalid related article id' });
      }
      data.relatedArticleId = normalizedRelatedArticleId;

      if (Number.isInteger(normalizedRelatedArticleId) && Article?.exists) {
        const articleExists = await Article.exists({ id: normalizedRelatedArticleId });
        if (!articleExists) {
          return res.status(400).json({ error: 'Related article not found' });
        }
      }
    }

    if (hasOwn(req.body, 'relatedArticleTitle')) {
      data.relatedArticleTitle = normalizeRelatedArticleTitle(req.body.relatedArticleTitle);
    }

    if (hasOwn(req.body, 'responseArticleId')) {
      const normalizedResponseArticleId = normalizeRelatedArticleId(req.body.responseArticleId);
      if (typeof normalizedResponseArticleId === 'undefined') {
        return res.status(400).json({ error: 'Invalid response article id' });
      }
      data.responseArticleId = normalizedResponseArticleId;
    }

    if (hasOwn(req.body, 'responseArticleStatus')) {
      const nextResponseArticleStatus = normalizeResponseArticleStatus(req.body.responseArticleStatus);
      if (String(req.body.responseArticleStatus || '').trim() && !nextResponseArticleStatus) {
        return res.status(400).json({ error: 'Invalid response article status' });
      }
      data.responseArticleStatus = nextResponseArticleStatus;
    }

    const effectiveRequestKind = data.requestKind ?? normalizeRequestKind(req.body?.requestKind || '');
    const relatedArticleIdForValidation = hasOwn(data, 'relatedArticleId') ? data.relatedArticleId : undefined;
    if (effectiveRequestKind === 'right_of_reply' && relatedArticleIdForValidation === null) {
      return res.status(400).json({ error: 'Right of reply requires related article' });
    }

    const responseArticleIdForValidation = hasOwn(data, 'responseArticleId') ? data.responseArticleId : undefined;
    if (responseArticleIdForValidation === null) {
      data.responseArticleStatus = '';
    }
    if (typeof responseArticleIdForValidation === 'undefined' && data.responseArticleStatus) {
      return res.status(400).json({ error: 'Response article status requires response article id' });
    }
    if (responseArticleIdForValidation === null && data.responseArticleStatus) {
      return res.status(400).json({ error: 'Response article status requires response article id' });
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    data.lastActionAt = new Date();
    data.lastActionBy = getActorName(req);

    const updated = await ContactMessage.findOneAndUpdate({ id }, { $set: data }, { returnDocument: 'after' }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });

    AuditLog?.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'contact-messages',
      resourceId: id,
      details: buildContactAuditDetails(data),
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    delete updated._id;
    delete updated.__v;
    return res.json(updated);
  });

  contactMessagesRouter.delete('/:id', requireAuth, requirePermission('contact'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await ContactMessage.deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });

    AuditLog?.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'contact-messages',
      resourceId: id,
      details: '',
    }).catch((err) => console.error('CRITICAL: Audit log write failed:', err.message));

    return res.json({ ok: true });
  });

  return contactMessagesRouter;
}
