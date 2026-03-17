import { memo, useMemo } from 'react';
import { GRID_SIZE, CELL_PX, FOOD_TYPES } from '../../../utils/snake';

const GAP = 1;

function SnakeBoard({ snake, food, obstacles, wrapMode, floatingLabel }) {
  const boardSize = GRID_SIZE * (CELL_PX + GAP) + GAP;

  const snakeSet = useMemo(() => {
    const map = new Map();
    snake.forEach((seg, idx) => map.set(`${seg.x},${seg.y}`, idx));
    return map;
  }, [snake]);

  const obstacleSet = useMemo(() => {
    const set = new Set();
    if (obstacles) {
      for (const obs of obstacles) set.add(`${obs.x},${obs.y}`);
    }
    return set;
  }, [obstacles]);

  const cells = useMemo(() => {
    const result = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const key = `${x},${y}`;
        const segIdx = snakeSet.get(key);
        const isHead = segIdx === 0;
        const isBody = segIdx !== undefined && segIdx > 0;
        const isObstacle = obstacleSet.has(key);
        const isFood = food && food.x === x && food.y === y;

        let bg = '#1a1a2e';
        let border = 'none';
        let shadow = 'none';
        let radius = 2;
        let transform = '';

        if (isHead) {
          bg = '#4CAF50';
          border = '2px solid #2E7D32';
          shadow = '0 0 8px rgba(76,175,80,0.5)';
          radius = 5;
        } else if (isBody) {
          const t = segIdx / snake.length;
          const r = Math.round(76 - t * 30);
          const g = Math.round(175 - t * 40);
          const b = Math.round(80 - t * 20);
          bg = `rgb(${r},${g},${b})`;
          border = '1px solid rgba(255,255,255,0.1)';
          radius = 3;
        } else if (isObstacle) {
          bg = '#455A64';
          border = '2px solid #263238';
          shadow = 'inset 0 2px 4px rgba(0,0,0,0.4)';
          radius = 3;
        } else if (isFood) {
          const foodDef = FOOD_TYPES[food.type] || FOOD_TYPES.normal;
          bg = foodDef.color;
          border = `2px solid ${foodDef.border}`;
          shadow = `0 0 10px ${foodDef.glow}`;
          radius = food.type === 'mega' ? 4 : CELL_PX / 2;
          if (food.type === 'golden' || food.type === 'mega') {
            transform = 'scale(1.1)';
          }
        }

        result.push(
          <div
            key={key}
            className="absolute"
            style={{
              left: GAP + x * (CELL_PX + GAP),
              top: GAP + y * (CELL_PX + GAP),
              width: CELL_PX,
              height: CELL_PX,
              backgroundColor: bg,
              border,
              boxShadow: shadow,
              borderRadius: radius,
              transition: isFood ? 'box-shadow 0.3s ease, transform 0.2s ease' : undefined,
              transform,
            }}
          />
        );
      }
    }
    return result;
  }, [snakeSet, obstacleSet, food, snake.length]);

  return (
    <div
      className="relative border-3 border-[#1C1428] dark:border-zinc-600 bg-[#0a0a0a]"
      style={{ width: boardSize, height: boardSize, outline: wrapMode ? '2px dashed rgba(33,150,243,0.3)' : 'none' }}
    >
      {cells}
      {/* Floating label (e.g. "+30", "БЪРЗО!") */}
      {floatingLabel && (
        <div
          className="absolute z-30 pointer-events-none font-display font-black text-sm uppercase"
          style={{
            left: GAP + (food?.x || 10) * (CELL_PX + GAP),
            top: GAP + ((food?.y || 10) - 1) * (CELL_PX + GAP),
            color: '#FFD700',
            textShadow: '0 0 6px rgba(0,0,0,0.8)',
            animation: 'floatUp 0.8s ease-out forwards',
          }}
        >
          {floatingLabel}
        </div>
      )}
    </div>
  );
}

export default memo(SnakeBoard);
