export const BLOCK_BUST_BOARD_SIZE = 8;
export const BLOCK_BUST_RUN_SCOPE = 'run';
export const BLOCK_BUST_META_SCOPE = 'meta';
export const BLOCK_BUST_SETTINGS_KEY = 'zn_blockbust_settings_v1';
export const BLOCK_BUST_RUN_VERSION = 1;

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
  themeMode: 'auto',
  manualThemeId: BLOCK_BUST_THEMES[0].id,
  confirmRestart: false,
  gridContrast: 'normal',
  leftHanded: false,
  patternAssist: false,
});

const BASE_PIECE_DEFINITIONS = Object.freeze([
  { slug: 'dot', band: 1, weight: 12, tags: ['rescue', 'simple'], cells: [[0, 0]] },
  { slug: 'domino', band: 1, weight: 10, tags: ['rescue', 'simple'], cells: [[0, 0], [0, 1]] },
  { slug: 'bar3', band: 1, weight: 10, tags: ['rescue'], cells: [[0, 0], [0, 1], [0, 2]] },
  { slug: 'square2', band: 1, weight: 9, tags: ['stable'], cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { slug: 'corner3', band: 1, weight: 8, tags: ['stable'], cells: [[0, 0], [1, 0], [1, 1]] },
  { slug: 'bar4', band: 2, weight: 8, tags: ['line'], cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { slug: 'corner4', band: 2, weight: 8, tags: ['stable'], cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { slug: 'tee4', band: 2, weight: 7, tags: ['awkward'], cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
  { slug: 'zig4', band: 2, weight: 7, tags: ['awkward'], cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { slug: 'bar5', band: 3, weight: 5, tags: ['line', 'awkward'], cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { slug: 'corner5', band: 3, weight: 5, tags: ['awkward'], cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { slug: 'tee5', band: 3, weight: 4, tags: ['awkward'], cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
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
          band: definition.band,
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
  const currentIndex = Math.max(0, BLOCK_BUST_THEMES.findIndex((theme) => theme.id === currentThemeId));
  return BLOCK_BUST_THEMES[(currentIndex + 1) % BLOCK_BUST_THEMES.length].id;
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

function getClearBonus(lineCount) {
  if (lineCount <= 0) return 0;
  if (lineCount === 1) return 10;
  if (lineCount === 2) return 30;
  if (lineCount === 3) return 60;
  if (lineCount === 4) return 100;
  return 100 + (lineCount - 4) * 35;
}

export function resolveBlockBustMove(board, piece, row, col, combo = 0) {
  if (!canPlaceBlockBustPiece(board, piece, row, col)) return null;

  const placedBoard = placeBlockBustPiece(board, piece, row, col);
  const clearResult = clearBlockBustLines(placedBoard);
  const perfectClear = isBlockBustPerfectClear(clearResult.board);
  const placementScore = piece.size;
  const clearBonus = getClearBonus(clearResult.lineCount);
  const nextCombo = clearResult.lineCount > 0 ? combo + 1 : 0;
  const comboBonus = clearResult.lineCount > 0 ? Math.max(0, (nextCombo - 1) * 10) : 0;
  const perfectClearBonus = perfectClear ? 120 : 0;

  return {
    board: clearResult.board,
    score: placementScore + clearBonus + comboBonus + perfectClearBonus,
    placementScore,
    clearBonus,
    comboBonus,
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

function buildWeightedPieceCandidates(board, level, currentTray = []) {
  const band = getBlockBustDifficultyBand(level);
  const occupancy = getBlockBustBoardOccupancy(board);
  const existingIds = new Set((Array.isArray(currentTray) ? currentTray : []).map((piece) => piece.id));
  const rawCandidates = BLOCK_BUST_PIECES
    .filter((piece) => piece.band <= band)
    .map((piece) => ({
      piece,
      placements: getBlockBustValidPlacements(board, piece),
    }))
    .filter((candidate) => candidate.placements.length > 0);

  return rawCandidates.map((candidate) => {
    let weight = candidate.piece.weight;
    if (candidate.piece.tags.includes('rescue') && occupancy >= 0.45) weight *= 1.85;
    if (candidate.piece.tags.includes('simple') && occupancy >= 0.6) weight *= 1.45;
    if (candidate.piece.tags.includes('awkward') && occupancy >= 0.45) weight *= 0.7;
    if (candidate.piece.band > 2 && level < 7) weight *= 0.7;
    if (existingIds.has(candidate.piece.id)) weight *= 0.55;
    if (candidate.placements.length >= 10) weight *= 1.2;
    return {
      ...candidate,
      weight,
    };
  });
}

export function createBlockBustTray(board, level = 1, rng = Math.random) {
  const safeRng = typeof rng === 'function' ? rng : Math.random;
  const tray = [];
  const weightedCandidates = buildWeightedPieceCandidates(board, level, tray);
  if (weightedCandidates.length === 0) return tray;

  const rescueCandidates = weightedCandidates.filter((candidate) =>
    candidate.piece.tags.includes('rescue') || candidate.placements.length >= 9
  );
  if (rescueCandidates.length > 0) {
    tray.push(getWeightedRandom(rescueCandidates, safeRng).piece);
  } else {
    tray.push(getWeightedRandom(weightedCandidates, safeRng).piece);
  }

  while (tray.length < 3) {
    const nextCandidates = buildWeightedPieceCandidates(board, level, tray);
    if (nextCandidates.length === 0) break;
    tray.push(getWeightedRandom(nextCandidates, safeRng).piece);
  }

  return tray;
}

export function serializeBlockBustRun(state) {
  if (!state || typeof state !== 'object') return null;
  return {
    version: BLOCK_BUST_RUN_VERSION,
    board: cloneBoard(state.board || createEmptyBlockBustBoard()),
    tray: Array.isArray(state.tray) ? state.tray.map((piece) => piece.id) : [],
    score: Math.max(0, Number(state.score) || 0),
    bestScore: Math.max(0, Number(state.bestScore) || 0),
    totalLines: Math.max(0, Number(state.totalLines) || 0),
    combo: Math.max(0, Number(state.combo) || 0),
    fullWipes: Math.max(0, Number(state.fullWipes) || 0),
    moveCount: Math.max(0, Number(state.moveCount) || 0),
    themeId: getBlockBustTheme(state.themeId).id,
    status: state.status === 'over' ? 'over' : 'playing',
    selectedPieceId: typeof state.selectedPieceId === 'string' ? state.selectedPieceId : null,
  };
}

export function hydrateBlockBustRun(payload) {
  if (!payload || payload.version !== BLOCK_BUST_RUN_VERSION) return null;
  const pieceMap = new Map(BLOCK_BUST_PIECES.map((piece) => [piece.id, piece]));
  const tray = (Array.isArray(payload.tray) ? payload.tray : [])
    .map((id) => pieceMap.get(id))
    .filter(Boolean);
  if (tray.length === 0) return null;
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
    selectedPieceId: tray.some((piece) => piece.id === payload.selectedPieceId) ? payload.selectedPieceId : null,
  };
}
