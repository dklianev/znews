import { Eraser, Lightbulb, PencilLine, RefreshCw } from 'lucide-react';

const NOTES_LABEL = '\u0411\u0435\u043b\u0435\u0436\u043a\u0438';
const CLEAR_LABEL = '\u0418\u0437\u0447\u0438\u0441\u0442\u0438';
const HINT_LABEL = '\u041f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0430';
const NEW_GAME_LABEL = '\u041d\u043e\u0432\u0430 \u0438\u0433\u0440\u0430';

export default function SudokuKeypad({
  notesMode,
  onToggleNotes,
  onInputDigit,
  onClearCell,
  onHint,
  onNewGame,
  disabled = false,
  hintDisabled = false,
}) {
  return (
    <div className="w-full max-w-[620px] mx-auto mt-4 space-y-3">
      <div className="grid grid-cols-9 gap-1.5 sm:gap-2">
        {Array.from({ length: 9 }, (_, index) => index + 1).map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            onClick={() => onInputDigit(digit)}
            className="aspect-square border-2 border-[#1C1428] bg-white text-[#1C1428] font-black text-base sm:text-xl hover:bg-zn-hot hover:text-white transition-colors disabled:opacity-50 dark:border-[#5c667d] dark:bg-[#161826] dark:text-[#f4efe6] dark:hover:bg-[#ff5a36] dark:hover:text-white"
          >
            {digit}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleNotes}
          className={`inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] px-3 py-2 text-xs sm:text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50 dark:border-[#5c667d] ${notesMode
            ? 'bg-zn-purple text-white dark:bg-[#8b5cf6]'
            : 'bg-white text-[#1C1428] hover:bg-zn-purple hover:text-white dark:bg-[#161826] dark:text-[#f4efe6] dark:hover:bg-[#8b5cf6] dark:hover:text-white'}`}
        >
          <PencilLine className="w-4 h-4" />
          {NOTES_LABEL}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onClearCell}
          className="inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] bg-white px-3 py-2 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1C1428] hover:bg-zn-hot hover:text-white transition-colors disabled:opacity-50 dark:border-[#5c667d] dark:bg-[#161826] dark:text-[#f4efe6] dark:hover:bg-[#ff5a36] dark:hover:text-white"
        >
          <Eraser className="w-4 h-4" />
          {CLEAR_LABEL}
        </button>

        <button
          type="button"
          disabled={disabled || hintDisabled}
          onClick={onHint}
          className="inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] bg-white px-3 py-2 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1C1428] hover:bg-zn-orange hover:text-white transition-colors disabled:opacity-50 dark:border-[#5c667d] dark:bg-[#161826] dark:text-[#f4efe6] dark:hover:bg-[#ff8b3d] dark:hover:text-white"
        >
          <Lightbulb className="w-4 h-4" />
          {HINT_LABEL}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onNewGame}
          className="inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] bg-white px-3 py-2 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1C1428] hover:bg-zn-purple hover:text-white transition-colors disabled:opacity-50 dark:border-[#5c667d] dark:bg-[#161826] dark:text-[#f4efe6] dark:hover:bg-[#8b5cf6] dark:hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
          {NEW_GAME_LABEL}
        </button>
      </div>
    </div>
  );
}