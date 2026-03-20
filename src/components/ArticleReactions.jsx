import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../utils/api';

const REACTIONS = [
  { key: 'fire', emoji: '🔥', label: 'ГОРЕЩО!', color: '#CC0A1A', bg: 'bg-red-500/10', activeBg: 'bg-red-500/20' },
  { key: 'shock', emoji: '😱', label: 'ШОК!', color: '#5B1A8C', bg: 'bg-purple-500/10', activeBg: 'bg-purple-500/20' },
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

export default function ArticleReactions({ articleId, reactions = {} }) {
  const [counts, setCounts] = useState(() => buildCounts(reactions));
  const [activeReaction, setActiveReaction] = useState(null);
  const [hasReacted, setHasReacted] = useState(false);
  const [popping, setPopping] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const busyRef = useRef(false);
  const prevReactionsRef = useRef(reactions);

  useEffect(() => {
    setCounts(buildCounts(reactions));
    setActiveReaction(null);
    setHasReacted(false);
    setPopping(null);
    setBusyAction(null);
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
      setActiveReaction(null);
      setHasReacted(false);
      return undefined;
    }

    api.articles.getReactionState(articleId)
      .then((payload) => {
        if (cancelled || busyRef.current) return;
        setActiveReaction(typeof payload?.activeReaction === 'string' ? payload.activeReaction : null);
        setHasReacted(Boolean(payload?.hasReacted));
      })
      .catch(() => {
        if (!cancelled) {
          setActiveReaction(null);
          setHasReacted(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const clearBurstLater = () => {
    window.setTimeout(() => setPopping(null), 600);
  };

  const handleReact = useCallback(async (key) => {
    if (busyRef.current || hasReacted) return;

    busyRef.current = true;
    setBusyAction(`react:${key}`);
    setPopping(key);
    setActiveReaction(key);
    setHasReacted(true);
    setCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }));
    clearBurstLater();

    try {
      const res = await api.articles.react(articleId, key);
      if (res?.reactions) setCounts(buildCounts(res.reactions));
      setActiveReaction(typeof res?.activeReaction === 'string' ? res.activeReaction : key);
      setHasReacted(Boolean(res?.hasReacted ?? true));
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 429) {
        setActiveReaction(typeof err?.payload?.activeReaction === 'string' ? err.payload.activeReaction : null);
        setHasReacted(true);
      } else {
        setActiveReaction(null);
        setHasReacted(false);
        setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
      }
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }, [articleId, hasReacted]);

  const handleRemove = useCallback(async () => {
    if (busyRef.current || !activeReaction) return;

    const key = activeReaction;
    busyRef.current = true;
    setBusyAction(`remove:${key}`);
    setActiveReaction(null);
    setHasReacted(true);
    setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));

    try {
      const res = await api.articles.removeReaction(articleId);
      if (res?.reactions) setCounts(buildCounts(res.reactions));
      setActiveReaction(typeof res?.activeReaction === 'string' ? res.activeReaction : null);
      setHasReacted(Boolean(res?.hasReacted ?? true));
    } catch {
      setActiveReaction(key);
      setHasReacted(true);
      setCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }));
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }, [activeReaction, articleId]);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const lockedAfterRemoval = hasReacted && !activeReaction;

  return (
    <div className="border-t-3 border-b-3 border-[#1C1428] py-4 my-6 relative">
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

      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((reaction) => {
          const count = counts[reaction.key] || 0;
          const isActive = activeReaction === reaction.key;
          const isPop = popping === reaction.key;
          const isBusy = Boolean(busyAction);
          const canRemove = isActive && !isBusy;
          const canAdd = !hasReacted && !isBusy;
          const disabled = !canRemove && !canAdd;

          return (
            <motion.button
              key={reaction.key}
              type="button"
              onClick={() => (isActive ? handleRemove() : handleReact(reaction.key))}
              disabled={disabled}
              whileHover={!disabled ? { scale: 1.08, y: -2 } : undefined}
              whileTap={!disabled ? { scale: 0.92 } : undefined}
              className={`
                relative flex items-center gap-1.5 px-3 py-2
                border-2 transition-all duration-200 select-none
                font-display font-black text-xs uppercase tracking-wider
                ${isActive
                  ? `border-current ${reaction.activeBg} cursor-pointer`
                  : `border-[#1C1428] ${reaction.bg} ${disabled ? 'opacity-60 cursor-default' : 'hover:border-current comic-panel-hover cursor-pointer'}`
                }
              `}
              style={{
                color: isActive ? reaction.color : undefined,
                boxShadow: isActive ? `2px 2px 0 ${reaction.color}40` : '2px 2px 0 #1C1428',
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

      {activeReaction && (
        <p className="mt-3 text-[11px] font-sans text-zn-text-dim">
          Натисни активната реакция, за да я махнеш.
        </p>
      )}
      {lockedAfterRemoval && (
        <p className="mt-3 text-[11px] font-sans text-zn-text-dim">
          Реакцията е премахната. Нов избор ще е възможен след изтичане на текущия прозорец.
        </p>
      )}
    </div>
  );
}
