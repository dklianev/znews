import assert from 'node:assert/strict';
import { registerAuthRoutes } from '../server/routes/authRoutes.js';

function createMockApp() {
  const routes = new Map();
  return {
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers);
    },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

async function runHandlers(handlers, req, res) {
  let index = 0;
  const next = async () => {
    const handler = handlers[index++];
    if (!handler) return undefined;
    if (handler.length >= 3) {
      return handler(req, res, () => next());
    }
    return handler(req, res);
  };
  return next();
}

function createLeanUser(user, queryAssert = null) {
  return {
    findOne(query) {
      if (queryAssert) queryAssert(query);
      return {
        lean: async () => user,
      };
    },
  };
}

export async function runAuthRoutesTests() {
  {
    const app = createMockApp();
    const refreshCookieTokens = [];
    const compared = [];

    registerAuthRoutes(app, {
      accessTokenMaxAgeMs: 15 * 60 * 1000,
      authLimiter: (_req, _res, next) => next(),
      AuthSession: { deleteOne: async () => {} },
      bcrypt: {
        async compare(password, hash) {
          compared.push([password, hash]);
          return password === 'secret' && hash === '$2hash';
        },
        async hash() {
          throw new Error('hash should not be called for bcrypt users');
        },
      },
      clearRefreshCookie() {},
      decodeRefreshToken() {
        return null;
      },
      normalizeText(value) {
        return typeof value === 'string' ? value.trim() : '';
      },
      parseCookies() {
        return {};
      },
      publicError(error) {
        return error.message;
      },
      REFRESH_COOKIE_NAME: 'refresh_token',
      async rotateTokensForUser(_req, user) {
        return {
          accessToken: `access-${user.id}`,
          refreshToken: `refresh-${user.id}`,
        };
      },
      setRefreshCookie(_res, token) {
        refreshCookieTokens.push(token);
      },
      User: {
        ...createLeanUser({
          id: 7,
          username: 'admin',
          role: 'admin',
          name: 'Admin',
          password: '$2hash',
        }, (query) => {
          assert.deepEqual(query, { username: 'admin' });
        }),
        async updateOne() {
          throw new Error('updateOne should not be called for bcrypt users');
        },
      },
    });

    const handlers = app.routes.get('POST /api/auth/login');
    const res = createResponse();
    await runHandlers(handlers, { body: { username: ' admin ', password: 'secret' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(compared, [['secret', '$2hash']]);
    assert.deepEqual(refreshCookieTokens, ['refresh-7']);
    assert.deepEqual(res.body, {
      userId: 7,
      username: 'admin',
      role: 'admin',
      name: 'Admin',
      token: 'access-7',
      accessTokenExpiresIn: 900,
    });
  }

  {
    const app = createMockApp();
    const compared = [];

    registerAuthRoutes(app, {
      accessTokenMaxAgeMs: 15 * 60 * 1000,
      authLimiter: (_req, _res, next) => next(),
      AuthSession: { deleteOne: async () => {} },
      bcrypt: {
        async compare(password, hash) {
          compared.push([password, hash]);
          return password === 'secret' && hash === '$2legacy';
        },
        async hash() {
          throw new Error('hash should not be called for bcrypt users');
        },
      },
      clearRefreshCookie() {},
      decodeRefreshToken() {
        return null;
      },
      normalizeText(value) {
        return typeof value === 'string' ? value.trim() : '';
      },
      parseCookies() {
        return {};
      },
      REFRESH_COOKIE_NAME: 'refresh_token',
      async rotateTokensForUser(_req, user) {
        return {
          accessToken: `access-${user.id}`,
          refreshToken: `refresh-${user.id}`,
        };
      },
      setRefreshCookie() {},
      User: {
        findOne(query) {
          assert.deepEqual(query, { username: 'admin' });
          return {
            lean: async () => null,
          };
        },
        find(query, projection) {
          assert.deepEqual(query, { username: { $exists: true, $ne: null } });
          assert.deepEqual(projection, { id: 1, username: 1, role: 1, name: 1, password: 1 });
          return {
            lean: async () => [{
              id: 8,
              username: ' Admin ',
              role: 'admin',
              name: 'Legacy Admin',
              password: '$2legacy',
            }],
          };
        },
      },
    });

    const handlers = app.routes.get('POST /api/auth/login');
    const res = createResponse();
    await runHandlers(handlers, { body: { username: 'admin', password: 'secret' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(compared, [['secret', '$2legacy']]);
    assert.equal(res.body?.userId, 8);
  }

  // Plaintext (non-bcrypt) passwords must be rejected — no auto-upgrade.
  {
    const app = createMockApp();

    registerAuthRoutes(app, {
      accessTokenMaxAgeMs: 10_000,
      authLimiter: (_req, _res, next) => next(),
      AuthSession: { deleteOne: async () => {} },
      bcrypt: {
        async compare() {
          throw new Error('compare should not be called for plain-text users');
        },
        async hash() {
          throw new Error('hash should not be called');
        },
      },
      clearRefreshCookie() {},
      decodeRefreshToken() {
        return null;
      },
      normalizeText(value) {
        return typeof value === 'string' ? value.trim() : '';
      },
      parseCookies() {
        return {};
      },
      publicError(error) {
        return error.message;
      },
      REFRESH_COOKIE_NAME: 'refresh_token',
      async rotateTokensForUser() {
        throw new Error('should not rotate tokens');
      },
      setRefreshCookie() {},
      User: {
        ...createLeanUser({
          id: 3,
          username: 'editor',
          role: 'editor',
          name: 'Editor',
          password: 'legacy-pass',
        }),
      },
    });

    const handlers = app.routes.get('POST /api/auth/login');
    const res = createResponse();
    await runHandlers(handlers, { body: { username: 'editor', password: 'legacy-pass' } }, res);

    assert.equal(res.statusCode, 401);
  }

  {
    const app = createMockApp();
    let cleared = 0;

    registerAuthRoutes(app, {
      accessTokenMaxAgeMs: 10_000,
      authLimiter: (_req, _res, next) => next(),
      AuthSession: { deleteOne: async () => { throw new Error('should not delete sessions'); } },
      bcrypt: { compare: async () => false, hash: async () => '' },
      clearRefreshCookie() { cleared += 1; },
      decodeRefreshToken() {
        return null;
      },
      normalizeText(value) {
        return typeof value === 'string' ? value.trim() : '';
      },
      parseCookies() {
        return {};
      },
      publicError(error) {
        return error.message;
      },
      REFRESH_COOKIE_NAME: 'refresh_token',
      async rotateTokensForUser() {
        throw new Error('should not rotate');
      },
      setRefreshCookie() {
        throw new Error('should not set cookie');
      },
      User: {
        findOne() {
          throw new Error('should not query user when credentials missing');
        },
      },
    });

    const refreshHandlers = app.routes.get('POST /api/auth/refresh');
    const refreshRes = createResponse();
    await runHandlers(refreshHandlers, { body: {}, headers: {} }, refreshRes);
    assert.equal(refreshRes.statusCode, 204);
    assert.equal(refreshRes.ended, true);
    assert.equal(cleared, 0);

    const loginHandlers = app.routes.get('POST /api/auth/login');
    const loginRes = createResponse();
    await runHandlers(loginHandlers, { body: { username: '', password: '' } }, loginRes);
    assert.equal(loginRes.statusCode, 401);
    assert.deepEqual(loginRes.body, { error: 'Invalid credentials' });
  }
}
