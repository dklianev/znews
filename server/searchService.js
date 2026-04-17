import { Article, Category, Court, Event, Job, SearchQueryStat, Wanted } from './models.js';
import { buildExpandedSearchTerms, buildSearchRegex as buildSharedSearchRegex, buildSearchSuggestionText, normalizeSearchTerm } from '../shared/search.js';

function escapeRegexForPrefix(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadTextSuggestions(Model, { textSearch, regexFilter, limit, projection, sort, textSort, textScore = false } = {}) {
  const safeLimit = Math.max(1, Number(limit) || 1);
  let textItems = [];

  try {
    let query = Model.find({ $text: { $search: textSearch } });
    query = query.sort(textScore ? { score: { $meta: 'textScore' }, ...(textSort || sort || {}) } : (textSort || sort || {}));
    query = query.limit(safeLimit).select(projection || { _id: 0, __v: 0 }).lean();
    const resolved = await query;
    textItems = Array.isArray(resolved) ? resolved : [];
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    const code = Number(error?.code);
    const isTextIndexError = code === 27
      || message.includes('text index required')
      || message.includes('text index not found');
    if (!isTextIndexError) throw error;
  }

  if (textItems.length >= safeLimit) return textItems.slice(0, safeLimit);

  const seen = new Set(textItems.map((item) => JSON.stringify(item?.id ?? item?.title ?? item?.name ?? item?.displayQuery)));
  const fallbackItems = await Model.find(regexFilter)
    .sort(sort || {})
    .limit(Math.max(safeLimit * 2, safeLimit + 4))
    .select(projection || { _id: 0, __v: 0 })
    .lean();

  const merged = [...textItems];
  for (const item of fallbackItems) {
    const key = JSON.stringify(item?.id ?? item?.title ?? item?.name ?? item?.displayQuery);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= safeLimit) break;
  }

  return merged;
}

export function buildSearchTermSet(query) {
  return buildExpandedSearchTerms(query, { maxTerms: 12 });
}

export function buildSearchRegex(query) {
  return buildSharedSearchRegex(query, { maxTerms: 12, maxFuzzyPatterns: 24 });
}

export async function recordSearchQuery(query) {
  const normalizedQuery = normalizeSearchTerm(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return null;

  return SearchQueryStat.findOneAndUpdate(
    { normalizedQuery },
    {
      $set: { displayQuery: String(query || '').trim() || normalizedQuery, lastSearchedAt: new Date() },
      $inc: { count: 1 },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

export async function getTrendingSearches(limit = 8) {
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8));
  const items = await SearchQueryStat.find({ count: { $gt: 0 } })
    .sort({ count: -1, lastSearchedAt: -1 })
    .limit(safeLimit)
    .select({ _id: 0, __v: 0, normalizedQuery: 0 })
    .lean();

  return (Array.isArray(items) ? items : []).map((item) => ({
    query: item.displayQuery,
    count: Number(item.count) || 0,
    lastSearchedAt: item.lastSearchedAt || null,
  }));
}

function toSuggestion(label, type, meta = {}) {
  return {
    label: String(label || '').trim(),
    type,
    ...meta,
  };
}

export async function getSearchSuggestions(query, { limit = 8 } = {}) {
  const normalizedQuery = normalizeSearchTerm(query);
  if (!normalizedQuery) return [];

  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 8));
  const regex = buildSearchRegex(query);
  if (!regex) return [];
  const prefixRegex = new RegExp(`^${escapeRegexForPrefix(normalizedQuery)}`);

  const [articleMatches, categoryMatches, trendingMatches, jobMatches, courtMatches, eventMatches, wantedMatches] = await Promise.all([
    loadTextSuggestions(Article, {
      textSearch: normalizedQuery,
      regexFilter: { status: 'published', $or: [{ titleSearch: prefixRegex }, { tagsSearch: prefixRegex }, { title: regex }, { tags: regex }] },
      limit: safeLimit,
      projection: { _id: 0, id: 1, title: 1 },
      sort: { publishAtDate: -1, publishAt: -1, id: -1 },
      textSort: { publishAtDate: -1, publishAt: -1, id: -1 },
      textScore: true,
    }),
    loadTextSuggestions(Category, {
      textSearch: normalizedQuery,
      regexFilter: { $or: [{ nameSearch: prefixRegex }, { idSearch: prefixRegex }, { name: regex }, { id: regex }] },
      limit: 4,
      projection: { _id: 0, id: 1, name: 1 },
      sort: { name: 1 },
      textSort: { name: 1 },
      textScore: true,
    }),
    SearchQueryStat.find({ $or: [{ normalizedQuery: prefixRegex }, { displayQuery: regex }] })
      .sort({ count: -1, lastSearchedAt: -1 })
      .limit(4)
      .select({ _id: 0, displayQuery: 1, count: 1 })
      .lean(),
    loadTextSuggestions(Job, {
      textSearch: normalizedQuery,
      regexFilter: { $or: [{ titleSearch: prefixRegex }, { orgSearch: prefixRegex }, { title: regex }, { org: regex }] },
      limit: 3,
      projection: { _id: 0, id: 1, title: 1 },
      sort: { id: -1 },
      textSort: { id: -1 },
      textScore: true,
    }),
    loadTextSuggestions(Court, {
      textSearch: normalizedQuery,
      regexFilter: { $or: [{ titleSearch: prefixRegex }, { defendantSearch: prefixRegex }, { title: regex }, { defendant: regex }] },
      limit: 2,
      projection: { _id: 0, id: 1, title: 1 },
      sort: { id: -1 },
      textSort: { id: -1 },
      textScore: true,
    }),
    loadTextSuggestions(Event, {
      textSearch: normalizedQuery,
      regexFilter: { $or: [{ titleSearch: prefixRegex }, { locationSearch: prefixRegex }, { title: regex }, { location: regex }] },
      limit: 2,
      projection: { _id: 0, id: 1, title: 1 },
      sort: { id: -1 },
      textSort: { id: -1 },
      textScore: true,
    }),
    loadTextSuggestions(Wanted, {
      textSearch: normalizedQuery,
      regexFilter: { $or: [{ nameSearch: prefixRegex }, { chargeSearch: prefixRegex }, { name: regex }, { charge: regex }] },
      limit: 2,
      projection: { _id: 0, id: 1, name: 1 },
      sort: { id: -1 },
      textSort: { id: -1 },
      textScore: true,
    }),
  ]);

  const suggestions = [
    ...articleMatches.map((item) => toSuggestion(item.title, 'articles', { articleId: item.id })),
    ...categoryMatches.map((item) => toSuggestion(item.name, 'category', { categoryId: item.id })),
    ...jobMatches.map((item) => toSuggestion(item.title, 'jobs', { jobId: item.id })),
    ...courtMatches.map((item) => toSuggestion(item.title, 'court', { courtId: item.id })),
    ...eventMatches.map((item) => toSuggestion(item.title, 'events', { eventId: item.id })),
    ...wantedMatches.map((item) => toSuggestion(item.name, 'wanted', { wantedId: item.id })),
    ...trendingMatches.map((item) => toSuggestion(item.displayQuery, 'trending', { count: item.count })),
  ].filter((item) => item.label);

  const deduped = [];
  const seen = new Set();
  for (const item of suggestions) {
    const key = buildSearchSuggestionText(item.label, item.type);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= safeLimit) break;
  }

  return deduped;
}
