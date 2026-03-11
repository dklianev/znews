import assert from 'node:assert/strict';
import { filterSearchResultsByType, normalizeSearchType } from '../shared/search.js';
import { registerSearchRoutes } from '../server/routes/searchRoutes.js';

function createMockApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runHandlers(handlers, req, res) {
  let index = 0;
  const next = async () => {
    const handler = handlers[index++];
    if (!handler) return undefined;
    if (handler.length >= 3) {
      return handler(req, res, () => next());
    }
    return handler(req, res);
  };
  return next();
}

function createArticleModel(items, seenFilters) {
  return {
    find(filter) {
      seenFilters.push(filter);
      return {
        sort() {
          return {
            limit() {
              return {
                select() {
                  return {
                    async lean() {
                      return items;
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

export async function runSearchRoutesTests() {
  {
    const app = createMockApp();
    let recorded = 0;

    registerSearchRoutes(app, {
      Article: createArticleModel([], []),
      Court: {},
      Event: {},
      Job: {},
      Wanted: {},
      HOMEPAGE_DEFAULT_ARTICLE_PROJECTION: { id: 1 },
      buildArticleProjection() { return null; },
      buildSearchRegex() { return null; },
      cacheMiddleware: (_req, _res, next) => next(),
      decodeTokenFromRequest() { return null; },
      escapeRegexForSearch(value) { return value; },
      filterSearchResultsByType,
      getPublishedFilter() { return { status: 'published' }; },
      async getSearchSuggestions() { return []; },
      async getTrendingSearches() { return []; },
      async hasPermissionForSection() { return false; },
      normalizeSearchType,
      normalizeText(value) { return typeof value === 'string' ? value : ''; },
      parsePositiveInt(value, fallback) { return value == null ? fallback : Number.parseInt(value, 10); },
      publicError(error) { return error.message; },
      async recordSearchQuery() { recorded += 1; },
      async searchCollectionByTextAndRegex() { return []; },
      sortArticlesByRecency(items) { return items; },
      stripDocumentList(items) { return items; },
    });

    const handlers = app.routes.get('GET /api/search');
    const res = createResponse();
    await runHandlers(handlers, { query: { q: '   ', type: 'jobs' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(recorded, 0);
    assert.deepEqual(res.body, {
      query: '',
      type: 'jobs',
      tookMs: 0,
      articles: [],
      jobs: [],
      court: [],
      events: [],
      wanted: [],
    });
  }

  {
    const app = createMockApp();
    const seenArticleFilters = [];
    const articleItems = [{ id: 9, title: 'Article' }];
    const jobItems = [{ id: 2, title: 'Job' }];
    const courtItems = [{ id: 3, title: 'Court' }];
    let recordedQuery = null;

    registerSearchRoutes(app, {
      Article: createArticleModel(articleItems, seenArticleFilters),
      Court: { modelName: 'Court' },
      Event: { modelName: 'Event' },
      Job: { modelName: 'Job' },
      Wanted: { modelName: 'Wanted' },
      HOMEPAGE_DEFAULT_ARTICLE_PROJECTION: { id: 1, title: 1 },
      buildArticleProjection() { return null; },
      buildSearchRegex(term) { return new RegExp(term, 'i'); },
      cacheMiddleware: (_req, _res, next) => next(),
      decodeTokenFromRequest() { return null; },
      escapeRegexForSearch(value) { return value; },
      filterSearchResultsByType,
      getPublishedFilter() { return { status: 'published' }; },
      async getSearchSuggestions() { return []; },
      async getTrendingSearches() { return []; },
      async hasPermissionForSection() { return false; },
      normalizeSearchType,
      normalizeText(value) { return typeof value === 'string' ? value : ''; },
      parsePositiveInt(value, fallback) { return value == null ? fallback : Number.parseInt(value, 10); },
      publicError(error) { return error.message; },
      async recordSearchQuery(query) { recordedQuery = query; },
      async searchCollectionByTextAndRegex(Model) {
        if (Model.modelName === 'Job') return jobItems;
        if (Model.modelName === 'Court') return courtItems;
        return [];
      },
      sortArticlesByRecency(items) { return items; },
      stripDocumentList(items) { return items; },
    });

    const handlers = app.routes.get('GET /api/search');
    const res = createResponse();
    await runHandlers(handlers, { query: { q: 'мафия', type: 'jobs', sectionLimit: '5' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(recordedQuery, 'мафия');
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.deepEqual(seenArticleFilters, [{ status: 'published', $text: { $search: 'мафия' } }]);
    assert.equal(res.body.query, 'мафия');
    assert.equal(res.body.type, 'jobs');
    assert.deepEqual(res.body.jobs, jobItems);
    assert.deepEqual(res.body.articles, []);
    assert.deepEqual(res.body.court, []);
    assert.deepEqual(res.body.events, []);
    assert.deepEqual(res.body.wanted, []);
  }

  {
    const app = createMockApp();

    registerSearchRoutes(app, {
      Article: createArticleModel([], []),
      Court: {},
      Event: {},
      Job: {},
      Wanted: {},
      HOMEPAGE_DEFAULT_ARTICLE_PROJECTION: {},
      buildArticleProjection() { return null; },
      buildSearchRegex() { return null; },
      cacheMiddleware: (_req, _res, next) => next(),
      decodeTokenFromRequest() { return null; },
      escapeRegexForSearch(value) { return value; },
      filterSearchResultsByType,
      getPublishedFilter() { return {}; },
      async getSearchSuggestions(query, { limit }) {
        return [{ label: `${query}-${limit}` }];
      },
      async getTrendingSearches(limit) {
        return [{ term: 'trend', score: limit }];
      },
      async hasPermissionForSection() { return false; },
      normalizeSearchType,
      normalizeText(value) { return typeof value === 'string' ? value : ''; },
      parsePositiveInt(value, fallback) { return value == null ? fallback : Number.parseInt(value, 10); },
      publicError(error) { return error.message; },
      async recordSearchQuery() {},
      async searchCollectionByTextAndRegex() { return []; },
      sortArticlesByRecency(items) { return items; },
      stripDocumentList(items) { return items; },
    });

    const suggestHandlers = app.routes.get('GET /api/search/suggest');
    const suggestRes = createResponse();
    await runHandlers(suggestHandlers, { query: { q: '  rag ', limit: '3' } }, suggestRes);
    assert.equal(suggestRes.statusCode, 200);
    assert.equal(suggestRes.headers['Cache-Control'], 'no-store');
    assert.deepEqual(suggestRes.body, {
      query: 'rag',
      suggestions: [{ label: 'rag-3' }],
    });

    const trendingHandlers = app.routes.get('GET /api/search/trending');
    const trendingRes = createResponse();
    await runHandlers(trendingHandlers, { query: { limit: '4' } }, trendingRes);
    assert.equal(trendingRes.statusCode, 200);
    assert.equal(trendingRes.headers['Cache-Control'], 'no-store');
    assert.deepEqual(trendingRes.body, { items: [{ term: 'trend', score: 4 }] });
  }
}
