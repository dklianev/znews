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

  it('captures same-origin asset load failures, strips query/hash, and deduplicates', async () => {
    const cleanup = installClientAssetMonitoring();
    const script = document.createElement('script');
    // Same-origin URL (jsdom defaults to http://localhost:3000)
    script.src = `${window.location.origin}/assets/index-old.js?v=123#hash`;
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
        assetUrl: `${window.location.origin}/assets/index-old.js`,
      }),
    }));

    cleanup();
  });

  it('labels modulepreload link failures as JS, not CSS', async () => {
    const cleanup = installClientAssetMonitoring();
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = `${window.location.origin}/assets/index-XuQ-fzYc.js`;
    document.body.appendChild(link);

    link.dispatchEvent(new Event('error'));
    await Promise.resolve();

    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      component: 'asset-loader',
      message: 'Неуспешно зареждане на JS ресурс.',
      extra: expect.objectContaining({
        kind: 'asset-load',
        tagName: 'LINK',
        rel: 'modulepreload',
        assetUrl: `${window.location.origin}/assets/index-XuQ-fzYc.js`,
      }),
    }));

    cleanup();
  });

  it('labels stylesheet link failures as CSS', async () => {
    const cleanup = installClientAssetMonitoring();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${window.location.origin}/assets/index-abc.css`;
    document.body.appendChild(link);

    link.dispatchEvent(new Event('error'));
    await Promise.resolve();

    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      component: 'asset-loader',
      message: 'Неуспешно зареждане на CSS ресурс.',
      extra: expect.objectContaining({
        tagName: 'LINK',
        rel: 'stylesheet',
      }),
    }));

    cleanup();
  });

  it('labels font preload link failures as font using the as attribute', async () => {
    const cleanup = installClientAssetMonitoring();
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.href = `${window.location.origin}/assets/oswald.woff2`;
    document.body.appendChild(link);

    link.dispatchEvent(new Event('error'));
    await Promise.resolve();

    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      component: 'asset-loader',
      message: 'Неуспешно зареждане на шрифт ресурс.',
      extra: expect.objectContaining({
        tagName: 'LINK',
        rel: 'preload',
        as: 'font',
      }),
    }));

    cleanup();
  });

  it('ignores cross-origin asset errors to prevent leaking third-party URLs', async () => {
    const cleanup = installClientAssetMonitoring();
    const script = document.createElement('script');
    script.src = 'https://evil.example.com/assets/tracker.js?token=secret';
    document.body.appendChild(script);

    script.dispatchEvent(new Event('error'));
    await Promise.resolve();

    expect(reportClientError).not.toHaveBeenCalled();

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
