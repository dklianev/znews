import assert from 'node:assert/strict';
import {
  EMPTY_ARTICLE_REACTIONS,
  areArticleReactionCountsEqual,
  buildArticleReactionCounts,
  buildArticleReactionState,
  normalizeArticleReactionsInput,
} from '../src/utils/articleReactions.js';

export function runArticleReactionsTests() {
  const firstMissing = normalizeArticleReactionsInput(undefined);
  const secondMissing = normalizeArticleReactionsInput(undefined);

  assert.equal(firstMissing, EMPTY_ARTICLE_REACTIONS, 'missing reactions should reuse the shared empty object');
  assert.equal(secondMissing, EMPTY_ARTICLE_REACTIONS, 'subsequent missing reactions should stay reference-stable');
  assert.equal(firstMissing, secondMissing, 'missing reactions normalization should be stable across renders');

  assert.deepEqual(
    buildArticleReactionCounts(undefined),
    { fire: 0, shock: 0, laugh: 0, skull: 0, clap: 0 },
    'missing reactions should normalize to empty reaction counters',
  );

  assert.deepEqual(
    buildArticleReactionState({ fire: 1, clap: true }),
    { fire: true, shock: false, laugh: false, skull: false, clap: true },
    'reaction state should coerce truthy values into booleans',
  );

  assert.equal(
    areArticleReactionCountsEqual(
      { fire: 1, shock: 0, laugh: 0, skull: 0, clap: 0 },
      { fire: 1, shock: 0, laugh: 0, skull: 0, clap: 0 },
    ),
    true,
    'equal reaction counters should compare as equal',
  );

  assert.equal(
    areArticleReactionCountsEqual(
      { fire: 1, shock: 0, laugh: 0, skull: 0, clap: 0 },
      { fire: 0, shock: 0, laugh: 0, skull: 0, clap: 0 },
    ),
    false,
    'different reaction counters should compare as different',
  );
}
