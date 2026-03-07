import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { normalizeAdImageMeta } from '../../shared/adResolver.js';

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
    }),
    regular: Object.freeze({
      frameClass: 'min-h-[7.5rem] gap-3 px-4 py-3.5 md:min-h-0 md:aspect-[11/2] md:max-h-[10.5rem] md:px-5',
      contentClass: 'gap-3 md:gap-3.5',
      circleClass: 'h-11 w-11 border-[3px] outline-[2px] text-lg md:h-12 md:w-12 md:border-[4px] md:outline-[3px] md:text-xl',
      titleClass: 'text-sm',
      subtitleClass: 'text-xs md:text-sm',
      ctaClass: 'px-4 py-2 text-[11px]',
      labelClass: '-right-1 -top-2 md:-right-2 md:-top-3',
    }),
    compact: Object.freeze({
      frameClass: 'min-h-[6.75rem] gap-3 px-4 py-3 md:min-h-0 md:aspect-[6/1] md:max-h-[8.75rem] md:px-4',
      contentClass: 'gap-3',
      circleClass: 'h-10 w-10 border-[3px] outline-[2px] text-base md:h-11 md:w-11 md:border-[3px] md:outline-[2px] md:text-lg',
      titleClass: 'text-[13px] md:text-sm',
      subtitleClass: 'text-[11px] md:text-xs',
      ctaClass: 'px-3.5 py-1.5 text-[10px] md:text-[11px]',
      labelClass: '-right-1 -top-2',
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
    }),
    compact: Object.freeze({
      frameClass: 'min-h-[15.5rem] gap-2.5 p-4 lg:min-h-0 lg:aspect-[10/13] lg:max-h-[19rem]',
      circleClass: 'h-12 w-12 border-[3px] outline-[2px] text-xl',
      titleClass: 'text-sm',
      subtitleClass: 'text-xs',
      ctaClass: 'px-3.5 py-1.5 text-[10px]',
      labelClass: '-right-1.5 -top-2',
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

function getAdCoverImageStyle(ad) {
  const imageMeta = normalizeAdImageMeta(ad?.imageMeta);
  return {
    objectPosition: imageMeta.objectPosition,
    transform: imageMeta.objectScale !== 1 ? `scale(${imageMeta.objectScale})` : undefined,
    transformOrigin: imageMeta.objectPosition,
  };
}

function getBannerLayout(variant, slotMeta) {
  const layouts = BANNER_LAYOUTS[variant] || BANNER_LAYOUTS.horizontal;
  const requestedKey = String(slotMeta?.sizeProfile || '').trim();
  const layoutKey = Object.prototype.hasOwnProperty.call(layouts, requestedKey)
    ? requestedKey
    : DEFAULT_LAYOUT_KEYS[variant];
  return layouts[layoutKey] || layouts[DEFAULT_LAYOUT_KEYS[variant]] || Object.values(layouts)[0];
}

function getBannerInteraction(ad, onClick) {
  const interactive = ad?.showButton !== false;
  return {
    interactive,
    wrapperProps: interactive
      ? {
        href: ad?.link || '#',
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'block group overflow-visible',
        onClick,
      }
      : { className: 'block overflow-visible' },
  };
}

function AdLabel({ className = '' }) {
  return (
    <span
      className={`absolute z-20 rotate-3 border-2 border-white/40 bg-gradient-to-r from-zn-hot to-zn-orange px-2 py-1 text-[9px] font-display font-black uppercase tracking-widest text-white ${className}`}
      style={{ boxShadow: '2px 2px 0 #1C1428' }}
    >
      Реклама
    </span>
  );
}

function getAdImageMode(ad) {
  return ad?.imagePlacement === 'cover' ? 'cover' : 'circle';
}

function AdCircleMedia({ ad, className, iconClass = 'text-2xl' }) {
  return (
    <div className={className}>
      {ad.image ? (
        <img src={ad.image} alt={ad.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span className={iconClass}>{ad.icon}</span>
      )}
    </div>
  );
}

function AdCoverBackground({ ad, overlayClassName = '', glowClassName = '' }) {
  if (!ad?.image) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={ad.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={getAdCoverImageStyle(ad)}
        loading="lazy"
        decoding="async"
      />
      {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`} /> : null}
      {glowClassName ? <div className={`absolute inset-0 ${glowClassName}`} /> : null}
    </div>
  );
}

function AdSafeAreaOverlay({ variant }) {
  if (variant === 'side') {
    return (
      <>
        <div className="pointer-events-none absolute inset-x-[15%] top-[16%] bottom-[22%] rounded-[24px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute inset-x-[28%] bottom-[12%] h-8 rounded-full border border-dashed border-white/35" />
      </>
    );
  }

  if (variant === 'inline') {
    return (
      <>
        <div className="pointer-events-none absolute left-[5%] top-[20%] bottom-[20%] w-[58%] rounded-[18px] border border-dashed border-white/40" />
        <div className="pointer-events-none absolute right-[5%] top-1/2 h-7 w-[18%] -translate-y-1/2 rounded-full border border-dashed border-white/35" />
      </>
    );
  }

  return (
    <>
      <div className="pointer-events-none absolute left-[6%] top-[18%] bottom-[18%] w-[56%] rounded-[22px] border border-dashed border-white/40" />
      <div className="pointer-events-none absolute right-[5%] top-1/2 h-8 w-[16%] -translate-y-1/2 rounded-full border border-dashed border-white/35" />
    </>
  );
}

export function AdBannerHorizontal({ ad, slotMeta = null, showSafeArea = false, onClick = null }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.22);
  const coverMode = Boolean(ad.image) && getAdImageMode(ad) === 'cover';
  const layout = getBannerLayout('horizontal', slotMeta);
  const { interactive, wrapperProps } = getBannerInteraction(ad, onClick);
  const Wrapper = interactive ? 'a' : 'div';
  const showTitle = ad?.showTitle !== false && Boolean(String(ad?.title || '').trim());
  const showSubtitle = Boolean(String(ad?.subtitle || '').trim());
  const headingClass = coverMode
    ? `${layout.titleClass} font-display font-black tracking-wider uppercase leading-none text-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.55)]`
    : `${layout.titleClass} font-display font-black text-zn-text tracking-wider uppercase leading-none`;
  const subtitleClass = coverMode
    ? `${layout.subtitleClass} ${showTitle ? 'mt-1 ' : ''}truncate text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]`
    : `${layout.subtitleClass} ${showTitle ? 'mt-1 ' : ''}truncate text-zn-text-muted`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ad-banner-horizontal">
      <Wrapper {...wrapperProps}>
        <div
          className={`newspaper-page comic-dots comic-panel-white comic-ad-horizontal relative flex items-center justify-between overflow-visible ${interactive ? 'transition-shadow hover:shadow-comic-heavy' : ''} ${layout.frameClass}`}
          style={{ '--ad-tilt': `${adTilt}deg` }}
        >
          {coverMode && (
            <AdCoverBackground
              ad={ad}
              overlayClassName="bg-gradient-to-r from-[#1C1428]/76 via-[#1C1428]/58 to-[#1C1428]/64"
              glowClassName="bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_38%)]"
            />
          )}
          <div className="absolute inset-x-0 top-0 z-[1] h-2 bg-gradient-to-r from-zn-hot to-zn-orange" />
          {!coverMode && <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-zn-hot/10 to-transparent" />}
          {showSafeArea && <AdSafeAreaOverlay variant="horizontal" />}
          <AdLabel className={layout.labelClass} />
          <div className={`relative z-[2] flex min-w-0 items-center ${layout.contentClass}`}>
            {!coverMode && (
              <AdCircleMedia
                ad={ad}
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-white bg-white outline-[#1C1428] ${layout.circleClass}`}
              />
            )}
            <div className="min-w-0">
              {showTitle && <h4 className={headingClass}>{ad.title}</h4>}
              {showSubtitle && <p className={subtitleClass}>{ad.subtitle}</p>}
            </div>
          </div>
          {interactive && (
            <span
              className={`relative z-[2] flex shrink-0 items-center gap-1.5 border-2 bg-gradient-to-r from-zn-hot to-zn-orange font-display font-black uppercase tracking-wider text-white transition-all group-hover:shadow-lg ${layout.ctaClass} ${coverMode ? 'border-white/50' : 'border-white/30'}`}
              style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
            >
              {ad.cta}
              <ExternalLink className="h-3 w-3" />
            </span>
          )}
        </div>
      </Wrapper>
    </motion.div>
  );
}

export function AdBannerSide({ ad, slotMeta = null, showSafeArea = false, onClick = null }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.45);
  const coverMode = Boolean(ad.image) && getAdImageMode(ad) === 'cover';
  const layout = getBannerLayout('side', slotMeta);
  const { interactive, wrapperProps } = getBannerInteraction(ad, onClick);
  const Wrapper = interactive ? 'a' : 'div';
  const showTitle = ad?.showTitle !== false && Boolean(String(ad?.title || '').trim());
  const showSubtitle = Boolean(String(ad?.subtitle || '').trim());
  const headingClass = coverMode
    ? `${layout.titleClass} relative z-[2] font-display font-black uppercase tracking-wider text-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.58)]`
    : `${layout.titleClass} relative z-[2] font-display font-black text-zn-text tracking-wider uppercase`;
  const subtitleClass = coverMode
    ? `${layout.subtitleClass} relative z-[2] whitespace-pre-line text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]`
    : `${layout.subtitleClass} relative z-[2] whitespace-pre-line text-zn-text-muted`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ad-banner-side">
      <Wrapper {...wrapperProps}>
        <div
          className={`newspaper-page comic-dots comic-panel-white comic-ad-side relative flex flex-col items-center justify-center overflow-visible text-center ${interactive ? 'transition-shadow hover:shadow-comic-heavy' : ''} ${layout.frameClass}`}
          style={{ '--ad-tilt': `${adTilt}deg` }}
        >
          {coverMode && (
            <AdCoverBackground
              ad={ad}
              overlayClassName="bg-gradient-to-b from-[#1C1428]/70 via-[#1C1428]/52 to-[#1C1428]/76"
              glowClassName="bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16),transparent_56%)]"
            />
          )}
          <div className="absolute inset-x-0 top-0 z-[1] h-2 bg-gradient-to-r from-zn-hot to-zn-orange" />
          {showSafeArea && <AdSafeAreaOverlay variant="side" />}
          <AdLabel className={layout.labelClass} />
          {!coverMode && <div className="pointer-events-none absolute left-1/2 top-5 h-20 w-20 -translate-x-1/2 rounded-full bg-zn-hot/10 blur-xl" />}
          {!coverMode && (
            <AdCircleMedia
              ad={ad}
              className={`relative z-[2] flex items-center justify-center overflow-hidden rounded-full border-white bg-white outline-[#1C1428] ${layout.circleClass}`}
            />
          )}
              {showTitle && <h4 className={headingClass}>{ad.title}</h4>}
              {showSubtitle && <p className={subtitleClass}>{ad.subtitle}</p>}
          {interactive && (
            <span
              className={`relative z-[2] mt-1 inline-block border-2 bg-gradient-to-r from-zn-hot to-zn-orange font-display font-black uppercase tracking-wider text-white transition-all group-hover:shadow-lg ${layout.ctaClass} ${coverMode ? 'border-white/50' : 'border-white/30'}`}
              style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
            >
              {ad.cta}
            </span>
          )}
        </div>
      </Wrapper>
    </motion.div>
  );
}

export function AdBannerInline({ ad, slotMeta = null, showSafeArea = false, onClick = null }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.18);
  const coverMode = Boolean(ad.image) && getAdImageMode(ad) === 'cover';
  const layout = getBannerLayout('inline', slotMeta);
  const { interactive, wrapperProps } = getBannerInteraction(ad, onClick);
  const Wrapper = interactive ? 'a' : 'div';
  const showTitle = ad?.showTitle !== false && Boolean(String(ad?.title || '').trim());
  const showSubtitle = Boolean(String(ad?.subtitle || '').trim());
  const headingClass = coverMode
    ? `${layout.titleClass} font-display font-black uppercase tracking-wider text-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.58)]`
    : `${layout.titleClass} font-display font-black uppercase text-zn-text tracking-wider`;
  const subtitleClass = coverMode
    ? `${layout.subtitleClass} text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]`
    : `${layout.subtitleClass} text-zn-text-muted`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ad-banner ad-banner-inline my-4">
      <Wrapper {...wrapperProps}>
        <div
          className={`newspaper-page comic-dots comic-panel-white comic-ad-inline relative flex items-center justify-between overflow-visible ${interactive ? 'transition-shadow hover:shadow-comic-heavy' : ''} ${layout.frameClass}`}
          style={{ '--ad-tilt': `${adTilt}deg` }}
        >
          {coverMode && (
            <AdCoverBackground
              ad={ad}
              overlayClassName="bg-gradient-to-r from-[#1C1428]/72 to-[#1C1428]/56"
            />
          )}
          <div className="absolute inset-x-0 top-0 z-[1] h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange" />
          {showSafeArea && <AdSafeAreaOverlay variant="inline" />}
          <AdLabel className={layout.labelClass} />
          <div className={`relative z-[2] flex min-w-0 items-center ${layout.contentClass}`}>
            {!coverMode && (
              <AdCircleMedia
                ad={ad}
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-white bg-white outline-[#1C1428] ${layout.circleClass}`}
              />
            )}
            <div className="min-w-0">
              {showTitle && <h4 className={headingClass}>{ad.title}</h4>}
              {showSubtitle && <p className={subtitleClass}>{ad.subtitle}</p>}
            </div>
          </div>
          {interactive && (
            <span
              className={`relative z-[2] border bg-gradient-to-r from-zn-hot to-zn-orange font-display font-black uppercase tracking-wider text-white ${layout.ctaClass} ${coverMode ? 'border-white/55' : 'border-white/35'}`}
              style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.28)' }}
            >
              {ad.cta}
            </span>
          )}
        </div>
      </Wrapper>
    </motion.div>
  );
}
