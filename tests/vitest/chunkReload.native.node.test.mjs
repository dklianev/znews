import { describe, expect, it } from 'vitest';

import {
  CHUNK_RELOAD_KEY,
  CHUNK_RELOAD_WINDOW_MS,
  isChunkLoadError,
  shouldReloadForChunkError,
} from '../../src/utils/chunkReload.js';

function createStorageMock() {
  const state = new Map();
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(key, String(value));
    },
  };
}

describe('chunkReload', () => {
  it('fails closed when window is unavailable or storage access is denied', () => {
    const originalWindow = globalThis.window;

    try {
      delete globalThis.window;
      expect(shouldReloadForChunkError(1000)).toBe(false);

      const deniedWindow = {};
      Object.defineProperty(deniedWindow, 'sessionStorage', {
        configurable: true,
        get() {
          throw new Error('Storage denied');
        },
      });
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: deniedWindow,
      });
      expect(shouldReloadForChunkError(2000)).toBe(false);
    } finally {
      if (typeof originalWindow === 'undefined') delete globalThis.window;
      else Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: originalWindow });
    }
  });

  it('allows only one reload inside the guard window', () => {
    const originalWindow = globalThis.window;
    const storage = createStorageMock();

    try {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: { sessionStorage: storage },
      });

      expect(shouldReloadForChunkError(10_000)).toBe(true);
      expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe('10000');
      expect(shouldReloadForChunkError(10_000 + CHUNK_RELOAD_WINDOW_MS - 1)).toBe(false);
      expect(shouldReloadForChunkError(10_000 + CHUNK_RELOAD_WINDOW_MS + 1)).toBe(true);
    } finally {
      if (typeof originalWindow === 'undefined') delete globalThis.window;
      else Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: originalWindow });
    }
  });

  it('detects only real stale chunk errors', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module /assets/foo.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 5 failed'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading CSS chunk 3 failed'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Expected JavaScript but got text/html'))).toBe(true);
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
