import assert from 'node:assert/strict';
import { CHUNK_RELOAD_KEY, CHUNK_RELOAD_WINDOW_MS, isChunkLoadError, shouldReloadForChunkError } from '../src/utils/chunkReload.js';

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

export async function runChunkReloadTests() {
  const originalWindow = globalThis.window;

  try {
    delete globalThis.window;
    assert.equal(shouldReloadForChunkError(1000), false, 'should not reload when window is unavailable');

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
    assert.equal(shouldReloadForChunkError(2000), false, 'should fail closed when sessionStorage access throws');

    const storage = createStorageMock();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: { sessionStorage: storage },
    });

    assert.equal(shouldReloadForChunkError(10_000), true, 'first chunk failure should allow one reload');
    assert.equal(storage.getItem(CHUNK_RELOAD_KEY), '10000');
    assert.equal(shouldReloadForChunkError(10_000 + CHUNK_RELOAD_WINDOW_MS - 1), false, 'second reload inside the time window should be blocked');
    assert.equal(shouldReloadForChunkError(10_000 + CHUNK_RELOAD_WINDOW_MS + 1), true, 'reload should be allowed again after the guard window expires');

    // isChunkLoadError detection
    assert.equal(isChunkLoadError(new Error('Failed to fetch dynamically imported module /assets/foo.js')), true);
    assert.equal(isChunkLoadError(new Error('Loading chunk 5 failed')), true);
    assert.equal(isChunkLoadError(new Error('Loading CSS chunk 3 failed')), true);
    const mimeError = new TypeError('Expected JavaScript but got text/html');
    assert.equal(isChunkLoadError(mimeError), true);
    assert.equal(isChunkLoadError(new Error('Network request failed')), false);
    assert.equal(isChunkLoadError(null), false);
    assert.equal(isChunkLoadError(undefined), false);
  } finally {
    if (typeof originalWindow === 'undefined') delete globalThis.window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: originalWindow });
  }
}
