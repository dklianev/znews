import { describe, expect, it, vi } from 'vitest';
import { createCategoriesRouter } from '../../server/routes/categoriesRoutes.js';
import { chainableLean, createResponse, getRouteHandlers, runHandlers } from './helpers/routeHarness.mjs';

describe('categoriesRoutes', () => {
  it('lists categories without mongo internals', async () => {
    const router = createCategoriesRouter({
      Article: { countDocuments: async () => 0 },
      Category: {
        find: () => chainableLean([{ id: 'crime', name: 'Криминални', _id: 'mongo', __v: 2 }]),
      },
      hasOwn: (target, key) => Object.prototype.hasOwnProperty.call(target || {}, key),
      invalidateCacheGroup: vi.fn(),
      normalizeText: (value) => String(value || '').trim(),
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
    });

    const handlers = getRouteHandlers(router, 'get', '/');
    const res = createResponse();
    await runHandlers(handlers, {}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 'crime', name: 'Криминални' }]);
  });

  it('validates create payloads and blocks deletes for used categories', async () => {
    const invalidateCacheGroup = vi.fn();
    const router = createCategoriesRouter({
      Article: { countDocuments: async () => 3 },
      Category: {
        find: () => chainableLean([]),
        create: async (payload) => ({ toJSON: () => payload }),
        deleteOne: async () => ({ deletedCount: 1 }),
        findOneAndUpdate: async () => null,
      },
      hasOwn: (target, key) => Object.prototype.hasOwnProperty.call(target || {}, key),
      invalidateCacheGroup,
      normalizeText: (value) => String(value || '').trim(),
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
    });

    const createHandlers = getRouteHandlers(router, 'post', '/');
    const invalidRes = createResponse();
    await runHandlers(createHandlers, { body: { id: '', name: '' } }, invalidRes);
    expect(invalidRes.statusCode).toBe(400);

    const validRes = createResponse();
    await runHandlers(createHandlers, { body: { id: 'crime', name: 'Криминални', icon: 'sirene' } }, validRes);
    expect(validRes.statusCode).toBe(200);
    expect(validRes.body).toEqual({ id: 'crime', name: 'Криминални', icon: 'sirene' });
    expect(invalidateCacheGroup).toHaveBeenCalledWith('categories', 'categories-mutation');

    const deleteHandlers = getRouteHandlers(router, 'delete', '/:id');
    const conflictRes = createResponse();
    await runHandlers(deleteHandlers, { params: { id: 'crime' } }, conflictRes);
    expect(conflictRes.statusCode).toBe(409);
  });
});

