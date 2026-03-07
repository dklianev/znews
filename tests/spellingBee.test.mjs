import {
  analyzeSpellingBeeWords,
  getSpellingBeeRank,
  getSpellingBeeWordScore,
  getSpellingBeeWordValidation,
  hasCompleteSpellingBeeHive,
  normalizeSpellingBeeLetter,
  normalizeSpellingBeeOuterLetters,
  normalizeSpellingBeeWord,
  normalizeSpellingBeeWords,
} from '../shared/spellingBee.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, label + ': expected ' + expectedJson + ', received ' + actualJson);
}

export function runSpellingBeeTests() {
  const config = {
    centerLetter: 'A',
    outerLetters: ['P', 'R', 'E', 'N', 'T', 'L'],
    minWordLength: 4,
  };

  assert(normalizeSpellingBeeLetter(' a ') === 'A', 'normalizeSpellingBeeLetter should trim and uppercase a single letter');
  assert(normalizeSpellingBeeLetter('!') === '', 'normalizeSpellingBeeLetter should reject punctuation');
  assertDeepEqual(normalizeSpellingBeeOuterLetters('p, r e n t l'), ['P', 'R', 'E', 'N', 'T', 'L'], 'normalizeSpellingBeeOuterLetters should split string inputs');
  assert(normalizeSpellingBeeWord(' parental ') === 'PARENTAL', 'normalizeSpellingBeeWord should normalize bee words');
  assert(normalizeSpellingBeeWord('para-ntal') === '', 'normalizeSpellingBeeWord should reject punctuation');
  assertDeepEqual(normalizeSpellingBeeWords(['pear', 'PEAR', 'planet', '']), ['PEAR', 'PLANET'], 'normalizeSpellingBeeWords should dedupe and sort valid entries');
  assert(hasCompleteSpellingBeeHive(config.centerLetter, config.outerLetters), 'hasCompleteSpellingBeeHive should require seven unique letters');
  assert(!hasCompleteSpellingBeeHive('A', ['A', 'R', 'E', 'N', 'T', 'L']), 'hasCompleteSpellingBeeHive should reject duplicate hive letters');

  const shortWord = getSpellingBeeWordValidation('ape', config);
  assert(shortWord.reason === 'too-short', 'short bee words should be rejected');

  const missingCenter = getSpellingBeeWordValidation('PEEL', config);
  assert(missingCenter.reason === 'missing-center', 'bee words must include the center letter');

  const invalidLetter = getSpellingBeeWordValidation('BARN', config);
  assert(invalidLetter.reason === 'invalid-letter', 'bee words may only use hive letters');

  const pangram = getSpellingBeeWordValidation('PARENTAL', config);
  assert(pangram.isValid && pangram.isPangram, 'PARENTAL should be a valid pangram');
  assert(getSpellingBeeWordScore('PEAR', config) === 1, '4-letter bee words should score 1 point');
  assert(getSpellingBeeWordScore('PLANET', config) === 6, 'longer bee words should score their length');
  assert(getSpellingBeeWordScore('PARENTAL', config) === 15, 'pangrams should add the bonus score');

  const analysis = analyzeSpellingBeeWords(['pear', 'planet', 'parental', 'peel', 'barn'], config);
  assertDeepEqual(analysis.acceptedWords, ['PARENTAL', 'PEAR', 'PLANET'], 'analyzeSpellingBeeWords should keep only valid accepted words');
  assertDeepEqual(analysis.rejectedWords, [
    { word: 'BARN', reason: 'invalid-letter' },
    { word: 'PEEL', reason: 'missing-center' },
  ], 'analyzeSpellingBeeWords should expose rejected words and reasons');
  assertDeepEqual(analysis.pangrams, ['PARENTAL'], 'analyzeSpellingBeeWords should track pangrams');
  assert(analysis.maxScore === 22, 'analyzeSpellingBeeWords should total the max score');

  const rank = getSpellingBeeRank(22, 22);
  assert(rank.key === 'genius', 'getSpellingBeeRank should promote full score to genius');
}
