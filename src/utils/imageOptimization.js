const UNSPLASH_HOSTS = new Set(['images.unsplash.com', 'source.unsplash.com']);

function parseUrl(src) {
  if (typeof src !== 'string' || !src.trim()) return null;
  try {
    if (src.startsWith('/')) return new URL(src, 'https://local.znews.live');
    return new URL(src);
  } catch {
    return null;
  }
}

function isUnsplashUrl(src) {
  const parsed = parseUrl(src);
  if (!parsed) return false;
  return UNSPLASH_HOSTS.has(parsed.hostname);
}

export function normalizeMediaResourceUrl(src) {
  if (typeof src !== 'string' || !src.trim()) return src || '';
  return src.trim().replace(/\/uploads(?:\/uploads)+(\/?)/gi, (_match, suffix) => `/uploads${suffix || ''}`);
}

function buildUnsplashVariant(src, width, { quality = 72, webp = false } = {}) {
  const parsed = parseUrl(src);
  if (!parsed) return src;
  parsed.searchParams.set('w', String(width));
  parsed.searchParams.set('q', String(quality));
  parsed.searchParams.set('auto', 'format');
  if (webp) parsed.searchParams.set('fm', 'webp');
  return parsed.toString();
}

export function getIntrinsicImageDimensions(pipeline) {
  if (!pipeline || typeof pipeline !== 'object') {
    return { width: undefined, height: undefined };
  }

  const width = Number(pipeline.width);
  const height = Number(pipeline.height);

  return {
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : undefined,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : undefined,
  };
}

export function getOptimizedImageSources(
  src,
  {
    widths = [320, 480, 640, 768, 960, 1200, 1440],
    quality = 72,
  } = {},
) {
  if (!src || typeof src !== 'string') {
    return { src: '', srcSet: '', webpSrcSet: '' };
  }

  if (!isUnsplashUrl(src)) {
    return { src, srcSet: '', webpSrcSet: '' };
  }

  const normalizedWidths = [...new Set(widths)]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (normalizedWidths.length === 0) {
    return { src, srcSet: '', webpSrcSet: '' };
  }

  const largest = normalizedWidths[normalizedWidths.length - 1];
  const srcSet = normalizedWidths
    .map((width) => `${buildUnsplashVariant(src, width, { quality, webp: false })} ${width}w`)
    .join(', ');
  const webpSrcSet = normalizedWidths
    .map((width) => `${buildUnsplashVariant(src, width, { quality, webp: true })} ${width}w`)
    .join(', ');

  return {
    src: buildUnsplashVariant(src, largest, { quality, webp: false }),
    srcSet,
    webpSrcSet,
  };
}
