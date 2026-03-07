import { getCrosswordCellKey } from '../../../../shared/crossword.js';

export default function CrosswordBoard({
  layoutRows = [],
  grid = [],
  cellNumbers,
  selectedCell,
  activeCellKeys,
  wrongCellKeys,
  onSelect,
  onInput,
  onKeyDown,
  getInputRef,
}) {
  const width = Array.isArray(layoutRows) && layoutRows.length > 0 ? String(layoutRows[0] || '').length : 0;

  return (
    <div className="rounded-[32px] border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 shadow-[0_30px_70px_rgba(79,70,229,0.12)] dark:border-indigo-950/60 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-950 dark:to-slate-950 dark:shadow-none">
      <div className="inline-grid gap-1.5 rounded-[28px] bg-slate-900/5 p-2 dark:bg-white/5" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 52px))` }}>
        {layoutRows.map((row, rowIndex) => Array.from(String(row || '')).map((cell, colIndex) => {
          if (cell === '#') {
            return <div key={`block-${rowIndex}-${colIndex}`} className="h-12 w-12 rounded-2xl bg-slate-900 shadow-inner dark:bg-zinc-100/95" />;
          }

          const key = getCrosswordCellKey(rowIndex, colIndex);
          const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
          const isActive = activeCellKeys?.has(key);
          const isWrong = wrongCellKeys?.has(key);
          const value = String(grid?.[rowIndex]?.[colIndex] || '');
          const number = cellNumbers?.get(key);

          return (
            <label
              key={key}
              className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border transition-all ${isWrong
                ? 'border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/60'
                : isSelected
                  ? 'border-indigo-500 bg-indigo-100 shadow-[0_0_0_3px_rgba(99,102,241,0.22)] dark:border-indigo-400 dark:bg-indigo-500/20'
                  : isActive
                    ? 'border-sky-300 bg-white dark:border-sky-700 dark:bg-zinc-900'
                    : 'border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'}`}
            >
              {number ? <span className="absolute left-1.5 top-1 text-[9px] font-black text-slate-500 dark:text-zinc-500">{number}</span> : null}
              <input
                ref={(node) => getInputRef?.(rowIndex, colIndex, node)}
                type="text"
                inputMode="text"
                maxLength={1}
                value={value}
                onClick={() => onSelect?.(rowIndex, colIndex, true)}
                onFocus={() => onSelect?.(rowIndex, colIndex, false)}
                onChange={(event) => onInput?.(rowIndex, colIndex, event.target.value)}
                onKeyDown={(event) => onKeyDown?.(event, rowIndex, colIndex)}
                className="h-full w-full bg-transparent text-center font-mono text-xl font-black uppercase text-slate-900 outline-none dark:text-white"
                aria-label={`Клетка ${rowIndex + 1}, ${colIndex + 1}`}
              />
            </label>
          );
        }))}
      </div>
    </div>
  );
}
