import { describe, it } from 'vitest';
import {
  analyzeCrosswordConstruction,
  createEmptyCrosswordFillGrid,
  getCrosswordCellNumberMap,
  getCrosswordEntries,
  getCrosswordEntryCells,
  MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
  normalizeCrosswordPatternRow,
  serializeCrosswordPlayerGrid,
} from '../shared/crossword.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${label}: expected ${expectedJson}, received ${actualJson}`);
}

describe('crossword', () => {
  it('covers legacy scenarios', async () => {
      const layout = ['..#', '...', '#..'];
    
      assert(normalizeCrosswordPatternRow('a#c', 5) === '.#...', 'normalizeCrosswordPatternRow should coerce to blocks and fills');
    
      const acrossCells = getCrosswordEntryCells(layout, 0, 0, 'across');
      assertDeepEqual(acrossCells, [
        { row: 0, col: 0, key: '0:0' },
        { row: 0, col: 1, key: '0:1' },
      ], 'getCrosswordEntryCells should list across cells');
    
      const entries = getCrosswordEntries(layout);
      assertDeepEqual(
        entries.across.map(({ number, row, col, length }) => ({ number, row, col, length })),
        [
          { number: 1, row: 0, col: 0, length: 2 },
          { number: 3, row: 1, col: 0, length: 3 },
          { number: 5, row: 2, col: 1, length: 2 },
        ],
        'getCrosswordEntries should derive across entries'
      );
      assertDeepEqual(
        entries.down.map(({ number, row, col, length }) => ({ number, row, col, length })),
        [
          { number: 1, row: 0, col: 0, length: 2 },
          { number: 2, row: 0, col: 1, length: 3 },
          { number: 4, row: 1, col: 2, length: 2 },
        ],
        'getCrosswordEntries should derive down entries'
      );
    
      const numberEntries = [...getCrosswordCellNumberMap(layout).entries()];
      assertDeepEqual(numberEntries, [
        ['0:0', 1],
        ['1:0', 3],
        ['2:1', 5],
        ['0:1', 2],
        ['1:2', 4],
      ], 'getCrosswordCellNumberMap should expose numbering by start cell');
    
      const emptyGrid = createEmptyCrosswordFillGrid(layout);
      assertDeepEqual(emptyGrid, [
        ['', '', '#'],
        ['', '', ''],
        ['#', '', ''],
      ], 'createEmptyCrosswordFillGrid should preserve blocks');
    
      const serialized = serializeCrosswordPlayerGrid([
        ['a', 'Beta', '#'],
        ['', '3', 'cat'],
        ['#', 'delta', ''],
      ], layout);
      assertDeepEqual(serialized, ['AB#', '.3C', '#D.'], 'serializeCrosswordPlayerGrid should uppercase and trim player entries');
    
      const publishAnalysis = analyzeCrosswordConstruction({
        width: 3,
        height: 3,
        layoutRows: layout,
        clues: {
          across: [
            { number: 1, row: 0, col: 0, clue: 'A clue' },
          ],
          down: [],
        },
        solutionGrid: ['AB#', '.3C', '#D.'],
        minEntryLength: MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
        requireClueText: true,
        requireCompleteSolution: true,
      });
      assert(publishAnalysis.blockers.some((issue) => issue.code === 'entry-too-short'), 'analyzeCrosswordConstruction should report short publish-blocking entries');
      assert(publishAnalysis.blockers.some((issue) => issue.code === 'missing-clue'), 'analyzeCrosswordConstruction should report missing clues');
      assert(publishAnalysis.blockers.some((issue) => issue.code === 'incomplete-solution'), 'analyzeCrosswordConstruction should report incomplete solution cells');
    
      const draftAnalysis = analyzeCrosswordConstruction({
        width: 3,
        height: 3,
        layoutRows: layout,
        clues: { across: [], down: [] },
        solutionGrid: ['AB#', '.3C', '#D.'],
        minEntryLength: 1,
        requireClueText: false,
        requireCompleteSolution: false,
      });
      assert(draftAnalysis.blockers.length === 0, 'analyzeCrosswordConstruction should allow incomplete draft state when publish rules are relaxed');
  });
});
