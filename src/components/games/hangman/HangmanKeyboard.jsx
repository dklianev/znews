export default function HangmanKeyboard({ rows = [], statuses = {}, usedLetters = [], disabled = false, onGuess }) {
  const usedLetterSet = new Set(Array.isArray(usedLetters) ? usedLetters : []);
  return (
    <div className="rounded-[32px] border border-stone-200 bg-white/90 p-4 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 dark:shadow-none">
      <div className="space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={`hangman-row-${rowIndex}`} className="flex flex-wrap justify-center gap-2">
            {row.map((letter) => {
              const status = statuses[letter] || 'idle';
              const isUsed = usedLetterSet.has(letter) || status !== 'idle';
              const classes = status === 'correct'
                ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-500 dark:bg-emerald-500'
                : status === 'miss'
                  ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200'
                  : 'border-stone-200 bg-stone-50 text-slate-900 hover:border-orange-400 hover:bg-orange-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:hover:border-orange-600 dark:hover:bg-zinc-800';

              return (
                <button
                  key={letter}
                  type="button"
                  disabled={disabled || isUsed}
                  onClick={() => onGuess(letter)}
                  className={`min-w-[44px] rounded-2xl border px-3 py-3 text-sm font-black uppercase tracking-[0.2em] transition-all disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-90 ${classes}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
