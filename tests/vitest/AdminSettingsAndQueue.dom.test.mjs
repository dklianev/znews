import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, inputValue, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const saveSiteSettings = vi.fn(async () => {});
const forceRefreshHomepageCache = vi.fn(async () => ({ ok: true }));
const loadSiteSettingsRevisions = vi.fn(async () => []);
const restoreSiteSettingsRevision = vi.fn(async () => {});
const updateArticle = vi.fn(async () => {});
const getAll = vi.fn(async () => [
  { slug: 'word', title: 'Дума', active: true },
  { slug: 'quiz', title: 'Ерудит', active: true },
]);
const getPuzzles = vi.fn(async () => []);
const bulkGenerate = vi.fn(async () => ({ created: 30 }));
const createPuzzle = vi.fn(async () => ({}));
const updatePuzzle = vi.fn(async () => ({}));
const publishPuzzle = vi.fn(async () => ({}));
const deletePuzzle = vi.fn(async () => ({}));

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

let adminDataState = {};
let publicDataState = {};
let sessionDataState = {};
let searchParamsState = '';
const setSearchParamsSpy = vi.fn();

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
  usePublicData: () => publicDataState,
  useSessionData: () => sessionDataState,
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
}));

vi.mock('../../src/components/admin/GamePuzzleEditor', () => ({
  default: ({ editForm }) => createElement('div', { 'data-testid': 'game-puzzle-editor' }, editForm?.gameSlug || 'editor'),
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    adminGames: {
      getAll: (...args) => getAll(...args),
      getPuzzles: (...args) => getPuzzles(...args),
      bulkGenerate: (...args) => bulkGenerate(...args),
      createPuzzle: (...args) => createPuzzle(...args),
      updatePuzzle: (...args) => updatePuzzle(...args),
      publishPuzzle: (...args) => publishPuzzle(...args),
      deletePuzzle: (...args) => deletePuzzle(...args),
    },
  },
}));

vi.mock('../../src/utils/gameDate', () => ({
  getTodayStr: () => '2026-04-03',
  isValidDateStr: () => true,
}));

vi.mock('../../src/utils/puzzleDateUtils', () => ({
  addPuzzleDays: () => '2026-04-04',
  getPuzzleDurationDays: () => 1,
  normalizePuzzleActiveUntilDate: (_start, end) => end || '2026-04-04',
}));

vi.mock('../../../shared/gamePuzzleTemplates.js', () => ({
  createGamePuzzleTemplate: (slug, date) => ({
    id: null,
    gameSlug: slug,
    puzzleDate: date,
    status: 'draft',
    payload: {},
    solution: {},
  }),
  GAME_EDITOR_GUIDES: {},
}));

vi.mock('../../../shared/gamePlaceholderWarnings.js', () => ({
  hasGamePlaceholderContent: () => false,
}));

vi.mock('../../../shared/crossword.js', () => ({
  analyzeCrosswordConstruction: () => ({ issues: [] }),
  getCrosswordEntries: () => ({ across: [], down: [] }),
  MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH: 3,
}));

vi.mock('../../../shared/spellingBee.js', () => ({
  analyzeSpellingBeeWords: () => ({ totalWords: 0, pangramCount: 0, maxScore: 0, longestWordLength: 0, normalizedWords: [], pangrams: [], scoreByWord: {} }),
  normalizeSpellingBeeLetter: (value) => value || 'А',
  normalizeSpellingBeeOuterLetters: (value) => Array.isArray(value) ? value : ['Б', 'В', 'Г', 'Д', 'Е', 'Ж'],
  SPELLING_BEE_MIN_WORD_LENGTH: 4,
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => {
    const [params, setParams] = React.useState(() => new URLSearchParams(searchParamsState));

    const updateParams = (nextInit, options) => {
      setParams((currentParams) => {
        const resolvedParams = typeof nextInit === 'function'
          ? nextInit(currentParams)
          : nextInit;
        const nextParams = new URLSearchParams(resolvedParams);
        searchParamsState = nextParams.toString();
        setSearchParamsSpy(searchParamsState, options ?? null);
        return nextParams;
      });
    };

    return [params, updateParams];
  },
}));

const { default: ManageSiteSettings } = await import('../../src/pages/admin/ManageSiteSettings.jsx');
const { default: EditorialQueue } = await import('../../src/pages/admin/EditorialQueue.jsx');
const { default: ManageGamePuzzles } = await import('../../src/pages/admin/ManageGamePuzzles.jsx');

describe('AdminSettingsAndQueue', () => {
  let root;
  let container;

  afterEach(async () => {
    saveSiteSettings.mockClear();
    forceRefreshHomepageCache.mockClear();
    loadSiteSettingsRevisions.mockClear();
    restoreSiteSettingsRevision.mockClear();
    updateArticle.mockClear();
    getAll.mockClear();
    getPuzzles.mockClear();
    bulkGenerate.mockClear();
    createPuzzle.mockClear();
    updatePuzzle.mockClear();
    publishPuzzle.mockClear();
    deletePuzzle.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
    toast.warning.mockClear();
    setSearchParamsSpy.mockClear();
    adminDataState = {};
    publicDataState = {};
    sessionDataState = {};
    searchParamsState = '';
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('saves site settings and exposes the homepage cache refresh action', async () => {
    publicDataState = {
      siteSettings: {
        breakingBadgeLabel: 'Шок',
        contact: { address: 'Адрес', phone: '0888 000 000', email: 'news@znews.live' },
        about: {
          heroText: 'Hero text',
          missionTitle: 'Mission',
          missionParagraph1: 'P1',
          missionParagraph2: 'P2',
          adIntro: 'Ad intro',
          adPlans: [{ name: 'Plan', price: '100', desc: 'Desc' }],
        },
        tipLinePromo: {
          enabled: true,
          title: 'Tip title',
          description: 'Tip desc',
          buttonLabel: 'Tip CTA',
          buttonLink: '/tipline',
        },
      },
      saveSiteSettings,
      forceRefreshHomepageCache,
    };
    adminDataState = {
      siteSettingsRevisions: [],
      loadSiteSettingsRevisions,
      restoreSiteSettingsRevision,
      hasPermission: () => true,
    };
    sessionDataState = { session: { token: 'token' } };

    ({ root, container } = await renderIntoBody(ManageSiteSettings));

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Запази'));
    await click(saveButton);

    expect(saveSiteSettings).toHaveBeenCalledTimes(1);
    expect(loadSiteSettingsRevisions).toHaveBeenCalledTimes(1);
  });

  it('publishes queued drafts without leaving the current admin view', async () => {
    publicDataState = {
      articles: [
        { id: 9, title: 'Чернова статия', status: 'draft', category: 'crime', authorId: 3, date: '2026-04-03' },
      ],
      categories: [{ id: 'crime', name: 'Криминални' }],
      authors: [{ id: 3, name: 'Репортер' }],
      updateArticle,
    };

    ({ root, container } = await renderIntoBody(EditorialQueue));

    const publishButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Публикувай'));
    await click(publishButton);

    expect(updateArticle).toHaveBeenCalledWith(9, expect.objectContaining({ status: 'published', publishAt: null }));
    expect(toast.success).toHaveBeenCalled();
    expect(container.querySelector('input[aria-label="Търси по заглавие или резюме"]')).not.toBeNull();
  });

  it('shows the shared empty state in editorial queue when filters miss', async () => {
    publicDataState = {
      articles: [
        { id: 9, title: 'Чернова статия', excerpt: 'Късо резюме', status: 'draft', category: 'crime', authorId: 3, date: '2026-04-03' },
      ],
      categories: [{ id: 'crime', name: 'Криминални' }],
      authors: [{ id: 3, name: 'Репортер' }],
      updateArticle,
    };

    ({ root, container } = await renderIntoBody(EditorialQueue));

    const searchInput = container.querySelector('input[aria-label="Търси по заглавие или резюме"]');
    await inputValue(searchInput, 'несъществуващ');

    expect(container.textContent).toContain('Няма публикации');
  });

  it('hydrates editorial queue filters from the URL and syncs search updates', async () => {
    searchParamsState = 'tab=today&category=crime&q=%D1%87%D0%B5%D1%80';
    publicDataState = {
      articles: [
        { id: 9, title: 'Чернова статия', excerpt: 'Късо резюме', status: 'draft', category: 'crime', authorId: 3, date: '2026-04-09' },
        { id: 10, title: 'Черна хроника', excerpt: 'Публикувана днес', status: 'published', category: 'crime', authorId: 3, date: '2026-04-09' },
        { id: 11, title: 'Бизнес обзор', excerpt: 'Друго', status: 'published', category: 'business', authorId: 3, date: '2026-04-09' },
      ],
      categories: [
        { id: 'crime', name: 'Криминални' },
        { id: 'business', name: 'Бизнес' },
      ],
      authors: [{ id: 3, name: 'Репортер' }],
      updateArticle,
    };

    ({ root, container } = await renderIntoBody(EditorialQueue));

    const searchInput = container.querySelector('input[aria-label="Търси по заглавие или резюме"]');
    expect(searchInput?.value).toBe('чер');
    expect(container.textContent).toContain('Публикувани днес');
    expect(container.textContent).toContain('Черна хроника');
    expect(container.textContent).not.toContain('Бизнес обзор');

    await inputValue(searchInput, 'публ');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('tab=today&category=crime&q=%D0%BF%D1%83%D0%B1%D0%BB', { replace: true });
  });

  it('loads game puzzle data and opens the editor for a new draft', async () => {
    ({ root, container } = await renderIntoBody(ManageGamePuzzles));

    expect(getAll).toHaveBeenCalledTimes(1);
    expect(getPuzzles).toHaveBeenCalled();

    const newPuzzleButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Нов пъзел'));
    await click(newPuzzleButton);

    expect(container.querySelector('[data-testid="game-puzzle-editor"]')?.textContent).toContain('word');
  });

  it('exposes accessible puzzle row actions', async () => {
    getAll.mockResolvedValue([
      { slug: 'word', title: 'Дума', active: true },
    ]);
    getPuzzles.mockResolvedValue([
      {
        id: 12,
        gameSlug: 'word',
        puzzleDate: '2026-04-03',
        status: 'draft',
        payload: {},
        solution: {},
        difficulty: 'easy',
      },
    ]);

    ({ root, container } = await renderIntoBody(ManageGamePuzzles));
    await flushEffects();

    expect(container.querySelector('button[aria-label="Публикувай пъзела"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Редактирай пъзела"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Изтрий пъзела"]')).not.toBeNull();
  });
});
