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
      bg: 'bg-indigo-950/30',
      border: 'border-indigo-800/20',
      text: 'text-indigo-800',
      letterBg: 'bg-indigo-900/30',
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
        text: 'text-emerald-100',
        letterBg: 'bg-emerald-500/30',
        glow: 'shadow-[0_0_26px_rgba(52,211,153,0.22)]',
        cursor: '',
        edge: 'bg-gradient-to-b from-emerald-300 to-emerald-500',
      };
    }
    if (isSelected) {
      return {
        bg: 'bg-red-500/18',
        border: 'border-red-400',
        text: 'text-red-100',
        letterBg: 'bg-red-500/30',
        glow: 'shadow-[0_0_26px_rgba(248,113,113,0.22)]',
        cursor: '',
        edge: 'bg-gradient-to-b from-red-300 to-red-500',
      };
    }
    return {
      bg: 'bg-indigo-900/28',
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
      text: 'text-amber-100',
      letterBg: 'bg-amber-500/30',
      glow: 'shadow-[0_0_24px_rgba(251,191,36,0.2)]',
      cursor: '',
      edge: 'bg-gradient-to-b from-amber-200 to-amber-500',
    };
  }

  return {
    bg: 'bg-indigo-900/42 hover:bg-indigo-800/54',
    border: 'border-indigo-600/50 hover:border-yellow-500/60',
    text: 'text-white',
    letterBg: 'bg-indigo-700/45',
    glow: 'hover:shadow-[0_12px_32px_rgba(15,23,42,0.35)]',
    cursor: 'cursor-pointer',
    edge: 'bg-gradient-to-b from-transparent via-yellow-300/70 to-transparent',
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
        className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-indigo-700/45 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(30,27,75,0.78))] p-5 shadow-[0_24px_70px_rgba(10,10,46,0.32)] md:p-7"
      >
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-gradient-to-b from-yellow-300 to-amber-500 rounded-r" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-gradient-to-b from-yellow-300 to-amber-500 rounded-l" />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-700/50 bg-indigo-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Въпрос {currentQ + 1} от {totalQ}
          </div>
          <div className="inline-flex items-center rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.28em] text-amber-200">
            {points}
          </div>
        </div>

        <h2 className="text-xl md:text-3xl font-black text-white leading-tight text-center font-display">
          {question.question}
        </h2>
      </motion.div>

      <motion.div
        key={`a-${currentQ}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {question.options.map((option, idx) => {
          const style = getOptionStyle(idx, selectedAnswer, revealPhase, question.correctIndex, eliminated);
          const isElim = eliminated.has(idx);

          return (
            <motion.button
              key={idx}
              onClick={() => isInteractive && !isElim && onSelectAnswer(idx)}
              disabled={!isInteractive || isElim}
              whileTap={isInteractive && !isElim ? { scale: 0.98 } : undefined}
              className={`relative w-full text-left transition-all duration-300 rounded-xl overflow-hidden border-2 ${style.border} ${style.bg} ${style.text} ${style.glow} ${style.cursor} ${isElim ? 'pointer-events-none' : ''}`}
              style={{ clipPath: HEX_CLIP }}
            >
              <div className={`absolute inset-y-3 left-0 w-1.5 ${style.edge}`} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%)] opacity-70" />

              <div className="relative flex items-center gap-3 px-8 py-4 md:py-5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.letterBg} border border-white/10 font-black text-sm`}>
                  {LETTERS[idx]}
                </span>
                <span className={`font-bold text-base md:text-lg leading-snug ${isElim ? 'opacity-20 line-through' : ''}`}>
                  {option}
                </span>
              </div>

              {revealPhase === 'locked' && selectedAnswer === idx && (
                <motion.div
                  className="absolute inset-0 bg-amber-300/8"
                  animate={{ opacity: [0.05, 0.32, 0.05] }}
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
          transition={{ delay: 0.3 }}
          className="mt-5 rounded-2xl border border-indigo-700/35 bg-indigo-950/50 p-4 shadow-[0_18px_32px_rgba(10,10,46,0.22)]"
        >
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-400">Обяснение</p>
          <p className="text-indigo-100 leading-relaxed">{question.explanation}</p>
        </motion.div>
      )}
    </div>
  );
}
