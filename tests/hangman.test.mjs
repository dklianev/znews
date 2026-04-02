import { describe, it } from 'vitest';
import {
  applyHangmanReveal,
  createHangmanSlots,
  getHangmanKeyboardRows,
  isHangmanSolved,
  normalizeHangmanKeyboardInput,
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

describe('hangman', () => {
  it('keeps hangman legacy coverage green', async () => {
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
      assertDeepEqual(defaultRows[0], ['Я', 'В', 'Е', 'Р', 'Т', 'Ъ', 'У', 'И', 'О', 'П', 'Ю'], 'bg phonetic layout first row');
      assertDeepEqual(defaultRows[1], ['А', 'С', 'Д', 'Ф', 'Г', 'Х', 'Й', 'К', 'Л', 'Ш', 'Щ'], 'bg phonetic layout second row');
      assertDeepEqual(defaultRows[2], ['З', 'Ь', 'Ц', 'Ж', 'Б', 'Н', 'М', 'Ч'], 'bg phonetic layout third row');
      assert(normalizeHangmanKeyboardInput('w', 'bg', 'KeyW') === 'В', 'bg phonetic keyboard should map latin key positions to cyrillic letters');
      assert(normalizeHangmanKeyboardInput('В', 'bg', 'KeyW') === 'В', 'bg keyboard should still accept direct cyrillic input');
      assert(normalizeHangmanKeyboardInput('w', 'latin', 'KeyW') === 'W', 'latin keyboard should preserve latin input');
    
      const slots = createHangmanSlots(4);
      assertDeepEqual(slots, [null, null, null, null], 'createHangmanSlots should create null-filled slots');
      assert(!isHangmanSolved(slots), 'empty slots should not be solved');
    
      const revealed = applyHangmanReveal(slots, 'a', [0, 3, 99, -1]);
      assertDeepEqual(revealed, ['A', null, null, 'A'], 'applyHangmanReveal should fill valid positions only');
      assertDeepEqual(slots, [null, null, null, null], 'applyHangmanReveal should not mutate the source slots');
      assert(isHangmanSolved(['A', 'B']), 'fully populated slots should be solved');
  });
});
