import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { registerOpsRoutes } from '../server/routes/opsRoutes.js';

function createMockApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers);
    },
    routes,
  };
}

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

describe('opsRoutes', () => {
  it('filters audit log queries by resource, action and search text', async () => {
    const app = createMockApp();
    const capturedFilters = [];

    registerOpsRoutes(app, {
      AuditLog: {
        find(filter) {
          capturedFilters.push(filter);
          return {
            sort() {
              return {
                limit() {
                  return {
                    lean: async () => [{
                      _id: '507f1f77bcf86cd799439011',
                      action: 'update',
                      resource: 'tips',
                      resourceId: 11,
                      user: 'Ани Петрова',
                      details: 'status:processed',
                      timestamp: new Date('2026-04-09T10:30:00.000Z'),
                    }],
                  };
                },
              };
            },
          };
        },
      },
      normalizeText(value, max = 120) {
        return String(value || '').trim().slice(0, max);
      },
      parsePositiveInt(value, fallback) {
        return value == null ? fallback : Number.parseInt(value, 10);
      },
      publicError(error) {
        return error?.message || 'error';
      },
      requireAdmin(_req, _res, next) {
        next();
      },
      requireAuth(req, _res, next) {
        req.user = { id: 1, name: 'Ани Петрова', username: 'ani' };
        next();
      },
      requirePermission() {
        return (_req, _res, next) => next();
      },
      streamBackupExport: async () => {},
    });

    const handlers = app.routes.get('GET /api/audit-log');
    const res = createResponse();

    await runHandlers(handlers, {
      query: {
        resource: 'tips',
        action: 'update',
        resourceId: '11',
        q: '11',
        limit: '50',
      },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(capturedFilters.length, 1);
    assert.equal(capturedFilters[0].resource, 'tips');
    assert.equal(capturedFilters[0].action, 'update');
    assert.equal(capturedFilters[0].resourceId, 11);
    assert.equal(Array.isArray(capturedFilters[0].$and), true);
    assert.deepEqual(res.body?.items?.[0]?.resource, 'tips');
    assert.equal(res.body?.nextCursor, null);
  });
});
