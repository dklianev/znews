import { STRANDS_TOTAL_CELLS, analyzeCoverage, normalizeGrid } from './strands.js';

export function looksLikePlaceholderText(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return false;

  return normalized === '?'
    || normalized === 'TODO5'
    || normalized === 'TODOWORD'
    || normalized.includes('TODO')
    || normalized.includes('PLACEHOLDER')
    || normalized.includes('REPLACE_ME')
    || normalized.includes('ЗАМЕНИ');
}

export function getGamePlaceholderWarnings(gameSlug, puzzle) {
  const warnings = [];
  const payload = puzzle?.payload || {};
  const solution = puzzle?.solution || {};

  if (gameSlug === 'word') {
    if (looksLikePlaceholderText(solution.answer)) {
      warnings.push({ key: 'solution.answer', label: 'Отговорът още е с placeholder текст.' });
    }
    if ((Array.isArray(solution.allowedWords) ? solution.allowedWords : []).some(looksLikePlaceholderText)) {
      warnings.push({ key: 'solution.allowedWords', label: 'Разрешените guess думи съдържат placeholder стойности.' });
    }
    return warnings;
  }

  if (gameSlug === 'hangman') {
    if (looksLikePlaceholderText(solution.answer)) {
      warnings.push({ key: 'solution.answer', label: 'Думата за отгатване още е placeholder.' });
    }
    if (looksLikePlaceholderText(payload.category)) {
      warnings.push({ key: 'payload.category', label: 'Категорията още е placeholder.' });
    }
    if (looksLikePlaceholderText(payload.hint)) {
      warnings.push({ key: 'payload.hint', label: 'Подсказката още е placeholder.' });
    }
    return warnings;
  }

  if (gameSlug === 'spellingbee') {
    if (looksLikePlaceholderText(payload.title)) {
      warnings.push({ key: 'payload.title', label: 'Заглавието на Spelling Bee още е placeholder.' });
    }
    if (looksLikePlaceholderText(payload.deck)) {
      warnings.push({ key: 'payload.deck', label: 'Подзаглавието на Spelling Bee още е placeholder.' });
    }
    if ((Array.isArray(solution.words) ? solution.words : []).some(looksLikePlaceholderText)) {
      warnings.push({ key: 'solution.words', label: 'Списъкът с валидни думи още съдържа placeholder стойности.' });
    }
    return warnings;
  }

  if (gameSlug === 'connections') {
    (Array.isArray(payload.items) ? payload.items : []).forEach((item, index) => {
      if (looksLikePlaceholderText(item)) {
        warnings.push({ key: `payload.items.${index}`, label: `Елемент ${index + 1} още е placeholder.` });
      }
    });

    (Array.isArray(solution.groups) ? solution.groups : []).forEach((group, groupIndex) => {
      if (looksLikePlaceholderText(group?.label)) {
        warnings.push({ key: `solution.groups.${groupIndex}.label`, label: `Група ${groupIndex + 1} още няма финално заглавие.` });
      }
      (Array.isArray(group?.items) ? group.items : []).forEach((item, itemIndex) => {
        if (looksLikePlaceholderText(item)) {
          warnings.push({
            key: `solution.groups.${groupIndex}.items.${itemIndex}`,
            label: `Група ${groupIndex + 1}, елемент ${itemIndex + 1} е placeholder.`,
          });
        }
      });
    });
    return warnings;
  }

  if (gameSlug === 'strands') {
    if (looksLikePlaceholderText(payload.title)) {
      warnings.push({ key: 'payload.title', label: 'Заглавието на Нишки още е placeholder.' });
    }
    if (looksLikePlaceholderText(payload.deck)) {
      warnings.push({ key: 'payload.deck', label: 'Подзаглавието на Нишки още е placeholder.' });
    }

    try {
      normalizeGrid(payload.grid);
    } catch {
      warnings.push({ key: 'payload.grid', label: 'Мрежата за Нишки не е валидна 8x6.' });
      return warnings;
    }

    const coverage = analyzeCoverage(solution.answers);
    if (coverage.spangrams !== 1) {
      warnings.push({ key: 'solution.answers', label: 'Нишки трябва да има точно една спанграма.' });
    }
    if (coverage.duplicateCells.length > 0) {
      warnings.push({ key: 'solution.answers', label: 'Има клетки, които се използват в повече от една дума.' });
    }
    if (coverage.uncoveredCells.length > 0) {
      warnings.push({
        key: 'solution.answers',
        label: `Непокрити клетки: ${STRANDS_TOTAL_CELLS - coverage.uncoveredCells.length}/${STRANDS_TOTAL_CELLS}.`,
      });
    }
    if ((Array.isArray(solution.answers) ? solution.answers : []).some((answer) => looksLikePlaceholderText(answer?.word))) {
      warnings.push({ key: 'solution.answers', label: 'Някоя от думите в Нишки още е placeholder.' });
    }
    return warnings;
  }

  if (gameSlug === 'crossword') {
    if (looksLikePlaceholderText(payload.title)) {
      warnings.push({ key: 'payload.title', label: 'Заглавието на кръстословицата още е placeholder.' });
    }
    if (looksLikePlaceholderText(payload.deck)) {
      warnings.push({ key: 'payload.deck', label: 'Подзаглавието на кръстословицата още е placeholder.' });
    }

    ['across', 'down'].forEach((direction) => {
      (Array.isArray(payload?.clues?.[direction]) ? payload.clues[direction] : []).forEach((entry, index) => {
        if (looksLikePlaceholderText(entry?.clue)) {
          warnings.push({
            key: `payload.clues.${direction}.${index}.clue`,
            label: `${direction === 'across' ? 'Хоризонтална' : 'Вертикална'} следа ${index + 1} е placeholder.`,
          });
        }
      });
    });

    if ((Array.isArray(solution?.grid) ? solution.grid : []).some((row) => String(row || '').includes('?'))) {
      warnings.push({ key: 'solution.grid', label: 'Решението още съдържа неизвестни клетки с ?.' });
    }
    return warnings;
  }

  if (gameSlug === 'quiz') {
    (Array.isArray(payload.questions) ? payload.questions : []).forEach((question, questionIndex) => {
      if (looksLikePlaceholderText(question?.question)) {
        warnings.push({ key: `payload.questions.${questionIndex}.question`, label: `Въпрос ${questionIndex + 1} е placeholder.` });
      }
      (Array.isArray(question?.options) ? question.options : []).forEach((option, optionIndex) => {
        if (looksLikePlaceholderText(option)) {
          warnings.push({
            key: `payload.questions.${questionIndex}.options.${optionIndex}`,
            label: `Въпрос ${questionIndex + 1}, отговор ${optionIndex + 1} е placeholder.`,
          });
        }
      });
      if (looksLikePlaceholderText(question?.explanation)) {
        warnings.push({ key: `payload.questions.${questionIndex}.explanation`, label: `Обяснението към въпрос ${questionIndex + 1} е placeholder.` });
      }
    });
  }

  return warnings;
}

export function hasGamePlaceholderContent(gameSlug, puzzle) {
  return getGamePlaceholderWarnings(gameSlug, puzzle).length > 0;
}
