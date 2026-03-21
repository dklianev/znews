/**
 * API client for zNews
 * - Access token is sent via Authorization header.
 * - Refresh token lives in HttpOnly cookie and is rotated by /auth/refresh.
 */

const BASE = '/api';
const SESSION_KEY = 'zn_session';
const CLIENT_ID_KEY = 'zn_client_id';

let refreshInFlight = null;
let inMemorySession = null;

function getWebStorage(type) {
  if (typeof window === 'undefined') return null;
  try {
    return window[type];
  } catch {
    return null;
  }
}

function readSessionFromStorage(storage) {
  if (!storage) return null;
  try {
    const stored = storage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function writeSessionToStorage(storage, session) {
  if (!storage) return false;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

function removeSessionFromStorage(storage) {
  if (!storage) return;
  try {
    storage.removeItem(SESSION_KEY);
  } catch {
    // ignore quota/privacy mode errors
  }
}

function decodeBase64Url(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!normalized) return null;
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(padded);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
  } catch {
    return null;
  }
  return null;
}

function getJwtExpiryMs(token) {
  const rawToken = String(token || '').trim();
  if (!rawToken) return 0;
  const parts = rawToken.split('.');
  if (parts.length < 2) return 0;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]) || '');
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') return null;
  const normalized = { ...session };
  const savedAt = Number(normalized.accessTokenSavedAt) || Date.now();
  normalized.accessTokenSavedAt = savedAt;

  const explicitExpiresAt = Number(normalized.accessTokenExpiresAt);
  if (Number.isFinite(explicitExpiresAt) && explicitExpiresAt > 0) {
    normalized.accessTokenExpiresAt = explicitExpiresAt;
    return normalized;
  }

  const jwtExpiry = getJwtExpiryMs(normalized.token);
  if (jwtExpiry > 0) {
    normalized.accessTokenExpiresAt = jwtExpiry;
    return normalized;
  }

  const expiresIn = Number(normalized.accessTokenExpiresIn);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    normalized.accessTokenExpiresAt = savedAt + expiresIn * 1000;
  }

  return normalized;
}

function isSessionExpired(session) {
  const expiresAt = Number(session?.accessTokenExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function readClientIdFromStorage(storage) {
  if (!storage) return null;
  try {
    const value = storage.getItem(CLIENT_ID_KEY);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function getLegacyClientId() {
  const localStorage = getWebStorage('localStorage');
  const sessionStorage = getWebStorage('sessionStorage');
  return readClientIdFromStorage(localStorage) || readClientIdFromStorage(sessionStorage);
}

function getClientIdHeaders() {
  const clientId = getLegacyClientId();
  return clientId ? { 'X-ZN-Client-Id': clientId } : {};
}

function emitSessionUpdated(session) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('zn-session-updated', { detail: session || null }));
}

export function getSession() {
  const sessionStorage = getWebStorage('sessionStorage');
  const localStorage = getWebStorage('localStorage');
  const session = normalizeSession(readSessionFromStorage(sessionStorage));
  if (session) {
    if (isSessionExpired(session)) {
      removeSessionFromStorage(sessionStorage);
    } else {
      inMemorySession = session;
      writeSessionToStorage(sessionStorage, session);
      return session;
    }
  }

  // Legacy migration path: move persisted session from localStorage to sessionStorage.
  const legacySession = normalizeSession(readSessionFromStorage(localStorage));
  if (legacySession) {
    if (isSessionExpired(legacySession)) {
      removeSessionFromStorage(localStorage);
    } else {
      inMemorySession = legacySession;
      writeSessionToStorage(sessionStorage, legacySession);
      removeSessionFromStorage(localStorage);
      return legacySession;
    }
  }

  const memorySession = normalizeSession(inMemorySession);
  if (memorySession && !isSessionExpired(memorySession)) {
    inMemorySession = memorySession;
    return memorySession;
  }

  inMemorySession = null;
  return null;
}

export function saveSession(session) {
  const normalizedSession = normalizeSession(session);
  inMemorySession = normalizedSession || null;
  const sessionStorage = getWebStorage('sessionStorage');
  const localStorage = getWebStorage('localStorage');

  // Prefer sessionStorage (short-lived token persistence). Fallback to localStorage only if unavailable.
  const persisted = writeSessionToStorage(sessionStorage, normalizedSession);
  if (!persisted) writeSessionToStorage(localStorage, normalizedSession);
  else removeSessionFromStorage(localStorage);

  emitSessionUpdated(normalizedSession);
}

export function clearSession() {
  inMemorySession = null;
  const sessionStorage = getWebStorage('sessionStorage');
  const localStorage = getWebStorage('localStorage');
  removeSessionFromStorage(sessionStorage);
  removeSessionFromStorage(localStorage);
  emitSessionUpdated(null);
}

function toQuery(params) {
  if (!params || typeof params !== 'object') return '';
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, String(value));
  });
  const asString = qs.toString();
  return asString ? `?${asString}` : '';
}

async function readResponsePayload(res) {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const RETRYABLE_READ_STATUSES = new Set([429, 502, 503, 504]);
const READ_RETRY_BASE_DELAY_MS = 400;
const READ_RETRY_MAX_DELAY_MS = 4_000;
const MAX_READ_RETRIES = 2;

function isReadMethod(method) {
  const normalized = String(method || 'GET').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterToMs(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;

  const asSeconds = Number.parseInt(raw, 10);
  if (Number.isFinite(asSeconds) && asSeconds > 0) return asSeconds * 1000;

  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    const diff = asDate - Date.now();
    return diff > 0 ? diff : 0;
  }

  return 0;
}

function computeReadRetryDelayMs(retryCount, retryAfterHeader) {
  const retryAfterMs = parseRetryAfterToMs(retryAfterHeader);
  if (retryAfterMs > 0) {
    return Math.min(READ_RETRY_MAX_DELAY_MS, retryAfterMs);
  }

  const expBackoff = READ_RETRY_BASE_DELAY_MS * (2 ** Math.max(0, retryCount));
  const jitter = Math.floor(Math.random() * 180);
  return Math.min(READ_RETRY_MAX_DELAY_MS, expBackoff + jitter);
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;

    const payload = await readResponsePayload(res);
    if (!payload || typeof payload !== 'object' || !payload.token) return null;

    const prev = getSession();
    const merged = {
      ...(prev || {}),
      ...payload,
      token: payload.token,
    };
    saveSession(merged);
    return merged;
  })()
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function request(path, options = {}, internal = {}) {
  const session = getSession();
  const method = String(options.method || 'GET').toUpperCase();
  const retryCount = Number(internal.retryCount || 0);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch (networkError) {
    if (!internal.skipRetry && isReadMethod(method) && retryCount < MAX_READ_RETRIES) {
      const delayMs = computeReadRetryDelayMs(retryCount, '');
      await wait(delayMs);
      return request(path, options, { ...internal, retryCount: retryCount + 1 });
    }
    throw networkError;
  }

  if (res.status === 401
    && !internal.skipRefresh
    && !path.startsWith('/auth/login')
    && !path.startsWith('/auth/refresh')
    && !path.startsWith('/auth/logout')
    && session?.token) {
    const refreshed = await refreshAccessToken();
    if (refreshed?.token) {
      return request(path, options, { ...internal, skipRefresh: true });
    }
    clearSession();
  }

  if (!res.ok) {
    const payload = await readResponsePayload(res);
    const message = typeof payload === 'string'
      ? payload
      : payload?.error || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.payload = payload;
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) error.retryAfter = retryAfter;

    if (!internal.skipRetry
      && isReadMethod(method)
      && RETRYABLE_READ_STATUSES.has(res.status)
      && retryCount < MAX_READ_RETRIES) {
      const delayMs = computeReadRetryDelayMs(retryCount, retryAfter);
      await wait(delayMs);
      return request(path, options, { ...internal, retryCount: retryCount + 1 });
    }

    throw error;
  }

  return readResponsePayload(res);
}

async function requestBlob(path, options = {}, internal = {}) {
  const session = getSession();
  const method = String(options.method || 'GET').toUpperCase();
  const retryCount = Number(internal.retryCount || 0);
  const headers = {
    ...(options.headers || {}),
  };

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch (networkError) {
    if (!internal.skipRetry && isReadMethod(method) && retryCount < MAX_READ_RETRIES) {
      const delayMs = computeReadRetryDelayMs(retryCount, '');
      await wait(delayMs);
      return requestBlob(path, options, { ...internal, retryCount: retryCount + 1 });
    }
    throw networkError;
  }

  if (res.status === 401
    && !internal.skipRefresh
    && !path.startsWith('/auth/login')
    && !path.startsWith('/auth/refresh')
    && !path.startsWith('/auth/logout')
    && session?.token) {
    const refreshed = await refreshAccessToken();
    if (refreshed?.token) {
      return requestBlob(path, options, { ...internal, skipRefresh: true });
    }
    clearSession();
  }

  if (!res.ok) {
    const payload = await readResponsePayload(res);
    const message = typeof payload === 'string'
      ? payload
      : payload?.error || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.payload = payload;
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) error.retryAfter = retryAfter;

    if (!internal.skipRetry
      && isReadMethod(method)
      && RETRYABLE_READ_STATUSES.has(res.status)
      && retryCount < MAX_READ_RETRIES) {
      const delayMs = computeReadRetryDelayMs(retryCount, retryAfter);
      await wait(delayMs);
      return requestBlob(path, options, { ...internal, retryCount: retryCount + 1 });
    }

    throw error;
  }

  return res.blob();
}

function crudEndpoints(resource) {
  return {
    getAll: (params) => request(`/${resource}${toQuery(params)}`),
    create: (data) => request(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/${resource}/${id}`, { method: 'DELETE' }),
  };
}

export const api = {
  bootstrap: {
    get: (params) => request(`/bootstrap${toQuery(params)}`),
  },
  homepage: {
    get: (params) => request(`/homepage${toQuery(params)}`),
  },
  search: {
    query: (params) => request(`/search${toQuery(params)}`),
    suggest: (params) => request(`/search/suggest${toQuery(params)}`),
    trending: (params) => request(`/search/trending${toQuery(params)}`),
  },
  articles: {
    ...crudEndpoints('articles'),
    listAdmin: (params) => request(`/articles/admin/list${toQuery(params)}`),
    getAdminMeta: () => request('/articles/admin/meta'),
    searchRelatedAdmin: (params) => request(`/articles/admin/related${toQuery(params)}`),
    getById: (id, params) => request(`/articles/${id}${toQuery(params)}`),
    incrementView: (id) => request(`/articles/${id}/view`, { method: 'POST' }),
    getReactionState: (id) => request(`/articles/${id}/reactions/me`, { headers: getClientIdHeaders() }),
    react: (id, emoji) => request(`/articles/${id}/react`, {
      method: 'POST',
      headers: getClientIdHeaders(),
      body: JSON.stringify({ emoji }),
    }),
    removeReaction: (id, emoji) => request(`/articles/${id}/react`, {
      method: 'DELETE',
      headers: getClientIdHeaders(),
      body: JSON.stringify({ emoji }),
    }),
    getRevisions: (id) => request(`/articles/${id}/revisions`),
    getRevision: (id, revisionId) => request(`/articles/${id}/revisions/${encodeURIComponent(revisionId)}`),
    autosaveRevision: (id, data) => request(`/articles/${id}/revisions/autosave`, { method: 'POST', body: JSON.stringify(data) }),
    restoreRevision: (id, revisionId) => request(`/articles/${id}/revisions/restore`, {
      method: 'POST',
      body: JSON.stringify({ revisionId }),
    }),
    restore: (id) => request(`/articles/${id}/restore`, { method: 'POST' }),
    permanentDelete: (id) => request(`/articles/${id}/permanent`, { method: 'DELETE' }),
    listArchived: () => request('/articles?status=archived'),
  },
  authors: crudEndpoints('authors'),
  categories: crudEndpoints('categories'),
  ads: {
    ...crudEndpoints('ads'),
    trackImpression: (id, data) => request(`/ads/${id}/impression`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    trackClick: (id, data) => request(`/ads/${id}/click`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getAnalyticsSummary: (days = 30) => request(`/ads/analytics/summary${toQuery({ days })}`),
  },
  users: crudEndpoints('users'),
  wanted: crudEndpoints('wanted'),
  jobs: crudEndpoints('jobs'),
  court: crudEndpoints('court'),
  events: crudEndpoints('events'),
  polls: {
    ...crudEndpoints('polls'),
    vote: (pollId, optionIndex) => request(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIndex }),
    }),
  },
  comments: {
    ...crudEndpoints('comments'),
    react: (id, reaction) => request(`/comments/${id}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
    }),
  },

  contactMessages: {
    submit: (data) => request('/contact-messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    getAll: (params) => request(`/contact-messages${toQuery(params)}`),
    update: (id, data) => request(`/contact-messages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/contact-messages/${id}`, { method: 'DELETE' }),
  },

  gallery: crudEndpoints('gallery'),

  media: {
    getAll: () => request('/media'),
    getPipelineStatus: () => request('/media/pipeline/status'),
    backfillPipeline: (options = {}) => request('/media/pipeline/backfill', {
      method: 'POST',
      body: JSON.stringify({
        force: Boolean(options.force),
        limit: Number.isFinite(Number(options.limit)) && Number(options.limit) > 0 ? Number(options.limit) : 0,
      }),
    }),
    delete: (fileName) => request(`/media/${encodeURIComponent(fileName)}`, { method: 'DELETE' }),
    getSourceBlob: (fileName) => requestBlob(`/media/source/${encodeURIComponent(fileName)}`),
    upload: (file, options = {}) => {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('applyWatermark', options.applyWatermark === false ? 'false' : 'true');
      return request('/upload', {
        method: 'POST',
        body: fd,
      });
    },
  },

  breaking: {
    get: () => request('/breaking'),
    save: (items) => request('/breaking', { method: 'PUT', body: JSON.stringify(items) }),
  },

  heroSettings: {
    get: () => request('/hero-settings'),
    save: (settings) => request('/hero-settings', { method: 'PUT', body: JSON.stringify(settings) }),
    getRevisions: () => request('/hero-settings/revisions'),
    restoreRevision: (revisionId) => request('/hero-settings/revisions/restore', {
      method: 'POST',
      body: JSON.stringify({ revisionId }),
    }),
  },

  siteSettings: {
    get: () => request('/site-settings'),
    save: (settings) => request('/site-settings', { method: 'PUT', body: JSON.stringify(settings) }),
    getRevisions: () => request('/site-settings/revisions'),
    restoreRevision: (revisionId) => request('/site-settings/revisions/restore', {
      method: 'POST',
      body: JSON.stringify({ revisionId }),
    }),
    forceRefreshHomepageCache: () => request('/site-settings/cache/homepage/refresh', { method: 'POST' }),
  },

  games: {
    getAll: () => request('/games'),
    getToday: (slug) => request(`/games/${slug}/today`),
    getArchive: (slug, limit = 30) => request(`/games/${slug}/archive?limit=${limit}`),
    getByDate: (slug, date) => request(`/games/${slug}/${date}`),
    validate: (slug, date, data) => request(`/games/${slug}/${date}/validate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  adminGames: {
    ...crudEndpoints('admin/games'),
    bulkGenerate: (data) => request('/admin/games/bulk-generate', { method: 'POST', body: JSON.stringify(data) }),
    getPuzzles: (slug) => request(`/admin/games/${slug}/puzzles`),
    createPuzzle: (slug, data) => request(`/admin/games/${slug}/puzzles`, { method: 'POST', body: JSON.stringify(data) }),
    updatePuzzle: (slug, id, data) => request(`/admin/games/${slug}/puzzles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePuzzle: (slug, id) => request(`/admin/games/${slug}/puzzles/${id}`, { method: 'DELETE' }),
    publishPuzzle: (slug, id) => request(`/admin/games/${slug}/puzzles/${id}/publish`, { method: 'POST' }),
    archivePuzzle: (slug, id) => request(`/admin/games/${slug}/puzzles/${id}/archive`, { method: 'POST' }),
  },

  auth: {
    login: (username, password) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
    // Refresh is optional: for logged-out users the server can return 204/401.
    // Don't treat that as an error in the UI.
    refresh: () => refreshAccessToken(),
    logout: () => request('/auth/logout', { method: 'POST' }, { skipRefresh: true }),
  },

  permissions: {
    getAll: () => request('/permissions'),
    update: (role, permissions) => request(`/permissions/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
  },

  roles: {
    ensure: (role) => request('/roles', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),
  },

  auditLog: {
    getPage: (params) => request(`/audit-log${toQuery(params)}`),
  },

  diagnostics: {
    get: () => request('/admin/diagnostics'),
  },

  monitoring: {
    reportClientError: (data) => request('/monitoring/client-error', {
      method: 'POST',
      body: JSON.stringify(data),
    }, { skipRefresh: true, skipRetry: true }),
  },

  tips: {
    getAll: () => request('/tips'),
    create: (formData) => request('/tips', {
      method: 'POST',
      body: formData,
    }),
    update: (id, status) => request(`/tips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
    delete: (id) => request(`/tips/${id}`, { method: 'DELETE' }),
  },

  backup: {
    download: () => requestBlob('/backup'),
  },

  reset: () => request('/reset', { method: 'POST' }),
};
