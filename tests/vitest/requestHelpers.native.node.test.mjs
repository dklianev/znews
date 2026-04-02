import { describe, expect, it } from 'vitest';

import { createRequestHelpers } from '../../server/services/requestHelpersService.js';

describe('request helpers service', () => {
  it('exposes the trusted fingerprint and duplicate key helpers', () => {
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

    expect(helpers.hasOwn({ a: 1 }, 'a')).toBe(true);
    expect(helpers.hasOwn(Object.create({ a: 1 }), 'a')).toBe(false);
    expect(helpers.getClientIp({ ip: '127.0.0.1' })).toBe('127.0.0.1');
    expect(helpers.hashBrowserClientFingerprint({ id: 'abc' }, 'react')).toBe('browser:react:abc');
    expect(helpers.hashClientFingerprint({ id: 'abc' }, 'poll')).toBe('poll:abc');
    expect(helpers.getWindowKey(5_000)).toBe(5);
    expect(helpers.isMongoDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(helpers.isMongoDuplicateKeyError({ code: '11000' })).toBe(true);
    expect(helpers.isMongoDuplicateKeyError({ code: 42 })).toBe(false);
  });

  it('falls back to the generic trusted fingerprint when no browser hash helper exists', () => {
    const helpers = createRequestHelpers({
      getTrustedClientIp(req) {
        return req.ip || '0.0.0.0';
      },
      hashTrustedClientFingerprint(req, scope) {
        return `${scope}:${req.id}:fallback`;
      },
    });

    expect(helpers.hashBrowserClientFingerprint({ id: 'cef' }, 'article')).toBe('article:cef:fallback');
  });
});
