const CHUNK_RELOAD_KEY = 'zn_chunk_reload';
const CHUNK_RELOAD_WINDOW_MS = 10_000;

function getSafeSessionStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function shouldReloadForChunkError(now = Date.now()) {
  const storage = getSafeSessionStorage();
  if (!storage) return false;

  try {
    const lastReload = Number(storage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (lastReload > 0 && now - lastReload <= CHUNK_RELOAD_WINDOW_MS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export { CHUNK_RELOAD_KEY, CHUNK_RELOAD_WINDOW_MS };
