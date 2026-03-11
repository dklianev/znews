export function createArticleCollectionHelpers({
  ARTICLE_FIELD_ALLOWLIST,
  ARTICLE_SECTION_FILTERS,
  hasOwn,
  normalizeText,
  parsePositiveInt,
}) {
  function buildArticleProjection(fieldsParam) {
    if (typeof fieldsParam !== 'string' || !fieldsParam.trim()) return null;
    const fields = fieldsParam
      .split(',')
      .map((field) => normalizeText(field, 40))
      .filter(Boolean)
      .filter((field) => ARTICLE_FIELD_ALLOWLIST.has(field));

    if (fields.length === 0) return null;
    if (!fields.includes('id')) fields.unshift('id');
    return fields.reduce((acc, field) => {
      acc[field] = 1;
      return acc;
    }, { _id: 0 });
  }

  function getArticleSectionFilter(section) {
    const key = normalizeText(section, 40);
    return ARTICLE_SECTION_FILTERS[key] || null;
  }

  function combineMongoFilters(...filters) {
    const normalized = filters.filter((item) => item && typeof item === 'object' && Object.keys(item).length > 0);
    if (normalized.length === 0) return {};
    if (normalized.length === 1) return normalized[0];
    return { $and: normalized };
  }

  function parseCollectionPagination(query, { defaultLimit = 50, maxLimit = 250 } = {}) {
    const shouldPaginate = hasOwn(query, 'page') || hasOwn(query, 'limit');
    if (!shouldPaginate) {
      return {
        shouldPaginate: false,
        page: 1,
        limit: defaultLimit,
        skip: 0,
      };
    }

    const limit = parsePositiveInt(query.limit, defaultLimit, { min: 1, max: maxLimit });
    const page = parsePositiveInt(query.page, 1, { min: 1, max: 5000 });
    return {
      shouldPaginate: true,
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  return {
    buildArticleProjection,
    combineMongoFilters,
    getArticleSectionFilter,
    parseCollectionPagination,
  };
}
