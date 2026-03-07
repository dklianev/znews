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

  return (
    <div className="relative h-72 w-52 rounded-[32px] border border-orange-200/80 bg-gradient-to-b from-orange-50 via-white to-white p-4 shadow-[0_20px_50px_rgba(249,115,22,0.16)] dark:border-orange-950/50 dark:bg-gradient-to-b dark:from-zinc-900 dark:via-zinc-950 dark:to-black dark:shadow-none">
      <div className="absolute left-10 bottom-8 h-2 w-32 rounded-full bg-orange-300/70 dark:bg-orange-900/60" />
      <div className="absolute left-14 bottom-8 h-48 w-2 rounded-full bg-slate-900 dark:bg-zinc-100" />
      <div className="absolute left-14 top-8 h-2 w-24 rounded-full bg-slate-900 dark:bg-zinc-100" />
      <div className="absolute right-[56px] top-8 h-10 w-2 rounded-full bg-slate-900 dark:bg-zinc-100" />

      <div className={`absolute right-10 top-[72px] h-12 w-12 rounded-full border-[5px] border-slate-900 transition-all duration-300 dark:border-zinc-100 ${visible.has('head') ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`} />
      <div className={`absolute right-[33px] top-[118px] h-16 w-2 rounded-full bg-slate-900 transition-all duration-300 dark:bg-zinc-100 ${visible.has('body') ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute right-[33px] top-[132px] h-2 w-14 origin-right -rotate-[25deg] rounded-full bg-slate-900 transition-all duration-300 dark:bg-zinc-100 ${visible.has('leftArm') ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute right-[21px] top-[132px] h-2 w-14 origin-left rotate-[25deg] rounded-full bg-slate-900 transition-all duration-300 dark:bg-zinc-100 ${visible.has('rightArm') ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute right-[34px] top-[181px] h-2 w-14 origin-right -rotate-[35deg] rounded-full bg-slate-900 transition-all duration-300 dark:bg-zinc-100 ${visible.has('leftLeg') ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute right-[20px] top-[181px] h-2 w-14 origin-left rotate-[35deg] rounded-full bg-slate-900 transition-all duration-300 dark:bg-zinc-100 ${visible.has('rightLeg') ? 'opacity-100' : 'opacity-0'}`} />

      <div className={`absolute inset-x-8 bottom-5 flex justify-center transition-opacity duration-300 ${visible.has('pulse') ? 'opacity-100' : 'opacity-0'}`}>
        <div className="rounded-full bg-rose-500/15 px-4 py-1 text-[11px] font-black uppercase tracking-[0.35em] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          Последен шанс
        </div>
      </div>
    </div>
  );
}
