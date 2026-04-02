import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createArticleCollectionHelpers } from '../server/services/articleCollectionHelpersService.js';

describe('articleCollectionHelpersService', () => {
  it('covers legacy scenarios', async () => {
      const helpers = createArticleCollectionHelpers({
        ARTICLE_FIELD_ALLOWLIST: new Set(['id', 'title', 'excerpt', 'views']),
        ARTICLE_SECTION_FILTERS: {
          featured: { featured: true },
          crime: { category: { $in: ['crime', 'underground'] } },
        },
        hasOwn(obj, key) {
          return Object.prototype.hasOwnProperty.call(obj, key);
        },
        normalizeText(value, maxLen = 255) {
          return String(value ?? '').trim().slice(0, maxLen);
        },
        parsePositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isInteger(parsed)) return fallback;
          return Math.min(max, Math.max(min, parsed));
        },
      });
    
      assert.equal(helpers.buildArticleProjection(null), null);
      assert.deepEqual(helpers.buildArticleProjection('title,excerpt,unknown'), {
        _id: 0,
        id: 1,
        title: 1,
        excerpt: 1,
      });
      assert.deepEqual(helpers.buildArticleProjection('id,title'), {
        _id: 0,
        id: 1,
        title: 1,
      });
    
      assert.deepEqual(helpers.getArticleSectionFilter('featured'), { featured: true });
      assert.equal(helpers.getArticleSectionFilter('missing'), null);
    
      assert.deepEqual(helpers.combineMongoFilters(null, undefined, {}), {});
      assert.deepEqual(helpers.combineMongoFilters({ featured: true }), { featured: true });
      assert.deepEqual(helpers.combineMongoFilters({ featured: true }, { category: 'crime' }), {
        $and: [{ featured: true }, { category: 'crime' }],
      });
    
      assert.deepEqual(helpers.parseCollectionPagination({}, { defaultLimit: 80, maxLimit: 250 }), {
        shouldPaginate: false,
        page: 1,
        limit: 80,
        skip: 0,
      });
      assert.deepEqual(helpers.parseCollectionPagination({ page: '3', limit: '25' }, { defaultLimit: 80, maxLimit: 250 }), {
        shouldPaginate: true,
        page: 3,
        limit: 25,
        skip: 50,
      });
      assert.deepEqual(helpers.parseCollectionPagination({ page: '0', limit: '999' }, { defaultLimit: 80, maxLimit: 120 }), {
        shouldPaginate: true,
        page: 1,
        limit: 120,
        skip: 0,
      });
  });
});
