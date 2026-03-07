import { getCrosswordCellKey } from '../../../../shared/crossword.js';

function getBoardSizing(width) {
  const safeWidth = Math.max(1, width);
  if (safeWidth <= 4) return { maxWidth: `${safeWidth * 5.1}rem` };
  if (safeWidth <= 6) return { maxWidth: `${safeWidth * 4.55}rem` };
  if (safeWidth <= 8) return { maxWidth: `${safeWidth * 4}rem` };
  if (safeWidth <= 10) return { maxWidth: `${safeWidth * 3.55}rem` };
  return { maxWidth: `${safeWidth * 3.1}rem` };
}

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
  const height = Array.isArray(layoutRows) ? layoutRows.length : 0;
  const boardSizing = getBoardSizing(width);

  return (
    <section className="rounded-[30px] border border-stone-300 bg-white p-3 shadow-[0_20px_45px_rgba(28,25,23,0.08)] dark:border-zinc-800 dark:bg-[#141518] dark:shadow-none sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3 dark:border-zinc-800">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.32em] text-stone-500 dark:text-zinc-500">Мрежа</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-zinc-300">{width} колони  /  {height} реда</p>
        </div>
        <div className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.28em] text-stone-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          редакционен стил
        </div>
      </div>

      <div className="mx-auto w-full" style={getBoardSizing(width)}>
        <div className="grid gap-px bg-slate-950 p-[2px] shadow-[0_14px_35px_rgba(15,23,42,0.12)] dark:bg-stone-100" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
          {layoutRows.map((row, rowIndex) => Array.from(String(row || '')).map((cell, colIndex) => {
            if (cell === '#') {
              return <div key={`block-${rowIndex}-${colIndex}`} className="aspect-square bg-slate-950 dark:bg-stone-100" />;
            }

            const key = getCrosswordCellKey(rowIndex, colIndex);
            const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
            const isActive = activeCellKeys?.has(key);
            const isWrong = wrongCellKeys?.has(key);
            const value = String(grid?.[rowIndex]?.[colIndex] || '');
            const number = cellNumbers?.get(key);

            let stateClass = 'bg-white hover:bg-stone-100';
            if (isActive) stateClass = 'bg-sky-100 hover:bg-sky-100';
            if (isWrong) stateClass = 'bg-rose-100 hover:bg-rose-100';
            if (isSelected) stateClass = 'bg-amber-200 hover:bg-amber-200 ring-2 ring-inset ring-slate-950';

            return (
              <label
                key={key}
                className={`relative aspect-square cursor-text overflow-hidden ${stateClass}`}
              >
                {number ? (
                  <span className="absolute left-[5px] top-[3px] text-[10px] font-black leading-none text-stone-500">
                    {number}
                  </span>
                ) : null}
                <input
                  ref={(node) => getInputRef?.(rowIndex, colIndex, node)}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={1}
                  value={value}
                  onClick={() => onSelect?.(rowIndex, colIndex, true)}
                  onFocus={() => onSelect?.(rowIndex, colIndex, false)}
                  onChange={(event) => onInput?.(rowIndex, colIndex, event.target.value)}
                  onKeyDown={(event) => onKeyDown?.(event, rowIndex, colIndex)}
                  className="h-full w-full bg-transparent px-0 pb-[2px] text-center text-[clamp(1.05rem,2.4vw,2rem)] font-black uppercase tracking-[-0.04em] text-slate-950 outline-none [font-family:Georgia,'Times_New_Roman',serif]"
                  aria-label={`Клетка ${rowIndex + 1}, ${colIndex + 1}`}
                />
              </label>
            );
          }))}
        </div>
      </div>
    </section>
  );
}
