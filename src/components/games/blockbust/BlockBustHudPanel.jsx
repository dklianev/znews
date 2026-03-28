export default function BlockBustHudPanel({
  label,
  value,
  helper = null,
  accent = null,
  compact = false,
  className = '',
  children = null,
}) {
  const valueClass = compact ? 'text-sm' : 'text-lg';

  return (
    <div
      className={`rounded-[1.15rem] border-[2px] border-[#1c1428]/55 bg-white/82 px-3 py-2.5 shadow-[3px_3px_0_rgba(28,20,40,0.12)] backdrop-blur-[1px] dark:border-zinc-700/80 dark:bg-zinc-900/86 dark:shadow-none ${className}`}
    >
      <span className="block text-[9px] font-display uppercase tracking-[0.15em] text-[#1c1428]/48 dark:text-zinc-400">
        {label}
      </span>
      <div className={`mt-1 font-display font-black ${valueClass} leading-none`} style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {helper ? (
        <div className="mt-1 text-[10px] font-bold text-[#1c1428]/42 dark:text-zinc-500">
          {helper}
        </div>
      ) : null}
      {children}
    </div>
  );
}
