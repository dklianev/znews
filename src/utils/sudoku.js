const GRID_SIZE = 9;
const BOX_SIZE = 3;
const ALL_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const SUDOKU_DIFFICULTY_CONFIG = Object.freeze({
  easy: { key: 'easy', label: 'Лесно', clues: 41 },
  medium: { key: 'medium', label: 'Средно', clues: 33 },
  hard: { key: 'hard', label: 'Трудно', clues: 27 },
  expert: { key: 'expert', label: 'Експерт', clues: 23 },
});

const DIFFICULTY_KEYS = Object.keys(SUDOKU_DIFFICULTY_CONFIG);

function shuffled(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeDifficulty(difficulty) {
  const normalized = String(difficulty || '').toLowerCase();
  return DIFFICULTY_KEYS.includes(normalized) ? normalized : 'medium';
}

function pattern(row, column) {
  return (BOX_SIZE * (row % BOX_SIZE) + Math.floor(row / BOX_SIZE) + column) % GRID_SIZE;
}

function buildSolvedGrid() {
  const rowBands = shuffled([0, 1, 2]);
  const colBands = shuffled([0, 1, 2]);

  const rows = rowBands.flatMap((band) => shuffled([0, 1, 2]).map((row) => band * BOX_SIZE + row));
  const columns = colBands.flatMap((band) => shuffled([0, 1, 2]).map((col) => band * BOX_SIZE + col));
  const digits = shuffled(ALL_DIGITS);

  return rows.map((row) => (
    columns.map((column) => digits[pattern(row, column)])
  ));
}

export function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 0));
}

export function createEmptyNotesGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => []));
}

export function cloneGrid(grid) {
  return Array.isArray(grid)
    ? grid.map((row) => (Array.isArray(row) ? [...row] : []))
    : createEmptyGrid();
}

export function cloneNotesGrid(notes) {
  return Array.isArray(notes)
    ? notes.map((row) => (Array.isArray(row)
      ? row.map((cell) => (Array.isArray(cell) ? [...cell] : []))
      : []))
    : createEmptyNotesGrid();
}

export function isValidGridShape(grid) {
  if (!Array.isArray(grid) || grid.length !== GRID_SIZE) return false;
  return grid.every((row) => Array.isArray(row) && row.length === GRID_SIZE);
}

export function isCellEditable(initialGrid, row, column) {
  return Number(initialGrid?.[row]?.[column]) === 0;
}

function getBoxStart(index) {
  return Math.floor(index / BOX_SIZE) * BOX_SIZE;
}

export function getCandidatesForCell(grid, row, column) {
  const current = Number(grid?.[row]?.[column] || 0);
  if (current > 0) return [];

  const blocked = new Set();

  for (let idx = 0; idx < GRID_SIZE; idx += 1) {
    const rowValue = Number(grid?.[row]?.[idx] || 0);
    const columnValue = Number(grid?.[idx]?.[column] || 0);
    if (rowValue > 0) blocked.add(rowValue);
    if (columnValue > 0) blocked.add(columnValue);
  }

  const boxRow = getBoxStart(row);
  const boxColumn = getBoxStart(column);
  for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
    for (let colOffset = 0; colOffset < BOX_SIZE; colOffset += 1) {
      const boxValue = Number(grid?.[boxRow + rowOffset]?.[boxColumn + colOffset] || 0);
      if (boxValue > 0) blocked.add(boxValue);
    }
  }

  return ALL_DIGITS.filter((digit) => !blocked.has(digit));
}

function findBestEmptyCell(grid) {
  let bestCell = null;
  let bestCandidates = null;

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      if (Number(grid[row][column]) !== 0) continue;
      const candidates = getCandidatesForCell(grid, row, column);
      if (candidates.length === 0) return { row, column, candidates };
      if (!bestCell || candidates.length < bestCandidates.length) {
        bestCell = { row, column };
        bestCandidates = candidates;
      }
      if (bestCandidates.length === 1) {
        return { ...bestCell, candidates: bestCandidates };
      }
    }
  }

  if (!bestCell) return null;
  return { ...bestCell, candidates: bestCandidates };
}

function countSolutionsInternal(grid, limit = 2) {
  const nextCell = findBestEmptyCell(grid);
  if (!nextCell) return 1;
  if (nextCell.candidates.length === 0) return 0;

  let count = 0;
  const { row, column } = nextCell;
  const candidates = shuffled(nextCell.candidates);

  for (const candidate of candidates) {
    grid[row][column] = candidate;
    count += countSolutionsInternal(grid, limit - count);
    if (count >= limit) break;
  }

  grid[row][column] = 0;
  return count;
}

export function countSolutions(grid, limit = 2) {
  const workGrid = cloneGrid(grid);
  return countSolutionsInternal(workGrid, Math.max(1, limit));
}

export function getConflictingCells(grid) {
  const conflicts = new Set();
  if (!isValidGridShape(grid)) return conflicts;

  const markDuplicates = (cells) => {
    const positionsByValue = new Map();
    cells.forEach(({ row, column, value }) => {
      if (value <= 0) return;
      const key = String(value);
      if (!positionsByValue.has(key)) positionsByValue.set(key, []);
      positionsByValue.get(key).push(`${row}-${column}`);
    });
    positionsByValue.forEach((positions) => {
      if (positions.length < 2) return;
      positions.forEach((key) => conflicts.add(key));
    });
  };

  for (let row = 0; row < GRID_SIZE; row += 1) {
    markDuplicates(
      Array.from({ length: GRID_SIZE }, (_, column) => ({
        row,
        column,
        value: Number(grid[row][column] || 0),
      })),
    );
  }

  for (let column = 0; column < GRID_SIZE; column += 1) {
    markDuplicates(
      Array.from({ length: GRID_SIZE }, (_, row) => ({
        row,
        column,
        value: Number(grid[row][column] || 0),
      })),
    );
  }

  for (let boxRow = 0; boxRow < BOX_SIZE; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < BOX_SIZE; boxColumn += 1) {
      const startRow = boxRow * BOX_SIZE;
      const startColumn = boxColumn * BOX_SIZE;
      const cells = [];

      for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
        for (let colOffset = 0; colOffset < BOX_SIZE; colOffset += 1) {
          const row = startRow + rowOffset;
          const column = startColumn + colOffset;
          cells.push({ row, column, value: Number(grid[row][column] || 0) });
        }
      }

      markDuplicates(cells);
    }
  }

  return conflicts;
}

export function isGridComplete(grid) {
  if (!isValidGridShape(grid)) return false;
  return grid.every((row) => row.every((value) => Number(value) >= 1 && Number(value) <= 9));
}

export function isGridSolved(grid, solutionGrid) {
  if (!isValidGridShape(grid) || !isValidGridShape(solutionGrid)) return false;
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      if (Number(grid[row][column]) !== Number(solutionGrid[row][column])) return false;
    }
  }
  return true;
}

function removeCellsForDifficulty(solutionGrid, difficulty) {
  const config = SUDOKU_DIFFICULTY_CONFIG[normalizeDifficulty(difficulty)];
  const targetClues = config?.clues ?? SUDOKU_DIFFICULTY_CONFIG.medium.clues;

  const puzzle = cloneGrid(solutionGrid);
  let clues = GRID_SIZE * GRID_SIZE;
  const positions = shuffled(Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index));

  for (const position of positions) {
    if (clues <= targetClues) break;

    const row = Math.floor(position / GRID_SIZE);
    const column = position % GRID_SIZE;
    const previous = puzzle[row][column];
    if (previous === 0) continue;

    puzzle[row][column] = 0;
    const solutions = countSolutions(puzzle, 2);
    if (solutions !== 1) {
      puzzle[row][column] = previous;
      continue;
    }

    clues -= 1;
  }

  return puzzle;
}

export function generateSudokuPuzzle(difficulty = 'medium') {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const solutionGrid = buildSolvedGrid();
  const puzzleGrid = removeCellsForDifficulty(solutionGrid, normalizedDifficulty);
  const clueCount = puzzleGrid.flat().filter((value) => Number(value) > 0).length;

  return {
    difficulty: normalizedDifficulty,
    puzzleGrid,
    solutionGrid,
    clueCount,
  };
}

export function formatElapsedTime(totalSeconds) {
  const safeTotal = Math.max(0, Number.parseInt(totalSeconds, 10) || 0);
  const hours = Math.floor(safeTotal / 3600);
  const minutes = Math.floor((safeTotal % 3600) / 60);
  const seconds = safeTotal % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

