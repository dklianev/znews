import EasterEgg from './EasterEgg';

const POSITION_MAP = {
  'top-right': 'top-2 right-2',
  'top-left': 'top-2 left-2',
  'bottom-right': 'bottom-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-left-inset': 'bottom-4 left-4',
};

export default function EasterDecorationSlot({
  position = 'top-right',
  variant = 'egg-red',
  size = 'md',
  withTape = false,
  tapeRotation = '12deg',
}) {
  const posClass = POSITION_MAP[position] || POSITION_MAP['top-right'];

  return (
    <div
      className={`absolute ${posClass} z-[3] pointer-events-none select-none hidden md:block opacity-60`}
      aria-hidden="true"
    >
      {withTape && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-100/80 border border-amber-300/50 z-[4]"
          style={{ transform: `translateX(-50%) rotate(${tapeRotation})` }}
        />
      )}
      <EasterEgg variant={variant} size={size} />
    </div>
  );
}
