import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { registerHealthRoutes } from '../server/routes/healthRoutes.js';

function createMockApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers);
    },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
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

describe('healthRoutes', () => {
  it('keeps healthRoutes legacy coverage green', async () => {
      const app = createMockApp();
      const seenModes = [];
      registerHealthRoutes(app, {
        buildHealthPayload(mode) {
          seenModes.push(mode);
          if (mode === 'live') return { ok: true, mode };
          return { ok: false, mode };
        },
      });
    
      const liveRes = createResponse();
      await app.routes.get('GET /api/health/live')[0]({}, liveRes);
      assert.equal(liveRes.statusCode, 200);
      assert.equal(liveRes.headers['Cache-Control'], 'no-store');
      assert.deepEqual(liveRes.body, { ok: true, mode: 'live' });
    
      const readyRes = createResponse();
      await app.routes.get('GET /api/health/ready')[0]({}, readyRes);
      assert.equal(readyRes.statusCode, 503);
      assert.equal(readyRes.headers['Cache-Control'], 'no-store');
      assert.deepEqual(readyRes.body, { ok: false, mode: 'ready' });
    
      const legacyRes = createResponse();
      await app.routes.get('GET /api/health')[0]({}, legacyRes);
      assert.equal(legacyRes.statusCode, 503);
      assert.equal(legacyRes.headers['Cache-Control'], 'no-store');
      assert.deepEqual(legacyRes.body, { ok: false, mode: 'ready' });
    
      assert.deepEqual(seenModes, ['live', 'ready', 'ready']);
  });
});
