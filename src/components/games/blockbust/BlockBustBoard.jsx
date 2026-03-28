import { forwardRef, useMemo } from 'react';
import { BLOCK_BUST_BOARD_SIZE } from '../../../utils/blockBust';

function toKeySet(cells = []) {
  return new Set(cells.map(({ row, col }) => `${row}:${col}`));
}

/**
 * Lightweight 8×8 board — uses CSS transitions instead of per-cell
 * AnimatePresence/motion to eliminate layout thrashing and jank.
 */
const BlockBustBoard = forwardRef(function BlockBustBoard({
  board,
  theme,
  gridRef,
  previewCells,
  invalidPreview = false,
  pendingClears = null,
  focusCell,
  showPlacementPreview,
  contrastMode = 'normal',
  clearFlash = null,
  rejectShake = false,
  comboLevel = 0,
  onCellClick,
  onCellEnter,
  onBoardLeave,
}, ref) {
  const previewSet = useMemo(() => toKeySet(previewCells), [previewCells]);
  const pendingClearSet = useMemo(() => {
    if (!pendingClears || (!pendingClears.rows.length && !pendingClears.cols.length)) return null;
    const s = new Set();
    for (const r of pendingClears.rows) { for (let c = 0; c < BLOCK_BUST_BOARD_SIZE; c++) s.add(`${r}:${c}`); }
    for (const c of pendingClears.cols) { for (let r = 0; r < BLOCK_BUST_BOARD_SIZE; r++) s.add(`${r}:${c}`); }
    return s;
  }, [pendingClears]);
  const flashSet = useMemo(() => {
    if (!clearFlash) return null;
    const s = new Set();
    for (const r of (clearFlash.rows || [])) { for (let c = 0; c < BLOCK_BUST_BOARD_SIZE; c++) s.add(`${r}:${c}`); }
    for (const c of (clearFlash.cols || [])) { for (let r = 0; r < BLOCK_BUST_BOARD_SIZE; r++) s.add(`${r}:${c}`); }
    return s;
  }, [clearFlash]);

  const glowStyle = comboLevel >= 2
    ? `0 0 ${16 + comboLevel * 10}px ${theme.accent}, 0 0 ${36 + comboLevel * 16}px ${theme.accentSoft}`
    : comboLevel === 1 ? `0 0 14px ${theme.accentSoft}` : 'none';

  return (
    <div
      ref={ref}
      onPointerLeave={onBoardLeave}
      className={`relative overflow-hidden rounded-2xl border-[3px] p-1.5 sm:p-2 transition-shadow duration-300${rejectShake ? ' bb-reject-shake' : ''}`}
      style={{
        background: theme.boardBg,
        borderColor: theme.boardBorder,
        boxShadow: glowStyle,
      }}
    >
      <div
        ref={gridRef}
        className="relative grid gap-[2px] sm:gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${BLOCK_BUST_BOARD_SIZE}, 1fr)` }}
      >
        {board.map((rowCells, ri) => rowCells.map((cell, ci) => {
          const key = `${ri}:${ci}`;
          const filled = Boolean(cell);
          const isPreview = showPlacementPreview && previewSet.has(key);
          const isFocused = focusCell?.row === ri && focusCell?.col === ci;
          const isFlashing = flashSet?.has(key);
          const isPendingClear = pendingClearSet?.has(key);

          return (
            <button
              key={key}
              type="button"
              onMouseEnter={() => onCellEnter?.(ri, ci)}
              onFocus={() => onCellEnter?.(ri, ci)}
              onClick={() => onCellClick?.(ri, ci)}
              className="relative block w-full outline-none"
              style={{ paddingTop: '100%' }}
              aria-label={`${ri + 1},${ci + 1}`}
            >
              {/* Base empty cell */}
              <span
                className="absolute inset-0 rounded-[4px] sm:rounded-md border transition-all duration-150"
                style={{
                  background: theme.cellBg,
                  borderColor: contrastMode === 'high' ? 'rgba(255,255,255,0.16)' : theme.cellBorder,
                }}
              />

              {/* Filled cell — CSS transition, no motion */}
              <span
                className="absolute inset-[-1px] rounded-[4px] sm:rounded-md border transition-all"
                style={{
                  background: `linear-gradient(150deg, ${theme.fillFrom} 0%, ${theme.fillTo} 100%)`,
                  borderColor: theme.fillFrom,
                  boxShadow: `inset 0 2px 4px rgba(255,255,255,0.45), inset 0 -2px 5px rgba(0,0,0,0.2), 0 3px 8px ${theme.fillShadow}`,
                  opacity: filled ? 1 : 0,
                  transform: filled ? 'scale(1)' : 'scale(0.7)',
                  transitionDuration: '180ms',
                  transitionProperty: 'opacity, transform',
                  pointerEvents: 'none',
                }}
              >
                <span className="absolute inset-[2px] rounded-[3px] bg-gradient-to-br from-white/25 to-transparent" />
              </span>

              {/* Ghost preview — shows where piece would land (green=valid, red=invalid) */}
              {isPreview && (
                <span
                  className="absolute inset-[-1px] rounded-[4px] sm:rounded-md border z-10 pointer-events-none transition-all duration-100"
                  style={{
                    background: invalidPreview
                      ? 'linear-gradient(150deg, #ef4444 0%, #dc2626 100%)'
                      : `linear-gradient(150deg, ${theme.fillFrom} 0%, ${theme.fillTo} 100%)`,
                    borderColor: invalidPreview ? 'rgba(239,68,68,0.5)' : theme.fillFrom,
                    opacity: invalidPreview ? 0.45 : 0.55,
                  }}
                />
              )}

              {/* Pending clear highlight — shows which rows/cols will clear */}
              {isPendingClear && !isFlashing && (
                <span
                  className="absolute inset-0 rounded-[4px] sm:rounded-md z-5 pointer-events-none"
                  style={{ background: `${theme.accent}22` }}
                />
              )}

              {/* Focus ring */}
              {isFocused && (
                <span
                  className="absolute inset-[-1px] rounded-[4px] sm:rounded-md border-2 z-20 pointer-events-none"
                  style={{ borderColor: theme.accent, boxShadow: `0 0 0 2px ${theme.accentSoft}` }}
                />
              )}

              {/* Clear flash */}
              {isFlashing && (
                <span
                  className="absolute inset-[-2px] rounded-[4px] sm:rounded-md z-30 pointer-events-none bb-flash"
                  style={{ background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${theme.accent} 100%)` }}
                />
              )}
            </button>
          );
        }))}
      </div>
    </div>
  );
});

export default BlockBustBoard;
