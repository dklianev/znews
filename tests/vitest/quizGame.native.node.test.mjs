import { describe, expect, it } from 'vitest';

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
} from '../../src/utils/quizGame.js';

const sampleQuestion = {
  question: 'Test quiz question',
  options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
  correctIndex: 1,
};

describe('quizGame helpers', () => {
  it('uses the expected ladder presets and monotonic custom ladders', () => {
    expect(buildQuizPointsLadder(10)).toEqual([5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]);

    const customLadder = buildQuizPointsLadder(7);
    expect(customLadder).toHaveLength(7);
    customLadder.forEach((value, index, values) => {
      if (index > 0) expect(value).toBeGreaterThanOrEqual(values[index - 1]);
    });
  });

  it('returns the expected safety nets and points formatting', () => {
    expect(getQuizSafetyNets(5)).toEqual([]);
    expect(getQuizSafetyNets(10)).toEqual([4]);
    expect(getQuizSafetyNets(15)).toEqual([4, 9]);

    const formatted = formatQuizPoints(5000);
    expect(formatted.endsWith(' т.')).toBe(true);
    expect(/5(?:[\s\u00A0]?000|000)/.test(formatted)).toBe(true);
  });

  it('keeps fifty-fifty and audience votes aligned with the correct answer', () => {
    const eliminated = generateQuizFiftyFifty(sampleQuestion, () => 0);
    expect(eliminated.size).toBe(2);
    expect(eliminated.has(sampleQuestion.correctIndex)).toBe(false);

    const votes = generateQuizAudienceVotes(sampleQuestion, new Set([2]), () => 0.5);
    expect(votes[2]).toBe(0);
    expect(votes.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(votes[sampleQuestion.correctIndex]).toBeGreaterThanOrEqual(45);
  });

  it('generates phone hints and share text with the live domain', () => {
    const confidentHint = generateQuizPhoneHint(sampleQuestion, () => 0);
    expect(confidentHint.endsWith('B.')).toBe(true);

    const uncertainHint = generateQuizPhoneHint(sampleQuestion, (() => {
      const values = [0.95, 0, 0.6];
      let index = -1;
      return () => values[index += 1] ?? values[values.length - 1];
    })());
    expect(/ [ACD]\.$/.test(uncertainHint)).toBe(true);

    const questions = [
      sampleQuestion,
      { ...sampleQuestion, correctIndex: 2 },
      { ...sampleQuestion, correctIndex: 0 },
    ];
    const answers = [1, 1, 0];
    expect(calculateQuizScore(answers, questions)).toBe(2);

    expect(getQuizFinalPoints({
      gameStatus: 'won',
      pointsLadder: [5, 10, 20],
      totalQ: 3,
      currentPoints: 10,
      guaranteedPoints: 5,
    })).toBe(20);
    expect(getQuizFinalPoints({
      gameStatus: 'walkaway',
      pointsLadder: [5, 10, 20],
      totalQ: 3,
      currentPoints: 10,
      guaranteedPoints: 5,
    })).toBe(10);
    expect(getQuizFinalPoints({
      gameStatus: 'gameover',
      pointsLadder: [5, 10, 20],
      totalQ: 3,
      currentPoints: 10,
      guaranteedPoints: 5,
    })).toBe(5);

    const shareText = generateQuizShareText({
      todayStr: '2026-03-31',
      finalPoints: 2500,
      score: 2,
      totalQ: 3,
      answers,
      questions,
    });
    expect(shareText).toMatch(/https:\/\/znews\.live\/games\/quiz$/);
    expect(shareText).toContain('2026-03-31');
  });
});
