/**
 * snake.js — Pure game logic for Snake (no React dependencies).
 * Features: special food types, obstacles, speed boost, screen wrap mode,
 * progressive difficulty, combo scoring, power-ups.
 */

export const GRID_SIZE = 20;
export const CELL_PX = 24;

export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

export const OPPOSITE = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

export const SPEED_BY_DIFFICULTY = {
  easy: 150,
  medium: 105,
  hard: 65,
};

/** Food types with different effects */
export const FOOD_TYPES = {
  normal: { color: '#F44336', glow: 'rgba(244,67,54,0.6)', border: '#C62828', points: 10, grow: 1, label: null },
  golden: { color: '#FFD700', glow: 'rgba(255,215,0,0.7)', border: '#B8860B', points: 30, grow: 1, label: '+30' },
  speed: { color: '#2196F3', glow: 'rgba(33,150,243,0.6)', border: '#1565C0', points: 15, grow: 1, label: 'БЪРЗО!' },
  shrink: { color: '#E040FB', glow: 'rgba(224,64,251,0.6)', border: '#9C27B0', points: 20, grow: -2, label: '-2' },
  mega: { color: '#FF9800', glow: 'rgba(255,152,0,0.7)', border: '#E65100', points: 50, grow: 3, label: '+50' },
};

const FOOD_WEIGHTS = [
  { type: 'normal', weight: 60 },
  { type: 'golden', weight: 18 },
  { type: 'speed', weight: 10 },
  { type: 'shrink', weight: 7 },
  { type: 'mega', weight: 5 },
];

export function createInitialSnake() {
  const mid = Math.floor(GRID_SIZE / 2);
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
}

/** Weighted random food type selection */
export function randomFoodType() {
  const total = FOOD_WEIGHTS.reduce((sum, fw) => sum + fw.weight, 0);
  let roll = Math.random() * total;
  for (const fw of FOOD_WEIGHTS) {
    roll -= fw.weight;
    if (roll <= 0) return fw.type;
  }
  return 'normal';
}

function getOccupiedSet(snake, obstacles) {
  const set = new Set(snake.map((s) => `${s.x},${s.y}`));
  if (obstacles) {
    for (const obs of obstacles) {
      set.add(`${obs.x},${obs.y}`);
    }
  }
  return set;
}

export function getRandomFoodPosition(snake, obstacles, gridSize = GRID_SIZE) {
  const occupied = getOccupiedSet(snake, obstacles);
  const free = [];
  for (let x = 0; x < gridSize; x += 1) {
    for (let y = 0; y < gridSize; y += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}

/** Generate food with a random type */
export function generateFood(snake, obstacles) {
  const pos = getRandomFoodPosition(snake, obstacles);
  if (!pos) return null;
  return { ...pos, type: randomFoodType() };
}

/** Generate obstacles based on current score milestone */
export function generateObstacles(score, snake, existingObstacles) {
  // Every 100 points, add an obstacle (max 15)
  const targetCount = Math.min(Math.floor(score / 100), 15);
  if (existingObstacles.length >= targetCount) return existingObstacles;

  const obstacles = [...existingObstacles];
  const occupied = getOccupiedSet(snake, obstacles);

  while (obstacles.length < targetCount) {
    const free = [];
    for (let x = 0; x < GRID_SIZE; x += 1) {
      for (let y = 0; y < GRID_SIZE; y += 1) {
        // Keep a 3-cell buffer around snake head
        const head = snake[0];
        const dist = Math.abs(x - head.x) + Math.abs(y - head.y);
        if (!occupied.has(`${x},${y}`) && dist > 3) {
          free.push({ x, y });
        }
      }
    }
    if (free.length === 0) break;
    const pos = free[Math.floor(Math.random() * free.length)];
    obstacles.push(pos);
    occupied.add(`${pos.x},${pos.y}`);
  }

  return obstacles;
}

export function moveSnake(snake, direction, wrapMode = false) {
  const head = snake[0];
  let newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  if (wrapMode) {
    newHead.x = ((newHead.x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
    newHead.y = ((newHead.y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
  }

  return [newHead, ...snake.slice(0, -1)];
}

export function growSnake(snake, direction, amount = 1, wrapMode = false) {
  const head = snake[0];
  let newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  if (wrapMode) {
    newHead.x = ((newHead.x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
    newHead.y = ((newHead.y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
  }

  if (amount > 0) {
    // Grow by adding head, keeping full tail
    const grown = [newHead, ...snake];
    // Add extra segments at the tail
    for (let i = 1; i < amount; i += 1) {
      grown.push({ ...grown[grown.length - 1] });
    }
    return grown;
  }

  // Shrink: remove from tail (min length 2)
  const shrunk = [newHead, ...snake];
  const removeCount = Math.min(Math.abs(amount) + 1, shrunk.length - 2);
  return shrunk.slice(0, shrunk.length - removeCount);
}

export function checkCollision(snake, obstacles, wrapMode = false, gridSize = GRID_SIZE) {
  const head = snake[0];

  // Wall collision (not in wrap mode)
  if (!wrapMode) {
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
      return 'wall';
    }
  }

  // Self collision
  for (let i = 1; i < snake.length; i += 1) {
    if (snake[i].x === head.x && snake[i].y === head.y) return 'self';
  }

  // Obstacle collision
  if (obstacles) {
    for (const obs of obstacles) {
      if (obs.x === head.x && obs.y === head.y) return 'obstacle';
    }
  }

  return null;
}

/** Calculate dynamic speed — gets faster as snake grows */
export function getDynamicSpeed(baseSpeed, snakeLength) {
  const speedUp = Math.floor((snakeLength - 3) / 5) * 5;
  return Math.max(40, baseSpeed - speedUp);
}

/** Calculate score with combo multiplier */
export function calculateFoodScore(foodType, combo) {
  const base = FOOD_TYPES[foodType]?.points || 10;
  const comboMultiplier = 1 + Math.min(combo, 10) * 0.1; // max 2x
  return Math.round(base * comboMultiplier);
}

/** Create initial game state */
export function createGameState(difficulty, wrapMode) {
  return {
    difficulty,
    wrapMode,
    foodEaten: 0,
    maxLength: 3,
    combo: 0,
    lastFoodTime: 0,
    speedBoostUntil: 0,
    obstaclesEnabled: difficulty === 'hard',
  };
}
