import assert from 'node:assert/strict';
import { createArticlesPublicRouter } from '../server/routes/articlesPublicRoutes.js';

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
    redirect(code, url) {
      this.statusCode = code;
      this.body = { url };
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    sendFile(payload) {
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

function getRouteHandlers(router, method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route?.methods?.[method]);
  return layer?.route?.stack?.map((entry) => entry.handle) || null;
}

function chainableLean(value) {
  return {
    select() { return this; },
    sort() { return this; },
    lean: async () => value,
  };
}

function createDeps(overrides = {}) {
  const findFilters = [];
  const findOneFilters = [];
  const updates = [];
  const creates = [];

  return {
    creates,
    findFilters,
    findOneFilters,
    updates,
    deps: {
      Article: {
        async exists() {
          return { _id: 'article' };
        },
        findOne() {
          return chainableLean({ id: 7, reactions: { fire: 3, shock: 1, laugh: 0, skull: 0, clap: 2 } });
        },
        findOneAndUpdate(filter, update) {
          updates.push({ filter, update });
          const fireDelta = Number(update?.$inc?.['reactions.fire'] || 0);
          const shockDelta = Number(update?.$inc?.['reactions.shock'] || 0);
          const laughDelta = Number(update?.$inc?.['reactions.laugh'] || 0);
          const skullDelta = Number(update?.$inc?.['reactions.skull'] || 0);
          const clapDelta = Number(update?.$inc?.['reactions.clap'] || 0);
          return chainableLean({
            id: 7,
            reactions: {
              fire: 3 + fireDelta,
              shock: 1 + shockDelta,
              laugh: 0 + laughDelta,
              skull: 0 + skullDelta,
              clap: 2 + clapDelta,
            },
          });
        },
      },
      ArticleReaction: {
        find(filter) {
          findFilters.push(filter);
          return chainableLean([{ emoji: 'fire' }, { emoji: 'clap' }]);
        },
        findOne(filter) {
          findOneFilters.push(filter);
          return chainableLean(null);
        },
        async create(payload) {
          creates.push(payload);
          return payload;
        },
      },
      ArticleView: {
        async create() { return null; },
      },
      Category: {
        findOne() {
          return chainableLean({ id: 'crime', name: 'Crime' });
        },
      },
      articleReactionLimiter: (_req, _res, next) => next(),
      articleReactionWindowMs: 86_400_000,
      articleViewWindowMs: 21_600_000,
      buildArticleProjection() { return null; },
      cacheMiddleware: (_req, _res, next) => next(),
      decodeTokenFromRequest() { return null; },
      async ensureArticleShareCard() { return null; },
      getArticleSectionFilter() { return null; },
      getPublishedFilter() { return { status: 'published' }; },
      getWindowKey() { return 42; },
      hasOwn(target, key) { return Object.prototype.hasOwnProperty.call(target || {}, key); },
      async hasPermissionForSection() { return false; },
      hashClientFingerprint(_req, scope) { return `hash:${scope}`; },
      isMongoDuplicateKeyError(error) { return Number(error?.code) === 11000; },
      normalizeText(value, maxLength = 200) { return String(value || '').trim().slice(0, maxLength); },
      parsePositiveInt(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isInteger(parsed) ? parsed : fallback;
      },
      async resolveShareFallbackSource() { return null; },
      transparentPng1x1: Buffer.from(''),
      ...overrides,
    },
  };
}

export async function runArticlesPublicRoutesTests() {
  {
    const { deps, findFilters } = createDeps();
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'get', '/:id/reactions/me');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(findFilters.length, 1);
    assert.deepEqual(findFilters[0], {
      articleId: 7,
      windowKey: 42,
      voterHash: { $in: ['hash:react:7', 'hash:react:7:fire', 'hash:react:7:shock', 'hash:react:7:laugh', 'hash:react:7:skull', 'hash:react:7:clap'] },
    });
    assert.deepEqual(res.body, {
      reacted: {
        fire: true,
        shock: false,
        laugh: false,
        skull: false,
        clap: true,
      },
      hasReacted: true,
    });
  }

  {
    const { deps } = createDeps({
      Article: {
        async exists() {
          return null;
        },
      },
    });
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'get', '/:id/reactions/me');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, headers: {} }, res);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'Not found' });
  }

  {
    const { deps, creates, findOneFilters } = createDeps();
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'post', '/:id/react');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, body: { emoji: 'shock' }, headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(findOneFilters.length, 1);
    assert.deepEqual(findOneFilters[0], {
      articleId: 7,
      emoji: 'shock',
      windowKey: 42,
      voterHash: { $in: ['hash:react:7', 'hash:react:7:shock'] },
    });
    assert.deepEqual(creates, [{
      articleId: 7,
      emoji: 'shock',
      voterHash: 'hash:react:7:shock',
      windowKey: 42,
      expiresAt: creates[0].expiresAt,
    }]);
    assert.deepEqual(res.body, {
      reactions: { fire: 3, shock: 2, laugh: 0, skull: 0, clap: 2 },
      emoji: 'shock',
      hasReacted: true,
    });
  }

  {
    const findOneCalls = [];
    const creates = [];
    const { deps } = createDeps({
      ArticleReaction: {
        find(filter) {
          return chainableLean([{ emoji: 'fire' }]);
        },
        findOne(filter) {
          findOneCalls.push(filter);
          if (filter.emoji === 'fire') return chainableLean({ emoji: 'fire' });
          return chainableLean(null);
        },
        async create(payload) {
          creates.push(payload);
          return payload;
        },
      },
    });
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'post', '/:id/react');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, body: { emoji: 'clap' }, headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(findOneCalls, [{
      articleId: 7,
      emoji: 'clap',
      windowKey: 42,
      voterHash: { $in: ['hash:react:7', 'hash:react:7:clap'] },
    }]);
    assert.deepEqual(creates, [{
      articleId: 7,
      emoji: 'clap',
      voterHash: 'hash:react:7:clap',
      windowKey: 42,
      expiresAt: creates[0].expiresAt,
    }]);
    assert.deepEqual(res.body, {
      reactions: { fire: 3, shock: 1, laugh: 0, skull: 0, clap: 3 },
      emoji: 'clap',
      hasReacted: true,
    });
  }

  {
    const duplicateError = Object.assign(new Error('dup'), { code: 11000 });
    const { deps } = createDeps({
      ArticleReaction: {
        find(filter) {
          return chainableLean([{ emoji: 'fire' }]);
        },
        findOne(filter) {
          return chainableLean({ emoji: 'shock' });
        },
        async create() {
          throw duplicateError;
        },
      },
    });
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'post', '/:id/react');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, body: { emoji: 'shock' }, headers: {} }, res);

    assert.equal(res.statusCode, 429);
    assert.deepEqual(res.body, {
      error: 'Already reacted',
      emoji: 'shock',
      hasReacted: true,
    });
  }
}
