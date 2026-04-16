
export function registerPermissionRoutes(app, deps) {
  const {
    DEFAULT_PERMISSION_DOCS,
    ensureDefaultPermissionDocs,
    getPermissionDoc,
    hasPermissionForSection,
    invalidatePermissionCache = () => {},
    invalidatePermissionRoleCache = () => {},
    normalizeText,
    Permission,
    publicError,
    requireAuth,
    requirePermission,
    sanitizePermissionMap,
  } = deps;
  const PERMISSIONS_LIST_TTL_MS = 5 * 60 * 1000;
  let permissionsListCache = null;
  let permissionsListExpiresAt = 0;
  let permissionsListInFlight = null;
  let permissionsListEpoch = 0;

  function clonePermissionPayload(value) {
    if (!value || typeof value !== 'object') return value ?? null;
    return {
      ...value,
      permissions: value.permissions && typeof value.permissions === 'object'
        ? { ...value.permissions }
        : value.permissions,
    };
  }

  function sanitizePermissionDoc(doc) {
    if (!doc || typeof doc !== 'object') return null;
    const next = clonePermissionPayload(doc);
    delete next._id;
    delete next.__v;
    return next;
  }

  function invalidatePermissionsListCache() {
    permissionsListCache = null;
    permissionsListExpiresAt = 0;
    permissionsListInFlight = null;
    permissionsListEpoch += 1;
  }

  async function getPermissionsList() {
    if (permissionsListCache && permissionsListExpiresAt > Date.now()) {
      return permissionsListCache.map((item) => clonePermissionPayload(item));
    }
    if (permissionsListInFlight) {
      return permissionsListInFlight.then((items) => items.map((item) => clonePermissionPayload(item)));
    }

    const startEpoch = permissionsListEpoch;
    const task = Promise.resolve()
      .then(async () => {
        await ensureDefaultPermissionDocs();
        const perms = await Permission.find().lean();
        const sanitized = (Array.isArray(perms) ? perms : [])
          .map((item) => sanitizePermissionDoc(item))
          .filter(Boolean);
        if (startEpoch === permissionsListEpoch) {
          permissionsListCache = sanitized;
          permissionsListExpiresAt = Date.now() + PERMISSIONS_LIST_TTL_MS;
        }
        return sanitized;
      })
      .finally(() => {
        if (permissionsListInFlight === task) {
          permissionsListInFlight = null;
        }
      });

    permissionsListInFlight = task;
    return task.then((items) => items.map((item) => clonePermissionPayload(item)));
  }

  async function getOwnPermissionDoc(role) {
    const loaded = typeof getPermissionDoc === 'function'
      ? await getPermissionDoc(role)
      : await Permission.findOne({ role }).lean();
    return sanitizePermissionDoc(loaded);
  }

  function invalidatePermissionCaches(role = '') {
    invalidatePermissionsListCache();
    invalidatePermissionCache();
    if (role) invalidatePermissionRoleCache(role);
  }

  function normalizeRoleKey(value) {
    return normalizeText(String(value || ''), 32).toLowerCase();
  }

  function isValidRoleKey(role) {
    return /^[a-z][a-z0-9_-]{1,31}$/.test(role);
  }

  app.post('/api/roles', requireAuth, requirePermission('permissions'), async (req, res) => {
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

    invalidatePermissionCaches(role);
    const doc = await getOwnPermissionDoc(role);
    if (!doc) return res.status(500).json({ error: 'Failed to ensure role' });
    return res.json(doc);
  });

  app.get('/api/permissions', requireAuth, async (req, res) => {
    const canManage = req.user.role === 'admin' || await hasPermissionForSection(req.user, 'permissions');

    if (canManage) {
      return res.json(await getPermissionsList());
    }

    const own = await getOwnPermissionDoc(req.user.role);
    if (!own) return res.json([]);
    return res.json([own]);
  });

  app.put('/api/permissions/:role', requireAuth, requirePermission('permissions'), async (req, res) => {
    const role = normalizeText(req.params.role, 32);
    if (!role) return res.status(400).json({ error: 'Invalid role' });

    const permissions = sanitizePermissionMap(req.body?.permissions);
    const perm = await Permission.findOneAndUpdate(
      { role },
      { $set: { permissions } },
      { returnDocument: 'after', upsert: true }
    );
    invalidatePermissionCaches(role);
    return res.json(sanitizePermissionDoc(perm?.toJSON?.() || perm));
  });
}
