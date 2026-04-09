import mongoose from 'mongoose';

export function registerOpsRoutes(app, deps) {
  const {
    AuditLog,
    normalizeText,
    parsePositiveInt,
    publicError,
    requireAdmin,
    requireAuth,
    requirePermission,
    streamBackupExport,
  } = deps;

  function parseAuditLogCursor(value) {
    const raw = normalizeText(value, 120);
    if (!raw) return null;
    const parts = raw.split(':');
    if (parts.length !== 2) return null;
    const ts = Number(parts[0]);
    const idRaw = parts[1];
    if (!Number.isFinite(ts) || ts <= 0) return null;
    if (!mongoose.Types.ObjectId.isValid(idRaw)) return null;
    return {
      timestamp: new Date(ts),
      id: new mongoose.Types.ObjectId(idRaw),
    };
  }

  function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  app.get('/api/audit-log', requireAuth, requirePermission('permissions'), async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 200, { min: 1, max: 200 });
    const cursor = parseAuditLogCursor(req.query.cursor);
    const resource = normalizeText(req.query.resource, 80).toLowerCase();
    const action = normalizeText(req.query.action, 20).toLowerCase();
    const query = normalizeText(req.query.q, 120);
    const resourceId = Number.parseInt(normalizeText(req.query.resourceId, 32), 10);
    const filter = {};

    if (resource && resource !== 'all') {
      filter.resource = resource;
    }

    if (Number.isInteger(resourceId) && resourceId > 0) {
      filter.resourceId = resourceId;
    }

    if (['create', 'update', 'delete'].includes(action)) {
      filter.action = action;
    }

    if (query) {
      const regex = new RegExp(escapeRegex(query), 'i');
      const numericQuery = Number.parseInt(query, 10);
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { user: regex },
            { details: regex },
            { resource: regex },
            ...(Number.isInteger(numericQuery) ? [{ resourceId: numericQuery }] : []),
          ],
        },
      ];
    }

    if (cursor) {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { timestamp: { $lt: cursor.timestamp } },
            { timestamp: cursor.timestamp, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }

    const items = await AuditLog.find(filter)
      .sort({ timestamp: -1, _id: -1 })
      .limit(limit)
      .lean();

    const last = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor = items.length === limit && last
      ? `${new Date(last.timestamp).getTime()}:${String(last._id)}`
      : null;

    items.forEach((item) => {
      delete item._id;
      delete item.__v;
    });
    res.json({ items, nextCursor });
  });

  app.get('/api/backup', requireAuth, requireAdmin, async (_req, res) => {
    try {
      await streamBackupExport(res);
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ error: publicError(e) });
        return;
      }
      res.destroy(e);
    }
  });

  app.post('/api/reset', requireAuth, requireAdmin, async (_req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_RESET !== 'true') {
      return res.status(403).json({ error: 'Production reset is disabled.' });
    }
    const { seedAll } = await import('../seed.js');
    await seedAll();
    res.json({ ok: true });
  });
}
