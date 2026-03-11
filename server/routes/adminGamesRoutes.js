import express from 'express';

export function createAdminGamesRouter(deps) {
  const {
    GameDefinition,
    GamePuzzle,
    invalidateCacheGroup,
    isPlaceholderGamePuzzle,
    MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
    nextNumericId,
    normalizeText,
    publicError,
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

  adminGamesRouter.get('/', async (_req, res) => {
    try {
      const games = await GameDefinition.find().sort('sortOrder').lean();
      res.json(games);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  adminGamesRouter.post('/bulk-generate', async (req, res) => {
    try {
      const result = await seedGamesOnly({
        startDate: normalizeText(req.body?.startDate, 10),
        days: Number.parseInt(req.body?.days, 10) || 30,
        gameSlugs: req.body?.gameSlugs,
        overwriteDrafts: Boolean(req.body?.overwriteDrafts),
      });
      res.json(result);
    } catch (e) {
      res.status(e.status || 500).json({ error: statusAwarePublicError(e) });
    }
  });

  adminGamesRouter.post('/', async (req, res) => {
    try {
      const payload = sanitizeGameDefinitionInput(req.body);
      const newId = await nextNumericId(GameDefinition);

      const game = await GameDefinition.create({ ...payload, id: newId });
      clearGameDefinitionCache();
      res.json(game.toJSON());
    } catch (e) {
      res.status(e.status || 500).json({ error: statusAwarePublicError(e) });
    }
  });

  adminGamesRouter.put('/:id', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const existingGame = await GameDefinition.findOne({ id }).lean();
      if (!existingGame) return res.status(404).json({ error: 'Not found' });
      const update = sanitizeGameDefinitionInput(req.body, existingGame);

      const game = await GameDefinition.findOneAndUpdate({ id }, { $set: update }, { new: true });
      clearGameDefinitionCache();
      res.json(game.toJSON());
    } catch (e) {
      res.status(e.status || 500).json({ error: statusAwarePublicError(e) });
    }
  });

  adminGamesRouter.delete('/:id', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const game = await GameDefinition.findOne({ id }).lean();
      if (!game) return res.status(404).json({ error: 'Not found' });

      const result = await GameDefinition.deleteOne({ id });
      if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
      await GamePuzzle.deleteMany({ gameSlug: game.slug });
      clearGameDefinitionCache();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  adminGamesRouter.get('/:slug/puzzles', async (req, res) => {
    try {
      const slug = normalizeText(req.params.slug, 64).toLowerCase();
      const game = await GameDefinition.findOne({ slug }).lean();
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const puzzles = await GamePuzzle.find({ gameSlug: slug }).sort({ puzzleDate: -1, activeUntilDate: -1 }).lean();
      res.json(puzzles);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  adminGamesRouter.post('/:slug/puzzles', async (req, res) => {
    try {
      const slug = normalizeText(req.params.slug, 64).toLowerCase();
      const game = await GameDefinition.findOne({ slug }).lean();
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const payload = sanitizeGamePuzzleInput(game, req.body);
      const newId = await nextNumericId(GamePuzzle);

      const puzzle = await GamePuzzle.create({ ...payload, id: newId });
      res.json(puzzle.toJSON());
    } catch (e) {
      res.status(e.status || 500).json({ error: statusAwarePublicError(e) });
    }
  });

  adminGamesRouter.put('/:slug/puzzles/:id', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const slug = normalizeText(req.params.slug, 64).toLowerCase();
      const game = await GameDefinition.findOne({ slug }).lean();
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const existingPuzzle = await GamePuzzle.findOne({ id, gameSlug: slug }).lean();
      if (!existingPuzzle) return res.status(404).json({ error: 'Not found' });
      const update = sanitizeGamePuzzleInput(game, req.body, existingPuzzle);

      const puzzle = await GamePuzzle.findOneAndUpdate({ id, gameSlug: slug }, { $set: update }, { new: true });
      res.json(puzzle.toJSON());
    } catch (e) {
      res.status(e.status || 500).json({ error: statusAwarePublicError(e) });
    }
  });

  adminGamesRouter.delete('/:slug/puzzles/:id', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const slug = normalizeText(req.params.slug, 64).toLowerCase();
      const result = await GamePuzzle.deleteOne({ id, gameSlug: slug });
      if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  adminGamesRouter.post('/:slug/puzzles/:id/publish', async (req, res) => {
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
        { new: true }
      );
      if (!puzzle) return res.status(404).json({ error: 'Not found' });
      res.json(puzzle.toJSON());
    } catch (e) {
      res.status(e.status || 500).json({ error: statusAwarePublicError(e) });
    }
  });

  adminGamesRouter.post('/:slug/puzzles/:id/archive', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const slug = normalizeText(req.params.slug, 64).toLowerCase();
      const puzzle = await GamePuzzle.findOneAndUpdate(
        { id, gameSlug: slug },
        { $set: { status: 'archived', updatedAt: new Date() } },
        { new: true }
      );
      if (!puzzle) return res.status(404).json({ error: 'Not found' });
      res.json(puzzle.toJSON());
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  return adminGamesRouter;
}
