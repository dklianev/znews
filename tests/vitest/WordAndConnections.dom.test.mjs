import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const getToday = vi.fn();
const validate = vi.fn();
const loadGameProgress = vi.fn();
const saveGameProgress = vi.fn();
const recordGameWin = vi.fn();
const recordGameLoss = vi.fn();
const copyToClipboard = vi.fn(async () => true);

vi.mock('../../src/utils/api', () => ({
  api: {
    games: {
      getToday: (...args) => getToday(...args),
      validate: (...args) => validate(...args),
    },
  },
}));

vi.mock('../../src/utils/gameStorage', () => ({
  loadGameProgress: (...args) => loadGameProgress(...args),
  saveGameProgress: (...args) => saveGameProgress(...args),
  recordGameWin: (...args) => recordGameWin(...args),
  recordGameLoss: (...args) => recordGameLoss(...args),
}));

vi.mock('../../src/utils/gameDate', () => ({
  getTodayStr: () => '2026-04-03',
}));

vi.mock('../../src/utils/copyToClipboard', () => ({
  copyToClipboard: (...args) => copyToClipboard(...args),
}));

vi.mock('../../src/components/games/word/WordGrid', () => ({
  default: ({ currentGuess, guesses }) => createElement('div', { 'data-testid': 'word-grid' }, `${currentGuess}|${guesses.length}`),
}));

vi.mock('../../src/components/games/word/WordKeyboard', () => ({
  default: ({ onChar, onEnter, onDelete, isWordReady }) => createElement('div', { 'data-testid': 'word-keyboard' }, [
    createElement('button', { key: 'char', type: 'button', onClick: () => onChar('?') }, 'char-B'),
    createElement('button', { key: 'del', type: 'button', onClick: onDelete }, 'delete'),
    createElement('button', { key: 'enter', type: 'button', onClick: onEnter, disabled: !isWordReady }, 'enter'),
  ]),
}));

vi.mock('../../src/components/games/connections/ConnectionsBoard', () => ({
  default: ({ items, onToggle }) => createElement('div', { 'data-testid': 'connections-board' }, items.map((item) => (
    createElement('button', { key: item, type: 'button', onClick: () => onToggle(item) }, item)
  ))),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
}));

const { default: GameWordPage } = await import('../../src/pages/GameWordPage.jsx');
const { default: GameConnectionsPage } = await import('../../src/pages/GameConnectionsPage.jsx');

describe('WordAndConnections', () => {
  let root;
  let container;

  afterEach(async () => {
    getToday.mockReset();
    validate.mockReset();
    loadGameProgress.mockReset();
    saveGameProgress.mockReset();
    recordGameWin.mockReset();
    recordGameLoss.mockReset();
    copyToClipboard.mockReset();
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('wins the word game and records the daily completion', async () => {
    getToday.mockResolvedValueOnce({ id: 11, payload: { wordLength: 1, maxAttempts: 6 } });
    loadGameProgress.mockReturnValueOnce(null);
    validate.mockResolvedValueOnce({ evaluated: [{ letter: '?', status: 'correct' }], isWin: true });

    ({ root, container } = await renderIntoBody(GameWordPage));

    const buttons = Array.from(container.querySelectorAll('button'));
    await click(buttons.find((button) => button.textContent === 'char-B'));
    await click(buttons.find((button) => button.textContent === 'enter'));
    await flushEffects();

    expect(validate).toHaveBeenCalledWith('word', '2026-04-03', { guess: '?' });
    expect(recordGameWin).toHaveBeenCalledWith('word', '2026-04-03');
    expect(container.textContent).toContain('Поздравления!');
  });

  it('restores the connections state and shares the finished result', async () => {
    getToday.mockResolvedValueOnce({
      id: 15,
      payload: { items: ['A', 'B', 'C', 'D'] },
    });
    loadGameProgress.mockReturnValueOnce({
      puzzleId: 15,
      items: ['A', 'B', 'C', 'D'],
      solvedGroups: [
        { title: '????? 1', items: ['1', '2', '3', '4'] },
        { title: '????? 2', items: ['5', '6', '7', '8'] },
        { title: '????? 3', items: ['9', '10', '11', '12'] },
      ],
      mistakesRemaining: 4,
      gameStatus: 'playing',
    });
    validate.mockResolvedValueOnce({ correct: true, group: { title: '?????', items: ['A', 'B', 'C', 'D'] } });

    ({ root, container } = await renderIntoBody(GameConnectionsPage));

    for (const item of ['A', 'B', 'C', 'D']) {
      const button = Array.from(container.querySelectorAll('[data-testid="connections-board"] button'))
        .find((node) => node.textContent === item);
      await click(button);
    }

    const submitButton = Array.from(container.querySelectorAll('button')).filter((button) => !button.disabled).at(-1);
    await click(submitButton);
    await flushEffects();

    expect(validate).toHaveBeenCalledWith('connections', '2026-04-03', { selection: ['A', 'B', 'C', 'D'] });
    expect(recordGameWin).toHaveBeenCalledWith('connections', '2026-04-03');
    expect(container.textContent).toContain('Гениално!');

    const shareButton = Array.from(container.querySelectorAll('button')).at(-1);
    await click(shareButton);
    await flushEffects();
    expect(copyToClipboard).toHaveBeenCalled();
  });
});
