/**
 * tetris.js — Pure game logic for Tetris (no React dependencies).
 * Features: 7-bag randomizer, hold piece, combos, back-to-back Tetris,
 * T-spin detection (full/mini), lock delay, SRS wall kicks, ghost piece,
 * level system, 180° rotation, garbage lines, board themes.
 */

export const BOARD_ROWS = 20;
export const BOARD_COLS = 10;

/* ── Piece definitions (shapes only, colors resolved via theme) ── */

export const TETROMINOES = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { shape: [[1, 1], [1, 1]] },
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
};

const PIECE_KEYS = Object.keys(TETROMINOES);

/* ── Themes ── */

export const THEMES = {
  classic: {
    name: 'Класик',
    colors: { I: '#00BCD4', O: '#FFC107', T: '#9C27B0', S: '#4CAF50', Z: '#F44336', J: '#2196F3', L: '#FF9800', garbage: '#666666' },
    bg: '#1a1a2e',
    boardBg: '#0a0a0a',
    boardSurface: '#0a0a0a',
    frameColor: '#1C1428',
    previewBorder: '#1C1428',
  },
  neon: {
    name: 'Неон',
    colors: { I: '#00FFFF', O: '#FFE500', T: '#FF00FF', S: '#00FF66', Z: '#FF3333', J: '#3399FF', L: '#FF8800', garbage: '#555555' },
    bg: '#0d0d1a',
    boardBg: '#000000',
    boardSurface: '#000000',
    frameColor: '#1C1428',
    previewBorder: '#1C1428',
  },
  mono: {
    name: 'Моно',
    colors: { I: '#E0E0E0', O: '#C8C8C8', T: '#A8A8A8', S: '#D8D8D8', Z: '#B8B8B8', J: '#989898', L: '#D0D0D0', garbage: '#505050' },
    bg: '#222222',
    boardBg: '#111111',
    boardSurface: '#111111',
    frameColor: '#1C1428',
    previewBorder: '#1C1428',
  },
  retro: {
    name: 'Ретро',
    colors: { I: '#9BBC0F', O: '#8BAC0F', T: '#6A8C0F', S: '#7B9C0F', Z: '#5A7C0F', J: '#4A6C0F', L: '#8BAC0F', garbage: '#3A5C0F' },
    bg: '#0F380F',
    boardBg: '#0F380F',
    boardSurface: '#0F380F',
    frameColor: '#1C1428',
    previewBorder: '#1C1428',
  },
  lagoon: {
    name: 'Lagoon',
    colors: {
      I: '#8BFFF8',
      O: '#B6FF62',
      T: '#36E1D3',
      S: '#00D5B5',
      Z: '#00A9C2',
      J: '#59DEFF',
      L: '#15B7D6',
      garbage: '#24545C',
    },
    bg: '#03171C',
    boardBg: '#041E24',
    boardSurface: 'radial-gradient(circle at 18% 12%, rgba(122,255,244,0.18), transparent 30%), radial-gradient(circle at 82% 86%, rgba(0,184,166,0.22), transparent 28%), linear-gradient(180deg, #073038 0%, #04171C 58%, #020C10 100%)',
    frameColor: '#69F7E8',
    previewBorder: '#55E4D8',
  },
};

/* ── Level & speed ── */

/**
 * Tetris Guideline gravity formula (from Tetris Worlds).
 * Returns milliseconds per row drop for a given level (0-based).
 * Formula: seconds = (0.8 - (level * 0.007)) ^ level
 * Caps at 20G (≈0.83ms) which is effectively instant.
 */
export function getGuidelineGravityMs(level) {
  if (level >= 20) return 1; // 20G cap — instant
  const seconds = Math.pow(0.8 - (level * 0.007), level);
  return Math.max(1, Math.round(seconds * 1000));
}

/** Legacy speed table (kept for reference, no longer used in gameplay) */
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

/* ── Board helpers ── */

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
  let minR = shape.length, maxR = 0, minC = shape[0].length, maxC = 0;
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
  const { shape } = TETROMINOES[key];
  return {
    type: key,
    shape: shape.map((row) => [...row]),
    row: key === 'I' ? -1 : 0,
    col: Math.floor((BOARD_COLS - shape[0].length) / 2),
    rotationState: 0,
  };
}

/* ── Rotation helpers ── */

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

export function rotate180(shape) {
  return rotateCW(rotateCW(shape));
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

/* ── SRS wall kick data ── */

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

/** 180° kick offsets (simplified) */
const KICK_180 = {
  normal: [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]],
  I: [[0, 0], [0, 1], [0, -1], [0, 2], [0, -2]],
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

/** 180° rotation with kick offsets */
export function tryRotate180(board, piece) {
  if (piece.type === 'O') return null; // O doesn't rotate
  const newShape = rotate180(piece.shape);
  const nextRotation = (piece.rotationState + 2) % 4;
  const kicks = piece.type === 'I' ? KICK_180.I : KICK_180.normal;

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

/* ── T-spin detection ── */

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

/* ── Board operations ── */

/** Lock piece onto board — stores piece TYPE (letter) for theme-based coloring */
export function lockPiece(board, piece) {
  const newBoard = board.map((row) => [...row]);
  for (let r = 0; r < piece.shape.length; r += 1) {
    for (let c = 0; c < piece.shape[r].length; c += 1) {
      if (!piece.shape[r][c]) continue;
      const bRow = piece.row + r;
      const bCol = piece.col + c;
      if (bRow >= 0 && bRow < BOARD_ROWS && bCol >= 0 && bCol < BOARD_COLS) {
        newBoard[bRow][bCol] = piece.type;
      }
    }
  }
  return newBoard;
}

/** Returns cleared board, count, and which row indices were cleared */
export function clearLines(board) {
  const clearedIndices = [];
  const kept = [];
  for (let r = 0; r < board.length; r += 1) {
    if (board[r].every((cell) => cell)) {
      clearedIndices.push(r);
    } else {
      kept.push(board[r]);
    }
  }
  const cleared = BOARD_ROWS - kept.length;
  const empty = Array.from({ length: cleared }, () => Array(BOARD_COLS).fill(null));
  return { board: [...empty, ...kept], linesCleared: cleared, clearedIndices };
}

export function isPerfectClear(board) {
  return board.every((row) => row.every((cell) => !cell));
}

/** Add a garbage line at the bottom with one random gap */
export function addGarbageLine(board, gapCol) {
  const gap = gapCol ?? Math.floor(Math.random() * BOARD_COLS);
  const garbageRow = Array(BOARD_COLS).fill('garbage');
  garbageRow[gap] = null;
  return [...board.slice(1), garbageRow];
}

/* ── Scoring ── */

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

  if (backToBack && isSpecial) {
    points = Math.floor(points * POINTS.BACK_TO_BACK_MULTIPLIER);
    label = `B2B ${label}`;
  }

  if (combo > 0) {
    points += POINTS.COMBO_BONUS * combo * (level + 1);
  }

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
  return getGuidelineGravityMs(level);
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

export function drawFromBag(bag, count) {
  let b = [...bag];
  const drawn = [];
  while (drawn.length < count) {
    if (b.length === 0) b = createBag();
    drawn.push(b.shift());
  }
  return { keys: drawn, bag: b };
}

export const TETRIS_CODE_TO_LATIN = {
  KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e', KeyF: 'f', KeyG: 'g',
  KeyH: 'h', KeyI: 'i', KeyJ: 'j', KeyK: 'k', KeyL: 'l', KeyM: 'm', KeyN: 'n',
  KeyO: 'o', KeyP: 'p', KeyQ: 'q', KeyR: 'r', KeyS: 's', KeyT: 't', KeyU: 'u',
  KeyV: 'v', KeyW: 'w', KeyX: 'x', KeyY: 'y', KeyZ: 'z',
  Space: ' ', Slash: '/', Comma: ',', Period: '.', Semicolon: ';',
};

export function getTetrisBindingKey(key, code) {
  if (code && TETRIS_CODE_TO_LATIN[code]) return TETRIS_CODE_TO_LATIN[code];
  return key;
}

export function shouldCountTetrisKeypress(action, repeat = false) {
  if (repeat) return false;
  return [
    'moveLeft',
    'moveRight',
    'softDrop',
    'hardDrop',
    'rotateCW',
    'rotateCCW',
    'rotate180',
    'hold',
  ].includes(action);
}

/**
 * Pure-logic spawn resolver — mirrors GameTetrisPage.spawnPiece() for testability.
 * Given current state, returns next state after spawn + optional IHS.
 *
 * @param {Object} state - { queue, bag, board, holdKey, holdUsed, queueSize, ihsHeld }
 * @returns {Object} - { piece, queue, bag, holdKey, holdUsed }
 */
export function resolveSpawn({ queue, bag, board, holdKey, holdUsed, queueSize, ihsHeld }) {
  let currentBag = bag;
  const nextKey = queue[0];
  const newQueue = queue.slice(1);

  // Refill queue
  const needed = queueSize - newQueue.length;
  if (needed > 0) {
    const { keys, bag: rem } = drawFromBag(currentBag, needed);
    newQueue.push(...keys);
    currentBag = rem;
  }

  let piece = pieceFromKey(nextKey);
  let newHoldKey = holdKey;
  let ihsUsed = false;
  let finalQueue = newQueue;

  if (ihsHeld && !holdUsed) {
    if (holdKey) {
      // Swap with existing hold
      const fromHold = pieceFromKey(holdKey);
      if (isValidPosition(board, fromHold.shape, fromHold.row, fromHold.col)) {
        newHoldKey = piece.type;
        ihsUsed = true;
        piece = fromHold;
      }
    } else {
      // Fresh-game IHS — stash current, spawn next from queue
      newHoldKey = piece.type;
      ihsUsed = true;
      const nextFromQueue = newQueue[0];
      if (nextFromQueue) {
        piece = pieceFromKey(nextFromQueue);
        finalQueue = newQueue.slice(1);
        const { keys: [fill], bag: updatedBag } = drawFromBag(currentBag, 1);
        finalQueue.push(fill);
        currentBag = updatedBag;
      }
    }
  }

  return { piece, queue: finalQueue, bag: currentBag, holdKey: newHoldKey, holdUsed: ihsUsed };
}

/* ── Stats ── */

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

/** Garbage line interval based on level (pieces between garbage additions) */
export function getGarbageInterval(level) {
  if (level < 3) return 12;
  if (level < 6) return 10;
  if (level < 9) return 8;
  return 6;
}
