export const HOMEPAGE_ARTICLE_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,sponsored,hero,views,status,publishAt,cardSticker';

export const HOMEPAGE_PAYLOAD_PARAMS = Object.freeze({
  fields: HOMEPAGE_ARTICLE_FIELDS,
  latestShowcaseLimit: 5,
  latestWireLimit: 16,
  compact: 1,
});

export function buildHomepagePayloadQuery(params = HOMEPAGE_PAYLOAD_PARAMS) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, String(value));
  });
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export function buildHomepagePayloadApiPath(params = HOMEPAGE_PAYLOAD_PARAMS) {
  return `/homepage${buildHomepagePayloadQuery(params)}`;
}
