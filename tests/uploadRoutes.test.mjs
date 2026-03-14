import assert from 'node:assert/strict';
import { registerUploadRoutes } from '../server/routes/uploadRoutes.js';

function createMockApp() {
  const routes = new Map();
  return {
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

function createBaseDeps(overrides = {}) {
  return {
    brandLogoPath: 'brand.png',
    async ensureImagePipeline() {
      return null;
    },
    getOriginalUploadUrl(name) {
      return `/uploads/${name}`;
    },
    getRecentUploadPayload() {
      return null;
    },
    imageMimeToExt: { 'image/jpeg': '.jpg' },
    async loadSharp() {
      return null;
    },
    makeUploadFingerprint() {
      return 'fingerprint';
    },
    normalizeText(value) {
      return typeof value === 'string' ? value.trim() : '';
    },
    parseBooleanFlag(value, fallback) {
      return typeof value === 'boolean' ? value : fallback;
    },
    async putStorageObject() {
      throw new Error('should not upload for early validation failures');
    },
    rememberRecentUploadPayload() {},
    requireAnyPermission() {
      return (_req, _res, next) => next();
    },
    requireAuth(req, _res, next) {
      req.user = { id: 1 };
      next();
    },
    toImageMetaFromManifest() {
      return null;
    },
    upload: {
      single() {
        return (_req, _res, callback) => callback(null);
      },
    },
    uploadMaxFileSizeMb: 10,
    uploadRequestInFlight: new Map(),
    ...overrides,
  };
}

export async function runUploadRoutesTests() {
  {
    const app = createMockApp();
    registerUploadRoutes(app, createBaseDeps());
    const handlers = app.routes.get('POST /api/upload');
    const res = createResponse();

    await runHandlers(handlers, { body: {} }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Качи изображение, за да продължиш.');
    assert.deepEqual(res.body?.fieldErrors, {
      image: 'Качи изображение, за да продължиш.',
    });
  }

  {
    const app = createMockApp();
    registerUploadRoutes(app, createBaseDeps({
      upload: {
        single() {
          return (_req, _res, callback) => callback({ code: 'LIMIT_FILE_SIZE', message: 'File too large' });
        },
      },
      uploadMaxFileSizeMb: 12,
    }));
    const handlers = app.routes.get('POST /api/upload');
    const res = createResponse();

    await runHandlers(handlers, { body: {} }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Файлът е твърде голям.');
    assert.deepEqual(res.body?.fieldErrors, {
      image: 'Качи изображение до 12 MB.',
    });
  }
}
