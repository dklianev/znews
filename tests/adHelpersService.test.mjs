import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createAdHelpers } from '../server/services/adHelpersService.js';
import { normalizeAdFitMode, normalizeAdImageMeta, normalizeAdRecord } from '../shared/adResolver.js';

function createLeanResult(value) {
  return {
    lean: async () => value,
  };
}

describe('adHelpersService', () => {
  it('keeps adHelpersService legacy coverage green', async () => {
      const helpers = createAdHelpers({
        Ad: {
          find() {
            return {
              sort() {
                return createLeanResult([
                  {
                    id: 7,
                    type: 'horizontal',
                    status: 'active',
                    title: 'Campaign',
                    placements: ['home.top'],
                    imageDesktop: '/uploads/desktop.jpg',
                    imageMobile: '/uploads/mobile.jpg',
                    imageMetaDesktop: { objectPosition: '40% 20%', objectScale: 1.3 },
                    imageMetaMobile: { objectPosition: '50% 50%', objectScale: 1 },
                  },
                ]);
              },
            };
          },
        },
        AdEvent: {},
        AD_EVENT_TYPES: ['impression', 'click'],
        AD_PAGE_TYPES: ['home'],
        AD_STATUS_OPTIONS: ['active', 'paused', 'archived'],
        AD_TYPES: ['horizontal', 'inline', 'side'],
        DEFAULT_AD_ANALYTICS_DAYS: 7,
        adAnalyticsRetentionMs: 1000,
        adImpressionWindowMs: 1000,
        decodeTokenFromRequest: () => null,
        filterPublicAds: (items) => items,
        getAdRotationPool: () => [],
        getAdSlot: () => ({ pageType: 'home', supportsArticleTargeting: false, supportsCategoryTargeting: false }),
        getDefaultPlacementsForType: () => ['home.top'],
        getWindowKey: () => 'window',
        hasOwn: (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key),
        hasPermissionForSection: async () => false,
        hashClientFingerprint: () => 'fingerprint',
        isKnownAdSlot: () => true,
        isMongoDuplicateKeyError: () => false,
        normalizeAdFitMode,
        normalizeAdImageMeta,
        normalizeAdRecord,
        normalizeText: (value, maxLen = 255) => String(value ?? '').trim().slice(0, maxLen),
        stripDocumentMetadata: (value) => value,
      });
    
      const compactAds = await helpers.listPublicAds({ compact: true });
      assert.equal(compactAds.length, 1);
      assert.equal(compactAds[0].image, '/uploads/desktop.jpg');
      assert.equal(compactAds[0].imageDesktop, '/uploads/desktop.jpg');
      assert.equal(compactAds[0].imageMobile, '/uploads/mobile.jpg');
      assert.deepEqual(compactAds[0].imageMeta, { objectPosition: '40% 20%', objectScale: 1.3 });
  });
});
