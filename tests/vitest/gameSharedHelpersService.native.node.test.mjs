import { describe, expect, it } from 'vitest';

import { createGameSharedHelpers } from '../../server/services/gameSharedHelpersService.js';

function createHelpers() {
  return createGameSharedHelpers({
    GameDefinition: { findOne: async () => null },
    GamePuzzle: { findOne: async () => null },
    JWT_SECRET: 'test-secret',
    SUPPORTED_GAME_SLUGS: new Set(['word', 'connections', 'quiz', 'sudoku', 'hangman', 'spellingbee', 'crossword', 'tetris', 'snake', '2048', 'flappybird', 'blockbust']),
    SUPPORTED_GAME_TYPES: new Set(['word', 'connections', 'quiz', 'sudoku', 'hangman', 'spellingbee', 'crossword', 'tetris', 'snake', '2048', 'flappybird', 'blockbust']),
    User: { findOne: async () => null },
    hasOwn: (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key),
    hasPermissionForSection: async () => false,
    jwt: { verify: () => ({ userId: 1 }) },
    normalizeText: (value, maxLen = 2048) => String(value ?? '').trim().slice(0, maxLen),
    publicError: () => 'Request failed',
  });
}

describe('game shared helpers service', () => {
  it('sanitizes a new blockbust game definition payload', () => {
    const helpers = createHelpers();

    const blockBustPayload = helpers.sanitizeGameDefinitionInput({
      slug: 'blockbust',
      type: 'blockbust',
      title: 'ZBlast',
      description: 'Бърза игра върху малка 8x8 дъска.',
      icon: 'Blocks',
      active: true,
      sortOrder: 12,
      theme: 'orange',
    });

    expect(blockBustPayload.slug).toBe('blockbust');
    expect(blockBustPayload.type).toBe('blockbust');
    expect(blockBustPayload.title).toBe('ZBlast');
  });

  it('preserves immutable fields when updating an existing game definition', () => {
    const helpers = createHelpers();

    const updatedTetris = helpers.sanitizeGameDefinitionInput(
      {
        title: 'Тетрис класик',
        description: 'Обновено описание',
        active: false,
      },
      {
        slug: 'tetris',
        type: 'tetris',
        title: 'Тетрис',
        description: 'Стара версия',
        icon: 'Blocks',
        active: true,
        sortOrder: 8,
        theme: 'purple',
      },
    );

    expect(updatedTetris.slug).toBe('tetris');
    expect(updatedTetris.type).toBe('tetris');
    expect(updatedTetris.title).toBe('Тетрис класик');
    expect(updatedTetris.description).toBe('Обновено описание');
    expect(updatedTetris.active).toBe(false);
  });
});
