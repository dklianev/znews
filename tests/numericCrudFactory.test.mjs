import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createNumericCrudFactory } from '../server/routes/factories/numericCrudFactory.js';

function createResponse() {
  return {
    statusCode: 200,
    payload: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
  };
}

function getRoute(router, method, path) {
  return router.stack.find((layer) => layer.route && layer.route.path === path && layer.route.methods[method]);
}

function createModel(items = []) {
  const state = {
    countCalls: [],
    createCalls: [],
    deleteCalls: [],
    findCalls: 0,
    sortArgs: [],
    limitArgs: [],
    skipArgs: [],
    updateCalls: [],
  };

  const model = {
    state,
    find() {
      state.findCalls += 1;
      let currentItems = items.map((item) => ({ ...item }));
      return {
        sort(arg) {
          state.sortArgs.push(arg);
          return this;
        },
        skip(arg) {
          state.skipArgs.push(arg);
          return this;
        },
        limit(arg) {
          state.limitArgs.push(arg);
          return this;
        },
        async lean() {
          return currentItems;
        },
      };
    },
    async countDocuments(query) {
      state.countCalls.push(query);
      return 12;
    },
    async create(doc) {
      state.createCalls.push(doc);
      return {
        toJSON() {
          return { ...doc };
        },
      };
    },
    async findOneAndUpdate(query, update) {
      state.updateCalls.push({ query, update });
      if (query.id === 404) return null;
      return {
        toJSON() {
          return { id: query.id, ...update.$set };
        },
      };
    },
    async deleteOne(query) {
      state.deleteCalls.push(query);
      return { deletedCount: query.id === 404 ? 0 : 1 };
    },
  };

  return model;
}

describe('numericCrudFactory', () => {
  it('keeps numericCrudFactory legacy coverage green', async () => {
      const cacheMiddleware = function cacheMiddleware(_req, _res, next) { if (next) next(); };
      const requireAuth = function requireAuth(_req, _res, next) { if (next) next(); };
      const requireAdmin = function requireAdmin(_req, _res, next) { if (next) next(); };
      const permissionFns = [];
      function requirePermission(section) {
        const fn = function requirePermissionForSection(_req, _res, next) { if (next) next(); };
        fn.section = section;
        permissionFns.push(fn);
        return fn;
      }
    
      const auditCalls = [];
      const invalidations = [];
    
      const numericCrud = createNumericCrudFactory({
        AuditLog: {
          create(payload) {
            auditCalls.push(payload);
            return Promise.resolve();
          },
        },
        cacheMiddleware,
        invalidateCacheTags(tags, options) {
          invalidations.push({ tags, options });
        },
        nextNumericId: async () => 77,
        parseCollectionPagination(query) {
          if (query.mode === 'paged') {
            return { shouldPaginate: true, skip: 10, limit: 5, page: 3 };
          }
          return { shouldPaginate: false, skip: 0, limit: 50, page: 1 };
        },
        publicError(error) {
          return `public:${error.message}`;
        },
        requireAdmin,
        requireAuth,
        requirePermission,
      });
    
      {
        const model = createModel([
          { id: 1, title: 'One', _id: 'mongo1', __v: 0, secret: 'hide' },
          { id: 2, title: 'Two', _id: 'mongo2', __v: 0, secret: 'hide2' },
        ]);
        const router = numericCrud(model, 'authors', { id: -1 }, ['secret'], 'profiles');
        const getRouteLayer = getRoute(router, 'get', '/');
        assert.equal(getRouteLayer.route.stack[0].handle, cacheMiddleware);
        const res = createResponse();
        await getRouteLayer.route.stack[1].handle({ query: {} }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.payload, [
          { id: 1, title: 'One' },
          { id: 2, title: 'Two' },
        ]);
        assert.deepEqual(model.state.sortArgs, [{ id: -1 }]);
      }
    
      {
        const model = createModel([{ id: 1, name: 'Paged' }]);
        const router = numericCrud(model, 'jobs', { id: -1 }, [], 'jobs');
        const getRouteLayer = getRoute(router, 'get', '/');
        const res = createResponse();
        await getRouteLayer.route.stack[1].handle({ query: { mode: 'paged' } }, res);
        assert.equal(res.payload.page, 3);
        assert.equal(res.payload.limit, 5);
        assert.equal(res.payload.total, 12);
        assert.equal(res.payload.totalPages, 3);
        assert.deepEqual(model.state.skipArgs, [10]);
        assert.deepEqual(model.state.limitArgs, [5]);
        assert.deepEqual(model.state.countCalls, [{}]);
      }
    
      {
        const model = createModel();
        const router = numericCrud(model, 'gallery');
        const postRouteLayer = getRoute(router, 'post', '/');
        assert.equal(postRouteLayer.route.stack[0].handle, requireAuth);
        assert.equal(postRouteLayer.route.stack[1].handle, requireAdmin);
        const res = createResponse();
        await postRouteLayer.route.stack[2].handle({
          body: { title: 'Created', id: 1, _id: 'mongo', __v: 9 },
          user: { name: 'Admin', userId: 5 },
        }, res);
        assert.equal(res.statusCode, 201);
        assert.deepEqual(model.state.createCalls, [{ title: 'Created', id: 77 }]);
        assert.deepEqual(auditCalls.at(-1), {
          user: 'Admin',
          userId: 5,
          action: 'create',
          resource: 'gallery',
          resourceId: 77,
          details: 'Created',
        });
        assert.deepEqual(invalidations.at(-1), {
          tags: ['gallery', 'bootstrap', 'homepage'],
          options: { reason: 'gallery-mutation' },
        });
      }
    
      {
        const model = createModel();
        const router = numericCrud(model, 'jobs', { id: -1 }, [], 'jobs');
        const postRouteLayer = getRoute(router, 'post', '/');
        assert.equal(postRouteLayer.route.stack[0].handle, requireAuth);
        assert.equal(postRouteLayer.route.stack[1].handle.section, 'jobs');
        const putRouteLayer = getRoute(router, 'put', '/:id');
    
        const invalidRes = createResponse();
        await putRouteLayer.route.stack[2].handle({ params: { id: 'bad' }, body: {} }, invalidRes);
        assert.equal(invalidRes.statusCode, 400);
        assert.deepEqual(invalidRes.payload, { error: 'Invalid id' });
    
        const emptyRes = createResponse();
        await putRouteLayer.route.stack[2].handle({ params: { id: '7' }, body: { id: 7, _id: 'mongo', __v: 1 } }, emptyRes);
        assert.equal(emptyRes.statusCode, 400);
        assert.deepEqual(emptyRes.payload, { error: 'No valid fields to update' });
    
        const updateRes = createResponse();
        await putRouteLayer.route.stack[2].handle({
          params: { id: '8' },
          body: { title: 'Updated', id: 8 },
          user: { name: 'Editor', userId: 9 },
        }, updateRes);
        assert.equal(updateRes.statusCode, 200);
        assert.deepEqual(updateRes.payload, { id: 8, title: 'Updated' });
        assert.deepEqual(model.state.updateCalls.at(-1), {
          query: { id: 8 },
          update: { $set: { title: 'Updated' } },
        });
      }
    
      {
        const model = createModel();
        const router = numericCrud(model, 'wanted', { id: -1 }, [], 'wanted');
        const deleteRouteLayer = getRoute(router, 'delete', '/:id');
    
        const notFoundRes = createResponse();
        await deleteRouteLayer.route.stack[2].handle({ params: { id: '404' } }, notFoundRes);
        assert.equal(notFoundRes.statusCode, 404);
        assert.deepEqual(notFoundRes.payload, { error: 'Not found' });
    
        const okRes = createResponse();
        await deleteRouteLayer.route.stack[2].handle({
          params: { id: '5' },
          user: { name: 'Editor', userId: 11 },
        }, okRes);
        assert.equal(okRes.statusCode, 200);
        assert.deepEqual(okRes.payload, { ok: true });
        assert.deepEqual(auditCalls.at(-1), {
          user: 'Editor',
          userId: 11,
          action: 'delete',
          resource: 'wanted',
          resourceId: 5,
          details: '',
        });
      }
  });
});
