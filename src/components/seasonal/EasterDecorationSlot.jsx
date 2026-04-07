import EasterEgg from './EasterEgg';

const POSITION_MAP = {
  'top-right': 'top-2 right-2',
  'top-right-inset': 'top-14 right-6 md:top-10 md:right-10',
  'top-left': 'top-2 left-2',
  'bottom-right': 'bottom-2 right-2',
  'bottom-right-inset': 'bottom-2 right-8 md:bottom-0 md:right-14',
  'bottom-left': 'bottom-2 left-2',
  'bottom-left-inset': 'bottom-4 left-4',
};

export default function EasterDecorationSlot({
  position = 'top-right',
  variant = 'egg-red',
  size = 'md',
  withTape = false,
  tapeRotation = '12deg',
  mobileHidden = false,
  opacityClass = 'opacity-60',
}) {
  const posClass = POSITION_MAP[position] || POSITION_MAP['top-right'];

  return (
    <div
      className={`absolute ${posClass} z-[4] pointer-events-none select-none ${opacityClass} ${mobileHidden ? 'hidden md:block' : ''}`}
      aria-hidden="true"
    >
      {withTape && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-100/80 border border-amber-300/50 z-[5]"
          style={{ transform: `translateX(-50%) rotate(${tapeRotation})` }}
        />
      )}
      <EasterEgg variant={variant} size={size} />
    </div>
  );
}
