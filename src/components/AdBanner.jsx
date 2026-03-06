import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function getAdTilt(ad, factor = 0.32) {
  const seed = typeof ad?.id === 'number' ? ad.id : (String(ad?.id || '').charCodeAt(0) || 0);
  return ((seed % 5) - 2) * factor;
}

function normalizeObjectPosition(value) {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  const x = clamp(match?.[1] ?? 50, 0, 100);
  const y = clamp(match?.[2] ?? 50, 0, 100);
  return `${Math.round(x)}% ${Math.round(y)}%`;
}

function getAdImageMeta(ad) {
  const source = ad?.imageMeta && typeof ad.imageMeta === 'object' ? ad.imageMeta : {};
  return {
    objectPosition: normalizeObjectPosition(source.objectPosition),
    objectScale: clamp(source.objectScale ?? 1, 1, 2.4),
  };
}

function getAdCoverImageStyle(ad) {
  const imageMeta = getAdImageMeta(ad);
  return {
    objectPosition: imageMeta.objectPosition,
    transform: imageMeta.objectScale !== 1 ? `scale(${imageMeta.objectScale})` : undefined,
    transformOrigin: imageMeta.objectPosition,
  };
}

function AdLabel({ className = '' }) {
  return (
    <span
      className={`absolute z-20 rotate-3 border-2 border-white/40 bg-gradient-to-r from-zn-hot to-zn-orange px-2.5 py-1 text-[9px] font-display font-black uppercase tracking-widest text-white ${className}`}
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

export function AdBannerHorizontal({ ad, onClick = null }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.22);
  const coverMode = Boolean(ad.image) && getAdImageMode(ad) === 'cover';
  const headingClass = coverMode
    ? 'font-display font-black tracking-wider uppercase leading-none text-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.55)]'
    : 'font-display font-black text-zn-text tracking-wider uppercase leading-none';
  const subtitleClass = coverMode
    ? 'mt-1 truncate text-sm text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]'
    : 'mt-1 truncate text-sm text-zn-text-muted';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ad-banner-horizontal">
      <a href={ad.link} target="_blank" rel="noopener noreferrer" className="block group overflow-visible" onClick={onClick}>
        <div
          className="newspaper-page comic-dots comic-panel-white comic-ad-horizontal relative flex min-h-[9.5rem] items-center justify-between gap-4 overflow-visible px-5 py-4 transition-shadow hover:shadow-comic-heavy md:min-h-0 md:aspect-[4/1] md:px-6"
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
          {!coverMode && <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-zn-hot/10 to-transparent" />}
          <AdLabel className="-right-1 -top-2 md:-right-2 md:-top-3" />
          <div className="relative z-[2] flex min-w-0 items-center gap-4">
            {!coverMode && (
              <AdCircleMedia
                ad={ad}
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-[4px] border-white bg-white outline outline-[3px] outline-[#1C1428]"
                iconClass="text-2xl"
              />
            )}
            <div className="min-w-0">
              <h4 className={headingClass}>{ad.title}</h4>
              <p className={subtitleClass}>{ad.subtitle}</p>
            </div>
          </div>
          <span
            className={`relative z-[2] flex shrink-0 items-center gap-1.5 border-2 bg-gradient-to-r from-zn-hot to-zn-orange px-5 py-2 text-xs font-display font-black uppercase tracking-wider text-white transition-all group-hover:shadow-lg ${coverMode ? 'border-white/50' : 'border-white/30'}`}
            style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
          >
            {ad.cta}
            <ExternalLink className="h-3 w-3" />
          </span>
        </div>
      </a>
    </motion.div>
  );
}

export function AdBannerSide({ ad, onClick = null }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.45);
  const coverMode = Boolean(ad.image) && getAdImageMode(ad) === 'cover';
  const headingClass = coverMode
    ? 'relative z-[2] font-display font-black uppercase tracking-wider text-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.58)]'
    : 'relative z-[2] font-display font-black text-zn-text tracking-wider uppercase';
  const subtitleClass = coverMode
    ? 'relative z-[2] whitespace-pre-line text-sm text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]'
    : 'relative z-[2] whitespace-pre-line text-sm text-zn-text-muted';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ad-banner-side">
      <a href={ad.link} target="_blank" rel="noopener noreferrer" className="block group overflow-visible" onClick={onClick}>
        <div
          className="newspaper-page comic-dots comic-panel-white comic-ad-side relative flex min-h-[22rem] flex-col items-center justify-center gap-3 overflow-visible p-6 text-center transition-shadow hover:shadow-comic-heavy lg:min-h-0 lg:aspect-[3/4]"
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
          <AdLabel className="-right-2 -top-2" />
          {!coverMode && <div className="pointer-events-none absolute left-1/2 top-5 h-24 w-24 -translate-x-1/2 rounded-full bg-zn-hot/10 blur-xl" />}
          {!coverMode && (
            <AdCircleMedia
              ad={ad}
              className="relative z-[2] flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[4px] border-white bg-white outline outline-[3px] outline-[#1C1428]"
              iconClass="text-3xl"
            />
          )}
          <h4 className={headingClass}>{ad.title}</h4>
          <p className={subtitleClass}>{ad.subtitle}</p>
          <span
            className={`relative z-[2] mt-1 inline-block border-2 bg-gradient-to-r from-zn-hot to-zn-orange px-5 py-2 text-xs font-display font-black uppercase tracking-wider text-white transition-all group-hover:shadow-lg ${coverMode ? 'border-white/50' : 'border-white/30'}`}
            style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
          >
            {ad.cta}
          </span>
        </div>
      </a>
    </motion.div>
  );
}

export function AdBannerInline({ ad, onClick = null }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.18);
  const coverMode = Boolean(ad.image) && getAdImageMode(ad) === 'cover';
  const headingClass = coverMode
    ? 'font-display font-black uppercase text-sm tracking-wider text-white drop-shadow-[0_2px_1px_rgba(0,0,0,0.58)]'
    : 'font-display font-black uppercase text-sm text-zn-text tracking-wider';
  const subtitleClass = coverMode
    ? 'text-xs text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]'
    : 'text-xs text-zn-text-muted';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ad-banner ad-banner-inline my-4">
      <a href={ad.link} target="_blank" rel="noopener noreferrer" className="block group overflow-visible" onClick={onClick}>
        <div
          className="newspaper-page comic-dots comic-panel-white comic-ad-inline relative flex min-h-[7.5rem] items-center justify-between gap-3 overflow-visible p-4 transition-shadow hover:shadow-comic-heavy sm:min-h-0 sm:aspect-[4/1]"
          style={{ '--ad-tilt': `${adTilt}deg` }}
        >
          {coverMode && (
            <AdCoverBackground
              ad={ad}
              overlayClassName="bg-gradient-to-r from-[#1C1428]/72 to-[#1C1428]/56"
            />
          )}
          <div className="absolute inset-x-0 top-0 z-[1] h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange" />
          <AdLabel className="-right-1 -top-2" />
          <div className="relative z-[2] flex min-w-0 items-center gap-3">
            {!coverMode && (
              <AdCircleMedia
                ad={ad}
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-white outline outline-[2px] outline-[#1C1428]"
                iconClass="text-xl"
              />
            )}
            <div className="min-w-0">
              <h4 className={headingClass}>{ad.title}</h4>
              <p className={subtitleClass}>{ad.subtitle}</p>
            </div>
          </div>
          <span
            className={`relative z-[2] border bg-gradient-to-r from-zn-hot to-zn-orange px-3 py-1 text-xs font-display font-black uppercase tracking-wider text-white ${coverMode ? 'border-white/55' : 'border-white/35'}`}
            style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.28)' }}
          >
            {ad.cta}
          </span>
        </div>
      </a>
    </motion.div>
  );
}
