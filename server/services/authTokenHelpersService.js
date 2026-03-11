export function createAuthTokenHelpers({
  ACCESS_TOKEN_EXPIRES_IN,
  JWT_SECRET,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_TTL_DAYS,
  isProd,
  jwt,
  refreshTokenMaxAgeMs,
}) {
  function decodeTokenFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      if (decoded?.type && decoded.type !== 'access') return null;
      return decoded;
    } catch {
      return null;
    }
  }

  function parseCookies(req) {
    const raw = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
    if (!raw) return {};
    return raw
      .split(';')
      .map(item => item.trim())
      .filter(Boolean)
      .reduce((acc, part) => {
        const eqIdx = part.indexOf('=');
        if (eqIdx <= 0) return acc;
        const key = part.slice(0, eqIdx).trim();
        const valueRaw = part.slice(eqIdx + 1).trim();
        try {
          acc[key] = decodeURIComponent(valueRaw);
        } catch {
          acc[key] = valueRaw;
        }
        return acc;
      }, {});
  }

  function serializeCookie(name, value, options = {}) {
    const segments = [name + '=' + encodeURIComponent(value)];
    if (options.maxAge !== undefined) segments.push('Max-Age=' + Math.max(0, Math.floor(options.maxAge)));
    if (options.path) segments.push('Path=' + options.path);
    if (options.httpOnly) segments.push('HttpOnly');
    if (options.secure) segments.push('Secure');
    if (options.sameSite) segments.push('SameSite=' + options.sameSite);
    return segments.join('; ');
  }

  function clearCookieHeader(name, options = {}) {
    return serializeCookie(name, '', {
      ...options,
      maxAge: 0,
    });
  }

  function signAccessToken(user) {
    return jwt.sign(
      {
        type: 'access',
        userId: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
  }

  function signRefreshToken({ userId, jti }) {
    return jwt.sign(
      {
        type: 'refresh',
        userId,
        jti,
      },
      REFRESH_TOKEN_SECRET,
      { expiresIn: String(REFRESH_TOKEN_TTL_DAYS) + 'd' }
    );
  }

  function decodeRefreshToken(token) {
    if (!token || typeof token !== 'string') return null;
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
      if (decoded?.type !== 'refresh') return null;
      if (!Number.isInteger(Number.parseInt(decoded?.userId, 10))) return null;
      if (typeof decoded?.jti !== 'string' || decoded.jti.length < 12) return null;
      return decoded;
    } catch {
      return null;
    }
  }

  function setRefreshCookie(res, token) {
    const cookie = serializeCookie(REFRESH_COOKIE_NAME, token, {
      path: REFRESH_COOKIE_PATH,
      maxAge: Math.floor(refreshTokenMaxAgeMs / 1000),
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
    });
    res.setHeader('Set-Cookie', cookie);
  }

  function clearRefreshCookie(res) {
    const cookie = clearCookieHeader(REFRESH_COOKIE_NAME, {
      path: REFRESH_COOKIE_PATH,
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
    });
    res.setHeader('Set-Cookie', cookie);
  }

  return {
    clearCookieHeader,
    clearRefreshCookie,
    decodeRefreshToken,
    decodeTokenFromRequest,
    parseCookies,
    serializeCookie,
    setRefreshCookie,
    signAccessToken,
    signRefreshToken,
  };
}
