import assert from 'node:assert/strict';
import { registerTipRoutes } from '../server/routes/tipRoutes.js';

function createMockApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers);
    },
    patch(path, ...handlers) {
      routes.set(`PATCH ${path}`, handlers);
    },
    delete(path, ...handlers) {
      routes.set(`DELETE ${path}`, handlers);
    },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
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

export async function runTipRoutesTests() {
  const saved = [];
  const tipsList = [{ id: 2, text: 'older' }, { id: 1, text: 'newer' }];
  const updatedTips = [];
  const deletedTips = [];

  class MockTip {
    constructor(doc) {
      Object.assign(this, doc);
    }

    async save() {
      saved.push({ ...this });
    }

    static find() {
      return {
        sort() {
          return {
            lean: async () => tipsList,
          };
        },
      };
    }

    static async findOneAndUpdate(query, update, options) {
      updatedTips.push({ query, update, options });
      return { id: query.id, status: update.status };
    }

    static async findOneAndDelete(query) {
      deletedTips.push(query);
      return { id: query.id };
    }
  }

  const app = createMockApp();
  registerTipRoutes(app, {
    Tip: MockTip,
    async ensureImagePipeline() {
      throw new Error('should not run image pipeline for text-only tip');
    },
    getOriginalUploadUrl(name) {
      return `/uploads/${name}`;
    },
    getTrustedClientIp() {
      return '127.0.0.1';
    },
    imageMimeToExt: { 'image/jpeg': '.jpg' },
    async loadSharp() {
      return null;
    },
    async nextNumericId() {
      return 55;
    },
    normalizeText(value) {
      return typeof value === 'string' ? value.trim() : '';
    },
    async putStorageObject() {
      throw new Error('should not upload without file');
    },
    rateLimit(_config) {
      return (_req, _res, next) => next();
    },
    rateLimitKeyGenerator() {
      return 'tip-test';
    },
    requireAnyPermission() {
      return (_req, _res, next) => next();
    },
    requireAuth(req, _res, next) {
      req.user = { id: 1 };
      next();
    },
    shouldSkipRateLimit() {
      return false;
    },
    toImageMetaFromManifest() {
      return null;
    },
    upload: {
      single() {
        return (req, _res, callback) => callback(null);
      },
    },
    uploadMaxFileSizeMb: 10,
  });

  {
    const handlers = app.routes.get('GET /api/tips');
    const res = createResponse();
    await runHandlers(handlers, {}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, tipsList);
  }

  {
    const handlers = app.routes.get('POST /api/tips');
    const res = createResponse();
    await runHandlers(handlers, { body: { text: '  \u0441\u0438\u0433\u043d\u0430\u043b  ', location: '  Vinewood  ' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, id: 55 });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, 55);
    assert.equal(saved[0].text, '\u0441\u0438\u0433\u043d\u0430\u043b');
    assert.equal(saved[0].location, 'Vinewood');
    assert.equal(saved[0].image, '');
    assert.equal(saved[0].imageMeta, null);
    assert.equal(saved[0].ipHash.length, 64);
  }

  {
    const handlers = app.routes.get('POST /api/tips');
    const res = createResponse();
    await runHandlers(handlers, { body: { text: '   ', location: '' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, '\u0414\u043e\u0431\u0430\u0432\u0438 \u0442\u0435\u043a\u0441\u0442 \u0438\u043b\u0438 \u0441\u043d\u0438\u043c\u043a\u0430, \u0437\u0430 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0442\u0438\u0448 \u0441\u0438\u0433\u043d\u0430\u043b\u0430.');
    assert.deepEqual(res.body?.fieldErrors, {
      text: '\u0414\u043e\u0431\u0430\u0432\u0438 \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u043e\u0441\u0442\u0438 \u0437\u0430 \u0441\u0438\u0433\u043d\u0430\u043b\u0430 \u0438\u043b\u0438 \u043a\u0430\u0447\u0438 \u0441\u043d\u0438\u043c\u043a\u0430.',
      image: '\u041a\u0430\u0447\u0438 \u0441\u043d\u0438\u043c\u043a\u0430, \u0430\u043a\u043e \u043d\u0435 \u0438\u0441\u043a\u0430\u0448 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0449\u0430\u0448 \u0442\u0435\u043a\u0441\u0442.',
    });
  }

  {
    const handlers = app.routes.get('PATCH /api/tips/:id');
    const res = createResponse();
    await runHandlers(handlers, { body: { status: 'processed' }, params: { id: '55' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(updatedTips, [{
      query: { id: 55 },
      update: { status: 'processed' },
      options: { new: true },
    }]);
    assert.deepEqual(res.body, { id: 55, status: 'processed' });
  }

  {
    const handlers = app.routes.get('DELETE /api/tips/:id');
    const res = createResponse();
    await runHandlers(handlers, { params: { id: '55' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(deletedTips, [{ id: 55 }]);
    assert.deepEqual(res.body, { ok: true });
  }

  {
    const uploadErrorApp = createMockApp();
    registerTipRoutes(uploadErrorApp, {
      Tip: MockTip,
      async ensureImagePipeline() {
        throw new Error('should not run image pipeline on upload error');
      },
      getOriginalUploadUrl(name) {
        return `/uploads/${name}`;
      },
      getTrustedClientIp() {
        return '127.0.0.1';
      },
      imageMimeToExt: { 'image/jpeg': '.jpg' },
      async loadSharp() {
        return null;
      },
      async nextNumericId() {
        return 56;
      },
      normalizeText(value) {
        return typeof value === 'string' ? value.trim() : '';
      },
      async putStorageObject() {
        throw new Error('should not upload on multer failure');
      },
      rateLimit(_config) {
        return (_req, _res, next) => next();
      },
      rateLimitKeyGenerator() {
        return 'tip-test';
      },
      requireAnyPermission() {
        return (_req, _res, next) => next();
      },
      requireAuth(req, _res, next) {
        req.user = { id: 1 };
        next();
      },
      shouldSkipRateLimit() {
        return false;
      },
      toImageMetaFromManifest() {
        return null;
      },
      upload: {
        single() {
          return (_req, _res, callback) => callback({ code: 'LIMIT_FILE_SIZE', message: 'File too large' });
        },
      },
      uploadMaxFileSizeMb: 12,
    });

    const handlers = uploadErrorApp.routes.get('POST /api/tips');
    const res = createResponse();
    await runHandlers(handlers, { body: { text: 'сигнал' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Файлът е твърде голям.');
    assert.deepEqual(res.body?.fieldErrors, {
      image: 'Качи изображение до 12 MB.',
    });
  }
}
