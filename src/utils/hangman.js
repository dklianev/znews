const BG_KEYBOARD_ROWS = Object.freeze([
  ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'Й'],
  ['К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У'],
  ['Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ь', 'Ю', 'Я'],
]);

const LATIN_KEYBOARD_ROWS = Object.freeze([
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]);

const LETTER_PATTERN = /^[\p{L}\p{N}]$/u;

export function normalizeHangmanLetter(value) {
  const trimmed = String(value || '').trim().toUpperCase();
  if (!trimmed) return '';
  const first = Array.from(trimmed)[0] || '';
  return LETTER_PATTERN.test(first) ? first : '';
}

export function getHangmanKeyboardRows(layout) {
  if (Array.isArray(layout)) {
    return layout
      .map((row) => (Array.isArray(row) ? row : String(row || '').split(/\s+/)))
      .map((row) => row.map((char) => normalizeHangmanLetter(char)).filter(Boolean))
      .filter((row) => row.length > 0);
  }

  const normalized = String(layout || 'bg').trim().toLowerCase();
  if (normalized === 'latin' || normalized === 'en') return LATIN_KEYBOARD_ROWS;
  return BG_KEYBOARD_ROWS;
}

export function createHangmanSlots(answerLength) {
  return Array.from({ length: Math.max(0, Number.parseInt(answerLength, 10) || 0) }, () => null);
}

export function applyHangmanReveal(slots, letter, positions) {
  const next = Array.isArray(slots) ? [...slots] : [];
  const normalizedLetter = normalizeHangmanLetter(letter);
  (Array.isArray(positions) ? positions : []).forEach((position) => {
    const index = Number.parseInt(position, 10);
    if (!Number.isInteger(index) || index < 0 || index >= next.length) return;
    next[index] = normalizedLetter || next[index] || null;
  });
  return next;
}

export function isHangmanSolved(slots) {
  return Array.isArray(slots) && slots.length > 0 && slots.every(Boolean);
}
