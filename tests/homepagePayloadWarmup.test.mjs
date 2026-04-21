import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

async function importWarmupModule() {
  vi.resetModules();
  return import('../src/utils/homepagePayloadWarmup.js');
}

describe('homepagePayloadWarmup', () => {
  it('consumes the warmed homepage payload once so refreshes fetch fresh data', async () => {
    const originalWindow = globalThis.window;
    const originalFetch = globalThis.fetch;
    const fetchCalls = [];

    globalThis.window = {
      location: { pathname: '/' },
      sessionStorage: createStorage(),
      localStorage: createStorage(),
      dispatchEvent() {},
    };
    globalThis.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ articlePool: [] }),
      };
    };

    try {
      const {
        consumeWarmedHomepagePayload,
        warmHomepagePayload,
      } = await importWarmupModule();

      const warmed = warmHomepagePayload();
      assert.ok(warmed, 'public homepage should start a warm fetch');
      assert.equal(consumeWarmedHomepagePayload(), warmed, 'first consume should return the warmed promise');
      assert.equal(consumeWarmedHomepagePayload(), null, 'second consume should not reuse stale homepage data');
      assert.equal(fetchCalls.length, 1, 'consuming should not start another request by itself');
    } finally {
      vi.resetModules();
      if (typeof originalWindow === 'undefined') delete globalThis.window;
      else globalThis.window = originalWindow;
      if (typeof originalFetch === 'undefined') delete globalThis.fetch;
      else globalThis.fetch = originalFetch;
    }
  });

  it('does not warm the homepage payload for authenticated sessions', async () => {
    const originalWindow = globalThis.window;
    const originalFetch = globalThis.fetch;
    const futureExpiry = Date.now() + 60_000;

    globalThis.window = {
      location: { pathname: '/' },
      sessionStorage: createStorage({
        zn_session: JSON.stringify({ token: 'token', accessTokenExpiresAt: futureExpiry }),
      }),
      localStorage: createStorage(),
      dispatchEvent() {},
    };
    globalThis.fetch = async () => {
      throw new Error('authenticated homepage should not warm public payload');
    };

    try {
      const { consumeWarmedHomepagePayload, warmHomepagePayload } = await importWarmupModule();

      assert.equal(warmHomepagePayload(), null);
      assert.equal(consumeWarmedHomepagePayload(), null);
    } finally {
      vi.resetModules();
      if (typeof originalWindow === 'undefined') delete globalThis.window;
      else globalThis.window = originalWindow;
      if (typeof originalFetch === 'undefined') delete globalThis.fetch;
      else globalThis.fetch = originalFetch;
    }
  });
});
