import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import { resolveAdCreative } from '../../shared/adResolver.js';
import ResponsiveImage from './ResponsiveImage';

const BANNER_LAYOUTS = Object.freeze({
  horizontal: Object.freeze({
    hero: Object.freeze({
      frameClass: 'min-h-[8.25rem] gap-3 px-4 py-3.5 md:min-h-0 md:aspect-[5/1] md:max-h-[12rem] md:px-5',
      contentClass: 'gap-3.5 md:gap-4',
      circleClass: 'h-12 w-12 border-[3px] outline-[2px] text-xl md:h-14 md:w-14 md:border-[4px] md:outline-[3px] md:text-2xl',
      titleClass: 'text-sm md:text-base',
      subtitleClass: 'text-xs md:text-sm',
      ctaClass: 'px-4 py-2 text-[11px]',
      labelClass: '-right-1 -top-2 md:-right-2 md:-top-3',
      containPaddingClass: 'p-3 md:p-4',
    }),
    regular: Object.freeze({
      frameClass: 'min-h-[7.5rem] gap-3 px-4 py-3.5 md:min-h-0 md:aspect-[11/2] md:max-h-[10.5rem] md:px-5',
      contentClass: 'gap-3 md:gap-3.5',
      circleClass: 'h-11 w-11 border-[3px] outline-[2px] text-lg md:h-12 md:w-12 md:border-[4px] md:outline-[3px] md:text-xl',
      titleClass: 'text-sm',
      subtitleClass: 'text-xs md:text-sm',
      ctaClass: 'px-4 py-2 text-[11px]',
      labelClass: '-right-1 -top-2 md:-right-2 md:-top-3',
      containPaddingClass: 'p-3 md:p-4',
    }),
    compact: Object.freeze({
      frameClass: 'min-h-[6.75rem] gap-3 px-4 py-3 md:min-h-0 md:aspect-[6/1] md:max-h-[8.75rem] md:px-4',
      contentClass: 'gap-3',
      circleClass: 'h-10 w-10 border-[3px] outline-[2px] text-base md:h-11 md:w-11 md:border-[3px] md:outline-[2px] md:text-lg',
      titleClass: 'text-[13px] md:text-sm',
      subtitleClass: 'text-[11px] md:text-xs',
      ctaClass: 'px-3.5 py-1.5 text-[10px] md:text-[11px]',
      labelClass: '-right-1 -top-2',
      containPaddingClass: 'p-3',
    }),
    mobileHero: Object.freeze({
      frameClass: 'aspect-[4/1] min-h-0 gap-3 px-4 py-3.5',
      contentClass: 'gap-3',
      circleClass: 'h-11 w-11 border-[3px] outline-[2px] text-lg',
      titleClass: 'text-sm',
      subtitleClass: 'text-xs',
      ctaClass: 'px-3.5 py-1.5 text-[10px]',
      labelClass: '-right-1 -top-2',
      containPaddingClass: 'p-3',
    }),
    mobileRegular: Object.freeze({
      frameClass: 'aspect-[4/1] min-h-0 gap-3 px-4 py-3.5',
      contentClass: 'gap-3',
      circleClass: 'h-10.5 w-10.5 border-[3px] outline-[2px] text-base',
      titleClass: 'text-[13px]',
      subtitleClass: 'text-[11px]',
      ctaClass: 'px-3 py-1.5 text-[10px]',
      labelClass: '-right-1 -top-2',
      containPaddingClass: 'p-3',
    }),
  }),
  side: Object.freeze({
    tall: Object.freeze({
      frameClass: 'min-h-[18rem] gap-3 p-5 lg:min-h-0 lg:aspect-[4/5] lg:max-h-[22rem]',
      circleClass: 'h-14 w-14 border-[4px] outline-[3px] text-2xl',
      titleClass: 'text-base',
      subtitleClass: 'text-sm',
      ctaClass: 'px-4 py-2 text-[11px]',
      labelClass: '-right-2 -top-2',
      containPaddingClass: 'p-4',
    }),
    compact: Object.freeze({
      frameClass: 'min-h-[15.5rem] gap-2.5 p-4 lg:min-h-0 lg:aspect-[10/13] lg:max-h-[19rem]',
      circleClass: 'h-12 w-12 border-[3px] outline-[2px] text-xl',
      titleClass: 'text-sm',
      subtitleClass: 'text-xs',
      ctaClass: 'px-3.5 py-1.5 text-[10px]',
      labelClass: '-right-1.5 -top-2',
      containPaddingClass: 'p-4',
    }),
    mobileCard: Object.freeze({
      frameClass: 'aspect-[4/3] w-full max-w-[30rem] gap-3 p-4 mx-auto',
      circleClass: 'h-12 w-12 border-[3px] outline-[2px] text-xl',
      titleClass: 'text-sm',
      subtitleClass: 'text-xs',
      ctaClass: 'px-3.5 py-1.5 text-[10px]',
      labelClass: '-right-1.5 -top-2',
      containPaddingClass: 'p-4',
    }),
    mobileSquare: Object.freeze({
      frameClass: 'aspect-square w-full max-w-[24rem] gap-3 p-4 mx-auto',
      circleClass: 'h-12 w-12 border-[3px] outline-[2px] text-xl',
      titleClass: 'text-sm',
      subtitleClass: 'text-xs',
      ctaClass: 'px-3.5 py-1.5 text-[10px]',
      labelClass: '-right-1.5 -top-2',
      containPaddingClass: 'p-4',
    }),
  }),
  inline: Object.freeze({
    compact: Object.freeze({
      frameClass: 'min-h-[5.75rem] gap-2.5 p-3 sm:min-h-0 sm:aspect-[6/1] sm:max-h-[6.75rem]',
      contentClass: 'gap-2.5',
      circleClass: 'h-9 w-9 border-[2px] outline-[2px] text-base',
      titleClass: 'text-[12px] sm:text-[13px]',
      subtitleClass: 'text-[10px] sm:text-[11px]',
      ctaClass: 'px-2.5 py-1 text-[10px]',
      labelClass: '-right-1 -top-2',
      containPaddingClass: 'p-2.5 sm:p-3',
    }),
    mobileInline: Object.freeze({
      frameClass: 'aspect-[16/5] min-h-0 gap-2.5 p-3',
      contentClass: 'gap-2.5',
      circleClass: 'h-9 w-9 border-[2px] outline-[2px] text-base',
      titleClass: 'text-[12px]',
      subtitleClass: 'text-[10px]',
      ctaClass: 'px-2.5 py-1 text-[10px]',
      labelClass: '-right-1 -top-2',
      containPaddingClass: 'p-2.5',
    }),
  }),
});

const DEFAULT_LAYOUT_KEYS = Object.freeze({
  horizontal: 'regular',
  side: 'tall',
  inline: 'compact',
});

function getAdTilt(ad, factor = 0.32) {
  const seed = typeof ad?.id === 'number' ? ad.id : (String(ad?.id || '').charCodeAt(0) || 0);
  return ((seed % 5) - 2) * factor;
}

function useBannerViewport(viewport = 'auto') {
  const forcedMobile = viewport === 'mobile';
  const forcedDesktop = viewport === 'desktop';
  const [isMobile, setIsMobile] = useState(() => {
    if (forcedMobile) return true;
    if (forcedDesktop) return false;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (forcedMobile) {
      setIsMobile(true);
      return undefined;
    }
    if (forcedDesktop) {
      setIsMobile(false);
      return undefined;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, [forcedDesktop, forcedMobile]);

  return forcedMobile ? 'mobile' : (forcedDesktop ? 'desktop' : (isMobile ? 'mobile' : 'desktop'));
}

function getAdCoverImageStyle(creative) {
  const imageMeta = creative?.imageMeta || { objectPosition: '50% 50%', objectScale: 1 };
  return {
    objectPosition: imageMeta.objectPosition,
    transform: imageMeta.objectScale !== 1 ? `scale(${imageMeta.objectScale})` : undefined,
    transformOrigin: imageMeta.objectPosition,
  };
}

function getAdImageSizes(variant) {
  if (variant === 'side') {
    return '(max-width: 767px) 100vw, 320px';
  }
  if (variant === 'inline') {
    return '(max-width: 767px) 100vw, 720px';
  }
  return '(max-width: 767px) 100vw, 1100px';
}

function getBannerLayout(variant, slotMeta, viewport) {
  const layouts = BANNER_LAYOUTS[variant] || BANNER_LAYOUTS.horizontal;
  const requestedKey = viewport === 'mobile'
    ? String(slotMeta?.mobileSizeProfile || slotMeta?.sizeProfile || '').trim()
    : String(slotMeta?.sizeProfile || '').trim();
  const layoutKey = Object.prototype.hasOwnProperty.call(layouts, requestedKey)
    ? requestedKey
    : DEFAULT_LAYOUT_KEYS[variant];
  return layouts[layoutKey] || layouts[DEFAULT_LAYOUT_KEYS[variant]] || Object.values(layouts)[0];
}

function getBannerInteraction(ad, onClick) {
  const interactive = ad?.clickable !== false && Boolean(String(ad?.link || '').trim()) && ad?.link !== '#';
  return {
    interactive,
    panelProps: interactive
      ? {
        href: ad?.link || '#',
        target: '_blank',
        rel: 'noopener noreferrer',
        onClick,
      }
      : {},
  };
}

function AdLabel({ className = '' }) {
  return (
    <span
      className={`ad-label absolute z-20 rotate-3 border-2 border-white/40 bg-gradient-to-r from-zn-hot to-zn-orange px-2 py-1 text-[9px] font-display font-black uppercase tracking-widest text-white ${className}`}
    >
      РЕКЛАМА
    </span>
  );
}

function getAdImageMode(ad) {
  return ad?.imagePlacement === 'cover' ? 'cover' : 'circle';
}

function AdCircleMedia({ ad, creative, className, iconClass = 'text-2xl' }) {
  return (
    <div className={className}>
      {creative.image ? (
        <ResponsiveImage
          src={creative.image}
          alt={ad.title}
          pipeline={creative.imageMeta}
          pictureClassName="h-full w-full"
          className="h-full w-full object-cover"
          sizes="96px"
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
      ) : (
        <span className={iconClass}>{ad.icon}</span>
      )}
    </div>
  );
}

function AdCreativeBackground({ ad, creative, variant = 'horizontal', overlayClassName = '', glowClassName = '', containPaddingClass = 'p-3' }) {
  if (!creative?.image) return null;
  const containMode = creative.fitMode === 'contain';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {containMode && (
        <div
          className="absolute inset-0 ad-contain-bg"
          style={{
            '--ad-color': ad?.color || '#3b1f54',
          }}
        />
      )}
      <ResponsiveImage
        src={creative.image}
        alt=""
        pipeline={creative.imageMeta}
        pictureClassName="absolute inset-0 block h-full w-full"
        className={containMode
          ? `h-full w-full object-contain ${containPaddingClass}`
          : 'h-full w-full object-cover'}
        sizes={getAdImageSizes(variant)}
        style={getAdCoverImageStyle(creative)}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
      {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`} /> : null}
      {containMode ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_60%)]" /> : null}
      {glowClassName ? <div className={`absolute inset-0 ${glowClassName}`} /> : null}
    </div>
  );
}

function AdSafeAreaOverlay({ variant, viewport = 'desktop' }) {
  if (variant === 'side') {
    return viewport === 'mobile' ? (
      <>
        <div className="pointer-events-none absolute inset-x-[12%] top-[14%] bottom-[18%] rounded-[22px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute inset-x-[24%] bottom-[10%] h-8 rounded-full border border-dashed border-white/35" />
      </>
    ) : (
      <>
        <div className="pointer-events-none absolute inset-x-[15%] top-[16%] bottom-[22%] rounded-[24px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute inset-x-[28%] bottom-[12%] h-8 rounded-full border border-dashed border-white/35" />
      </>
    );
  }

  if (variant === 'inline') {
    return viewport === 'mobile' ? (
      <>
        <div className="pointer-events-none absolute left-[6%] top-[18%] bottom-[18%] w-[60%] rounded-[16px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute right-[6%] top-1/2 h-7 w-[20%] -translate-y-1/2 rounded-full border border-dashed border-white/35" />
      </>
    ) : (
      <>
        <div className="pointer-events-none absolute left-[5%] top-[20%] bottom-[20%] w-[58%] rounded-[18px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute right-[5%] top-1/2 h-7 w-[18%] -translate-y-1/2 rounded-full border border-dashed border-white/35" />
      </>
    );
  }

  return viewport === 'mobile' ? (
    <>
      <div className="pointer-events-none absolute left-[7%] top-[18%] bottom-[18%] w-[58%] rounded-[20px] border border-dashed border-white/40" />
      <div className="pointer-events-none absolute right-[6%] top-1/2 h-8 w-[18%] -translate-y-1/2 rounded-full border border-dashed border-white/35" />
    </>
  ) : (
    <>
      <div className="pointer-events-none absolute left-[6%] top-[18%] bottom-[18%] w-[56%] rounded-[22px] border border-dashed border-white/40" />
      <div className="pointer-events-none absolute right-[5%] top-1/2 h-8 w-[16%] -translate-y-1/2 rounded-full border border-dashed border-white/35" />
    </>
  );
}

function getHeadingClass(layout, coverMode) {
  return coverMode
    ? `${layout.titleClass} font-display font-black tracking-wider uppercase leading-none text-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.55)]`
    : `${layout.titleClass} font-display font-black text-zn-text tracking-wider uppercase leading-none`;
}

function getSubtitleClass(layout, coverMode, showTitle) {
  return coverMode
    ? `${layout.subtitleClass} ${showTitle ? 'mt-1 ' : ''}whitespace-pre-line text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]`
    : `${layout.subtitleClass} ${showTitle ? 'mt-1 ' : ''}whitespace-pre-line text-zn-text-muted`;
}

export function AdBannerHorizontal({ ad, slotMeta = null, showSafeArea = false, onClick = null, viewport = 'auto' }) {
  if (!ad) return null;
  const activeViewport = useBannerViewport(viewport);
  const creative = resolveAdCreative(ad, { viewport: activeViewport });
  const adTilt = getAdTilt(ad, 0.22);
  const coverMode = Boolean(creative.image) && getAdImageMode(ad) === 'cover';
  const layout = getBannerLayout('horizontal', slotMeta, activeViewport);
  const { interactive, panelProps } = getBannerInteraction(ad, onClick);
  const PanelTag = interactive ? 'a' : 'div';
  const showButton = ad?.showButton !== false && interactive && Boolean(String(ad?.cta || '').trim());
  const showTitle = ad?.showTitle !== false && Boolean(String(ad?.title || '').trim());
  const showSubtitle = Boolean(String(ad?.subtitle || '').trim());
  const headingClass = getHeadingClass(layout, coverMode);
  const subtitleClass = getSubtitleClass(layout, coverMode, showTitle);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, mass: 0.8 }}
      className="ad-banner-horizontal"
    >
      <PanelTag
        {...panelProps}
        className={`newspaper-page comic-dots comic-panel-white comic-ad-horizontal relative flex items-center justify-between overflow-visible ${interactive ? 'group cursor-pointer' : 'cursor-default'} ${layout.frameClass}`}
        style={{ '--ad-tilt': `${adTilt}deg` }}
      >
          {coverMode && (
            <AdCreativeBackground
              ad={ad}
              creative={creative}
              variant="horizontal"
              containPaddingClass={layout.containPaddingClass}
              overlayClassName={creative.fitMode === 'contain'
                ? 'bg-gradient-to-r from-[#1C1428]/18 via-[#1C1428]/6 to-[#1C1428]/14'
                : 'bg-gradient-to-r from-[#1C1428]/28 via-[#1C1428]/16 to-[#1C1428]/20'}
              glowClassName="bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_38%)]"
            />
          )}
          <div className="absolute inset-x-0 top-0 z-[1] h-2 bg-gradient-to-r from-zn-hot to-zn-orange" />
          {!coverMode && <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-zn-hot/10 to-transparent" />}
          {showSafeArea && <AdSafeAreaOverlay variant="horizontal" viewport={activeViewport} />}
          <AdLabel className={layout.labelClass} />
          <div className={`relative z-[2] flex min-w-0 items-center ${layout.contentClass}`}>
            {!coverMode && (
              <AdCircleMedia
                ad={ad}
                creative={creative}
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-white bg-white outline-[#1C1428] ${layout.circleClass}`}
              />
            )}
            <div className="min-w-0">
              {showTitle && <span className={`block ${headingClass}`}>{ad.title}</span>}
              {showSubtitle && <p className={subtitleClass}>{ad.subtitle}</p>}
            </div>
          </div>
          {showButton && (
            <span
              className={`relative z-[2] flex shrink-0 items-center gap-1.5 border-2 bg-gradient-to-r from-zn-hot to-zn-orange font-display font-black uppercase tracking-wider text-white transition-all group-hover:shadow-lg ${layout.ctaClass} ${coverMode ? 'border-white/50' : 'border-white/30'}`}
              style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
            >
              {ad.cta}
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
      </PanelTag>
    </motion.div>
  );
}

export function AdBannerSide({ ad, slotMeta = null, showSafeArea = false, onClick = null, viewport = 'auto' }) {
  if (!ad) return null;
  const activeViewport = useBannerViewport(viewport);
  const creative = resolveAdCreative(ad, { viewport: activeViewport });
  const adTilt = getAdTilt(ad, 0.45);
  const coverMode = Boolean(creative.image) && getAdImageMode(ad) === 'cover';
  const layout = getBannerLayout('side', slotMeta, activeViewport);
  const { interactive, panelProps } = getBannerInteraction(ad, onClick);
  const PanelTag = interactive ? 'a' : 'div';
  const showButton = ad?.showButton !== false && interactive && Boolean(String(ad?.cta || '').trim());
  const showTitle = ad?.showTitle !== false && Boolean(String(ad?.title || '').trim());
  const showSubtitle = Boolean(String(ad?.subtitle || '').trim());
  const headingClass = getHeadingClass(layout, coverMode);
  const subtitleClass = getSubtitleClass(layout, coverMode, showTitle);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, mass: 0.8 }}
      className="ad-banner-side"
    >
      <PanelTag
        {...panelProps}
        className={`newspaper-page comic-dots comic-panel-white comic-ad-side relative flex flex-col items-center justify-center overflow-visible text-center ${interactive ? 'group cursor-pointer' : 'cursor-default'} ${layout.frameClass}`}
        style={{ '--ad-tilt': `${adTilt}deg` }}
      >
          {coverMode && (
            <AdCreativeBackground
              ad={ad}
              creative={creative}
              variant="side"
              containPaddingClass={layout.containPaddingClass}
              overlayClassName={creative.fitMode === 'contain'
                ? 'bg-gradient-to-b from-[#1C1428]/18 via-[#1C1428]/6 to-[#1C1428]/16'
                : 'bg-gradient-to-b from-[#1C1428]/24 via-[#1C1428]/14 to-[#1C1428]/24'}
              glowClassName="bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_56%)]"
            />
          )}
          <div className="absolute inset-x-0 top-0 z-[1] h-2 bg-gradient-to-r from-zn-hot to-zn-orange" />
          {showSafeArea && <AdSafeAreaOverlay variant="side" viewport={activeViewport} />}
          <AdLabel className={layout.labelClass} />
          {!coverMode && <div className="pointer-events-none absolute left-1/2 top-5 h-20 w-20 -translate-x-1/2 rounded-full bg-zn-hot/10 blur-xl" />}
          {!coverMode && (
            <AdCircleMedia
              ad={ad}
              creative={creative}
              className={`relative z-[2] flex items-center justify-center overflow-hidden rounded-full border-white bg-white outline-[#1C1428] ${layout.circleClass}`}
            />
          )}
          {showTitle && <span className={`relative z-[2] block ${headingClass}`}>{ad.title}</span>}
          {showSubtitle && <p className={`relative z-[2] ${subtitleClass}`}>{ad.subtitle}</p>}
          {showButton && (
            <span
              className={`relative z-[2] mt-1 inline-block border-2 bg-gradient-to-r from-zn-hot to-zn-orange font-display font-black uppercase tracking-wider text-white transition-all group-hover:shadow-lg ${layout.ctaClass} ${coverMode ? 'border-white/50' : 'border-white/30'}`}
              style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
            >
              {ad.cta}
            </span>
          )}
      </PanelTag>
    </motion.div>
  );
}

export function AdBannerInline({ ad, slotMeta = null, showSafeArea = false, onClick = null, viewport = 'auto' }) {
  if (!ad) return null;
  const activeViewport = useBannerViewport(viewport);
  const creative = resolveAdCreative(ad, { viewport: activeViewport });
  const adTilt = getAdTilt(ad, 0.18);
  const coverMode = Boolean(creative.image) && getAdImageMode(ad) === 'cover';
  const layout = getBannerLayout('inline', slotMeta, activeViewport);
  const { interactive, panelProps } = getBannerInteraction(ad, onClick);
  const PanelTag = interactive ? 'a' : 'div';
  const showButton = ad?.showButton !== false && interactive && Boolean(String(ad?.cta || '').trim());
  const showTitle = ad?.showTitle !== false && Boolean(String(ad?.title || '').trim());
  const showSubtitle = Boolean(String(ad?.subtitle || '').trim());
  const headingClass = getHeadingClass(layout, coverMode);
  const subtitleClass = getSubtitleClass(layout, coverMode, showTitle);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, mass: 0.8 }}
      className="ad-banner ad-banner-inline my-4"
    >
      <PanelTag
        {...panelProps}
        className={`newspaper-page comic-dots comic-panel-white comic-ad-inline relative flex items-center justify-between overflow-visible ${interactive ? 'group cursor-pointer' : 'cursor-default'} ${layout.frameClass}`}
        style={{ '--ad-tilt': `${adTilt}deg` }}
      >
          {coverMode && (
            <AdCreativeBackground
              ad={ad}
              creative={creative}
              variant="inline"
              containPaddingClass={layout.containPaddingClass}
              overlayClassName={creative.fitMode === 'contain'
                ? 'bg-gradient-to-r from-[#1C1428]/14 to-[#1C1428]/8'
                : 'bg-gradient-to-r from-[#1C1428]/24 to-[#1C1428]/16'}
            />
          )}
          <div className="absolute inset-x-0 top-0 z-[1] h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange" />
          {showSafeArea && <AdSafeAreaOverlay variant="inline" viewport={activeViewport} />}
          <AdLabel className={layout.labelClass} />
          <div className={`relative z-[2] flex min-w-0 items-center ${layout.contentClass}`}>
            {!coverMode && (
              <AdCircleMedia
                ad={ad}
                creative={creative}
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-white bg-white outline-[#1C1428] ${layout.circleClass}`}
              />
            )}
            <div className="min-w-0">
              {showTitle && <span className={`block ${headingClass}`}>{ad.title}</span>}
              {showSubtitle && <p className={subtitleClass}>{ad.subtitle}</p>}
            </div>
          </div>
          {showButton && (
            <span
              className={`relative z-[2] border bg-gradient-to-r from-zn-hot to-zn-orange font-display font-black uppercase tracking-wider text-white ${layout.ctaClass} ${coverMode ? 'border-white/55' : 'border-white/35'}`}
              style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.28)' }}
            >
              {ad.cta}
            </span>
          )}
      </PanelTag>
    </motion.div>
  );
}
