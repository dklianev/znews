import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  buildQuizPointsLadder,
  calculateQuizScore,
  formatQuizPoints,
  generateQuizAudienceVotes,
  generateQuizFiftyFifty,
  generateQuizPhoneHint,
  generateQuizShareText,
  getQuizFinalPoints,
  getQuizSafetyNets,
} from '../src/utils/quizGame.js';

const SAMPLE_QUESTION = {
  question: 'Кой е правилният отговор?',
  options: ['Алфа', 'Бета', 'Гама', 'Делта'],
  correctIndex: 1,
};

describe('quizGame', () => {
  it('keeps quizGame legacy coverage green', async () => {
      assert.deepEqual(
        buildQuizPointsLadder(10),
        [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
        'quiz ladder should use the 10-question preset',
      );
    
      const customLadder = buildQuizPointsLadder(7);
      assert.equal(customLadder.length, 7, 'custom quiz ladder should match the requested count');
      assert.ok(customLadder.every((value, index, values) => index === 0 || value >= values[index - 1]), 'custom ladder should be monotonic');
    
      assert.deepEqual(getQuizSafetyNets(5), [], '5-question quiz should have no safety net');
      assert.deepEqual(getQuizSafetyNets(10), [4], '10-question quiz should keep a single safety net');
      assert.deepEqual(getQuizSafetyNets(15), [4, 9], '15-question quiz should expose both safety nets');
    
      assert.equal(formatQuizPoints(5000).endsWith(' т.'), true, 'formatted quiz points should end with the Bulgarian points label');
      assert.equal(formatQuizPoints(5000).includes('5000') || formatQuizPoints(5000).includes('5 000') || formatQuizPoints(5000).includes(`5\u00A0000`), true, 'formatted quiz points should preserve the amount value');
    
      const eliminated = generateQuizFiftyFifty(SAMPLE_QUESTION, () => 0);
      assert.equal(eliminated.size, 2, '50:50 should eliminate exactly two answers');
      assert.equal(eliminated.has(SAMPLE_QUESTION.correctIndex), false, '50:50 should never eliminate the correct answer');
    
      const votes = generateQuizAudienceVotes(SAMPLE_QUESTION, new Set([2]), () => 0.5);
      assert.equal(votes[2], 0, 'audience help should keep eliminated answers at zero');
      assert.equal(votes.reduce((sum, value) => sum + value, 0), 100, 'audience help should always total 100%');
      assert.ok(votes[SAMPLE_QUESTION.correctIndex] >= 45, 'audience help should bias toward the correct answer');
    
      const confidentHint = generateQuizPhoneHint(SAMPLE_QUESTION, () => 0);
      assert.equal(confidentHint, 'Почти сигурен съм, че правилният е B.', 'friend help should use the new confident copy');
      assert.equal(confidentHint.includes('отговор'), false, 'friend help should avoid clunky old wording');
    
      const uncertainHint = generateQuizPhoneHint(SAMPLE_QUESTION, (() => {
        const values = [0.95, 0, 0.6];
        let index = -1;
        return () => values[index += 1] ?? values[values.length - 1];
      })());
      assert.equal(/ [ACD]\.$/.test(uncertainHint), true, 'uncertain friend help should point to one of the wrong options');
      assert.equal(uncertainHint.includes('отговор'), false, 'uncertain friend help should keep the cleaner wording');
    
      const questions = [
        SAMPLE_QUESTION,
        { ...SAMPLE_QUESTION, correctIndex: 2 },
        { ...SAMPLE_QUESTION, correctIndex: 0 },
      ];
      const answers = [1, 1, 0];
      assert.equal(calculateQuizScore(answers, questions), 2, 'quiz score should count only correct answers');
    
      assert.equal(
        getQuizFinalPoints({ gameStatus: 'won', pointsLadder: [5, 10, 20], totalQ: 3, currentPoints: 10, guaranteedPoints: 5 }),
        20,
        'won quiz should pay the last ladder prize',
      );
      assert.equal(
        getQuizFinalPoints({ gameStatus: 'walkaway', pointsLadder: [5, 10, 20], totalQ: 3, currentPoints: 10, guaranteedPoints: 5 }),
        10,
        'walkaway should keep the current prize',
      );
      assert.equal(
        getQuizFinalPoints({ gameStatus: 'gameover', pointsLadder: [5, 10, 20], totalQ: 3, currentPoints: 10, guaranteedPoints: 5 }),
        5,
        'game over should return the guaranteed prize only',
      );
    
      const shareText = generateQuizShareText({
        todayStr: '2026-03-31',
        finalPoints: 2500,
        score: 2,
        totalQ: 3,
        answers,
        questions,
      });
      assert.match(shareText, /https:\/\/znews\.live\/games\/quiz$/, 'quiz share text should point to the live production domain');
      assert.match(shareText, /🟩🟥🟩/, 'quiz share text should encode the answer track');
  });
});
