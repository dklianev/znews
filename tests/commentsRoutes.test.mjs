import assert from 'node:assert/strict';
import { createCommentsRouter } from '../server/routes/commentsRoutes.js';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
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
  const next = async (error) => {
    if (error) throw error;
    const handler = handlers[index++];
    if (!handler) return undefined;
    if (handler.length >= 3) {
      return handler(req, res, (nextError) => next(nextError));
    }
    return handler(req, res);
  };
  return next();
}

function getRouteHandlers(router, method, path) {
  const layer = router.stack.find((entry) => (
    entry.route
    && entry.route.path === path
    && entry.route.methods?.[method.toLowerCase()]
  ));
  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }
  return layer.route.stack.map((entry) => entry.handle);
}

function createCommentsDeps(overrides = {}) {
  const articleLookups = [];
  const createdComments = [];
  const updatedComments = [];

  class MockComment {
    static find(filter) {
      return {
        sort() {
          return {
            skip() { return this; },
            limit() { return this; },
            lean: async () => [],
          };
        },
      };
    }

    static async countDocuments() {
      return 0;
    }

    static async create(doc) {
      createdComments.push(doc);
      return {
        toJSON() {
          return { ...doc };
        },
      };
    }

    static findOne(query) {
      return {
        lean: async () => {
          if (query.id === 700) {
            return { id: 700, articleId: query.articleId, approved: true };
          }
          return null;
        },
      };
    }

    static async findOneAndUpdate(query, update, options) {
      updatedComments.push({ query, update, options });
      if (query.id === 404) return null;
      return {
        toJSON() {
          return {
            id: query.id,
            ...(update.$set || {}),
          };
        },
      };
    }

    static async exists(query) {
      if (Object.prototype.hasOwnProperty.call(query, 'articleId')) {
        articleLookups.push(query);
        return query.id === 77;
      }
      return query.id !== 404;
    }

    static async updateMany() {
      return { acknowledged: true };
    }

    static async deleteMany() {
      return { acknowledged: true };
    }
  }

  const deps = {
    Article: {
      async exists(query) {
        articleLookups.push(query);
        return query.id === 77;
      },
    },
    AuditLog: {
      create() {
        return Promise.resolve();
      },
    },
    collectCommentThreadIds: async (id) => [id],
    commentContainsBlockedTerms(text) {
      return text.includes('banned');
    },
    commentCreateLimiter: (_req, _res, next) => next(),
    commentReactionLimiter: (_req, _res, next) => next(),
    Comment: MockComment,
    CommentReaction: {
      async findOneAndUpdate() {
        return null;
      },
      async deleteOne() {
        return { deletedCount: 1 };
      },
      async deleteMany() {
        return { deletedCount: 1 };
      },
    },
    decodeTokenFromRequest() {
      return null;
    },
    getPublishedFilter() {
      return { status: 'published' };
    },
    hasOwn(target, key) {
      return Object.prototype.hasOwnProperty.call(target || {}, key);
    },
    async hasPermissionForSection() {
      return false;
    },
    hashClientFingerprint() {
      return 'comment-fingerprint';
    },
    async nextNumericId() {
      return 912;
    },
    normalizeCommentReaction(value) {
      return value === 'like' || value === 'dislike' ? value : null;
    },
    normalizeText(value, maxLength = 200) {
      return String(value || '').trim().slice(0, maxLength);
    },
    parseCollectionPagination() {
      return {
        shouldPaginate: false,
        page: 1,
        limit: 80,
        skip: 0,
      };
    },
    publicError(error) {
      return error?.message || 'Server error';
    },
    requireAuth(req, _res, next) {
      req.user = { name: 'Moderator', userId: 1 };
      next();
    },
    requirePermission() {
      return (_req, _res, next) => next();
    },
    async syncCommentReactionTotals(id) {
      return {
        toJSON() {
          return { id, likes: 1, dislikes: 0 };
        },
      };
    },
    ...overrides,
  };

  return {
    deps,
    articleLookups,
    createdComments,
    updatedComments,
  };
}

export async function runCommentsRoutesTests() {
  {
    const { deps } = createCommentsDeps();
    const router = createCommentsRouter(deps);
    const handlers = getRouteHandlers(router, 'post', '/');
    const res = createResponse();

    await runHandlers(handlers, {
      body: { articleId: 'oops', author: '   ', text: '' },
      query: {},
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, '\u041f\u043e\u043f\u044a\u043b\u043d\u0438 \u0438\u043c\u0435 \u0438 \u0442\u0435\u043a\u0441\u0442, \u0437\u0430 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0442\u0438\u0448 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440.');
    assert.deepEqual(res.body?.fieldErrors, {
      articleId: '\u0421\u0442\u0430\u0442\u0438\u044f\u0442\u0430 \u043d\u0435 \u0435 \u0432\u0430\u043b\u0438\u0434\u043d\u0430.',
      author: '\u0418\u043c\u0435\u0442\u043e \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u043e.',
      text: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u044a\u0442 \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u0435\u043d.',
    });
  }

  {
    const { deps, createdComments } = createCommentsDeps();
    const router = createCommentsRouter(deps);
    const handlers = getRouteHandlers(router, 'post', '/');
    const res = createResponse();

    await runHandlers(handlers, {
      body: {
        articleId: '77',
        parentId: 'missing',
        author: 'Reporter',
        text: 'New reply',
      },
      query: {},
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(createdComments.length, 0);
    assert.equal(res.body?.error, '\u0420\u043e\u0434\u0438\u0442\u0435\u043b\u0441\u043a\u0438\u044f\u0442 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440 \u043d\u0435 \u0435 \u0432\u0430\u043b\u0438\u0434\u0435\u043d.');
    assert.deepEqual(res.body?.fieldErrors, {
      parentId: '\u0420\u043e\u0434\u0438\u0442\u0435\u043b\u0441\u043a\u0438\u044f\u0442 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440 \u043d\u0435 \u0435 \u0432\u0430\u043b\u0438\u0434\u0435\u043d.',
    });
  }

  {
    const { deps, createdComments, articleLookups } = createCommentsDeps();
    const router = createCommentsRouter(deps);
    const handlers = getRouteHandlers(router, 'post', '/');
    const res = createResponse();

    await runHandlers(handlers, {
      body: {
        articleId: '77',
        parentId: '700',
        author: 'Reporter',
        text: 'Legit reply',
      },
      query: {},
    }, res);

    assert.equal(res.statusCode, 201);
    assert.equal(createdComments.length, 1);
    assert.deepEqual(articleLookups, [{ id: 77, status: 'published' }]);
    assert.equal(createdComments[0].parentId, 700);
    assert.equal(res.body?.author, 'Reporter');
    assert.equal(res.body?.text, 'Legit reply');
  }

  {
    const { deps, updatedComments } = createCommentsDeps();
    const router = createCommentsRouter(deps);
    const handlers = getRouteHandlers(router, 'put', '/:id');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { id: '12' },
      body: { text: '   ' },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(updatedComments.length, 0);
    assert.equal(res.body?.error, '\u041f\u043e\u043f\u044a\u043b\u043d\u0438 \u0438\u043c\u0435 \u0438 \u0442\u0435\u043a\u0441\u0442, \u0437\u0430 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0442\u0438\u0448 \u043a\u043e\u043c\u0435\u043d\u0442\u0430\u0440.');
    assert.deepEqual(res.body?.fieldErrors, {
      text: '\u041a\u043e\u043c\u0435\u043d\u0442\u0430\u0440\u044a\u0442 \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u0435\u043d.',
    });
  }

  {
    const { deps, updatedComments } = createCommentsDeps();
    const router = createCommentsRouter(deps);
    const handlers = getRouteHandlers(router, 'put', '/:id');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { id: '12' },
      body: { text: 'Updated moderator copy' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(updatedComments, [{
      query: { id: 12 },
      update: { $set: { text: 'Updated moderator copy' } },
      options: { returnDocument: 'after' },
    }]);
    assert.equal(res.body?.text, 'Updated moderator copy');
  }
}
