import express from 'express';

export function createContactMessagesRouter(deps) {
  const {
    ContactMessage,
    contactMessageLimiter,
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

  contactMessagesRouter.post('/', contactMessageLimiter, async (req, res) => {
    const name = normalizeText(req.body?.name, 80);
    const phone = normalizePhone(req.body?.phone);
    const email = normalizeEmail(req.body?.email);
    const message = normalizeText(req.body?.message, 4000);

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

    const id = await nextNumericId(ContactMessage);
    const item = await ContactMessage.create({
      id,
      name,
      phone,
      email,
      message,
      status: 'new',
      createdAt: new Date(),
    });

    return res.json({ ok: true, id: item.id });
  });

  contactMessagesRouter.get('/', requireAuth, requirePermission('contact'), async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 200, { min: 1, max: 200 });
    const status = normalizeText(req.query.status, 20);
    const filter = {};
    if (status && ['new', 'read', 'archived'].includes(status)) {
      filter.status = status;
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

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const updated = await ContactMessage.findOneAndUpdate({ id }, { $set: data }, { returnDocument: 'after' }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    delete updated._id;
    delete updated.__v;
    return res.json(updated);
  });

  contactMessagesRouter.delete('/:id', requireAuth, requirePermission('contact'), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await ContactMessage.deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  });

  return contactMessagesRouter;
}
