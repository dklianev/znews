import { Article, Category, Court, Event, Job, SearchQueryStat, Wanted } from './models.js';
import { buildExpandedSearchTerms, buildSearchRegex as buildSharedSearchRegex, buildSearchSuggestionText, normalizeSearchTerm } from '../shared/search.js';


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

  const [articleMatches, categoryMatches, trendingMatches, jobMatches, courtMatches, eventMatches, wantedMatches] = await Promise.all([
    Article.find({ status: 'published', $or: [{ title: regex }, { tags: regex }] })
      .sort({ publishAt: -1, id: -1 })
      .limit(safeLimit)
      .select({ _id: 0, id: 1, title: 1 })
      .lean(),
    Category.find({ $or: [{ name: regex }, { id: regex }] })
      .sort({ name: 1 })
      .limit(4)
      .select({ _id: 0, id: 1, name: 1 })
      .lean(),
    SearchQueryStat.find({ displayQuery: regex })
      .sort({ count: -1, lastSearchedAt: -1 })
      .limit(4)
      .select({ _id: 0, displayQuery: 1, count: 1 })
      .lean(),
    Job.find({ $or: [{ title: regex }, { org: regex }] })
      .sort({ id: -1 })
      .limit(3)
      .select({ _id: 0, id: 1, title: 1 })
      .lean(),
    Court.find({ $or: [{ title: regex }, { defendant: regex }] })
      .sort({ id: -1 })
      .limit(2)
      .select({ _id: 0, id: 1, title: 1 })
      .lean(),
    Event.find({ $or: [{ title: regex }, { location: regex }] })
      .sort({ id: -1 })
      .limit(2)
      .select({ _id: 0, id: 1, title: 1 })
      .lean(),
    Wanted.find({ $or: [{ name: regex }, { charge: regex }] })
      .sort({ id: -1 })
      .limit(2)
      .select({ _id: 0, id: 1, name: 1 })
      .lean(),
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
