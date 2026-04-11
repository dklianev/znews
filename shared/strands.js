const STRANDS_CHAR_PATTERN = /^[\p{L}\p{N}]$/u;

export const STRANDS_ROWS = 8;
export const STRANDS_COLS = 6;
export const STRANDS_TOTAL_CELLS = STRANDS_ROWS * STRANDS_COLS;

function assertCellIndex(cell) {
  const parsed = Number.parseInt(cell, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= STRANDS_TOTAL_CELLS) {
    throw new Error('Клетките в Нишки трябва да са числа между 0 и 47.');
  }
  return parsed;
}

export function normalizeGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== STRANDS_ROWS) {
    throw new Error('Мрежата за Нишки трябва да има точно 8 реда.');
  }

  return grid.map((row, rowIndex) => {
    const compact = String(row ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    const chars = Array.from(compact);
    if (chars.length !== STRANDS_COLS) {
      throw new Error(`Ред ${rowIndex + 1} в Нишки трябва да има точно 6 символа.`);
    }
    if (chars.some((char) => !STRANDS_CHAR_PATTERN.test(char))) {
      throw new Error(`Ред ${rowIndex + 1} в Нишки съдържа невалидни символи.`);
    }
    return chars.join('');
  });
}

export function cellToRowCol(index) {
  const cell = assertCellIndex(index);
  return {
    row: Math.floor(cell / STRANDS_COLS),
    col: cell % STRANDS_COLS,
  };
}

export function rowColToCell(row, col) {
  const safeRow = Number.parseInt(row, 10);
  const safeCol = Number.parseInt(col, 10);
  if (!Number.isInteger(safeRow) || safeRow < 0 || safeRow >= STRANDS_ROWS) {
    throw new Error('Редът в Нишки е извън борда.');
  }
  if (!Number.isInteger(safeCol) || safeCol < 0 || safeCol >= STRANDS_COLS) {
    throw new Error('Колоната в Нишки е извън борда.');
  }
  return (safeRow * STRANDS_COLS) + safeCol;
}

export function areCellsAdjacent(leftCell, rightCell) {
  const left = cellToRowCol(leftCell);
  const right = cellToRowCol(rightCell);
  const rowDelta = Math.abs(left.row - right.row);
  const colDelta = Math.abs(left.col - right.col);
  return (rowDelta !== 0 || colDelta !== 0) && rowDelta <= 1 && colDelta <= 1;
}

export function isPathValid(path) {
  if (!Array.isArray(path) || path.length === 0) return false;
  const seen = new Set();
  const normalizedPath = path.map(assertCellIndex);

  for (let index = 0; index < normalizedPath.length; index += 1) {
    const cell = normalizedPath[index];
    if (seen.has(cell)) return false;
    seen.add(cell);
    if (index > 0 && !areCellsAdjacent(normalizedPath[index - 1], cell)) {
      return false;
    }
  }

  return true;
}

export function buildWordFromPath(path, grid) {
  const normalizedPath = Array.isArray(path) ? path.map(assertCellIndex) : [];
  const rows = normalizeGrid(grid);
  const flatGrid = Array.from(rows.join(''));
  return normalizedPath.map((cell) => flatGrid[cell] || '').join('');
}

export function analyzeCoverage(answers) {
  const safeAnswers = Array.isArray(answers) ? answers : [];
  const coveredCells = new Set();
  const duplicateCells = new Set();
  const invalidCells = new Set();
  let spangrams = 0;
  let themeCount = 0;

  safeAnswers.forEach((answer) => {
    if (String(answer?.kind || '').toLowerCase() === 'spangram') spangrams += 1;
    if (String(answer?.kind || '').toLowerCase() === 'theme') themeCount += 1;

    (Array.isArray(answer?.cells) ? answer.cells : []).forEach((cell) => {
      try {
        const safeCell = assertCellIndex(cell);
        if (coveredCells.has(safeCell)) duplicateCells.add(safeCell);
        coveredCells.add(safeCell);
      } catch {
        invalidCells.add(Number.parseInt(cell, 10));
      }
    });
  });

  const uncoveredCells = [];
  for (let cell = 0; cell < STRANDS_TOTAL_CELLS; cell += 1) {
    if (!coveredCells.has(cell)) uncoveredCells.push(cell);
  }

  return {
    coveredCells,
    uncoveredCells,
    duplicateCells: [...duplicateCells].sort((left, right) => left - right),
    invalidCells: [...invalidCells].filter(Number.isFinite).sort((left, right) => left - right),
    spangrams,
    themeCount,
    isComplete: uncoveredCells.length === 0 && duplicateCells.size === 0 && invalidCells.size === 0 && spangrams === 1,
  };
}

export function doesPathSpanBoard(path) {
  const normalizedPath = Array.isArray(path) ? path.map(assertCellIndex) : [];
  let touchesTop = false;
  let touchesBottom = false;
  let touchesLeft = false;
  let touchesRight = false;

  normalizedPath.forEach((cell) => {
    const { row, col } = cellToRowCol(cell);
    if (row === 0) touchesTop = true;
    if (row === STRANDS_ROWS - 1) touchesBottom = true;
    if (col === 0) touchesLeft = true;
    if (col === STRANDS_COLS - 1) touchesRight = true;
  });

  return (touchesTop && touchesBottom) || (touchesLeft && touchesRight);
}

function arePathsEqual(leftPath, rightPath) {
  if (!Array.isArray(leftPath) || !Array.isArray(rightPath) || leftPath.length !== rightPath.length) {
    return false;
  }
  return leftPath.every((cell, index) => cell === rightPath[index]);
}

export function matchPathToAnswer(path, answers) {
  if (!Array.isArray(path) || path.length === 0) return null;
  const normalizedPath = path.map(assertCellIndex);
  const safeAnswers = Array.isArray(answers) ? answers : [];

  for (const answer of safeAnswers) {
    const answerPath = Array.isArray(answer?.cells) ? answer.cells.map(assertCellIndex) : [];
    if (answerPath.length !== normalizedPath.length) continue;
    if (arePathsEqual(normalizedPath, answerPath) || arePathsEqual(normalizedPath, [...answerPath].reverse())) {
      return {
        kind: String(answer?.kind || '').toLowerCase(),
        word: String(answer?.word || '').trim().toUpperCase(),
        cells: answerPath,
      };
    }
  }

  return null;
}
