import { describe, it } from 'vitest';
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
  getTetrisRecordValue,
  hardDrop,
  isBetterTetrisRecord,
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

describe('tetris', () => {
  it('creates boards, bags, queues and pieces with the expected defaults', async () => {
    const board = createEmptyBoard();
    assert.equal(board.length, BOARD_ROWS);
    assert.equal(board[0].length, BOARD_COLS);
    assert.ok(board.every((row) => row.every((cell) => cell === null)));

    const bag = createBag();
    assert.equal(bag.length, 7);
    assert.deepEqual([...bag].sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);

    {
      const { keys, bag: remainingBag } = drawFromBag([], 5);
      assert.equal(keys.length, 5);
      assert.ok(keys.every((key) => Object.keys(TETROMINOES).includes(key)));
      assert.equal(remainingBag.length, 2);
    }

    {
      const { keys } = drawFromBag([], 10);
      assert.equal(keys.length, 10);
    }

    {
      const piece = pieceFromKey('T');
      assert.equal(piece.type, 'T');
      assert.equal(piece.rotationState, 0);
      assert.equal(piece.col, Math.floor((BOARD_COLS - 3) / 2));
      assert.deepEqual(piece.shape, [[0, 1, 0], [1, 1, 1], [0, 0, 0]]);
    }

    {
      const piece = pieceFromKey('I');
      assert.equal(piece.row, -1);
      assert.equal(piece.shape.length, 4);
    }
  });

  it('rotates pieces and validates board collisions correctly', async () => {
    {
      const shape = [[0, 1, 0], [1, 1, 1], [0, 0, 0]];
      assert.deepEqual(rotateCW(shape), [[0, 1, 0], [0, 1, 1], [0, 1, 0]]);
      assert.deepEqual(rotateCCW(shape), [[0, 1, 0], [1, 1, 0], [0, 1, 0]]);
      assert.deepEqual(rotate180(shape), [[0, 0, 0], [1, 1, 1], [0, 1, 0]]);
    }

    {
      let shape = TETROMINOES.S.shape;
      for (let index = 0; index < 4; index += 1) shape = rotateCW(shape);
      assert.deepEqual(shape, TETROMINOES.S.shape);
    }

    {
      const board = createEmptyBoard();
      const piece = pieceFromKey('O');
      assert.ok(isValidPosition(board, piece.shape, piece.row, piece.col));
      assert.ok(!isValidPosition(board, piece.shape, BOARD_ROWS, piece.col));
      assert.ok(!isValidPosition(board, piece.shape, 0, -1));
      assert.ok(!isValidPosition(board, piece.shape, 0, BOARD_COLS));
    }

    {
      const board = createEmptyBoard();
      board[1][5] = 'T';
      const piece = pieceFromKey('O');
      assert.ok(!isValidPosition(board, piece.shape, 0, 4));
    }

    {
      const board = createEmptyBoard();
      const rotated = tryRotate(board, { ...pieceFromKey('T'), row: 5 }, true);
      assert.ok(rotated !== null);
      assert.equal(rotated.rotationState, 1);
      assert.equal(rotated.lastAction, 'rotate');
    }

    {
      const board = createEmptyBoard();
      const result = tryRotate180(board, { ...pieceFromKey('O'), row: 5 });
      assert.equal(result, null);
    }
  });

  it('locks pieces, clears lines and applies garbage safely', async () => {
    {
      const board = createEmptyBoard();
      const piece = { ...pieceFromKey('O'), row: BOARD_ROWS - 2 };
      const locked = lockPiece(board, piece);
      assert.equal(locked[BOARD_ROWS - 2][4], 'O');
      assert.equal(locked[BOARD_ROWS - 2][5], 'O');
      assert.equal(locked[BOARD_ROWS - 1][4], 'O');
      assert.equal(locked[BOARD_ROWS - 1][5], 'O');
      assert.equal(board[BOARD_ROWS - 2][4], null);
    }

    {
      const board = createEmptyBoard();
      for (let col = 0; col < BOARD_COLS; col += 1) {
        board[BOARD_ROWS - 1][col] = 'T';
        board[BOARD_ROWS - 2][col] = 'S';
      }
      const { board: cleared, linesCleared, clearedIndices } = clearLines(board);
      assert.equal(linesCleared, 2);
      assert.deepEqual(clearedIndices, [BOARD_ROWS - 2, BOARD_ROWS - 1]);
      assert.ok(cleared[BOARD_ROWS - 1].every((cell) => cell === null));
    }

    {
      const board = createEmptyBoard();
      for (let col = 0; col < BOARD_COLS - 1; col += 1) {
        board[BOARD_ROWS - 1][col] = 'I';
      }
      const { linesCleared } = clearLines(board);
      assert.equal(linesCleared, 0);
    }

    {
      assert.ok(isPerfectClear(createEmptyBoard()));
      const board = createEmptyBoard();
      board[5][5] = 'T';
      assert.ok(!isPerfectClear(board));
    }

    {
      const board = createEmptyBoard();
      board[0][3] = 'I';
      const withGarbage = addGarbageLine(board, 5);
      const bottomRow = withGarbage[BOARD_ROWS - 1];
      assert.equal(withGarbage.length, BOARD_ROWS);
      assert.equal(withGarbage[0][3], null);
      assert.equal(bottomRow[5], null);
      assert.equal(bottomRow[0], 'garbage');
      assert.equal(bottomRow[9], 'garbage');
    }
  });

  it('computes ghost drops, hard drops and t-spin states', async () => {
    {
      const board = createEmptyBoard();
      const piece = { ...pieceFromKey('I'), row: 0 };
      const ghostRow = getGhostPosition(board, piece);
      assert.ok(ghostRow > 0);
      assert.ok(isValidPosition(board, piece.shape, ghostRow, piece.col));
      assert.ok(!isValidPosition(board, piece.shape, ghostRow + 1, piece.col));
    }

    {
      const board = createEmptyBoard();
      const piece = { ...pieceFromKey('O'), row: 0 };
      const { piece: dropped, cellsDropped } = hardDrop(board, piece);
      assert.equal(dropped.row, BOARD_ROWS - 2);
      assert.equal(cellsDropped, BOARD_ROWS - 2);
    }

    {
      const board = createEmptyBoard();
      assert.equal(detectTSpin(board, { ...pieceFromKey('S'), row: 5, lastAction: 'rotate' }), 'none');
      assert.equal(detectTSpin(board, { ...pieceFromKey('T'), row: 5, lastAction: 'move' }), 'none');
    }

    {
      const board = createEmptyBoard();
      const piece = { ...pieceFromKey('T'), row: 5, col: 3, lastAction: 'rotate' };
      board[5][3] = 'X';
      board[5][5] = 'X';
      board[7][3] = 'X';
      assert.equal(detectTSpin(board, piece), 'full');
    }

    {
      const board = createEmptyBoard();
      const piece = { ...pieceFromKey('T'), row: 5, col: 3, lastAction: 'rotate' };
      board[5][3] = 'X';
      board[7][5] = 'X';
      assert.equal(detectTSpin(board, piece), 'mini');
    }
  });

  it('scores line clears, t-spins, combos and perfect clears correctly', async () => {
    assert.equal(calculateScore(0, 0, 'none', 0, false, false).points, 0);

    {
      const { points, label } = calculateScore(1, 0, 'none', 0, false, false);
      assert.equal(points, POINTS.SINGLE);
      assert.equal(label, 'SINGLE');
    }

    {
      const { points, label, isSpecial } = calculateScore(4, 0, 'none', 0, false, false);
      assert.equal(points, POINTS.TETRIS);
      assert.equal(label, 'TETRIS!');
      assert.ok(isSpecial);
    }

    {
      const { points, label } = calculateScore(4, 0, 'none', 0, true, false);
      assert.equal(points, Math.floor(POINTS.TETRIS * POINTS.BACK_TO_BACK_MULTIPLIER));
      assert.ok(label.startsWith('B2B'));
    }

    {
      const { points, isSpecial } = calculateScore(2, 0, 'full', 0, false, false);
      assert.equal(points, POINTS.T_SPIN_DOUBLE);
      assert.ok(isSpecial);
    }

    {
      const { points } = calculateScore(1, 1, 'none', 3, false, false);
      assert.equal(points, POINTS.SINGLE * 2 + POINTS.COMBO_BONUS * 3 * 2);
    }

    {
      const { points, label } = calculateScore(1, 0, 'none', 0, false, true);
      assert.equal(points, POINTS.SINGLE + POINTS.PERFECT_CLEAR);
      assert.ok(label.includes('PERFECT'));
    }
  });

  it('tracks level progression, speed curves and cumulative stats', async () => {
    assert.equal(getLevel(0, 0), 0);
    assert.equal(getLevel(10, 0), 1);
    assert.equal(getLevel(25, 0), 2);
    assert.equal(getLevel(0, 5), 5);
    assert.equal(getLevel(200, 0), 19);

    {
      const speed0 = getDropSpeed(0);
      const speed5 = getDropSpeed(5);
      const speed19 = getDropSpeed(19);
      assert.ok(speed0 > speed5);
      assert.ok(speed5 > speed19);
      assert.ok(speed0 <= 1000);
    }

    assert.equal(getGuidelineGravityMs(20), 1);
    assert.ok(getGuidelineGravityMs(0) > 500);

    {
      const stats = createStats();
      assert.equal(stats.piecesPlaced, 0);
      assert.equal(stats.tetrises, 0);
      assert.equal(stats.maxCombo, 0);
    }

    {
      let stats = createStats();
      stats = updateStats(stats, 4, 'none', 0, false);
      stats = updateStats(stats, 1, 'none', 0, false);
      stats = updateStats(stats, 2, 'full', 3, false);
      stats = updateStats(stats, 1, 'none', 0, true);
      assert.equal(stats.piecesPlaced, 4);
      assert.equal(stats.tetrises, 1);
      assert.equal(stats.singles, 2);
      assert.equal(stats.tSpins, 1);
      assert.equal(stats.maxCombo, 3);
      assert.equal(stats.perfectClears, 1);
    }

    assert.equal(getGarbageInterval(0), 12);
    assert.equal(getGarbageInterval(3), 10);
    assert.equal(getGarbageInterval(6), 8);
    assert.equal(getGarbageInterval(9), 6);
    assert.equal(getGarbageInterval(15), 6);
  });

  it('exposes stable themes, trimmed shapes and keyboard helpers', async () => {
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

    assert.deepEqual(getTrimmedShape('O'), [[1, 1], [1, 1]]);
    assert.equal(getTrimmedShape('I').length, 1);
    assert.deepEqual(getTrimmedShape('I')[0], [1, 1, 1, 1]);

    assert.equal(getTetrisBindingKey('?', 'KeyA'), 'a');
    assert.equal(getTetrisBindingKey('ArrowLeft', 'ArrowLeft'), 'ArrowLeft');
    assert.equal(getTetrisBindingKey(' ', 'Space'), ' ');

    assert.equal(shouldCountTetrisKeypress('moveLeft', false), true);
    assert.equal(shouldCountTetrisKeypress('hardDrop', false), true);
    assert.equal(shouldCountTetrisKeypress('pause', false), false);
    assert.equal(shouldCountTetrisKeypress(null, false), false);
    assert.equal(shouldCountTetrisKeypress('rotateCW', true), false);
  });

  it('compares records and resolves spawn flows including IHS cases', async () => {
    assert.equal(getTetrisRecordValue('marathon', { score: 1200, elapsed: 45000, won: false }), 1200);
    assert.equal(getTetrisRecordValue('ultra', { score: 9000, elapsed: 30000, won: false }), 9000);
    assert.equal(getTetrisRecordValue('sprint', { score: 1200, elapsed: 45200, won: true }), 45200);
    assert.equal(getTetrisRecordValue('sprint', { score: 1200, elapsed: 45200, won: false }), null);

    assert.equal(isBetterTetrisRecord('marathon', 2000, 1500), true);
    assert.equal(isBetterTetrisRecord('marathon', 1500, 1500), false);
    assert.equal(isBetterTetrisRecord('sprint', 45200, 50000), true);
    assert.equal(isBetterTetrisRecord('sprint', 52000, 50000), false);
    assert.equal(isBetterTetrisRecord('sprint', null, 50000), false);

    {
      const result = resolveSpawn({
        queue: ['T', 'S', 'Z', 'J', 'L'],
        bag: ['I', 'O'],
        board: createEmptyBoard(),
        holdKey: null,
        holdUsed: false,
        queueSize: 5,
        ihsHeld: false,
      });
      assert.equal(result.piece.type, 'T');
      assert.equal(result.queue.length, 5);
      assert.equal(result.queue[0], 'S');
      assert.equal(result.holdKey, null);
      assert.equal(result.holdUsed, false);
    }

    {
      const result = resolveSpawn({
        queue: ['T', 'S', 'Z', 'J', 'L'],
        bag: ['I', 'O'],
        board: createEmptyBoard(),
        holdKey: 'I',
        holdUsed: false,
        queueSize: 5,
        ihsHeld: true,
      });
      assert.equal(result.piece.type, 'I');
      assert.equal(result.holdKey, 'T');
      assert.equal(result.holdUsed, true);
    }

    {
      const result = resolveSpawn({
        queue: ['T', 'S', 'Z', 'J', 'L'],
        bag: ['I', 'O', 'J'],
        board: createEmptyBoard(),
        holdKey: null,
        holdUsed: false,
        queueSize: 5,
        ihsHeld: true,
      });
      assert.equal(result.holdKey, 'T');
      assert.equal(result.piece.type, 'S');
      assert.equal(result.holdUsed, true);
      assert.ok(!result.queue.includes('T'));
      assert.ok(!result.queue.includes('S'));
      assert.ok(result.queue.length >= 3);
    }

    {
      const result = resolveSpawn({
        queue: ['T', 'S'],
        bag: ['Z'],
        board: createEmptyBoard(),
        holdKey: null,
        holdUsed: false,
        queueSize: 5,
        ihsHeld: true,
      });
      assert.equal(result.holdKey, 'T');
      assert.equal(result.piece.type, 'S');
      assert.ok(result.queue.length >= 3);
      assert.equal(result.holdUsed, true);
    }

    {
      const result = resolveSpawn({
        queue: ['T', 'S', 'Z', 'J', 'L'],
        bag: ['I', 'O'],
        board: createEmptyBoard(),
        holdKey: 'I',
        holdUsed: true,
        queueSize: 5,
        ihsHeld: true,
      });
      assert.equal(result.piece.type, 'T');
      assert.equal(result.holdKey, 'I');
      assert.equal(result.holdUsed, false);
    }
  });
});
