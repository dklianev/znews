import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

const LETTERS = ['A', 'B', 'C', 'D'];
const HEX_CLIP = 'polygon(4% 50%, 12% 0%, 88% 0%, 96% 50%, 88% 100%, 12% 100%)';

function getOptionStyle(idx, selectedAnswer, revealPhase, correctIndex, eliminated) {
  const isEliminated = eliminated.has(idx);
  const isSelected = selectedAnswer === idx;
  const isCorrect = idx === correctIndex;
  const isLocked = revealPhase === 'locked';
  const isRevealed = revealPhase === 'revealed';

  if (isEliminated) {
    return {
      bg: 'bg-indigo-950/35',
      border: 'border-indigo-900/35',
      text: 'text-indigo-700',
      letterBg: 'bg-indigo-900/35',
      glow: '',
      cursor: 'cursor-default',
      edge: 'bg-transparent',
    };
  }

  if (isRevealed) {
    if (isCorrect) {
      return {
        bg: 'bg-emerald-500/18',
        border: 'border-emerald-400',
        text: 'text-emerald-50',
        letterBg: 'bg-emerald-500/26',
        glow: 'shadow-[0_0_28px_rgba(52,211,153,0.22)]',
        cursor: '',
        edge: 'bg-gradient-to-b from-emerald-300 to-emerald-500',
      };
    }
    if (isSelected) {
      return {
        bg: 'bg-red-500/18',
        border: 'border-red-400',
        text: 'text-red-50',
        letterBg: 'bg-red-500/26',
        glow: 'shadow-[0_0_28px_rgba(248,113,113,0.22)]',
        cursor: '',
        edge: 'bg-gradient-to-b from-red-300 to-red-500',
      };
    }
    return {
      bg: 'bg-indigo-900/32',
      border: 'border-indigo-700/30',
      text: 'text-indigo-400',
      letterBg: 'bg-indigo-800/30',
      glow: '',
      cursor: '',
      edge: 'bg-transparent',
    };
  }

  if (isLocked && isSelected) {
    return {
      bg: 'bg-amber-500/18',
      border: 'border-amber-400',
      text: 'text-amber-50',
      letterBg: 'bg-amber-500/26',
      glow: 'shadow-[0_0_26px_rgba(251,191,36,0.2)]',
      cursor: '',
      edge: 'bg-gradient-to-b from-amber-200 to-amber-500',
    };
  }

  return {
    bg: 'bg-indigo-900/45 hover:bg-indigo-800/55',
    border: 'border-indigo-600/45 hover:border-yellow-400/60',
    text: 'text-white',
    letterBg: 'bg-indigo-700/45',
    glow: 'hover:shadow-[0_16px_36px_rgba(15,23,42,0.34)]',
    cursor: 'cursor-pointer',
    edge: 'bg-gradient-to-b from-transparent via-yellow-300/75 to-transparent',
  };
}

export default function QuizQuestionCard({
  question,
  currentQ,
  totalQ,
  selectedAnswer,
  revealPhase,
  eliminated,
  onSelectAnswer,
  points,
}) {
  const isInteractive = selectedAnswer === null;

  return (
    <div className="w-full">
      <motion.div
        key={`q-${currentQ}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mb-6 overflow-hidden rounded-[2rem] border border-indigo-700/50 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(30,27,75,0.84))] p-5 shadow-[0_28px_80px_rgba(10,10,46,0.36)] md:p-8"
      >
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
        <div className="absolute left-0 top-1/2 h-24 w-1.5 -translate-y-1/2 rounded-r bg-gradient-to-b from-yellow-300 to-amber-500" />
        <div className="absolute right-0 top-1/2 h-24 w-1.5 -translate-y-1/2 rounded-l bg-gradient-to-b from-yellow-300 to-amber-500" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.08),transparent_40%)]" />

        <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-700/55 bg-indigo-900/60 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.3em] text-indigo-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Въпрос {currentQ + 1} от {totalQ}
          </div>
          <div className="inline-flex items-center rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.28em] text-amber-100">
            Играеш за {points}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.65rem] border border-indigo-700/45 bg-indigo-950/35 px-5 py-6 text-center md:px-8 md:py-8">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.32em] text-indigo-400">В центъра на вниманието</p>
          <h2 className="text-xl font-black leading-tight text-white font-display md:text-[2rem]">
            {question.question}
          </h2>
        </div>
      </motion.div>

      <motion.div
        key={`a-${currentQ}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        {question.options.map((option, idx) => {
          const style = getOptionStyle(idx, selectedAnswer, revealPhase, question.correctIndex, eliminated);
          const isEliminated = eliminated.has(idx);

          return (
            <motion.button
              key={idx}
              onClick={() => isInteractive && !isEliminated && onSelectAnswer(idx)}
              disabled={!isInteractive || isEliminated}
              whileTap={isInteractive && !isEliminated ? { scale: 0.985 } : undefined}
              className={`relative overflow-hidden rounded-xl border-2 text-left transition-all duration-300 ${style.border} ${style.bg} ${style.text} ${style.glow} ${style.cursor} ${isEliminated ? 'pointer-events-none' : ''}`}
              style={{ clipPath: HEX_CLIP }}
            >
              <div className={`absolute inset-y-3 left-0 w-1.5 ${style.edge}`} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_38%)] opacity-80" />
              <div className="relative flex items-center gap-3 px-8 py-4 md:py-5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-sm font-black ${style.letterBg}`}>
                  {LETTERS[idx]}
                </span>
                <span className={`text-base font-bold leading-snug md:text-lg ${isEliminated ? 'line-through opacity-25' : ''}`}>
                  {option}
                </span>
              </div>

              {revealPhase === 'locked' && selectedAnswer === idx && (
                <motion.div
                  className="absolute inset-0 bg-amber-300/10"
                  animate={{ opacity: [0.08, 0.34, 0.08] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {revealPhase === 'revealed' && question.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-5 rounded-[1.6rem] border border-indigo-700/35 bg-indigo-950/55 p-4 shadow-[0_18px_32px_rgba(10,10,46,0.22)]"
        >
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400">Защо това е верният отговор</p>
          <p className="leading-relaxed text-indigo-100">{question.explanation}</p>
        </motion.div>
      )}
    </div>
  );
}
