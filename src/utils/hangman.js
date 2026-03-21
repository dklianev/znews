const BG_KEYBOARD_ROWS = Object.freeze([
  ['Я', 'В', 'Е', 'Р', 'Т', 'Ъ', 'У', 'И', 'О', 'П', 'Ю'],
  ['А', 'С', 'Д', 'Ф', 'Г', 'Х', 'Й', 'К', 'Л', 'Ш', 'Щ'],
  ['З', 'Ь', 'Ц', 'Ж', 'Б', 'Н', 'М', 'Ч'],
]);

const LATIN_KEYBOARD_ROWS = Object.freeze([
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]);

const LETTER_PATTERN = /^[\p{L}\p{N}]$/u;
const BG_KEYBOARD_SET = new Set(BG_KEYBOARD_ROWS.flat());
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

export function normalizeHangmanLetter(value) {
  const trimmed = String(value || '').trim().toUpperCase();
  if (!trimmed) return '';
  const first = Array.from(trimmed)[0] || '';
  return LETTER_PATTERN.test(first) ? first : '';
}

export function normalizeHangmanKeyboardInput(value, layout, code = '') {
  const normalizedLayout = String(layout || 'bg').trim().toLowerCase();
  const normalizedLetter = normalizeHangmanLetter(value);
  if (normalizedLayout === 'latin' || normalizedLayout === 'en') return normalizedLetter;
  if (BG_KEYBOARD_SET.has(normalizedLetter)) return normalizedLetter;
  return BG_PHONETIC_CODE_MAP[String(code || '').trim()] || '';
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
