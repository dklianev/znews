import { asyncHandler } from '../services/expressAsyncService.js';

export function registerPermissionRoutes(app, deps) {
  const {
    DEFAULT_PERMISSION_DOCS,
    ensureDefaultPermissionDocs,
    hasPermissionForSection,
    normalizeText,
    Permission,
    publicError,
    requireAuth,
    requirePermission,
    sanitizePermissionMap,
  } = deps;

  function normalizeRoleKey(value) {
    return normalizeText(String(value || ''), 32).toLowerCase();
  }

  function isValidRoleKey(role) {
    return /^[a-z][a-z0-9_-]{1,31}$/.test(role);
  }

  app.post('/api/roles', requireAuth, requirePermission('permissions'), asyncHandler(async (req, res) => {
    const role = normalizeRoleKey(req.body?.role);
    if (!role) return res.status(400).json({ error: 'Invalid role' });
    if (!isValidRoleKey(role)) {
      return res.status(400).json({ error: 'Role must match /^[a-z][a-z0-9_-]{1,31}$/' });
    }

    if (role === 'admin' || Object.prototype.hasOwnProperty.call(DEFAULT_PERMISSION_DOCS, role)) {
      return res.status(400).json({ error: 'Reserved role' });
    }

    const permissions = sanitizePermissionMap({});
    await Permission.updateOne(
      { role },
      { $setOnInsert: { role, permissions } },
      { upsert: true }
    );

    const doc = await Permission.findOne({ role }).lean();
    if (!doc) return res.status(500).json({ error: 'Failed to ensure role' });
    delete doc._id;
    delete doc.__v;
    return res.json(doc);
  }));

  app.get('/api/permissions', requireAuth, asyncHandler(async (req, res) => {
    const canManage = req.user.role === 'admin' || await hasPermissionForSection(req.user, 'permissions');

    if (canManage) {
      await ensureDefaultPermissionDocs();
      const perms = await Permission.find().lean();
      perms.forEach((p) => { delete p._id; delete p.__v; });
      return res.json(perms);
    }

    const own = await Permission.findOne({ role: req.user.role }).lean();
    if (!own) return res.json([]);
    delete own._id;
    delete own.__v;
    return res.json([own]);
  }));

  app.put('/api/permissions/:role', requireAuth, requirePermission('permissions'), asyncHandler(async (req, res) => {
    const role = normalizeText(req.params.role, 32);
    if (!role) return res.status(400).json({ error: 'Invalid role' });

    const permissions = sanitizePermissionMap(req.body?.permissions);
    const perm = await Permission.findOneAndUpdate(
      { role },
      { $set: { permissions } },
      { new: true, upsert: true }
    );
    return res.json(perm.toJSON());
  }));
}
