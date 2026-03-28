export const BLOCK_BUST_BOARD_SIZE = 8;
export const BLOCK_BUST_RUN_SCOPE = 'run';
export const BLOCK_BUST_META_SCOPE = 'meta';
export const BLOCK_BUST_SETTINGS_KEY = 'zn_blockbust_settings_v1';
export const BLOCK_BUST_RUN_VERSION = 2;

export const BLOCK_BUST_THEMES = Object.freeze([
  {
    id: 'hot-wire',
    name: 'Hot Wire',
    pageGradient: 'linear-gradient(180deg, #fff3eb 0%, #f3e2d4 100%)',
    pageGlow: 'rgba(232, 116, 32, 0.18)',
    boardBg: 'linear-gradient(180deg, #451217 0%, #24090c 100%)',
    boardInset: 'rgba(255, 214, 187, 0.08)',
    boardBorder: '#7f130e',
    boardShadow: '0 24px 55px rgba(140, 24, 14, 0.28)',
    cellBg: 'rgba(255, 239, 229, 0.08)',
    cellBorder: 'rgba(255, 222, 201, 0.12)',
    fillFrom: '#ffb447',
    fillTo: '#e84b20',
    fillShadow: 'rgba(255, 120, 32, 0.34)',
    ghost: 'rgba(255, 180, 71, 0.38)',
    invalid: 'rgba(239, 68, 68, 0.38)',
    accent: '#ff8c35',
    accentSoft: 'rgba(255, 140, 53, 0.2)',
    ribbonFrom: '#ff7a20',
    ribbonTo: '#cc0a1a',
  },
  {
    id: 'underworld',
    name: 'Underworld',
    pageGradient: 'linear-gradient(180deg, #f0ecff 0%, #e4dff6 100%)',
    pageGlow: 'rgba(91, 26, 140, 0.2)',
    boardBg: 'linear-gradient(180deg, #281339 0%, #12081f 100%)',
    boardInset: 'rgba(191, 161, 255, 0.08)',
    boardBorder: '#4e1e74',
    boardShadow: '0 24px 55px rgba(67, 20, 112, 0.28)',
    cellBg: 'rgba(237, 228, 255, 0.07)',
    cellBorder: 'rgba(219, 197, 255, 0.14)',
    fillFrom: '#7b35b5',
    fillTo: '#4f7cff',
    fillShadow: 'rgba(90, 82, 255, 0.32)',
    ghost: 'rgba(130, 97, 255, 0.35)',
    invalid: 'rgba(251, 113, 133, 0.36)',
    accent: '#8a5cff',
    accentSoft: 'rgba(138, 92, 255, 0.18)',
    ribbonFrom: '#5b1a8c',
    ribbonTo: '#23368f',
  },
  {
    id: 'court-gold',
    name: 'Court Gold',
    pageGradient: 'linear-gradient(180deg, #fff8ea 0%, #efe1c7 100%)',
    pageGlow: 'rgba(232, 184, 48, 0.18)',
    boardBg: 'linear-gradient(180deg, #5a3c08 0%, #291400 100%)',
    boardInset: 'rgba(255, 228, 166, 0.08)',
    boardBorder: '#a16d09',
    boardShadow: '0 24px 55px rgba(109, 72, 9, 0.25)',
    cellBg: 'rgba(255, 246, 224, 0.08)',
    cellBorder: 'rgba(255, 233, 181, 0.16)',
    fillFrom: '#ffd465',
    fillTo: '#cc7a10',
    fillShadow: 'rgba(232, 184, 48, 0.34)',
    ghost: 'rgba(255, 215, 112, 0.34)',
    invalid: 'rgba(234, 88, 12, 0.34)',
    accent: '#d8a51f',
    accentSoft: 'rgba(216, 165, 31, 0.18)',
    ribbonFrom: '#f5bf42',
    ribbonTo: '#c97212',
  },
  {
    id: 'neon-night',
    name: 'Neon Night',
    pageGradient: 'linear-gradient(180deg, #e9f9fb 0%, #d8eef3 100%)',
    pageGlow: 'rgba(0, 136, 170, 0.18)',
    boardBg: 'linear-gradient(180deg, #0d2445 0%, #091120 100%)',
    boardInset: 'rgba(130, 238, 255, 0.08)',
    boardBorder: '#1b4e78',
    boardShadow: '0 24px 55px rgba(17, 69, 112, 0.26)',
    cellBg: 'rgba(239, 253, 255, 0.07)',
    cellBorder: 'rgba(180, 244, 255, 0.15)',
    fillFrom: '#48ddff',
    fillTo: '#275cff',
    fillShadow: 'rgba(72, 221, 255, 0.3)',
    ghost: 'rgba(72, 221, 255, 0.32)',
    invalid: 'rgba(244, 114, 182, 0.34)',
    accent: '#2cc8ff',
    accentSoft: 'rgba(44, 200, 255, 0.18)',
    ribbonFrom: '#00a0d2',
    ribbonTo: '#2453ff',
  },
  {
    id: 'press-ink',
    name: 'Press Ink',
    pageGradient: 'linear-gradient(180deg, #f8f5ef 0%, #e7e0d4 100%)',
    pageGlow: 'rgba(28, 20, 40, 0.12)',
    boardBg: 'linear-gradient(180deg, #35323e 0%, #19161f 100%)',
    boardInset: 'rgba(255, 255, 255, 0.05)',
    boardBorder: '#4a4654',
    boardShadow: '0 24px 55px rgba(22, 20, 29, 0.25)',
    cellBg: 'rgba(255, 255, 255, 0.06)',
    cellBorder: 'rgba(255, 255, 255, 0.09)',
    fillFrom: '#f1eee8',
    fillTo: '#a09db3',
    fillShadow: 'rgba(242, 237, 229, 0.18)',
    ghost: 'rgba(255, 255, 255, 0.18)',
    invalid: 'rgba(251, 113, 133, 0.28)',
    accent: '#39335a',
    accentSoft: 'rgba(57, 51, 90, 0.14)',
    ribbonFrom: '#2f2842',
    ribbonTo: '#6e657f',
  },
  {
    id: 'red-alert',
    name: 'Red Alert',
    pageGradient: 'linear-gradient(180deg, #fff1f3 0%, #f8ddd9 100%)',
    pageGlow: 'rgba(204, 10, 26, 0.18)',
    boardBg: 'linear-gradient(180deg, #53050f 0%, #250007 100%)',
    boardInset: 'rgba(255, 207, 214, 0.08)',
    boardBorder: '#9f0e1d',
    boardShadow: '0 24px 55px rgba(127, 13, 22, 0.3)',
    cellBg: 'rgba(255, 240, 242, 0.08)',
    cellBorder: 'rgba(255, 212, 217, 0.16)',
    fillFrom: '#ff8b95',
    fillTo: '#cc0a1a',
    fillShadow: 'rgba(239, 68, 68, 0.32)',
    ghost: 'rgba(248, 113, 113, 0.32)',
    invalid: 'rgba(254, 202, 202, 0.24)',
    accent: '#d61b31',
    accentSoft: 'rgba(214, 27, 49, 0.18)',
    ribbonFrom: '#ff5a66',
    ribbonTo: '#cc0a1a',
  },
]);

export const BLOCK_BUST_DEFAULT_SETTINGS = Object.freeze({
  controlMode: 'drag-tap',
  showPlacementPreview: true,
  animationLevel: 'normal',
  soundEnabled: true,
  confirmRestart: false,
  gridContrast: 'normal',
  leftHanded: false,
});

// Block Blast-style piece set - 19 base families:
// - 7 classic tetromino families (I/O/T/S/Z/J/L)
// - 12 extra fillers and larger irregulars common to Block Blast-style runs
// Each base generates its own rotations automatically, but mirrored families
// stay separate so the tray can produce both S/Z and J/L style pieces.
const BASE_PIECE_DEFINITIONS = Object.freeze([
  { slug: 'dot',          weight: 9,   tags: ['rescue'], cells: [[0, 0]] },
  { slug: 'bar2',         weight: 18,  tags: ['rescue'], cells: [[0, 0], [0, 1]] },
  { slug: 'bar3',         weight: 16,  tags: ['rescue'], cells: [[0, 0], [0, 1], [0, 2]] },
  { slug: 'corner3',      weight: 7,   tags: ['stable'], cells: [[0, 0], [1, 0], [1, 1]] },
  { slug: 'bar4',         weight: 11,  tags: ['line'],   cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { slug: 'square2',      weight: 9,   tags: ['stable'], cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { slug: 'tee4',         weight: 5,   tags: ['stable'], cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  { slug: 'zig4-s',       weight: 3.8, tags: ['stable'], cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { slug: 'zig4-z',       weight: 3.8, tags: ['stable'], cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { slug: 'corner4-j',    weight: 4.2, tags: ['stable'], cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { slug: 'corner4-l',    weight: 4.2, tags: ['stable'], cells: [[0, 1], [1, 1], [2, 1], [2, 0]] },
  { slug: 'bar5',         weight: 8.2, tags: ['line'],   cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { slug: 'corner5-j',    weight: 2.6, tags: ['stable'], cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { slug: 'corner5-l',    weight: 2.6, tags: ['stable'], cells: [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]] },
  { slug: 'tee5',         weight: 2.8, tags: ['stable'], cells: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]] },
  { slug: 'zig5-s',       weight: 2.3, tags: ['stable'], cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { slug: 'zig5-z',       weight: 2.3, tags: ['stable'], cells: [[0, 2], [1, 1], [1, 2], [2, 0], [2, 1]] },
  { slug: 'rect23',       weight: 5,   tags: ['stable'], cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { slug: 'square3',      weight: 3,   tags: ['stable'], cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] },
]);

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function normalizeCells(cells) {
  const safeCells = Array.isArray(cells) ? cells : [];
  let minRow = Number.POSITIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  for (const [row, col] of safeCells) {
    minRow = Math.min(minRow, row);
    minCol = Math.min(minCol, col);
  }
  return safeCells
    .map(([row, col]) => [row - minRow, col - minCol])
    .sort((left, right) => (left[0] - right[0]) || (left[1] - right[1]));
}

function rotateCells(cells) {
  const safeCells = Array.isArray(cells) ? cells : [];
  let maxCol = 0;
  for (const [, col] of safeCells) maxCol = Math.max(maxCol, col);
  return normalizeCells(safeCells.map(([row, col]) => [col, maxCol - row]));
}

function serializeCells(cells) {
  return normalizeCells(cells).map(([row, col]) => `${row}:${col}`).join('|');
}

function buildPieceCatalog() {
  const pieces = [];
  for (const definition of BASE_PIECE_DEFINITIONS) {
    const seen = new Set();
    let current = normalizeCells(definition.cells);
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const key = serializeCells(current);
      if (!seen.has(key)) {
        seen.add(key);
        const maxRow = current.reduce((best, [row]) => Math.max(best, row), 0);
        const maxCol = current.reduce((best, [, col]) => Math.max(best, col), 0);
        pieces.push({
          id: `${definition.slug}-${rotation}`,
          slug: definition.slug,
          band: definition.band || 1,
          weight: definition.weight,
          tags: [...definition.tags],
          cells: current.map(([row, col]) => [row, col]),
          height: maxRow + 1,
          width: maxCol + 1,
          size: current.length,
        });
      }
      current = rotateCells(current);
    }
  }
  return pieces;
}

export const BLOCK_BUST_PIECES = Object.freeze(buildPieceCatalog());

export function createEmptyBlockBustBoard() {
  return Array.from({ length: BLOCK_BUST_BOARD_SIZE }, () => Array(BLOCK_BUST_BOARD_SIZE).fill(0));
}

export function createBlockBustInitialCursor() {
  return { row: 0, col: 0 };
}

export function getBlockBustTheme(themeId) {
  return BLOCK_BUST_THEMES.find((theme) => theme.id === themeId) || BLOCK_BUST_THEMES[0];
}

export function getBlockBustNextThemeId(currentThemeId) {
  const available = BLOCK_BUST_THEMES.filter(t => t.id !== currentThemeId);
  if (available.length === 0) return currentThemeId;
  return available[Math.floor(Math.random() * available.length)].id;
}

export function getBlockBustLevel(totalLines = 0) {
  return 1 + Math.floor(Math.max(0, totalLines) / 8);
}

export function getBlockBustDifficultyBand(level = 1) {
  if (level >= 11) return 4;
  if (level >= 7) return 3;
  if (level >= 4) return 2;
  return 1;
}

export function getBlockBustBoardOccupancy(board) {
  const safeBoard = Array.isArray(board) ? board : [];
  const filled = safeBoard.flat().filter(Boolean).length;
  return filled / (BLOCK_BUST_BOARD_SIZE * BLOCK_BUST_BOARD_SIZE);
}

export function canPlaceBlockBustPiece(board, piece, row, col) {
  if (!Array.isArray(board) || !piece) return false;
  for (const [cellRow, cellCol] of piece.cells) {
    const nextRow = row + cellRow;
    const nextCol = col + cellCol;
    if (nextRow < 0 || nextCol < 0 || nextRow >= BLOCK_BUST_BOARD_SIZE || nextCol >= BLOCK_BUST_BOARD_SIZE) return false;
    if (board[nextRow]?.[nextCol]) return false;
  }
  return true;
}

export function getBlockBustValidPlacements(board, piece) {
  const placements = [];
  if (!piece) return placements;
  for (let row = 0; row <= BLOCK_BUST_BOARD_SIZE - piece.height; row += 1) {
    for (let col = 0; col <= BLOCK_BUST_BOARD_SIZE - piece.width; col += 1) {
      if (canPlaceBlockBustPiece(board, piece, row, col)) placements.push({ row, col });
    }
  }
  return placements;
}

export function placeBlockBustPiece(board, piece, row, col) {
  const nextBoard = cloneBoard(board);
  for (const [cellRow, cellCol] of piece.cells) {
    nextBoard[row + cellRow][col + cellCol] = 1;
  }
  return nextBoard;
}

export function clearBlockBustLines(board) {
  const nextBoard = cloneBoard(board);
  const clearedRows = [];
  const clearedCols = [];

  for (let row = 0; row < BLOCK_BUST_BOARD_SIZE; row += 1) {
    if (nextBoard[row].every(Boolean)) clearedRows.push(row);
  }

  for (let col = 0; col < BLOCK_BUST_BOARD_SIZE; col += 1) {
    let full = true;
    for (let row = 0; row < BLOCK_BUST_BOARD_SIZE; row += 1) {
      if (!nextBoard[row][col]) {
        full = false;
        break;
      }
    }
    if (full) clearedCols.push(col);
  }

  for (const row of clearedRows) {
    for (let col = 0; col < BLOCK_BUST_BOARD_SIZE; col += 1) nextBoard[row][col] = 0;
  }
  for (const col of clearedCols) {
    for (let row = 0; row < BLOCK_BUST_BOARD_SIZE; row += 1) nextBoard[row][col] = 0;
  }

  return {
    board: nextBoard,
    clearedRows,
    clearedCols,
    lineCount: clearedRows.length + clearedCols.length,
  };
}

export function isBlockBustPerfectClear(board) {
  return Array.isArray(board) && board.flat().every((cell) => !cell);
}

export function hasAnyBlockBustPlacement(board, pieces) {
  return (Array.isArray(pieces) ? pieces : []).some((piece) => getBlockBustValidPlacements(board, piece).length > 0);
}

export function isBlockBustGameOver(board, pieces) {
  return !hasAnyBlockBustPlacement(board, pieces);
}

// Block Blast scoring — authentic formula:
// 1) Placement: +1 per cell placed (always)
// 2) Line clear: cleared_cells × 10 (8 per row/col, overlaps counted once)
// 3) Combo MULTIPLIER: consecutive clears multiply clear score (1st=1×, 2nd=2×, 3rd=3×...)
// 4) Perfect clear: flat +200 bonus
// The combo multiplier is the key mechanic — it makes streaks feel amazing.

function countClearedBlocks(board, clearedRows, clearedCols) {
  const cleared = new Set();
  for (const r of clearedRows) { for (let c = 0; c < BLOCK_BUST_BOARD_SIZE; c++) cleared.add(`${r}:${c}`); }
  for (const c of clearedCols) { for (let r = 0; r < BLOCK_BUST_BOARD_SIZE; r++) cleared.add(`${r}:${c}`); }
  return cleared.size;
}

export function resolveBlockBustMove(board, piece, row, col, combo = 0) {
  if (!canPlaceBlockBustPiece(board, piece, row, col)) return null;

  const placedBoard = placeBlockBustPiece(board, piece, row, col);
  const clearResult = clearBlockBustLines(placedBoard);
  const perfectClear = isBlockBustPerfectClear(clearResult.board);

  // Placement points: 1 per cell placed
  const placementScore = piece.size;

  // Line clear: 10 pts per cleared cell
  const blocksCleared = clearResult.lineCount > 0
    ? countClearedBlocks(placedBoard, clearResult.clearedRows, clearResult.clearedCols)
    : 0;
  const baseClearScore = blocksCleared * 10;

  // Combo: consecutive clears multiply the clear score
  const nextCombo = clearResult.lineCount > 0 ? combo + 1 : 0;
  const comboMultiplier = Math.max(1, nextCombo);
  const clearScore = baseClearScore * comboMultiplier;

  const perfectClearBonus = perfectClear ? 200 : 0;
  const score = placementScore + clearScore + perfectClearBonus;

  return {
    board: clearResult.board,
    score,
    baseClearScore,
    clearScore,
    comboMultiplier,
    perfectClearBonus,
    nextCombo,
    perfectClear,
    clearedRows: clearResult.clearedRows,
    clearedCols: clearResult.clearedCols,
    linesCleared: clearResult.lineCount,
    hadClear: clearResult.lineCount > 0,
  };
}

function getWeightedRandom(candidates, rng) {
  const total = candidates.reduce((sum, candidate) => sum + Math.max(0.001, candidate.weight), 0);
  let roll = rng() * total;
  for (const candidate of candidates) {
    roll -= Math.max(0.001, candidate.weight);
    if (roll <= 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

// ── Simulation-based tray generation ──
// Mirrors how real Block Blast likely works:
// 1. Generate ~25 candidate trios (weighted random)
// 2. Simulate greedy placement for each trio across all orderings
// 3. Filter to trios where at least one valid sequence exists
// 4. Score survivors by post-placement board health
// 5. Select trio using difficulty-weighted distribution

// Largest contiguous empty rectangle width that fits piece dimensions
function canFitPieceAnywhere(board, piece) {
  for (let r = 0; r <= BLOCK_BUST_BOARD_SIZE - piece.height; r++) {
    for (let c = 0; c <= BLOCK_BUST_BOARD_SIZE - piece.width; c++) {
      if (canPlaceBlockBustPiece(board, piece, r, c)) return true;
    }
  }
  return false;
}

// Check how many distinct piece families have at least one rotation that fits.
// Must check ALL rotations per family — a horizontal bar may not fit but vertical might.
function countFittablePieceFamilies(board) {
  const familyResult = new Map(); // slug → boolean (any rotation fits?)
  for (const piece of BLOCK_BUST_PIECES) {
    if (familyResult.get(piece.slug) === true) continue; // already confirmed fittable
    if (canFitPieceAnywhere(board, piece)) {
      familyResult.set(piece.slug, true);
    } else if (!familyResult.has(piece.slug)) {
      familyResult.set(piece.slug, false);
    }
  }
  let count = 0;
  for (const fits of familyResult.values()) if (fits) count += 1;
  return count;
}

function buildWeightedPieceCandidates(board, _level, currentTray = []) {
  const existingIds = new Set((Array.isArray(currentTray) ? currentTray : []).map((piece) => piece.id));
  const existingSlugs = new Set((Array.isArray(currentTray) ? currentTray : []).map((p) => p.slug));
  const occupancy = getBlockBustBoardOccupancy(board);

  return BLOCK_BUST_PIECES.map((piece) => {
    let weight = piece.weight;
    // Reduce duplicate shapes in the same tray
    if (existingIds.has(piece.id)) weight *= 0.3;
    else if (existingSlugs.has(piece.slug)) weight *= 0.5;

    // Scale down large pieces when board is filling up — prevents
    // unplaceable pieces dominating the pool at high occupancy
    if (piece.size >= 6 && occupancy > 0.35) {
      weight *= occupancy > 0.55 ? 0.15 : occupancy > 0.45 ? 0.4 : 0.7;
    } else if (piece.size >= 5 && occupancy > 0.5) {
      weight *= 0.5;
    }
    if (piece.tags.includes('rescue') && occupancy > 0.55) {
      weight *= 1.15;
    }
    if (piece.slug === 'square3' && occupancy > 0.32) {
      weight *= occupancy > 0.5 ? 0.2 : 0.5;
    }

    return { piece, weight };
  });
}

// Adjacency score: how many filled neighbors or walls border the piece cells.
// Higher = tighter packing = more realistic player behavior.
function placementAdjacency(board, piece, r, c) {
  let score = 0;
  for (const [pr, pc] of piece.cells) {
    const row = r + pr, col = c + pc;
    if (row > 0 && board[row - 1][col]) score += 2;
    if (row < BLOCK_BUST_BOARD_SIZE - 1 && board[row + 1][col]) score += 2;
    if (col > 0 && board[row][col - 1]) score += 2;
    if (col < BLOCK_BUST_BOARD_SIZE - 1 && board[row][col + 1]) score += 2;
    if (row === 0 || row === BLOCK_BUST_BOARD_SIZE - 1) score++;
    if (col === 0 || col === BLOCK_BUST_BOARD_SIZE - 1) score++;
  }
  return score;
}

// Greedy placement: maximize line clears, then adjacency (tight packing)
function greedyBestPlacement(board, piece) {
  let bestR = -1, bestC = -1, bestClears = -1, bestAdj = -1, bestBoard = null;
  const maxR = BLOCK_BUST_BOARD_SIZE - piece.height;
  const maxC = BLOCK_BUST_BOARD_SIZE - piece.width;
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      if (!canPlaceBlockBustPiece(board, piece, r, c)) continue;
      const placed = placeBlockBustPiece(board, piece, r, c);
      const cleared = clearBlockBustLines(placed);
      const adj = placementAdjacency(board, piece, r, c);
      if (cleared.lineCount > bestClears ||
          (cleared.lineCount === bestClears && adj > bestAdj)) {
        bestClears = cleared.lineCount;
        bestAdj = adj;
        bestR = r; bestC = c;
        bestBoard = cleared.board;
      }
    }
  }
  return bestR >= 0 ? { board: bestBoard, linesCleared: bestClears } : null;
}

// Simulate placing a trio in a specific order using greedy strategy
function simulateTrioPlacement(board, trio) {
  let b = board, totalCleared = 0;
  for (const piece of trio) {
    const result = greedyBestPlacement(b, piece);
    if (!result) return null;
    b = result.board;
    totalCleared += result.linesCleared;
  }
  return { board: b, linesCleared: totalCleared };
}

// Try all 6 orderings — return the best result (most lines cleared)
function evaluateTrio(board, trio) {
  const orderings = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  let best = null;
  for (const [a, b, c] of orderings) {
    const result = simulateTrioPlacement(board, [trio[a], trio[b], trio[c]]);
    if (result && (!best || result.linesCleared > best.linesCleared)) {
      best = result;
    }
  }
  return best;
}

function getLongestEmptyRun(board) {
  let best = 0;
  for (let row = 0; row < BLOCK_BUST_BOARD_SIZE; row += 1) {
    let run = 0;
    for (let col = 0; col < BLOCK_BUST_BOARD_SIZE; col += 1) {
      run = board[row][col] ? 0 : run + 1;
      if (run > best) best = run;
    }
  }
  for (let col = 0; col < BLOCK_BUST_BOARD_SIZE; col += 1) {
    let run = 0;
    for (let row = 0; row < BLOCK_BUST_BOARD_SIZE; row += 1) {
      run = board[row][col] ? 0 : run + 1;
      if (run > best) best = run;
    }
  }
  return best;
}

function getLargestEmptySquare(board) {
  for (let size = BLOCK_BUST_BOARD_SIZE; size >= 1; size -= 1) {
    const limit = BLOCK_BUST_BOARD_SIZE - size;
    for (let row = 0; row <= limit; row += 1) {
      for (let col = 0; col <= limit; col += 1) {
        let allEmpty = true;
        for (let r = 0; r < size && allEmpty; r += 1) {
          for (let c = 0; c < size; c += 1) {
            if (board[row + r][col + c]) {
              allEmpty = false;
              break;
            }
          }
        }
        if (allEmpty) return size;
      }
    }
  }
  return 0;
}

// Board health: occupancy + near-complete lines - traps + survivability
// Survivability: how many distinct piece shapes can still be placed?
// This is the key metric that prevents early game-overs - if only 2-3
// shapes fit, the board is dying even if occupancy looks fine.
function trioHealthScore(board) {
  let filled = 0, nearComplete = 0, trapped = 0;
  for (let r = 0; r < BLOCK_BUST_BOARD_SIZE; r++) {
    let rf = 0;
    for (let c = 0; c < BLOCK_BUST_BOARD_SIZE; c++) {
      if (board[r][c]) { filled++; rf++; }
      else {
        let walls = 0;
        if (r === 0 || board[r - 1][c]) walls++;
        if (r === BLOCK_BUST_BOARD_SIZE - 1 || board[r + 1][c]) walls++;
        if (c === 0 || board[r][c - 1]) walls++;
        if (c === BLOCK_BUST_BOARD_SIZE - 1 || board[r][c + 1]) walls++;
        if (walls >= 3) trapped += walls === 4 ? 2 : 1;
      }
    }
    if (rf >= 6) nearComplete++;
  }
  for (let c = 0; c < BLOCK_BUST_BOARD_SIZE; c++) {
    let cf = 0;
    for (let r = 0; r < BLOCK_BUST_BOARD_SIZE; r++) if (board[r][c]) cf++;
    if (cf >= 6) nearComplete++;
  }

  // Survivability: count distinct piece slugs that have valid placements
  const fittable = countFittablePieceFamilies(board);

  const longestRun = getLongestEmptyRun(board);
  const largestSquare = getLargestEmptySquare(board);

  return (
    (1 - filled / 64) * 38
    + nearComplete * 15
    - trapped * 6
    + fittable * 4
    + longestRun * 2.8
    + largestSquare * 6
  );
}

export function createBlockBustTray(board, level = 1, rng = Math.random) {
  const safeRng = typeof rng === 'function' ? rng : Math.random;
  const occupancy = getBlockBustBoardOccupancy(board);

  // ── Generate a raw weighted-random trio ──
  function generateRawTrio() {
    const trio = [];
    for (let j = 0; j < 3; j++) {
      const wc = buildWeightedPieceCandidates(board, level, trio);
      trio.push(getWeightedRandom(wc, safeRng).piece);
    }
    return trio;
  }

  // ── Tray generation strategy ──
  // Level 1 (first ~8 lines / 2-3 trays): simulation-based — prevents
  // frustrating instant deaths while the player learns the board.
  // Level 2+: pure weighted random — authentic Block Blast feel.
  // The weighted piece pool already provides natural balance (small pieces
  // are more common, large pieces scale down at high occupancy).
  if (level >= 2) {
    return generateRawTrio();
  }

  // ── Level 1 only: forgiving start ──
  const N = 15;
  const candidates = [];
  for (let i = 0; i < N; i++) candidates.push(generateRawTrio());

  const viable = [];
  for (const trio of candidates) {
    const sim = evaluateTrio(board, trio);
    if (sim) {
      viable.push({ trio, health: trioHealthScore(sim.board) });
    }
  }

  if (viable.length === 0) return candidates[0];

  // Favor healthier trios during level 1 — bias toward good starts
  viable.sort((a, b) => a.health - b.health); // ascending: hardest first
  const weights = viable.map((_, i) => {
    const t = viable.length > 1 ? i / (viable.length - 1) : 0.5;
    return 0.3 + t * 1.4;
  });

  const total = weights.reduce((s, w) => s + w, 0);
  let roll = safeRng() * total;
  for (let i = 0; i < viable.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return viable[i].trio;
  }
  return viable[viable.length - 1].trio;
}

// Check which rows/cols would clear if piece is placed at (row, col).
// Returns null if placement is invalid or nothing clears.
export function getBlockBustPendingClears(board, piece, row, col) {
  if (!canPlaceBlockBustPiece(board, piece, row, col)) return null;
  const pieceCells = new Set();
  for (const [pr, pc] of piece.cells) pieceCells.add(`${row + pr}:${col + pc}`);
  const rows = [];
  for (let r = 0; r < BLOCK_BUST_BOARD_SIZE; r++) {
    let complete = true;
    for (let c = 0; c < BLOCK_BUST_BOARD_SIZE; c++) {
      if (!board[r][c] && !pieceCells.has(`${r}:${c}`)) { complete = false; break; }
    }
    if (complete) rows.push(r);
  }
  const cols = [];
  for (let c = 0; c < BLOCK_BUST_BOARD_SIZE; c++) {
    let complete = true;
    for (let r = 0; r < BLOCK_BUST_BOARD_SIZE; r++) {
      if (!board[r][c] && !pieceCells.has(`${r}:${c}`)) { complete = false; break; }
    }
    if (complete) cols.push(c);
  }
  return (rows.length || cols.length) ? { rows, cols } : null;
}

export function serializeBlockBustRun(state) {
  if (!state || typeof state !== 'object') return null;
  return {
    version: BLOCK_BUST_RUN_VERSION,
    board: cloneBoard(state.board || createEmptyBlockBustBoard()),
    tray: Array.isArray(state.tray) ? state.tray.map((piece) => piece ? piece.id : null) : [],
    score: Math.max(0, Number(state.score) || 0),
    bestScore: Math.max(0, Number(state.bestScore) || 0),
    totalLines: Math.max(0, Number(state.totalLines) || 0),
    combo: Math.max(0, Number(state.combo) || 0),
    fullWipes: Math.max(0, Number(state.fullWipes) || 0),
    moveCount: Math.max(0, Number(state.moveCount) || 0),
    themeId: getBlockBustTheme(state.themeId).id,
    status: state.status === 'over' ? 'over' : 'playing',
    selectedSlotIndex: typeof state.selectedSlotIndex === 'number' ? state.selectedSlotIndex : null,
  };
}

export function hydrateBlockBustRun(payload) {
  if (!payload || payload.version !== BLOCK_BUST_RUN_VERSION) return null;
  const pieceMap = new Map(BLOCK_BUST_PIECES.map((piece) => [piece.id, piece]));
  const tray = (Array.isArray(payload.tray) ? payload.tray : [])
    .map((id) => id ? (pieceMap.get(id) || null) : null);
  if (tray.filter(Boolean).length === 0) return null;
  const board = Array.isArray(payload.board) && payload.board.length === BLOCK_BUST_BOARD_SIZE
    ? payload.board.map((row) => Array.from({ length: BLOCK_BUST_BOARD_SIZE }, (_, index) => Number(row?.[index]) ? 1 : 0))
    : createEmptyBlockBustBoard();

  return {
    board,
    tray,
    score: Math.max(0, Number(payload.score) || 0),
    bestScore: Math.max(0, Number(payload.bestScore) || 0),
    totalLines: Math.max(0, Number(payload.totalLines) || 0),
    combo: Math.max(0, Number(payload.combo) || 0),
    fullWipes: Math.max(0, Number(payload.fullWipes) || 0),
    moveCount: Math.max(0, Number(payload.moveCount) || 0),
    themeId: getBlockBustTheme(payload.themeId).id,
    status: payload.status === 'over' ? 'over' : 'playing',
    selectedSlotIndex: typeof payload.selectedSlotIndex === 'number' && payload.selectedSlotIndex >= 0 && payload.selectedSlotIndex < tray.length && tray[payload.selectedSlotIndex] !== null ? payload.selectedSlotIndex : null,
  };
}
