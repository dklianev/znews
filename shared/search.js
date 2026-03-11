export const SEARCH_TYPES = Object.freeze(['all', 'articles', 'jobs', 'court', 'events', 'wanted']);

const SEARCH_SYNONYM_GROUPS = [
  ['job', 'jobs', 'работа', 'кариера', 'позиция', 'обява'],
  ['court', 'съд', 'дело', 'присъда'],
  ['event', 'events', 'събитие', 'събития'],
  ['wanted', 'издирван', 'издирвани', 'беглец'],
  ['crime', 'криминално', 'престъпление', 'скандал'],
  ['breaking', 'горещо', 'спешно', 'извънредно'],
  ['gallery', 'галерия', 'снимки', 'кадри'],
  ['games', 'игри', 'пъзели', 'crossword', 'sudoku'],
];

export function normalizeSearchTerm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSearchQuery(value) {
  return normalizeSearchTerm(value).split(' ').filter(Boolean);
}

export function expandSearchTerms(value) {
  const tokens = tokenizeSearchQuery(value);
  const expanded = new Set(tokens);

  tokens.forEach((token) => {
    SEARCH_SYNONYM_GROUPS.forEach((group) => {
      if (!group.includes(token)) return;
      group.forEach((variant) => expanded.add(variant));
    });
  });

  return [...expanded];
}

export function buildSearchSuggestionText(value, type = '') {
  const normalized = normalizeSearchTerm(value);
  if (!normalized) return '';
  return type ? `${normalized}::${type}` : normalized;
}

export function normalizeSearchType(value) {
  const normalized = normalizeSearchTerm(value);
  return SEARCH_TYPES.includes(normalized) ? normalized : 'all';
}
