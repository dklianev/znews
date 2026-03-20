import { memo, useMemo } from 'react';
import { BOARD_ROWS, BOARD_COLS, THEMES } from '../../../utils/tetris';

const CELL_SIZE = 34;
const GAP = 1;
export const CELL_STEP = CELL_SIZE + GAP;

const TetrisRow = memo(function TetrisRow({ row, rIdx, theme, showGrid, lockFlashSet, isGravityDrop, activeCells, activeGlow }) {
  return row.map((cell, cIdx) => {
    const isGhost = typeof cell === 'string' && cell.startsWith('ghost:');
    const typeKey = isGhost ? cell.slice(6) : cell;
    const color = typeKey ? (theme.colors[typeKey] || '#666') : null;
    const x = GAP + cIdx * (CELL_SIZE + GAP);
    const y = GAP + rIdx * (CELL_SIZE + GAP);
    const cellKey = `${rIdx}-${cIdx}`;
    const isLockFlash = lockFlashSet.has(cellKey);
    const isActive = activeGlow && activeCells && activeCells.has(cellKey);

    let className = 'absolute';
    if (isGhost) className += ' tetris-ghost-pulse';
    if (isLockFlash) className += ' tetris-lock-flash';
    if (isGravityDrop && color && !isGhost) className += ' tetris-gravity-drop';

    // Cell shadow: active piece glow, lock flash, or standard bevel
    let shadow = 'none';
    if (color && !isGhost) {
      if (isLockFlash) {
        // handled by animation
      } else if (isActive) {
        shadow = `inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 2px rgba(255,255,255,0.2), 0 0 8px ${color}88`;
      } else {
        shadow = `inset 0 -3px 4px rgba(0,0,0,0.35), inset 0 2px 1px rgba(255,255,255,0.25), inset 2px 0 1px rgba(255,255,255,0.08), inset -2px 0 1px rgba(0,0,0,0.12)`;
      }
    }

    return (
      <div
        key={cellKey}
        className={className}
        style={{
          left: x,
          top: y,
          width: CELL_SIZE,
          height: CELL_SIZE,
          backgroundColor: color || theme.bg,
          opacity: isGhost ? undefined : 1,
          border: color && !isGhost
            ? '2px solid rgba(255,255,255,0.18)'
            : showGrid
              ? '1px solid rgba(255,255,255,0.06)'
              : 'none',
          borderRadius: 2,
          boxShadow: shadow,
          '--drop-from': isGravityDrop ? `${-(CELL_SIZE + GAP)}px` : '0px',
        }}
      />
    );
  });
});

function TetrisBoard({ board, piece, ghostRow, themeName = 'classic', showGrid = false, flashRows, shake, tilt, lockFlashCells, gravityRows, activeGlow = false }) {
  const theme = THEMES[themeName] || THEMES.classic;

  // Compute active piece cell positions for glow effect
  const activeCells = useMemo(() => {
    if (!piece || !activeGlow) return null;
    const set = new Set();
    for (let r = 0; r < piece.shape.length; r += 1) {
      for (let c = 0; c < piece.shape[r].length; c += 1) {
        if (!piece.shape[r][c]) continue;
        const pr = piece.row + r;
        const pc = piece.col + c;
        if (pr >= 0 && pr < BOARD_ROWS && pc >= 0 && pc < BOARD_COLS) {
          set.add(`${pr}-${pc}`);
        }
      }
    }
    return set;
  }, [piece, activeGlow]);

  const display = useMemo(() => {
    const grid = board.map((row) => [...row]);

    // Ghost piece
    if (piece && ghostRow !== piece.row) {
      for (let r = 0; r < piece.shape.length; r += 1) {
        for (let c = 0; c < piece.shape[r].length; c += 1) {
          if (!piece.shape[r][c]) continue;
          const gr = ghostRow + r;
          const gc = piece.col + c;
          if (gr >= 0 && gr < BOARD_ROWS && gc >= 0 && gc < BOARD_COLS && !grid[gr][gc]) {
            grid[gr][gc] = `ghost:${piece.type}`;
          }
        }
      }
    }

    // Active piece
    if (piece) {
      for (let r = 0; r < piece.shape.length; r += 1) {
        for (let c = 0; c < piece.shape[r].length; c += 1) {
          if (!piece.shape[r][c]) continue;
          const pr = piece.row + r;
          const pc = piece.col + c;
          if (pr >= 0 && pr < BOARD_ROWS && pc >= 0 && pc < BOARD_COLS) {
            grid[pr][pc] = piece.type;
          }
        }
      }
    }

    return grid;
  }, [board, piece, ghostRow]);

  const boardWidth = BOARD_COLS * (CELL_SIZE + GAP) + GAP;
  const boardHeight = BOARD_ROWS * (CELL_SIZE + GAP) + GAP;

  const lockFlashSet = useMemo(() => new Set((lockFlashCells || []).map(([r, c]) => `${r}-${c}`)), [lockFlashCells]);
  const gravitySet = useMemo(() => new Set(gravityRows || []), [gravityRows]);

  // Combine classes for board wrapper
  let wrapperClass = 'relative border-3 border-[#1C1428] dark:border-zinc-600';
  if (shake) wrapperClass += ' tetris-shake';
  if (tilt) wrapperClass += ' tetris-tilt';

  return (
    <div
      className={wrapperClass}
      style={{
        width: boardWidth,
        height: boardHeight,
        background: theme.boardSurface || theme.boardBg,
        borderColor: theme.frameColor || '#1C1428',
        boxShadow: theme.frameColor ? `0 0 0 1px ${theme.frameColor}22, 0 0 24px ${theme.frameColor}18` : undefined,
      }}
    >
      {display.map((row, rIdx) => (
        <TetrisRow
          key={rIdx}
          row={row}
          rIdx={rIdx}
          theme={theme}
          showGrid={showGrid}
          lockFlashSet={lockFlashSet}
          isGravityDrop={gravitySet.has(rIdx)}
          activeCells={activeCells}
          activeGlow={activeGlow}
        />
      ))}

      {/* Line clear flash overlays */}
      {flashRows && flashRows.map((rowIdx) => (
        <div
          key={`flash-${rowIdx}`}
          className="absolute left-0 right-0 pointer-events-none tetris-flash"
          style={{
            top: GAP + rowIdx * (CELL_SIZE + GAP),
            height: CELL_SIZE,
          }}
        />
      ))}

      {/* Particle effects on line clear */}
      {flashRows && flashRows.map((rowIdx) => {
        const particles = [];
        for (let i = 0; i < 8; i += 1) {
          const tx = (Math.random() - 0.5) * 120;
          const ty = -20 - Math.random() * 50;
          const dur = 400 + Math.random() * 300;
          const left = GAP + Math.random() * (boardWidth - GAP * 2);
          const topPos = GAP + rowIdx * (CELL_SIZE + GAP) + CELL_SIZE / 2;
          const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#FFFFFF', '#FF9F43'];
          const bg = colors[Math.floor(Math.random() * colors.length)];
          particles.push(
            <div
              key={`p-${rowIdx}-${i}`}
              className="tetris-particle"
              style={{
                left,
                top: topPos,
                backgroundColor: bg,
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                '--dur': `${dur}ms`,
              }}
            />
          );
        }
        return particles;
      })}
    </div>
  );
}

export default memo(TetrisBoard);
