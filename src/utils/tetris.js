/**
 * tetris.js — Pure game logic for Tetris (no React dependencies).
 * Features: 7-bag randomizer, hold piece, combos, back-to-back Tetris,
 * T-spin detection, lock delay, wall kicks, ghost piece, level system.
 */

export const BOARD_ROWS = 20;
export const BOARD_COLS = 10;
export const QUEUE_SIZE = 3;

export const TETROMINOES = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#00BCD4' },
  O: { shape: [[1, 1], [1, 1]], color: '#FFC107' },
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#9C27B0' },
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#4CAF50' },
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#F44336' },
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#2196F3' },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#FF9800' },
};

const PIECE_KEYS = Object.keys(TETROMINOES);

export const LEVEL_SPEEDS = [
  800, 720, 630, 550, 470, 380, 300, 220, 130, 100,
  80, 80, 80, 70, 70, 70, 50, 50, 50, 30,
];

export const POINTS = {
  SINGLE: 100,
  DOUBLE: 300,
  TRIPLE: 500,
  TETRIS: 800,
  SOFT_DROP: 1,
  HARD_DROP: 2,
  COMBO_BONUS: 50,
  BACK_TO_BACK_MULTIPLIER: 1.5,
  T_SPIN_SINGLE: 800,
  T_SPIN_DOUBLE: 1200,
  T_SPIN_TRIPLE: 1600,
  T_SPIN_MINI: 200,
  PERFECT_CLEAR: 3000,
};

export const LINE_CLEAR_NAMES = {
  1: 'SINGLE',
  2: 'DOUBLE',
  3: 'TRIPLE',
  4: 'TETRIS!',
};

export function createEmptyBoard() {
  return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
}

/** 7-bag randomizer for fair piece distribution */
export function createBag() {
  const bag = [...PIECE_KEYS];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/** Get trimmed shape (no empty rows/cols) for preview display */
export function getTrimmedShape(key) {
  const { shape } = TETROMINOES[key];
  // Find non-empty bounds
  let minR = shape.length;
  let maxR = 0;
  let minC = shape[0].length;
  let maxC = 0;
  for (let r = 0; r < shape.length; r += 1) {
    for (let c = 0; c < shape[r].length; c += 1) {
      if (shape[r][c]) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  const trimmed = [];
  for (let r = minR; r <= maxR; r += 1) {
    trimmed.push(shape[r].slice(minC, maxC + 1));
  }
  return trimmed;
}

export function pieceFromKey(key) {
  const { shape, color } = TETROMINOES[key];
  return {
    type: key,
    shape: shape.map((row) => [...row]),
    color,
    row: key === 'I' ? -1 : 0,
    col: Math.floor((BOARD_COLS - shape[0].length) / 2),
    rotationState: 0, // 0, 1, 2, 3
  };
}

export function rotateCW(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      rotated[c][rows - 1 - r] = shape[r][c];
    }
  }
  return rotated;
}

export function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
}

export function isValidPosition(board, shape, row, col) {
  for (let r = 0; r < shape.length; r += 1) {
    for (let c = 0; c < shape[r].length; c += 1) {
      if (!shape[r][c]) continue;
      const newRow = row + r;
      const newCol = col + c;
      if (newRow < 0 || newRow >= BOARD_ROWS) return false;
      if (newCol < 0 || newCol >= BOARD_COLS) return false;
      if (board[newRow][newCol]) return false;
    }
  }
  return true;
}

/** SRS wall kick data */
const WALL_KICK_DATA = {
  normal: {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  },
  I: {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  },
};

export function tryRotate(board, piece, clockwise = true) {
  const newShape = clockwise ? rotateCW(piece.shape) : rotateCCW(piece.shape);
  const nextRotation = clockwise
    ? (piece.rotationState + 1) % 4
    : (piece.rotationState + 3) % 4;

  const kickKey = `${piece.rotationState}>${nextRotation}`;
  const kickTable = piece.type === 'I' ? WALL_KICK_DATA.I : WALL_KICK_DATA.normal;
  const kicks = kickTable[kickKey] || [[0, 0]];

  for (const [dx, dy] of kicks) {
    if (isValidPosition(board, newShape, piece.row - dy, piece.col + dx)) {
      return {
        ...piece,
        shape: newShape,
        col: piece.col + dx,
        row: piece.row - dy,
        rotationState: nextRotation,
        lastAction: 'rotate',
      };
    }
  }
  return null;
}

/** T-spin detection: check 3 of 4 corners occupied after T rotation */
export function detectTSpin(board, piece) {
  if (piece.type !== 'T' || piece.lastAction !== 'rotate') return 'none';

  const centerRow = piece.row + 1;
  const centerCol = piece.col + 1;

  const corners = [
    [centerRow - 1, centerCol - 1],
    [centerRow - 1, centerCol + 1],
    [centerRow + 1, centerCol - 1],
    [centerRow + 1, centerCol + 1],
  ];

  let filledCorners = 0;
  for (const [r, c] of corners) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS || board[r][c]) {
      filledCorners += 1;
    }
  }

  if (filledCorners >= 3) return 'full';
  if (filledCorners >= 2) return 'mini';
  return 'none';
}

export function lockPiece(board, piece) {
  const newBoard = board.map((row) => [...row]);
  for (let r = 0; r < piece.shape.length; r += 1) {
    for (let c = 0; c < piece.shape[r].length; c += 1) {
      if (!piece.shape[r][c]) continue;
      const bRow = piece.row + r;
      const bCol = piece.col + c;
      if (bRow >= 0 && bRow < BOARD_ROWS && bCol >= 0 && bCol < BOARD_COLS) {
        newBoard[bRow][bCol] = piece.color;
      }
    }
  }
  return newBoard;
}

export function clearLines(board) {
  const kept = board.filter((row) => row.some((cell) => !cell));
  const cleared = BOARD_ROWS - kept.length;
  const empty = Array.from({ length: cleared }, () => Array(BOARD_COLS).fill(null));
  return { board: [...empty, ...kept], linesCleared: cleared };
}

/** Check if the board is completely empty (perfect clear) */
export function isPerfectClear(board) {
  return board.every((row) => row.every((cell) => !cell));
}

/**
 * Calculate points for a line clear with all bonuses.
 * @param {number} linesCleared
 * @param {number} level
 * @param {string} tSpin - 'none' | 'mini' | 'full'
 * @param {number} combo - consecutive line clear count
 * @param {boolean} backToBack - previous was Tetris or T-spin
 * @param {boolean} perfectClear - board empty after clear
 */
export function calculateScore(linesCleared, level, tSpin, combo, backToBack, perfectClear) {
  if (linesCleared === 0) return { points: 0, isSpecial: false, label: null };

  let base;
  let label;
  let isSpecial = false;

  if (tSpin === 'full') {
    base = [0, POINTS.T_SPIN_SINGLE, POINTS.T_SPIN_DOUBLE, POINTS.T_SPIN_TRIPLE][Math.min(linesCleared, 3)] || 0;
    label = `T-SPIN ${LINE_CLEAR_NAMES[linesCleared] || ''}`;
    isSpecial = true;
  } else if (tSpin === 'mini') {
    base = POINTS.T_SPIN_MINI;
    label = 'T-SPIN MINI';
    isSpecial = true;
  } else {
    base = [0, POINTS.SINGLE, POINTS.DOUBLE, POINTS.TRIPLE, POINTS.TETRIS][Math.min(linesCleared, 4)] || 0;
    label = LINE_CLEAR_NAMES[Math.min(linesCleared, 4)];
    isSpecial = linesCleared >= 4;
  }

  let points = base * (level + 1);

  // Back-to-back bonus (Tetris or T-spin after another Tetris or T-spin)
  if (backToBack && isSpecial) {
    points = Math.floor(points * POINTS.BACK_TO_BACK_MULTIPLIER);
    label = `B2B ${label}`;
  }

  // Combo bonus
  if (combo > 0) {
    points += POINTS.COMBO_BONUS * combo * (level + 1);
  }

  // Perfect clear bonus
  if (perfectClear) {
    points += POINTS.PERFECT_CLEAR * (level + 1);
    label = `${label} + PERFECT`;
  }

  return { points, isSpecial, label };
}

export function getLevel(totalLines, startLevel = 0) {
  return Math.min(startLevel + Math.floor(totalLines / 10), LEVEL_SPEEDS.length - 1);
}

export function getDropSpeed(level) {
  return LEVEL_SPEEDS[Math.min(level, LEVEL_SPEEDS.length - 1)];
}

export function getGhostPosition(board, piece) {
  let ghostRow = piece.row;
  while (isValidPosition(board, piece.shape, ghostRow + 1, piece.col)) {
    ghostRow += 1;
  }
  return ghostRow;
}

export function hardDrop(board, piece) {
  const ghostRow = getGhostPosition(board, piece);
  const cellsDropped = ghostRow - piece.row;
  return { piece: { ...piece, row: ghostRow }, cellsDropped };
}

/** Get items from the bag, refilling as needed. Returns { keys[], remainingBag[] } */
export function drawFromBag(bag, count) {
  let b = [...bag];
  const drawn = [];
  while (drawn.length < count) {
    if (b.length === 0) b = createBag();
    drawn.push(b.shift());
  }
  return { keys: drawn, bag: b };
}

/** Create initial game stats */
export function createStats() {
  return {
    piecesPlaced: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    tetrises: 0,
    tSpins: 0,
    maxCombo: 0,
    perfectClears: 0,
  };
}

/** Update stats after a lock */
export function updateStats(stats, linesCleared, tSpin, combo, perfectClear) {
  const updated = { ...stats, piecesPlaced: stats.piecesPlaced + 1 };
  if (linesCleared === 1 && tSpin === 'none') updated.singles += 1;
  else if (linesCleared === 2 && tSpin === 'none') updated.doubles += 1;
  else if (linesCleared === 3 && tSpin === 'none') updated.triples += 1;
  else if (linesCleared >= 4) updated.tetrises += 1;
  if (tSpin !== 'none') updated.tSpins += 1;
  if (perfectClear) updated.perfectClears += 1;
  updated.maxCombo = Math.max(updated.maxCombo, combo);
  return updated;
}
