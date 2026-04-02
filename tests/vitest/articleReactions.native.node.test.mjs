import { describe, expect, it } from 'vitest';

import {
  EMPTY_ARTICLE_REACTIONS,
  areArticleReactionCountsEqual,
  buildArticleReactionCounts,
  buildArticleReactionState,
  normalizeArticleReactionsInput,
} from '../../src/utils/articleReactions.js';

describe('articleReactions helpers', () => {
  it('reuses the shared empty reactions object for missing input', () => {
    const firstMissing = normalizeArticleReactionsInput(undefined);
    const secondMissing = normalizeArticleReactionsInput(undefined);

    expect(firstMissing).toBe(EMPTY_ARTICLE_REACTIONS);
    expect(secondMissing).toBe(EMPTY_ARTICLE_REACTIONS);
    expect(firstMissing).toBe(secondMissing);
  });

  it('normalizes missing reactions into empty counters', () => {
    expect(buildArticleReactionCounts(undefined)).toEqual({
      fire: 0,
      shock: 0,
      laugh: 0,
      skull: 0,
      clap: 0,
    });
  });

  it('coerces reaction state to booleans', () => {
    expect(buildArticleReactionState({ fire: 1, clap: true })).toEqual({
      fire: true,
      shock: false,
      laugh: false,
      skull: false,
      clap: true,
    });
  });

  it('compares reaction counters safely', () => {
    expect(
      areArticleReactionCountsEqual(
        { fire: 1, shock: 0, laugh: 0, skull: 0, clap: 0 },
        { fire: 1, shock: 0, laugh: 0, skull: 0, clap: 0 },
      ),
    ).toBe(true);

    expect(
      areArticleReactionCountsEqual(
        { fire: 1, shock: 0, laugh: 0, skull: 0, clap: 0 },
        { fire: 0, shock: 0, laugh: 0, skull: 0, clap: 0 },
      ),
    ).toBe(false);
  });
});
