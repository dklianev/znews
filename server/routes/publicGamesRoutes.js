import express from 'express';

export function createPublicGamesRouter(deps) {
  const {
    findActivePublishedGamePuzzle,
    GamePuzzle,
    getSpellingBeeWordScore,
    getSpellingBeeWordValidation,
    getTodayGameDate,
    isPlaceholderGamePuzzle,
    isStrandsPathValid,
    listPublicGames,
    matchPathToAnswer,
    normalizeStrandsGrid,
    normalizeCrosswordSubmissionGrid,
    normalizeSpellingBeeLetter,
    normalizeSpellingBeeOuterLetters,
    normalizeSpellingBeeWord,
    normalizeSpellingBeeWords,
    normalizeText,
    resolveGameAccess,
    sanitizeStringArray,
    SINGLE_CHAR_PATTERN,
    SPELLING_BEE_MIN_WORD_LENGTH,
    STRANDS_TOTAL_CELLS,
    buildStrandsWordFromPath,
    statusAwarePublicError,
    stripPuzzleForPublic,
    TEMPORARILY_UNAVAILABLE_GAME_ERROR,
    toSafeInteger,
  } = deps;

  const gamesRouter = express.Router();

  gamesRouter.get('/', async (_req, res) => {
    const games = await listPublicGames();
    return res.json(games);
  });

  gamesRouter.get('/:slug/today', async (req, res) => {
    const { slug, game, canManageGames, isPubliclyAvailable } = await resolveGameAccess(req, req.params.slug);
    if (!game) return res.status(404).json({ error: 'Not found' });
    if (!isPubliclyAvailable && !canManageGames) {
      return res.status(404).json({ error: TEMPORARILY_UNAVAILABLE_GAME_ERROR });
    }

    const puzzle = await findActivePublishedGamePuzzle(slug, getTodayGameDate());
    if (!puzzle) return res.status(404).json({ error: 'No puzzle for today' });
    if (isPlaceholderGamePuzzle(game.type, puzzle.payload, puzzle.solution) && !canManageGames) {
      return res.status(404).json({ error: 'No puzzle for today' });
    }

    return res.json(stripPuzzleForPublic(puzzle));
  });

  gamesRouter.get('/:slug/archive', async (req, res) => {
    const { slug, game, canManageGames, isPubliclyAvailable } = await resolveGameAccess(req, req.params.slug);
    if (!game) return res.status(404).json({ error: 'Not found' });
    if (!isPubliclyAvailable && !canManageGames) {
      return res.status(404).json({ error: TEMPORARILY_UNAVAILABLE_GAME_ERROR });
    }

    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 30, 100);
    const puzzles = await GamePuzzle.find({ gameSlug: slug, status: 'published' })
      .sort({ puzzleDate: -1, activeUntilDate: -1 })
      .limit(limit)
      .lean();
    return res.json(
      canManageGames
        ? puzzles
        : puzzles
          .filter((puzzle) => !isPlaceholderGamePuzzle(game.type, puzzle.payload, puzzle.solution))
          .map((puzzle) => {
            const safePuzzle = { ...puzzle };
            delete safePuzzle.solution;
            delete safePuzzle.editorNotes;
            delete safePuzzle.payload;
            return safePuzzle;
          })
    );
  });

  gamesRouter.get('/:slug/:date', async (req, res) => {
    const { slug, game, canManageGames, isPubliclyAvailable } = await resolveGameAccess(req, req.params.slug);
    if (!game) return res.status(404).json({ error: 'Not found' });
    if (!isPubliclyAvailable && !canManageGames) {
      return res.status(404).json({ error: TEMPORARILY_UNAVAILABLE_GAME_ERROR });
    }

    const date = normalizeText(req.params.date, 10);
    const puzzle = await GamePuzzle.findOne({ gameSlug: slug, puzzleDate: date }).lean();

    if (!puzzle) return res.status(404).json({ error: 'Not found' });
    if (isPlaceholderGamePuzzle(game.type, puzzle.payload, puzzle.solution) && !canManageGames) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (puzzle.status !== 'published' && !canManageGames) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json(canManageGames ? puzzle : stripPuzzleForPublic(puzzle));
  });

  gamesRouter.post('/:slug/:date/validate', async (req, res) => {
    try {
      const { slug, game, canManageGames, isPubliclyAvailable } = await resolveGameAccess(req, req.params.slug);
      if (!game) return res.status(404).json({ error: 'Not found' });
      if (!isPubliclyAvailable && !canManageGames) {
        return res.status(404).json({ error: TEMPORARILY_UNAVAILABLE_GAME_ERROR });
      }

      const date = normalizeText(req.params.date, 10);
      const puzzle = await findActivePublishedGamePuzzle(slug, date);
      if (!puzzle) return res.status(404).json({ error: 'Not found' });
      if (isPlaceholderGamePuzzle(game.type, puzzle.payload, puzzle.solution) && !canManageGames) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (game.type === 'word') {
        const guess = (req.body.guess || '').toUpperCase();
        const answer = (puzzle.solution?.answer || '').toUpperCase();
        if (guess.length !== answer.length) return res.status(400).json({ error: 'Invalid length' });

        const evaluated = [];
        const answerLetters = answer.split('');
        const guessLetters = guess.split('');

        for (let i = 0; i < guessLetters.length; i++) {
          if (guessLetters[i] === answerLetters[i]) {
            evaluated[i] = { letter: guessLetters[i], status: 'correct' };
            answerLetters[i] = null;
          }
        }
        for (let i = 0; i < guessLetters.length; i++) {
          if (!evaluated[i]) {
            const char = guessLetters[i];
            const foundIdx = answerLetters.indexOf(char);
            if (foundIdx > -1) {
              evaluated[i] = { letter: char, status: 'present' };
              answerLetters[foundIdx] = null;
            } else {
              evaluated[i] = { letter: char, status: 'absent' };
            }
          }
        }
        return res.json({ evaluated, isWin: guess === answer });
      }

      if (game.type === 'hangman') {
        const action = normalizeText(req.body?.action, 32).toLowerCase();
        const answer = normalizeText(puzzle.solution?.answer, 32).toUpperCase();

        if (action === 'reveal-answer') {
          return res.json({ answer });
        }

        const letter = normalizeText(req.body?.letter, 8).toUpperCase();
        const normalizedLetter = Array.from(letter)[0] || '';
        if (!SINGLE_CHAR_PATTERN.test(normalizedLetter)) {
          return res.status(400).json({ error: 'Invalid letter' });
        }

        const guessedLetters = [...new Set(sanitizeStringArray(req.body?.guessedLetters, 8, { uppercase: true }).map((value) => Array.from(value)[0] || '').filter(Boolean))];
        const effectiveGuesses = [...new Set([...guessedLetters, normalizedLetter])];
        const answerChars = Array.from(answer);
        const positions = answerChars.reduce((indexes, char, index) => {
          if (char === normalizedLetter) indexes.push(index);
          return indexes;
        }, []);
        const uniqueAnswerChars = [...new Set(answerChars)];
        const isWin = uniqueAnswerChars.every((char) => effectiveGuesses.includes(char));

        return res.json({
          letter: normalizedLetter,
          positions,
          isCorrect: positions.length > 0,
          isWin,
          answerLength: answerChars.length,
        });
      }

      if (game.type === 'connections') {
        const { selection } = req.body;
        if (!Array.isArray(selection) || selection.length !== 4) return res.status(400).json({ error: 'Invalid selection' });

        const groups = puzzle.solution?.groups || [];
        let foundGroup = null;
        let isOneAway = false;

        for (const group of groups) {
          const intersection = group.items.filter((item) => selection.includes(item));
          if (intersection.length === 4) {
            foundGroup = group;
            break;
          }
          if (intersection.length === 3) isOneAway = true;
        }

        if (foundGroup) {
          return res.json({ correct: true, group: foundGroup });
        }
        return res.json({ correct: false, isOneAway });
      }

      if (game.type === 'spellingbee') {
        const centerLetter = normalizeSpellingBeeLetter(puzzle.payload?.centerLetter);
        const outerLetters = normalizeSpellingBeeOuterLetters(puzzle.payload?.outerLetters);
        const minWordLength = Math.max(
          SPELLING_BEE_MIN_WORD_LENGTH,
          Math.min(12, toSafeInteger(puzzle.payload?.minWordLength, SPELLING_BEE_MIN_WORD_LENGTH))
        );
        const guess = normalizeSpellingBeeWord(req.body?.guess);
        const validation = getSpellingBeeWordValidation(guess, {
          centerLetter,
          outerLetters,
          minWordLength,
        });

        if (!validation.isValid) {
          return res.json({ accepted: false, reason: validation.reason });
        }

        const acceptedWords = new Set(normalizeSpellingBeeWords(puzzle.solution?.words || []));
        if (!acceptedWords.has(validation.normalizedWord)) {
          return res.json({ accepted: false, reason: 'not-in-list' });
        }

        const score = Math.max(
          1,
          toSafeInteger(puzzle.solution?.scoreByWord?.[validation.normalizedWord], 0)
            || getSpellingBeeWordScore(validation.normalizedWord, { centerLetter, outerLetters, minWordLength })
        );

        return res.json({
          accepted: true,
          word: validation.normalizedWord,
          score,
          isPangram: validation.isPangram,
          totalWords: Math.max(0, toSafeInteger(puzzle.payload?.totalWords, acceptedWords.size)),
          maxScore: Math.max(0, toSafeInteger(puzzle.payload?.maxScore, 0)),
          pangramCount: Math.max(0, toSafeInteger(puzzle.payload?.pangramCount, 0)),
        });
      }

      if (game.type === 'crossword') {
        const layoutRows = Array.isArray(puzzle.payload?.layout) ? puzzle.payload.layout : [];
        const submission = normalizeCrosswordSubmissionGrid(req.body?.grid, layoutRows);
        const solutionGrid = Array.isArray(puzzle.solution?.grid) ? puzzle.solution.grid : [];
        const wrongCells = [];
        const emptyCells = [];
        let totalCells = 0;
        let filledCells = 0;

        layoutRows.forEach((layoutRow, rowIndex) => {
          Array.from(layoutRow).forEach((cell, colIndex) => {
            if (cell === '#') return;
            totalCells += 1;
            const value = submission[rowIndex][colIndex];
            if (value === '.') {
              emptyCells.push({ row: rowIndex, col: colIndex });
              return;
            }
            filledCells += 1;
            if (value !== solutionGrid[rowIndex][colIndex]) {
              wrongCells.push({ row: rowIndex, col: colIndex });
            }
          });
        });

        return res.json({
          isSolved: wrongCells.length === 0 && emptyCells.length === 0,
          wrongCells,
          emptyCells,
          totalCells,
          filledCells,
        });
      }

      if (game.type === 'strands') {
        const path = Array.isArray(req.body?.path)
          ? req.body.path.map((cell) => toSafeInteger(cell, Number.NaN))
          : [];
        if (path.length < 3 || path.length > STRANDS_TOTAL_CELLS || !isStrandsPathValid(path)) {
          return res.status(400).json({ error: 'Невалиден път.' });
        }

        const grid = normalizeStrandsGrid(puzzle.payload?.grid);
        const word = buildStrandsWordFromPath(path, grid);
        const match = matchPathToAnswer(path, puzzle.solution?.answers);

        if (!match) {
          return res.json({ accepted: false, kind: 'none', word });
        }

        return res.json({
          accepted: true,
          kind: match.kind,
          word: match.word,
          cells: match.cells,
        });
      }

      return res.json({ ok: true });
    } catch (error) {
      return res.status(error.status || 500).json({ error: statusAwarePublicError(error) });
    }
  });

  return gamesRouter;
}
