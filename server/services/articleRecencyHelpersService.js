export function createArticleRecencyHelpers({
  Article,
  HOMEPAGE_LATEST_BUFFER,
  HOMEPAGE_SECTION_BUFFER,
  combineMongoFilters,
  normalizeText,
  sortArticlesByRecency,
  stripDocumentList,
}) {
  function buildArticleRecencySortExpression() {
    return {
      $ifNull: [
        '$publishAtDate',
        '$publishAt',
        {
          $dateFromString: {
            dateString: '$date',
            format: '%Y-%m-%d',
            onError: new Date(0),
            onNull: new Date(0),
          },
        },
      ],
    };
  }

  function buildArticleRecencyProjection(fieldsProjection) {
    const projection = fieldsProjection && typeof fieldsProjection === 'object'
      ? { ...fieldsProjection }
      : { _id: 0, __v: 0 };
    delete projection.__recencySortTs;
    projection._id = 0;
    const hasInclusionFields = Object.entries(projection).some(
      ([key, val]) => key !== '_id' && (val === 1 || val === true)
    );
    if (!hasInclusionFields) {
      projection.__v = 0;
    }
    return projection;
  }

  function buildArticleRecencyPipeline(filter, fieldsProjection, { skip = 0, limit = 0 } = {}) {
    const pipeline = [
      { $match: filter || {} },
      {
        $addFields: {
          __recencySortTs: buildArticleRecencySortExpression(),
        },
      },
      { $sort: { __recencySortTs: -1, id: -1 } },
    ];

    if (Number.isInteger(skip) && skip > 0) {
      pipeline.push({ $skip: skip });
    }
    if (Number.isInteger(limit) && limit > 0) {
      pipeline.push({ $limit: limit });
    }

    pipeline.push({ $project: buildArticleRecencyProjection(fieldsProjection) });

    return pipeline;
  }

  async function findArticlesByRecency(filter, fieldsProjection, limit, options = {}) {
    const pipeline = buildArticleRecencyPipeline(filter, fieldsProjection, {
      skip: options.skip,
      limit,
    });
    const items = await Article.aggregate(pipeline);
    return stripDocumentList(items);
  }

  function isLegacyPublicArticle(article, now = new Date()) {
    if (!article || typeof article !== 'object') return false;

    const status = normalizeText(article.status, 24).toLowerCase();
    if (status === 'draft' || status === 'archived') return false;

    if (article.publishAt === null || article.publishAt === undefined || article.publishAt === '') {
      return true;
    }

    const publishAtTs = new Date(article.publishAt).getTime();
    if (!Number.isFinite(publishAtTs)) {
      return true;
    }

    return publishAtTs <= now.getTime();
  }

  async function findLegacyPublicArticles(fieldsProjection, { limit = 0, skip = 0, fetchLimit = 600 } = {}) {
    let query = Article.find().sort({ id: -1 });
    if (fieldsProjection && typeof fieldsProjection === 'object') {
      query = query.select(fieldsProjection);
    } else {
      query = query.select({ _id: 0, __v: 0 });
    }

    const desired = Number.isInteger(limit) && limit > 0 ? limit : 160;
    const offset = Number.isInteger(skip) && skip > 0 ? skip : 0;
    const safeFetchLimit = Math.min(1500, Math.max(fetchLimit, offset + desired + 80));
    const items = stripDocumentList(await query.limit(safeFetchLimit).lean());
    const visible = sortArticlesByRecency(items.filter((article) => isLegacyPublicArticle(article)));

    if (offset > 0) {
      return desired > 0 ? visible.slice(offset, offset + desired) : visible.slice(offset);
    }
    return desired > 0 ? visible.slice(0, desired) : visible;
  }

  async function countLegacyPublicArticles(fetchLimit = 3000) {
    const items = await Article.find().sort({ id: -1 }).select({ _id: 0, id: 1, status: 1, publishAt: 1 }).limit(fetchLimit).lean();
    return items.filter((article) => isLegacyPublicArticle(article)).length;
  }

  async function fetchHomepageArticleCandidates({ articleFilter, fieldsProjection, heroSettings, latestShowcaseLimit, latestWireLimit }) {
    const selectedHeroIds = [...new Set([
      Number.parseInt(heroSettings?.mainPhotoArticleId, 10),
      ...(Array.isArray(heroSettings?.photoArticleIds) ? heroSettings.photoArticleIds : []).map((value) => Number.parseInt(value, 10)),
    ].filter((value) => Number.isInteger(value) && value > 0))];

    const latestLimit = Math.min(
      160,
      Math.max(36, latestShowcaseLimit + latestWireLimit + HOMEPAGE_LATEST_BUFFER)
    );

    const buildFacetBranch = (filter, limit) => {
      const branch = [];
      if (filter && typeof filter === 'object' && Object.keys(filter).length > 0) {
        branch.push({ $match: filter });
      }
      branch.push({ $sort: { __recencySortTs: -1, id: -1 } });
      if (Number.isInteger(limit) && limit > 0) {
        branch.push({ $limit: limit });
      }
      branch.push({ $project: buildArticleRecencyProjection(fieldsProjection) });
      return branch;
    };

    const [facetResult = {}] = await Article.aggregate([
      { $match: articleFilter || {} },
      { $addFields: { __recencySortTs: buildArticleRecencySortExpression() } },
      {
        $facet: {
          latest: buildFacetBranch(null, latestLimit),
          hero: buildFacetBranch({ $or: [{ hero: true }, { breaking: true }] }, 8),
          selected: selectedHeroIds.length > 0
            ? buildFacetBranch({ id: { $in: selectedHeroIds } }, selectedHeroIds.length)
            : [{ $limit: 0 }],
          featured: buildFacetBranch({ featured: true }, 3 + HOMEPAGE_SECTION_BUFFER),
          crime: buildFacetBranch({ category: { $in: ['crime', 'underground'] } }, 4 + HOMEPAGE_SECTION_BUFFER),
          breaking: buildFacetBranch({ category: 'breaking' }, 2 + HOMEPAGE_SECTION_BUFFER),
          emergency: buildFacetBranch({ category: 'emergency' }, 2 + HOMEPAGE_SECTION_BUFFER),
          reportage: buildFacetBranch({ category: 'reportage' }, 3 + HOMEPAGE_SECTION_BUFFER),
          sponsored: buildFacetBranch({ sponsored: true }, 3 + HOMEPAGE_SECTION_BUFFER),
        },
      },
    ]);

    const latest = stripDocumentList(Array.isArray(facetResult.latest) ? facetResult.latest : []);
    const hero = stripDocumentList(Array.isArray(facetResult.hero) ? facetResult.hero : []);
    const selected = stripDocumentList(Array.isArray(facetResult.selected) ? facetResult.selected : []);
    const featured = stripDocumentList(Array.isArray(facetResult.featured) ? facetResult.featured : []);
    const crime = stripDocumentList(Array.isArray(facetResult.crime) ? facetResult.crime : []);
    const breaking = stripDocumentList(Array.isArray(facetResult.breaking) ? facetResult.breaking : []);
    const emergency = stripDocumentList(Array.isArray(facetResult.emergency) ? facetResult.emergency : []);
    const reportage = stripDocumentList(Array.isArray(facetResult.reportage) ? facetResult.reportage : []);
    const sponsored = stripDocumentList(Array.isArray(facetResult.sponsored) ? facetResult.sponsored : []);

    const seen = new Set();
    const merged = [];
    [selected, hero, featured, crime, breaking, emergency, reportage, sponsored, latest].forEach((group) => {
      group.forEach((article) => {
        const articleId = Number.parseInt(article?.id, 10);
        if (!Number.isInteger(articleId) || seen.has(articleId)) return;
        seen.add(articleId);
        merged.push(article);
      });
    });

    return sortArticlesByRecency(merged);
  }

  return {
    buildArticleRecencyPipeline,
    countLegacyPublicArticles,
    fetchHomepageArticleCandidates,
    findArticlesByRecency,
    findLegacyPublicArticles,
    isLegacyPublicArticle,
  };
}
