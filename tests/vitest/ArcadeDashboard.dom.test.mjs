import React, { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, installStorageStub, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const loadScopedGameProgress = vi.fn();
const saveScopedGameProgress = vi.fn();
const loadGamesCatalog = vi.fn(async () => {});
const getGameStreak = vi.fn(() => ({ currentStreak: 0 }));
const loadGameProfile = vi.fn(() => ({ streaksByGame: {} }));
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

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
  useOutletContext: () => null,
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
    loadGameProgress.mockImplementation((slug) => (slug === 'word' ? { gameStatus: 'won' } : null));
    getGameStreak.mockImplementation((_profile, slug) => (slug === 'word'
      ? { currentStreak: 2 }
      : { currentStreak: 0 }));
    publicDataState = {
      games: [
        { id: 1, slug: 'word', title: 'Намери точната дума', icon: 'Type', theme: 'green', type: 'word', sortOrder: 1, description: 'Описание' },
        { id: 2, slug: 'tetris', title: 'Тетрис', icon: 'Blocks', theme: 'purple', type: 'tetris', sortOrder: 2, description: 'Описание' },
        { id: 3, slug: 'quiz', title: 'Ерудит', icon: 'Trophy', theme: 'indigo', type: 'quiz', sortOrder: 3, description: 'Описание' },
      ],
      publicSectionStatus: { games: 'idle' },
      loadGamesCatalog,
    };

    ({ root, container } = await renderIntoBody(GamesPage));
    await flushEffects();

    expect(loadGamesCatalog).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('1/2');
    const toolbarSection = container.querySelector('section');
    const progressLink = toolbarSection?.querySelector('a[href="/games/word"]');
    expect(progressLink).toBeTruthy();
    expect(progressLink.title).toContain('Намери точната дума');
    expect(progressLink.title).toContain('Победа');
    expect(toolbarSection?.querySelector('a[href="/games/tetris"]')).toBeNull();
    expect(container.textContent).toContain('Следващо предизвикателство');
    expect(container.textContent).toContain('Ерудит');
    expect(container.textContent).toContain('Пъзели');
    expect(container.textContent).toContain('Аркадни');

    const arcadeFilter = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Аркадни (1)'));
    await click(arcadeFilter);

    expect(container.textContent).not.toContain('Следващо предизвикателство');
    expect(container.textContent).toContain('Тетрис');
  });

  it('shows completed spotlight when all daily games are played', async () => {
    loadGameProgress.mockImplementation((slug) => {
      if (slug === 'word' || slug === 'quiz') return { gameStatus: 'won' };
      return null;
    });
    getGameStreak.mockReturnValue({ currentStreak: 0 });
    publicDataState = {
      games: [
        { id: 1, slug: 'word', title: 'Намери точната дума', icon: 'Type', theme: 'green', type: 'word', sortOrder: 1, description: 'Описание' },
        { id: 2, slug: 'tetris', title: 'Тетрис', icon: 'Blocks', theme: 'purple', type: 'tetris', sortOrder: 2, description: 'Описание' },
        { id: 3, slug: 'quiz', title: 'Ерудит', icon: 'Trophy', theme: 'indigo', type: 'quiz', sortOrder: 3, description: 'Описание' },
      ],
      publicSectionStatus: { games: 'idle' },
      loadGamesCatalog,
    };

    ({ root, container } = await renderIntoBody(GamesPage));
    await flushEffects();

    expect(container.textContent).not.toContain('Следващо предизвикателство');
    expect(container.textContent).toContain('Днешните игри са приключени');
    expect(container.textContent).toContain('2/2 отметнати');
    expect(container.textContent).toContain('Към аркадните');
    expect(container.textContent).toContain('Бърз аркаден рунд');

    const arcadeCta = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Към аркадните'));
    expect(arcadeCta).toBeTruthy();
    await click(arcadeCta);

    expect(container.textContent).not.toContain('Днешните игри са приключени');
    expect(container.textContent).toContain('Тетрис');
  });
});
