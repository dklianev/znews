import React, { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, inputValue, installClipboardStub, installStorageStub, renderIntoBody, submitForm, unmountRoot } from './helpers/domHarness.mjs';

const refresh = vi.fn(async () => {});
const votePoll = vi.fn(async () => {});
const navigate = vi.fn();
const toggleDark = vi.fn();

let publicDataState = {};
let themeState = { isDark: false, toggleDark };
let locationState = { pathname: '/' };

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => publicDataState,
  useArticlesData: () => ({
    articles: publicDataState.articles,
    loading: publicDataState.loading,
    loadError: publicDataState.loadError,
    refresh: publicDataState.refresh,
    homepage: publicDataState.homepage,
  }),
  useTaxonomyData: () => ({
    categories: publicDataState.categories,
  }),
  useSettingsData: () => ({
    ads: publicDataState.ads,
    heroSettings: publicDataState.heroSettings,
    siteSettings: publicDataState.siteSettings,
  }),
  useEngagementData: () => ({
    polls: publicDataState.polls,
    votePoll: publicDataState.votePoll,
  }),
}));

vi.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => themeState,
}));

vi.mock('../../src/hooks/useDocumentTitle', () => ({
  useDocumentTitle: () => {},
}));

vi.mock('../../src/components/ArticleCard', () => ({
  default: ({ article }) => createElement('article', { 'data-testid': `article-card-${article?.id}` }, article?.title),
}));

vi.mock('../../src/components/ComicNewsCard', () => ({
  default: ({ article }) => createElement('article', { 'data-testid': `comic-card-${article?.id}` }, article?.title),
}));

vi.mock('../../src/components/TrendingSidebar', () => ({
  default: () => createElement('aside', { 'data-testid': 'trending' }, 'trending'),
}));

vi.mock('../../src/components/MostWanted', () => ({
  default: () => createElement('aside', { 'data-testid': 'most-wanted' }, 'wanted'),
}));

vi.mock('../../src/components/HomeSidebarRail', () => ({
  default: ({ ads }) => createElement('aside', { 'data-testid': 'home-sidebar-rail', 'data-ad-count': Array.isArray(ads) ? ads.length : 0 }, 'sidebar-rail'),
}));

vi.mock('../../src/components/ads/AdSlot', () => ({
  default: ({ slot }) => createElement('div', { 'data-slot': slot }, slot),
}));

vi.mock('../../src/components/ResponsiveImage', () => ({
  default: ({ alt }) => createElement('img', { alt }),
}));

vi.mock('../../src/components/ErrorBoundary', () => ({
  default: ({ children, fallback }) => createElement(React.Fragment, null, children ?? fallback ?? null),
}));

vi.mock('../../src/components/games/GamesDailyStatus', () => ({
  default: () => createElement('div', { 'data-testid': 'games-daily-status' }, 'daily-status'),
}));

vi.mock('motion/react', () => {
  function createMotionElement(tag) {
    return ({ children, animate, exit, initial, layout, layoutId, transition, whileHover, whileTap, ...props }) =>
      createElement(tag, props, children);
  }

  return {
    motion: new Proxy({}, { get: (_target, tag) => createMotionElement(tag) }),
    AnimatePresence: ({ children }) => createElement(React.Fragment, null, children),
  };
});

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
  useNavigate: () => navigate,
  useLocation: () => locationState,
  useOutletContext: () => null,
}));

const { default: HomePage } = await import('../../src/pages/HomePage.jsx');
const { default: PollWidget } = await import('../../src/components/PollWidget.jsx');
const { default: Navbar } = await import('../../src/components/Navbar.jsx');

describe('PublicShell', () => {
  let root;
  let container;

  afterEach(async () => {
    refresh.mockClear();
    votePoll.mockClear();
    navigate.mockClear();
    toggleDark.mockClear();
    publicDataState = {};
    themeState = { isDark: false, toggleDark };
    locationState = { pathname: '/' };
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('renders the homepage error fallback and retries loading', async () => {
    publicDataState = {
      articles: [],
      ads: [],
      categories: [],
      heroSettings: {},
      siteSettings: {},
      loading: false,
      loadError: 'Грешка при началната страница',
      refresh,
      homepage: null,
    };

    ({ root, container } = await renderIntoBody(HomePage));

    expect(container.textContent).toContain('Грешка при началната страница');
    const retryButton = container.querySelector('button');
    await click(retryButton);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('shows compact quick categories and expands them on demand on the homepage', async () => {
    const homepageArticles = Array.from({ length: 7 }, (_, index) => ({
      id: index + 1,
      title: `Новина ${index + 1}`,
      excerpt: `Описание ${index + 1}`,
      category: `cat-${(index % 3) + 1}`,
      authorId: 1,
      date: '2026-04-10T12:00:00.000Z',
      views: 10 + index,
      readTime: 4,
    }));
    const quickCategories = Array.from({ length: 10 }, (_, index) => ({
      id: `cat-${index + 1}`,
      name: `Категория ${index + 1}`,
    }));

    publicDataState = {
      articles: homepageArticles,
      ads: [{ id: 1 }, { id: 2 }],
      categories: quickCategories,
      heroSettings: {},
      siteSettings: {
        navbarLinks: quickCategories.map((category) => ({ to: `/category/${category.id}`, label: category.name })),
      },
      loading: false,
      loadError: '',
      refresh,
      homepage: {
        articlePool: homepageArticles,
        sections: {
          heroArticleId: 1,
          heroPrimaryPhotoId: 1,
          heroSiblingIds: [2, 3],
          featuredIds: [4, 5, 6],
          crimeIds: [],
          breakingIds: [],
          emergencyIds: [],
          reportageIds: [],
          sponsoredIds: [7],
          latestShowcaseIds: [1, 2, 3, 4, 5],
          latestWireIds: [6, 7],
        },
      },
    };

    ({ root, container } = await renderIntoBody(HomePage));

    expect(container.textContent).toContain('Още теми');
    expect(container.textContent).toContain('Платено съдържание от партньори и рекламодатели.');
    expect(container.textContent).not.toContain('Категория 10');

    const toggleButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Още теми'));
    await click(toggleButton);

    expect(container.textContent).toContain('Категория 10');
    expect(container.textContent).toContain('По-малко теми');
    expect(container.querySelector('[data-testid="home-sidebar-rail"]')).not.toBeNull();
  });

  it('records poll votes and persists them in local storage', async () => {
    installStorageStub(window);
    publicDataState = {
      polls: [{
        id: 12,
        active: true,
        question: 'Чувствате ли се сигурни?',
        options: [
          { text: 'Да', votes: 2 },
          { text: 'Не', votes: 1 },
        ],
      }],
      votePoll,
    };

    ({ root, container } = await renderIntoBody(PollWidget));

    const voteButtons = Array.from(container.querySelectorAll('button'));
    await click(voteButtons[0]);

    expect(votePoll).toHaveBeenCalledWith(12, 0);
    expect(window.localStorage.getItem('zn_voted_polls')).toContain('"12":0');
  });

  it('opens navbar search with Ctrl+K and navigates to the search route', async () => {
    installClipboardStub();
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: { requestPermission: async () => 'granted' },
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({ pushManager: { getSubscription: async () => null } }),
      },
    });

    publicDataState = {
      siteSettings: {},
      categories: [{ id: 'breaking', name: 'Извънредни' }],
    };

    ({ root, container } = await renderIntoBody(Navbar));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    const input = container.querySelector('#site-search');
    expect(input).not.toBeNull();
    await inputValue(input, 'тест');
    await submitForm(container.querySelector('#site-search-panel'));

    expect(navigate).toHaveBeenCalledWith('/search?q=%D1%82%D0%B5%D1%81%D1%82');
  });
});
