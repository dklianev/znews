import { afterEach, describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';

function createMockRouter() {
  const routes = new Map();
  return {
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers);
    },
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
    put(path, ...handlers) {
      routes.set(`PUT ${path}`, handlers);
    },
    delete(path, ...handlers) {
      routes.set(`DELETE ${path}`, handlers);
    },
    routes,
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

async function loadFactory(router) {
  vi.resetModules();
  vi.doMock('express', () => ({
    default: {
      Router: () => router,
    },
  }));
  return import('../server/routes/contactMessagesRoutes.js');
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('express');
});

describe('contactMessagesRoutes', () => {
  it('requires phone instead of email for public contact submissions', async () => {
    const router = createMockRouter();
    const { createContactMessagesRouter } = await loadFactory(router);

    createContactMessagesRouter({
      ContactMessage: { create: async () => { throw new Error('should not create'); } },
      contactMessageLimiter: (_req, _res, next) => next(),
      hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
      },
      nextNumericId: async () => 1,
      normalizeText(value, max = 4000) {
        return String(value || '').trim().slice(0, max);
      },
      parsePositiveInt(value, fallback) {
        return value == null ? fallback : Number.parseInt(value, 10);
      },
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
    });

    const handlers = router.routes.get('POST /');
    const res = createResponse();

    await runHandlers(handlers, {
      body: {
        name: 'Тест',
        message: 'Искам корекция.',
      },
    }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.fieldErrors?.phone, 'Телефонът е задължителен.');
    assert.equal(res.body?.fieldErrors?.email, undefined);
  });

  it('creates contact submissions with phone-only payloads', async () => {
    const router = createMockRouter();
    const { createContactMessagesRouter } = await loadFactory(router);
    let createdPayload = null;

    createContactMessagesRouter({
      ContactMessage: {
        create: async (payload) => {
          createdPayload = payload;
          return payload;
        },
      },
      contactMessageLimiter: (_req, _res, next) => next(),
      hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
      },
      nextNumericId: async () => 17,
      normalizeText(value, max = 4000) {
        return String(value || '').trim().slice(0, max);
      },
      parsePositiveInt(value, fallback) {
        return value == null ? fallback : Number.parseInt(value, 10);
      },
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
    });

    const handlers = router.routes.get('POST /');
    const res = createResponse();

    await runHandlers(handlers, {
      body: {
        name: 'Тест',
        phone: '0899 123 456',
        message: 'Искам корекция.',
      },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(createdPayload?.id, 17);
    assert.equal(createdPayload?.name, 'Тест');
    assert.equal(createdPayload?.phone, '0899 123 456');
    assert.equal(createdPayload?.email, '');
    assert.equal(createdPayload?.message, 'Искам корекция.');
    assert.equal(createdPayload?.status, 'new');
    assert.ok(createdPayload?.createdAt instanceof Date);
  });
});
