import { describe, expect, it } from 'vitest';

import {
  buildAdRotationKey,
  filterPublicAds,
  getAdRotationPool,
  normalizeAdRecord,
  resolveAdCreative,
  resolveAdForSlot,
} from '../../shared/adResolver.js';

describe('adResolver', () => {
  it('prefers article targeting over category and global matches', () => {
    const ads = [
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

    expect(resolveAdForSlot(ads, {
      slot: 'article.bottom',
      pageType: 'article',
      articleId: 512,
      categoryId: 'crime',
    })?.id).toBe(3);

    expect(resolveAdForSlot(ads, {
      slot: 'article.bottom',
      pageType: 'article',
      articleId: 999,
      categoryId: 'crime',
    })?.id).toBe(2);

    expect(resolveAdForSlot(ads, {
      slot: 'article.bottom',
      pageType: 'article',
      articleId: 999,
      categoryId: 'crime-underground',
      categoryIds: ['crime-underground', 'crime', 'underground'],
    })?.id).toBe(2);
  });

  it('filters paused and future ads from the public feed', () => {
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

    expect(publicAds.map((ad) => ad.id)).toEqual([21]);
  });

  it('builds a weighted rotation pool while still respecting priority winners', () => {
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

    expect(getAdRotationPool(rotationAds, {
      slot: 'home.top',
      pageType: 'home',
      rotationKey: 'rotation-check',
    }).map((ad) => ad.id)).toEqual([41, 42]);

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

    expect((selections.get(41) || 0) > 0).toBe(true);
    expect((selections.get(42) || 0) > (selections.get(41) || 0)).toBe(true);

    expect(resolveAdForSlot([
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
    })?.id).toBe(43);
  });

  it('preserves creative metadata and mobile fallbacks', () => {
    const responsiveAd = normalizeAdRecord({
      id: 61,
      type: 'horizontal',
      status: 'active',
      title: 'Responsive',
      placements: ['home.top'],
      imageDesktop: 'https://example.com/desktop.jpg',
      imageMobile: 'https://example.com/mobile.jpg',
      imageMetaDesktop: {
        width: 1200,
        height: 320,
        placeholder: 'https://example.com/desktop-blur.webp',
        webp: [{ width: 640, url: 'https://example.com/desktop-w640.webp' }],
        avif: [{ width: 640, url: 'https://example.com/desktop-w640.avif' }],
        objectPosition: '20% 40%',
        objectScale: 1.2,
      },
      imageMetaMobile: {
        width: 640,
        height: 320,
        placeholder: 'https://example.com/mobile-blur.webp',
        webp: [{ width: 320, url: 'https://example.com/mobile-w320.webp' }],
        avif: [{ width: 320, url: 'https://example.com/mobile-w320.avif' }],
        objectPosition: '60% 45%',
        objectScale: 1,
      },
      fitMode: 'contain',
    });

    expect(responsiveAd.image).toBe('https://example.com/desktop.jpg');
    expect(responsiveAd.fitMode).toBe('contain');

    const mobileCreative = resolveAdCreative(responsiveAd, { viewport: 'mobile' });
    expect(mobileCreative.image).toBe('https://example.com/mobile.jpg');
    expect(mobileCreative.imageMeta.objectPosition).toBe('60% 45%');
    expect(mobileCreative.imageMeta.avif).toEqual([{ width: 320, url: 'https://example.com/mobile-w320.avif' }]);

    const desktopCreative = resolveAdCreative(responsiveAd, { viewport: 'desktop' });
    expect(desktopCreative.imageMeta.webp).toEqual([{ width: 640, url: 'https://example.com/desktop-w640.webp' }]);

    const fallbackCreative = resolveAdCreative(normalizeAdRecord({
      id: 62,
      type: 'horizontal',
      status: 'active',
      title: 'Desktop fallback',
      placements: ['home.top'],
      image: 'https://example.com/legacy.jpg',
      imageMeta: { objectPosition: '33% 66%', objectScale: 1.15 },
    }), { viewport: 'mobile' });

    expect(fallbackCreative.image).toBe('https://example.com/legacy.jpg');
    expect(fallbackCreative.imageMeta.objectPosition).toBe('33% 66%');
  });
});
