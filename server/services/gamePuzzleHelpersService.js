export function createGamePuzzleHelpers(deps) {
  const {
    MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
    SPELLING_BEE_MIN_WORD_LENGTH,
    SUPPORTED_PUZZLE_DIFFICULTIES,
    SUPPORTED_PUZZLE_STATUSES,
    analyzeCrosswordConstruction,
    analyzeSpellingBeeWords,
    analyzeStrandsCoverage,
    badRequest,
    buildStrandsWordFromPath,
    doesPathSpanBoard,
    getCrosswordEntries,
    getPuzzleActiveUntilDate,
    hasCompleteSpellingBeeHive,
    hasOwn,
    isPlainObject,
    isStrandsPathValid,
    matchPathToAnswer,
    normalizeSpellingBeeLetter,
    normalizeSpellingBeeOuterLetters,
    normalizeStrandsGrid,
    normalizeText,
    sanitizeDateTime,
    sanitizeStringArray,
    STRANDS_COLS,
    STRANDS_ROWS,
    STRANDS_TOTAL_CELLS,
    toSafeInteger,
  } = deps;

  function validateWordPuzzle(payloadInput, solutionInput) {
    if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
      throw badRequest('Word puzzle payload and solution must be JSON objects.');
    }
  
    const wordLength = toSafeInteger(payloadInput.wordLength, 5);
    const maxAttempts = toSafeInteger(payloadInput.maxAttempts, 6);
    const answer = normalizeText(solutionInput.answer, 32).toUpperCase();
    const allowedWords = sanitizeStringArray(solutionInput.allowedWords, 32, { uppercase: true });
    const keyboardLayout = Array.isArray(payloadInput.keyboardLayout)
      ? sanitizeStringArray(payloadInput.keyboardLayout, 64)
      : normalizeText(String(payloadInput.keyboardLayout || ''), 160);
    const hint = normalizeText(solutionInput.hint, 160);
  
    if (wordLength < 3 || wordLength > 12) throw badRequest('Word puzzles must use a word length between 3 and 12.');
    if (maxAttempts < 1 || maxAttempts > 12) throw badRequest('Word puzzles must allow between 1 and 12 attempts.');
    if (!answer || answer.length !== wordLength) throw badRequest('Word puzzle answer must match the configured word length.');
    if (allowedWords.some((word) => word.length !== wordLength)) {
      throw badRequest('Every allowed guess must match the configured word length.');
    }
  
    const normalizedAllowedWords = [...new Set([answer, ...allowedWords])];
    return {
      payload: {
        wordLength,
        maxAttempts,
        keyboardLayout,
      },
      solution: {
        answer,
        allowedWords: normalizedAllowedWords,
        ...(hint ? { hint } : {}),
      },
    };
  }
  
  function validateConnectionsPuzzle(payloadInput, solutionInput) {
    if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
      throw badRequest('Connections puzzle payload and solution must be JSON objects.');
    }
  
    const items = sanitizeStringArray(payloadInput.items, 80);
    if (items.length !== 16 || new Set(items).size !== 16) {
      throw badRequest('Connections puzzles require exactly 16 unique items.');
    }
  
    const rawGroups = Array.isArray(solutionInput.groups) ? solutionInput.groups : [];
    if (rawGroups.length !== 4) throw badRequest('Connections puzzles require exactly 4 solution groups.');
  
    const groups = rawGroups.map((group, index) => {
      if (!isPlainObject(group)) throw badRequest(`Connections group #${index + 1} must be a JSON object.`);
      const label = normalizeText(group.label, 80);
      const difficulty = normalizeText(String(group.difficulty ?? index + 1), 24);
      const explanation = normalizeText(group.explanation, 240);
      const groupItems = sanitizeStringArray(group.items, 80);
  
      if (!label) throw badRequest(`Connections group #${index + 1} must have a label.`);
      if (groupItems.length !== 4 || new Set(groupItems).size !== 4) {
        throw badRequest(`Connections group #${index + 1} must contain 4 unique items.`);
      }
  
      return {
        label,
        difficulty,
        items: groupItems,
        ...(explanation ? { explanation } : {}),
      };
    });
  
    const groupedItems = groups.flatMap((group) => group.items);
    if (groupedItems.length !== 16 || new Set(groupedItems).size !== 16) {
      throw badRequest('Connections solution groups must cover 16 unique items.');
    }
  
    const groupedItemSet = new Set(groupedItems);
    if (items.some((item) => !groupedItemSet.has(item)) || groupedItems.some((item) => !items.includes(item))) {
      throw badRequest('Connections payload items must match the solution groups exactly.');
    }
  
    return {
      payload: { items },
      solution: { groups },
    };
  }
  
  function validateQuizPuzzle(payloadInput, solutionInput) {
    if (!isPlainObject(payloadInput)) throw badRequest('Quiz puzzle payload must be a JSON object.');
  
    const rawQuestions = Array.isArray(payloadInput.questions) ? payloadInput.questions : [];
    if (rawQuestions.length === 0) throw badRequest('Quiz puzzles require at least one question.');
  
    const questions = rawQuestions.map((question, index) => {
      if (!isPlainObject(question)) throw badRequest(`Quiz question #${index + 1} must be a JSON object.`);
  
      const prompt = normalizeText(question.question, 240);
      const options = sanitizeStringArray(question.options, 160);
      const correctIndex = toSafeInteger(question.correctIndex, -1);
      const explanation = normalizeText(question.explanation, 280);
  
      if (!prompt) throw badRequest(`Quiz question #${index + 1} must have text.`);
      if (options.length !== 4) throw badRequest(`Quiz question #${index + 1} must have exactly 4 answer options.`);
      if (correctIndex < 0 || correctIndex >= options.length) {
        throw badRequest(`Quiz question #${index + 1} must have a valid correctIndex.`);
      }
  
      const sanitizedQuestion = {
        question: prompt,
        options,
        correctIndex,
      };
  
      if (explanation) sanitizedQuestion.explanation = explanation;
      if (question.articleId !== undefined && question.articleId !== null && question.articleId !== '') {
        sanitizedQuestion.articleId = typeof question.articleId === 'number'
          ? question.articleId
          : normalizeText(String(question.articleId), 64);
      }
  
      return sanitizedQuestion;
    });
  
    return {
      payload: { questions },
      solution: isPlainObject(solutionInput) ? solutionInput : {},
    };
  }
  
  const HANGMAN_ANSWER_PATTERN = /^[\p{L}\p{N}]+$/u;
  const SINGLE_CHAR_PATTERN = /^[\p{L}\p{N}]$/u;
  
  function validateHangmanPuzzle(payloadInput, solutionInput) {
    if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
      throw badRequest('Hangman puzzle payload and solution must be JSON objects.');
    }
  
    const answer = normalizeText(solutionInput.answer, 32).toUpperCase();
    const answerLength = Array.from(answer).length;
    const category = normalizeText(payloadInput.category, 80);
    const hint = normalizeText(payloadInput.hint, 180);
    const maxMistakes = toSafeInteger(payloadInput.maxMistakes, 7);
    const keyboardLayout = Array.isArray(payloadInput.keyboardLayout)
      ? sanitizeStringArray(payloadInput.keyboardLayout, 64, { uppercase: true })
      : normalizeText(String(payloadInput.keyboardLayout || 'bg'), 160);
  
    if (!category) throw badRequest('Hangman puzzles require a category.');
    if (!answer || answerLength < 3 || answerLength > 18) {
      throw badRequest('Hangman answer must be between 3 and 18 characters.');
    }
    if (!HANGMAN_ANSWER_PATTERN.test(answer)) {
      throw badRequest('Hangman answer must contain only letters or digits and no spaces.');
    }
    if (maxMistakes < 4 || maxMistakes > 10) {
      throw badRequest('Hangman puzzles must allow between 4 and 10 mistakes.');
    }
  
    return {
      payload: {
        category,
        ...(hint ? { hint } : {}),
        maxMistakes,
        keyboardLayout,
        answerLength,
      },
      solution: {
        answer,
      },
    };
  }
  
  function validateSpellingBeePuzzle(payloadInput, solutionInput) {
    if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
      throw badRequest('Spelling Bee payload and solution must be JSON objects.');
    }
  
    const title = normalizeText(payloadInput.title, 120);
    const deck = normalizeText(payloadInput.deck, 220);
    const centerLetter = normalizeSpellingBeeLetter(payloadInput.centerLetter);
    const outerLetters = normalizeSpellingBeeOuterLetters(payloadInput.outerLetters);
    const minWordLength = Math.max(
      SPELLING_BEE_MIN_WORD_LENGTH,
      Math.min(12, toSafeInteger(payloadInput.minWordLength, SPELLING_BEE_MIN_WORD_LENGTH))
    );
  
    if (!hasCompleteSpellingBeeHive(centerLetter, outerLetters)) {
      throw badRequest('Spelling Bee requires 7 unique hive letters.');
    }
  
    const analysis = analyzeSpellingBeeWords(solutionInput.words, {
      centerLetter,
      outerLetters,
      minWordLength,
    });
  
    if (analysis.normalizedWords.length === 0 || analysis.totalWords === 0) {
      throw badRequest('Spelling Bee requires at least one valid word.');
    }
    if (analysis.rejectedWords.length > 0) {
      const firstRejectedWord = analysis.rejectedWords[0];
      throw badRequest('Spelling Bee word "' + firstRejectedWord.word + '" is invalid (' + firstRejectedWord.reason + ').');
    }
    if (analysis.pangramCount === 0) {
      throw badRequest('Spelling Bee requires at least one pangram.');
    }
  
    return {
      payload: {
        ...(title ? { title } : {}),
        ...(deck ? { deck } : {}),
        centerLetter,
        outerLetters,
        minWordLength,
        totalWords: analysis.totalWords,
        pangramCount: analysis.pangramCount,
        maxScore: analysis.maxScore,
        longestWordLength: analysis.longestWordLength,
      },
      solution: {
        words: analysis.acceptedWords,
        pangrams: analysis.pangrams,
        scoreByWord: analysis.scoreByWord,
      },
    };
  }

  function normalizeStrandsAnswer(answer, index, grid) {
    if (!isPlainObject(answer)) {
      throw badRequest(`Нишки: отговор #${index + 1} трябва да е JSON обект.`);
    }

    const kind = normalizeText(answer.kind, 24).toLowerCase();
    if (kind !== 'theme' && kind !== 'spangram') {
      throw badRequest(`Нишки: отговор #${index + 1} трябва да е от тип theme или spangram.`);
    }

    const cells = Array.isArray(answer.cells)
      ? answer.cells.map((cell) => toSafeInteger(cell, Number.NaN))
      : [];
    if (cells.length === 0) {
      throw badRequest(`Нишки: отговор #${index + 1} трябва да има поне една клетка.`);
    }
    if (!isStrandsPathValid(cells)) {
      throw badRequest(`Нишки: пътят за отговор #${index + 1} не е валиден.`);
    }

    const word = normalizeText(answer.word, 80).toUpperCase();
    const builtWord = buildStrandsWordFromPath(cells, grid);
    if (!word) {
      throw badRequest(`Нишки: отговор #${index + 1} няма дума.`);
    }
    if (word !== builtWord) {
      throw badRequest(`Нишки: думата за отговор #${index + 1} не съвпада с буквите от мрежата.`);
    }

    return {
      kind,
      word,
      cells,
    };
  }

  function validateStrandsPuzzle(payloadInput, solutionInput) {
    if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
      throw badRequest('Нишки: payload и solution трябва да са JSON обекти.');
    }

    const title = normalizeText(payloadInput.title, 120);
    const deck = normalizeText(payloadInput.deck, 240);
    const rows = toSafeInteger(payloadInput.rows, STRANDS_ROWS);
    const cols = toSafeInteger(payloadInput.cols, STRANDS_COLS);

    if (rows !== STRANDS_ROWS || cols !== STRANDS_COLS) {
      throw badRequest(`Нишки: размерът на мрежата е фиксиран на ${STRANDS_ROWS}x${STRANDS_COLS}.`);
    }

    let grid;
    try {
      grid = normalizeStrandsGrid(payloadInput.grid);
    } catch (error) {
      throw badRequest(error?.message || 'Нишки: невалидна мрежа.');
    }

    const rawAnswers = Array.isArray(solutionInput.answers) ? solutionInput.answers : [];
    if (rawAnswers.length < 2) {
      throw badRequest('Нишки: пъзелът трябва да има поне една тематична дума и една спанграма.');
    }

    const answers = rawAnswers.map((answer, index) => normalizeStrandsAnswer(answer, index, grid));
    const coverage = analyzeStrandsCoverage(answers);

    if (coverage.themeCount < 1) {
      throw badRequest('Нишки: трябва да има поне една тематична дума.');
    }
    if (coverage.spangrams !== 1) {
      throw badRequest('Нишки: трябва да има точно една спанграма.');
    }
    if (coverage.invalidCells.length > 0) {
      throw badRequest('Нишки: има клетки извън борда.');
    }
    if (coverage.duplicateCells.length > 0) {
      throw badRequest('Нишки: една или повече клетки се използват в повече от една дума.');
    }
    if (coverage.uncoveredCells.length > 0) {
      throw badRequest(`Нишки: не всички клетки са покрити (${STRANDS_TOTAL_CELLS - coverage.uncoveredCells.length}/${STRANDS_TOTAL_CELLS}).`);
    }

    const spangram = answers.find((answer) => answer.kind === 'spangram');
    if (!spangram || !doesPathSpanBoard(spangram.cells)) {
      throw badRequest('Нишки: спанграмата трябва да минава от край до край на борда.');
    }

    return {
      payload: {
        ...(title ? { title } : {}),
        ...(deck ? { deck } : {}),
        rows: STRANDS_ROWS,
        cols: STRANDS_COLS,
        grid,
      },
      solution: {
        answers,
      },
    };
  }
  
  function normalizeCrosswordLayoutRows(rawLayout, width, height) {
    if (!Array.isArray(rawLayout) || rawLayout.length !== height) {
      throw badRequest('Crossword layout must contain one row per grid row.');
    }
  
    return rawLayout.map((row, rowIndex) => {
      const chars = Array.from(String(row || '').toUpperCase());
      if (chars.length !== width) {
        throw badRequest(`Crossword layout row #${rowIndex + 1} must have exactly ${width} cells.`);
      }
      if (chars.some((char) => char !== '#' && char !== '.')) {
        throw badRequest('Crossword layout rows may only contain "." and "#" characters.');
      }
      return chars.join('');
    });
  }
  
  function normalizeCrosswordSolutionRows(rawGrid, layoutRows, width, height) {
    if (!Array.isArray(rawGrid) || rawGrid.length !== height) {
      throw badRequest('Crossword solution must contain one row per grid row.');
    }
  
    return rawGrid.map((row, rowIndex) => {
      const chars = Array.from(String(row || '').toUpperCase());
      if (chars.length !== width) {
        throw badRequest(`Crossword solution row #${rowIndex + 1} must have exactly ${width} cells.`);
      }
  
      return chars.map((char, colIndex) => {
        const isBlock = layoutRows[rowIndex][colIndex] === '#';
        if (isBlock) {
          if (char !== '#') throw badRequest('Crossword solution must use "#" in every blocked cell.');
          return '#';
        }
        if (char !== '?' && !SINGLE_CHAR_PATTERN.test(char)) {
          throw badRequest('Crossword solution cells must contain a single letter, digit or ? placeholder.');
        }
        return char;
      }).join('');
    });
  }
  
  function normalizeCrosswordClues(rawEntries, expectedEntries, direction, options = {}) {
    const { requireText = true, allowMissingEntries = false } = options;
    if (!Array.isArray(rawEntries)) {
      if (!allowMissingEntries) {
        throw badRequest(`Crossword ${direction} clues must be an array.`);
      }
      rawEntries = [];
    }
  
    const usedIndices = new Set();
    return expectedEntries.map((expected) => {
      const matchIndex = rawEntries.findIndex((entry, index) => {
        if (usedIndices.has(index) || !isPlainObject(entry)) return false;
        const row = toSafeInteger(entry.row, -1);
        const col = toSafeInteger(entry.col, -1);
        const number = toSafeInteger(entry.number, -1);
        return (row === expected.row && col === expected.col) || number === expected.number;
      });
  
      const match = matchIndex >= 0 ? rawEntries[matchIndex] : null;
      if (matchIndex >= 0) usedIndices.add(matchIndex);
  
      const clue = normalizeText(match?.clue, 220);
      if (requireText && !clue) {
        throw badRequest(`Crossword clue #${expected.number} must have text.`);
      }
  
      return {
        number: expected.number,
        row: expected.row,
        col: expected.col,
        length: expected.length,
        clue,
      };
    });
  }
  
  function validateCrosswordPuzzle(payloadInput, solutionInput, options = {}) {
    if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
      throw badRequest('Crossword puzzle payload and solution must be JSON objects.');
    }
  
    const { requireClueText = true, requireCompleteSolution = true, minEntryLength = MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH } = options;
    const rawLayout = Array.isArray(payloadInput.layout) ? payloadInput.layout : [];
    const derivedHeight = rawLayout.length;
    const derivedWidth = derivedHeight > 0 ? Array.from(String(rawLayout[0] || '')).length : 0;
    const width = toSafeInteger(payloadInput.width, derivedWidth);
    const height = toSafeInteger(payloadInput.height, derivedHeight);
    const title = normalizeText(payloadInput.title, 80);
    const deck = normalizeText(payloadInput.deck, 180);
  
    if (width < 3 || width > 15 || height < 3 || height > 15) {
      throw badRequest('Crossword grid must be between 3x3 and 15x15.');
    }
  
    const layout = normalizeCrosswordLayoutRows(rawLayout, width, height);
    const solutionGrid = normalizeCrosswordSolutionRows(solutionInput.grid, layout, width, height);
    const expectedEntries = getCrosswordEntries(layout);
    if (expectedEntries.across.length === 0 || expectedEntries.down.length === 0) {
      throw badRequest('Crossword grid must include at least one across and one down entry.');
    }
  
    const rawClues = isPlainObject(payloadInput.clues) ? payloadInput.clues : {};
    const clues = {
      across: normalizeCrosswordClues(rawClues.across, expectedEntries.across, 'across', { requireText: requireClueText, allowMissingEntries: !requireClueText }),
      down: normalizeCrosswordClues(rawClues.down, expectedEntries.down, 'down', { requireText: requireClueText, allowMissingEntries: !requireClueText }),
    };
  
    const analysis = analyzeCrosswordConstruction({
      width,
      height,
      layoutRows: layout,
      clues,
      solutionGrid,
      minEntryLength,
      requireClueText,
      requireCompleteSolution,
    });
    if (analysis.blockers.length > 0) {
      throw badRequest(analysis.blockers[0].message);
    }
  
    return {
      payload: {
        ...(title ? { title } : {}),
        ...(deck ? { deck } : {}),
        width,
        height,
        layout,
        clues,
      },
      solution: {
        grid: solutionGrid,
      },
    };
  }
  
  function normalizeCrosswordSubmissionGrid(rawGrid, layoutRows) {
    if (!Array.isArray(rawGrid) || rawGrid.length !== layoutRows.length) {
      throw badRequest('Crossword submission must contain one row per grid row.');
    }
  
    return layoutRows.map((layoutRow, rowIndex) => {
      const width = Array.from(layoutRow).length;
      const chars = Array.isArray(rawGrid[rowIndex])
        ? rawGrid[rowIndex].map((value) => String(value || '').trim().toUpperCase())
        : Array.from(String(rawGrid[rowIndex] || '').toUpperCase());
  
      if (chars.length !== width) {
        throw badRequest(`Crossword submission row #${rowIndex + 1} must have exactly ${width} cells.`);
      }
  
      return Array.from(layoutRow).map((layoutChar, colIndex) => {
        if (layoutChar === '#') return '#';
        const rawValue = Array.isArray(rawGrid[rowIndex])
          ? String(rawGrid[rowIndex][colIndex] || '').trim().toUpperCase()
          : String(chars[colIndex] || '').trim().toUpperCase();
        if (!rawValue) return '.';
        const char = Array.from(rawValue)[0] || '';
        if (!SINGLE_CHAR_PATTERN.test(char)) {
          throw badRequest('Crossword submission cells must contain only one letter or digit.');
        }
        return char;
      }).join('');
    });
  }
  
  function isGenericPlaceholderText(value) {
    const normalized = normalizeText(String(value || ''), 240).toUpperCase();
    if (!normalized) return false;
    return normalized === '?'
      || normalized.includes('TODO')
      || normalized.includes('PLACEHOLDER')
      || normalized.includes('REPLACE_ME')
      || normalized.includes('ПОПЪЛНИ')
      || normalized.includes('ЗАМЕНИ');
  }
  
  function isPlaceholderWordPuzzle(_payload, solution) {
    const answer = normalizeText(solution?.answer, 32).toUpperCase();
    return answer === 'ДУМА1' || isGenericPlaceholderText(answer);
  }
  
  function isPlaceholderConnectionsPuzzle(payload, solution) {
    const items = sanitizeStringArray(payload?.items, 80);
    const groups = Array.isArray(solution?.groups) ? solution.groups : [];
    const usesTemplateItems = items.length === 16 && items.every((item) => /^[АБВГ]\d$/u.test(item));
    const usesGenericItems = items.some((item) => isGenericPlaceholderText(item));
    const templateLabels = ['ГРУПА А', 'ГРУПА Б', 'ГРУПА В', 'ГРУПА Г'];
    const usesTemplateLabels = groups.length === 4
      && groups.every((group, index) => normalizeText(group?.label, 80).toUpperCase() === templateLabels[index]);
    const usesGenericLabels = groups.some((group) => isGenericPlaceholderText(group?.label));
  
    return usesTemplateItems || usesGenericItems || usesTemplateLabels || usesGenericLabels;
  }
  
  function isPlaceholderQuizPuzzle(payload) {
    const questions = Array.isArray(payload?.questions) ? payload.questions : [];
    return questions.some((question) => {
      const prompt = normalizeText(question?.question, 240);
      const options = sanitizeStringArray(question?.options, 32);
      return (prompt === '?' && options.length === 4 && options.every((option, index) => option === String(index + 1)))
        || isGenericPlaceholderText(prompt)
        || options.some((option) => isGenericPlaceholderText(option));
    });
  }
  
  function isPlaceholderHangmanPuzzle(payload, solution) {
    return isGenericPlaceholderText(solution?.answer)
      || isGenericPlaceholderText(payload?.category)
      || isGenericPlaceholderText(payload?.hint);
  }
  
  function isPlaceholderCrosswordPuzzle(payload, solution) {
    if (isGenericPlaceholderText(payload?.title) || isGenericPlaceholderText(payload?.deck)) {
      return true;
    }
  
    const hasPlaceholderClues = ['across', 'down'].some((direction) => (
      Array.isArray(payload?.clues?.[direction])
        ? payload.clues[direction].some((entry) => isGenericPlaceholderText(entry?.clue))
        : false
    ));
  
    const hasPlaceholderSolution = Array.isArray(solution?.grid)
      ? solution.grid.some((row) => String(row || '').includes('?'))
      : false;
  
    return hasPlaceholderClues || hasPlaceholderSolution;
  }
  
  function isPlaceholderSpellingBeePuzzle(payload, solution) {
    return isGenericPlaceholderText(payload?.title)
      || isGenericPlaceholderText(payload?.deck)
      || (Array.isArray(solution?.words) ? solution.words.some((word) => isGenericPlaceholderText(word)) : false);
  }

  function isPlaceholderStrandsPuzzle(payload, solution) {
    if (isGenericPlaceholderText(payload?.title) || isGenericPlaceholderText(payload?.deck)) {
      return true;
    }

    return (Array.isArray(solution?.answers) ? solution.answers : []).some((answer) => (
      isGenericPlaceholderText(answer?.word)
        || !Array.isArray(answer?.cells)
        || answer.cells.length === 0
    ));
  }
  
  function isPlaceholderGamePuzzle(gameType, payload, solution) {
    if (gameType === 'word') return isPlaceholderWordPuzzle(payload, solution);
    if (gameType === 'hangman') return isPlaceholderHangmanPuzzle(payload, solution);
    if (gameType === 'connections') return isPlaceholderConnectionsPuzzle(payload, solution);
    if (gameType === 'spellingbee') return isPlaceholderSpellingBeePuzzle(payload, solution);
    if (gameType === 'strands') return isPlaceholderStrandsPuzzle(payload, solution);
    if (gameType === 'crossword') return isPlaceholderCrosswordPuzzle(payload, solution);
    if (gameType === 'quiz') return isPlaceholderQuizPuzzle(payload, solution);
    return false;
  }
  
  function sanitizeGamePuzzleInput(game, input, existingPuzzle = null) {
    if (!game) throw badRequest('Game definition not found.');
    if (!isPlainObject(input)) throw badRequest('Invalid puzzle payload.');
  
    const puzzleDate = hasOwn(input, 'puzzleDate')
      ? normalizeText(input.puzzleDate, 10)
      : existingPuzzle?.puzzleDate;
    const status = normalizeText(
      hasOwn(input, 'status') ? input.status : existingPuzzle?.status || 'draft',
      24
    ).toLowerCase();
    const difficulty = normalizeText(
      hasOwn(input, 'difficulty') ? input.difficulty : existingPuzzle?.difficulty || 'medium',
      16
    ).toLowerCase();
    const editorNotes = normalizeText(
      hasOwn(input, 'editorNotes') ? input.editorNotes : existingPuzzle?.editorNotes,
      500
    );
    const rawPayload = hasOwn(input, 'payload') ? input.payload : existingPuzzle?.payload;
    const rawSolution = hasOwn(input, 'solution') ? input.solution : existingPuzzle?.solution;
    const requestedPublishAt = hasOwn(input, 'publishAt')
      ? sanitizeDateTime(input.publishAt)
      : existingPuzzle?.publishAt || null;
    const requestedActiveUntilDate = hasOwn(input, 'activeUntilDate')
      ? normalizeText(input.activeUntilDate, 10)
      : getPuzzleActiveUntilDate(existingPuzzle) || puzzleDate;
    const activeUntilDate = requestedActiveUntilDate || puzzleDate;
  
    if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate || '')) throw badRequest('Puzzle date must be in YYYY-MM-DD format.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(activeUntilDate || '')) throw badRequest('Active until date must be in YYYY-MM-DD format.');
    if (activeUntilDate < puzzleDate) throw badRequest('Active until date cannot be before puzzle date.');
    if (!SUPPORTED_PUZZLE_STATUSES.has(status)) throw badRequest('Invalid puzzle status.');
    if (!SUPPORTED_PUZZLE_DIFFICULTIES.has(difficulty)) throw badRequest('Invalid puzzle difficulty.');
  
    let validatedPuzzle;
    if (game.type === 'word') {
      validatedPuzzle = validateWordPuzzle(rawPayload, rawSolution);
    } else if (game.type === 'hangman') {
      validatedPuzzle = validateHangmanPuzzle(rawPayload, rawSolution);
    } else if (game.type === 'connections') {
      validatedPuzzle = validateConnectionsPuzzle(rawPayload, rawSolution);
    } else if (game.type === 'spellingbee') {
      validatedPuzzle = validateSpellingBeePuzzle(rawPayload, rawSolution);
    } else if (game.type === 'strands') {
      validatedPuzzle = validateStrandsPuzzle(rawPayload, rawSolution);
    } else if (game.type === 'crossword') {
      validatedPuzzle = validateCrosswordPuzzle(rawPayload, rawSolution, {
        requireClueText: status === 'published',
        requireCompleteSolution: status === 'published',
        minEntryLength: status === 'published' ? MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH : 1,
      });
    } else if (game.type === 'quiz') {
      validatedPuzzle = validateQuizPuzzle(rawPayload, rawSolution);
    } else {
      throw badRequest('Unsupported game type.');
    }
  
    const placeholderPuzzle = isPlaceholderGamePuzzle(game.type, validatedPuzzle.payload, validatedPuzzle.solution);
    if (status === 'published' && placeholderPuzzle) {
      throw badRequest('Replace the placeholder game content before publishing.');
    }
  
    return {
      gameSlug: game.slug,
      puzzleDate,
      activeUntilDate,
      status,
      publishAt: status === 'published' ? (requestedPublishAt || new Date()) : requestedPublishAt,
      difficulty,
      payload: validatedPuzzle.payload,
      solution: validatedPuzzle.solution,
      editorNotes,
      updatedAt: new Date(),
    };
  }

  return {
    SINGLE_CHAR_PATTERN,
    isPlaceholderGamePuzzle,
    normalizeCrosswordSubmissionGrid,
    sanitizeGamePuzzleInput,
    validateCrosswordPuzzle,
    validateStrandsPuzzle,
  };
}
