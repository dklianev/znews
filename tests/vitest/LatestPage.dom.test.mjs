import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAll = vi.fn();
const setSearchParams = vi.fn();

const publicData = {
  ads: [],
  siteSettings: { layoutPresets: {} },
  loading: false,
};

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => publicData,
  useArticlesData: () => ({
    loading: publicData.loading,
  }),
  useSettingsData: () => ({
    ads: publicData.ads,
    siteSettings: publicData.siteSettings,
  }),
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    articles: {
      getAll,
    },
  },
}));

vi.mock('../../src/hooks/useDocumentTitle', () => ({
  makeTitle: (value) => value,
  useDocumentTitle: () => {},
}));

vi.mock('../../src/utils/comicCardDesign', () => ({
  getComicCardStyle: () => ({ tilt: 0, variant: 'default', sticker: null, stripe: null }),
}));

vi.mock('../../src/components/TrendingSidebar', () => ({
  default: () => createElement('aside', { 'data-testid': 'trending-sidebar' }, 'trending'),
}));

vi.mock('../../src/components/ads/AdSlot', () => ({
  default: ({ slot }) => createElement('div', { 'data-slot': slot }, slot),
}));

vi.mock('../../src/components/ComicNewsCard', () => ({
  default: ({ article }) => createElement('article', { 'data-testid': `comic-card-${article?.id}` }, article?.title),
}));

vi.mock('motion/react', async () => {
  function createMotionElement(tag) {
    return ({ children, animate, exit, initial, layout, transition, whileHover, whileTap, ...props }) =>
      createElement(tag, props, children);
  }

  return {
    motion: new Proxy({}, {
      get: (_, tag) => createMotionElement(tag),
    }),
  };
});

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
  useSearchParams: () => [new URLSearchParams('page=2'), setSearchParams],
}));

const { default: LatestPage } = await import('../../src/pages/LatestPage.jsx');

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('LatestPage', () => {
  let container;
  let root;
  let sessionStore;
  let originalSessionStorage;

  beforeEach(() => {
    getAll.mockReset();
    setSearchParams.mockReset();
    sessionStore = new Map();
    originalSessionStorage = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem(key) {
          return sessionStore.has(key) ? sessionStore.get(key) : null;
        },
        setItem(key, value) {
          sessionStore.set(key, String(value));
        },
        removeItem(key) {
          sessionStore.delete(key);
        },
      },
    });
    window.scrollTo = vi.fn();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (originalSessionStorage !== undefined) {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        value: originalSessionStorage,
      });
    }
    root = null;
    container = null;
    sessionStore = null;
    originalSessionStorage = undefined;
  });

  it('requests the correct page window for paginated latest articles', async () => {
    getAll.mockResolvedValueOnce({
      items: [
        { id: 91, title: 'Latest article page two', category: 'crime', date: '2026-04-02' },
      ],
      total: 30,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(LatestPage));
      await flush();
    });

    expect(getAll).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      limit: 24,
    }));
    expect(container.textContent).toContain('Latest article page two');
    expect(container.querySelector('[data-testid="trending-sidebar"]')).not.toBeNull();
  });

  it('retries the latest feed after an initial request failure', async () => {
    getAll
      .mockRejectedValueOnce(new Error('latest failed'))
      .mockResolvedValueOnce({
        items: [{ id: 92, title: 'Recovered latest article', category: 'crime', date: '2026-04-02' }],
        total: 1,
      });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(LatestPage));
      await flush();
    });

    expect(container.textContent).toContain('latest failed');

    const retryButton = container.querySelector('button');
    expect(retryButton).not.toBeNull();

    await act(async () => {
      retryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
    });

    expect(getAll).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Recovered latest article');
  });
});
