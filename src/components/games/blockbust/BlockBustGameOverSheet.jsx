import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, Share2, Trophy } from 'lucide-react';

function fmt(value) {
  return String(Math.max(0, Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border-[2px] border-white/18 bg-black/14 px-3 py-2.5 text-center">
      <p className="text-[9px] font-display uppercase tracking-[0.22em] text-white/55">{label}</p>
      <p className="mt-1 text-lg font-black font-display text-white">{value}</p>
    </div>
  );
}

export default function BlockBustGameOverSheet({
  open,
  run,
  level,
  bestScore,
  theme,
  onRestart,
  onShare,
}) {
  const isNewRecord = run.score >= bestScore && run.score > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ scale: 0.72, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24, delay: 0.1 }}
            className="relative w-[360px] max-w-[94vw] overflow-hidden rounded-[2rem] border-[4px] border-[#1c1428] bg-[#f7f1e6] shadow-[8px_8px_0_#1c1428] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none"
          >
            <div
              className="border-b-[3px] border-[#1c1428] px-6 pb-5 pt-4 text-white dark:border-zinc-700"
              style={{ background: `linear-gradient(135deg, ${theme.ribbonFrom} 0%, ${theme.ribbonTo} 100%)` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-[10px] font-black uppercase tracking-[0.32em] text-white/72">Извънредно издание</p>
                  <p className="mt-2 font-display text-4xl font-black uppercase leading-none" style={{ textShadow: '0 3px 10px rgba(0,0,0,0.3)' }}>
                    Край на ръна
                  </p>
                </div>
                {isNewRecord ? (
                  <div className="rounded-full border-[3px] border-[#1c1428] bg-[#f7d046] px-3 py-2 text-[#1c1428] shadow-[3px_3px_0_#1c1428]">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      <span className="font-display text-[10px] font-black uppercase tracking-[0.2em]">Нов рекорд</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 rounded-[1.4rem] border-[3px] border-[#1c1428]/35 bg-white/18 px-5 py-4 backdrop-blur-[1px]">
                <p className="font-display text-[10px] font-black uppercase tracking-[0.26em] text-white/75">Краен резултат</p>
                <p className="mt-2 font-display text-6xl font-black leading-none text-white tabular-nums">
                  {fmt(run.score)}
                </p>
                <p className="mt-2 text-sm font-semibold text-white/72">
                  Най-добра тема: <span className="font-display text-white">{theme.name}</span>
                </p>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Ниво" value={level} />
                <Stat label="Ходове" value={run.moveCount} />
                <Stat label="Линии" value={run.totalLines} />
                <Stat label="Пълни изчиствания" value={run.fullWipes} />
              </div>

              <div className="rounded-[1.4rem] border-[3px] border-[#1c1428]/14 bg-[#efe7d8] px-4 py-4 text-[#1c1428] dark:border-zinc-700/80 dark:bg-zinc-900 dark:text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-[10px] font-black uppercase tracking-[0.22em] text-[#1c1428]/50 dark:text-zinc-400">Редакционна бележка</p>
                    <p className="mt-1 text-sm font-semibold text-[#1c1428]/72 dark:text-zinc-300">
                      {isNewRecord
                        ? 'Това е най-силният ти рън досега.'
                        : 'Още един ход и пак си в следващото издание.'}
                    </p>
                  </div>
                  <div className="rounded-full border-[2px] border-[#1c1428]/18 bg-white px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.18em] text-[#1c1428] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white">
                    Рекорд: {fmt(bestScore)}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onRestart}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border-[3px] border-[#1c1428] bg-[#1c1428] px-4 py-3 font-display text-sm font-black uppercase tracking-[0.18em] text-white shadow-[3px_3px_0_rgba(28,20,40,0.2)] transition-transform active:scale-[0.98]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Играй пак
                </button>
                <button
                  type="button"
                  onClick={onShare}
                  className="flex items-center justify-center rounded-xl border-[3px] border-[#1c1428] bg-white px-4 py-3 text-[#1c1428] shadow-[3px_3px_0_rgba(28,20,40,0.15)] transition-transform active:scale-[0.98] dark:bg-zinc-900 dark:text-white"
                  aria-label="Сподели резултата"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
