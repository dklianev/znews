import { buildHomepageSectionIdPayload, buildHomepageSections } from '../../shared/homepageSelectors.js';
import { asyncHandler } from '../services/expressAsyncService.js';

const BOOTSTRAP_OPTIONAL_SECTIONS = new Set(['jobs', 'court', 'events', 'gallery']);

function parseBootstrapInclude(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return new Set();
  }

  return new Set(
    input
      .split(',')
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => BOOTSTRAP_OPTIONAL_SECTIONS.has(item))
  );
}

function isCompactPayloadRequested(input) {
  if (input === true) return true;
  const normalized = String(input || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'compact';
}

export function registerPublicFeedRoutes(app, deps) {
  const {
    Article,
    Author,
    Breaking,
    Category,
    Court,
    DEFAULT_HERO_SETTINGS,
    DEFAULT_SITE_SETTINGS,
    Event,
    Gallery,
    HeroSettings,
    HOMEPAGE_DEFAULT_ARTICLE_PROJECTION,
    HOMEPAGE_LATEST_BUFFER,
    Job,
    Poll,
    SiteSettings,
    Wanted,
    buildArticleProjection,
    cacheMiddleware,
    countLegacyPublicArticles,
    decodeTokenFromRequest,
    fetchHomepageArticleCandidates,
    findArticlesByRecency,
    findLegacyPublicArticles,
    getPublishedFilter,
    hasPermissionForSection,
    listPublicAds,
    listPublicGames,
    parseCollectionPagination,
    parsePositiveInt,
    publicError,
    serializeHeroSettings,
    serializeSiteSettings,
    stripDocumentList,
  } = deps;

  app.get('/api/homepage', cacheMiddleware, asyncHandler(async (req, res) => {
    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const articleFilter = canSeeDrafts ? {} : getPublishedFilter();
    const latestShowcaseLimit = parsePositiveInt(req.query.latestShowcaseLimit, 5, { min: 1, max: 12 });
    const latestWireLimit = parsePositiveInt(req.query.latestWireLimit, 16, { min: 0, max: 48 });
    const compactPayload = isCompactPayloadRequested(req.query.compact);
    const fieldsProjection = buildArticleProjection(req.query.fields) || HOMEPAGE_DEFAULT_ARTICLE_PROJECTION;

    const homepagePayloadFallbacks = {
      articleCandidates: [],
      totalArticles: 0,
      authors: [],
      categories: [],
      ads: [],
      breaking: [],
      siteSettings: null,
      wanted: [],
      polls: [],
      games: [],
    };

    let heroSettings = DEFAULT_HERO_SETTINGS;
    const errors = {};

    try {
      const heroDoc = await HeroSettings.findOne({ key: 'main' }).lean();
      heroSettings = serializeHeroSettings(heroDoc || DEFAULT_HERO_SETTINGS);
    } catch (error) {
      errors.heroSettings = publicError(error, 'Failed to load heroSettings');
    }

    const tasks = {
      articleCandidates: fetchHomepageArticleCandidates({
        articleFilter,
        fieldsProjection,
        heroSettings,
        latestShowcaseLimit,
        latestWireLimit,
      }),
      totalArticles: Article.countDocuments(articleFilter),
      authors: Author.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      categories: Category.find().select({ _id: 0, __v: 0 }).lean(),
      ads: listPublicAds({ compact: compactPayload }),
      breaking: Breaking.findOne().lean().then((doc) => doc?.items || []),
      siteSettings: SiteSettings.findOne({ key: 'main' }).lean().then((doc) => serializeSiteSettings(doc || DEFAULT_SITE_SETTINGS)),
      wanted: Wanted.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      polls: Poll.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      games: listPublicGames(),
    };

    const entries = Object.entries(tasks);
    const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
    const payload = {};

    settled.forEach((result, idx) => {
      const key = entries[idx][0];
      if (result.status === 'fulfilled') {
        payload[key] = result.value;
        return;
      }

      errors[key] = publicError(result.reason, 'Failed to load ' + key);
      payload[key] = homepagePayloadFallbacks[key] ?? null;
    });

    if (!Array.isArray(payload.articleCandidates)) payload.articleCandidates = [];
    if (!Array.isArray(payload.authors)) payload.authors = [];
    if (!Array.isArray(payload.categories)) payload.categories = [];
    if (!Array.isArray(payload.ads)) payload.ads = [];
    if (!Array.isArray(payload.breaking)) payload.breaking = [];
    if (!Array.isArray(payload.wanted)) payload.wanted = [];
    if (!Array.isArray(payload.polls)) payload.polls = [];
    if (!Array.isArray(payload.games)) payload.games = [];
    payload.totalArticles = Number.isInteger(payload.totalArticles) ? payload.totalArticles : 0;

    if (payload.articleCandidates.length === 0) {
      const legacyCandidates = await findLegacyPublicArticles(fieldsProjection, {
        limit: Math.min(160, Math.max(36, latestShowcaseLimit + latestWireLimit + HOMEPAGE_LATEST_BUFFER)),
      });
      if (legacyCandidates.length > 0) {
        payload.articleCandidates = legacyCandidates;
        payload.totalArticles = await countLegacyPublicArticles();
      }
    }

    payload.authors = stripDocumentList(payload.authors);
    payload.categories = stripDocumentList(payload.categories);
    payload.ads = stripDocumentList(payload.ads);
    payload.wanted = stripDocumentList(payload.wanted);
    payload.polls = stripDocumentList(payload.polls);

    const homepageSections = buildHomepageSections({
      articles: payload.articleCandidates,
      heroSettings,
      latestShowcaseLimit,
      latestWireLimit,
    });
    const articlePool = Array.isArray(homepageSections.selectedArticles) ? homepageSections.selectedArticles : [];
    const sections = buildHomepageSectionIdPayload(homepageSections);

    res.setHeader('Cache-Control', 'no-store');
    const responsePayload = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      totalArticles: payload.totalArticles,
      articlePool,
      sections,
      authors: payload.authors,
      categories: payload.categories,
      ads: payload.ads,
      breaking: payload.breaking,
      heroSettings,
      siteSettings: payload.siteSettings,
      wanted: payload.wanted,
      polls: payload.polls,
      games: payload.games,
      ...(Object.keys(errors).length ? { errors } : {}),
    };
    if (!compactPayload) responsePayload.articles = articlePool;
    return res.json(responsePayload);
  }));

  app.get('/api/bootstrap', cacheMiddleware, asyncHandler(async (req, res) => {
    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const articleFilter = canSeeDrafts ? {} : getPublishedFilter();
    const fieldsProjection = buildArticleProjection(req.query.fields);
    const compactPayload = isCompactPayloadRequested(req.query.compact);
    const includeSections = parseBootstrapInclude(req.query.include);
    const articlePagination = parseCollectionPagination(req.query, { defaultLimit: 120, maxLimit: 500 });

    const tasks = {
      articles: findArticlesByRecency(
        articleFilter,
        fieldsProjection,
        articlePagination.shouldPaginate ? articlePagination.limit : 0,
        articlePagination.shouldPaginate ? { skip: articlePagination.skip } : {}
      ),
      authors: Author.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      categories: Category.find().select({ _id: 0, __v: 0 }).lean(),
      ads: listPublicAds({ compact: compactPayload }),
      breaking: Breaking.findOne().lean().then((doc) => doc?.items || []),
      heroSettings: HeroSettings.findOne({ key: 'main' }).lean().then((doc) => serializeHeroSettings(doc || DEFAULT_HERO_SETTINGS)),
      siteSettings: SiteSettings.findOne({ key: 'main' }).lean().then((doc) => serializeSiteSettings(doc || DEFAULT_SITE_SETTINGS)),
      wanted: Wanted.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      polls: Poll.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      games: listPublicGames(),
      ...(includeSections.has('jobs') ? { jobs: Job.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean() } : {}),
      ...(includeSections.has('court') ? { court: Court.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean() } : {}),
      ...(includeSections.has('events') ? { events: Event.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean() } : {}),
      ...(includeSections.has('gallery') ? { gallery: Gallery.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean() } : {}),
      ...(articlePagination.shouldPaginate ? { articleTotal: Article.countDocuments(articleFilter) } : {}),
    };

    const entries = Object.entries(tasks);
    const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
    const payload = {};
    const errors = {};

    settled.forEach((result, idx) => {
      const key = entries[idx][0];
      if (result.status === 'fulfilled') {
        payload[key] = result.value;
        return;
      }

      errors[key] = publicError(result.reason, 'Failed to load ' + key);
      payload[key] = key === 'articleTotal' ? 0 : null;
    });

    if (!Array.isArray(payload.articles)) payload.articles = [];
    if (!Array.isArray(payload.authors)) payload.authors = [];
    if (!Array.isArray(payload.categories)) payload.categories = [];
    if (!Array.isArray(payload.ads)) payload.ads = [];
    if (!Array.isArray(payload.breaking)) payload.breaking = [];
    if (!Array.isArray(payload.wanted)) payload.wanted = [];
    if (!Array.isArray(payload.games)) payload.games = [];
    if (includeSections.has('jobs') && !Array.isArray(payload.jobs)) payload.jobs = [];
    if (includeSections.has('court') && !Array.isArray(payload.court)) payload.court = [];
    if (includeSections.has('events') && !Array.isArray(payload.events)) payload.events = [];
    if (!Array.isArray(payload.polls)) payload.polls = [];
    if (includeSections.has('gallery') && !Array.isArray(payload.gallery)) payload.gallery = [];
    if (payload.articles.length === 0) {
      const legacyArticles = await findLegacyPublicArticles(fieldsProjection, {
        limit: articlePagination.shouldPaginate ? articlePagination.limit : 0,
        skip: articlePagination.shouldPaginate ? articlePagination.skip : 0,
      });
      if (legacyArticles.length > 0) {
        payload.articles = legacyArticles;
        payload.articleTotal = await countLegacyPublicArticles();
      }
    }

    payload.authors = stripDocumentList(payload.authors);
    payload.categories = stripDocumentList(payload.categories);
    payload.ads = stripDocumentList(payload.ads);
    payload.wanted = stripDocumentList(payload.wanted);
    if (includeSections.has('jobs')) payload.jobs = stripDocumentList(payload.jobs);
    else delete payload.jobs;
    if (includeSections.has('court')) payload.court = stripDocumentList(payload.court);
    else delete payload.court;
    if (includeSections.has('events')) payload.events = stripDocumentList(payload.events);
    else delete payload.events;
    payload.polls = stripDocumentList(payload.polls);
    if (includeSections.has('gallery')) payload.gallery = stripDocumentList(payload.gallery);
    else delete payload.gallery;
    const articleTotal = Number.isInteger(payload.articleTotal) ? payload.articleTotal : 0;
    delete payload.articleTotal;

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ...payload,
      ...(articlePagination.shouldPaginate ? {
        pagination: {
          page: articlePagination.page,
          limit: articlePagination.limit,
          total: articleTotal,
          totalPages: Math.max(1, Math.ceil(articleTotal / articlePagination.limit)),
        },
      } : {}),
      ...(Object.keys(errors).length ? { errors } : {}),
    });
  }));
}
