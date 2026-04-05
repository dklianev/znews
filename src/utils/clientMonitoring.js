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

function getAssetDetails(target) {
  if (!target || typeof target !== 'object') return null;

  const tagName = String(target.tagName || '').toUpperCase();
  const assetUrl = tagName === 'SCRIPT'
    ? String(target.src || '')
    : tagName === 'LINK'
      ? String(target.href || '')
      : '';

  if (!assetUrl || !isAssetLikeUrl(assetUrl)) return null;

  return {
    tagName,
    assetUrl,
    rel: String(target.rel || ''),
  };
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

    const message = details.tagName === 'LINK'
      ? 'Неуспешно зареждане на CSS ресурс.'
      : 'Неуспешно зареждане на JS ресурс.';

    reportClientIssue({
      component: 'asset-loader',
      message,
      extra: {
        kind: 'asset-load',
        tagName: details.tagName,
        assetUrl: details.assetUrl,
        rel: details.rel,
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
