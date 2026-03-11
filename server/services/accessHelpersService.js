export function createAccessHelpers({
  Counter,
  Permission,
  allocateNumericId,
  hasBuiltInRole,
  normalizeText,
}) {
  async function nextNumericId(Model, counterKey = '') {
    return allocateNumericId(Model, Counter, counterKey);
  }

  async function hasPermissionForSection(user, section) {
    if (!user?.role) return false;
    if (user.role === 'admin') return true;
    const rolePerm = await Permission.findOne({ role: user.role }).lean();
    return Boolean(rolePerm?.permissions?.[section]);
  }

  async function isKnownRole(role) {
    const normalized = normalizeText(role, 32);
    if (!normalized) return false;
    if (normalized === 'admin') return true;
    if (hasBuiltInRole(normalized)) return true;
    return Boolean(await Permission.exists({ role: normalized }));
  }

  return {
    hasPermissionForSection,
    isKnownRole,
    nextNumericId,
  };
}
