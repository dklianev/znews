import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, inputValue, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const addPoll = vi.fn(async () => {});
const updatePoll = vi.fn(async () => {});
const deletePoll = vi.fn(async () => {});
const getAll = vi.fn(async () => [
  { slug: 'word', title: 'Дума', active: true },
]);
const getPuzzles = vi.fn(async () => [
  {
    id: 77,
    gameSlug: 'word',
    puzzleDate: '2026-04-10',
    activeUntilDate: '2026-04-10',
    status: 'draft',
    difficulty: 'medium',
    payload: {},
    solution: {},
  },
]);
const bulkGenerate = vi.fn(async () => ({ createdCount: 0, updatedCount: 0, skippedCount: 0 }));
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
let searchParamsState = '';
const setSearchParamsSpy = vi.fn();

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
  useEngagementData: () => publicDataState,
  usePublicData: () => publicDataState,
  useSessionData: () => ({}),
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
  getTodayStr: () => '2026-04-09',
  isValidDateStr: () => true,
}));

vi.mock('../../src/utils/puzzleDateUtils', () => ({
  addPuzzleDays: () => '2026-04-10',
  getPuzzleDurationDays: () => 1,
  normalizePuzzleActiveUntilDate: (_start, end) => end || '2026-04-10',
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

vi.mock('../../../shared/crossword.js', () => ({
  analyzeCrosswordConstruction: () => ({ blockers: [], issues: [] }),
  getCrosswordEntries: () => ({ across: [], down: [] }),
  MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH: 3,
}));

vi.mock('../../../shared/spellingBee.js', () => ({
  analyzeSpellingBeeWords: () => ({ totalWords: 0, pangramCount: 0, maxScore: 0, longestWordLength: 0, normalizedWords: [], pangrams: [], scoreByWord: {} }),
  normalizeSpellingBeeLetter: (value) => value || 'А',
  normalizeSpellingBeeOuterLetters: (value) => Array.isArray(value) ? value : ['Б', 'В', 'Г', 'Д', 'Е', 'Ж'],
  SPELLING_BEE_MIN_WORD_LENGTH: 4,
}));

const { ConfirmProvider } = await import('../../src/components/admin/ConfirmDialog.jsx');
const { default: ManagePolls } = await import('../../src/pages/admin/ManagePolls.jsx');
const { default: ManageGamePuzzles } = await import('../../src/pages/admin/ManageGamePuzzles.jsx');

function renderWithConfirm(Component) {
  const Wrapped = () => createElement(ConfirmProvider, null, createElement(Component));
  return renderIntoBody(Wrapped);
}

function findButtonByText(root, text) {
  return Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.includes(text));
}

describe('AdminFoundation', () => {
  let root;
  let container;

  afterEach(async () => {
    addPoll.mockClear();
    updatePoll.mockClear();
    deletePoll.mockClear();
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
    searchParamsState = '';
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('keeps the poll editor open until the dirty-state confirm is accepted', async () => {
    publicDataState = {
      polls: [],
      addPoll,
      updatePoll,
      deletePoll,
    };

    ({ root, container } = await renderWithConfirm(ManagePolls));

    await click(findButtonByText(container, 'Нова анкета'));
    await inputValue(Array.from(container.querySelectorAll('input'))[1], 'Кой печели?');

    await click(findButtonByText(container, 'Отказ'));
    await flushEffects();

    expect(document.body.textContent).toContain('Незапазени промени');
    await click(findButtonByText(document.body, 'Остани'));
    expect(Array.from(container.querySelectorAll('input'))[1]?.value).toBe('Кой печели?');

    await click(findButtonByText(container, 'Отказ'));
    await click(findButtonByText(document.body, 'Излез без запис'));

    expect(document.body.textContent).not.toContain('Незапазени промени');
    expect(findButtonByText(container, 'Запази')).toBeUndefined();
  });

  it('publishing a puzzle goes through ConfirmDialog before the API call', async () => {
    ({ root, container } = await renderWithConfirm(ManageGamePuzzles));
    await flushEffects();

    const publishButton = container.querySelector('button[title="Публикувай"]');
    await click(publishButton);

    expect(document.body.textContent).toContain('Публикуване на пъзел');
    expect(publishPuzzle).not.toHaveBeenCalled();

    await click(findButtonByText(document.body, 'Публикувай'));

    expect(publishPuzzle).toHaveBeenCalledWith('word', 77);
    expect(toast.success).toHaveBeenCalled();
  });
});
