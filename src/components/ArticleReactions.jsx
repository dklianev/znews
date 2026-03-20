import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../utils/api';

const REACTIONS = [
  { key: 'fire',  emoji: '🔥', label: 'ГОРЕЩО!',  color: '#CC0A1A', bg: 'bg-red-500/10',    activeBg: 'bg-red-500/20' },
  { key: 'shock', emoji: '😱', label: 'ШОК!',     color: '#5B1A8C', bg: 'bg-purple-500/10', activeBg: 'bg-purple-500/20' },
  { key: 'laugh', emoji: '😂', label: 'ХА-ХА',    color: '#E65100', bg: 'bg-orange-500/10', activeBg: 'bg-orange-500/20' },
  { key: 'skull', emoji: '💀', label: 'БРУTAL',    color: '#1C1428', bg: 'bg-zinc-500/10',   activeBg: 'bg-zinc-500/20' },
  { key: 'clap',  emoji: '👏', label: 'БРАВО!',    color: '#2E7D32', bg: 'bg-green-500/10',  activeBg: 'bg-green-500/20' },
];

function formatCount(n) {
  if (!n || n <= 0) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function buildCounts(reactions) {
  return {
    fire: reactions?.fire || 0,
    shock: reactions?.shock || 0,
    laugh: reactions?.laugh || 0,
    skull: reactions?.skull || 0,
    clap: reactions?.clap || 0,
  };
}

export default function ArticleReactions({ articleId, reactions = {} }) {
  const [counts, setCounts] = useState(() => buildCounts(reactions));
  const [reacted, setReacted] = useState({});
  const [popping, setPopping] = useState(null);
  const cooldownRef = useRef({});

  // Reset state when navigating to a different article
  useEffect(() => {
    setCounts(buildCounts(reactions));
    setReacted({});
    setPopping(null);
    cooldownRef.current = {};
  }, [articleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReact = useCallback(async (key) => {
    if (reacted[key] || cooldownRef.current[key]) return;

    cooldownRef.current[key] = true;
    setPopping(key);
    setReacted((prev) => ({ ...prev, [key]: true }));
    setCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }));

    setTimeout(() => setPopping(null), 600);

    try {
      const res = await api.articles.react(articleId, key);
      if (res.reactions) {
        setCounts(res.reactions);
      }
    } catch (err) {
      // 429 = already reacted — keep optimistic state
      // Any other error = rollback
      const status = err?.status || err?.response?.status;
      if (status !== 429) {
        setReacted((prev) => ({ ...prev, [key]: false }));
        setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
      }
    }

    setTimeout(() => { cooldownRef.current[key] = false; }, 2000);
  }, [articleId, reacted]);

  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  return (
    <div className="border-t-3 border-b-3 border-[#1C1428] py-4 my-6 relative">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-1 w-6 bg-zn-hot" />
        <span className="font-display font-black text-xs uppercase tracking-[0.2em] text-zn-text-dim">
          Как реагираш?
        </span>
        <div className="h-0.5 flex-1 bg-gradient-to-r from-zn-border/50 to-transparent" />
        {total > 0 && (
          <span className="font-mono text-[10px] text-zn-text-dim">
            {total} реакции
          </span>
        )}
      </div>

      {/* Reaction buttons */}
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((r) => {
          const count = counts[r.key] || 0;
          const isReacted = reacted[r.key];
          const isPop = popping === r.key;

          return (
            <motion.button
              key={r.key}
              type="button"
              onClick={() => handleReact(r.key)}
              disabled={isReacted}
              whileHover={!isReacted ? { scale: 1.08, y: -2 } : undefined}
              whileTap={!isReacted ? { scale: 0.92 } : undefined}
              className={`
                relative flex items-center gap-1.5 px-3 py-2
                border-2 transition-all duration-200 select-none
                font-display font-black text-xs uppercase tracking-wider
                ${isReacted
                  ? `border-current ${r.activeBg} cursor-default`
                  : `border-[#1C1428] ${r.bg} hover:border-current comic-panel-hover cursor-pointer`
                }
              `}
              style={{
                color: isReacted ? r.color : undefined,
                boxShadow: isReacted ? `2px 2px 0 ${r.color}40` : '2px 2px 0 #1C1428',
              }}
            >
              {/* Emoji with pop animation */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={isPop ? 'pop' : 'idle'}
                  initial={isPop ? { scale: 1.8, rotate: -15 } : false}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  className="text-base leading-none"
                >
                  {r.emoji}
                </motion.span>
              </AnimatePresence>

              {/* Label or count */}
              <span className="hidden sm:inline">
                {count > 0 ? `${r.label} ${formatCount(count)}` : r.label}
              </span>
              <span className="sm:hidden">
                {count > 0 ? formatCount(count) : ''}
              </span>

              {/* Reaction burst particles */}
              {isPop && (
                <div className="absolute inset-0 pointer-events-none overflow-visible">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 1, scale: 0.5, x: 0, y: 0 }}
                      animate={{
                        opacity: 0,
                        scale: 0,
                        x: (Math.random() - 0.5) * 50,
                        y: (Math.random() - 0.5) * 40 - 10,
                      }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
