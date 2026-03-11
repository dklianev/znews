export function createAuthzService(deps) {
  const {
    decodeTokenFromRequest,
    hasPermissionForSection,
    publicError,
  } = deps;

  function requireAuth(req, res, next) {
    const decoded = decodeTokenFromRequest(req);
    if (!decoded) return res.status(401).json({ error: 'Authentication required' });
    req.user = decoded;
    return next();
  }

  function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    return next();
  }

  function requirePermission(section) {
    return async (req, res, next) => {
      try {
        if (await hasPermissionForSection(req.user, section)) return next();
        return res.status(403).json({ error: `Missing permission: ${section}` });
      } catch (error) {
        return res.status(500).json({ error: publicError(error) });
      }
    };
  }

  function requireAnyPermission(sections) {
    return async (req, res, next) => {
      try {
        for (const section of sections) {
          if (await hasPermissionForSection(req.user, section)) return next();
        }
        return res.status(403).json({ error: 'Missing permissions' });
      } catch (error) {
        return res.status(500).json({ error: publicError(error) });
      }
    };
  }

  return {
    requireAuth,
    requireAdmin,
    requirePermission,
    requireAnyPermission,
  };
}
