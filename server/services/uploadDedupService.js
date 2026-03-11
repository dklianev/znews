import { createHash } from 'crypto';

export function createUploadDedupService(deps = {}) {
  const {
    recentUploadCacheMax = 300,
    recentUploadTtlMs = 2 * 60 * 1000,
  } = deps;

  const uploadRequestInFlight = new Map();
  const recentUploadResults = new Map();

  function makeUploadFingerprint(buffer, mimeType = '', applyWatermark = true) {
    return createHash('sha256')
      .update(buffer)
      .update('|')
      .update(String(mimeType || ''))
      .update('|')
      .update(applyWatermark ? 'wm:1' : 'wm:0')
      .digest('hex');
  }

  function pruneRecentUploadResults() {
    const now = Date.now();
    for (const [key, value] of recentUploadResults.entries()) {
      if (!value || now - value.createdAt > recentUploadTtlMs) {
        recentUploadResults.delete(key);
      }
    }
    if (recentUploadResults.size <= recentUploadCacheMax) return;
    const ordered = [...recentUploadResults.entries()]
      .sort((a, b) => Number(a[1]?.createdAt || 0) - Number(b[1]?.createdAt || 0));
    const overflow = recentUploadResults.size - recentUploadCacheMax;
    for (let idx = 0; idx < overflow; idx += 1) {
      const key = ordered[idx]?.[0];
      if (key) recentUploadResults.delete(key);
    }
  }

  function getRecentUploadPayload(fingerprint) {
    pruneRecentUploadResults();
    const item = recentUploadResults.get(fingerprint);
    if (!item) return null;
    if (Date.now() - item.createdAt > recentUploadTtlMs) {
      recentUploadResults.delete(fingerprint);
      return null;
    }
    return item.payload || null;
  }

  function rememberRecentUploadPayload(fingerprint, payload) {
    recentUploadResults.set(fingerprint, {
      createdAt: Date.now(),
      payload,
    });
    pruneRecentUploadResults();
  }

  return {
    getRecentUploadPayload,
    makeUploadFingerprint,
    recentUploadResults,
    rememberRecentUploadPayload,
    uploadRequestInFlight,
  };
}
