import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inputValue } from './helpers/domHarness.mjs';

const incrementArticleView = vi.fn();
const submitContactMessage = vi.fn(() => Promise.resolve({ ok: true, id: 91 }));
const getPublishedRightOfReply = vi.fn(() => Promise.resolve([]));
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

const publicDataState = {
  articles: [],
  authors: [],
  categories: [],
  ads: [],
  incrementArticleView,
  loading: false,
  siteSettings: null,
};

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => publicDataState,
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    articles: {
      getById,
    },
    contactMessages: {
      submit: (...args) => submitContactMessage(...args),
      getPublishedRightOfReply: (...args) => getPublishedRightOfReply(...args),
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
  const originalUserAgent = window.navigator.userAgent;

  afterEach(async () => {
    incrementArticleView.mockClear();
    getById.mockClear();
    submitContactMessage.mockClear();
    getPublishedRightOfReply.mockClear();
    publicDataState.articles = [];
    publicDataState.authors = [];
    publicDataState.categories = [];
    publicDataState.ads = [];
    publicDataState.loading = false;
    publicDataState.siteSettings = null;
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
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
    expect(getPublishedRightOfReply).toHaveBeenCalledWith(27);
    expect(container.textContent).toContain('Test article title');
    expect(container.textContent).toContain('Test article excerpt');
    expect(incrementArticleView).toHaveBeenCalledWith(27);
  });

  it('renders the right-of-reply section tied to the current article', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArticlePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    const nameInput = container.querySelector('input[aria-label="Име за право на отговор"]');
    const phoneInput = container.querySelector('input[aria-label="Телефон за право на отговор"]');
    const messageInput = container.querySelector('textarea[aria-label="Текст на правото на отговор"]');
    const replyForm = messageInput?.closest('form');
    const submitButton = replyForm?.querySelector('button[type="submit"]');

    expect(container.textContent).toContain('ПРАВО НА ОТГОВОР');
    expect(nameInput).not.toBeNull();
    expect(phoneInput).not.toBeNull();
    expect(messageInput).not.toBeNull();
    expect(replyForm).not.toBeNull();
    expect(submitButton).not.toBeNull();
    expect(container.textContent).toContain('Искането ще бъде заведено към редакцията като право на отговор по статия №27.');
  });

  it('renders published right-of-reply links when the article has a published response', async () => {
    getPublishedRightOfReply.mockResolvedValueOnce([
      {
        id: 91,
        title: 'Отговор на засегнатата страна',
        excerpt: 'Публикуваният отговор вече е свързан с тази статия.',
        cardSticker: 'ОТГОВОР',
        date: '2026-04-03',
      },
    ]);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArticlePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('ПУБЛИКУВАНИ ОТГОВОРИ');
    expect(container.textContent).toContain('Отговор на засегнатата страна');
    const replyLink = container.querySelector('a[href="/article/91"]');
    expect(replyLink).not.toBeNull();
    expect(replyLink.getAttribute('aria-label')).toContain('Отговор на засегнатата страна');
  });

  it('renders a next article block when there is a newer follow-up article in the feed', async () => {
    publicDataState.articles = [
      {
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
        status: 'published',
      },
      {
        id: 18,
        title: 'Следващата голяма новина',
        excerpt: 'Нова публикация след тази статия.',
        content: '<p>Body</p>',
        category: 'business',
        authorId: 7,
        date: '2026-04-01',
        readTime: 3,
        views: 22,
        image: '/uploads/next.jpg',
        status: 'published',
      },
    ];
    publicDataState.categories = [
      { id: 'crime', name: 'Крими' },
      { id: 'business', name: 'Бизнес' },
    ];

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArticlePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('СЛЕДВАЩА СТАТИЯ');
    expect(container.textContent).toContain('Следващата голяма новина');
    const nextLink = container.querySelector('a[href="/article/18"]');
    expect(nextLink).not.toBeNull();
    expect(nextLink.getAttribute('aria-label')).toContain('Следващата голяма новина');
  });

  it('opens a lightbox when an inline article image is clicked', async () => {
    getById.mockResolvedValueOnce({
      id: 27,
      title: 'Статия със снимка',
      excerpt: 'Тест за lightbox',
      content: '<p>Преди снимката</p><figure><img src="/uploads/inline.jpg" alt="Сцена от мястото" /><figcaption>Снимка от мястото на събитието</figcaption></figure><p>След снимката</p>',
      category: 'crime',
      authorId: 7,
      date: '2026-04-02',
      readTime: 4,
      views: 12,
      image: '/uploads/test.jpg',
      reactions: undefined,
      tags: ['test'],
      status: 'published',
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArticlePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    const inlineImage = container.querySelector('.article-body img[src="/uploads/inline.jpg"]');
    expect(inlineImage).not.toBeNull();

    await act(async () => {
      inlineImage.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const overlayImage = document.querySelector('.lightbox-overlay img[src="/uploads/inline.jpg"]');
    expect(overlayImage).not.toBeNull();
    expect(document.body.textContent).toContain('Снимка от мястото на събитието');

    await act(async () => {
      overlayImage.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.querySelector('.lightbox-overlay')).toBeNull();
  });

  it('shows the CEF YouTube fallback text for inline article embeds', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'CitizenFX/1.0 Chrome/103.0.0.0',
    });

    getById.mockResolvedValueOnce({
      id: 27,
      title: 'Статия с вградено видео',
      excerpt: 'Тест за fallback',
      content: '<p>Преди видеото</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="100%" height="400" frameborder="0" allowfullscreen="true"></iframe><p>След видеото</p>',
      category: 'crime',
      authorId: 7,
      date: '2026-04-02',
      readTime: 4,
      views: 12,
      image: '/uploads/test.jpg',
      reactions: undefined,
      tags: ['test'],
      status: 'published',
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(ArticlePage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Видео плейърът е недостъпен');
    expect(container.textContent).toContain('YouTube не се поддържа тук.');
    expect(container.textContent).toContain('znews.live/article/27');
    expect(container.querySelector('.article-body iframe')).toBeNull();
  });
});
