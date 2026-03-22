function getPieceCellSize(piece) {
  if (!piece) return 14;
  if (piece.size >= 5) return 11;
  if (piece.size === 4) return 13;
  return 15;
}

function PieceMiniBoard({ piece, selected, disabled, theme, patternAssist = false }) {
  if (!piece) {
    return (
      <div className="min-h-[5.5rem] rounded-[1.3rem] border-2 border-dashed border-white/15 bg-black/10 sm:min-h-[6rem]" />
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
      className={`relative mx-auto transition-transform duration-150 ${selected ? 'scale-[1.03]' : ''}`}
      style={{ width: trayWidth, height: trayHeight }}
    >
      {piece.cells.map(([row, col], index) => (
        <span
          key={`${piece.id}-${row}-${col}-${index}`}
          className={`absolute rounded-[0.65rem] border border-black/10 ${patternClass}`}
          style={{
            width: `${cellSize - 1}px`,
            height: `${cellSize - 1}px`,
            left: `${5 + col * cellSize}px`,
            top: `${5 + row * cellSize}px`,
            background: `linear-gradient(180deg, ${theme.fillFrom} 0%, ${theme.fillTo} 100%)`,
            boxShadow: selected
              ? `0 8px 18px ${theme.fillShadow}, inset 0 1px 0 rgba(255,255,255,0.28)`
              : `0 6px 14px ${theme.fillShadow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
            opacity: disabled ? 0.45 : 1,
          }}
        />
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
            className={`relative overflow-hidden rounded-[1.35rem] border-[3px] px-2.5 py-3 text-left transition-all duration-200 ${
              selected ? 'translate-y-[-2px] scale-[1.01]' : 'translate-y-0'
            }`}
            style={{
              borderColor: selected ? theme.fillFrom : theme.boardBorder,
              background: selected
                ? `linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 100%), ${theme.boardBg}`
                : `linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%), ${theme.boardBg}`,
              boxShadow: selected
                ? `0 18px 30px ${theme.fillShadow}, 4px 4px 0 rgba(28,20,40,0.15)`
                : `0 10px 22px rgba(20,16,32,0.15), 4px 4px 0 rgba(28,20,40,0.1)`,
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
