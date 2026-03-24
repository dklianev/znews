import assert from 'node:assert/strict';
import {
  BLOCK_BUST_PIECES,
  BLOCK_BUST_THEMES,
  canPlaceBlockBustPiece,
  clearBlockBustLines,
  createBlockBustTray,
  createEmptyBlockBustBoard,
  getBlockBustLevel,
  getBlockBustNextThemeId,
  hasAnyBlockBustPlacement,
  hydrateBlockBustRun,
  isBlockBustGameOver,
  isBlockBustPerfectClear,
  resolveBlockBustMove,
  serializeBlockBustRun,
} from '../src/utils/blockBust.js';

function getPiece(slug, { width = null, height = null } = {}) {
  return BLOCK_BUST_PIECES.find((piece) =>
    piece.slug === slug
    && (width == null || piece.width === width)
    && (height == null || piece.height === height)
  );
}

export function runBlockBustTests() {
  const board = createEmptyBlockBustBoard();
  assert.equal(board.length, 8, 'board should have 8 rows');
  assert.equal(board[0].length, 8, 'board should have 8 columns');

  const square = getPiece('square2');
  assert.equal(canPlaceBlockBustPiece(board, square, 0, 0), true, 'square should fit in empty top-left corner');
  assert.equal(canPlaceBlockBustPiece(board, square, 7, 7), false, 'square should not overflow the board');

  const bar4 = getPiece('bar4', { width: 4 });
  const rowBoard = createEmptyBlockBustBoard();
  rowBoard[0][4] = 1;
  rowBoard[0][5] = 1;
  rowBoard[0][6] = 1;
  rowBoard[0][7] = 1;
  const rowMove = resolveBlockBustMove(rowBoard, bar4, 0, 0, 0);
  assert.ok(rowMove, 'row move should resolve');
  assert.equal(rowMove.linesCleared, 1, 'completing one row should clear one line');
  assert.equal(rowMove.board[0].every((cell) => cell === 0), true, 'cleared row should be emptied');

  const columnBar = getPiece('bar4', { width: 1, height: 4 });
  const columnBoard = createEmptyBlockBustBoard();
  columnBoard[4][0] = 1;
  columnBoard[5][0] = 1;
  columnBoard[6][0] = 1;
  columnBoard[7][0] = 1;
  const columnMove = resolveBlockBustMove(columnBoard, columnBar, 0, 0, 0);
  assert.ok(columnMove, 'column move should resolve');
  assert.equal(columnMove.linesCleared, 1, 'completing one column should clear one line');

  const multiBoard = createEmptyBlockBustBoard();
  for (let index = 0; index < 8; index += 1) {
    if (index !== 3 && index !== 4) multiBoard[2][index] = 1;
    if (index !== 2) multiBoard[index][3] = 1;
  }
  const domino = getPiece('bar2', { width: 2 });
  const multiMove = resolveBlockBustMove(multiBoard, domino, 2, 3, 1);
  assert.ok(multiMove, 'multi-clear move should resolve');
  assert.equal(multiMove.linesCleared, 2, 'row + column should count as two cleared lines');
  assert.equal(multiMove.nextCombo, 2, 'clearing again should continue the combo');

  const quietBoard = createEmptyBlockBustBoard();
  const quietMove = resolveBlockBustMove(quietBoard, domino, 0, 0, 3);
  assert.ok(quietMove, 'plain placement move should resolve');
  assert.equal(quietMove.linesCleared, 0, 'plain placement should not clear lines');
  assert.equal(quietMove.nextCombo, 0, 'a non-clearing move should reset the combo');

  const dot = getPiece('dot');
  const perfectBoard = createEmptyBlockBustBoard();
  perfectBoard[7][7] = 1;
  const perfectMove = resolveBlockBustMove(perfectBoard, dot, 7, 7, 0);
  assert.equal(perfectMove, null, 'invalid overlapping perfect move should return null');

  const perfectBoard2 = createEmptyBlockBustBoard();
  for (let col = 0; col < 7; col += 1) perfectBoard2[0][col] = 1;
  const perfectMove2 = resolveBlockBustMove(perfectBoard2, dot, 0, 7, 0);
  assert.ok(perfectMove2, 'single-cell finisher should resolve');
  assert.equal(perfectMove2.perfectClear, true, 'finishing the last occupied row should trigger a perfect clear');
  assert.equal(isBlockBustPerfectClear(perfectMove2.board), true, 'perfect clear board should be empty');

  const filledBoard = Array.from({ length: 8 }, () => Array(8).fill(1));
  assert.equal(hasAnyBlockBustPlacement(filledBoard, [dot]), false, 'fully occupied board should have no placements');
  assert.equal(isBlockBustGameOver(filledBoard, [dot]), true, 'fully occupied board should be game over');

  const tray = createBlockBustTray(createEmptyBlockBustBoard(), 1, () => 0.25);
  assert.equal(tray.length, 3, 'fresh tray should generate three pieces');
  assert.ok(tray.every(p => p && p.id && p.cells), 'all tray pieces should be valid piece objects');

  const serialized = serializeBlockBustRun({
    board: createEmptyBlockBustBoard(),
    tray,
    score: 300,
    bestScore: 500,
    totalLines: 16,
    combo: 2,
    fullWipes: 1,
    moveCount: 9,
    themeId: BLOCK_BUST_THEMES[2].id,
    status: 'playing',
    selectedSlotIndex: 1,
  });
  const hydrated = hydrateBlockBustRun(serialized);
  assert.ok(hydrated, 'serialized run should hydrate');
  assert.equal(hydrated.tray.length, tray.length, 'hydrated tray should preserve piece count');
  assert.equal(hydrated.selectedSlotIndex, 1, 'hydrated run should preserve selected piece index');

  assert.equal(
    hydrateBlockBustRun({ ...serialized, tray: [], version: 1 }),
    null,
    'hydration should reject runs without any remaining tray pieces',
  );

  const clearResult = clearBlockBustLines(Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => (row === 0 || col === 0 ? 1 : 0))
  ));
  assert.equal(clearResult.lineCount, 2, 'explicit clear should wipe one row and one column');

  assert.equal(getBlockBustLevel(0), 1, 'level should start at 1');
  assert.equal(getBlockBustLevel(8), 2, 'level should increase every eight lines');
  assert.notEqual(getBlockBustNextThemeId(BLOCK_BUST_THEMES[0].id), BLOCK_BUST_THEMES[0].id, 'theme rotation should move to a different theme');
}
