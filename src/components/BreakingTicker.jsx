import { useArticlesData, useSettingsData } from '../context/DataContext';
import { shouldRenderDecorations } from '../utils/seasonalCampaigns';

export default function BreakingTicker() {
  const { loading } = useArticlesData();
  const { breaking, siteSettings } = useSettingsData();
  const items = Array.isArray(breaking) ? breaking.filter(Boolean) : [];
  const hasItems = items.length > 0;
  const shouldReserveSpace = loading && !hasItems;
  if (!hasItems && !shouldReserveSpace) return null;

  const tickerText = items.join('  ★  ');
  const mobileTickerText = items.slice(0, 3).join('  ★  ');
  const easterActive = shouldRenderDecorations(siteSettings);

  return (
    <div
      className={`breaking-strip border-y-4 border-black/20 comic-dots-red relative ${hasItems ? '' : 'pointer-events-none'}`}
      role={hasItems ? 'region' : undefined}
      aria-label={hasItems ? 'Извънредни новини' : undefined}
      aria-hidden={hasItems ? undefined : 'true'}
    >
      {/* Screen-reader accessible static version */}
      <div className="sr-only" aria-live={hasItems ? 'polite' : undefined}>
        Извънредни новини: {items.join('. ')}
      </div>

      <div className="max-w-[1400px] mx-auto relative z-[2] px-2 sm:px-3 md:px-0">
        <div className={`flex items-center gap-2 py-2 md:hidden ${hasItems ? '' : 'opacity-0'}`} aria-hidden="true">
          <span className={`shrink-0 rounded-full border-2 border-white/70 bg-black/20 px-2 py-0.5 text-[10px] font-display font-black uppercase tracking-[0.18em] text-white${easterActive ? ' inline-flex items-center gap-1' : ''}`}>
            {easterActive && (
              <img
                src="/easter/ticker-egg.svg"
                alt=""
                aria-hidden="true"
                className="inline-block w-3.5 h-5 -mt-0.5 shrink-0"
              />
            )}
            Извънредно
          </span>
          <div className="ticker-wrap min-w-0 flex-1">
            <div className="ticker-content text-white text-[12px] font-display font-bold uppercase tracking-[0.08em]">
              <span>{mobileTickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
              <span>{mobileTickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
            </div>
          </div>
        </div>

        <div className={`hidden md:block ticker-wrap py-2.5 ${hasItems ? '' : 'opacity-0'}`} aria-hidden="true">
          <div className="ticker-content text-white text-sm font-display font-bold uppercase tracking-wider">
            <span>{tickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
            <span>{tickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  );
}
