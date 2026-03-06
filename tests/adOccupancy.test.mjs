import assert from 'node:assert/strict';

import { buildAdSlotOccupancy } from '../shared/adOccupancy.js';

export function runAdOccupancyTests() {
  const homeRotation = buildAdSlotOccupancy([
    {
      id: 1,
      type: 'horizontal',
      status: 'active',
      title: 'Current A',
      cta: 'Open',
      link: 'https://example.com/a',
      placements: ['home.top'],
      priority: 10,
    },
    {
      id: 2,
      type: 'horizontal',
      status: 'active',
      title: 'Current B',
      cta: 'Open',
      link: 'https://example.com/b',
      placements: ['home.top'],
      priority: 10,
    },
    {
      id: 3,
      type: 'horizontal',
      status: 'active',
      title: 'Upcoming',
      cta: 'Open',
      link: 'https://example.com/c',
      placements: ['home.top'],
      startAt: '2099-01-01T00:00:00.000Z',
    },
  ], {
    now: '2026-03-06T12:00:00.000Z',
  });

  const homeTop = homeRotation.find((item) => item.slot.id === 'home.top');
  assert(homeTop, 'home.top slot should be present');
  assert.equal(homeTop.currentAds.length, 2, 'current ads should be grouped per slot');
  assert.equal(homeTop.upcomingAds.length, 1, 'future scheduled ads should be separated');
  assert.equal(homeTop.warnings.some((warning) => warning.type === 'overlap'), false, 'equal-priority rotation should not be reported as an overlap conflict');
  assert(homeTop.warnings.some((warning) => warning.type === 'rotation'), 'rotation warning should be emitted for equal priority/targeting ads');

  const isolatedArticleTargets = buildAdSlotOccupancy([
    {
      id: 11,
      type: 'horizontal',
      status: 'active',
      title: 'Article A',
      cta: 'Open',
      link: 'https://example.com/a',
      placements: ['article.bottom'],
      priority: 10,
      targeting: { articleIds: [101] },
    },
    {
      id: 12,
      type: 'horizontal',
      status: 'active',
      title: 'Article B',
      cta: 'Open',
      link: 'https://example.com/b',
      placements: ['article.bottom'],
      priority: 20,
      targeting: { articleIds: [202] },
    },
  ], {
    now: '2026-03-06T12:00:00.000Z',
  });

  const articleBottom = isolatedArticleTargets.find((item) => item.slot.id === 'article.bottom');
  assert(articleBottom, 'article.bottom slot should be present');
  assert.equal(articleBottom.currentAds.length, 2, 'occupancy inventory should still list both active ads');
  assert.equal(articleBottom.warnings.length, 0, 'ads targeting different articles should not be flagged as conflicting');
}
