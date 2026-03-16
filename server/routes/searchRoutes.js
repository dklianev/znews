import { asyncHandler } from '../services/expressAsyncService.js';

export function registerSearchRoutes(app, deps) {
  const {
    Article,
    Court,
    Event,
    Job,
    Wanted,
    HOMEPAGE_DEFAULT_ARTICLE_PROJECTION,
    buildArticleProjection,
    buildSearchRegex,
    cacheMiddleware,
    decodeTokenFromRequest,
    escapeRegexForSearch,
    filterSearchResultsByType,
    getPublishedFilter,
    getSearchSuggestions,
    getTrendingSearches,
    hasPermissionForSection,
    normalizeSearchType,
    normalizeText,
    parsePositiveInt,
    recordSearchQuery,
    searchCollectionByTextAndRegex,
    sortArticlesByRecency,
    stripDocumentList,
  } = deps;

  app.get('/api/search', cacheMiddleware, asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    const q = normalizeText(req.query.q, 160);
    const trimmedQuery = q.trim();
    const searchType = normalizeSearchType(req.query.type);
    if (!trimmedQuery) {
      return res.json({
        query: '',
        type: searchType,
        tookMs: 0,
        articles: [],
        jobs: [],
        court: [],
        events: [],
        wanted: [],
      });
    }

    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const articleBaseFilter = canSeeDrafts ? {} : getPublishedFilter();
    const articleLimit = parsePositiveInt(req.query.articleLimit, 24, { min: 1, max: 80 });
    const sectionLimit = parsePositiveInt(req.query.sectionLimit, 12, { min: 1, max: 40 });
    const articleFieldsProjection = buildArticleProjection(req.query.fields) || HOMEPAGE_DEFAULT_ARTICLE_PROJECTION;

    const regex = buildSearchRegex(trimmedQuery) || new RegExp(escapeRegexForSearch(trimmedQuery), 'i');
    const articleRegexFilter = Object.keys(articleBaseFilter).length > 0
      ? {
        $and: [
          articleBaseFilter,
          {
            $or: [{ title: regex }, { excerpt: regex }, { tags: regex }, { category: regex }],
          },
        ],
      }
      : { $or: [{ title: regex }, { excerpt: regex }, { tags: regex }, { category: regex }] };

    void recordSearchQuery(trimmedQuery).catch(() => {});

    const [articleMatches, jobMatches, courtMatches, eventMatches, wantedMatches] = await Promise.all([
      (async () => {
        const items = await searchCollectionByTextAndRegex(Article, {
          textSearch: trimmedQuery,
          regexFilter: articleRegexFilter,
          limit: articleLimit,
          projection: articleFieldsProjection,
          textSortField: 'publishAt',
        });
        return sortArticlesByRecency(stripDocumentList(items));
      })(),
      searchCollectionByTextAndRegex(Job, {
        textSearch: trimmedQuery,
        regexFilter: { $or: [{ title: regex }, { org: regex }, { description: regex }] },
        limit: sectionLimit,
        projection: { _id: 0, __v: 0 },
      }),
      searchCollectionByTextAndRegex(Court, {
        textSearch: trimmedQuery,
        regexFilter: { $or: [{ title: regex }, { details: regex }, { defendant: regex }, { charge: regex }] },
        limit: sectionLimit,
        projection: { _id: 0, __v: 0 },
      }),
      searchCollectionByTextAndRegex(Event, {
        textSearch: trimmedQuery,
        regexFilter: { $or: [{ title: regex }, { description: regex }, { location: regex }] },
        limit: sectionLimit,
        projection: { _id: 0, __v: 0 },
      }),
      searchCollectionByTextAndRegex(Wanted, {
        textSearch: trimmedQuery,
        regexFilter: { $or: [{ name: regex }, { charge: regex }] },
        limit: sectionLimit,
        projection: { _id: 0, __v: 0 },
      }),
    ]);

    const payload = filterSearchResultsByType({
      articles: Array.isArray(articleMatches) ? articleMatches : [],
      jobs: Array.isArray(jobMatches) ? jobMatches : [],
      court: Array.isArray(courtMatches) ? courtMatches : [],
      events: Array.isArray(eventMatches) ? eventMatches : [],
      wanted: Array.isArray(wantedMatches) ? wantedMatches : [],
    }, searchType);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      query: trimmedQuery,
      type: searchType,
      tookMs: Math.max(0, Date.now() - startedAt),
      ...payload,
    });
  }));

  app.get('/api/search/suggest', cacheMiddleware, asyncHandler(async (req, res) => {
    const q = normalizeText(req.query.q, 120).trim();
    const limit = parsePositiveInt(req.query.limit, 8, { min: 1, max: 20 });
    if (!q) {
      return res.json({ query: '', suggestions: [] });
    }

    const suggestions = await getSearchSuggestions(q, { limit });
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.json({ query: q, suggestions });
  }));

  app.get('/api/search/trending', cacheMiddleware, asyncHandler(async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 8, { min: 1, max: 20 });
    const items = await getTrendingSearches(limit);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({ items });
  }));
}
