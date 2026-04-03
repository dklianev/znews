import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, installStorageStub, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const copyToClipboard = vi.fn(async () => true);
const loadScopedGameProgress = vi.fn();
const saveScopedGameProgress = vi.fn();
const saveGameProgress = vi.fn();

vi.mock('../../src/hooks/useBlockBustAudio', () => ({
  default: () => () => {},
}));

vi.mock('../../src/hooks/useBlockBustInput', () => ({
  default: () => ({}),
}));

vi.mock('../../src/hooks/useDocumentTitle', () => ({
  makeTitle: (value) => value,
  useDocumentTitle: () => {},
}));

vi.mock('../../src/utils/copyToClipboard', () => ({
  copyToClipboard: (...args) => copyToClipboard(...args),
}));

vi.mock('../../src/utils/gameDate', () => ({
  getTodayStr: () => '2026-04-03',
}));

vi.mock('../../src/utils/gameStorage', () => ({
  loadScopedGameProgress: (...args) => loadScopedGameProgress(...args),
  saveScopedGameProgress: (...args) => saveScopedGameProgress(...args),
  saveGameProgress: (...args) => saveGameProgress(...args),
}));

vi.mock('../../src/utils/blockBust', () => ({
  BLOCK_BUST_DEFAULT_SETTINGS: { animationLevel: 'full', soundEnabled: false, confirmRestart: false },
  BLOCK_BUST_META_SCOPE: 'meta',
  BLOCK_BUST_RUN_SCOPE: 'run',
  BLOCK_BUST_SETTINGS_KEY: 'blockbust_settings',
  BLOCK_BUST_THEMES: [{ id: 'classic', accent: '#d00', name: 'Classic' }, { id: 'neon', accent: '#0d0', name: 'Neon' }],
  canPlaceBlockBustPiece: () => true,
  createBlockBustInitialCursor: () => ({ row: 0, col: 0 }),
  createBlockBustTray: () => [{ id: 'piece-1', cells: [[0, 0]] }, null, null],
  createEmptyBlockBustBoard: () => Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null)),
  getBlockBustBoardOccupancy: () => 0,
  getBlockBustLevel: () => 3,
  getBlockBustNextThemeId: () => 'neon',
  getBlockBustPendingClears: () => ({ rows: [], cols: [] }),
  getBlockBustTheme: (id) => ({ id, accent: '#d00', name: id }),
  getBlockBustValidPlacements: () => [{ row: 0, col: 0 }],
  hydrateBlockBustRun: (value) => value,
  isBlockBustGameOver: () => false,
  placeBlockBustPiece: (board) => board,
  resolveBlockBustMove: () => null,
  serializeBlockBustRun: (run) => run,
}));

vi.mock('../../src/components/games/blockbust/BlockBustBoard', () => ({
  default: () => createElement('div', { 'data-testid': 'blockbust-board' }, 'board'),
}));

vi.mock('../../src/components/games/blockbust/BlockBustGameOverSheet', () => ({
  default: () => createElement('div', { 'data-testid': 'blockbust-game-over' }, 'game-over'),
}));

vi.mock('../../src/components/games/blockbust/BlockBustHudPanel', () => ({
  default: ({ score }) => createElement('div', { 'data-testid': 'blockbust-hud' }, `score:${score}`),
}));

vi.mock('../../src/components/games/blockbust/BlockBustTray', () => ({
  PieceMiniBoard: () => createElement('div', { 'data-testid': 'piece-mini' }, 'mini'),
  default: () => createElement('div', { 'data-testid': 'blockbust-tray' }, 'tray'),
}));

vi.mock('../../src/components/games/blockbust/BlockBustSettings', () => ({
  default: () => createElement('div', { 'data-testid': 'blockbust-settings' }, 'settings'),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
}));

const { default: GameBlockBustPage } = await import('../../src/pages/GameBlockBustPage.jsx');

describe('BlockBustPage', () => {
  let root;
  let container;

  afterEach(async () => {
    copyToClipboard.mockReset();
    loadScopedGameProgress.mockReset();
    saveScopedGameProgress.mockReset();
    saveGameProgress.mockReset();
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('renders the board shell and shares the current run summary', async () => {
    installStorageStub(window);
    loadScopedGameProgress.mockImplementation((slug, scope) => {
      if (scope === 'meta') return { bestScore: 900, streak: 3, lastPlayDate: '2026-04-03', dailyBest: 900, dailyBestDate: '2026-04-03' };
      return null;
    });

    ({ root, container } = await renderIntoBody(GameBlockBustPage));

    expect(container.querySelector('[data-testid="blockbust-board"]')).not.toBeNull();
    const shareButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Сподели'));
    await click(shareButton);

    expect(copyToClipboard).toHaveBeenCalled();
    expect(String(copyToClipboard.mock.calls[0][0])).toContain('ZBlast');
  });
});
