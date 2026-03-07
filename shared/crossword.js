export const CROSSWORD_BLOCK = '#';
export const CROSSWORD_FILL = '.';
export const MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH = 3;

export function getCrosswordCellKey(row, col) {
  return `${row}:${col}`;
}

export function normalizeCrosswordPatternRow(value, width = 0) {
  const safeWidth = Math.max(0, Number.parseInt(width, 10) || 0);
  const chars = Array.from(String(value || '').toUpperCase())
    .slice(0, safeWidth || undefined)
    .map((char) => (char === CROSSWORD_BLOCK ? CROSSWORD_BLOCK : CROSSWORD_FILL));

  if (safeWidth > 0) {
    while (chars.length < safeWidth) chars.push(CROSSWORD_FILL);
  }

  return chars.join('');
}

export function isCrosswordFillable(layoutRows, row, col) {
  const targetRow = Array.isArray(layoutRows) ? layoutRows[row] : '';
  return typeof targetRow === 'string' && targetRow[col] && targetRow[col] !== CROSSWORD_BLOCK;
}

export function getCrosswordEntryCells(layoutRows, row, col, direction) {
  if (!isCrosswordFillable(layoutRows, row, col)) return [];
  const stepRow = direction === 'down' ? 1 : 0;
  const stepCol = direction === 'down' ? 0 : 1;
  const cells = [];
  let currentRow = row;
  let currentCol = col;

  while (isCrosswordFillable(layoutRows, currentRow, currentCol)) {
    cells.push({ row: currentRow, col: currentCol, key: getCrosswordCellKey(currentRow, currentCol) });
    currentRow += stepRow;
    currentCol += stepCol;
  }

  return cells;
}

export function getCrosswordEntries(layoutRows) {
  const rows = Array.isArray(layoutRows) ? layoutRows : [];
  const across = [];
  const down = [];
  let nextNumber = 1;

  for (let row = 0; row < rows.length; row += 1) {
    const width = Array.from(String(rows[row] || '')).length;
    for (let col = 0; col < width; col += 1) {
      if (!isCrosswordFillable(rows, row, col)) continue;
      const startsAcross = !isCrosswordFillable(rows, row, col - 1);
      const startsDown = !isCrosswordFillable(rows, row - 1, col);
      if (!startsAcross && !startsDown) continue;

      const cellNumber = nextNumber;
      nextNumber += 1;

      if (startsAcross) {
        const cells = getCrosswordEntryCells(rows, row, col, 'across');
        across.push({ number: cellNumber, row, col, direction: 'across', length: cells.length, cells });
      }
      if (startsDown) {
        const cells = getCrosswordEntryCells(rows, row, col, 'down');
        down.push({ number: cellNumber, row, col, direction: 'down', length: cells.length, cells });
      }
    }
  }

  return { across, down };
}

export function getCrosswordCellNumberMap(layoutRows) {
  const numbers = new Map();
  const entries = getCrosswordEntries(layoutRows);
  [...entries.across, ...entries.down].forEach((entry) => {
    const key = getCrosswordCellKey(entry.row, entry.col);
    if (!numbers.has(key)) numbers.set(key, entry.number);
  });
  return numbers;
}

export function createEmptyCrosswordFillGrid(layoutRows) {
  const rows = Array.isArray(layoutRows) ? layoutRows : [];
  return rows.map((row) => Array.from(String(row || '')).map((char) => (char === CROSSWORD_BLOCK ? CROSSWORD_BLOCK : '')));
}

export function serializeCrosswordPlayerGrid(grid, layoutRows) {
  const rows = Array.isArray(grid) ? grid : [];
  return (Array.isArray(layoutRows) ? layoutRows : []).map((layoutRow, rowIndex) => {
    const layoutChars = Array.from(String(layoutRow || ''));
    const valueRow = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    return layoutChars.map((char, colIndex) => {
      if (char === CROSSWORD_BLOCK) return CROSSWORD_BLOCK;
      const value = String(valueRow[colIndex] || '').trim().toUpperCase();
      return value ? Array.from(value)[0] : CROSSWORD_FILL;
    }).join('');
  });
}


function getCrosswordIssueEntryKey(entry) {
  return `${entry.direction}:${entry.row}:${entry.col}`;
}

function normalizeCrosswordIssueText(value) {
  return String(value || '').trim();
}

export function analyzeCrosswordConstruction({
  width = 0,
  height = 0,
  layoutRows = [],
  clues = {},
  solutionGrid = [],
  minEntryLength = MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
  requireClueText = true,
  requireCompleteSolution = true,
} = {}) {
  const rows = Array.isArray(layoutRows) ? layoutRows.map((row) => String(row || '')) : [];
  const expectedWidth = Math.max(0, Number.parseInt(width, 10) || (rows[0] ? Array.from(rows[0]).length : 0));
  const expectedHeight = Math.max(0, Number.parseInt(height, 10) || rows.length);
  const blockers = [];
  const warnings = [];
  const addIssue = (collection, code, message, meta = {}) => {
    collection.push({ code, message, ...meta });
  };

  if (expectedHeight !== rows.length) {
    addIssue(blockers, 'layout-height-mismatch', `Решетката има ${rows.length} реда, а височината е зададена като ${expectedHeight}.`);
  }

  rows.forEach((row, rowIndex) => {
    const rowWidth = Array.from(row).length;
    if (rowWidth !== expectedWidth) {
      addIssue(blockers, 'layout-width-mismatch', `Ред ${rowIndex + 1} е с дължина ${rowWidth}, а ширината е зададена като ${expectedWidth}.`, {
        row: rowIndex,
      });
    }
  });

  const entries = getCrosswordEntries(rows);
  const allEntries = [...entries.across, ...entries.down];

  if (entries.across.length === 0) {
    addIssue(blockers, 'missing-across-entries', 'Липсват думи по хоризонтала.');
  }
  if (entries.down.length === 0) {
    addIssue(blockers, 'missing-down-entries', 'Липсват думи по вертикала.');
  }

  if (minEntryLength > 1) {
    allEntries.forEach((entry) => {
      if (entry.length < minEntryLength) {
        addIssue(
          blockers,
          'entry-too-short',
          `${entry.direction === 'across' ? 'Хоризонтална' : 'Вертикална'} дума #${entry.number} е само ${entry.length} ${entry.length === 1 ? 'буква' : 'букви'}. Минимумът е ${minEntryLength}.`,
          {
            direction: entry.direction,
            number: entry.number,
            row: entry.row,
            col: entry.col,
            length: entry.length,
          }
        );
      }
    });
  }

  const clueSource = clues && typeof clues === 'object' ? clues : {};
  ['across', 'down'].forEach((direction) => {
    const expectedEntries = entries[direction];
    const rawEntries = Array.isArray(clueSource[direction]) ? clueSource[direction] : [];
    const clueByKey = new Map();

    rawEntries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const matchedEntry = expectedEntries.find((expected) => {
        const row = Number.parseInt(entry.row, 10);
        const col = Number.parseInt(entry.col, 10);
        const number = Number.parseInt(entry.number, 10);
        return (row === expected.row && col === expected.col) || number === expected.number;
      });

      if (!matchedEntry) {
        addIssue(
          warnings,
          'unexpected-clue',
          `Има излишен ${direction === 'across' ? 'хоризонтален' : 'вертикален'} clue, който не съответства на текущата решетка.`
        );
        return;
      }

      clueByKey.set(getCrosswordIssueEntryKey(matchedEntry), normalizeCrosswordIssueText(entry.clue));
    });

    if (requireClueText) {
      expectedEntries.forEach((entry) => {
        const clue = clueByKey.get(getCrosswordIssueEntryKey(entry)) || '';
        if (!clue) {
          addIssue(
            blockers,
            'missing-clue',
            `Липсва clue за ${direction === 'across' ? 'хоризонтална' : 'вертикална'} дума #${entry.number}.`,
            {
              direction,
              number: entry.number,
              row: entry.row,
              col: entry.col,
              length: entry.length,
            }
          );
        }
      });
    }
  });

  const solutionRows = Array.isArray(solutionGrid) ? solutionGrid.map((row) => String(row || '').toUpperCase()) : [];
  if (solutionRows.length !== rows.length) {
    addIssue(blockers, 'solution-height-mismatch', `Решението има ${solutionRows.length} реда, а решетката използва ${rows.length}.`);
  }

  let incompleteSolutionCells = 0;
  rows.forEach((row, rowIndex) => {
    const layoutChars = Array.from(row);
    const solutionChars = Array.from(solutionRows[rowIndex] || '');
    if (solutionChars.length !== layoutChars.length) {
      addIssue(
        blockers,
        'solution-width-mismatch',
        `Ред ${rowIndex + 1} в решението е с дължина ${solutionChars.length}, а трябва да бъде ${layoutChars.length}.`,
        { row: rowIndex }
      );
      return;
    }

    layoutChars.forEach((cell, colIndex) => {
      if (cell === CROSSWORD_BLOCK) return;
      const value = solutionChars[colIndex] || '';
      if (!value || value === CROSSWORD_FILL || value === '?') {
        incompleteSolutionCells += 1;
      }
    });
  });

  if (requireCompleteSolution && incompleteSolutionCells > 0) {
    addIssue(
      blockers,
      'incomplete-solution',
      `Решението има ${incompleteSolutionCells} непопълнени клетки. Замени всички "." и "?".`
    );
  }

  return {
    entries,
    blockers,
    warnings,
    stats: {
      acrossCount: entries.across.length,
      downCount: entries.down.length,
      totalEntries: allEntries.length,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      incompleteSolutionCells,
      shortEntryCount: blockers.filter((issue) => issue.code === 'entry-too-short').length,
      missingClueCount: blockers.filter((issue) => issue.code === 'missing-clue').length,
    },
  };
}
