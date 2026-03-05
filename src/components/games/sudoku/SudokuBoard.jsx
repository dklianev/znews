import { memo, useMemo } from 'react';

function cellKey(row, column) {
  return `${row}-${column}`;
}

function boxKey(row, column) {
  return `${Math.floor(row / 3)}-${Math.floor(column / 3)}`;
}

function hasNote(notes, row, column, value) {
  const cellNotes = notes?.[row]?.[column];
  return Array.isArray(cellNotes) && cellNotes.includes(value);
}

function SudokuBoard({
  grid,
  initialGrid,
  notes,
  selectedCell,
  conflicts,
  onSelectCell,
}) {
  const selectedRow = Number.isInteger(selectedCell?.row) ? selectedCell.row : null;
  const selectedColumn = Number.isInteger(selectedCell?.column) ? selectedCell.column : null;
  const selectedBox = selectedRow !== null && selectedColumn !== null
    ? boxKey(selectedRow, selectedColumn)
    : null;

  const conflictsSet = useMemo(() => {
    if (conflicts instanceof Set) return conflicts;
    if (Array.isArray(conflicts)) return new Set(conflicts);
    return new Set();
  }, [conflicts]);

  return (
    <div className="w-full max-w-[620px] mx-auto p-2 sm:p-3 bg-white border-2 border-[#1C1428] shadow-comic-heavy">
      <div className="grid grid-cols-9">
        {grid.map((row, rowIndex) => (
          row.map((value, columnIndex) => {
            const key = cellKey(rowIndex, columnIndex);
            const isGiven = Number(initialGrid?.[rowIndex]?.[columnIndex]) > 0;
            const isSelected = rowIndex === selectedRow && columnIndex === selectedColumn;
            const isRelated = !isSelected && (
              rowIndex === selectedRow
              || columnIndex === selectedColumn
              || (selectedBox && boxKey(rowIndex, columnIndex) === selectedBox)
            );
            const isConflict = conflictsSet.has(key);

            const borderClasses = [
              'border-r border-b border-[#1C1428]/35',
              rowIndex % 3 === 0 ? 'border-t-2 border-t-[#1C1428]' : '',
              columnIndex % 3 === 0 ? 'border-l-2 border-l-[#1C1428]' : '',
              rowIndex === 8 ? 'border-b-2 border-b-[#1C1428]' : '',
              columnIndex === 8 ? 'border-r-2 border-r-[#1C1428]' : '',
            ].join(' ').trim();

            const cellBackground = isSelected
              ? 'bg-zn-hot/20'
              : isConflict
                ? 'bg-red-100'
                : isGiven
                  ? 'bg-stone-100'
                  : isRelated
                    ? 'bg-zn-hot/5'
                    : 'bg-white';

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectCell(rowIndex, columnIndex)}
                className={`aspect-square relative p-0 transition-colors ${borderClasses} ${cellBackground}`}
                aria-label={`Cell ${rowIndex + 1}-${columnIndex + 1}`}
              >
                {value > 0 ? (
                  <span
                    className={`font-black text-[1.05rem] sm:text-[1.35rem] leading-none ${isGiven
                      ? 'text-[#1C1428]'
                      : isConflict
                        ? 'text-red-700'
                        : 'text-zn-purple'}`}
                  >
                    {value}
                  </span>
                ) : (
                  <span className="absolute inset-0 grid grid-cols-3 grid-rows-3 text-[0.52rem] sm:text-[0.62rem] text-[#1C1428]/55 font-semibold leading-none">
                    {Array.from({ length: 9 }, (_, idx) => idx + 1).map((digit) => (
                      <span key={`${key}-note-${digit}`} className={`flex items-center justify-center ${hasNote(notes, rowIndex, columnIndex, digit) ? 'opacity-100' : 'opacity-0'}`}>
                        {digit}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })
        ))}
      </div>
    </div>
  );
}

export default memo(SudokuBoard);
