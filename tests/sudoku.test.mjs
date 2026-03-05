import {
  cloneGrid,
  countSolutions,
  generateSudokuPuzzle,
  getConflictingCells,
  isGridComplete,
  isGridSolved,
} from '../src/utils/sudoku.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertGridShape(grid, label) {
  assert(Array.isArray(grid), `${label}: grid must be an array`);
  assert(grid.length === 9, `${label}: grid must have 9 rows`);
  grid.forEach((row, rowIndex) => {
    assert(Array.isArray(row), `${label}: row ${rowIndex} must be an array`);
    assert(row.length === 9, `${label}: row ${rowIndex} must have 9 columns`);
    row.forEach((value, columnIndex) => {
      assert(Number.isInteger(value), `${label}: cell ${rowIndex}-${columnIndex} must be an integer`);
      assert(value >= 0 && value <= 9, `${label}: cell ${rowIndex}-${columnIndex} must be between 0 and 9`);
    });
  });
}

export function runSudokuTests() {
  const medium = generateSudokuPuzzle('medium');
  assertGridShape(medium.puzzleGrid, 'medium puzzle');
  assertGridShape(medium.solutionGrid, 'medium solution');

  assert(isGridComplete(medium.solutionGrid), 'solution grid should be complete');
  assert(isGridSolved(medium.solutionGrid, medium.solutionGrid), 'solution grid should match itself');
  assert(!isGridComplete(medium.puzzleGrid), 'puzzle grid should have empty cells');
  assert(getConflictingCells(medium.puzzleGrid).size === 0, 'generated puzzle should not contain conflicts');

  const solutionCount = countSolutions(medium.puzzleGrid, 2);
  assert(solutionCount === 1, `generated puzzle should have unique solution (received ${solutionCount})`);

  const easy = generateSudokuPuzzle('easy');
  const expert = generateSudokuPuzzle('expert');
  const easyClues = easy.puzzleGrid.flat().filter((value) => value > 0).length;
  const expertClues = expert.puzzleGrid.flat().filter((value) => value > 0).length;
  assert(easyClues >= expertClues, 'easy puzzle should expose at least as many clues as expert puzzle');

  const invalidGrid = cloneGrid(medium.puzzleGrid);
  invalidGrid[0][0] = 9;
  invalidGrid[0][1] = 9;
  const conflictCells = getConflictingCells(invalidGrid);
  assert(conflictCells.has('0-0') && conflictCells.has('0-1'), 'duplicate row values should be flagged as conflicts');
}
