export function createRequestHelpers({
  getTrustedClientIp,
  hashTrustedBrowserClientFingerprint,
  hashTrustedClientFingerprint,
  now = () => Date.now(),
}) {
  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function getClientIp(req) {
    return getTrustedClientIp(req);
  }

  function hashClientFingerprint(req, scope = '') {
    return hashTrustedClientFingerprint(req, scope);
  }

  function hashBrowserClientFingerprint(req, scope = '') {
    if (typeof hashTrustedBrowserClientFingerprint === 'function') {
      return hashTrustedBrowserClientFingerprint(req, scope);
    }
    return hashTrustedClientFingerprint(req, scope);
  }

  function getWindowKey(windowMs) {
    return Math.floor(now() / windowMs);
  }

  function isMongoDuplicateKeyError(error) {
    return Number(error?.code) === 11000;
  }

  return {
    getClientIp,
    getWindowKey,
    hasOwn,
    hashBrowserClientFingerprint,
    hashClientFingerprint,
    isMongoDuplicateKeyError,
  };
}
