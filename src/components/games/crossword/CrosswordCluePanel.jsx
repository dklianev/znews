export default function CrosswordCluePanel({ title, tone = 'indigo', entries = [], activeEntryKey = '', onSelect }) {
  const toneClasses = tone === 'rose'
    ? 'from-rose-500/10 to-orange-500/10 border-rose-200/70 dark:border-rose-950/50'
    : 'from-indigo-500/10 to-sky-500/10 border-indigo-200/70 dark:border-indigo-950/50';

  return (
    <section className={`rounded-[32px] border bg-gradient-to-br ${toneClasses} p-5 dark:from-zinc-900 dark:to-zinc-950`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-700 dark:text-zinc-200">{title}</h3>
        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
          {entries.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {entries.map((entry) => {
          const key = `${entry.direction}:${entry.row}:${entry.col}`;
          const isActive = activeEntryKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect?.(entry)}
              className={`w-full rounded-3xl border px-4 py-3 text-left transition-all ${isActive
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-black'
                : 'border-white/70 bg-white/90 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 min-w-[32px] rounded-full px-2 py-1 text-center text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? 'bg-white/15 text-white dark:bg-black/10 dark:text-black' : 'bg-slate-900/5 text-slate-500 dark:bg-white/5 dark:text-zinc-400'}`}>
                  {entry.number}
                </span>
                <div>
                  <p className="text-sm font-semibold leading-snug">{entry.clue}</p>
                  <p className={`mt-1 text-[11px] uppercase tracking-[0.25em] ${isActive ? 'text-white/70 dark:text-black/60' : 'text-slate-400 dark:text-zinc-500'}`}>
                    {entry.length} букви • {entry.row + 1}:{entry.col + 1}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
