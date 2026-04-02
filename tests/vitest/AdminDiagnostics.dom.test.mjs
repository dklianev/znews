import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getDiagnostics = vi.fn();

vi.mock('../../src/utils/api', () => ({
  api: {
    diagnostics: {
      get: getDiagnostics,
    },
  },
}));

vi.mock('lucide-react', () => {
  function Icon(props) {
    return createElement('svg', { ...props, 'data-testid': 'icon' });
  }

  return {
    Activity: Icon,
    AlertTriangle: Icon,
    Database: Icon,
    HardDrive: Icon,
    RefreshCw: Icon,
    ShieldAlert: Icon,
  };
});

const { default: AdminDiagnostics } = await import('../../src/pages/admin/AdminDiagnostics.jsx');

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('AdminDiagnostics', () => {
  let container;
  let root;

  afterEach(async () => {
    getDiagnostics.mockReset();
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
    root = null;
    container = null;
  });

  it('renders monitoring details including pathname and stack sections', async () => {
    getDiagnostics.mockResolvedValueOnce({
      generatedAt: '2026-04-02T12:00:00.000Z',
      app: { uptimeSeconds: 120, env: 'test', memory: { heapUsed: 1024 * 1024 } },
      mongo: { state: 'connected', name: 'zemun-news-test' },
      storage: { driver: 'disk', remote: false, uploadDedupCacheSize: 0, uploadInFlight: 0 },
      mediaPipeline: { ready: 0, pending: 0 },
      cache: { keyCount: 0, ttlSeconds: 60, countsByTag: {}, performance: {}, recentInvalidations: [] },
      jobs: [],
      requestMetrics: { totals: {}, groups: [], recentRequests: [], slowRequests: [], slowRequestThresholdMs: 500, startedAt: null },
      adAnalytics: { latestBucket: null, last7Days: { impressions: 0, clicks: 0, rows: 0 } },
      monitoring: {
        recentErrors: [
          {
            fingerprint: 'abc123',
            level: 'error',
            source: 'client',
            component: 'ErrorBoundary',
            message: 'Minified React error #185',
            count: 10,
            lastSeenAt: '2026-04-02T11:59:00.000Z',
            metadata: {
              pathname: '/article/27',
              stack: 'Error: Minified React error #185\n at renderArticle',
              extra: {
                componentStack: 'at ArticlePage\nat ErrorBoundary',
              },
            },
          },
        ],
      },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(AdminDiagnostics));
      await flush();
    });

    expect(getDiagnostics).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Diagnostics');
    expect(container.textContent).toContain('Minified React error #185');
    expect(container.textContent).toContain('/article/27');
    expect(container.textContent).toContain('client / ErrorBoundary');
    expect(container.querySelectorAll('details')).toHaveLength(2);
    expect(container.textContent).toContain('at ArticlePage');
    expect(container.textContent).toContain('Error: Minified React error #185');
  });

  it('shows an inline error banner when diagnostics loading fails', async () => {
    getDiagnostics.mockRejectedValueOnce(new Error('request failed'));

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(AdminDiagnostics));
      await flush();
    });

    expect(getDiagnostics).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('request failed');
    expect(container.textContent).toContain('Diagnostics');
  });
});
