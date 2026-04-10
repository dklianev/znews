import { describe, expect, it } from 'vitest';
import { GAME_GROUPS, getDailyGames, getGameGroup, isDailyGame } from '../../src/utils/gamesCatalog.js';

describe('gamesCatalog helpers', () => {
  it('groups puzzle and arcade games from the existing type field', () => {
    expect(getGameGroup({ type: 'word' })).toBe('puzzles');
    expect(getGameGroup({ type: 'crossword' })).toBe('puzzles');
    expect(getGameGroup({ type: 'tetris' })).toBe('arcade');
    expect(getGameGroup({ type: 'blockbust' })).toBe('arcade');
    expect(getGameGroup({ type: 'unknown' })).toBe('puzzles');
  });

  it('exposes the fixed games hub filter labels', () => {
    expect(GAME_GROUPS).toEqual([
      { key: 'all', label: 'Всички' },
      { key: 'puzzles', label: 'Пъзели' },
      { key: 'arcade', label: 'Аркадни' },
    ]);
  });

  it('flags only puzzle titles as daily games and filters out arcade entries', () => {
    expect(isDailyGame({ slug: 'word', type: 'word' })).toBe(true);
    expect(isDailyGame({ slug: 'crossword', type: 'crossword' })).toBe(true);
    expect(isDailyGame({ slug: 'sudoku', type: 'sudoku' })).toBe(false);
    expect(isDailyGame({ slug: 'tetris', type: 'tetris' })).toBe(false);

    expect(getDailyGames([
      { slug: 'sudoku', title: 'Судоку', type: 'sudoku', sortOrder: 4 },
      { slug: 'tetris', title: 'Тетрис', type: 'tetris', sortOrder: 8 },
      { slug: 'word', title: 'Намери точната дума', type: 'word', sortOrder: 1 },
      { slug: 'quiz', title: 'Ерудит', type: 'quiz', sortOrder: 3 },
    ])).toEqual([
      { slug: 'word', title: 'Намери точната дума', type: 'word', sortOrder: 1 },
      { slug: 'quiz', title: 'Ерудит', type: 'quiz', sortOrder: 3 },
    ]);
  });
});
