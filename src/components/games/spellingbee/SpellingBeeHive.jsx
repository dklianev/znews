const HEX_POINTS = 'polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)';

const HIVE_POSITIONS = Object.freeze([
  { left: '50%', top: '12%' },
  { left: '77%', top: '28%' },
  { left: '77%', top: '60%' },
  { left: '50%', top: '76%' },
  { left: '23%', top: '60%' },
  { left: '23%', top: '28%' },
]);

const SIZE_VARIANTS = {
  md: {
    frame: 'relative mx-auto h-[240px] w-[240px] sm:h-[260px] sm:w-[260px]',
    cell: 'h-[72px] w-[84px] text-2xl',
    center: 'h-[80px] w-[92px] text-[2rem]',
  },
  lg: {
    frame: 'relative mx-auto h-[280px] w-[280px] sm:h-[320px] sm:w-[320px]',
    cell: 'h-[84px] w-[98px] text-[2rem] sm:h-[92px] sm:w-[106px] sm:text-[2.25rem]',
    center: 'h-[92px] w-[108px] text-[2.2rem] sm:h-[100px] sm:w-[116px] sm:text-[2.45rem]',
  },
};

function createLetterButton({ letter, active, isCenter, onSelectLetter, disabled, size }) {
  const baseClassName = [
    'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border text-center font-black uppercase transition-all duration-200',
    size,
    isCenter
      ? 'border-amber-400 bg-[linear-gradient(180deg,#fde68a,#f59e0b)] text-stone-950 shadow-[0_18px_40px_rgba(245,158,11,0.28)] dark:border-amber-300 dark:bg-[linear-gradient(180deg,#fbbf24,#f59e0b)] dark:text-black dark:shadow-[0_20px_48px_rgba(245,158,11,0.2)]'
      : 'border-stone-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.95))] text-stone-900 shadow-[0_16px_36px_rgba(41,37,36,0.12)] dark:border-zinc-700 dark:bg-[linear-gradient(180deg,rgba(39,39,42,0.98),rgba(24,24,27,0.98))] dark:text-zinc-100 dark:shadow-none',
    active
      ? 'scale-[1.04] ring-4 ring-amber-200 dark:ring-amber-500/40'
      : 'hover:scale-[1.03] hover:border-amber-400 dark:hover:border-amber-300',
    disabled ? 'cursor-default' : 'cursor-pointer',
  ].join(' ');

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled || typeof onSelectLetter !== 'function' || !letter) return;
        onSelectLetter(letter);
      }}
      className={baseClassName}
      style={{ clipPath: HEX_POINTS }}
      aria-label={isCenter ? 'Централна буква ' + letter : 'Буква ' + letter}
    >
      <span className="drop-shadow-[0_1px_0_rgba(255,255,255,0.28)] dark:drop-shadow-none">{letter || ''}</span>
    </button>
  );
}

export default function SpellingBeeHive({ centerLetter, outerLetters, activeLetters = [], onSelectLetter, disabled = false, size = 'lg' }) {
  const variant = SIZE_VARIANTS[size] || SIZE_VARIANTS.lg;
  const activeLetterSet = new Set(Array.isArray(activeLetters) ? activeLetters : []);
  const safeOuterLetters = Array.isArray(outerLetters) ? outerLetters : [];

  return (
    <div className={variant.frame} aria-label="Spelling Bee кошер">
      {HIVE_POSITIONS.map((position, index) => {
        const letter = safeOuterLetters[index] || '';
        return (
          <div key={`bee-outer-${index}`} style={position} className="absolute left-0 top-0">
            {createLetterButton({
              letter,
              active: activeLetterSet.has(letter),
              isCenter: false,
              onSelectLetter,
              disabled,
              size: variant.cell,
            })}
          </div>
        );
      })}

      <div className="absolute left-1/2 top-[44%]">
        {createLetterButton({
          letter: centerLetter || '',
          active: activeLetterSet.has(centerLetter),
          isCenter: true,
          onSelectLetter,
          disabled,
          size: variant.center,
        })}
      </div>
    </div>
  );
}
