import { motion, AnimatePresence } from 'motion/react';

function getPieceCellSize(piece) {
  if (!piece) return 16;
  if (piece.size >= 6) return 12;
  if (piece.size === 5) return 13;
  if (piece.size === 4) return 15;
  return 17;
}

export function PieceMiniBoard({ piece, selected, disabled, theme, cellOverride }) {
  if (!piece) {
    return (
      <div className="flex items-center justify-center min-h-[4rem] opacity-30">
        <span className="text-xs text-white/40 font-display uppercase tracking-widest">—</span>
      </div>
    );
  }

  const cs = cellOverride || getPieceCellSize(piece);
  const gap = 2;
  const w = piece.width * cs + (piece.width - 1) * gap;
  const h = piece.height * cs + (piece.height - 1) * gap;

  return (
    <div
      className={`relative mx-auto transition-transform duration-150 will-change-transform ${selected ? 'scale-[1.14]' : 'scale-100'}`}
      style={{ width: w, height: h }}
    >
      {piece.cells.map(([row, col], i) => (
        <span
          key={`${piece.id}-${i}`}
          className="absolute rounded-[3px] sm:rounded-[4px] border border-black/10"
          style={{
            width: cs,
            height: cs,
            left: col * (cs + gap),
            top: row * (cs + gap),
            background: `linear-gradient(150deg, ${theme.fillFrom} 0%, ${theme.fillTo} 100%)`,
            boxShadow: selected
              ? `inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.25), 0 6px 16px ${theme.fillShadow}`
              : `inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.15), 0 3px 8px ${theme.fillShadow}`,
            opacity: disabled ? 0.3 : 1,
          }}
        >
          <span className="absolute inset-[1px] rounded-[2px] bg-gradient-to-br from-white/25 to-transparent" />
        </span>
      ))}
    </div>
  );
}

export default function BlockBustTray({
  pieces,
  selectedSlotIndex,
  onSelectPiece,
  onStartDragPiece,
  onDragPointerMove,
  onDragPointerUp,
  onDragPointerCancel,
  theme,
  controlMode = 'drag-tap',
}) {
  const trayPieces = Array.isArray(pieces) ? pieces : [];

  return (
    <div className="grid grid-cols-3 gap-2">
      <AnimatePresence mode="popLayout">
        {trayPieces.map((piece, index) => {
          const selected = piece !== null && index === selectedSlotIndex;
          const hint = ['A', 'S', 'D'][index];

          return (
            <motion.button
              key={`slot-${index}-${piece ? piece.id : 'empty'}`}
              initial={piece ? { scale: 0.85, opacity: 0 } : { opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={piece ? { type: 'spring', delay: index * 0.12, stiffness: 450, damping: 28 } : { duration: 0.15 }}
              type="button"
              onClick={() => piece && onSelectPiece?.(index)}
              onPointerDown={(e) => {
                if (!piece || controlMode !== 'drag-tap') return;
                e.preventDefault();
                try {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                } catch {}
                onStartDragPiece?.(e, index);
              }}
              onPointerMove={piece && controlMode === 'drag-tap' ? onDragPointerMove : undefined}
              onPointerUp={piece && controlMode === 'drag-tap' ? onDragPointerUp : undefined}
              onPointerCancel={piece && controlMode === 'drag-tap' ? onDragPointerCancel : undefined}
              className={`touch-none relative rounded-xl border-[2px] px-2 py-3 transition-all duration-150 will-change-transform ${
                selected
                  ? 'translate-y-[-5px] z-10 cursor-grabbing'
                  : `translate-y-0 z-0 ${controlMode === 'drag-tap' ? 'cursor-grab active:cursor-grabbing hover:translate-y-[-2px]' : 'cursor-pointer hover:translate-y-[-1px]'}`
              }`}
              style={{
                background: selected
                  ? `linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.06) 100%), ${theme.boardBg}`
                  : `linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.1) 100%), ${theme.boardBg}`,
                borderColor: selected ? `${theme.accent}90` : 'rgba(255,255,255,0.08)',
                boxShadow: selected
                  ? `0 16px 36px ${theme.fillShadow}, 0 0 0 2px ${theme.accent}50, 0 0 26px ${theme.accent}35`
                  : '0 6px 16px rgba(0,0,0,0.22)',
              }}
            >
              <span
                className="pointer-events-none absolute inset-0 rounded-[0.9rem] opacity-0 transition-opacity duration-150"
                style={{
                  opacity: selected ? 1 : 0,
                  boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.15), inset 0 12px 24px rgba(255,255,255,0.08)`,
                }}
              />

              {/* Keyboard hint badge */}
              <span className="absolute left-1.5 top-1.5 rounded-md bg-white/8 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase text-white/50">
                {hint}
              </span>

              {/* Size badge */}
              {piece && (
                <span
                  className="absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 font-display text-[9px] font-bold uppercase"
                  style={{
                    color: selected ? '#fff' : 'rgba(255,255,255,0.5)',
                    background: selected ? theme.accent + '80' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  {piece.size}
                </span>
              )}

              <div className="mt-5 mb-1 flex min-h-[4rem] items-center justify-center">
                <PieceMiniBoard
                  piece={piece}
                  selected={selected}
                  disabled={!piece}
                  theme={theme}
                />
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
