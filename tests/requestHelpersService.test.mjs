import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createRequestHelpers } from '../server/services/requestHelpersService.js';

describe('requestHelpersService', () => {
  it('keeps requestHelpersService legacy coverage green', async () => {
      const helpers = createRequestHelpers({
        getTrustedClientIp(req) {
          return req.ip || '0.0.0.0';
        },
        hashTrustedBrowserClientFingerprint(req, scope) {
          return `browser:${scope}:${req.id}`;
        },
        hashTrustedClientFingerprint(req, scope) {
          return `${scope}:${req.id}`;
        },
        now() {
          return 26_000;
        },
      });
    
      assert.equal(helpers.hasOwn({ a: 1 }, 'a'), true);
      assert.equal(helpers.hasOwn(Object.create({ a: 1 }), 'a'), false);
      assert.equal(helpers.getClientIp({ ip: '127.0.0.1' }), '127.0.0.1');
      assert.equal(helpers.hashBrowserClientFingerprint({ id: 'abc' }, 'react'), 'browser:react:abc');
      assert.equal(helpers.hashClientFingerprint({ id: 'abc' }, 'poll'), 'poll:abc');
      assert.equal(helpers.getWindowKey(5_000), 5);
      assert.equal(helpers.isMongoDuplicateKeyError({ code: 11000 }), true);
      assert.equal(helpers.isMongoDuplicateKeyError({ code: '11000' }), true);
      assert.equal(helpers.isMongoDuplicateKeyError({ code: 42 }), false);
  });
});
