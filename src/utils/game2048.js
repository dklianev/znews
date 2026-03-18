/**
 * game2048.js — Pure logic for 2048 game.
 * CEF 103 safe — no modern APIs used.
 */

export const GRID = 4;

/** Create empty 4×4 board (0 = empty). */
export function createBoard() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(0));
}

/** Deep-clone a board. */
export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

/** Get all empty cell positions. */
function emptyCells(board) {
  const cells = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] === 0) cells.push({ r, c });
    }
  }
  return cells;
}

/** Place a random tile (90% = 2, 10% = 4) on an empty cell. Returns new board or null if full. */
export function addRandomTile(board) {
  const empty = emptyCells(board);
  if (empty.length === 0) return null;
  const cell = empty[Math.floor(Math.random() * empty.length)];
  const next = cloneBoard(board);
  next[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

/** Initialize a new game with 2 random tiles. */
export function initBoard() {
  let board = createBoard();
  board = addRandomTile(board);
  board = addRandomTile(board);
  return board;
}

/**
 * Slide a single row left, merging equal adjacent tiles.
 * Returns { row, score, merged } where merged is an array of booleans indicating merged positions.
 */
function slideRow(row) {
  // Remove zeros
  const filtered = row.filter((v) => v !== 0);
  const result = [];
  const merged = [];
  let score = 0;

  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      result.push(val);
      merged.push(true);
      score += val;
      i += 2;
    } else {
      result.push(filtered[i]);
      merged.push(false);
      i += 1;
    }
  }

  // Pad with zeros
  while (result.length < GRID) {
    result.push(0);
    merged.push(false);
  }

  return { row: result, score, merged };
}

/** Rotate board 90° clockwise. */
function rotateClockwise(board) {
  const n = board.length;
  const rotated = createBoard();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = board[r][c];
    }
  }
  return rotated;
}

/** Rotate board 90° counter-clockwise. */
function rotateCounterClockwise(board) {
  const n = board.length;
  const rotated = createBoard();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[n - 1 - c][r] = board[r][c];
    }
  }
  return rotated;
}

/**
 * Move the board in a direction.
 * Returns { board, score, moved, mergedCells } or null if no move possible.
 */
export function move(board, direction) {
  let rotated = board;
  let rotations = 0;

  // Rotate so that all moves become "left"
  switch (direction) {
    case 'left': rotations = 0; break;
    case 'right': rotations = 2; break;
    case 'up': rotations = 1; break;
    case 'down': rotations = 3; break;
    default: return null;
  }

  for (let i = 0; i < rotations; i++) rotated = rotateClockwise(rotated);

  let totalScore = 0;
  let moved = false;
  const newBoard = [];
  const mergedPositions = [];

  for (let r = 0; r < GRID; r++) {
    const { row, score, merged } = slideRow(rotated[r]);
    newBoard.push(row);
    totalScore += score;
    mergedPositions.push(merged);
    if (!moved) {
      for (let c = 0; c < GRID; c++) {
        if (row[c] !== rotated[r][c]) { moved = true; break; }
      }
    }
  }

  if (!moved) return null;

  // Rotate back
  let result = newBoard;
  let mergedResult = mergedPositions;
  for (let i = 0; i < (4 - rotations) % 4; i++) {
    result = rotateClockwise(result);
    // Rotate merged positions the same way
    const n = GRID;
    const rotMerged = Array.from({ length: n }, () => Array(n).fill(false));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        rotMerged[c][n - 1 - r] = mergedResult[r][c];
      }
    }
    mergedResult = rotMerged;
  }

  // Collect merged cell coordinates
  const mergedCells = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (mergedResult[r][c]) mergedCells.push({ r, c });
    }
  }

  return { board: result, score: totalScore, moved: true, mergedCells };
}

/** Check if the player has a 2048 tile. */
export function hasWon(board) {
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] >= 2048) return true;
    }
  }
  return false;
}

/** Check if any move is possible. */
export function canMove(board) {
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] === 0) return true;
      if (c + 1 < GRID && board[r][c] === board[r][c + 1]) return true;
      if (r + 1 < GRID && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

/** Get the highest tile value on the board. */
export function getMaxTile(board) {
  let max = 0;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] > max) max = board[r][c];
    }
  }
  return max;
}

/** Color map for tile values. */
export const TILE_COLORS = {
  0:    { bg: '#cdc1b4', text: '#cdc1b4' },
  2:    { bg: '#eee4da', text: '#776e65' },
  4:    { bg: '#ede0c8', text: '#776e65' },
  8:    { bg: '#f2b179', text: '#f9f6f2' },
  16:   { bg: '#f59563', text: '#f9f6f2' },
  32:   { bg: '#f67c5f', text: '#f9f6f2' },
  64:   { bg: '#f65e3b', text: '#f9f6f2' },
  128:  { bg: '#edcf72', text: '#f9f6f2' },
  256:  { bg: '#edcc61', text: '#f9f6f2' },
  512:  { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
  4096: { bg: '#3c3a32', text: '#f9f6f2' },
  8192: { bg: '#3c3a32', text: '#f9f6f2' },
};

export function getTileColor(value) {
  return TILE_COLORS[value] || TILE_COLORS[8192];
}
