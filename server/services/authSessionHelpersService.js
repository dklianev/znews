export function createAuthSessionHelpers({
  AuthSession,
  createHash,
  getClientIp,
  getClientUserAgent,
  randomUUID,
  refreshTokenMaxAgeMs,
  signAccessToken,
  signRefreshToken,
}) {
  async function createRefreshSession(req, userId) {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + refreshTokenMaxAgeMs);
    const userAgent = getClientUserAgent(req);
    const ipHash = createHash('sha256').update(getClientIp(req)).digest('hex');
    await AuthSession.create({
      jti,
      userId,
      userAgent,
      ipHash,
      expiresAt,
    });
    return {
      jti,
      expiresAt,
    };
  }

  async function rotateTokensForUser(req, user, previousJti = null) {
    if (previousJti) {
      await AuthSession.deleteOne({ jti: previousJti, userId: user.id });
    }
    const refreshSession = await createRefreshSession(req, user.id);
    const refreshToken = signRefreshToken({ userId: user.id, jti: refreshSession.jti });
    const accessToken = signAccessToken(user);
    return {
      accessToken,
      refreshToken,
    };
  }

  return {
    createRefreshSession,
    rotateTokensForUser,
  };
}
