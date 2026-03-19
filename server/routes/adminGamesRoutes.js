import express from 'express';
import { asyncHandler } from '../services/expressAsyncService.js';

export function createAdminGamesRouter(deps) {
  const {
    GameDefinition,
    GamePuzzle,
    invalidateCacheGroup,
    isPlaceholderGamePuzzle,
    MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
    nextNumericId,
    normalizeText,
    sanitizeGameDefinitionInput,
    sanitizeGamePuzzleInput,
    seedGamesOnly,
    statusAwarePublicError,
    validateCrosswordPuzzle,
  } = deps;

  const adminGamesRouter = express.Router();

  function clearGameDefinitionCache() {
    invalidateCacheGroup('games', 'games-mutation');
  }

  adminGamesRouter.get('/', asyncHandler(async (_req, res) => {
    const games = await GameDefinition.find().sort('sortOrder').lean();
    return res.json(games);
  }));

  adminGamesRouter.post('/bulk-generate', asyncHandler(async (req, res) => {
    try {
      const result = await seedGamesOnly({
        startDate: normalizeText(req.body?.startDate, 10),
        days: Number.parseInt(req.body?.days, 10) || 30,
        gameSlugs: req.body?.gameSlugs,
        overwriteDrafts: Boolean(req.body?.overwriteDrafts),
      });
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 500).json({ error: statusAwarePublicError(error) });
    }
  }));

  adminGamesRouter.post('/', asyncHandler(async (req, res) => {
    try {
      const payload = sanitizeGameDefinitionInput(req.body);
      const newId = await nextNumericId(GameDefinition);

      const game = await GameDefinition.create({ ...payload, id: newId });
      clearGameDefinitionCache();
      return res.json(game.toJSON());
    } catch (error) {
      return res.status(error.status || 500).json({ error: statusAwarePublicError(error) });
    }
  }));

  adminGamesRouter.put('/:id', asyncHandler(async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const existingGame = await GameDefinition.findOne({ id }).lean();
      if (!existingGame) return res.status(404).json({ error: 'Not found' });
      const update = sanitizeGameDefinitionInput(req.body, existingGame);

      const game = await GameDefinition.findOneAndUpdate({ id }, { $set: update }, { returnDocument: 'after' });
      clearGameDefinitionCache();
      return res.json(game.toJSON());
    } catch (error) {
      return res.status(error.status || 500).json({ error: statusAwarePublicError(error) });
    }
  }));

  adminGamesRouter.delete('/:id', asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const game = await GameDefinition.findOne({ id }).lean();
    if (!game) return res.status(404).json({ error: 'Not found' });

    const result = await GameDefinition.deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
    await GamePuzzle.deleteMany({ gameSlug: game.slug });
    clearGameDefinitionCache();
    return res.json({ ok: true });
  }));

  adminGamesRouter.get('/:slug/puzzles', asyncHandler(async (req, res) => {
    const slug = normalizeText(req.params.slug, 64).toLowerCase();
    const game = await GameDefinition.findOne({ slug }).lean();
    if (!game) return res.status(404).json({ error: 'Game not found' });
    const puzzles = await GamePuzzle.find({ gameSlug: slug }).sort({ puzzleDate: -1, activeUntilDate: -1 }).lean();
    return res.json(puzzles);
  }));

  adminGamesRouter.post('/:slug/puzzles', asyncHandler(async (req, res) => {
    try {
      const slug = normalizeText(req.params.slug, 64).toLowerCase();
      const game = await GameDefinition.findOne({ slug }).lean();
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const payload = sanitizeGamePuzzleInput(game, req.body);
      const newId = await nextNumericId(GamePuzzle);

      const puzzle = await GamePuzzle.create({ ...payload, id: newId });
      return res.json(puzzle.toJSON());
    } catch (error) {
      return res.status(error.status || 500).json({ error: statusAwarePublicError(error) });
    }
  }));

  adminGamesRouter.put('/:slug/puzzles/:id', asyncHandler(async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const slug = normalizeText(req.params.slug, 64).toLowerCase();
      const game = await GameDefinition.findOne({ slug }).lean();
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const existingPuzzle = await GamePuzzle.findOne({ id, gameSlug: slug }).lean();
      if (!existingPuzzle) return res.status(404).json({ error: 'Not found' });
      const update = sanitizeGamePuzzleInput(game, req.body, existingPuzzle);

      const puzzle = await GamePuzzle.findOneAndUpdate({ id, gameSlug: slug }, { $set: update }, { returnDocument: 'after' });
      return res.json(puzzle.toJSON());
    } catch (error) {
      return res.status(error.status || 500).json({ error: statusAwarePublicError(error) });
    }
  }));

  adminGamesRouter.delete('/:slug/puzzles/:id', asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const slug = normalizeText(req.params.slug, 64).toLowerCase();
    const result = await GamePuzzle.deleteOne({ id, gameSlug: slug });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  }));

  adminGamesRouter.post('/:slug/puzzles/:id/publish', asyncHandler(async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const slug = normalizeText(req.params.slug, 64).toLowerCase();
      const game = await GameDefinition.findOne({ slug }).lean();
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const existingPuzzle = await GamePuzzle.findOne({ id, gameSlug: slug }).lean();
      if (!existingPuzzle) return res.status(404).json({ error: 'Not found' });
      if (isPlaceholderGamePuzzle(game.type, existingPuzzle.payload, existingPuzzle.solution)) {
        return res.status(400).json({ error: 'Replace the placeholder game content before publishing.' });
      }
      if (game.type === 'crossword') {
        validateCrosswordPuzzle(existingPuzzle.payload, existingPuzzle.solution, {
          requireClueText: true,
          requireCompleteSolution: true,
          minEntryLength: MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
        });
      }
      const puzzle = await GamePuzzle.findOneAndUpdate(
        { id, gameSlug: slug },
        { $set: { status: 'published', publishAt: new Date(), updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (!puzzle) return res.status(404).json({ error: 'Not found' });
      return res.json(puzzle.toJSON());
    } catch (error) {
      return res.status(error.status || 500).json({ error: statusAwarePublicError(error) });
    }
  }));

  adminGamesRouter.post('/:slug/puzzles/:id/archive', asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const slug = normalizeText(req.params.slug, 64).toLowerCase();
    const puzzle = await GamePuzzle.findOneAndUpdate(
      { id, gameSlug: slug },
      { $set: { status: 'archived', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!puzzle) return res.status(404).json({ error: 'Not found' });
    return res.json(puzzle.toJSON());
  }));

  return adminGamesRouter;
}
