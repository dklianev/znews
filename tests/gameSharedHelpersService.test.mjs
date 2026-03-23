import assert from 'node:assert/strict';
import { createGameSharedHelpers } from '../server/services/gameSharedHelpersService.js';

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

export async function runGameSharedHelpersServiceTests() {
  const helpers = createHelpers();

  const blockBustPayload = helpers.sanitizeGameDefinitionInput({
    slug: 'blockbust',
    type: 'blockbust',
    title: 'ZBlast',
    description: 'Поставяй три фигури върху 8x8 полето.',
    icon: 'Blocks',
    active: true,
    sortOrder: 12,
    theme: 'orange',
  });

  assert.equal(blockBustPayload.slug, 'blockbust');
  assert.equal(blockBustPayload.type, 'blockbust');
  assert.equal(blockBustPayload.title, 'ZBlast');

  const updatedTetris = helpers.sanitizeGameDefinitionInput(
    {
      title: 'Тетрис Класик',
      description: 'Обновено описание',
      active: false,
    },
    {
      slug: 'tetris',
      type: 'tetris',
      title: 'Тетрис',
      description: 'Старо описание',
      icon: 'Blocks',
      active: true,
      sortOrder: 8,
      theme: 'purple',
    }
  );

  assert.equal(updatedTetris.slug, 'tetris');
  assert.equal(updatedTetris.type, 'tetris');
  assert.equal(updatedTetris.title, 'Тетрис Класик');
  assert.equal(updatedTetris.description, 'Обновено описание');
  assert.equal(updatedTetris.active, false);
}
