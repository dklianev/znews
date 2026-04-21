import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { api, clearSession, getSession, saveSession } from '../src/utils/api.js';

function createStorage() {
  const data = new Map();
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
    clear() {
      data.clear();
    },
  };
}

describe('apiClientSession', () => {
  it('keeps apiClientSession legacy coverage green', async () => {
      const originalWindow = globalThis.window;
      const originalCustomEvent = globalThis.CustomEvent;
    
      const sessionStorage = createStorage();
      const localStorage = createStorage();
    
      globalThis.window = {
        sessionStorage,
        localStorage,
        dispatchEvent() { },
      };
      globalThis.CustomEvent = class CustomEvent {
        constructor(type, init = {}) {
          this.type = type;
          this.detail = init.detail;
        }
      };
    
      try {
        clearSession();
    
        const expiredSession = {
          token: 'expired-token',
          role: 'editor',
          accessTokenExpiresAt: Date.now() - 60_000,
        };
    
        saveSession(expiredSession);
    
        assert.equal(getSession(), null, 'expired sessions should not fall back to stale in-memory state');
        assert.equal(sessionStorage.getItem('zn_session'), null, 'expired session should be removed from sessionStorage');
        assert.equal(localStorage.getItem('zn_session'), null, 'expired session should be removed from localStorage');
      } finally {
        clearSession();
        if (typeof originalWindow === 'undefined') delete globalThis.window;
        else globalThis.window = originalWindow;
        if (typeof originalCustomEvent === 'undefined') delete globalThis.CustomEvent;
        else globalThis.CustomEvent = originalCustomEvent;
      }
  });

  it('does not send JSON content-type on bodyless GET requests', async () => {
    const originalFetch = globalThis.fetch;
    let capturedRequest = null;

    globalThis.fetch = async (url, options = {}) => {
      capturedRequest = { url, options };
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '{}',
      };
    };

    try {
      await api.homepage.get({ compact: 1 });
      assert.equal(capturedRequest.url, '/api/homepage?compact=1');
      assert.equal(capturedRequest.options.credentials, 'include');
      assert.equal(
        Object.prototype.hasOwnProperty.call(capturedRequest.options.headers || {}, 'Content-Type'),
        false,
        'GET requests without a body should not send Content-Type'
      );
    } finally {
      if (typeof originalFetch === 'undefined') delete globalThis.fetch;
      else globalThis.fetch = originalFetch;
    }
  });
});
