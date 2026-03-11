import express from 'express';

export function createContactMessagesRouter(deps) {
  const {
    ContactMessage,
    contactMessageLimiter,
    hasOwn,
    nextNumericId,
    normalizeText,
    parsePositiveInt,
    publicError,
    requireAuth,
    requirePermission,
  } = deps;

  const contactMessagesRouter = express.Router();

  function normalizeEmail(value) {
    return normalizeText(String(value || ''), 120).toLowerCase();
  }

  function isValidEmail(email) {
    if (!email) return false;
    if (email.length < 5 || email.length > 120) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  contactMessagesRouter.post('/', contactMessageLimiter, async (req, res) => {
    try {
      const name = normalizeText(req.body?.name, 80);
      const email = normalizeEmail(req.body?.email);
      const message = normalizeText(req.body?.message, 4000);

      if (!name || !email || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email' });
      }

      const id = await nextNumericId(ContactMessage);
      const item = await ContactMessage.create({
        id,
        name,
        email,
        message,
        status: 'new',
        createdAt: new Date(),
      });

      return res.json({ ok: true, id: item.id });
    } catch (e) {
      return res.status(500).json({ error: publicError(e) });
    }
  });

  contactMessagesRouter.get('/', requireAuth, requirePermission('contact'), async (req, res) => {
    try {
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

      items.forEach((i) => { delete i._id; delete i.__v; });
      return res.json(items);
    } catch (e) {
      return res.status(500).json({ error: publicError(e) });
    }
  });

  contactMessagesRouter.put('/:id', requireAuth, requirePermission('contact'), async (req, res) => {
    try {
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

      const updated = await ContactMessage.findOneAndUpdate({ id }, { $set: data }, { new: true }).lean();
      if (!updated) return res.status(404).json({ error: 'Not found' });
      delete updated._id;
      delete updated.__v;
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: publicError(e) });
    }
  });

  contactMessagesRouter.delete('/:id', requireAuth, requirePermission('contact'), async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
      const result = await ContactMessage.deleteOne({ id });
      if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: publicError(e) });
    }
  });

  return contactMessagesRouter;
}
