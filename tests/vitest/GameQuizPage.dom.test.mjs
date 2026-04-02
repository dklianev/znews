import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getToday = vi.fn(() => Promise.resolve({
  id: 42,
  payload: {
    questions: [
      {
        question: 'Кой е правилният отговор?',
        options: ['А', 'Б', 'В', 'Г'],
        correctIndex: 0,
      },
    ],
  },
}));

const loadGameProgress = vi.fn(() => ({
  version: 2,
  puzzleId: 42,
  currentQ: 0,
  answers: [0],
  gameStatus: 'won',
  lifelines: { fiftyFifty: true, audience: true, phone: true },
  eliminatedArr: [],
  audienceVotes: null,
  phoneHint: null,
}));

const saveGameProgress = vi.fn();
const recordGameWin = vi.fn();

vi.mock('../../src/utils/api', () => ({
  api: {
    games: {
      getToday,
    },
  },
}));

vi.mock('../../src/utils/copyToClipboard', () => ({
  copyToClipboard: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../src/utils/gameStorage', () => ({
  loadGameProgress,
  saveGameProgress,
  recordGameWin,
}));

vi.mock('../../src/utils/gameDate', () => ({
  getTodayStr: () => '2026-04-02',
}));

vi.mock('../../src/components/games/quiz/QuizQuestionCard', () => ({
  default: ({ question }) => createElement('div', { 'data-testid': 'quiz-card' }, question?.question),
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
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
}));

const { default: GameQuizPage } = await import('../../src/pages/GameQuizPage.jsx');

describe('GameQuizPage', () => {
  let container;
  let root;

  afterEach(async () => {
    getToday.mockClear();
    loadGameProgress.mockClear();
    saveGameProgress.mockClear();
    recordGameWin.mockClear();
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

  it('restores an end-state daily run without showing a replay action', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(GameQuizPage));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getToday).toHaveBeenCalledTimes(1);
    expect(loadGameProgress).toHaveBeenCalledWith('quiz', '2026-04-02');
    expect(container.textContent).toContain('Сподели');
    expect(container.textContent).not.toContain('Играй пак');
    expect(recordGameWin).not.toHaveBeenCalled();
  });
});
