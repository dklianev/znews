import React, { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, installStorageStub, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const loadScopedGameProgress = vi.fn();
const saveScopedGameProgress = vi.fn();
const loadGamesCatalog = vi.fn(async () => {});
const getGameStreak = vi.fn(() => 2);
const loadGameProfile = vi.fn(() => ({ streaks: {} }));
const loadGameProgress = vi.fn(() => ({ gameStatus: 'won' }));

let publicDataState = {};

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => publicDataState,
}));

vi.mock('../../src/utils/gameStorage', () => ({
  loadScopedGameProgress: (...args) => loadScopedGameProgress(...args),
  saveScopedGameProgress: (...args) => saveScopedGameProgress(...args),
  getGameStreak: (...args) => getGameStreak(...args),
  loadGameProfile: (...args) => loadGameProfile(...args),
  loadGameProgress: (...args) => loadGameProgress(...args),
}));

vi.mock('../../src/components/games/tetris/TetrisBoard', () => ({
  CELL_STEP: 24,
  BOARD_PX_WIDTH: 240,
  BOARD_PX_HEIGHT: 480,
  default: () => createElement('div', { 'data-testid': 'tetris-board' }, 'board'),
}));

vi.mock('../../src/components/games/tetris/TetrisPreview', () => ({
  default: () => createElement('div', { 'data-testid': 'tetris-preview' }, 'preview'),
}));

vi.mock('../../src/components/games/GamesHubCard', () => ({
  default: ({ game, progress, streak }) => createElement('article', { 'data-testid': `game-card-${game.slug}` }, `${game.title}-${progress?.gameStatus}-${streak}`),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
}));

const { default: GameTetrisPage } = await import('../../src/pages/GameTetrisPage.jsx');
const { default: GamesPage } = await import('../../src/pages/GamesPage.jsx');

describe('ArcadeDashboard', () => {
  let root;
  let container;

  beforeEach(() => {
    installStorageStub(window);
  });

  afterEach(async () => {
    vi.useRealTimers();
    loadScopedGameProgress.mockReset();
    saveScopedGameProgress.mockReset();
    loadGamesCatalog.mockReset();
    getGameStreak.mockReset();
    loadGameProfile.mockReset();
    loadGameProgress.mockReset();
    publicDataState = {};
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('auto-pauses Tetris when the page loses focus during play', async () => {
    vi.useFakeTimers();
    loadScopedGameProgress.mockReturnValue(null);

    ({ root, container } = await renderIntoBody(GameTetrisPage));

    const startButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Старт'));
    await click(startButton);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2900);
      await flushEffects();
    });

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
      await flushEffects();
    });

    expect(container.textContent).toContain('Пауза');
  });

  it('loads the games hub and decorates cards with daily progress and streaks', async () => {
    publicDataState = {
      games: [{ id: 1, slug: 'word', title: '?????? ??????' }],
      publicSectionStatus: { games: 'idle' },
      loadGamesCatalog,
    };

    ({ root, container } = await renderIntoBody(GamesPage));
    await flushEffects();

    expect(loadGamesCatalog).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="game-card-word"]')?.textContent).toContain('won-2');
  });
});
