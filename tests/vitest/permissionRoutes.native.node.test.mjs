import { describe, expect, it, vi } from 'vitest';

import { registerPermissionRoutes } from '../../server/routes/permissionRoutes.js';
import { createMockApp, createResponse, runHandlers } from './helpers/routeHarness.mjs';

describe('permissionRoutes', () => {
  it('reuses the cached permissions list and invalidates it after updates', async () => {
    const app = createMockApp();
    const find = vi.fn(() => ({
      lean: async () => ([
        { _id: 'mongo-editor', role: 'editor', permissions: { articles: true } },
      ]),
    }));
    const getPermissionDoc = vi.fn(async (role) => (
      role === 'editor'
        ? { _id: 'mongo-editor', role: 'editor', permissions: { articles: true } }
        : null
    ));
    const invalidatePermissionCache = vi.fn();
    const invalidatePermissionRoleCache = vi.fn();

    registerPermissionRoutes(app, {
      DEFAULT_PERMISSION_DOCS: {},
      ensureDefaultPermissionDocs: vi.fn(async () => {}),
      getPermissionDoc,
      hasPermissionForSection: vi.fn(async (user, section) => (
        section === 'permissions' && user?.role === 'admin'
      )),
      invalidatePermissionCache,
      invalidatePermissionRoleCache,
      normalizeText: (value, max = 255) => String(value ?? '').trim().slice(0, max),
      Permission: {
        find,
        updateOne: vi.fn(async () => ({ acknowledged: true })),
        findOne: vi.fn(() => ({ lean: async () => null })),
        findOneAndUpdate: vi.fn(async () => ({
          toJSON: () => ({ role: 'editor', permissions: { articles: false } }),
        })),
      },
      publicError: (message) => message,
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
      sanitizePermissionMap: (value) => value || {},
    });

    const getHandlers = app.routes.get('GET /api/permissions');
    const firstRes = createResponse();
    await runHandlers(getHandlers, { user: { role: 'admin' } }, firstRes);
    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.body).toEqual([{ role: 'editor', permissions: { articles: true } }]);
    expect(find).toHaveBeenCalledTimes(1);

    const secondRes = createResponse();
    await runHandlers(getHandlers, { user: { role: 'admin' } }, secondRes);
    expect(secondRes.statusCode).toBe(200);
    expect(find).toHaveBeenCalledTimes(1);

    const ownRes = createResponse();
    await runHandlers(getHandlers, { user: { role: 'editor' } }, ownRes);
    expect(ownRes.statusCode).toBe(200);
    expect(ownRes.body).toEqual([{ role: 'editor', permissions: { articles: true } }]);
    expect(getPermissionDoc).toHaveBeenCalledWith('editor');

    const putHandlers = app.routes.get('PUT /api/permissions/:role');
    const putRes = createResponse();
    await runHandlers(putHandlers, {
      params: { role: 'editor' },
      body: { permissions: { articles: false } },
      user: { role: 'admin' },
    }, putRes);

    expect(putRes.statusCode).toBe(200);
    expect(putRes.body).toEqual({ role: 'editor', permissions: { articles: false } });
    expect(invalidatePermissionCache).toHaveBeenCalledTimes(1);
    expect(invalidatePermissionRoleCache).toHaveBeenCalledWith('editor');

    const refreshedRes = createResponse();
    await runHandlers(getHandlers, { user: { role: 'admin' } }, refreshedRes);
    expect(refreshedRes.statusCode).toBe(200);
    expect(find).toHaveBeenCalledTimes(2);
  });
});
