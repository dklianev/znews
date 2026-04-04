import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'zn_recent_classifieds';
const MAX_ITEMS = 6;

let listeners = [];
let cache = null;

function getSnapshot() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function subscribe(listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

function notify() {
  cache = null; // invalidate
  listeners.forEach(l => l());
}

export function addRecentlyViewed(item) {
  if (!item?.id) return;
  try {
    const current = getSnapshot().filter(i => i.id !== item.id);
    const entry = {
      id: item.id,
      title: String(item.title || '').slice(0, 80),
      price: String(item.price || '').slice(0, 30),
      category: item.category,
      tier: item.tier,
      image: item.images?.[0] || '',
      viewedAt: Date.now(),
    };
    const next = [entry, ...current].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  } catch {
    // localStorage may be unavailable in CEF — fail silently
  }
}

export function useRecentlyViewed() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => []);
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      notify();
    } catch {}
  }, []);
  return { items, clear };
}
