import { sortArticlesByRecency, toNumericArticleId } from './articleRecency.js';

function dedupeArticles(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const usedIds = new Set();
  const result = [];
  items.forEach((article) => {
    const articleId = toNumericArticleId(article?.id);
    if (!articleId || usedIds.has(articleId)) return;
    usedIds.add(articleId);
    result.push(article);
  });
  return result;
}

export function buildHomepageSections(input = {}) {
  const articles = Array.isArray(input.articles) ? input.articles : [];
  const heroSettings = input.heroSettings && typeof input.heroSettings === 'object' ? input.heroSettings : null;
  const latestShowcaseLimit = Number.isFinite(Number(input.latestShowcaseLimit))
    ? Math.max(1, Number(input.latestShowcaseLimit))
    : 5;
  const latestWireLimit = Number.isFinite(Number(input.latestWireLimit))
    ? Math.max(0, Number(input.latestWireLimit))
    : 16;

  const sortedArticles = sortArticlesByRecency(articles);
  const articleById = new Map(
    sortedArticles
      .map((article) => [toNumericArticleId(article?.id), article])
      .filter(([id, article]) => id > 0 && article)
  );
  const usedIds = new Set();

  const claimArticle = (article) => {
    const articleId = toNumericArticleId(article?.id);
    if (!articleId || usedIds.has(articleId)) return false;
    usedIds.add(articleId);
    return true;
  };

  const takeFromPool = (predicate, limit) => {
    const result = [];
    if (!Number.isFinite(Number(limit)) || Number(limit) <= 0) return result;
    for (const article of sortedArticles) {
      if (result.length >= Number(limit)) break;
      if (!predicate(article)) continue;
      if (!claimArticle(article)) continue;
      result.push(article);
    }
    return result;
  };

  const heroArticle = sortedArticles.find((article) => article?.hero)
    || sortedArticles.find((article) => article?.breaking)
    || sortedArticles[0]
    || null;

  const selectedMainPhotoId = Number.parseInt(heroSettings?.mainPhotoArticleId, 10);
  const selectedMainPhotoArticle = Number.isInteger(selectedMainPhotoId) && selectedMainPhotoId > 0
    ? articleById.get(selectedMainPhotoId) || null
    : null;
  const heroPrimaryPhoto = selectedMainPhotoArticle || heroArticle;

  const selectedHeroSiblingIds = Array.isArray(heroSettings?.photoArticleIds) ? heroSettings.photoArticleIds : [];
  const selectedHeroSiblings = selectedHeroSiblingIds
    .map((id) => articleById.get(toNumericArticleId(id)) || null)
    .filter(Boolean)
    .filter((article, index, list) => (
      toNumericArticleId(article?.id) !== toNumericArticleId(heroPrimaryPhoto?.id)
      && list.findIndex((entry) => toNumericArticleId(entry?.id) === toNumericArticleId(article?.id)) === index
    ))
    .slice(0, 2);

  const autoHeroSiblings = sortedArticles
    .filter((article) => (
      toNumericArticleId(article?.id) !== toNumericArticleId(heroPrimaryPhoto?.id)
      && Boolean(article?.image)
    ))
    .slice(0, 2);

  const heroSiblings = dedupeArticles([
    ...selectedHeroSiblings,
    ...autoHeroSiblings,
  ]).slice(0, 2);

  // Reserve hero-related items before section selection to enforce global dedupe.
  claimArticle(heroArticle);
  claimArticle(heroPrimaryPhoto);
  heroSiblings.forEach((article) => claimArticle(article));

  const featuredArticles = takeFromPool((article) => Boolean(article?.featured), 3);
  const crimeArticles = takeFromPool((article) => article?.category === 'crime' || article?.category === 'underground', 4);
  const breakingArticles = takeFromPool((article) => article?.category === 'breaking', 2);
  const emergencyArticles = takeFromPool((article) => article?.category === 'emergency', 2);
  const reportageArticles = takeFromPool((article) => article?.category === 'reportage', 3);
  const sponsoredArticles = takeFromPool((article) => Boolean(article?.sponsored), 3);
  const latestRemaining = sortedArticles.filter((article) => !usedIds.has(toNumericArticleId(article?.id)));
  const latestShowcase = latestRemaining.slice(0, latestShowcaseLimit);
  const latestWire = latestRemaining.slice(latestShowcaseLimit, latestShowcaseLimit + latestWireLimit);

  const selectedArticles = dedupeArticles([
    heroArticle,
    heroPrimaryPhoto,
    ...heroSiblings,
    ...featuredArticles,
    ...crimeArticles,
    ...breakingArticles,
    ...emergencyArticles,
    ...reportageArticles,
    ...sponsoredArticles,
    ...latestShowcase,
    ...latestWire,
  ]);

  return {
    heroArticle,
    heroPrimaryPhoto,
    heroSiblings,
    featuredArticles,
    crimeArticles,
    breakingArticles,
    emergencyArticles,
    reportageArticles,
    sponsoredArticles,
    latestShowcase,
    latestWire,
    selectedArticles,
    sortedArticles,
  };
}

export function buildHomepageSectionIdPayload(sections = {}) {
  const toId = (article) => toNumericArticleId(article?.id) || null;
  const toIdList = (items) => (Array.isArray(items) ? items.map(toId).filter(Boolean) : []);

  return {
    heroArticleId: toId(sections.heroArticle),
    heroPrimaryPhotoId: toId(sections.heroPrimaryPhoto),
    heroSiblingIds: toIdList(sections.heroSiblings),
    featuredIds: toIdList(sections.featuredArticles),
    crimeIds: toIdList(sections.crimeArticles),
    breakingIds: toIdList(sections.breakingArticles),
    emergencyIds: toIdList(sections.emergencyArticles),
    reportageIds: toIdList(sections.reportageArticles),
    sponsoredIds: toIdList(sections.sponsoredArticles),
    latestShowcaseIds: toIdList(sections.latestShowcase),
    latestWireIds: toIdList(sections.latestWire),
  };
}
