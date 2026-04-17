import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createArticleRecencyHelpers } from '../server/services/articleRecencyHelpersService.js';

describe('articleRecencyHelpersService', () => {
  it('keeps articleRecencyHelpersService legacy coverage green', async () => {
      const aggregateCalls = [];
      const sortCalls = [];
    
      const legacyItems = [
        { id: 1, status: 'published', publishAt: '2024-01-01T00:00:00.000Z' },
        { id: 2, status: 'draft', publishAt: '2024-01-02T00:00:00.000Z' },
        { id: 3, status: 'published', publishAt: '2099-01-01T00:00:00.000Z' },
        { id: 4, status: 'published', publishAt: '' },
      ];
    
      const Article = {
        aggregate(pipeline) {
          aggregateCalls.push(pipeline);
          if (pipeline.some((stage) => stage.$facet)) {
            return Promise.resolve([{
              latest: [{ _id: 'mongo', __v: 0, id: 9 }],
              hero: [{ _id: 'mongo', __v: 0, id: 8, hero: true }],
              selected: [],
              featured: [],
              crime: [],
              breaking: [],
              emergency: [],
              reportage: [],
              sponsored: [],
            }]);
          }
          return Promise.resolve([{ _id: 'mongo', __v: 0, id: 7 }]);
        },
        find() {
          return {
            sort() {
              return this;
            },
            select() {
              return this;
            },
            limit() {
              return this;
            },
            lean() {
              return Promise.resolve(legacyItems);
            },
          };
        },
      };
    
      const helpers = createArticleRecencyHelpers({
        Article,
        HOMEPAGE_LATEST_BUFFER: 24,
        HOMEPAGE_SECTION_BUFFER: 10,
        combineMongoFilters(...filters) {
          const normalized = filters.filter(Boolean);
          return normalized.length <= 1 ? (normalized[0] || {}) : { $and: normalized };
        },
        normalizeText(value, maxLen = 255) {
          return String(value ?? '').slice(0, maxLen);
        },
        sortArticlesByRecency(items) {
          sortCalls.push(items.map((item) => item.id));
          return [...items].sort((a, b) => b.id - a.id);
        },
        stripDocumentList(items) {
          return items.map((item) => {
            const next = { ...item };
            delete next._id;
            delete next.__v;
            return next;
          });
        },
      });
    
      const recencyItems = await helpers.findArticlesByRecency({ featured: true }, { id: 1 }, 5, { skip: 2 });
      assert.deepEqual(recencyItems, [{ id: 7 }]);
      assert.equal(aggregateCalls.length, 1);
      assert.deepEqual(aggregateCalls[0][0], { $match: { featured: true } });
      assert.deepEqual(aggregateCalls[0][3], { $skip: 2 });
      assert.deepEqual(aggregateCalls[0][4], { $limit: 5 });

      const homepageCandidates = await helpers.fetchHomepageArticleCandidates({
        articleFilter: { status: 'published' },
        fieldsProjection: { id: 1, title: 1 },
        heroSettings: {},
        latestShowcaseLimit: 4,
        latestWireLimit: 8,
      });
      assert.deepEqual(homepageCandidates.map((item) => item.id), [9, 8]);
      assert.equal(aggregateCalls.length, 2);
      assert.equal(Boolean(aggregateCalls[1].find((stage) => stage.$facet)), true);

      const visible = await helpers.findLegacyPublicArticles(null, { limit: 10 });
      assert.deepEqual(visible.map((item) => item.id), [4, 1]);
      assert.equal(await helpers.countLegacyPublicArticles(), 2);
      assert.equal(helpers.isLegacyPublicArticle({ status: 'archived' }), false);
      assert.equal(helpers.isLegacyPublicArticle({ status: 'published', publishAt: '' }), true);
      assert.equal(sortCalls.length >= 1, true);
  });
});
