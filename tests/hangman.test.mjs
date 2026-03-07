import {
  applyHangmanReveal,
  createHangmanSlots,
  getHangmanKeyboardRows,
  isHangmanSolved,
  normalizeHangmanLetter,
} from '../src/utils/hangman.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${label}: expected ${expectedJson}, received ${actualJson}`);
}

export function runHangmanTests() {
  assert(normalizeHangmanLetter(' a ') === 'A', 'normalizeHangmanLetter should trim and uppercase letters');
  assert(normalizeHangmanLetter('7') === '7', 'normalizeHangmanLetter should allow digits');
  assert(normalizeHangmanLetter('!') === '', 'normalizeHangmanLetter should reject punctuation');

  const latinRows = getHangmanKeyboardRows('latin');
  assertDeepEqual(latinRows[0], ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], 'latin layout first row');

  const customRows = getHangmanKeyboardRows([[' a ', 'b', '!'], 'c d']);
  assertDeepEqual(customRows, [['A', 'B'], ['C', 'D']], 'custom keyboard layout should normalize rows');

  const defaultRows = getHangmanKeyboardRows('bg');
  assert(defaultRows.length === 3, 'default hangman keyboard should contain three rows');
  assert(defaultRows.every((row) => Array.isArray(row) && row.length > 0), 'default hangman keyboard rows should not be empty');

  const slots = createHangmanSlots(4);
  assertDeepEqual(slots, [null, null, null, null], 'createHangmanSlots should create null-filled slots');
  assert(!isHangmanSolved(slots), 'empty slots should not be solved');

  const revealed = applyHangmanReveal(slots, 'a', [0, 3, 99, -1]);
  assertDeepEqual(revealed, ['A', null, null, 'A'], 'applyHangmanReveal should fill valid positions only');
  assertDeepEqual(slots, [null, null, null, null], 'applyHangmanReveal should not mutate the source slots');
  assert(isHangmanSolved(['A', 'B']), 'fully populated slots should be solved');
}
