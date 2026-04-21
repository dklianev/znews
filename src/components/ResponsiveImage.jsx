import { memo, useEffect, useMemo, useState } from 'react';
import { getIntrinsicImageDimensions, getOptimizedImageSources, normalizeMediaResourceUrl } from '../utils/imageOptimization';

function normalizeClassName(...values) {
  return values
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
}

export default memo(function ResponsiveImage({
  src,
  alt = '',
  fallbackSrc = '',
  pipeline = null,
  placeholder = '',
  className = '',
  pictureClassName = 'block',
  sizes = '100vw',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto',
  quality = 72,
  style,
  onError,
  ...rest
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const normalizedPictureClassName = useMemo(
    () => normalizeClassName('block', pictureClassName),
    [pictureClassName],
  );
  const normalizedImgClassName = useMemo(
    () => normalizeClassName('block', className),
    [className],
  );

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src, fallbackSrc, pipeline?.placeholder]);

  const safeSrc = normalizeMediaResourceUrl((!failed && src) ? src : (fallbackSrc || src || ''));
  const normalizedPipeline = useMemo(() => {
    if (!pipeline || typeof pipeline !== 'object') return null;
    const avif = Array.isArray(pipeline.avif)
      ? pipeline.avif.filter(item => item && Number.isFinite(Number(item.width)) && typeof item.url === 'string')
        .map(item => ({ ...item, url: normalizeMediaResourceUrl(item.url) }))
      : [];
    const webp = Array.isArray(pipeline.webp)
      ? pipeline.webp.filter(item => item && Number.isFinite(Number(item.width)) && typeof item.url === 'string')
        .map(item => ({ ...item, url: normalizeMediaResourceUrl(item.url) }))
      : [];
    return {
      avif,
      webp,
      placeholder: typeof pipeline.placeholder === 'string' ? normalizeMediaResourceUrl(pipeline.placeholder) : '',
    };
  }, [pipeline]);

  const optimized = useMemo(() => {
    if (normalizedPipeline && (normalizedPipeline.avif.length > 0 || normalizedPipeline.webp.length > 0)) {
      const buildSet = (items) => items
        .slice()
        .sort((a, b) => Number(a.width) - Number(b.width))
        .map(item => `${item.url} ${Number(item.width)}w`)
        .join(', ');
      return {
        src: safeSrc,
        srcSet: '',
        webpSrcSet: normalizedPipeline.webp.length > 0 ? buildSet(normalizedPipeline.webp) : '',
        avifSrcSet: normalizedPipeline.avif.length > 0 ? buildSet(normalizedPipeline.avif) : '',
      };
    }
    const fallbackOptimized = getOptimizedImageSources(safeSrc, { quality });
    return { ...fallbackOptimized, avifSrcSet: '' };
  }, [normalizedPipeline, quality, safeSrc]);

  const intrinsicDimensions = useMemo(() => getIntrinsicImageDimensions(pipeline), [pipeline]);

  const effectivePlaceholder = placeholder || normalizedPipeline?.placeholder || '';
  const effectiveFetchPriority = fetchPriority === 'auto' && loading === 'lazy' ? 'low' : fetchPriority;

  const computedStyle = useMemo(() => {
    let base = {};
    if (effectivePlaceholder && !loaded) {
      base = {
        backgroundImage: `url(${effectivePlaceholder})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (pipeline?.objectPosition) {
      base.objectPosition = pipeline.objectPosition;
    }
    if (intrinsicDimensions.width && intrinsicDimensions.height) {
      base.aspectRatio = `${intrinsicDimensions.width} / ${intrinsicDimensions.height}`;
    }
    if (style && typeof style === 'object') {
      base = { ...base, ...style };
    }
    return Object.keys(base).length > 0 ? base : undefined;
  }, [effectivePlaceholder, loaded, pipeline, intrinsicDimensions, style]);

  if (!safeSrc) return null;

  return (
    <picture className={normalizedPictureClassName}>
      {optimized.avifSrcSet && <source type="image/avif" srcSet={optimized.avifSrcSet} sizes={sizes} />}
      {optimized.webpSrcSet && <source type="image/webp" srcSet={optimized.webpSrcSet} sizes={sizes} />}
      {optimized.srcSet && <source srcSet={optimized.srcSet} sizes={sizes} />}
      <img
        src={optimized.src || safeSrc}
        srcSet={optimized.srcSet || undefined}
        sizes={optimized.srcSet ? sizes : undefined}
        alt={alt}
        width={intrinsicDimensions.width}
        height={intrinsicDimensions.height}
        className={normalizedImgClassName}
        loading={loading}
        decoding={decoding}
        fetchpriority={effectiveFetchPriority}
        style={computedStyle}
        onLoad={() => setLoaded(true)}
        onError={(event) => {
          if (!failed && fallbackSrc && safeSrc !== fallbackSrc) {
            setFailed(true);
            return;
          }
          if (onError) onError(event);
        }}
        {...rest}
      />
    </picture>
  );
})
