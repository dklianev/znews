import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export default function EasterHuntBadge({
  collected,
  total,
  isComplete,
  rewardText,
  showProgress,
  badgeDismissed,
  onDismiss,
}) {
  if (!showProgress || badgeDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed bottom-4 left-4 z-[60] pointer-events-auto"
      >
        <div
          className={`relative flex items-center gap-2.5 px-4 py-2.5 border-3 border-[#1C1428] bg-white font-display text-sm uppercase tracking-wider ${isComplete ? 'bg-amber-50' : ''}`}
          style={{ boxShadow: '3px 3px 0 #1C1428' }}
        >
          <img
            src="/easter/egg-gold.svg"
            alt=""
            aria-hidden="true"
            className="w-6 h-9 shrink-0"
          />
          <div className="flex flex-col gap-0.5">
            {isComplete ? (
              <motion.span
                initial={{ scale: 0.8 }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="font-black text-zn-hot text-xs"
              >
                {rewardText}
              </motion.span>
            ) : (
              <span className="font-bold text-zn-black">
                {collected.size}/{total}
              </span>
            )}
            {!isComplete && (
              <div className="w-20 h-1.5 bg-gray-200 overflow-hidden">
                <motion.div
                  className="h-full bg-zn-purple"
                  initial={{ width: 0 }}
                  animate={{ width: `${(collected.size / total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="ml-1 p-0.5 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Скрий прогреса"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
