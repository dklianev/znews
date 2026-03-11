import assert from 'node:assert/strict';
import { createRateLimitHelpers } from '../server/services/rateLimitHelpersService.js';

export async function runRateLimitHelpersTests() {
  const hashCalls = [];
  const helpers = createRateLimitHelpers({
    createHash(algorithm) {
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
    },
    getTrustedClientIp(req) {
      return req.trustedIp;
    },
    ipKeyGenerator(ip, subnet) {
      return `ipv6:${ip}/${subnet}`;
    },
    isIP(value) {
      return value === '2001:db8::1' ? 6 : 0;
    },
  });

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
}

