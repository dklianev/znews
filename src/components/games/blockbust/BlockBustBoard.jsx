import { forwardRef, useMemo } from 'react';
import { BLOCK_BUST_BOARD_SIZE } from '../../../utils/blockBust';

function toPreviewKeySet(cells = []) {
  return new Set(cells.map(({ row, col }) => `${row}:${col}`));
}

const BlockBustBoard = forwardRef(function BlockBustBoard({
  board,
  theme,
  previewCells,
  invalidPreview = false,
  focusCell,
  showPlacementPreview,
  contrastMode = 'normal',
  patternAssist = false,
  onCellClick,
  onCellEnter,
  onBoardPointerMove,
  onBoardPointerUp,
  onBoardLeave,
}, ref) {
  const previewKeySet = useMemo(() => toPreviewKeySet(previewCells), [previewCells]);

  return (
    <div className="mx-auto w-full max-w-[34rem]">
      <div
        ref={ref}
        onPointerMove={onBoardPointerMove}
        onPointerUp={onBoardPointerUp}
        onPointerLeave={onBoardLeave}
        className="relative overflow-hidden rounded-[2rem] border-[3px] p-2.5 shadow-[0_14px_0_rgba(28,20,40,0.08)] sm:p-4"
        style={{
          background: theme.boardBg,
          borderColor: theme.boardBorder,
          boxShadow: `${theme.boardShadow}, 6px 6px 0 rgba(28,20,40,0.16)`,
        }}
      >
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/12 bg-white/8 px-3 py-1 font-display text-[10px] uppercase tracking-[0.24em] text-white/75">
          Поле 8x8
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${theme.accentSoft} 0%, transparent 48%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-[10px] rounded-[1.55rem] opacity-60"
          style={{
            border: `1px solid ${theme.cellBorder}`,
            boxShadow: `inset 0 0 0 1px ${theme.boardInset}`,
          }}
        />

        <div
          className="relative mt-7 grid gap-1.5 sm:gap-2"
          style={{ gridTemplateColumns: `repeat(${BLOCK_BUST_BOARD_SIZE}, minmax(0, 1fr))` }}
        >
          {board.map((rowCells, rowIndex) => rowCells.map((cell, colIndex) => {
            const previewKey = `${rowIndex}:${colIndex}`;
            const isPreview = showPlacementPreview && previewKeySet.has(previewKey);
            const isFocused = focusCell?.row === rowIndex && focusCell?.col === colIndex;
            const filled = Boolean(cell);
            const patternBackground = patternAssist && filled
              ? 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.22) 0, rgba(255,255,255,0.22) 1px, transparent 1px)'
              : undefined;

            return (
              <button
                key={previewKey}
                type="button"
                onMouseEnter={() => onCellEnter?.(rowIndex, colIndex)}
                onFocus={() => onCellEnter?.(rowIndex, colIndex)}
                onClick={() => onCellClick?.(rowIndex, colIndex)}
                className="relative block w-full overflow-hidden rounded-[1.05rem] outline-none transition-transform duration-150"
                style={{
                  paddingTop: '100%',
                  transform: isFocused ? 'translateY(-1px)' : 'translateY(0)',
                }}
                aria-label={`Клетка ${rowIndex + 1}, ${colIndex + 1}`}
              >
                <span
                  className="absolute inset-0 rounded-[1.05rem] border transition-all duration-150"
                  style={{
                    background: filled
                      ? `${patternBackground ? `${patternBackground}, ` : ''}linear-gradient(180deg, ${theme.fillFrom} 0%, ${theme.fillTo} 100%)`
                      : theme.cellBg,
                    backgroundSize: patternBackground ? '12px 12px, auto' : undefined,
                    borderColor: filled
                      ? theme.fillFrom
                      : contrastMode === 'high'
                        ? 'rgba(255,255,255,0.18)'
                        : theme.cellBorder,
                    boxShadow: filled
                      ? `inset 0 1px 0 rgba(255,255,255,0.28), 0 10px 24px ${theme.fillShadow}`
                      : `inset 0 1px 0 ${theme.boardInset}`,
                  }}
                />

                {isPreview && (
                  <span
                    className="absolute inset-[0.18rem] rounded-[0.88rem] border-2 border-dashed"
                    style={{
                      background: invalidPreview ? theme.invalid : theme.ghost,
                      borderColor: invalidPreview ? 'rgba(255,255,255,0.2)' : theme.fillFrom,
                    }}
                  />
                )}

                {isFocused && (
                  <span
                    className="absolute inset-[-1px] rounded-[1.15rem] border-2"
                    style={{
                      borderColor: theme.accent,
                      boxShadow: `0 0 0 2px ${theme.accentSoft}`,
                    }}
                  />
                )}

                {!filled && (
                  <span
                    className="pointer-events-none absolute inset-[24%] rounded-full opacity-60"
                    style={{
                      background: contrastMode === 'high'
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(255,255,255,0.03)',
                    }}
                  />
                )}
              </button>
            );
          }))}
        </div>
      </div>
    </div>
  );
});

export default BlockBustBoard;
