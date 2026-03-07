export const CROSSWORD_BLOCK = '#';
export const CROSSWORD_FILL = '.';

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
