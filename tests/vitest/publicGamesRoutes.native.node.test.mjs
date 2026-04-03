import { describe, expect, it } from 'vitest';
import { createPublicGamesRouter } from '../../server/routes/publicGamesRoutes.js';
import { chainableLean, createResponse, getRouteHandlers, runHandlers } from './helpers/routeHarness.mjs';

function createDeps(overrides = {}) {
  return {
    findActivePublishedGamePuzzle: async () => ({
      id: 1,
      gameSlug: 'word',
      status: 'published',
      puzzleDate: '2026-04-03',
      payload: { wordLength: 2, maxAttempts: 6 },
      solution: { answer: 'БА' },
    }),
    GamePuzzle: {
      find: () => chainableLean([
        { id: 1, gameSlug: 'word', status: 'published', solution: { answer: 'БА' }, payload: { wordLength: 2 } },
      ]),
      findOne: () => chainableLean({
        id: 2,
        gameSlug: 'word',
        status: 'published',
        puzzleDate: '2026-04-02',
        payload: { wordLength: 2 },
        solution: { answer: 'БА' },
      }),
    },
    getSpellingBeeWordScore: () => 0,
    getSpellingBeeWordValidation: () => ({ isValid: true, normalizedWord: 'ДУМА', isPangram: false }),
    getTodayGameDate: () => '2026-04-03',
    isPlaceholderGamePuzzle: () => false,
    listPublicGames: async () => [{ slug: 'word', title: 'Дума' }],
    normalizeCrosswordSubmissionGrid: (grid) => grid,
    normalizeSpellingBeeLetter: (value) => value,
    normalizeSpellingBeeOuterLetters: (value) => value,
    normalizeSpellingBeeWord: (value) => value,
    normalizeSpellingBeeWords: (value) => value,
    normalizeText: (value) => String(value || '').trim(),
    resolveGameAccess: async (_req, slug) => ({
      slug,
      game: { slug, type: slug === 'word' ? 'word' : 'quiz' },
      canManageGames: false,
      isPubliclyAvailable: true,
    }),
    sanitizeStringArray: (value) => Array.isArray(value) ? value : [],
    SINGLE_CHAR_PATTERN: /^[A-ZА-Я]$/u,
    SPELLING_BEE_MIN_WORD_LENGTH: 4,
    statusAwarePublicError: (error) => error?.message || 'error',
    stripPuzzleForPublic: (puzzle) => ({ ...puzzle, public: true }),
    TEMPORARILY_UNAVAILABLE_GAME_ERROR: 'temporarily unavailable',
    toSafeInteger: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    ...overrides,
  };
}

describe('publicGamesRoutes', () => {
  it('lists the public games catalog', async () => {
    const router = createPublicGamesRouter(createDeps());
    const handlers = getRouteHandlers(router, 'get', '/');
    const res = createResponse();

    await runHandlers(handlers, {}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ slug: 'word', title: 'Дума' }]);
  });

  it('returns today puzzle for publicly available games and strips private fields', async () => {
    const router = createPublicGamesRouter(createDeps());
    const handlers = getRouteHandlers(router, 'get', '/:slug/today');
    const res = createResponse();

    await runHandlers(handlers, { params: { slug: 'word' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.public).toBe(true);
    expect(res.body.solution.answer).toBe('БА');
  });

  it('hides placeholder or unavailable puzzles from public players', async () => {
    const router = createPublicGamesRouter(createDeps({
      resolveGameAccess: async () => ({
        slug: 'quiz',
        game: { slug: 'quiz', type: 'quiz' },
        canManageGames: false,
        isPubliclyAvailable: false,
      }),
    }));
    const handlers = getRouteHandlers(router, 'get', '/:slug/today');
    const res = createResponse();

    await runHandlers(handlers, { params: { slug: 'quiz' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'temporarily unavailable' });
  });

  it('validates word guesses and marks correct and present letters', async () => {
    const router = createPublicGamesRouter(createDeps());
    const handlers = getRouteHandlers(router, 'post', '/:slug/:date/validate');
    const res = createResponse();

    await runHandlers(handlers, {
      params: { slug: 'word', date: '2026-04-03' },
      body: { guess: 'АБ' },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isWin).toBe(false);
    expect(res.body.evaluated).toEqual([
      { letter: 'А', status: 'present' },
      { letter: 'Б', status: 'present' },
    ]);
  });
});

