import { usePublicData } from '../context/DataContext';
import { shouldRenderDecorations } from '../utils/seasonalCampaigns';

const EasterTickerEgg = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 20" className="inline-block w-3.5 h-5 -mt-0.5" aria-hidden="true">
    <path d="M13,9.7c0.4,5.4-2.7,8.3-6.2,8.3S-0.4,15.1,0.1,9.7C0.6,4.1,4.3,0.1,6.3,0.1C8.2,0.1,12.6,4.2,13,9.7z" fill="#CC0A1A" stroke="#7E0711" strokeWidth="0.8"/>
    <rect x="-0.5" y="8.4" width="14.5" height="3.4" fill="#E87420" opacity="0.9"/>
    <path d="M2.3,2.7C1,4.6,1,8.5,1.8,11.4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.35"/>
  </svg>
);

export default function BreakingTicker() {
  const { breaking, siteSettings } = usePublicData();
  const items = Array.isArray(breaking) ? breaking.filter(Boolean) : [];
  if (items.length === 0) return null;

  const tickerText = items.join('  ★  ');
  const mobileTickerText = items.slice(0, 3).join('  ★  ');

  return (
    <div
      className="breaking-strip border-y-4 border-black/20 comic-dots-red relative"
      role="region"
      aria-label="Извънредни новини"
    >
      {/* Screen-reader accessible static version */}
      <div className="sr-only" aria-live="polite">
        Извънредни новини: {items.join('. ')}
      </div>

      <div className="max-w-6xl mx-auto relative z-[2] px-2 sm:px-3 md:px-0">
        <div className="flex items-center gap-2 py-2 md:hidden" aria-hidden="true">
          <span className="shrink-0 rounded-full border-2 border-white/70 bg-black/20 px-2 py-0.5 text-[10px] font-display font-black uppercase tracking-[0.18em] text-white inline-flex items-center gap-1">
            {shouldRenderDecorations(siteSettings) && <EasterTickerEgg />}
            Извънредно
          </span>
          <div className="ticker-wrap min-w-0 flex-1">
            <div className="ticker-content text-white text-[12px] font-display font-bold uppercase tracking-[0.08em]">
              <span>{mobileTickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
              <span>{mobileTickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
            </div>
          </div>
        </div>

        <div className="hidden md:block ticker-wrap py-2.5" aria-hidden="true">
          <div className="ticker-content text-white text-sm font-display font-bold uppercase tracking-wider">
            <span>{tickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
            <span>{tickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  );
}
