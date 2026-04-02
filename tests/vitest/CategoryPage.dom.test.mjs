import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAll = vi.fn();

const publicData = {
  categories: [
    { id: 'crime', name: 'Crime' },
    { id: 'underground', name: 'Underground' },
  ],
  ads: [],
  siteSettings: { layoutPresets: {} },
  loading: false,
};

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => publicData,
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
  useParams: () => ({ slug: 'crime-underground' }),
}));

const { default: CategoryPage } = await import('../../src/pages/CategoryPage.jsx');

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('CategoryPage', () => {
  let container;
  let root;

  afterEach(async () => {
    getAll.mockReset();
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

  it('loads synthetic category aliases through the public article query', async () => {
    getAll.mockResolvedValueOnce({
      items: [
        {
          id: 51,
          title: 'Combined category article',
          category: 'crime',
          date: '2026-04-02',
        },
      ],
      total: 1,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(CategoryPage));
      await flush();
    });

    expect(getAll).toHaveBeenCalledWith(expect.objectContaining({
      categories: 'crime,underground',
      page: 1,
      limit: 6,
    }));
    expect(container.textContent).toContain('Combined category article');
    expect(container.querySelector('[data-slot="category.top"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="trending-sidebar"]')).not.toBeNull();
  });
});
