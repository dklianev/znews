import { memo } from 'react';
import { TETROMINOES, getTrimmedShape, THEMES } from '../../../utils/tetris';

const CELL = 16;
const GAP = 2;

function TetrisPreview({ pieceKey, label, small, themeName = 'classic' }) {
  if (!pieceKey || !TETROMINOES[pieceKey]) return null;
  const theme = THEMES[themeName] || THEMES.classic;
  const shape = getTrimmedShape(pieceKey);
  const color = theme.colors[pieceKey] || '#888';
  const rows = shape.length;
  const cols = shape[0].length;
  const cellSize = small ? 12 : CELL;
  const gap = small ? 1 : GAP;
  const width = cols * (cellSize + gap) + gap;
  const height = rows * (cellSize + gap) + gap;

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">
          {label}
        </span>
      )}
      <div
        className="relative border-2 border-[#1C1428] dark:border-zinc-600"
        style={{
          width: Math.max(width + 8, small ? 40 : 60),
          height: Math.max(height + 8, small ? 32 : 48),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          backgroundColor: theme.boardBg,
        }}
      >
        <div className="relative" style={{ width, height }}>
          {shape.map((row, rIdx) =>
            row.map((cell, cIdx) => (
              <div
                key={`${rIdx}-${cIdx}`}
                className="absolute"
                style={{
                  left: gap + cIdx * (cellSize + gap),
                  top: gap + rIdx * (cellSize + gap),
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: cell ? color : 'transparent',
                  border: cell ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  borderRadius: 1,
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TetrisPreview);
