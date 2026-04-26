import { api } from './api';

const CLIENT_MONITORING_DEDUP_WINDOW_MS = 15_000;
const recentClientReports = new Map();

function getSafeWindow() {
  return typeof window === 'undefined' ? null : window;
}

function getSafePathname() {
  const currentWindow = getSafeWindow();
  return currentWindow?.location?.pathname || '';
}

function pruneRecentReports(now) {
  recentClientReports.forEach((value, key) => {
    if (now - value > CLIENT_MONITORING_DEDUP_WINDOW_MS) {
      recentClientReports.delete(key);
    }
  });
}

function shouldSkipDuplicateReport(key, now = Date.now()) {
  pruneRecentReports(now);
  const lastSeenAt = recentClientReports.get(key) || 0;
  if (lastSeenAt > 0 && now - lastSeenAt <= CLIENT_MONITORING_DEDUP_WINDOW_MS) {
    return true;
  }
  recentClientReports.set(key, now);
  return false;
}

function isAssetLikeUrl(value) {
  const url = String(value || '').trim();
  if (!url) return false;
  if (url.includes('/assets/')) return true;
  return /\.(?:js|css|map|png|jpe?g|svg|webp|avif|woff2?|ttf|ico)(?:[?#].*)?$/i.test(url);
}

function isSameOrigin(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

function stripQueryHash(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin + parsed.pathname;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

function getAssetDetails(target) {
  if (!target || typeof target !== 'object') return null;

  const tagName = String(target.tagName || '').toUpperCase();
  const assetUrl = tagName === 'SCRIPT'
    ? String(target.src || '')
    : tagName === 'LINK'
      ? String(target.href || '')
      : '';

  if (!assetUrl || !isAssetLikeUrl(assetUrl)) return null;
  if (!isSameOrigin(assetUrl)) return null;

  return {
    tagName,
    assetUrl: stripQueryHash(assetUrl),
    rel: String(target.rel || ''),
    as: String(target.as || ''),
  };
}

function getAssetTypeLabel(details) {
  if (details.tagName === 'SCRIPT') return 'JS';

  const rel = details.rel.toLowerCase();
  const as = details.as.toLowerCase();

  if (rel === 'stylesheet') return 'CSS';
  if (rel === 'modulepreload') return 'JS';
  if (rel === 'preload' || rel === 'prefetch') {
    if (as === 'script') return 'JS';
    if (as === 'style') return 'CSS';
    if (as === 'font') return 'шрифт';
    if (as === 'image') return 'изображение';
  }

  // Fall back to URL extension when rel/as don't disambiguate
  if (/\.css(?:[?#]|$)/i.test(details.assetUrl)) return 'CSS';
  if (/\.(?:js|mjs)(?:[?#]|$)/i.test(details.assetUrl)) return 'JS';
  if (/\.(?:woff2?|ttf|otf)(?:[?#]|$)/i.test(details.assetUrl)) return 'шрифт';
  if (/\.(?:png|jpe?g|svg|webp|avif|gif|ico)(?:[?#]|$)/i.test(details.assetUrl)) return 'изображение';

  return '';
}

export function reportClientIssue({
  component = 'client',
  message = 'Client error',
  stack = '',
  pathname = getSafePathname(),
  extra = null,
  dedupeKey = '',
} = {}) {
  const safeMessage = String(message || '').trim();
  if (!safeMessage) return Promise.resolve(false);

  const key = dedupeKey || `${component}|${safeMessage}`;
  if (shouldSkipDuplicateReport(key)) return Promise.resolve(false);

  return api.monitoring.reportClientError({
    component,
    message: safeMessage,
    stack,
    pathname,
    extra,
  }).then(() => true).catch(() => false);
}

export function reportChunkLoadIssue(error, {
  component = 'chunk-loader',
  phase = 'unknown',
  autoReload = false,
} = {}) {
  const message = error?.message || 'Грешка при зареждане на новата версия.';
  return reportClientIssue({
    component,
    message,
    stack: error?.stack || '',
    extra: {
      kind: 'chunk-load',
      phase,
      autoReload,
      errorName: error?.name || '',
    },
    dedupeKey: `${component}|${message}|${phase}`,
  });
}

export function installClientAssetMonitoring() {
  const currentWindow = getSafeWindow();
  if (!currentWindow || currentWindow.__znClientAssetMonitoringInstalled) {
    return () => {};
  }

  const handleResourceError = (event) => {
    const details = getAssetDetails(event?.target);
    if (!details) return;

    const typeLabel = getAssetTypeLabel(details);
    const message = typeLabel
      ? `Неуспешно зареждане на ${typeLabel} ресурс.`
      : 'Неуспешно зареждане на ресурс.';

    reportClientIssue({
      component: 'asset-loader',
      message,
      extra: {
        kind: 'asset-load',
        tagName: details.tagName,
        assetUrl: details.assetUrl,
        rel: details.rel,
        as: details.as,
      },
      dedupeKey: `asset-loader|${details.tagName}|${details.assetUrl}`,
    }).catch(() => {});
  };

  currentWindow.__znClientAssetMonitoringInstalled = true;
  currentWindow.addEventListener('error', handleResourceError, true);

  return () => {
    currentWindow.removeEventListener('error', handleResourceError, true);
    delete currentWindow.__znClientAssetMonitoringInstalled;
  };
}
