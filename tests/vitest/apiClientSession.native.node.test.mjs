import { afterEach, describe, expect, it } from 'vitest';

import { clearSession, getSession, saveSession } from '../../src/utils/api.js';

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

describe('api client session helpers', () => {
  const originalWindow = globalThis.window;
  const originalCustomEvent = globalThis.CustomEvent;

  afterEach(() => {
    clearSession();
    if (typeof originalWindow === 'undefined') delete globalThis.window;
    else globalThis.window = originalWindow;
    if (typeof originalCustomEvent === 'undefined') delete globalThis.CustomEvent;
    else globalThis.CustomEvent = originalCustomEvent;
  });

  it('drops expired persisted sessions instead of reviving stale in-memory state', () => {
    const sessionStorage = createStorage();
    const localStorage = createStorage();

    globalThis.window = {
      sessionStorage,
      localStorage,
      dispatchEvent() {},
    };
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };

    clearSession();
    saveSession({
      token: 'expired-token',
      role: 'editor',
      accessTokenExpiresAt: Date.now() - 60_000,
    });

    expect(getSession()).toBeNull();
    expect(sessionStorage.getItem('zn_session')).toBeNull();
    expect(localStorage.getItem('zn_session')).toBeNull();
  });
});
