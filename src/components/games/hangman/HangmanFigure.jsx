const FIGURE_SEGMENTS = [
  'head',
  'body',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
  'pulse',
];

function getVisibleSegments(mistakes, maxMistakes) {
  if (mistakes <= 0) return 0;
  if (mistakes >= maxMistakes) return FIGURE_SEGMENTS.length;
  return Math.max(1, Math.ceil((mistakes / Math.max(1, maxMistakes)) * FIGURE_SEGMENTS.length));
}

export default function HangmanFigure({ mistakes = 0, maxMistakes = 7 }) {
  const visibleCount = getVisibleSegments(mistakes, maxMistakes);
  const visible = new Set(FIGURE_SEGMENTS.slice(0, visibleCount));
  const seg = (name) => `transition-opacity duration-300 ${visible.has(name) ? 'opacity-100' : 'opacity-0'}`;

  return (
    <div className="rounded-[32px] border border-orange-200/80 bg-gradient-to-b from-orange-50 via-white to-white p-5 shadow-[0_20px_50px_rgba(249,115,22,0.16)] dark:border-orange-950/50 dark:bg-gradient-to-b dark:from-zinc-900 dark:via-zinc-950 dark:to-black dark:shadow-none">
      <svg viewBox="0 0 120 160" className="mx-auto h-56 w-auto text-slate-900 dark:text-zinc-100">
        {/* Gallows */}
        <line x1="15" y1="150" x2="95" y2="150" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="35" y1="150" x2="35" y2="15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="35" y1="15" x2="75" y2="15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="75" y1="15" x2="75" y2="30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />

        {/* Head */}
        <circle cx="75" cy="44" r="14" fill="none" stroke="currentColor" strokeWidth="4" className={seg('head')} />

        {/* Body */}
        <line x1="75" y1="58" x2="75" y2="95" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className={seg('body')} />

        {/* Left Arm */}
        <line x1="75" y1="68" x2="55" y2="85" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className={seg('leftArm')} />

        {/* Right Arm */}
        <line x1="75" y1="68" x2="95" y2="85" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className={seg('rightArm')} />

        {/* Left Leg */}
        <line x1="75" y1="95" x2="55" y2="120" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className={seg('leftLeg')} />

        {/* Right Leg */}
        <line x1="75" y1="95" x2="95" y2="120" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className={seg('rightLeg')} />
      </svg>

      <div className={`mt-2 flex justify-center transition-opacity duration-300 ${visible.has('pulse') ? 'opacity-100' : 'opacity-0'}`}>
        <div className="rounded-full bg-rose-500/15 px-4 py-1 text-[11px] font-black uppercase tracking-[0.35em] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          Последен шанс
        </div>
      </div>
    </div>
  );
}
