import { useData } from '../context/DataContext';

export default function BreakingTicker() {
  const { breaking } = useData();
  const items = Array.isArray(breaking) ? breaking.filter(Boolean) : [];
  if (items.length === 0) return null;
  const tickerText = items.join('  ★  ');

  return (
    <div className="breaking-strip border-y-4 border-black/20 comic-dots-red relative">
      <div className="max-w-6xl mx-auto relative z-[2] px-2 sm:px-3 md:px-0">
        <div className="ticker-wrap py-2.5">
          <div className="ticker-content text-white text-sm font-display font-bold uppercase tracking-wider">
            <span>{tickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
            <span>{tickerText}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  );
}
