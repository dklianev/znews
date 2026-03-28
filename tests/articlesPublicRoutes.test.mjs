import assert from 'node:assert/strict';
import { createArticlesPublicRouter } from '../server/routes/articlesPublicRoutes.js';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    getHeader(name) {
      return this.headers[name];
    },
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
    skip() { return this; },
    limit() { return this; },
    lean: async () => value,
  };
}

function createDeps(overrides = {}) {
  const findFilters = [];
  const articleListFilters = [];
  const findOneFilters = [];
  const findOneDeleteFilters = [];
  const invalidations = [];
  const updates = [];
  const creates = [];
  const reactionDocs = [{ emoji: 'fire' }, { emoji: 'clap' }];

  return {
    creates,
    findFilters,
    articleListFilters,
    findOneFilters,
    findOneDeleteFilters,
    invalidations,
    updates,
    deps: {
      Article: {
        async exists() {
          return { _id: 'article' };
        },
        find(filter) {
          articleListFilters.push(filter);
          return chainableLean([
            { id: 7, category: 'crime', title: 'Crime story' },
            { id: 8, category: 'underground', title: 'Underground story' },
          ]);
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
        async countDocuments() {
          return 2;
        },
      },
      ArticleReaction: {
        find(filter) {
          findFilters.push(filter);
          return chainableLean(reactionDocs.map((doc) => ({ ...doc })));
        },
        findOne(filter) {
          findOneFilters.push(filter);
          return chainableLean(reactionDocs.find((doc) => doc.emoji === filter?.emoji) || null);
        },
        findOneAndDelete(filter) {
          findOneDeleteFilters.push(filter);
          const matchIndex = reactionDocs.findIndex((doc) => doc.emoji === filter?.emoji);
          if (matchIndex >= 0) {
            const [removed] = reactionDocs.splice(matchIndex, 1);
            return chainableLean(removed);
          }
          return chainableLean({ emoji: filter.emoji });
        },
        async create(payload) {
          creates.push(payload);
          reactionDocs.push({ emoji: payload.emoji, voterHash: payload.voterHash });
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
      hashBrowserClientFingerprint(req, scope) {
        return req?.headers?.['x-zn-client-id'] ? `browser:${scope}` : `hash:${scope}`;
      },
      hashClientFingerprint(_req, scope) { return `hash:${scope}`; },
      invalidateCacheTags(tags, options) {
        invalidations.push({ tags, options });
        return 1;
      },
      isProd: false,
      isMongoDuplicateKeyError(error) { return Number(error?.code) === 11000; },
      normalizeText(value, maxLength = 200) { return String(value || '').trim().slice(0, maxLength); },
      parseCookies(req) {
        const raw = typeof req?.headers?.cookie === 'string' ? req.headers.cookie : '';
        if (!raw) return {};
        return raw.split(';').reduce((acc, part) => {
          const [key, ...rest] = part.trim().split('=');
          if (!key || rest.length === 0) return acc;
          acc[key] = rest.join('=');
          return acc;
        }, {});
      },
      parsePositiveInt(value, fallback) {
        const parsed = Number.parseInt(value, 10);
        return Number.isInteger(parsed) ? parsed : fallback;
      },
      randomUUID() {
        return 'server-uuid-123456';
      },
      async resolveShareFallbackSource() { return null; },
      serializeCookie(name, value) {
        return `${name}=${value}`;
      },
      transparentPng1x1: Buffer.from(''),
      ...overrides,
    },
  };
}

export async function runArticlesPublicRoutesTests() {
  {
    const { deps, articleListFilters } = createDeps();
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'get', '/');
    const res = createResponse();

    await runHandlers(handlers, {
      query: { categories: 'crime,underground', page: '1', limit: '6' },
      headers: {},
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(articleListFilters[0], {
      status: 'published',
      category: { $in: ['crime', 'underground'] },
    });
    assert.equal(res.body?.items?.length, 2);
    assert.equal(res.body?.total, 2);
  }

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
      voterHash: { $in: ['browser:react:7', 'browser:react:7:fire', 'browser:react:7:shock', 'browser:react:7:laugh', 'browser:react:7:skull', 'browser:react:7:clap'] },
      $or: [{ active: { $exists: false } }, { active: true }],
    });
    assert.equal(res.headers['Set-Cookie'], 'zn_react_id=zn-browser-server-uuid-123456');
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
    const { deps, findFilters } = createDeps();
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'get', '/:id/reactions/me');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { id: '7' },
      headers: { 'x-zn-client-id': 'zn-browser-123456' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(findFilters[0], {
      articleId: 7,
      windowKey: 42,
      voterHash: { $in: ['browser:react:7', 'browser:react:7:fire', 'browser:react:7:shock', 'browser:react:7:laugh', 'browser:react:7:skull', 'browser:react:7:clap'] },
      $or: [{ active: { $exists: false } }, { active: true }],
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
    const { deps, findFilters } = createDeps({
      ArticleReaction: {
        find(filter) {
          findFilters.push(filter);
          return chainableLean([]);
        },
        findOne(filter) {
          return chainableLean(null);
        },
        async create(payload) {
          return payload;
        },
      },
    });
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'get', '/:id/reactions/me');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(findFilters[0], {
      articleId: 7,
      windowKey: 42,
      voterHash: { $in: ['browser:react:7', 'browser:react:7:fire', 'browser:react:7:shock', 'browser:react:7:laugh', 'browser:react:7:skull', 'browser:react:7:clap'] },
      $or: [{ active: { $exists: false } }, { active: true }],
    });
    assert.deepEqual(res.body, {
      reacted: {
        fire: false,
        shock: false,
        laugh: false,
        skull: false,
        clap: false,
      },
      hasReacted: false,
    });
  }

  {
    const { deps, creates, findOneFilters, invalidations } = createDeps();
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
      voterHash: { $in: ['browser:react:7', 'browser:react:7:shock'] },
      $or: [{ active: { $exists: false } }, { active: true }],
    });
    assert.deepEqual(creates, [{
      articleId: 7,
      emoji: 'shock',
      voterHash: 'browser:react:7:shock',
      windowKey: 42,
      expiresAt: creates[0].expiresAt,
    }]);
    assert.deepEqual(res.body, {
      reactions: { fire: 3, shock: 2, laugh: 0, skull: 0, clap: 2 },
      emoji: 'shock',
      reacted: {
        fire: true,
        shock: true,
        laugh: false,
        skull: false,
        clap: true,
      },
      hasReacted: true,
    });
    assert.deepEqual(invalidations[0], {
      tags: ['article-detail', 'author-stats'],
      options: { reason: 'article-reaction:7:shock' },
    });
  }

  {
    const { deps, creates, findOneFilters } = createDeps();
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'post', '/:id/react');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { id: '7' },
      body: { emoji: 'shock' },
      headers: { 'x-zn-client-id': 'zn-browser-123456' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(findOneFilters[0], {
      articleId: 7,
      emoji: 'shock',
      windowKey: 42,
      voterHash: { $in: ['browser:react:7', 'browser:react:7:shock'] },
      $or: [{ active: { $exists: false } }, { active: true }],
    });
    assert.deepEqual(creates, [{
      articleId: 7,
      emoji: 'shock',
      voterHash: 'browser:react:7:shock',
      windowKey: 42,
      expiresAt: creates[0].expiresAt,
    }]);
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
      voterHash: { $in: ['browser:react:7', 'browser:react:7:clap'] },
      $or: [{ active: { $exists: false } }, { active: true }],
    }]);
    assert.deepEqual(creates, [{
      articleId: 7,
      emoji: 'clap',
      voterHash: 'browser:react:7:clap',
      windowKey: 42,
      expiresAt: creates[0].expiresAt,
    }]);
    assert.deepEqual(res.body, {
      reactions: { fire: 3, shock: 1, laugh: 0, skull: 0, clap: 3 },
      emoji: 'clap',
      reacted: {
        fire: true,
        shock: false,
        laugh: false,
        skull: false,
        clap: false,
      },
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
      reacted: {
        fire: true,
        shock: false,
        laugh: false,
        skull: false,
        clap: false,
      },
      hasReacted: true,
    });
  }

  {
    const { deps, creates, findOneFilters } = createDeps({
      ArticleReaction: {
        find(filter) {
          return chainableLean([]);
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
    });
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'post', '/:id/react');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, body: { emoji: 'shock' }, headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(findOneFilters[0], {
      articleId: 7,
      emoji: 'shock',
      windowKey: 42,
      voterHash: { $in: ['browser:react:7', 'browser:react:7:shock'] },
      $or: [{ active: { $exists: false } }, { active: true }],
    });
    assert.deepEqual(creates, [{
      articleId: 7,
      emoji: 'shock',
      voterHash: 'browser:react:7:shock',
      windowKey: 42,
      expiresAt: creates[0].expiresAt,
    }]);
    assert.deepEqual(res.body, {
      reactions: { fire: 3, shock: 2, laugh: 0, skull: 0, clap: 2 },
      emoji: 'shock',
      reacted: {
        fire: false,
        shock: false,
        laugh: false,
        skull: false,
        clap: false,
      },
      hasReacted: false,
    });
  }

  {
    const { deps, findOneDeleteFilters, invalidations } = createDeps();
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'delete', '/:id/react');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, body: { emoji: 'shock' }, headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(findOneDeleteFilters[0], {
      articleId: 7,
      emoji: 'shock',
      windowKey: 42,
      voterHash: { $in: ['browser:react:7', 'browser:react:7:shock'] },
      $or: [{ active: { $exists: false } }, { active: true }],
    });
    assert.deepEqual(res.body, {
      reactions: { fire: 3, shock: 0, laugh: 0, skull: 0, clap: 2 },
      emoji: 'shock',
      removed: true,
      reacted: {
        fire: true,
        shock: false,
        laugh: false,
        skull: false,
        clap: true,
      },
      hasReacted: true,
    });
    assert.deepEqual(invalidations[0], {
      tags: ['article-detail', 'author-stats'],
      options: { reason: 'article-reaction:7:shock' },
    });
  }

  {
    const { deps, findOneDeleteFilters } = createDeps();
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'delete', '/:id/react');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { id: '7' },
      body: { emoji: 'shock' },
      headers: { 'x-zn-client-id': 'zn-browser-123456' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(findOneDeleteFilters[0], {
      articleId: 7,
      emoji: 'shock',
      windowKey: 42,
      voterHash: { $in: ['browser:react:7', 'browser:react:7:shock'] },
      $or: [{ active: { $exists: false } }, { active: true }],
    });
  }

  {
    const { deps } = createDeps({
      ArticleReaction: {
        find() {
          return chainableLean([]);
        },
        findOne() {
          return chainableLean(null);
        },
        findOneAndDelete() {
          return chainableLean(null);
        },
        async create(payload) {
          return payload;
        },
      },
    });
    const router = createArticlesPublicRouter(deps);
    const handlers = getRouteHandlers(router, 'delete', '/:id/react');
    const res = createResponse();

    await runHandlers(handlers, { params: { id: '7' }, body: { emoji: 'shock' }, headers: {} }, res);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, {
      error: 'Reaction not found',
      emoji: 'shock',
      reacted: {
        fire: false,
        shock: false,
        laugh: false,
        skull: false,
        clap: false,
      },
      hasReacted: false,
    });
  }
}
