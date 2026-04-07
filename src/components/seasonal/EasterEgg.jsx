const SIZE_MAP = {
  sm: 'w-10 h-[60px]',
  md: 'w-14 h-[84px]',
  lg: 'w-20 h-[120px]',
};

export default function EasterEgg({ variant = 'egg-red', size = 'md', className = '' }) {
  return (
    <img
      src={`/easter/${variant}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`pointer-events-none select-none ${SIZE_MAP[size] || SIZE_MAP.md} ${className}`}
    />
  );
}
