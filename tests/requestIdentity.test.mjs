import assert from 'node:assert/strict';

import { getTrustedClientIp, hashTrustedClientFingerprint, stripPortFromIpMaybe } from '../server/requestIdentity.js';

export function runRequestIdentityTests() {
  assert.equal(stripPortFromIpMaybe('198.51.100.10:443'), '198.51.100.10');
  assert.equal(stripPortFromIpMaybe('[2001:db8::10]:8443'), '2001:db8::10');
  assert.equal(stripPortFromIpMaybe('for="[2001:db8::20]:1234"'), '2001:db8::20');

  const headerPreferredReq = {
    headers: {
      'cf-connecting-ip': '203.0.113.9',
      'x-forwarded-for': '198.51.100.10, 10.0.0.1',
      'user-agent': 'znews-test',
    },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };
  assert.equal(getTrustedClientIp(headerPreferredReq), '203.0.113.9');

  const forwardedReq = {
    headers: {
      forwarded: 'for="[2001:db8::42]:443";proto=https',
      'user-agent': 'znews-test',
    },
    ip: '',
    socket: { remoteAddress: '' },
  };
  assert.equal(getTrustedClientIp(forwardedReq), '2001:db8::42');

  const fingerprintA = hashTrustedClientFingerprint(headerPreferredReq, 'view:15');
  const fingerprintB = hashTrustedClientFingerprint(headerPreferredReq, 'view:15');
  const fingerprintC = hashTrustedClientFingerprint(headerPreferredReq, 'poll:15');
  assert.equal(fingerprintA, fingerprintB);
  assert.notEqual(fingerprintA, fingerprintC);
}
