import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createAuthSessionHelpers } from '../server/services/authSessionHelpersService.js';

describe('authSessionHelpersService', () => {
  it('covers legacy scenarios', async () => {
      const created = [];
      const deleted = [];
      const signRefreshCalls = [];
      const signAccessCalls = [];
    
      const helpers = createAuthSessionHelpers({
        AuthSession: {
          async create(doc) {
            created.push(doc);
          },
          async deleteOne(query) {
            deleted.push(query);
          },
        },
        createHash(algorithm) {
          assert.equal(algorithm, 'sha256');
          return {
            update(value) {
              return {
                digest(format) {
                  assert.equal(format, 'hex');
                  return 'hashed:' + value;
                },
              };
            },
          };
        },
        getClientIp(req) {
          return req.ip;
        },
        getClientUserAgent(req) {
          return req.headers['user-agent'] || '';
        },
        randomUUID() {
          return 'uuid-1234567890';
        },
        refreshTokenMaxAgeMs: 60 * 60 * 1000,
        signAccessToken(user) {
          signAccessCalls.push(user);
          return 'access-' + user.id;
        },
        signRefreshToken(payload) {
          signRefreshCalls.push(payload);
          return 'refresh-' + payload.jti;
        },
      });
    
      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'TestAgent/1.0' } };
      const createdSession = await helpers.createRefreshSession(req, 7);
      assert.equal(createdSession.jti, 'uuid-1234567890');
      assert.ok(createdSession.expiresAt instanceof Date);
      assert.equal(created.length, 1);
      assert.equal(created[0].userId, 7);
      assert.equal(created[0].userAgent, 'TestAgent/1.0');
      assert.equal(created[0].ipHash, 'hashed:127.0.0.1');
    
      created.length = 0;
      const rotated = await helpers.rotateTokensForUser(req, { id: 42, username: 'user' }, 'old-jti');
      assert.deepEqual(deleted, [{ jti: 'old-jti', userId: 42 }]);
      assert.equal(created.length, 1);
      assert.deepEqual(signRefreshCalls, [{ userId: 42, jti: 'uuid-1234567890' }]);
      assert.deepEqual(signAccessCalls, [{ id: 42, username: 'user' }]);
      assert.deepEqual(rotated, {
        accessToken: 'access-42',
        refreshToken: 'refresh-uuid-1234567890',
      });
  });
});
