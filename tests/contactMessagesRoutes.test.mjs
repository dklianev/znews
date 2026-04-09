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
      requireAuth: (req, _res, next) => {
        req.user = { id: 1, name: 'Мила Георгиева', username: 'mila' };
        next();
      },
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
      requireAuth: (req, _res, next) => {
        req.user = { id: 1, name: 'Мила Георгиева', username: 'mila' };
        next();
      },
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
    assert.equal(createdPayload?.requestKind, 'general');
    assert.equal(createdPayload?.relatedArticleId, null);
    assert.equal(createdPayload?.relatedArticleTitle, '');
  });

  it('creates right-of-reply submissions linked to an article', async () => {
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
      nextNumericId: async () => 23,
      normalizeText(value, max = 4000) {
        return String(value || '').trim().slice(0, max);
      },
      parsePositiveInt(value, fallback) {
        return value == null ? fallback : Number.parseInt(value, 10);
      },
      requireAuth: (req, _res, next) => {
        req.user = { id: 1, name: 'Мила Георгиева', username: 'mila' };
        next();
      },
      requirePermission: () => (_req, _res, next) => next(),
    });

    const handlers = router.routes.get('POST /');
    const res = createResponse();

    await runHandlers(handlers, {
      body: {
        name: 'Засегната страна',
        phone: '9652438',
        message: 'Това твърдение е неточно и искам право на отговор.',
        requestKind: 'right_of_reply',
        relatedArticleId: 88,
        relatedArticleTitle: 'Скандал в центъра',
      },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(createdPayload?.requestKind, 'right_of_reply');
    assert.equal(createdPayload?.relatedArticleId, 88);
    assert.equal(createdPayload?.relatedArticleTitle, 'Скандал в центъра');
  });

  it('returns only published right-of-reply response articles for a public article page', async () => {
    const router = createMockRouter();
    const { createContactMessagesRouter } = await loadFactory(router);

    createContactMessagesRouter({
      Article: {
        find: () => ({
          select() {
            return this;
          },
          lean: async () => ([
            {
              id: 91,
              title: 'Публикуван отговор',
              excerpt: 'Това е публикуваният отговор.',
              category: 'society',
              date: '2026-04-04',
              cardSticker: 'ОТГОВОР',
            },
          ]),
        }),
      },
      ContactMessage: {
        find: () => ({
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          select() {
            return this;
          },
          lean: async () => ([
            { id: 12, responseArticleId: 91, createdAt: '2026-04-04T09:00:00.000Z' },
            { id: 13, responseArticleId: 91, createdAt: '2026-04-04T08:00:00.000Z' },
            { id: 14, responseArticleId: 104, createdAt: '2026-04-04T07:00:00.000Z' },
          ]),
        }),
      },
      contactMessageLimiter: (_req, _res, next) => next(),
      getPublishedFilter: () => ({ status: 'published' }),
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
      requireAuth: (req, _res, next) => {
        req.user = { id: 1, name: 'Мила Георгиева', username: 'mila' };
        next();
      },
      requirePermission: () => (_req, _res, next) => next(),
    });

    const handlers = router.routes.get('GET /right-of-reply/:articleId');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { articleId: '88' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body), true);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0]?.id, 91);
    assert.equal(res.body[0]?.title, 'Публикуван отговор');
  });

  it('updates contact messages with editorial queue fields', async () => {
    const router = createMockRouter();
    const { createContactMessagesRouter } = await loadFactory(router);
    const auditEntries = [];

    createContactMessagesRouter({
      AuditLog: {
        create: async (entry) => {
          auditEntries.push(entry);
        },
      },
      ContactMessage: {
        findOneAndUpdate: (_query, update) => ({
          lean: async () => ({
            id: 17,
            ...update.$set,
          }),
        }),
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
      requireAuth: (req, _res, next) => {
        req.user = { id: 1, name: 'Мила Георгиева', username: 'mila' };
        next();
      },
      requirePermission: () => (_req, _res, next) => next(),
    });

    const handlers = router.routes.get('PUT /:id');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { id: '17' },
      body: {
        status: 'read',
        assignedEditor: '  Мила Георгиева ',
        priority: 'high',
        tags: ['корекция', 'контакт', 'корекция'],
        dueAt: '2026-04-14',
        responseArticleId: 91,
        responseArticleStatus: 'draft',
      },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.id, 17);
    assert.equal(res.body?.status, 'read');
    assert.equal(res.body?.assignedEditor, 'Мила Георгиева');
    assert.equal(res.body?.priority, 'high');
    assert.deepEqual(res.body?.tags, ['корекция', 'контакт']);
    assert.equal(res.body?.lastActionBy, 'Мила Георгиева');
    assert.ok(res.body?.lastActionAt instanceof Date);
    assert.ok(res.body?.dueAt instanceof Date);
    assert.equal(res.body?.responseArticleId, 91);
    assert.equal(res.body?.responseArticleStatus, 'draft');
    assert.equal(res.body?.dueAt.getFullYear(), 2026);
    assert.equal(res.body?.dueAt.getMonth(), 3);
    assert.equal(res.body?.dueAt.getDate(), 14);
    assert.equal(res.body?.dueAt.getHours(), 23);
    assert.equal(auditEntries[0]?.resource, 'contact-messages');
    assert.equal(auditEntries[0]?.action, 'update');
    assert.match(auditEntries[0]?.details || '', /priority:high/);
    assert.match(auditEntries[0]?.details || '', /responseArticle:91/);
  });

  it('writes an audit entry when deleting a contact message', async () => {
    const router = createMockRouter();
    const { createContactMessagesRouter } = await loadFactory(router);
    const auditEntries = [];

    createContactMessagesRouter({
      AuditLog: {
        create: async (entry) => {
          auditEntries.push(entry);
        },
      },
      ContactMessage: {
        deleteOne: async () => ({ deletedCount: 1 }),
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
      requireAuth: (req, _res, next) => {
        req.user = { userId: 1, id: 1, name: 'Мила Георгиева', username: 'mila' };
        next();
      },
      requirePermission: () => (_req, _res, next) => next(),
    });

    const handlers = router.routes.get('DELETE /:id');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { id: '17' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(auditEntries[0]?.resource, 'contact-messages');
    assert.equal(auditEntries[0]?.action, 'delete');
    assert.equal(auditEntries[0]?.resourceId, 17);
  });
});
