import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAll = vi.fn();
const getAuthorStats = vi.fn();
let resolveArticlesRequest;

const articlesData = {
  loading: false,
  articles: [],
};

const taxonomyData = {
  authors: [
    { id: 7, name: 'Иван Репортер', role: 'Автор', bio: 'Теренен журналист.' },
  ],
  categories: [
    { id: 'crime', name: 'Крими' },
    { id: 'society', name: 'Общество' },
  ],
};

const settingsData = {
  ads: [],
};

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => ({
    ...articlesData,
    ...taxonomyData,
    ...settingsData,
  }),
  useArticlesData: () => articlesData,
  useTaxonomyData: () => taxonomyData,
  useSettingsData: () => settingsData,
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    articles: {
      getAll,
      getAuthorStats,
    },
  },
}));

vi.mock('../../src/hooks/useDocumentTitle', () => ({
  makeTitle: (value) => value,
  useDocumentTitle: () => {},
}));

vi.mock('../../src/utils/newsDate', () => ({
  formatNewsDate: () => '5 април 2026',
}));

vi.mock('../../src/components/TrendingSidebar', () => ({
  default: () => createElement('aside', { 'data-testid': 'trending-sidebar' }, 'trending'),
}));

vi.mock('../../src/components/ads/AdSlot', () => ({
  default: ({ slot }) => createElement('div', { 'data-slot': slot }, slot),
}));

vi.mock('../../src/components/ResponsiveImage', () => ({
  default: ({ alt }) => createElement('img', { alt }),
}));

vi.mock('motion/react', () => {
  function createMotionElement(tag) {
    return ({ children, animate, exit, initial, layout, transition, whileHover, whileTap, ...props }) =>
      createElement(tag, props, children);
  }

  return {
    motion: new Proxy({}, { get: (_target, tag) => createMotionElement(tag) }),
  };
});

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '7' }),
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
}));

const { default: AuthorPage } = await import('../../src/pages/AuthorPage.jsx');

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('AuthorPage', () => {
  let container;
  let root;

  afterEach(async () => {
    getAll.mockReset();
    getAuthorStats.mockReset();
    resolveArticlesRequest = null;
    articlesData.articles = [];
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

  it('warm-starts the first page from context and replaces it with the server result', async () => {
    articlesData.articles = [
      {
        id: 17,
        title: 'Seeded author article',
        excerpt: 'От локалния article pool.',
        category: 'crime',
        authorId: 7,
        date: '2026-04-06',
        status: 'published',
        views: 11,
      },
    ];
    getAuthorStats.mockResolvedValueOnce({
      totalArticles: 3,
      totalViews: 320,
      totalReactions: 27,
      categoryCount: 2,
    });
    getAll.mockImplementationOnce(() => new Promise((resolve) => {
      resolveArticlesRequest = resolve;
    }));

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(AuthorPage));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Seeded author article');
    expect(getAuthorStats).toHaveBeenCalledWith(7);
    expect(getAll).toHaveBeenCalledWith(expect.objectContaining({
      authorId: 7,
      page: 1,
      limit: 12,
    }));

    await act(async () => {
      resolveArticlesRequest?.({
        items: [
          {
            id: 91,
            title: 'Server-authoritative article',
            excerpt: 'Истинският paginated резултат.',
            category: 'society',
            authorId: 7,
            date: '2026-04-05',
            status: 'published',
            views: 33,
          },
        ],
        total: 1,
      });
      await flush();
    });

    expect(container.textContent).toContain('Server-authoritative article');
    expect(container.querySelector('[data-slot="author.content.1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="trending-sidebar"]')).not.toBeNull();
  });
});
