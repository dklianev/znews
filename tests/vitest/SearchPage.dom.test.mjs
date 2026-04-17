import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const trending = vi.fn();
const suggest = vi.fn();
const searchQuery = vi.fn();
const loadJobs = vi.fn(() => Promise.resolve());
const loadCourt = vi.fn(() => Promise.resolve());
const loadEvents = vi.fn(() => Promise.resolve());

const publicData = {
  articles: [],
  jobs: [],
  court: [],
  events: [],
  wanted: [],
  siteSettings: { layoutPresets: {} },
  publicSectionStatus: {
    jobs: 'idle',
    court: 'idle',
    events: 'idle',
  },
  loadJobs,
  loadCourt,
  loadEvents,
};

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => publicData,
  useArticlesData: () => ({
    articles: publicData.articles,
  }),
  usePublicSectionsData: () => ({
    jobs: publicData.jobs,
    court: publicData.court,
    events: publicData.events,
    wanted: publicData.wanted,
    publicSectionStatus: publicData.publicSectionStatus,
    loadJobs: publicData.loadJobs,
    loadCourt: publicData.loadCourt,
    loadEvents: publicData.loadEvents,
  }),
  useSettingsData: () => ({
    siteSettings: publicData.siteSettings,
  }),
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    search: {
      trending,
      suggest,
      query: searchQuery,
    },
  },
}));

vi.mock('../../src/utils/comicCardDesign', () => ({
  getComicCardStyle: () => ({ tilt: 0, variant: 'default', sticker: null, stripe: null }),
}));

vi.mock('../../src/hooks/useDocumentTitle', () => ({
  makeTitle: (value) => value,
  useDocumentTitle: () => {},
}));

vi.mock('../../src/utils/newsDate', () => ({
  formatNewsDate: () => '2 Apr 2026',
}));

vi.mock('../../src/components/ComicNewsCard', () => ({
  default: ({ article }) => createElement('article', { 'data-testid': `comic-card-${article?.id}` }, article?.title),
}));

vi.mock('lucide-react', () => {
  function Icon(props) {
    return createElement('svg', { ...props, 'data-testid': 'icon' });
  }

  return {
    Search: Icon,
    FileText: Icon,
    Briefcase: Icon,
    Scale: Icon,
    CalendarDays: Icon,
    Crosshair: Icon,
    X: Icon,
    TrendingUp: Icon,
    History: Icon,
    Sparkles: Icon,
  };
});

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
  useSearchParams: () => [new URLSearchParams('q=test')],
  useNavigate: () => navigate,
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
  useOutletContext: () => null,
}));

const { default: SearchPage } = await import('../../src/pages/SearchPage.jsx');

async function flushSearch() {
  await vi.advanceTimersByTimeAsync(300);
  await Promise.resolve();
  await Promise.resolve();
}

describe('SearchPage', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof window.localStorage?.removeItem === 'function') {
      window.localStorage.removeItem('zn_recent_searches');
    }
    trending.mockResolvedValue({ items: [] });
    suggest.mockResolvedValue({ suggestions: [] });
    searchQuery.mockReset();
    navigate.mockReset();
    loadJobs.mockClear();
    loadCourt.mockClear();
    loadEvents.mockClear();
    publicData.articles = [];
    publicData.jobs = [];
    publicData.court = [];
    publicData.events = [];
    publicData.wanted = [];
  });

  afterEach(async () => {
    trending.mockReset();
    suggest.mockReset();
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
    vi.useRealTimers();
  });

  it('renders remote search results for the current query', async () => {
    searchQuery.mockResolvedValueOnce({
      articles: [
        {
          id: 17,
          title: 'Remote search result',
          excerpt: 'Matched remotely',
          category: 'crime',
          date: '2026-04-02',
        },
      ],
      jobs: [],
      court: [],
      events: [],
      wanted: [],
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(SearchPage));
    });
    await act(async () => {
      await flushSearch();
    });

    expect(searchQuery).toHaveBeenCalledWith(expect.objectContaining({
      q: 'test',
      type: 'all',
    }));
    expect(container.textContent).toContain('Remote search result');
    expect(container.textContent).toContain('test');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('falls back to local article matches when the search service fails', async () => {
    publicData.articles = [
      {
        id: 21,
        title: 'test fallback article',
        excerpt: 'Local fallback copy',
        category: 'crime',
        tags: [],
        content: '<p>local</p>',
      },
    ];
    searchQuery.mockRejectedValueOnce(new Error('search failed'));

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(SearchPage));
    });
    await act(async () => {
      await flushSearch();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(searchQuery).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('test fallback article');
    expect(container.textContent).toContain('search failed');
    expect(loadJobs).toHaveBeenCalledTimes(1);
    expect(loadCourt).toHaveBeenCalledTimes(1);
    expect(loadEvents).toHaveBeenCalledTimes(1);
  });
});
