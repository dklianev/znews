import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

function getAdTilt(ad, factor = 0.32) {
  const seed = typeof ad?.id === 'number' ? ad.id : (String(ad?.id || '').charCodeAt(0) || 0);
  return ((seed % 5) - 2) * factor;
}

function AdLabel({ className = '' }) {
  return (
    <span className={`absolute bg-gradient-to-r from-zn-hot to-zn-orange text-white text-[9px] font-display font-black px-2.5 py-1 uppercase tracking-widest z-20 rotate-3 border-2 border-white/40 ${className}`} style={{ boxShadow: '2px 2px 0 #1C1428' }}>
      ★ Реклама
    </span>
  );
}

export function AdBannerHorizontal({ ad }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.22);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="ad-banner-horizontal"
    >
      <a href={ad.link} target="_blank" rel="noopener noreferrer" className="block group overflow-visible">
        <div
          className="newspaper-page comic-dots comic-panel-white comic-ad-horizontal px-5 md:px-6 py-4 flex items-center justify-between gap-4 transition-shadow hover:shadow-comic-heavy relative overflow-visible"
          style={{ '--ad-tilt': `${adTilt}deg` }}
        >
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-zn-hot to-zn-orange" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-zn-hot/10 to-transparent pointer-events-none" />
          <AdLabel className="-top-2 -right-1 md:-top-3 md:-right-2" />
          <div className="flex items-center gap-4 min-w-0 relative z-[2]">
            <div className="w-14 h-14 rounded-full border-[4px] border-white outline outline-[3px] outline-[#1C1428] flex items-center justify-center bg-white shrink-0" style={{ boxShadow: '3px 3px 0 #1C1428' }}>
              <span className="text-2xl">{ad.icon}</span>
            </div>
            <div className="min-w-0">
              <h4 className="font-display font-black text-zn-text tracking-wider uppercase leading-none">{ad.title}</h4>
              <p className="text-sm text-zn-text-muted truncate mt-1">{ad.subtitle}</p>
            </div>
          </div>
          <span className="shrink-0 px-5 py-2 bg-gradient-to-r from-zn-hot to-zn-orange text-white text-xs font-display font-black uppercase tracking-wider group-hover:shadow-lg transition-all flex items-center gap-1.5 border-2 border-white/30 relative z-[2]" style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}>
            {ad.cta}
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </a>
    </motion.div>
  );
}

export function AdBannerSide({ ad }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.45);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="ad-banner-side"
    >
      <a href={ad.link} target="_blank" rel="noopener noreferrer" className="block group overflow-visible">
        <div className="newspaper-page comic-dots comic-panel-white comic-ad-side p-6 flex flex-col items-center justify-center text-center gap-3 transition-shadow hover:shadow-comic-heavy relative overflow-visible" style={{ '--ad-tilt': `${adTilt}deg` }}>
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-zn-hot to-zn-orange" />
          <AdLabel className="-top-2 -right-2" />
          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-zn-hot/10 blur-xl pointer-events-none" />
          <div className="w-16 h-16 rounded-full border-[4px] border-white outline outline-[3px] outline-[#1C1428] flex items-center justify-center bg-white relative z-[2]" style={{boxShadow:'3px 3px 0 #1C1428'}}>
            <span className="text-3xl">{ad.icon}</span>
          </div>
          <h4 className="font-display font-black text-zn-text tracking-wider uppercase relative z-[2]">{ad.title}</h4>
          <p className="text-sm text-zn-text-muted whitespace-pre-line relative z-[2]">{ad.subtitle}</p>
          <span className="mt-1 inline-block px-5 py-2 bg-gradient-to-r from-zn-hot to-zn-orange text-white text-xs font-display font-black uppercase tracking-wider group-hover:shadow-lg transition-all border-2 border-white/30 relative z-[2]" style={{boxShadow:'2px 2px 0 rgba(0,0,0,0.3)'}}>
            {ad.cta}
          </span>
        </div>
      </a>
    </motion.div>
  );
}

export function AdBannerInline({ ad }) {
  if (!ad) return null;
  const adTilt = getAdTilt(ad, 0.18);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="ad-banner ad-banner-inline my-4"
    >
      <a href={ad.link} target="_blank" rel="noopener noreferrer" className="block group overflow-visible">
        <div
          className="newspaper-page comic-dots comic-panel-white comic-ad-inline p-4 flex items-center justify-between gap-3 transition-shadow hover:shadow-comic-heavy relative overflow-visible"
          style={{ '--ad-tilt': `${adTilt}deg` }}
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange" />
          <AdLabel className="-top-2 -right-1" />
          <div className="flex items-center gap-3 relative z-[2]">
            <div className="w-10 h-10 rounded-full border-[3px] border-white outline outline-[2px] outline-[#1C1428] flex items-center justify-center bg-white shrink-0" style={{ boxShadow: '2px 2px 0 #1C1428' }}>
              <span className="text-xl">{ad.icon}</span>
            </div>
            <div>
              <h4 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{ad.title}</h4>
              <p className="text-xs text-zn-text-muted">{ad.subtitle}</p>
            </div>
          </div>
          <span className="text-xs font-display font-black text-white uppercase tracking-wider relative z-[2] px-3 py-1 border border-white/35 bg-gradient-to-r from-zn-hot to-zn-orange" style={{ boxShadow: '2px 2px 0 rgba(0,0,0,0.28)' }}>
            {ad.cta}
          </span>
        </div>
      </a>
    </motion.div>
  );
}
