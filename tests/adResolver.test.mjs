import assert from 'node:assert/strict';

import {
  buildAdRotationKey,
  filterPublicAds,
  getAdRotationPool,
  normalizeAdRecord,
  resolveAdForSlot,
} from '../shared/adResolver.js';

export function runAdResolverTests() {
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
}
