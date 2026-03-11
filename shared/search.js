export const SEARCH_TYPES = Object.freeze(['all', 'articles', 'jobs', 'court', 'events', 'wanted']);
export const SEARCH_RESULT_TYPES = Object.freeze(['articles', 'jobs', 'court', 'events', 'wanted']);
const MIN_FUZZY_TERM_LENGTH = 5;
const MAX_FUZZY_TERM_LENGTH = 24;
const FUZZY_WILDCARD_PATTERN = '[^\\s]';
const DEFAULT_MAX_FUZZY_PATTERNS = 24;

const SEARCH_SYNONYM_GROUPS = [
  ['job', 'jobs', 'работа', 'работи', 'кариера', 'позиция', 'позиции', 'обява', 'обяви'],
  ['court', 'съд', 'дело', 'дела', 'присъда', 'присъди', 'съдебно', 'съдебен'],
  ['event', 'events', 'събитие', 'събития', 'ивент', 'ивенти'],
  ['wanted', 'издирван', 'издирвани', 'издирване', 'беглец', 'бегълци'],
  ['crime', 'криминално', 'криминални', 'престъпление', 'престъпления', 'скандал', 'скандали'],
  ['breaking', 'горещо', 'спешно', 'спешни', 'извънредно', 'извънредни'],
  ['gallery', 'галерия', 'снимки', 'кадри', 'фото'],
  ['games', 'game', 'games', 'игра', 'игри', 'пъзел', 'пъзели', 'crossword', 'sudoku'],
];

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

export function buildExpandedSearchTerms(value, { maxTerms = 12 } = {}) {
  const normalizedQuery = normalizeSearchTerm(value);
  const expanded = expandSearchTerms(value);
  const terms = [];
  const seen = new Set();

  if (normalizedQuery) {
    terms.push(normalizedQuery);
    seen.add(normalizedQuery);
  }

  expanded.forEach((term) => {
    if (seen.has(term)) return;
    seen.add(term);
    terms.push(term);
  });

  return terms.slice(0, Math.max(1, maxTerms));
}

export function createFuzzySearchPatterns(value, { maxPatterns = DEFAULT_MAX_FUZZY_PATTERNS } = {}) {
  const token = normalizeSearchTerm(value);
  if (!token || token.length < MIN_FUZZY_TERM_LENGTH || token.length > MAX_FUZZY_TERM_LENGTH) return [];

  const chars = [...token];
  const escapedChars = chars.map((char) => escapeRegex(char));
  const patterns = [];
  const seen = new Set();
  const addPattern = (pattern) => {
    if (!pattern || seen.has(pattern)) return;
    seen.add(pattern);
    patterns.push(pattern);
  };

  for (let index = 0; index < escapedChars.length; index += 1) {
    const variant = escapedChars
      .map((char, charIndex) => (charIndex === index ? FUZZY_WILDCARD_PATTERN : char))
      .join('');
    addPattern(variant);
    if (patterns.length >= maxPatterns) return patterns;
  }

  for (let index = 0; index <= escapedChars.length; index += 1) {
    const variant = `${escapedChars.slice(0, index).join('')}${FUZZY_WILDCARD_PATTERN}?${escapedChars.slice(index).join('')}`;
    addPattern(variant);
    if (patterns.length >= maxPatterns) return patterns;
  }

  for (let index = 0; index < escapedChars.length; index += 1) {
    const variant = escapedChars.filter((_, charIndex) => charIndex !== index).join('');
    addPattern(variant);
    if (patterns.length >= maxPatterns) return patterns;
  }

  for (let index = 0; index < chars.length - 1; index += 1) {
    const swapped = [...chars];
    [swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]];
    addPattern(swapped.map((char) => escapeRegex(char)).join(''));
    if (patterns.length >= maxPatterns) return patterns;
  }

  return patterns;
}

export function buildSearchRegex(value, {
  maxTerms = 12,
  maxFuzzyPatterns = DEFAULT_MAX_FUZZY_PATTERNS,
} = {}) {
  const tokens = tokenizeSearchQuery(value);
  const exactTerms = buildExpandedSearchTerms(value, { maxTerms });
  const fuzzyBudgetPerToken = tokens.length > 0
    ? Math.max(6, Math.floor(maxFuzzyPatterns / tokens.length))
    : maxFuzzyPatterns;
  const fuzzyPatterns = tokens
    .flatMap((token) => createFuzzySearchPatterns(token, { maxPatterns: fuzzyBudgetPerToken }))
    .slice(0, maxFuzzyPatterns);

  const patterns = [...new Set([
    ...exactTerms.map((term) => escapeRegex(term)),
    ...fuzzyPatterns,
  ])];

  if (patterns.length === 0) return null;
  return new RegExp(patterns.join('|'), 'iu');
}

export function matchesSearchText(value, queryOrRegex) {
  const normalizedValue = normalizeSearchTerm(value);
  if (!normalizedValue) return false;
  const regex = queryOrRegex instanceof RegExp ? queryOrRegex : buildSearchRegex(queryOrRegex);
  return regex ? regex.test(normalizedValue) : false;
}

export function matchesSearchFields(values, queryOrRegex) {
  return (Array.isArray(values) ? values : [values]).some((value) => matchesSearchText(value, queryOrRegex));
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

export function filterSearchResultsByType(payload, type) {
  const normalizedType = normalizeSearchType(type);
  const basePayload = Object.fromEntries(
    SEARCH_RESULT_TYPES.map((key) => [key, Array.isArray(payload?.[key]) ? payload[key] : []])
  );

  if (normalizedType === 'all') return basePayload;

  return Object.fromEntries(
    SEARCH_RESULT_TYPES.map((key) => [key, key === normalizedType ? basePayload[key] : []])
  );
}
