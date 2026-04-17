export function createAccessHelpers({
  Counter,
  Permission,
  allocateNumericId,
  hasBuiltInRole,
  normalizeText,
  permissionCacheTtlMs = 5 * 60 * 1000,
  permissionCacheMaxEntries = 64,
}) {
  const permissionDocCache = new Map();

  function normalizeRole(role) {
    return normalizeText(role, 32).toLowerCase();
  }

  function readPermissionDocCache(role) {
    const cached = permissionDocCache.get(role);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
      permissionDocCache.delete(role);
      return undefined;
    }
    permissionDocCache.delete(role);
    permissionDocCache.set(role, cached);
    return cached.doc;
  }

  function evictOldestPermissionDocCacheEntry() {
    const oldestKey = permissionDocCache.keys().next().value;
    if (typeof oldestKey !== 'undefined') {
      permissionDocCache.delete(oldestKey);
    }
  }

  function writePermissionDocCache(role, doc) {
    if (!permissionDocCache.has(role) && permissionDocCache.size >= permissionCacheMaxEntries) {
      evictOldestPermissionDocCacheEntry();
    }
    permissionDocCache.delete(role);
    permissionDocCache.set(role, {
      doc,
      expiresAt: Date.now() + permissionCacheTtlMs,
    });
    return doc;
  }

  async function getPermissionDoc(role) {
    const normalized = normalizeRole(role);
    if (!normalized) return null;
    const cached = readPermissionDocCache(normalized);
    if (cached !== undefined) return cached;
    const rolePerm = await Permission.findOne({ role: normalized }).lean();
    return writePermissionDocCache(normalized, rolePerm || null);
  }

  function invalidatePermissionRoleCache(role) {
    const normalized = normalizeRole(role);
    if (!normalized) return;
    permissionDocCache.delete(normalized);
  }

  function invalidatePermissionCache() {
    permissionDocCache.clear();
  }

  async function nextNumericId(Model, counterKey = '') {
    return allocateNumericId(Model, Counter, counterKey);
  }

  async function hasPermissionForSection(user, section) {
    if (!user?.role) return false;
    if (user.role === 'admin') return true;
    const rolePerm = await getPermissionDoc(user.role);
    return Boolean(rolePerm?.permissions?.[section]);
  }

  async function isKnownRole(role) {
    const normalized = normalizeRole(role);
    if (!normalized) return false;
    if (normalized === 'admin') return true;
    if (hasBuiltInRole(normalized)) return true;
    return Boolean(await getPermissionDoc(normalized));
  }

  return {
    getPermissionDoc,
    hasPermissionForSection,
    invalidatePermissionCache,
    invalidatePermissionRoleCache,
    isKnownRole,
    nextNumericId,
  };
}
