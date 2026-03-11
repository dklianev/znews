export function createSearchCollectionHelpers({ stripDocumentList }) {
  function isTextSearchUnavailableError(error) {
    const code = Number(error?.code);
    if (code === 27) return true;
    const message = String(error?.message || '').toLowerCase();
    return message.includes('text index required')
      || message.includes('index not found for $text')
      || message.includes('text index not found');
  }

  async function searchCollectionByTextAndRegex(Model, { textSearch, regexFilter, limit, projection, textSortField = 'id' }) {
    let normalizedTextItems = [];
    try {
      const textItems = await Model.find({ $text: { $search: textSearch } })
        .sort({ score: { $meta: 'textScore' }, [textSortField]: -1 })
        .limit(limit)
        .select(projection || { _id: 0, __v: 0 })
        .lean();
      normalizedTextItems = stripDocumentList(textItems);
    } catch (error) {
      if (!isTextSearchUnavailableError(error)) {
        throw error;
      }
    }

    if (normalizedTextItems.length >= limit) {
      return normalizedTextItems.slice(0, limit);
    }

    const existingIds = new Set(normalizedTextItems.map((item) => JSON.stringify(item?.id ?? item?.title ?? item?.name)));
    const fallbackItems = await Model.find(regexFilter)
      .sort({ [textSortField]: -1 })
      .limit(Math.max(limit * 2, limit + 4))
      .select(projection || { _id: 0, __v: 0 })
      .lean();

    const merged = [...normalizedTextItems];
    for (const item of stripDocumentList(fallbackItems)) {
      const dedupeKey = JSON.stringify(item?.id ?? item?.title ?? item?.name);
      if (existingIds.has(dedupeKey)) continue;
      existingIds.add(dedupeKey);
      merged.push(item);
      if (merged.length >= limit) break;
    }

    return merged;
  }

  return {
    isTextSearchUnavailableError,
    searchCollectionByTextAndRegex,
  };
}
