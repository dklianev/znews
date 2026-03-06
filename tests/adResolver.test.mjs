import assert from 'node:assert/strict';

import { filterPublicAds, normalizeAdRecord, resolveAdForSlot } from '../shared/adResolver.js';

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
}
