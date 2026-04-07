import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const incrementArticleView = vi.fn();
const getById = vi.fn(() => Promise.resolve({
  id: 27,
  title: 'Test article title',
  excerpt: 'Test article excerpt',
  content: '<p>First paragraph</p><p>Second paragraph</p>',
  category: 'crime',
  authorId: 7,
  date: '2026-04-02',
  readTime: 4,
  views: 12,
  image: '/uploads/test.jpg',
  reactions: undefined,
  tags: ['test'],
  status: 'published',
}));

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => ({
    articles: [],
    authors: [],
    categories: [],
    ads: [],
    incrementArticleView,
    loading: false,
    siteSettings: null,
  }),
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    articles: {
      getById,
    },
  },
}));

vi.mock('../../src/hooks/useDocumentTitle', () => ({
  makeTitle: (value) => value,
  useDocumentTitle: () => {},
}));

vi.mock('../../src/hooks/useDocumentMeta', () => ({
  useDocumentMeta: () => {},
}));

vi.mock('../../src/utils/newsDate', () => ({
  formatNewsDate: () => '2 април 2026',
}));

vi.mock('../../src/components/ads/AdSlot', () => ({
  default: ({ slot }) => createElement('div', { 'data-slot': slot }),
}));

vi.mock('../../src/components/TrendingSidebar', () => ({
  default: () => createElement('aside', { 'data-testid': 'trending-sidebar' }, 'trending'),
}));

vi.mock('../../src/components/CommentsSection', () => ({
  default: () => createElement('section', { 'data-testid': 'comments-section' }, 'comments'),
}));

vi.mock('../../src/components/ComicNewsCard', () => ({
  default: ({ article }) => createElement('article', { 'data-testid': `comic-card-${article?.id}` }, article?.title),
}));

vi.mock('../../src/components/ResponsiveImage', () => ({
  default: ({ alt }) => createElement('img', { alt }),
}));

vi.mock('../../src/components/YouTubeEmbed', () => ({
  default: ({ title }) => createElement('div', { 'data-testid': 'youtube-embed' }, title),
}));

vi.mock('../../src/components/ErrorBoundary', () => ({
  default: ({ children, fallback }) => createElement(React.Fragment, null, children ?? fallback ?? null),
}));

vi.mock('../../src/components/ArticleReactions', () => ({
  default: () => createElement('div', { 'data-testid': 'article-reactions' }, 'reactions'),
}));

vi.mock('../../src/utils/comicCardDesign', () => ({
  getComicCardStyle: () => ({ tilt: 0, variant: 'default', stripe: null }),
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
    AnimatePresence: ({ children }) => createElement(React.Fragment, null, children),
  };
});

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '27' }),
  useNavigationType: () => 'PUSH',
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
  useOutletContext: () => null,
}));

const { default: ArticlePage } = await import('../../src/pages/ArticlePage.jsx');

describe('ArticlePage', () => {
  let container;
  let root;

  afterEach(async () => {
    incrementArticleView.mockClear();
    getById.mockClear();
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

  it('renders safely while hydrating a direct article fetch', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArticlePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getById).toHaveBeenCalledTimes(1);
    expect(getById).toHaveBeenCalledWith(27);
    expect(container.textContent).toContain('Test article title');
    expect(container.textContent).toContain('Test article excerpt');
    expect(incrementArticleView).toHaveBeenCalledWith(27);
  });
});
