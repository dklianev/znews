import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import EasterEgg from './EasterEgg';

export default function CollectibleEasterEgg({
  eggId,
  variant = 'egg-red',
  size = 'md',
  isCollected,
  onCollect,
}) {
  const [justCollected, setJustCollected] = useState(false);

  const handleClick = () => {
    if (isCollected || justCollected) return;
    setJustCollected(true);
    onCollect(eggId);
  };

  const collected = isCollected || justCollected;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={collected}
      className={`relative cursor-pointer transition-transform hover:scale-110 active:scale-95 disabled:cursor-default disabled:hover:scale-100 ${collected ? 'opacity-30' : ''}`}
      aria-label={collected ? 'Яйцето е събрано' : 'Събери това великденско яйце'}
    >
      <motion.div
        animate={justCollected ? { scale: [1, 1.4, 1], rotate: [0, 15, -15, 0] } : {}}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <EasterEgg variant={variant} size={size} className="pointer-events-none" />
      </motion.div>

      <AnimatePresence>
        {justCollected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -20 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2"
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#1C1428] bg-amber-300 font-display text-sm font-black text-[#1C1428]"
              style={{ boxShadow: '2px 2px 0 #1C1428' }}
              aria-hidden="true"
            >
              ✓
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
