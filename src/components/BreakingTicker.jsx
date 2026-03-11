import { usePublicData } from '../context/DataContext';

export default function BreakingTicker() {
  const { breaking } = usePublicData();
  const items = Array.isArray(breaking) ? breaking.filter(Boolean) : [];
  if (items.length === 0) return null;
  const tickerText = items.join('  ★  ');

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
        <div className="ticker-wrap py-2.5" aria-hidden="true">
          <div className="ticker-content text-white text-sm font-display font-bold uppercase tracking-wider">
            <span>{tickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
            <span>{tickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  );
}
