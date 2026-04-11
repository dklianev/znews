import { describe, expect, it } from 'vitest';

import {
  STRANDS_TOTAL_CELLS,
  analyzeCoverage,
  buildWordFromPath,
  doesPathSpanBoard,
  getCellsAlongStraightPath,
  matchPathToAnswer,
  normalizeGrid,
} from '../../shared/strands.js';

const SAMPLE_GRID = [
  'АБВГДЕ',
  'ЖЗИЙКЛ',
  'МНОПРС',
  'ТУФХЦЧ',
  'ШЩЪЬЮЯ',
  'АБВГДЕ',
  'ЖЗИЙКЛ',
  'МНОПРС',
];

describe('strands shared helpers', () => {
  it('normalizes a valid 8x6 grid and builds words from flat cell paths', () => {
    expect(normalizeGrid(SAMPLE_GRID)).toEqual(SAMPLE_GRID);
    expect(buildWordFromPath([0, 1, 2], SAMPLE_GRID)).toBe('АБВ');
  });

  it('tracks full coverage and one spangram without overlaps', () => {
    const answers = Array.from({ length: 8 }, (_, rowIndex) => ({
      kind: rowIndex === 7 ? 'spangram' : 'theme',
      word: SAMPLE_GRID[rowIndex],
      cells: Array.from({ length: 6 }, (_, colIndex) => (rowIndex * 6) + colIndex),
    }));

    const coverage = analyzeCoverage(answers);
    expect(coverage.uncoveredCells).toEqual([]);
    expect(coverage.duplicateCells).toEqual([]);
    expect(coverage.spangrams).toBe(1);
    expect(coverage.themeCount).toBe(7);
    expect(coverage.isComplete).toBe(true);
    expect(coverage.coveredCells.size).toBe(STRANDS_TOTAL_CELLS);
  });

  it('matches the same answer in forward and reverse direction', () => {
    const answers = [
      { kind: 'theme', word: 'АБВ', cells: [0, 1, 2] },
      { kind: 'spangram', word: 'МНОПРС', cells: [42, 43, 44, 45, 46, 47] },
    ];

    expect(matchPathToAnswer([0, 1, 2], answers)).toEqual({
      kind: 'theme',
      word: 'АБВ',
      cells: [0, 1, 2],
    });
    expect(matchPathToAnswer([2, 1, 0], answers)).toEqual({
      kind: 'theme',
      word: 'АБВ',
      cells: [0, 1, 2],
    });
    expect(doesPathSpanBoard([42, 43, 44, 45, 46, 47])).toBe(true);
  });

  it('bridges straight drags across rows, columns, and diagonals', () => {
    expect(getCellsAlongStraightPath(0, 3)).toEqual([1, 2, 3]);
    expect(getCellsAlongStraightPath(0, 18)).toEqual([6, 12, 18]);
    expect(getCellsAlongStraightPath(0, 21)).toEqual([7, 14, 21]);
    expect(getCellsAlongStraightPath(0, 8)).toEqual([]);
  });
});
