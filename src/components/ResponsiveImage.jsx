import { useEffect, useMemo, useState } from 'react';
import { getOptimizedImageSources } from '../utils/imageOptimization';

export default function ResponsiveImage({
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
  onError,
  ...rest
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src, fallbackSrc, pipeline?.placeholder]);

  const safeSrc = (!failed && src) ? src : (fallbackSrc || src || '');
  const normalizedPipeline = useMemo(() => {
    if (!pipeline || typeof pipeline !== 'object') return null;
    const avif = Array.isArray(pipeline.avif)
      ? pipeline.avif.filter(item => item && Number.isFinite(Number(item.width)) && typeof item.url === 'string')
      : [];
    const webp = Array.isArray(pipeline.webp)
      ? pipeline.webp.filter(item => item && Number.isFinite(Number(item.width)) && typeof item.url === 'string')
      : [];
    return {
      avif,
      webp,
      placeholder: typeof pipeline.placeholder === 'string' ? pipeline.placeholder : '',
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

  const effectivePlaceholder = placeholder || normalizedPipeline?.placeholder || '';

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
    return Object.keys(base).length > 0 ? base : undefined;
  }, [effectivePlaceholder, loaded, pipeline]);

  if (!safeSrc) return null;

  return (
    <picture className={pictureClassName}>
      {optimized.avifSrcSet && <source type="image/avif" srcSet={optimized.avifSrcSet} sizes={sizes} />}
      {optimized.webpSrcSet && <source type="image/webp" srcSet={optimized.webpSrcSet} sizes={sizes} />}
      {optimized.srcSet && <source srcSet={optimized.srcSet} sizes={sizes} />}
      <img
        src={optimized.src || safeSrc}
        srcSet={optimized.srcSet || undefined}
        sizes={optimized.srcSet ? sizes : undefined}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        fetchpriority={fetchPriority}
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
}
