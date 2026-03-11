import { buildSearchSuggestionText, expandSearchTerms, normalizeSearchTerm, normalizeSearchType, tokenizeSearchQuery } from '../shared/search.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function runSearchUtilsTests() {
  assert(normalizeSearchTerm('  Работа!!! ') === 'работа', 'normalizeSearchTerm strips punctuation');
  assert(normalizeSearchType('jobs') === 'jobs', 'normalizeSearchType keeps valid types');
  assert(normalizeSearchType('unknown') === 'all', 'normalizeSearchType falls back to all');

  const tokens = tokenizeSearchQuery('  Спешно   дело  ');
  assert(tokens.length === 2 && tokens[0] === 'спешно' && tokens[1] === 'дело', 'tokenizeSearchQuery splits normalized query');

  const expanded = expandSearchTerms('работа');
  assert(expanded.includes('jobs') && expanded.includes('кариера'), 'expandSearchTerms adds synonyms');

  const suggestionKey = buildSearchSuggestionText(' Съд ', 'court');
  assert(suggestionKey === 'съд::court', 'buildSearchSuggestionText builds stable dedupe key');
}
