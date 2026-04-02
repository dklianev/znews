import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import {
  buildAdRotationKey,
  filterPublicAds,
  getAdRotationPool,
  normalizeAdRecord,
  resolveAdCreative,
  resolveAdForSlot,
} from '../shared/adResolver.js';

describe('adResolver', () => {
  it('covers legacy scenarios', async () => {
      const baseAds = [
        {
          id: 1,
          type: 'horizontal',
          status: 'active',
          title: 'Global',
          cta: 'Open',
          link: 'https://example.com/global',
          placements: ['article.bottom'],
          priority: 1,
        },
        {
          id: 2,
          type: 'horizontal',
          status: 'active',
          title: 'Category',
          cta: 'Open',
          link: 'https://example.com/category',
          placements: ['article.bottom'],
          targeting: { categoryIds: ['crime'] },
          priority: 5,
        },
        {
          id: 3,
          type: 'horizontal',
          status: 'active',
          title: 'Article',
          cta: 'Open',
          link: 'https://example.com/article',
          placements: ['article.bottom'],
          targeting: { articleIds: [512] },
          priority: 2,
        },
      ];
    
      const resolvedArticle = resolveAdForSlot(baseAds, {
        slot: 'article.bottom',
        pageType: 'article',
        articleId: 512,
        categoryId: 'crime',
      });
      assert.equal(resolvedArticle?.id, 3, 'exact article targeting should beat category/global targeting');
    
      const resolvedCategory = resolveAdForSlot(baseAds, {
        slot: 'article.bottom',
        pageType: 'article',
        articleId: 999,
        categoryId: 'crime',
      });
      assert.equal(resolvedCategory?.id, 2, 'category targeting should beat global targeting when article targeting misses');
    
      const resolvedCombinedCategory = resolveAdForSlot(baseAds, {
        slot: 'article.bottom',
        pageType: 'article',
        articleId: 999,
        categoryId: 'crime-underground',
        categoryIds: ['crime-underground', 'crime', 'underground'],
      });
      assert.equal(
        resolvedCombinedCategory?.id,
        2,
        'category targeting should still work when a synthetic archive page provides real category aliases'
      );
    
      const legacySide = normalizeAdRecord({
        id: 11,
        type: 'side',
        status: 'active',
        title: 'Legacy side',
        cta: 'Open',
        link: 'https://example.com/legacy',
      });
      assert(legacySide.placements.includes('article.sidebar.1'), 'legacy side ads should inherit sidebar fallback placements');
    
      const publicAds = filterPublicAds([
        {
          id: 21,
          type: 'horizontal',
          status: 'active',
          title: 'Visible',
          cta: 'Open',
          link: 'https://example.com/visible',
          placements: ['home.top'],
        },
        {
          id: 22,
          type: 'horizontal',
          status: 'paused',
          title: 'Paused',
          cta: 'Open',
          link: 'https://example.com/paused',
          placements: ['home.top'],
        },
        {
          id: 23,
          type: 'horizontal',
          status: 'active',
          title: 'Scheduled',
          cta: 'Open',
          link: 'https://example.com/scheduled',
          placements: ['home.top'],
          startAt: '2099-01-01T00:00:00.000Z',
        },
      ]);
      assert.deepEqual(publicAds.map((ad) => ad.id), [21], 'public ads should exclude paused and future-scheduled ads');
    
      const wrongType = resolveAdForSlot([
        {
          id: 31,
          type: 'side',
          status: 'active',
          title: 'Wrong type',
          cta: 'Open',
          link: 'https://example.com/wrong',
          placements: ['home.top'],
        },
      ], {
        slot: 'home.top',
        pageType: 'home',
      });
      assert.equal(wrongType, null, 'ads with incompatible slot/type combinations should not resolve');
    
      const rotationAds = [
        {
          id: 41,
          type: 'horizontal',
          status: 'active',
          title: 'Rotation A',
          cta: 'Open',
          link: 'https://example.com/a',
          placements: ['home.top'],
          priority: 10,
          weight: 1,
        },
        {
          id: 42,
          type: 'horizontal',
          status: 'active',
          title: 'Rotation B',
          cta: 'Open',
          link: 'https://example.com/b',
          placements: ['home.top'],
          priority: 10,
          weight: 4,
        },
      ];
    
      const rotationPool = getAdRotationPool(rotationAds, {
        slot: 'home.top',
        pageType: 'home',
        rotationKey: 'rotation-check',
      });
      assert.deepEqual(rotationPool.map((ad) => ad.id), [41, 42], 'ads with same specificity and priority should enter the rotation pool');
    
      const selections = new Map();
      for (let index = 0; index < 200; index += 1) {
        const selected = resolveAdForSlot(rotationAds, {
          slot: 'home.top',
          pageType: 'home',
          rotationKey: buildAdRotationKey({
            slot: 'home.top',
            pageType: 'home',
            rotationSeed: `viewer-${index}`,
            rotationWindowKey: 10,
          }),
        });
        const key = selected?.id || 0;
        selections.set(key, (selections.get(key) || 0) + 1);
      }
      assert((selections.get(41) || 0) > 0, 'rotation should allow lighter ads to appear');
      assert((selections.get(42) || 0) > (selections.get(41) || 0), 'heavier ads should win more often across the rotation pool');
    
      const priorityStillWins = resolveAdForSlot([
        ...rotationAds,
        {
          id: 43,
          type: 'horizontal',
          status: 'active',
          title: 'Priority Winner',
          cta: 'Open',
          link: 'https://example.com/winner',
          placements: ['home.top'],
          priority: 11,
          weight: 1,
        },
      ], {
        slot: 'home.top',
        pageType: 'home',
        rotationKey: 'priority-check',
      });
      assert.equal(priorityStillWins?.id, 43, 'higher priority should beat the rotation pool entirely');
    
      const staticAd = normalizeAdRecord({
        id: 51,
        type: 'horizontal',
        status: 'active',
        title: 'Static Brand Ad',
        showButton: false,
        clickable: false,
        link: '#',
        placements: ['home.top'],
      });
      assert.equal(staticAd.clickable, false, 'normalizeAdRecord should preserve explicit clickable=false');
      assert.equal(staticAd.showButton, false, 'normalizeAdRecord should preserve explicit showButton=false');
    
      const defaultClickable = normalizeAdRecord({
        id: 52,
        type: 'horizontal',
        status: 'active',
        title: 'Default Clickable Ad',
        placements: ['home.top'],
      });
      assert.equal(defaultClickable.clickable, true, 'normalizeAdRecord should default ads to clickable');
    
      const resolvedStaticAd = resolveAdForSlot([
        {
          id: 53,
          type: 'horizontal',
          status: 'active',
          title: 'Static Winner',
          showButton: false,
          clickable: false,
          link: '#',
          placements: ['home.top'],
          priority: 20,
        },
      ], {
        slot: 'home.top',
        pageType: 'home',
        rotationKey: 'static-check',
      });
      assert.equal(resolvedStaticAd?.id, 53, 'non-clickable ads should still resolve for the slot');
    
      const responsiveAd = normalizeAdRecord({
        id: 61,
        type: 'horizontal',
        status: 'active',
        title: 'Responsive',
        placements: ['home.top'],
        imageDesktop: 'https://example.com/desktop.jpg',
        imageMobile: 'https://example.com/mobile.jpg',
        imageMetaDesktop: { objectPosition: '20% 40%', objectScale: 1.2 },
        imageMetaMobile: { objectPosition: '60% 45%', objectScale: 1 },
        fitMode: 'contain',
      });
      assert.equal(responsiveAd.image, 'https://example.com/desktop.jpg', 'desktop creative should remain the legacy image alias');
      assert.equal(responsiveAd.fitMode, 'contain', 'fit mode should normalize and persist');
    
      const mobileCreative = resolveAdCreative(responsiveAd, { viewport: 'mobile' });
      assert.equal(mobileCreative.image, 'https://example.com/mobile.jpg', 'mobile viewport should prefer the dedicated mobile creative');
      assert.equal(mobileCreative.imageMeta.objectPosition, '60% 45%', 'mobile creative should use mobile focal metadata');
    
      const desktopFallbackCreative = resolveAdCreative(normalizeAdRecord({
        id: 62,
        type: 'horizontal',
        status: 'active',
        title: 'Desktop fallback',
        placements: ['home.top'],
        image: 'https://example.com/legacy.jpg',
        imageMeta: { objectPosition: '33% 66%', objectScale: 1.15 },
      }), { viewport: 'mobile' });
      assert.equal(desktopFallbackCreative.image, 'https://example.com/legacy.jpg', 'mobile viewport should fall back to desktop creative when mobile is missing');
      assert.equal(desktopFallbackCreative.imageMeta.objectPosition, '33% 66%', 'fallback creative should preserve desktop image metadata');
  });
});
