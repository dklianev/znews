import { useEffect, useRef } from 'react';

const TONE_STYLES = {
  sky: {
    frame: 'border-stone-200 dark:border-zinc-800',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
    active: 'border-sky-200 bg-sky-100/80 text-slate-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-white',
    hover: 'hover:bg-stone-50 dark:hover:bg-zinc-900/70',
  },
  amber: {
    frame: 'border-stone-200 dark:border-zinc-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    active: 'border-amber-200 bg-amber-100/80 text-slate-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-white',
    hover: 'hover:bg-stone-50 dark:hover:bg-zinc-900/70',
  },
};

function getEntryKey(entry) {
  return `${entry.direction}:${entry.row}:${entry.col}`;
}

export default function CrosswordCluePanel({
  title,
  tone = 'sky',
  entries = [],
  activeEntryKey = '',
  onSelect,
  className = '',
  scrollClass = 'max-h-[30rem]',
}) {
  const itemRefs = useRef(new Map());
  const palette = TONE_STYLES[tone] || TONE_STYLES.sky;

  useEffect(() => {
    const node = itemRefs.current.get(activeEntryKey);
    if (node?.scrollIntoView) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [activeEntryKey]);

  return (
    <section className={`overflow-hidden rounded-[24px] border bg-white dark:bg-[#111214] ${palette.frame} ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-black uppercase tracking-[0.28em] text-stone-700 dark:text-zinc-200">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${palette.badge}`}>
          {entries.length}
        </span>
      </div>

      <div className={`overflow-y-auto ${scrollClass}`}>
        {entries.length === 0 ? (
          <div className="px-4 py-6 text-sm text-stone-500 dark:text-zinc-400">Няма добавени улики в тази посока.</div>
        ) : (
          <ol className="divide-y divide-stone-100 dark:divide-zinc-900">
            {entries.map((entry) => {
              const key = getEntryKey(entry);
              const isActive = activeEntryKey === key;
              return (
                <li key={key}>
                  <button
                    ref={(node) => {
                      if (node) itemRefs.current.set(key, node);
                      else itemRefs.current.delete(key);
                    }}
                    type="button"
                    onClick={() => onSelect?.(entry)}
                    className={`grid w-full grid-cols-[40px_minmax(0,1fr)] gap-3 border-l-4 px-4 py-3 text-left transition-colors ${isActive
                      ? `${palette.active} border-l-slate-950 dark:border-l-white`
                      : `border-l-transparent text-stone-700 dark:text-zinc-200 ${palette.hover}`}`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black uppercase tracking-[0.22em] ${isActive ? 'bg-white/80 text-slate-900 dark:bg-black/30 dark:text-white' : 'bg-stone-100 text-stone-500 dark:bg-zinc-900 dark:text-zinc-500'}`}>
                      {entry.number}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold leading-snug">{entry.clue}</span>
                      <span className={`mt-1 block text-[11px] uppercase tracking-[0.22em] ${isActive ? 'text-stone-500 dark:text-zinc-300' : 'text-stone-400 dark:text-zinc-500'}`}>
                        {entry.length} букви  /  {entry.row + 1}:{entry.col + 1}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
