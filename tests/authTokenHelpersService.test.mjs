import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createAuthTokenHelpers } from '../server/services/authTokenHelpersService.js';

describe('authTokenHelpersService', () => {
  it('covers legacy scenarios', async () => {
      const helpers = createAuthTokenHelpers({
        ACCESS_TOKEN_EXPIRES_IN: '15m',
        JWT_SECRET: 'test-access-secret-1234567890',
        REFRESH_COOKIE_NAME: 'zn_refresh',
        REFRESH_COOKIE_PATH: '/api/auth',
        REFRESH_TOKEN_SECRET: 'test-refresh-secret-1234567890',
        REFRESH_TOKEN_TTL_DAYS: 14,
        isProd: true,
        jwt,
        refreshTokenMaxAgeMs: 14 * 24 * 60 * 60 * 1000,
      });
    
      assert.deepEqual(helpers.parseCookies({ headers: {} }), {});
      assert.deepEqual(
        helpers.parseCookies({ headers: { cookie: 'foo=bar; encoded=hello%20world; bad=%E0%A4%A' } }),
        { foo: 'bar', encoded: 'hello world', bad: '%E0%A4%A' }
      );
    
      assert.equal(
        helpers.serializeCookie('session', 'abc 123', { maxAge: 60.9, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }),
        'session=abc%20123; Max-Age=60; Path=/; HttpOnly; Secure; SameSite=Lax'
      );
      assert.equal(
        helpers.clearCookieHeader('session', { path: '/', httpOnly: true }),
        'session=; Max-Age=0; Path=/; HttpOnly'
      );
    
      const accessToken = helpers.signAccessToken({ id: 7, username: 'user', role: 'editor', name: 'Editor' });
      const decodedAccess = helpers.decodeTokenFromRequest({ headers: { authorization: 'Bearer ' + accessToken } });
      assert.equal(decodedAccess.userId, 7);
      assert.equal(decodedAccess.role, 'editor');
      assert.equal(helpers.decodeTokenFromRequest({ headers: { authorization: 'Basic nope' } }), null);
    
      const refreshToken = helpers.signRefreshToken({ userId: 7, jti: 'refresh-token-12345' });
      const decodedRefresh = helpers.decodeRefreshToken(refreshToken);
      assert.equal(decodedRefresh.userId, 7);
      assert.equal(decodedRefresh.jti, 'refresh-token-12345');
      assert.equal(helpers.decodeTokenFromRequest({ headers: { authorization: 'Bearer ' + refreshToken } }), null);
      assert.equal(helpers.decodeRefreshToken(accessToken), null);
      assert.equal(helpers.decodeRefreshToken('broken.token'), null);
    
      const refreshHeaders = [];
      const res = {
        setHeader(name, value) {
          refreshHeaders.push({ name, value });
        },
      };
      helpers.setRefreshCookie(res, refreshToken);
      helpers.clearRefreshCookie(res);
      assert.equal(refreshHeaders.length, 2);
      assert.equal(refreshHeaders[0].name, 'Set-Cookie');
      assert.match(refreshHeaders[0].value, /^zn_refresh=/);
      assert.match(refreshHeaders[0].value, /Path=\/api\/auth/);
      assert.match(refreshHeaders[0].value, /HttpOnly/);
      assert.match(refreshHeaders[0].value, /Secure/);
      assert.match(refreshHeaders[0].value, /SameSite=Lax/);
      assert.equal(refreshHeaders[1].value, 'zn_refresh=; Max-Age=0; Path=/api/auth; HttpOnly; Secure; SameSite=Lax');
  });
});
