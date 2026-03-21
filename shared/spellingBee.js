const LETTER_PATTERN = /^\p{L}$/u;
const WORD_PATTERN = /^\p{L}+$/u;
const BG_PHONETIC_CODE_MAP = Object.freeze({
  KeyQ: 'Я',
  KeyW: 'В',
  KeyE: 'Е',
  KeyR: 'Р',
  KeyT: 'Т',
  KeyY: 'Ъ',
  KeyU: 'У',
  KeyI: 'И',
  KeyO: 'О',
  KeyP: 'П',
  BracketLeft: 'Ю',
  KeyA: 'А',
  KeyS: 'С',
  KeyD: 'Д',
  KeyF: 'Ф',
  KeyG: 'Г',
  KeyH: 'Х',
  KeyJ: 'Й',
  KeyK: 'К',
  KeyL: 'Л',
  Semicolon: 'Ш',
  Quote: 'Щ',
  KeyZ: 'З',
  KeyX: 'Ь',
  KeyC: 'Ц',
  KeyV: 'Ж',
  KeyB: 'Б',
  KeyN: 'Н',
  KeyM: 'М',
  Comma: 'Ч',
});

export const SPELLING_BEE_OUTER_LETTER_COUNT = 6;
export const SPELLING_BEE_TOTAL_LETTER_COUNT = 7;
export const SPELLING_BEE_MIN_WORD_LENGTH = 4;
export const SPELLING_BEE_MAX_WORD_LENGTH = 32;
export const SPELLING_BEE_PANGRAM_BONUS = 7;
export const SPELLING_BEE_RANKS = Object.freeze([
  { key: 'newbie', label: 'Начало', threshold: 0 },
  { key: 'warmup', label: 'Загрявка', threshold: 0.05 },
  { key: 'moving', label: 'Набираш скорост', threshold: 0.12 },
  { key: 'good', label: 'Добре', threshold: 0.22 },
  { key: 'solid', label: 'Стабилно', threshold: 0.35 },
  { key: 'strong', label: 'Силно', threshold: 0.5 },
  { key: 'brilliant', label: 'Брилянтно', threshold: 0.7 },
  { key: 'genius', label: 'Гений', threshold: 1 },
]);

function toValueList(values) {
  if (Array.isArray(values)) return values;
  return String(values || '').split(/[\s,;]+/).filter(Boolean);
}

export function normalizeSpellingBeeLetter(value) {
  const char = Array.from(String(value || '').trim().toUpperCase())[0] || '';
  return LETTER_PATTERN.test(char) ? char : '';
}

export function normalizeSpellingBeeKeyboardInput(value, code = '', allowedLetters = []) {
  const normalizedLetter = normalizeSpellingBeeLetter(value);
  const normalizedAllowedLetters = Array.isArray(allowedLetters)
    ? allowedLetters.map((letter) => normalizeSpellingBeeLetter(letter)).filter(Boolean)
    : [];

  if (normalizedAllowedLetters.length === 0) {
    return normalizedLetter || BG_PHONETIC_CODE_MAP[String(code || '').trim()] || '';
  }

  const allowedLetterSet = new Set(normalizedAllowedLetters);
  if (normalizedLetter && allowedLetterSet.has(normalizedLetter)) {
    return normalizedLetter;
  }

  const mappedLetter = BG_PHONETIC_CODE_MAP[String(code || '').trim()] || '';
  return mappedLetter && allowedLetterSet.has(mappedLetter) ? mappedLetter : '';
}

export function normalizeSpellingBeeOuterLetters(values, count = SPELLING_BEE_OUTER_LETTER_COUNT) {
  const rawValues = toValueList(values);
  return Array.from({ length: count }, (_, index) => normalizeSpellingBeeLetter(rawValues[index] || ''));
}

export function normalizeSpellingBeeWord(value, maxLength = SPELLING_BEE_MAX_WORD_LENGTH) {
  const trimmed = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!trimmed) return '';
  const chars = Array.from(trimmed);
  if (chars.length === 0 || chars.length > maxLength || !WORD_PATTERN.test(chars.join(''))) {
    return '';
  }
  return chars.join('');
}

export function normalizeSpellingBeeWords(values) {
  return [...new Set(toValueList(values).map((value) => normalizeSpellingBeeWord(value)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'bg'));
}

export function getSpellingBeeLetters(centerLetter, outerLetters) {
  const normalizedCenter = normalizeSpellingBeeLetter(centerLetter);
  const normalizedOuterLetters = normalizeSpellingBeeOuterLetters(outerLetters);
  return normalizedCenter
    ? [normalizedCenter, ...normalizedOuterLetters.filter(Boolean)]
    : normalizedOuterLetters.filter(Boolean);
}

export function hasCompleteSpellingBeeHive(centerLetter, outerLetters) {
  const normalizedCenter = normalizeSpellingBeeLetter(centerLetter);
  const normalizedOuterLetters = normalizeSpellingBeeOuterLetters(outerLetters);
  return Boolean(normalizedCenter)
    && normalizedOuterLetters.length === SPELLING_BEE_OUTER_LETTER_COUNT
    && normalizedOuterLetters.every(Boolean)
    && new Set([normalizedCenter, ...normalizedOuterLetters]).size === SPELLING_BEE_TOTAL_LETTER_COUNT;
}

export function getSpellingBeeWordValidation(word, config = {}) {
  const normalizedWord = normalizeSpellingBeeWord(word);
  const centerLetter = normalizeSpellingBeeLetter(config.centerLetter);
  const outerLetters = normalizeSpellingBeeOuterLetters(config.outerLetters);
  const minWordLength = Math.max(
    SPELLING_BEE_MIN_WORD_LENGTH,
    Number.parseInt(config.minWordLength, 10) || SPELLING_BEE_MIN_WORD_LENGTH
  );
  const charLength = Array.from(normalizedWord).length;

  if (!normalizedWord) {
    return { isValid: false, reason: 'invalid-format', normalizedWord: '', charLength: 0, isPangram: false };
  }

  if (!hasCompleteSpellingBeeHive(centerLetter, outerLetters)) {
    return { isValid: false, reason: 'invalid-hive', normalizedWord, charLength, isPangram: false };
  }

  const chars = Array.from(normalizedWord);
  const allowedLetters = new Set([centerLetter, ...outerLetters]);

  if (charLength < minWordLength) {
    return { isValid: false, reason: 'too-short', normalizedWord, charLength, isPangram: false };
  }

  if (!chars.includes(centerLetter)) {
    return { isValid: false, reason: 'missing-center', normalizedWord, charLength, isPangram: false };
  }

  if (chars.some((char) => !allowedLetters.has(char))) {
    return { isValid: false, reason: 'invalid-letter', normalizedWord, charLength, isPangram: false };
  }

  const uniqueChars = new Set(chars);
  const isPangram = [...allowedLetters].every((letter) => uniqueChars.has(letter));
  return { isValid: true, reason: 'ok', normalizedWord, charLength, isPangram };
}

export function isSpellingBeePangram(word, config = {}) {
  return getSpellingBeeWordValidation(word, config).isPangram;
}

export function getSpellingBeeWordScore(word, config = {}) {
  const validation = getSpellingBeeWordValidation(word, config);
  if (!validation.isValid) return 0;

  return (validation.charLength === SPELLING_BEE_MIN_WORD_LENGTH ? 1 : validation.charLength)
    + (validation.isPangram ? SPELLING_BEE_PANGRAM_BONUS : 0);
}

export function analyzeSpellingBeeWords(words, config = {}) {
  const normalizedWords = normalizeSpellingBeeWords(words);
  const acceptedWords = [];
  const rejectedWords = [];
  const scoreByWord = {};
  const pangrams = [];
  let maxScore = 0;
  let longestWordLength = 0;

  normalizedWords.forEach((word) => {
    const validation = getSpellingBeeWordValidation(word, config);
    if (!validation.isValid) {
      rejectedWords.push({ word, reason: validation.reason });
      return;
    }

    acceptedWords.push(validation.normalizedWord);
    const score = getSpellingBeeWordScore(validation.normalizedWord, config);
    scoreByWord[validation.normalizedWord] = score;
    maxScore += score;
    longestWordLength = Math.max(longestWordLength, validation.charLength);
    if (validation.isPangram) pangrams.push(validation.normalizedWord);
  });

  return {
    normalizedWords,
    acceptedWords,
    rejectedWords,
    scoreByWord,
    pangrams,
    totalWords: acceptedWords.length,
    pangramCount: pangrams.length,
    maxScore,
    longestWordLength,
  };
}

export function getSpellingBeeRank(score, maxScore) {
  const safeScore = Math.max(0, Number.parseInt(score, 10) || 0);
  const safeMaxScore = Math.max(0, Number.parseInt(maxScore, 10) || 0);
  if (safeMaxScore <= 0) {
    return { ...SPELLING_BEE_RANKS[0], ratio: 0 };
  }

  const ratio = Math.min(1, safeScore / safeMaxScore);
  let activeRank = SPELLING_BEE_RANKS[0];
  SPELLING_BEE_RANKS.forEach((rank) => {
    if (ratio >= rank.threshold) activeRank = rank;
  });

  return {
    ...activeRank,
    ratio,
  };
}
