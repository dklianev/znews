import { memo, useMemo } from 'react';
import { BOARD_ROWS, BOARD_COLS, THEMES } from '../../../utils/tetris';

const CELL_SIZE = 28;
const GAP = 1;

function TetrisBoard({ board, piece, ghostRow, themeName = 'classic', showGrid = false, flashRows, shake }) {
  const theme = THEMES[themeName] || THEMES.classic;

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

  const flashSet = useMemo(() => new Set(flashRows || []), [flashRows]);

  return (
    <div
      className={`relative border-3 border-[#1C1428] dark:border-zinc-600${shake ? ' tetris-shake' : ''}`}
      style={{ width: boardWidth, height: boardHeight, backgroundColor: theme.boardBg }}
    >
      {display.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          const isGhost = typeof cell === 'string' && cell.startsWith('ghost:');
          const typeKey = isGhost ? cell.slice(6) : cell;
          const color = typeKey ? (theme.colors[typeKey] || '#666') : null;
          const x = GAP + cIdx * (CELL_SIZE + GAP);
          const y = GAP + rIdx * (CELL_SIZE + GAP);

          return (
            <div
              key={`${rIdx}-${cIdx}`}
              className="absolute"
              style={{
                left: x,
                top: y,
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: color || theme.bg,
                opacity: isGhost ? 0.25 : 1,
                border: color && !isGhost
                  ? '2px solid rgba(255,255,255,0.2)'
                  : showGrid
                    ? '1px solid rgba(255,255,255,0.06)'
                    : 'none',
                borderRadius: 2,
                boxShadow: color && !isGhost
                  ? 'inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 2px rgba(255,255,255,0.15)'
                  : 'none',
              }}
            />
          );
        })
      )}

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
    </div>
  );
}

export default memo(TetrisBoard);
