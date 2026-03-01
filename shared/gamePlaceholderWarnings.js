export function looksLikePlaceholderText(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return false;

  return normalized === '?'
    || normalized === 'ДУМА1'
    || normalized.includes('TODO')
    || normalized.includes('PLACEHOLDER')
    || normalized.includes('REPLACE_ME')
    || normalized.includes('ПОПЪЛНИ');
}

export function getGamePlaceholderWarnings(gameSlug, puzzle) {
  const warnings = [];
  const payload = puzzle?.payload || {};
  const solution = puzzle?.solution || {};

  if (gameSlug === 'word') {
    if (looksLikePlaceholderText(solution.answer)) {
      warnings.push({ key: 'solution.answer', label: 'Смени тайната дума с реална дума.' });
    }
    if ((Array.isArray(solution.allowedWords) ? solution.allowedWords : []).some(looksLikePlaceholderText)) {
      warnings.push({ key: 'solution.allowedWords', label: 'Премахни placeholder guesses от списъка.' });
    }
    return warnings;
  }

  if (gameSlug === 'connections') {
    (Array.isArray(payload.items) ? payload.items : []).forEach((item, index) => {
      if (looksLikePlaceholderText(item)) {
        warnings.push({ key: `payload.items.${index}`, label: `Елемент ${index + 1} на дъската още е placeholder.` });
      }
    });

    (Array.isArray(solution.groups) ? solution.groups : []).forEach((group, groupIndex) => {
      if (looksLikePlaceholderText(group?.label)) {
        warnings.push({ key: `solution.groups.${groupIndex}.label`, label: `Група ${groupIndex + 1} още няма реално име.` });
      }
      (Array.isArray(group?.items) ? group.items : []).forEach((item, itemIndex) => {
        if (looksLikePlaceholderText(item)) {
          warnings.push({
            key: `solution.groups.${groupIndex}.items.${itemIndex}`,
            label: `Група ${groupIndex + 1}, елемент ${itemIndex + 1} още е placeholder.`,
          });
        }
      });
    });
    return warnings;
  }

  if (gameSlug === 'quiz') {
    (Array.isArray(payload.questions) ? payload.questions : []).forEach((question, questionIndex) => {
      if (looksLikePlaceholderText(question?.question)) {
        warnings.push({ key: `payload.questions.${questionIndex}.question`, label: `Въпрос ${questionIndex + 1} още е placeholder.` });
      }
      (Array.isArray(question?.options) ? question.options : []).forEach((option, optionIndex) => {
        if (looksLikePlaceholderText(option)) {
          warnings.push({
            key: `payload.questions.${questionIndex}.options.${optionIndex}`,
            label: `Въпрос ${questionIndex + 1}, отговор ${optionIndex + 1} още е placeholder.`,
          });
        }
      });
      if (looksLikePlaceholderText(question?.explanation)) {
        warnings.push({ key: `payload.questions.${questionIndex}.explanation`, label: `Обяснението на въпрос ${questionIndex + 1} още е placeholder.` });
      }
    });
  }

  return warnings;
}

export function hasGamePlaceholderContent(gameSlug, puzzle) {
  return getGamePlaceholderWarnings(gameSlug, puzzle).length > 0;
}
