import { Eraser, Lightbulb, PencilLine, RefreshCw } from 'lucide-react';

export default function SudokuKeypad({
  notesMode,
  onToggleNotes,
  onInputDigit,
  onClearCell,
  onHint,
  onNewGame,
  disabled = false,
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
            className="aspect-square border-2 border-[#1C1428] bg-white text-[#1C1428] font-black text-base sm:text-xl hover:bg-zn-hot hover:text-white transition-colors disabled:opacity-50"
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
          className={`inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] px-3 py-2 text-xs sm:text-sm font-black uppercase tracking-wider transition-colors disabled:opacity-50 ${notesMode
            ? 'bg-zn-purple text-white'
            : 'bg-white text-[#1C1428] hover:bg-zn-purple hover:text-white'}`}
        >
          <PencilLine className="w-4 h-4" />
          Notes
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onClearCell}
          className="inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] bg-white px-3 py-2 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1C1428] hover:bg-zn-hot hover:text-white transition-colors disabled:opacity-50"
        >
          <Eraser className="w-4 h-4" />
          Clear
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onHint}
          className="inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] bg-white px-3 py-2 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1C1428] hover:bg-zn-orange hover:text-white transition-colors disabled:opacity-50"
        >
          <Lightbulb className="w-4 h-4" />
          Hint
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onNewGame}
          className="inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] bg-white px-3 py-2 text-xs sm:text-sm font-black uppercase tracking-wider text-[#1C1428] hover:bg-zn-purple hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          New
        </button>
      </div>
    </div>
  );
}
