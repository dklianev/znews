import { motion } from 'motion/react';

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
    };
  }

  if (isRevealed) {
    if (isCorrect) {
      return {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-400',
        text: 'text-emerald-300',
        letterBg: 'bg-emerald-500/30',
        glow: 'shadow-[0_0_20px_rgba(52,211,153,0.3)]',
        cursor: '',
      };
    }
    if (isSelected) {
      return {
        bg: 'bg-red-500/20',
        border: 'border-red-400',
        text: 'text-red-300',
        letterBg: 'bg-red-500/30',
        glow: 'shadow-[0_0_20px_rgba(248,113,113,0.3)]',
        cursor: '',
      };
    }
    return {
      bg: 'bg-indigo-900/30',
      border: 'border-indigo-700/30',
      text: 'text-indigo-500',
      letterBg: 'bg-indigo-800/30',
      glow: '',
      cursor: '',
    };
  }

  if (isLocked && isSelected) {
    return {
      bg: 'bg-amber-500/20',
      border: 'border-amber-400',
      text: 'text-amber-300',
      letterBg: 'bg-amber-500/30',
      glow: 'shadow-[0_0_20px_rgba(251,191,36,0.25)]',
      cursor: '',
    };
  }

  // Default: interactive state
  return {
    bg: 'bg-indigo-900/40 hover:bg-indigo-800/50',
    border: 'border-indigo-600/50 hover:border-yellow-500/60',
    text: 'text-white',
    letterBg: 'bg-indigo-700/40',
    glow: '',
    cursor: 'cursor-pointer',
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
      {/* Question */}
      <motion.div
        key={`q-${currentQ}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mb-6"
      >
        {/* Question container with hex shape feel */}
        <div className="relative bg-indigo-900/50 border border-indigo-700/40 rounded-2xl p-5 md:p-7 backdrop-blur-sm overflow-hidden">
          {/* Decorative side accents */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-r" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-l" />

          <h2 className="text-xl md:text-2xl font-black text-white leading-tight text-center font-display">
            {question.question}
          </h2>
        </div>
      </motion.div>

      {/* Answer grid: 2x2 diamond buttons */}
      <motion.div
        key={`a-${currentQ}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-2.5"
      >
        {question.options.map((option, idx) => {
          const style = getOptionStyle(idx, selectedAnswer, revealPhase, question.correctIndex, eliminated);
          const isElim = eliminated.has(idx);

          return (
            <motion.button
              key={idx}
              onClick={() => isInteractive && !isElim && onSelectAnswer(idx)}
              disabled={!isInteractive || isElim}
              whileTap={isInteractive && !isElim ? { scale: 0.97 } : undefined}
              className={`relative w-full text-left transition-all duration-300 rounded-xl overflow-hidden
                border-2 ${style.border} ${style.bg} ${style.text} ${style.glow} ${style.cursor}
                ${isElim ? 'pointer-events-none' : ''}`}
              style={{ clipPath: HEX_CLIP }}
            >
              <div className="flex items-center gap-3 px-8 py-4 md:py-5">
                {/* Letter badge */}
                <span className={`w-8 h-8 rounded-lg ${style.letterBg} flex items-center justify-center font-black text-sm shrink-0`}>
                  {LETTERS[idx]}
                </span>
                <span className={`font-bold text-base md:text-lg leading-snug ${isElim ? 'opacity-20' : ''}`}>
                  {option}
                </span>
              </div>

              {/* Locked pulse animation */}
              {revealPhase === 'locked' && selectedAnswer === idx && (
                <motion.div
                  className="absolute inset-0 bg-amber-400/10"
                  animate={{ opacity: [0, 0.3, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Explanation after reveal */}
      {revealPhase === 'revealed' && question.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-5 p-4 rounded-xl bg-indigo-900/40 border border-indigo-700/30"
        >
          <p className="text-indigo-300 text-sm">{question.explanation}</p>
        </motion.div>
      )}
    </div>
  );
}
