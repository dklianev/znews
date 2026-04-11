import { describe, expect, it } from 'vitest';

import { createGamePuzzleHelpers } from '../../server/services/gamePuzzleHelpersService.js';
import { STRANDS_COLS, STRANDS_ROWS, STRANDS_TOTAL_CELLS, analyzeCoverage as analyzeStrandsCoverage, buildWordFromPath as buildStrandsWordFromPath, doesPathSpanBoard, isPathValid as isStrandsPathValid, matchPathToAnswer, normalizeGrid as normalizeStrandsGrid } from '../../shared/strands.js';

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
    analyzeStrandsCoverage,
    badRequest,
    buildStrandsWordFromPath,
    doesPathSpanBoard,
    getCrosswordEntries: () => ({
      across: [{ number: 1, row: 0, col: 0, length: 2 }],
      down: [{ number: 1, row: 0, col: 0, length: 2 }],
    }),
    getPuzzleActiveUntilDate: (puzzle) => puzzle?.activeUntilDate || puzzle?.puzzleDate || '',
    hasCompleteSpellingBeeHive: () => true,
    hasOwn: (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key),
    isPlainObject: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    isStrandsPathValid,
    matchPathToAnswer,
    normalizeSpellingBeeLetter: (value) => normalizeText(value, 1).toUpperCase(),
    normalizeSpellingBeeOuterLetters: (value) => sanitizeStringArray(value, 1, { uppercase: true }),
    normalizeStrandsGrid,
    normalizeText,
    sanitizeDateTime: (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    },
    sanitizeStringArray,
    STRANDS_COLS,
    STRANDS_ROWS,
    STRANDS_TOTAL_CELLS,
    toSafeInteger: (value, fallback = 0) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
  });
}

describe('gamePuzzleHelpers', () => {
  it('normalizes crossword submission grids against the published mask', () => {
    const helpers = createHelpers();

    expect(helpers.normalizeCrosswordSubmissionGrid([
      ['a', 'b'],
      ['#', ''],
    ], ['..', '#.'])).toEqual(['AB', '#.']);
  });

  it('sanitizes a published word puzzle payload and derives publishAt', () => {
    const helpers = createHelpers();

    const publishedWord = helpers.sanitizeGamePuzzleInput(
      { slug: 'word', type: 'word' },
      {
        puzzleDate: '2026-03-11',
        activeUntilDate: '2026-03-11',
        status: 'published',
        difficulty: 'easy',
        payload: { wordLength: 5, maxAttempts: 6, keyboardLayout: 'bg' },
        solution: { answer: 'APPLE', allowedWords: ['APPLE'] },
      },
    );

    expect(publishedWord.gameSlug).toBe('word');
    expect(publishedWord.status).toBe('published');
    expect(publishedWord.publishAt).toBeInstanceOf(Date);
  });

  it('rejects placeholder solutions when trying to publish', () => {
    const helpers = createHelpers();

    expect(() => {
      helpers.sanitizeGamePuzzleInput(
        { slug: 'word', type: 'word' },
        {
          puzzleDate: '2026-03-11',
          activeUntilDate: '2026-03-11',
          status: 'published',
          difficulty: 'easy',
          payload: { wordLength: 5, maxAttempts: 6 },
          solution: { answer: '\u0414\u0423\u041c\u04101', allowedWords: ['\u0414\u0423\u041c\u04101'] },
        },
      );
    }).toThrow(/Replace the placeholder game content before publishing\./);
  });

  it('sanitizes a valid strands puzzle with fixed 8x6 grid coverage', () => {
    const helpers = createHelpers();

    const result = helpers.sanitizeGamePuzzleInput(
      { slug: 'strands', type: 'strands' },
      {
        puzzleDate: '2026-04-11',
        activeUntilDate: '2026-04-11',
        status: 'draft',
        difficulty: 'medium',
        payload: {
          title: 'Градска тема',
          deck: 'Намери нишката.',
          rows: 8,
          cols: 6,
          grid: ['АБВГДЕ', 'ЖЗИЙКЛ', 'МНОПРС', 'ТУФХЦЧ', 'ШЩЪЬЮЯ', 'АБВГДЕ', 'ЖЗИЙКЛ', 'МНОПРС'],
        },
        solution: {
          answers: Array.from({ length: 8 }, (_, rowIndex) => ({
            kind: rowIndex === 7 ? 'spangram' : 'theme',
            word: ['АБВГДЕ', 'ЖЗИЙКЛ', 'МНОПРС', 'ТУФХЦЧ', 'ШЩЪЬЮЯ', 'АБВГДЕ', 'ЖЗИЙКЛ', 'МНОПРС'][rowIndex],
            cells: Array.from({ length: 6 }, (_, colIndex) => (rowIndex * 6) + colIndex),
          })),
        },
      },
    );

    expect(result.payload.rows).toBe(8);
    expect(result.payload.cols).toBe(6);
    expect(result.solution.answers).toHaveLength(8);
  });
});
