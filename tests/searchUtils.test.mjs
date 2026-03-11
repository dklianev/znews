import { buildSearchSuggestionText, expandSearchTerms, filterSearchResultsByType, normalizeSearchTerm, normalizeSearchType, tokenizeSearchQuery } from '../shared/search.js';

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

  const filteredJobs = filterSearchResultsByType({
    articles: [{ id: 1 }],
    jobs: [{ id: 2 }],
    court: [{ id: 3 }],
    events: [{ id: 4 }],
    wanted: [{ id: 5 }],
  }, 'jobs');
  assert(filteredJobs.articles.length === 0 && filteredJobs.jobs.length === 1 && filteredJobs.court.length === 0, 'filterSearchResultsByType applies type filter');

  const filteredAll = filterSearchResultsByType({
    articles: [{ id: 1 }],
    jobs: [{ id: 2 }],
    court: [],
    events: [],
    wanted: [],
  }, 'all');
  assert(filteredAll.articles.length === 1 && filteredAll.jobs.length === 1, 'filterSearchResultsByType keeps all results for all');
}