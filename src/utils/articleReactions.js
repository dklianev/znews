export const ARTICLE_REACTION_KEYS = Object.freeze(['fire', 'shock', 'laugh', 'skull', 'clap']);

export const EMPTY_ARTICLE_REACTIONS = Object.freeze({});

export function normalizeArticleReactionsInput(reactions) {
  return reactions && typeof reactions === 'object' ? reactions : EMPTY_ARTICLE_REACTIONS;
}

export function buildArticleReactionCounts(reactions) {
  const safeReactions = normalizeArticleReactionsInput(reactions);
  return {
    fire: safeReactions.fire || 0,
    shock: safeReactions.shock || 0,
    laugh: safeReactions.laugh || 0,
    skull: safeReactions.skull || 0,
    clap: safeReactions.clap || 0,
  };
}

export function buildArticleReactionState(value) {
  const safeValue = normalizeArticleReactionsInput(value);
  return {
    fire: Boolean(safeValue.fire),
    shock: Boolean(safeValue.shock),
    laugh: Boolean(safeValue.laugh),
    skull: Boolean(safeValue.skull),
    clap: Boolean(safeValue.clap),
  };
}

export function areArticleReactionCountsEqual(a, b) {
  return ARTICLE_REACTION_KEYS.every((key) => (a?.[key] || 0) === (b?.[key] || 0));
}
