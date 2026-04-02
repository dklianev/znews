import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reportClientError = vi.fn(() => Promise.resolve());

vi.mock('../../src/utils/api', () => ({
  api: {
    monitoring: {
      reportClientError,
    },
  },
}));

vi.mock('../../src/utils/chunkReload', () => ({
  isChunkLoadError: () => false,
  shouldReloadForChunkError: () => false,
}));

const { default: ErrorBoundary } = await import('../../src/components/ErrorBoundary.jsx');

function ThrowingChild() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  let container;
  let root;
  let consoleErrorSpy;

  afterEach(async () => {
    reportClientError.mockClear();
    consoleErrorSpy?.mockRestore();
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

  it('renders the provided fallback and reports the client error once', async () => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          ErrorBoundary,
          { fallback: createElement('div', { 'data-testid': 'fallback' }, 'fallback-ui') },
          createElement(ThrowingChild),
        ),
      );
    });

    expect(container.querySelector('[data-testid=\"fallback\"]')?.textContent).toBe('fallback-ui');
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      component: 'ErrorBoundary',
      message: 'boom',
    }));
  });
});
