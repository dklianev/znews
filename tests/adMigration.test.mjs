import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { buildAdMigrationPatch, buildAdMigrationPlan } from '../shared/adMigration.js';

describe('adMigration', () => {
  it('covers legacy scenarios', async () => {
      const legacySidePatch = buildAdMigrationPatch({
        id: 11,
        type: 'side',
        title: 'Legacy side',
        cta: 'Open',
        link: 'https://example.com',
      });
      assert.deepEqual(
        legacySidePatch.placements,
        ['home.sidebar.1', 'home.sidebar.2', 'article.sidebar.1', 'article.sidebar.2', 'category.sidebar.1', 'category.sidebar.2'],
        'legacy side ads should receive fallback sidebar placements'
      );
      assert.equal(legacySidePatch.status, 'active', 'missing status should normalize to active');
      assert.equal(legacySidePatch.weight, 1, 'missing weight should normalize to 1');
    
      const normalizedPatch = buildAdMigrationPatch({
        id: 12,
        type: 'horizontal',
        status: 'active',
        title: 'Normalized',
        cta: 'Open',
        link: 'https://example.com/norm',
        placements: ['home.top'],
        weight: 3,
      });
      assert.deepEqual(normalizedPatch, {}, 'already normalized ads should not be changed');
    
      const invalidDatesPatch = buildAdMigrationPatch({
        id: 13,
        type: 'horizontal',
        status: 'active',
        title: 'Dates',
        cta: 'Open',
        link: 'https://example.com/dates',
        placements: ['home.top'],
        startAt: 'not-a-date',
        endAt: '2026-03-05T10:00:00.000Z',
        targeting: { categoryIds: ['Crime', 'crime'] },
      });
      assert.equal(invalidDatesPatch.startAt, null, 'invalid dates should be nulled during migration');
      assert.deepEqual(
        invalidDatesPatch.targeting,
        {
          pageTypes: [],
          articleIds: [],
          categoryIds: ['crime'],
          excludeArticleIds: [],
          excludeCategoryIds: [],
        },
        'targeting should be normalized when legacy values are malformed or duplicated'
      );
    
      const plan = buildAdMigrationPlan({
        id: 14,
        type: 'inline',
        title: 'Plan',
        cta: 'Read',
        link: 'https://example.com/plan',
      });
      assert.equal(plan.id, 14, 'plan should expose the ad id');
      assert.equal(plan.hasChanges, true, 'legacy inline ad should require migration');
  });
});
