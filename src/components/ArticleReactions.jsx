import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../utils/api';

const REACTIONS = [
  { key: 'fire', emoji: '🔥', label: 'ГОРЕЩО!', color: '#CC0A1A', bg: 'bg-red-500/10', activeBg: 'bg-red-500/20' },
  { key: 'shock', emoji: '😵‍💫', label: 'ШОК!', color: '#5B1A8C', bg: 'bg-purple-500/10', activeBg: 'bg-purple-500/20' },
  { key: 'laugh', emoji: '😂', label: 'ХА-ХА', color: '#E65100', bg: 'bg-orange-500/10', activeBg: 'bg-orange-500/20' },
  { key: 'skull', emoji: '💀', label: 'БРУТАЛНО', color: '#1C1428', bg: 'bg-zinc-500/10', activeBg: 'bg-zinc-500/20' },
  { key: 'clap', emoji: '👏', label: 'БРАВО!', color: '#2E7D32', bg: 'bg-green-500/10', activeBg: 'bg-green-500/20' },
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

function buildReacted(value) {
  return {
    fire: Boolean(value?.fire),
    shock: Boolean(value?.shock),
    laugh: Boolean(value?.laugh),
    skull: Boolean(value?.skull),
    clap: Boolean(value?.clap),
  };
}

export default function ArticleReactions({ articleId, reactions = {} }) {
  const [counts, setCounts] = useState(() => buildCounts(reactions));
  const [reacted, setReacted] = useState(() => buildReacted({}));
  const [popping, setPopping] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const busyRef = useRef(false);
  const prevReactionsRef = useRef(reactions);

  useEffect(() => {
    setCounts(buildCounts(reactions));
    setReacted(buildReacted({}));
    setPopping(null);
    setBusyKey(null);
    busyRef.current = false;
    prevReactionsRef.current = reactions;
  }, [articleId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevReactionsRef.current === reactions || busyRef.current) return;
    prevReactionsRef.current = reactions;
    setCounts(buildCounts(reactions));
  }, [reactions]);

  useEffect(() => {
    let cancelled = false;

    if (!articleId) {
      setReacted(buildReacted({}));
      return undefined;
    }

    api.articles.getReactionState(articleId)
      .then((payload) => {
        if (cancelled || busyRef.current) return;
        setReacted((prev) => {
          const serverReacted = buildReacted(payload?.reacted);
          return {
            fire: serverReacted.fire || prev.fire,
            shock: serverReacted.shock || prev.shock,
            laugh: serverReacted.laugh || prev.laugh,
            skull: serverReacted.skull || prev.skull,
            clap: serverReacted.clap || prev.clap,
          };
        });
      })
      .catch(() => {
        if (!cancelled) setReacted((prev) => prev);
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const handleReact = useCallback(async (key) => {
    if (busyRef.current || reacted[key]) return;

    busyRef.current = true;
    setBusyKey(key);
    setPopping(key);
    setReacted((prev) => ({ ...prev, [key]: true }));
    setCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }));
    window.setTimeout(() => setPopping(null), 600);

    try {
      const res = await api.articles.react(articleId, key);
      if (res?.reactions) setCounts(buildCounts(res.reactions));
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const isDuplicate = status === 429 && err?.payload?.error === 'Already reacted';
      setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
      if (isDuplicate) {
        setReacted((prev) => ({ ...prev, [key]: true }));
      } else {
        setReacted((prev) => ({ ...prev, [key]: false }));
      }
    } finally {
      busyRef.current = false;
      setBusyKey(null);
    }
  }, [articleId, reacted]);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="border-t-3 border-b-3 border-[#1C1428] py-4 my-6 relative">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-1 w-6 bg-zn-hot" />
        <span className="font-display font-black text-xs uppercase tracking-[0.2em] text-zn-text-dim">
          КАК РЕАГИРАШ?
        </span>
        <div className="h-0.5 flex-1 bg-gradient-to-r from-zn-border/50 to-transparent" />
        {total > 0 && (
          <span className="font-mono text-[10px] text-zn-text-dim">
            {total} реакции
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((reaction) => {
          const count = counts[reaction.key] || 0;
          const isReacted = reacted[reaction.key];
          const isBusy = busyKey === reaction.key;
          const isPop = popping === reaction.key;

          return (
            <motion.button
              key={reaction.key}
              type="button"
              onClick={() => handleReact(reaction.key)}
              disabled={isReacted || Boolean(busyKey)}
              whileHover={!isReacted && !busyKey ? { scale: 1.08, y: -2 } : undefined}
              whileTap={!isReacted && !busyKey ? { scale: 0.92 } : undefined}
              className={`
                relative flex items-center gap-1.5 px-3 py-2
                border-2 transition-all duration-200 select-none
                font-display font-black text-xs uppercase tracking-wider
                ${isReacted
                  ? `border-current ${reaction.activeBg} cursor-default`
                  : `border-[#1C1428] ${reaction.bg} ${busyKey ? 'opacity-70 cursor-wait' : 'hover:border-current comic-panel-hover cursor-pointer'}`
                }
              `}
              style={{
                color: isReacted ? reaction.color : undefined,
                boxShadow: isReacted ? `2px 2px 0 ${reaction.color}40` : '2px 2px 0 #1C1428',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={isPop ? 'pop' : 'idle'}
                  initial={isPop ? { scale: 1.8, rotate: -15 } : false}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  className="text-base leading-none"
                >
                  {reaction.emoji}
                </motion.span>
              </AnimatePresence>

              <span className="hidden sm:inline">
                {count > 0 ? `${reaction.label} ${formatCount(count)}` : reaction.label}
              </span>
              <span className="sm:hidden">
                {count > 0 ? formatCount(count) : ''}
              </span>

              {isBusy && (
                <span className="sr-only">Зареждане...</span>
              )}

              {isPop && (
                <div className="absolute inset-0 pointer-events-none overflow-visible">
                  {[...Array(6)].map((_, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 1, scale: 0.5, x: 0, y: 0 }}
                      animate={{
                        opacity: 0,
                        scale: 0,
                        x: (Math.random() - 0.5) * 50,
                        y: (Math.random() - 0.5) * 40 - 10,
                      }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: reaction.color }}
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
