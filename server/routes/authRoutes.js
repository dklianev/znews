import { asyncHandler } from '../services/expressAsyncService.js';

async function findUserByNormalizedUsername(User, normalizeText, username) {
  const exactUser = await User.findOne({ username }).lean();
  if (exactUser) return exactUser;
  if (typeof User.find !== 'function') return null;

  const legacyCandidates = await User.find(
    { username: { $exists: true, $ne: null } },
    { id: 1, username: 1, role: 1, name: 1, password: 1 }
  ).lean();

  return (Array.isArray(legacyCandidates) ? legacyCandidates : []).find((candidate) => {
    return normalizeText(candidate?.username, 40).toLowerCase() === username;
  }) || null;
}

export function registerAuthRoutes(app, deps) {
  const {
    accessTokenMaxAgeMs,
    authLimiter,
    AuthSession,
    bcrypt,
    clearRefreshCookie,
    decodeRefreshToken,
    normalizeText,
    parseCookies,
    REFRESH_COOKIE_NAME,
    rotateTokensForUser,
    setRefreshCookie,
    User,
  } = deps;

  app.post('/api/auth/login', authLimiter, asyncHandler(async (req, res) => {
    const username = normalizeText(req.body.username, 40).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || !password) return res.status(401).json({ error: 'Invalid credentials' });

    const user = await findUserByNormalizedUsername(User, normalizeText, username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isBcryptHash = user.password && user.password.startsWith('$2');
    let isMatch = false;
    if (isBcryptHash) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
      if (isMatch) {
        const hashed = await bcrypt.hash(password, 10);
        await User.updateOne({ id: user.id }, { $set: { password: hashed } });
      }
    }
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const { accessToken, refreshToken } = await rotateTokensForUser(req, user);
    setRefreshCookie(res, refreshToken);

    return res.json({
      userId: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      token: accessToken,
      accessTokenExpiresIn: Math.floor(accessTokenMaxAgeMs / 1000),
    });
  }));

  app.post('/api/auth/refresh', asyncHandler(async (req, res) => {
    try {
      const cookies = parseCookies(req);
      const refreshToken = cookies[REFRESH_COOKIE_NAME];
      if (!refreshToken) return res.status(204).end();
      const decoded = decodeRefreshToken(refreshToken);
      if (!decoded) {
        clearRefreshCookie(res);
        return res.status(204).end();
      }

      const userId = Number.parseInt(decoded.userId, 10);
      const session = await AuthSession.findOne({
        jti: decoded.jti,
        userId,
        expiresAt: { $gt: new Date() },
      }).lean();
      if (!session) {
        clearRefreshCookie(res);
        return res.status(204).end();
      }

      const user = await User.findOne({ id: userId }).lean();
      if (!user) {
        await AuthSession.deleteOne({ jti: decoded.jti });
        clearRefreshCookie(res);
        return res.status(204).end();
      }

      const { accessToken, refreshToken: nextRefreshToken } = await rotateTokensForUser(req, user, decoded.jti);
      setRefreshCookie(res, nextRefreshToken);

      return res.json({
        userId: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        token: accessToken,
        accessTokenExpiresIn: Math.floor(accessTokenMaxAgeMs / 1000),
      });
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  }));

  app.post('/api/auth/logout', asyncHandler(async (req, res) => {
    try {
      const cookies = parseCookies(req);
      const refreshToken = cookies[REFRESH_COOKIE_NAME];
      const decoded = decodeRefreshToken(refreshToken);
      if (decoded) {
        const userId = Number.parseInt(decoded.userId, 10);
        await AuthSession.deleteOne({ jti: decoded.jti, userId });
      }
      clearRefreshCookie(res);
      return res.json({ ok: true });
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  }));
}
