import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { registerArticlesAdminRoutes } from '../server/routes/articlesAdminRoutes.js';

function createMockRouter() {
  const routes = new Map();
  return {
    delete(path, ...handlers) {
      routes.set(`DELETE ${path}`, handlers);
    },
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers);
    },
    put(path, ...handlers) {
      routes.set(`PUT ${path}`, handlers);
    },
    routes,
  };
}

function createResponse() {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
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

function createDeps({ aggregateResult = [], total = 0, onBuildPipeline } = {}) {
  return {
    Article: {
      async aggregate(pipeline) {
        return typeof aggregateResult === 'function' ? aggregateResult(pipeline) : aggregateResult;
      },
      async countDocuments(filter) {
        if (onBuildPipeline) onBuildPipeline({ countFilter: filter });
        return total;
      },
    },
    ArticleRevision: {},
    AuditLog: {},
    buildArticleRecencyPipeline(filter, projection, options) {
      if (onBuildPipeline) onBuildPipeline({ filter, projection, options });
      return [{ $mockPipeline: true }];
    },
    buildArticleSnapshot(value) {
      return value;
    },
    async createArticleRevision() {},
    async enrichArticlePayloadWithImageMeta() {},
    invalidateCacheGroup() {},
    isImmediateBreakingArticle() {
      return false;
    },
    async nextNumericId() {
      return 1;
    },
    normalizeText(value) {
      return typeof value === 'string' ? value.trim() : '';
    },
    parsePositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed)) return fallback;
      return Math.min(max, Math.max(min, parsed));
    },
    requireAuth(_req, _res, next) {
      return next();
    },
    requirePermission() {
      return (_req, _res, next) => next();
    },
    sanitizeArticlePayload() {
      return {};
    },
    sendPushNotificationForArticle() {},
  };
}

describe('articlesAdminRoutes', () => {
  it('covers legacy scenarios', async () => {
      {
        const router = createMockRouter();
        const calls = [];
        registerArticlesAdminRoutes(router, createDeps({
          aggregateResult: [{ id: 22, title: 'Raid story' }],
          total: 41,
          onBuildPipeline(call) {
            calls.push(call);
          },
        }));
    
        const handlers = router.routes.get('GET /admin/list');
        const res = createResponse();
        await runHandlers(handlers, {
          query: {
            page: '2',
            limit: '15',
            category: ' crime ',
            q: ' raid ',
          },
        }, res);
    
        assert.equal(res.statusCode, 200);
        assert.equal(calls.length, 2);
    
        const countCall = calls.find((entry) => entry.countFilter);
        assert.deepEqual(countCall.countFilter.status, { $ne: 'archived' });
        assert.equal(countCall.countFilter.category, 'crime');
        assert.equal(countCall.countFilter.title instanceof RegExp, true);
        assert.equal(countCall.countFilter.title.source, 'raid');
        assert.equal(countCall.countFilter.title.flags, 'i');
    
        const pipelineCall = calls.find((entry) => entry.filter);
        assert.deepEqual(pipelineCall.filter.status, { $ne: 'archived' });
        assert.equal(pipelineCall.filter.category, 'crime');
        assert.equal(pipelineCall.filter.title instanceof RegExp, true);
        assert.deepEqual(pipelineCall.options, { skip: 15, limit: 15 });
        assert.deepEqual(pipelineCall.projection, {
          id: 1,
          title: 1,
          category: 1,
          authorId: 1,
          date: 1,
          readTime: 1,
          image: 1,
          featured: 1,
          breaking: 1,
          status: 1,
          publishAt: 1,
        });
    
        assert.deepEqual(res.body, {
          items: [{ id: 22, title: 'Raid story' }],
          page: 2,
          limit: 15,
          total: 41,
          totalPages: 3,
        });
      }
    
      {
        const router = createMockRouter();
        let pipelineOptions = null;
        registerArticlesAdminRoutes(router, createDeps({
          aggregateResult: [{ id: 7, title: 'Last page item' }],
          total: 5,
          onBuildPipeline(call) {
            if (call.options) pipelineOptions = call.options;
          },
        }));
    
        const handlers = router.routes.get('GET /admin/list');
        const res = createResponse();
        await runHandlers(handlers, {
          query: {
            page: '9',
            limit: '4',
          },
        }, res);
    
        assert.deepEqual(pipelineOptions, { skip: 4, limit: 4 });
        assert.equal(res.body.page, 2);
        assert.equal(res.body.totalPages, 2);
      }
    
      {
        const router = createMockRouter();
        const aggregatePipelines = [];
        registerArticlesAdminRoutes(router, createDeps({
          total: 9,
          aggregateResult(pipeline) {
            aggregatePipelines.push(pipeline);
            const groupId = pipeline.find((stage) => stage.$group)?.$group?._id;
            if (groupId === '$category') {
              return [
                { category: 'crime', count: 5 },
                { category: 'politics', count: 4 },
              ];
            }
            return [
              { tag: 'zemun', count: 3 },
              { tag: 'breaking', count: 2 },
            ];
          },
        }));
    
        const handlers = router.routes.get('GET /admin/meta');
        const res = createResponse();
        await runHandlers(handlers, { query: {} }, res);
    
        assert.equal(res.statusCode, 200);
        assert.equal(aggregatePipelines.length, 2);
        aggregatePipelines.forEach((pipeline) => {
          assert.deepEqual(pipeline[0]?.$match?.status, { $ne: 'archived' });
        });
        assert.deepEqual(res.body, {
          total: 9,
          byCategory: {
            crime: 5,
            politics: 4,
          },
          popularTags: [
            { tag: 'zemun', count: 3 },
            { tag: 'breaking', count: 2 },
          ],
        });
      }
    
      {
        const router = createMockRouter();
        const calls = [];
        registerArticlesAdminRoutes(router, createDeps({
          aggregateResult: [{ id: 5, title: 'River update' }],
          onBuildPipeline(call) {
            calls.push(call);
          },
        }));
    
        const handlers = router.routes.get('GET /admin/related');
        const res = createResponse();
        await runHandlers(handlers, {
          query: {
            q: ' river ',
            ids: '9,5,9,3',
            excludeId: '9',
            limit: '7',
          },
        }, res);
    
        assert.equal(res.statusCode, 200);
        const pipelineCall = calls.find((entry) => entry.filter);
        assert.deepEqual(pipelineCall.filter.status, { $ne: 'archived' });
        assert.deepEqual(pipelineCall.filter.id, { $in: [5, 3] });
        assert.equal(pipelineCall.filter.title instanceof RegExp, true);
        assert.equal(pipelineCall.filter.title.source, 'river');
        assert.equal(pipelineCall.filter.title.flags, 'i');
        assert.deepEqual(pipelineCall.projection, {
          id: 1,
          title: 1,
          image: 1,
          category: 1,
          authorId: 1,
          date: 1,
          status: 1,
        });
        assert.deepEqual(pipelineCall.options, { limit: 7 });
        assert.deepEqual(res.body, {
          items: [{ id: 5, title: 'River update' }],
        });
      }
    
      {
        const router = createMockRouter();
        let pipelineBuilt = false;
        registerArticlesAdminRoutes(router, createDeps({
          onBuildPipeline(call) {
            if (call.filter) pipelineBuilt = true;
          },
        }));
    
        const handlers = router.routes.get('GET /admin/related');
        const res = createResponse();
        await runHandlers(handlers, {
          query: {
            ids: '12',
            excludeId: '12',
          },
        }, res);
    
        assert.equal(res.statusCode, 200);
        assert.equal(pipelineBuilt, false);
        assert.deepEqual(res.body, { items: [] });
      }
  });
});
