import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createRateLimitHelpers } from '../server/services/rateLimitHelpersService.js';

function createHashStub(hashCalls) {
  return function createHash(algorithm) {
    hashCalls.push(algorithm);
    return {
      update(value) {
        return {
          digest(format) {
            assert.equal(format, 'hex');
            return `hash:${value}`;
          },
        };
      },
    };
  };
}

function createHelpers(overrides = {}) {
  const hashCalls = [];
  const helpers = createRateLimitHelpers({
    createHash: createHashStub(hashCalls),
    getTrustedClientIp(req) {
      return req.trustedIp;
    },
    ipKeyGenerator(ip, subnet) {
      return `ipv6:${ip}/${subnet}`;
    },
    isIP(value) {
      return value === '2001:db8::1' ? 6 : 0;
    },
    isProd: false,
    rateLimitEnabledInDev: false,
    ...overrides,
  });
  return { hashCalls, helpers };
}

describe('rateLimitHelpersService', () => {
  it('covers legacy scenarios', async () => {
      const { hashCalls, helpers } = createHelpers();
    
      assert.equal(helpers.getClientIpForRateLimit({ trustedIp: '1.2.3.4' }), '1.2.3.4');
      assert.equal(helpers.rateLimitKeyGenerator({ trustedIp: '2001:db8::1' }), 'ipv6:2001:db8::1/56');
      assert.equal(helpers.rateLimitKeyGenerator({ trustedIp: '9.9.9.9' }), '9.9.9.9');
    
      const fingerprinted = helpers.rateLimitKeyGenerator({
        trustedIp: 'unknown',
        headers: {
          'x-forwarded-for': '10.0.0.1',
          'user-agent': 'Agent/1.0',
        },
        ip: '',
        socket: { remoteAddress: '127.0.0.1' },
      });
      assert.equal(fingerprinted, 'fp:hash:10.0.0.1||||127.0.0.1|Agent');
      assert.deepEqual(hashCalls, ['sha1']);
    
      assert.equal(helpers.parseRateLimitPositiveInt('25', 10, 5), 25);
      assert.equal(helpers.parseRateLimitPositiveInt('3', 10, 5), 10);
      assert.equal(helpers.parseRateLimitPositiveInt('bad', 10, 5), 10);
    
      assert.equal(helpers.shouldSkipRateLimit(), true);
      assert.equal(helpers.isReadOnlyMethod('get'), true);
      assert.equal(helpers.isReadOnlyMethod('post'), false);
      assert.equal(helpers.getApiPath({ path: '/Auth/Login' }), '/auth/login');
      assert.equal(helpers.isAuthApiPath({ path: '/auth/refresh' }), true);
      assert.equal(helpers.isMediaApiPath({ path: '/media/library' }), true);
      assert.equal(helpers.isMediaApiPath({ path: '/upload' }), true);
      assert.equal(helpers.isAdminApiPath({ path: '/users/7' }), true);
      assert.equal(helpers.isAdminApiPath({ path: '/site-settings/cache/homepage/refresh' }), true);
      assert.equal(helpers.isAdminApiPath({ path: '/articles/7' }), false);
    
      const { helpers: prodHelpers } = createHelpers({ isProd: true, rateLimitEnabledInDev: false });
      assert.equal(prodHelpers.shouldSkipRateLimit(), false);
    
      const { helpers: devEnabledHelpers } = createHelpers({ isProd: false, rateLimitEnabledInDev: true });
      assert.equal(devEnabledHelpers.shouldSkipRateLimit(), false);
  });
});
