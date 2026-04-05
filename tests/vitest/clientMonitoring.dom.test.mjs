import { afterEach, describe, expect, it, vi } from 'vitest';

const reportClientError = vi.fn(() => Promise.resolve({ ok: true }));

vi.mock('../../src/utils/api', () => ({
  api: {
    monitoring: {
      reportClientError,
    },
  },
}));

const {
  installClientAssetMonitoring,
  reportChunkLoadIssue,
  reportClientIssue,
} = await import('../../src/utils/clientMonitoring.js');

describe('clientMonitoring', () => {
  afterEach(() => {
    reportClientError.mockClear();
    document.body.innerHTML = '';
    delete window.__znClientAssetMonitoringInstalled;
  });

  it('reports stale chunk issues with phase metadata', async () => {
    await reportChunkLoadIssue(new TypeError('Expected JavaScript but got text/html'), {
      component: 'App.lazyRetry',
      phase: 'lazy-import',
      autoReload: true,
    });

    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      component: 'App.lazyRetry',
      message: 'Expected JavaScript but got text/html',
      extra: expect.objectContaining({
        kind: 'chunk-load',
        phase: 'lazy-import',
        autoReload: true,
      }),
    }));
  });

  it('captures asset load failures and deduplicates repeated reports for the same URL', async () => {
    const cleanup = installClientAssetMonitoring();
    const script = document.createElement('script');
    script.src = 'https://znews.live/assets/index-old.js';
    document.body.appendChild(script);

    script.dispatchEvent(new Event('error'));
    await Promise.resolve();
    script.dispatchEvent(new Event('error'));
    await Promise.resolve();

    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      component: 'asset-loader',
      message: 'Неуспешно зареждане на JS ресурс.',
      extra: expect.objectContaining({
        kind: 'asset-load',
        tagName: 'SCRIPT',
        assetUrl: 'https://znews.live/assets/index-old.js',
      }),
    }));

    cleanup();
  });

  it('skips duplicate manual client reports inside the dedupe window', async () => {
    await reportClientIssue({
      component: 'asset-loader',
      message: 'Неуспешно зареждане на CSS ресурс.',
      dedupeKey: 'same-asset',
    });
    await reportClientIssue({
      component: 'asset-loader',
      message: 'Неуспешно зареждане на CSS ресурс.',
      dedupeKey: 'same-asset',
    });

    expect(reportClientError).toHaveBeenCalledTimes(1);
  });
});
