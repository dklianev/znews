import { describe, expect, it } from 'vitest';

import {
  buildExpandedSearchTerms,
  buildSearchRegex,
  buildSearchSuggestionText,
  createFuzzySearchPatterns,
  expandSearchTerms,
  filterSearchResultsByType,
  matchesSearchFields,
  matchesSearchText,
  normalizeSearchTerm,
  normalizeSearchType,
  tokenizeSearchQuery,
} from '../../shared/search.js';

describe('search utils', () => {
  it('normalizes queries and keeps valid search types', () => {
    expect(normalizeSearchTerm('  работа!!! ')).toBe('работа');
    expect(normalizeSearchType('jobs')).toBe('jobs');
    expect(normalizeSearchType('unknown')).toBe('all');
  });

  it('tokenizes and expands search synonyms', () => {
    expect(tokenizeSearchQuery('  съд   дело  ')).toEqual(['съд', 'дело']);
    expect(expandSearchTerms('работа')).toEqual(expect.arrayContaining(['jobs', 'позиция']));
    expect(buildExpandedSearchTerms('извънредно')).toEqual(expect.arrayContaining(['извънредно', 'breaking']));
  });

  it('builds fuzzy patterns and tolerant regex matches', () => {
    expect(createFuzzySearchPatterns('полицай')).not.toHaveLength(0);

    const regex = buildSearchRegex('патрул');
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.test('патрулл')).toBe(true);
    expect(matchesSearchText('извънредна новина', 'извънредна')).toBe(true);
    expect(matchesSearchFields(['криминални хроники', 'подземен свят'], 'криминални')).toBe(true);
  });

  it('builds stable suggestion keys and filters result payloads by type', () => {
    expect(buildSearchSuggestionText(' съд ', 'court')).toBe('съд::court');

    const filteredJobs = filterSearchResultsByType({
      articles: [{ id: 1 }],
      jobs: [{ id: 2 }],
      court: [{ id: 3 }],
      events: [{ id: 4 }],
      wanted: [{ id: 5 }],
    }, 'jobs');
    expect(filteredJobs).toEqual({
      articles: [],
      jobs: [{ id: 2 }],
      court: [],
      events: [],
      wanted: [],
    });

    const filteredAll = filterSearchResultsByType({
      articles: [{ id: 1 }],
      jobs: [{ id: 2 }],
      court: [],
      events: [],
      wanted: [],
    }, 'all');
    expect(filteredAll.articles).toHaveLength(1);
    expect(filteredAll.jobs).toHaveLength(1);
  });
});
