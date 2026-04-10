import { describe, expect, it } from 'vitest';
import { GAME_GROUPS, getGameGroup, getGameShortLabel } from '../../src/utils/gamesCatalog.js';

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

  it('returns compact labels for progress pills', () => {
    expect(getGameShortLabel({ slug: 'word', title: 'Намери точната дума' })).toBe('Дума');
    expect(getGameShortLabel({ slug: 'spellingbee', title: 'Spelling Bee' })).toBe('Пчела');
    expect(getGameShortLabel({ slug: 'custom', title: 'Свободна игра' })).toBe('Свободна игра');
  });
});
