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
  const [stateLoading, setStateLoading] = useState(Boolean(articleId));
  const busyRef = useRef(false);
  const prevReactionsRef = useRef(reactions);

  useEffect(() => {
    setCounts(buildCounts(reactions));
    setReacted(buildReacted({}));
    setPopping(null);
    setBusyKey(null);
    setStateLoading(Boolean(articleId));
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
      setStateLoading(false);
      return undefined;
    }

    setStateLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) setStateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const handleReact = useCallback(async (key) => {
    if (stateLoading || busyRef.current) return;

    const removing = reacted[key];
    busyRef.current = true;
    setBusyKey(key);
    if (removing) {
      setReacted((prev) => ({ ...prev, [key]: false }));
      setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
    } else {
      setPopping(key);
      setReacted((prev) => ({ ...prev, [key]: true }));
      setCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }));
      window.setTimeout(() => setPopping(null), 600);
    }

    try {
      const res = removing
        ? await api.articles.removeReaction(articleId, key)
        : await api.articles.react(articleId, key);
      if (res?.reactions) setCounts(buildCounts(res.reactions));
      if (res?.reacted) setReacted(buildReacted(res.reacted));
    } catch (err) {
      if (removing) {
        if (err?.payload?.reactions) {
          setCounts(buildCounts(err.payload.reactions));
        } else {
          setCounts((prev) => ({ ...prev, [key]: prev[key] + 1 }));
        }
        if (err?.payload?.reacted) {
          setReacted(buildReacted(err.payload.reacted));
        } else {
          setReacted((prev) => ({ ...prev, [key]: true }));
        }
      } else {
        const status = err?.status || err?.response?.status;
        const isDuplicate = status === 429 && err?.payload?.error === 'Already reacted';
        setCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
        if (err?.payload?.reactions) {
          setCounts(buildCounts(err.payload.reactions));
        }
        if (err?.payload?.reacted) {
          setReacted(buildReacted(err.payload.reacted));
        } else if (isDuplicate) {
          setReacted((prev) => ({ ...prev, [key]: true }));
        } else {
          setReacted((prev) => ({ ...prev, [key]: false }));
        }
      }
    } finally {
      busyRef.current = false;
      setBusyKey(null);
    }
  }, [articleId, reacted, stateLoading]);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="border-t-3 border-b-3 border-[#1C1428] py-4 my-6 relative [overflow-anchor:none]">
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

      <div className="grid grid-cols-5 gap-2">
        {REACTIONS.map((reaction) => {
          const count = counts[reaction.key] || 0;
          const isReacted = reacted[reaction.key];
          const isBusy = busyKey === reaction.key;
          const isPop = popping === reaction.key;
          const isDisabled = stateLoading || Boolean(busyKey);

          return (
            <motion.button
              key={reaction.key}
              type="button"
              onClick={() => handleReact(reaction.key)}
              disabled={isDisabled}
              whileHover={!isDisabled ? { scale: 1.08, y: -2 } : undefined}
              whileTap={!isDisabled ? { scale: 0.92 } : undefined}
              className={`
                relative flex min-w-0 min-h-[48px] items-center justify-center gap-1 px-2 py-2
                border-2 transition-all duration-200 select-none
                font-display font-black text-xs uppercase tracking-wider
                ${isReacted
                  ? `border-current ${reaction.activeBg} ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`
                  : `border-[#1C1428] ${reaction.bg} ${isDisabled ? 'opacity-70 cursor-default' : 'hover:border-current comic-panel-hover cursor-pointer'}`
                }
                sm:justify-start sm:gap-1.5 sm:px-3
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

              <span className="hidden min-w-0 sm:inline">
                {reaction.label}
              </span>
              <span className="min-w-[2ch] text-center font-mono tabular-nums sm:min-w-[3ch]">
                {count > 0 ? formatCount(count) : ''}
              </span>

              {isBusy && (
                <span className="sr-only">Зареждане...</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
