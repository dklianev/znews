import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { registerPublicFeedRoutes } from '../server/routes/publicFeedRoutes.js';

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
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
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

function leanResult(value) {
  return {
    lean: async () => value,
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function createDeps(adOptionsSeen) {
  return {
    Article: {
      countDocuments: async () => 1,
    },
    Author: {
      find() {
        return {
          sort() {
            return {
              select() {
                return { lean: async () => [{ id: 5, name: 'Author' }] };
              },
            };
          },
        };
      },
    },
    Breaking: {
      findOne() {
        return leanResult({ items: ['Alert'] });
      },
    },
    Category: {
      find() {
        return {
          select() {
            return { lean: async () => [{ id: 'crime', name: 'Crime' }] };
          },
        };
      },
    },
    Court: {
      find() {
        return {
          sort() {
            return {
              select() {
                return { lean: async () => [] };
              },
            };
          },
        };
      },
    },
    DEFAULT_HERO_SETTINGS: { key: 'main', mainPhotoArticleId: null, photoArticleIds: [] },
    DEFAULT_SITE_SETTINGS: { key: 'main' },
    Event: {
      find() {
        return {
          sort() {
            return {
              select() {
                return { lean: async () => [] };
              },
            };
          },
        };
      },
    },
    Gallery: {
      find() {
        return {
          sort() {
            return {
              select() {
                return { lean: async () => [] };
              },
            };
          },
        };
      },
    },
    HeroSettings: {
      findOne() {
        return leanResult(null);
      },
    },
    HOMEPAGE_DEFAULT_ARTICLE_PROJECTION: { id: 1, title: 1, excerpt: 1, category: 1, publishAt: 1 },
    HOMEPAGE_LATEST_BUFFER: 8,
    Job: {
      find() {
        return {
          sort() {
            return {
              select() {
                return { lean: async () => [] };
              },
            };
          },
        };
      },
    },
    Poll: {
      find() {
        return {
          sort() {
            return {
              select() {
                return { lean: async () => [] };
              },
            };
          },
        };
      },
    },
    SiteSettings: {
      findOne() {
        return leanResult({ key: 'main', navbarLinks: [] });
      },
    },
    Wanted: {
      find() {
        return {
          sort() {
            return {
              select() {
                return { lean: async () => [] };
              },
            };
          },
        };
      },
    },
    buildArticleProjection() { return null; },
    cacheMiddleware: (_req, _res, next) => next(),
    async countLegacyPublicArticles() { return 0; },
    decodeTokenFromRequest() { return null; },
    async fetchHomepageArticleCandidates() {
      return [{ id: 11, title: 'Lead', excerpt: 'Deck', category: 'crime', publishAt: '2026-03-12T00:00:00.000Z' }];
    },
    async findArticlesByRecency() {
      return [{ id: 22, title: 'Story', excerpt: 'Deck', category: 'crime', publishAt: '2026-03-12T00:00:00.000Z' }];
    },
    async findLegacyPublicArticles() { return []; },
    getPublishedFilter() { return { status: 'published' }; },
    async hasPermissionForSection() { return false; },
    async listPublicAds(options = {}) {
      adOptionsSeen.push(options);
      return [{ id: 1, title: 'Ad', placements: ['home.top'] }];
    },
    async listPublicGames() { return []; },
    parseCollectionPagination() { return { shouldPaginate: false, page: 1, limit: 120, skip: 0 }; },
    parsePositiveInt(value, fallback) { return value == null ? fallback : Number.parseInt(value, 10); },
    publicError(error) { return error.message; },
    serializeHeroSettings(value) { return value || { key: 'main', mainPhotoArticleId: null, photoArticleIds: [] }; },
    serializeSiteSettings(value) { return value; },
    stripDocumentList(items) { return items; },
  };
}

describe('publicFeedRoutes', () => {
  it('covers legacy scenarios', async () => {
      {
        const app = createMockApp();
        const adOptionsSeen = [];
        registerPublicFeedRoutes(app, createDeps(adOptionsSeen));
    
        const handlers = app.routes.get('GET /api/homepage');
        const res = createResponse();
        await runHandlers(handlers, { query: { compact: '1' } }, res);
    
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['Cache-Control'], 'private, max-age=60');
        assert.deepEqual(adOptionsSeen, [{ compact: true }]);
        assert.ok(Array.isArray(res.body.articlePool));
        assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'articles'), false);
        assert.deepEqual(res.body.ads, [{ id: 1, title: 'Ad', placements: ['home.top'] }]);
      }
    
      {
        const app = createMockApp();
        const adOptionsSeen = [];
        registerPublicFeedRoutes(app, createDeps(adOptionsSeen));
    
        const handlers = app.routes.get('GET /api/homepage');
        const res = createResponse();
        await runHandlers(handlers, { query: {} }, res);
    
        assert.equal(res.statusCode, 200);
        assert.deepEqual(adOptionsSeen, [{ compact: false }]);
        assert.ok(Array.isArray(res.body.articlePool));
        assert.deepEqual(res.body.articles, res.body.articlePool);
      }
    
      {
        const app = createMockApp();
        const adOptionsSeen = [];
        registerPublicFeedRoutes(app, createDeps(adOptionsSeen));
    
        const handlers = app.routes.get('GET /api/bootstrap');
        const res = createResponse();
        await runHandlers(handlers, { query: { compact: '1' } }, res);
    
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['Cache-Control'], 'private, max-age=60');
        assert.deepEqual(adOptionsSeen, [{ compact: true }]);
        assert.ok(Array.isArray(res.body.articles));
        assert.deepEqual(res.body.ads, [{ id: 1, title: 'Ad', placements: ['home.top'] }]);
      }
    
      // Authenticated user with article permissions should still exclude archived articles
      {
        const app = createMockApp();
        const adOptionsSeen = [];
        const capturedFilters = [];
        const deps = createDeps(adOptionsSeen);
        deps.decodeTokenFromRequest = () => ({ userId: 1, name: 'Editor' });
        deps.hasPermissionForSection = async () => true;
        deps.fetchHomepageArticleCandidates = async ({ articleFilter }) => {
          capturedFilters.push(articleFilter);
          return [{ id: 11, title: 'Lead', excerpt: 'Deck', category: 'crime', publishAt: '2026-03-12T00:00:00.000Z' }];
        };
        registerPublicFeedRoutes(app, deps);
    
        const handlers = app.routes.get('GET /api/homepage');
        const res = createResponse();
        await runHandlers(handlers, { query: {} }, res);
    
        assert.equal(res.statusCode, 200);
        assert.equal(capturedFilters.length, 1);
        assert.deepEqual(capturedFilters[0], { status: { $ne: 'archived' } },
          'authenticated homepage must exclude archived articles');
      }
    
      {
        const app = createMockApp();
        const adOptionsSeen = [];
        const capturedFilters = [];
        const deps = createDeps(adOptionsSeen);
        deps.decodeTokenFromRequest = () => ({ userId: 1, name: 'Editor' });
        deps.hasPermissionForSection = async () => true;
        deps.findArticlesByRecency = async (filter) => {
          capturedFilters.push(filter);
          return [{ id: 22, title: 'Story' }];
        };
        registerPublicFeedRoutes(app, deps);
    
        const handlers = app.routes.get('GET /api/bootstrap');
        const res = createResponse();
        await runHandlers(handlers, { query: {} }, res);
    
        assert.equal(res.statusCode, 200);
        assert.equal(capturedFilters.length, 1);
        assert.deepEqual(capturedFilters[0], { status: { $ne: 'archived' } },
          'authenticated bootstrap must exclude archived articles');
      }
  });
});
