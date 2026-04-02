import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createGamePuzzleHelpers } from '../server/services/gamePuzzleHelpersService.js';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeText(value, maxLen = 1000) {
  return String(value ?? '').trim().slice(0, maxLen);
}

function sanitizeStringArray(values, maxLen = 120, options = {}) {
  const { uppercase = false } = options;
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeText(value, maxLen))
    .filter(Boolean)
    .map((value) => (uppercase ? value.toUpperCase() : value));
}

function createHelpers() {
  return createGamePuzzleHelpers({
    MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH: 3,
    SPELLING_BEE_MIN_WORD_LENGTH: 4,
    SUPPORTED_PUZZLE_DIFFICULTIES: new Set(['easy', 'medium', 'hard']),
    SUPPORTED_PUZZLE_STATUSES: new Set(['draft', 'published', 'archived']),
    analyzeCrosswordConstruction: () => ({ blockers: [] }),
    analyzeSpellingBeeWords: () => ({
      normalizedWords: ['TEST'],
      totalWords: 1,
      rejectedWords: [],
      pangramCount: 1,
      acceptedWords: ['TEST'],
      pangrams: ['TEST'],
      scoreByWord: { TEST: 4 },
      maxScore: 4,
      longestWordLength: 4,
    }),
    badRequest,
    getCrosswordEntries: () => ({
      across: [{ number: 1, row: 0, col: 0, length: 2 }],
      down: [{ number: 1, row: 0, col: 0, length: 2 }],
    }),
    getPuzzleActiveUntilDate: (puzzle) => puzzle?.activeUntilDate || puzzle?.puzzleDate || '',
    hasCompleteSpellingBeeHive: () => true,
    hasOwn: (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key),
    isPlainObject: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    normalizeSpellingBeeLetter: (value) => normalizeText(value, 1).toUpperCase(),
    normalizeSpellingBeeOuterLetters: (value) => sanitizeStringArray(value, 1, { uppercase: true }),
    normalizeText,
    sanitizeDateTime: (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    },
    sanitizeStringArray,
    toSafeInteger: (value, fallback = 0) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
  });
}

describe('gamePuzzleHelpersService', () => {
  it('keeps gamePuzzleHelpersService legacy coverage green', async () => {
      const helpers = createHelpers();
    
      assert.deepEqual(
        helpers.normalizeCrosswordSubmissionGrid([
          ['a', 'b'],
          ['#', ''],
        ], ['..', '#.']),
        ['AB', '#.']
      );
    
      const publishedWord = helpers.sanitizeGamePuzzleInput(
        { slug: 'word', type: 'word' },
        {
          puzzleDate: '2026-03-11',
          activeUntilDate: '2026-03-11',
          status: 'published',
          difficulty: 'easy',
          payload: { wordLength: 5, maxAttempts: 6, keyboardLayout: 'bg' },
          solution: { answer: 'теста', allowedWords: ['теста'] },
        }
      );
      assert.equal(publishedWord.gameSlug, 'word');
      assert.equal(publishedWord.status, 'published');
      assert.ok(publishedWord.publishAt instanceof Date);
    
      assert.throws(() => {
        helpers.sanitizeGamePuzzleInput(
          { slug: 'word', type: 'word' },
          {
            puzzleDate: '2026-03-11',
            activeUntilDate: '2026-03-11',
            status: 'published',
            difficulty: 'easy',
            payload: { wordLength: 5, maxAttempts: 6 },
            solution: { answer: 'ДУМА1', allowedWords: ['ДУМА1'] },
          }
        );
      }, /Replace the placeholder game content before publishing\./);
  });
});
