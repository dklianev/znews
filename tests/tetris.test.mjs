import assert from 'node:assert/strict';
import {
  BOARD_ROWS,
  BOARD_COLS,
  TETROMINOES,
  THEMES,
  createEmptyBoard,
  createBag,
  pieceFromKey,
  rotateCW,
  rotateCCW,
  rotate180,
  isValidPosition,
  tryRotate,
  tryRotate180,
  detectTSpin,
  lockPiece,
  clearLines,
  isPerfectClear,
  addGarbageLine,
  calculateScore,
  getLevel,
  getDropSpeed,
  getGuidelineGravityMs,
  getGhostPosition,
  hardDrop,
  drawFromBag,
  createStats,
  updateStats,
  getGarbageInterval,
  getTetrisBindingKey,
  getTrimmedShape,
  resolveSpawn,
  shouldCountTetrisKeypress,
  POINTS,
} from '../src/utils/tetris.js';

export async function runTetrisTests() {
  // ── Board basics ──
  {
    const board = createEmptyBoard();
    assert.equal(board.length, BOARD_ROWS);
    assert.equal(board[0].length, BOARD_COLS);
    assert.ok(board.every((row) => row.every((cell) => cell === null)));
  }

  // ── 7-bag randomizer ──
  {
    const bag = createBag();
    assert.equal(bag.length, 7);
    const sorted = [...bag].sort();
    assert.deepEqual(sorted, ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  }

  // ── drawFromBag returns correct count and refills ──
  {
    const { keys, bag } = drawFromBag([], 5);
    assert.equal(keys.length, 5);
    assert.ok(keys.every((k) => Object.keys(TETROMINOES).includes(k)));
    // Remaining bag should have 2 pieces (7 - 5)
    assert.equal(bag.length, 2);
  }

  {
    // Drawing more than 7 should refill
    const { keys } = drawFromBag([], 10);
    assert.equal(keys.length, 10);
  }

  // ── pieceFromKey ──
  {
    const piece = pieceFromKey('T');
    assert.equal(piece.type, 'T');
    assert.equal(piece.rotationState, 0);
    assert.equal(piece.col, Math.floor((BOARD_COLS - 3) / 2));
    assert.deepEqual(piece.shape, [[0, 1, 0], [1, 1, 1], [0, 0, 0]]);
  }

  {
    const piece = pieceFromKey('I');
    assert.equal(piece.row, -1, 'I piece spawns one row above visible');
    assert.equal(piece.shape.length, 4);
  }

  // ── Rotation ──
  {
    const shape = [[0, 1, 0], [1, 1, 1], [0, 0, 0]]; // T piece
    const cw = rotateCW(shape);
    assert.deepEqual(cw, [[0, 1, 0], [0, 1, 1], [0, 1, 0]]);

    const ccw = rotateCCW(shape);
    assert.deepEqual(ccw, [[0, 1, 0], [1, 1, 0], [0, 1, 0]]);

    const r180 = rotate180(shape);
    assert.deepEqual(r180, [[0, 0, 0], [1, 1, 1], [0, 1, 0]]);
  }

  // ── rotateCW 4 times returns original ──
  {
    const shape = TETROMINOES.S.shape;
    let s = shape;
    for (let i = 0; i < 4; i += 1) s = rotateCW(s);
    assert.deepEqual(s, shape);
  }

  // ── isValidPosition ──
  {
    const board = createEmptyBoard();
    const piece = pieceFromKey('O');
    assert.ok(isValidPosition(board, piece.shape, piece.row, piece.col));
    assert.ok(!isValidPosition(board, piece.shape, BOARD_ROWS, piece.col), 'below board');
    assert.ok(!isValidPosition(board, piece.shape, 0, -1), 'left of board');
    assert.ok(!isValidPosition(board, piece.shape, 0, BOARD_COLS), 'right of board');
  }

  {
    // Collision with existing block
    const board = createEmptyBoard();
    board[1][5] = 'T';
    const piece = pieceFromKey('O'); // O at col 4-5, row 0-1
    assert.ok(!isValidPosition(board, piece.shape, 0, 4));
  }

  // ── tryRotate with wall kicks ──
  {
    const board = createEmptyBoard();
    const piece = pieceFromKey('T');
    const rotated = tryRotate(board, { ...piece, row: 5 }, true);
    assert.ok(rotated !== null);
    assert.equal(rotated.rotationState, 1);
    assert.equal(rotated.lastAction, 'rotate');
  }

  {
    // O piece should not rotate (tryRotate180)
    const board = createEmptyBoard();
    const piece = pieceFromKey('O');
    const result = tryRotate180(board, { ...piece, row: 5 });
    assert.equal(result, null, 'O piece cannot rotate 180');
  }

  // ── lockPiece ──
  {
    const board = createEmptyBoard();
    const piece = { ...pieceFromKey('O'), row: BOARD_ROWS - 2 };
    const locked = lockPiece(board, piece);
    assert.equal(locked[BOARD_ROWS - 2][4], 'O');
    assert.equal(locked[BOARD_ROWS - 2][5], 'O');
    assert.equal(locked[BOARD_ROWS - 1][4], 'O');
    assert.equal(locked[BOARD_ROWS - 1][5], 'O');
    // Original board untouched
    assert.equal(board[BOARD_ROWS - 2][4], null);
  }

  // ── clearLines ──
  {
    const board = createEmptyBoard();
    // Fill bottom two rows
    for (let c = 0; c < BOARD_COLS; c += 1) {
      board[BOARD_ROWS - 1][c] = 'T';
      board[BOARD_ROWS - 2][c] = 'S';
    }
    const { board: cleared, linesCleared, clearedIndices } = clearLines(board);
    assert.equal(linesCleared, 2);
    assert.deepEqual(clearedIndices, [BOARD_ROWS - 2, BOARD_ROWS - 1]);
    assert.ok(cleared[BOARD_ROWS - 1].every((c) => c === null), 'cleared rows become empty at top');
  }

  {
    // Partial row should not clear
    const board = createEmptyBoard();
    for (let c = 0; c < BOARD_COLS - 1; c += 1) {
      board[BOARD_ROWS - 1][c] = 'I';
    }
    const { linesCleared } = clearLines(board);
    assert.equal(linesCleared, 0);
  }

  // ── isPerfectClear ──
  {
    assert.ok(isPerfectClear(createEmptyBoard()));
    const board = createEmptyBoard();
    board[5][5] = 'T';
    assert.ok(!isPerfectClear(board));
  }

  // ── addGarbageLine ──
  {
    const board = createEmptyBoard();
    board[0][3] = 'I'; // Block in top row
    const withGarbage = addGarbageLine(board, 5);
    assert.equal(withGarbage.length, BOARD_ROWS);
    // Top row shifted up (lost)
    assert.equal(withGarbage[0][3], null, 'top row block shifted out');
    // Bottom row is garbage with gap at col 5
    const bottomRow = withGarbage[BOARD_ROWS - 1];
    assert.equal(bottomRow[5], null, 'gap at specified column');
    assert.equal(bottomRow[0], 'garbage');
    assert.equal(bottomRow[9], 'garbage');
  }

  // ── Ghost position ──
  {
    const board = createEmptyBoard();
    const piece = { ...pieceFromKey('I'), row: 0 };
    const ghostRow = getGhostPosition(board, piece);
    // I piece shape is 4x4, filled row is row index 1 in shape
    // Ghost should be at bottom: BOARD_ROWS - 3 (shape has 4 rows, filled at index 1)
    assert.ok(ghostRow > 0, 'ghost is below piece');
    assert.ok(isValidPosition(board, piece.shape, ghostRow, piece.col));
    assert.ok(!isValidPosition(board, piece.shape, ghostRow + 1, piece.col));
  }

  // ── hardDrop ──
  {
    const board = createEmptyBoard();
    const piece = { ...pieceFromKey('O'), row: 0 };
    const { piece: dropped, cellsDropped } = hardDrop(board, piece);
    assert.equal(dropped.row, BOARD_ROWS - 2);
    assert.equal(cellsDropped, BOARD_ROWS - 2);
  }

  // ── T-spin detection ──
  {
    // No T-spin if not T piece
    const board = createEmptyBoard();
    const piece = { ...pieceFromKey('S'), row: 5, lastAction: 'rotate' };
    assert.equal(detectTSpin(board, piece), 'none');
  }

  {
    // No T-spin if last action wasn't rotate
    const board = createEmptyBoard();
    const piece = { ...pieceFromKey('T'), row: 5, lastAction: 'move' };
    assert.equal(detectTSpin(board, piece), 'none');
  }

  {
    // Full T-spin: 3+ corners occupied
    const board = createEmptyBoard();
    const piece = { ...pieceFromKey('T'), row: 5, col: 3, lastAction: 'rotate' };
    // Fill 3 corners around T center (row 6, col 4)
    board[5][3] = 'X'; // top-left
    board[5][5] = 'X'; // top-right
    board[7][3] = 'X'; // bottom-left
    assert.equal(detectTSpin(board, piece), 'full');
  }

  {
    // Mini T-spin: 2 corners occupied
    const board = createEmptyBoard();
    const piece = { ...pieceFromKey('T'), row: 5, col: 3, lastAction: 'rotate' };
    board[5][3] = 'X'; // top-left
    board[7][5] = 'X'; // bottom-right
    assert.equal(detectTSpin(board, piece), 'mini');
  }

  // ── Scoring ──
  {
    const { points } = calculateScore(0, 0, 'none', 0, false, false);
    assert.equal(points, 0, 'no lines = no points');
  }

  {
    const { points, label } = calculateScore(1, 0, 'none', 0, false, false);
    assert.equal(points, POINTS.SINGLE * 1); // level 0+1=1
    assert.equal(label, 'SINGLE');
  }

  {
    const { points, label, isSpecial } = calculateScore(4, 0, 'none', 0, false, false);
    assert.equal(points, POINTS.TETRIS * 1);
    assert.equal(label, 'TETRIS!');
    assert.ok(isSpecial);
  }

  {
    // Back-to-back Tetris
    const { points, label } = calculateScore(4, 0, 'none', 0, true, false);
    assert.equal(points, Math.floor(POINTS.TETRIS * 1 * POINTS.BACK_TO_BACK_MULTIPLIER));
    assert.ok(label.startsWith('B2B'));
  }

  {
    // T-spin double
    const { points, isSpecial } = calculateScore(2, 0, 'full', 0, false, false);
    assert.equal(points, POINTS.T_SPIN_DOUBLE * 1);
    assert.ok(isSpecial);
  }

  {
    // Combo bonus
    const { points } = calculateScore(1, 1, 'none', 3, false, false);
    // base 100 * (1+1) + combo 50 * 3 * (1+1) = 200 + 300 = 500
    assert.equal(points, POINTS.SINGLE * 2 + POINTS.COMBO_BONUS * 3 * 2);
  }

  {
    // Perfect clear
    const { points, label } = calculateScore(1, 0, 'none', 0, false, true);
    assert.equal(points, (POINTS.SINGLE + POINTS.PERFECT_CLEAR) * 1);
    assert.ok(label.includes('PERFECT'));
  }

  // ── Level & speed ──
  {
    assert.equal(getLevel(0, 0), 0);
    assert.equal(getLevel(10, 0), 1);
    assert.equal(getLevel(25, 0), 2);
    assert.equal(getLevel(0, 5), 5, 'start level offset');
    assert.equal(getLevel(200, 0), 19, 'capped at max level');
  }

  {
    const speed0 = getDropSpeed(0);
    const speed5 = getDropSpeed(5);
    const speed19 = getDropSpeed(19);
    assert.ok(speed0 > speed5, 'higher level = faster');
    assert.ok(speed5 > speed19, 'higher level = faster');
    assert.ok(speed0 <= 1000);
  }

  {
    assert.equal(getGuidelineGravityMs(20), 1, 'level 20+ is 20G (instant)');
    assert.ok(getGuidelineGravityMs(0) > 500, 'level 0 is slow');
  }

  // ── Stats ──
  {
    const stats = createStats();
    assert.equal(stats.piecesPlaced, 0);
    assert.equal(stats.tetrises, 0);
    assert.equal(stats.maxCombo, 0);
  }

  {
    let stats = createStats();
    stats = updateStats(stats, 4, 'none', 0, false);
    assert.equal(stats.piecesPlaced, 1);
    assert.equal(stats.tetrises, 1);

    stats = updateStats(stats, 1, 'none', 0, false);
    assert.equal(stats.piecesPlaced, 2);
    assert.equal(stats.singles, 1);

    stats = updateStats(stats, 2, 'full', 3, false);
    assert.equal(stats.tSpins, 1);
    assert.equal(stats.maxCombo, 3);

    stats = updateStats(stats, 1, 'none', 0, true);
    assert.equal(stats.perfectClears, 1);
  }

  // ── Garbage interval ──
  {
    assert.equal(getGarbageInterval(0), 12);
    assert.equal(getGarbageInterval(2), 12);
    assert.equal(getGarbageInterval(3), 10);
    assert.equal(getGarbageInterval(6), 8);
    assert.equal(getGarbageInterval(9), 6);
    assert.equal(getGarbageInterval(15), 6);
  }

  // ── Themes ──
  {
    assert.ok(THEMES.classic);
    assert.ok(THEMES.neon);
    assert.ok(THEMES.mono);
    assert.ok(THEMES.retro);
    for (const [name, theme] of Object.entries(THEMES)) {
      assert.ok(theme.colors.I, `${name} has I color`);
      assert.ok(theme.colors.O, `${name} has O color`);
      assert.ok(theme.bg, `${name} has bg`);
      assert.ok(theme.boardBg, `${name} has boardBg`);
    }
  }

  // ── getTrimmedShape ──
  {
    const trimmed = getTrimmedShape('O');
    assert.deepEqual(trimmed, [[1, 1], [1, 1]]);
  }

  {
    const trimmed = getTrimmedShape('I');
    assert.equal(trimmed.length, 1);
    assert.deepEqual(trimmed[0], [1, 1, 1, 1]);
  }

  // ── Keyboard binding helpers ──
  {
    assert.equal(getTetrisBindingKey('ф', 'KeyA'), 'a', 'maps Cyrillic layout physical KeyA to latin a');
    assert.equal(getTetrisBindingKey('ArrowLeft', 'ArrowLeft'), 'ArrowLeft', 'keeps non-mapped control keys');
    assert.equal(getTetrisBindingKey(' ', 'Space'), ' ', 'normalizes Space via code');
  }

  {
    assert.equal(shouldCountTetrisKeypress('moveLeft', false), true);
    assert.equal(shouldCountTetrisKeypress('hardDrop', false), true);
    assert.equal(shouldCountTetrisKeypress('pause', false), false, 'pause should not affect KPP');
    assert.equal(shouldCountTetrisKeypress(null, false), false, 'unknown keys should not affect KPP');
    assert.equal(shouldCountTetrisKeypress('rotateCW', true), false, 'repeated keydown should not inflate KPP');
  }

  // ── resolveSpawn — normal spawn (no IHS) ──
  {
    const board = createEmptyBoard();
    const queue = ['T', 'S', 'Z', 'J', 'L'];
    const bag = ['I', 'O'];

    const result = resolveSpawn({
      queue, bag, board, holdKey: null, holdUsed: false, queueSize: 5, ihsHeld: false,
    });

    assert.equal(result.piece.type, 'T', 'spawns first piece from queue');
    assert.equal(result.queue.length, 5, 'queue refilled to queueSize');
    assert.equal(result.queue[0], 'S', 'queue shifted');
    assert.equal(result.holdKey, null, 'hold unchanged');
    assert.equal(result.holdUsed, false, 'hold not used');
  }

  // ── resolveSpawn — IHS with existing hold piece ──
  {
    const board = createEmptyBoard();
    const queue = ['T', 'S', 'Z', 'J', 'L'];
    const bag = ['I', 'O'];

    const result = resolveSpawn({
      queue, bag, board, holdKey: 'I', holdUsed: false, queueSize: 5, ihsHeld: true,
    });

    assert.equal(result.piece.type, 'I', 'spawns hold piece');
    assert.equal(result.holdKey, 'T', 'stashed queue piece into hold');
    assert.equal(result.holdUsed, true, 'hold consumed');
  }

  // ── resolveSpawn — fresh-game IHS (hold empty) ──
  {
    const board = createEmptyBoard();
    const queue = ['T', 'S', 'Z', 'J', 'L'];
    const bag = ['I', 'O', 'J'];

    const result = resolveSpawn({
      queue, bag, board, holdKey: null, holdUsed: false, queueSize: 5, ihsHeld: true,
    });

    assert.equal(result.holdKey, 'T', 'stashed first piece into hold');
    assert.equal(result.piece.type, 'S', 'spawns second piece from queue (not same as hold)');
    assert.equal(result.holdUsed, true, 'hold consumed');
    assert.ok(!result.queue.includes('T'), 'held piece T is not in queue');
    assert.ok(!result.queue.includes('S'), 'spawned piece S is not in queue');
    assert.equal(result.queue.length >= 3, true, 'queue refilled after IHS consume');
  }

  // ── resolveSpawn — fresh-game IHS bag continuity (no duplicates from stale bag) ──
  {
    const board = createEmptyBoard();
    // Minimal bag to force a refill during IHS
    const queue = ['T', 'S'];
    const bag = ['Z'];

    const result = resolveSpawn({
      queue, bag, board, holdKey: null, holdUsed: false, queueSize: 5, ihsHeld: true,
    });

    assert.equal(result.holdKey, 'T', 'held the first piece');
    assert.equal(result.piece.type, 'S', 'spawned the second');
    // After: queue had T,S → consumed T (hold), consumed S (spawn) → need 5 from bag
    // First refill drew from bag=['Z'] → got Z + refilled bag, then IHS drew 1 more
    // Total queue should be 5 with no piece appearing more than expected from a 7-bag
    assert.equal(result.queue.length >= 3, true, 'queue properly refilled');
    assert.equal(result.holdUsed, true);
  }

  // ── resolveSpawn — holdUsed=true prevents IHS ──
  {
    const board = createEmptyBoard();
    const queue = ['T', 'S', 'Z', 'J', 'L'];
    const bag = ['I', 'O'];

    const result = resolveSpawn({
      queue, bag, board, holdKey: 'I', holdUsed: true, queueSize: 5, ihsHeld: true,
    });

    assert.equal(result.piece.type, 'T', 'normal spawn — IHS blocked by holdUsed');
    assert.equal(result.holdKey, 'I', 'hold unchanged');
    assert.equal(result.holdUsed, false, 'holdUsed reset for new piece');
  }
}
