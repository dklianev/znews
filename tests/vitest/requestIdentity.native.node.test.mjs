import { describe, expect, it } from 'vitest';

import {
  getTrustedClientId,
  getTrustedClientIp,
  hashTrustedBrowserClientFingerprint,
  hashTrustedClientFingerprint,
  stripPortFromIpMaybe,
} from '../../server/requestIdentity.js';

describe('request identity helpers', () => {
  it('normalizes IPv4 and IPv6 values from headers', () => {
    expect(stripPortFromIpMaybe('198.51.100.10:443')).toBe('198.51.100.10');
    expect(stripPortFromIpMaybe('[2001:db8::10]:8443')).toBe('2001:db8::10');
    expect(stripPortFromIpMaybe('for="[2001:db8::20]:1234"')).toBe('2001:db8::20');
  });

  it('prefers trusted proxy headers when resolving the client ip', () => {
    const headerPreferredReq = {
      headers: {
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '198.51.100.10, 10.0.0.1',
        'user-agent': 'znews-test',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const forwardedReq = {
      headers: {
        forwarded: 'for="[2001:db8::42]:443";proto=https',
        'user-agent': 'znews-test',
      },
      ip: '',
      socket: { remoteAddress: '' },
    };

    expect(getTrustedClientIp(headerPreferredReq)).toBe('203.0.113.9');
    expect(getTrustedClientIp(forwardedReq)).toBe('2001:db8::42');
  });

  it('uses stable fingerprint scopes and respects browser client ids', () => {
    const clientIdReq = {
      headers: {
        'cf-connecting-ip': '203.0.113.9',
        'user-agent': 'znews-test',
        'x-zn-client-id': 'zn-browser-123456',
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    expect(getTrustedClientId(clientIdReq)).toBe('zn-browser-123456');

    const fingerprintA = hashTrustedClientFingerprint(clientIdReq, 'view:15');
    const fingerprintB = hashTrustedClientFingerprint(clientIdReq, 'view:15');
    const fingerprintC = hashTrustedClientFingerprint(clientIdReq, 'poll:15');
    expect(fingerprintA).toBe(fingerprintB);
    expect(fingerprintA).not.toBe(fingerprintC);

    const browserA = hashTrustedBrowserClientFingerprint(clientIdReq, 'react:15');
    const browserB = hashTrustedBrowserClientFingerprint(clientIdReq, 'react:15');
    const browserOther = hashTrustedBrowserClientFingerprint({
      ...clientIdReq,
      headers: {
        ...clientIdReq.headers,
        'x-zn-client-id': 'zn-browser-999999',
      },
    }, 'react:15');
    expect(browserA).toBe(browserB);
    expect(browserA).not.toBe(browserOther);
  });
});
