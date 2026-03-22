function getPieceCellSize(piece) {
  if (!piece) return 14;
  if (piece.size >= 5) return 11;
  if (piece.size === 4) return 13;
  return 15;
}

function PieceMiniBoard({ piece, selected, disabled, theme, patternAssist = false }) {
  if (!piece) {
    return (
      <div className="min-h-[5.5rem] rounded-[1.4rem] border-3 border-dashed border-[#1C1428] bg-black/5 opacity-40 sm:min-h-[6rem]" />
    );
  }

  const cellSize = getPieceCellSize(piece);
  const trayWidth = piece.width * cellSize + 10;
  const trayHeight = piece.height * cellSize + 10;
  const patternClass = patternAssist
    ? 'bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.22)_0,rgba(255,255,255,0.22)_1px,transparent_1px)] bg-[length:8px_8px]'
    : '';

  return (
    <div
      className={`relative mx-auto transition-transform duration-300 ${selected ? 'scale-[1.15]' : 'scale-100'}`}
      style={{ width: trayWidth, height: trayHeight }}
    >
      {piece.cells.map(([row, col], index) => (
        <span
          key={`${piece.id}-${row}-${col}-${index}`}
          className={`absolute rounded-[0.7rem] border border-black/10 ${patternClass}`}
          style={{
            width: `${cellSize - 1}px`,
            height: `${cellSize - 1}px`,
            left: `${5 + col * cellSize}px`,
            top: `${5 + row * cellSize}px`,
            background: `linear-gradient(160deg, ${theme.fillFrom} 0%, ${theme.fillTo} 100%)`,
            boxShadow: selected
              ? `inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -2px 5px rgba(0,0,0,0.3), 0 10px 20px ${theme.fillShadow}`
              : `inset 0 1px 3px rgba(255,255,255,0.5), inset 0 -1px 3px rgba(0,0,0,0.2), 0 5px 12px ${theme.fillShadow}`,
            opacity: disabled ? 0.35 : 1,
            zIndex: selected ? 10 : 1,
          }}
        >
          <div className="pointer-events-none absolute inset-[1px] rounded-[0.55rem] bg-gradient-to-br from-white/30 to-transparent" />
        </span>
      ))}
    </div>
  );
}

export default function BlockBustTray({
  pieces,
  selectedPieceId,
  onSelectPiece,
  onStartDragPiece,
  theme,
  patternAssist = false,
  controlMode = 'drag-tap',
}) {
  const trayPieces = Array.isArray(pieces) ? pieces : [];

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
      {trayPieces.map((piece, index) => {
        const selected = piece?.id === selectedPieceId;
        const keyboardHint = index + 1;

        return (
          <button
            key={piece?.id || `slot-${index}`}
            type="button"
            onClick={() => piece && onSelectPiece?.(piece.id)}
            onPointerDown={(event) => {
              if (!piece || controlMode !== 'drag-tap') return;
              onStartDragPiece?.(event, piece.id);
            }}
            className={`relative overflow-hidden comic-panel px-2.5 py-3 text-left transition-all duration-300 ${
              selected ? 'translate-y-[-4px] scale-[1.03] z-10' : 'translate-y-0 z-0'
            }`}
            style={{
              borderColor: selected ? theme.fillFrom : '#1C1428',
              background: selected
                ? `linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 100%), ${theme.boardBg}`
                : `linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%), ${theme.boardBg}`,
              boxShadow: selected
                ? `0 24px 40px ${theme.fillShadow}, 6px 6px 0 #1C1428`
                : `0 10px 22px rgba(20,16,32,0.15), 4px 4px 0 #1C1428`,
            }}
          >
            <span className="absolute left-2.5 top-2 rounded-full border border-white/18 bg-white/10 px-2 py-1 font-display text-[9px] uppercase tracking-[0.22em] text-white/80">
              {keyboardHint}
            </span>
            <span
              className="absolute right-2.5 top-2 rounded-full px-2 py-1 font-display text-[9px] uppercase tracking-[0.22em]"
              style={{
                color: selected ? '#1c1428' : 'rgba(255,255,255,0.72)',
                background: selected ? theme.fillFrom : 'rgba(255,255,255,0.09)',
              }}
            >
              {selected ? 'Избрана' : piece?.size <= 2 ? 'Бърза' : 'Силна'}
            </span>

            <div className="mb-3 mt-6 flex min-h-[5.4rem] items-center justify-center sm:min-h-[6rem]">
              <PieceMiniBoard
                piece={piece}
                selected={selected}
                disabled={!piece}
                theme={theme}
                patternAssist={patternAssist}
              />
            </div>

            <div className="space-y-1.5 text-white/88">
              <div>
                <p className="font-display text-[9px] uppercase tracking-[0.2em] text-white/55">Размер</p>
                <p className="font-display text-sm font-black uppercase tracking-[0.08em]">
                  {piece ? `${piece.size} клетки` : 'Няма'}
                </p>
              </div>
              <div>
                <p className="font-display text-[9px] uppercase tracking-[0.2em] text-white/55">Контрол</p>
                <p className="font-display text-[10px] font-black uppercase tracking-[0.18em]">
                  {controlMode === 'drag-tap' ? 'Влачи / докосни' : 'Само докосни'}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
