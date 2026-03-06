const LOCAL_SUDOKU_GAME = Object.freeze({
  id: 'local-sudoku',
  slug: 'sudoku',
  title: 'Судоку',
  type: 'sudoku',
  description: 'Безкрайно Судоку с Лесно, Средно, Трудно и Експерт.',
  icon: 'Grid3x3',
  active: true,
  sortOrder: 4,
  theme: 'purple',
});

export function ensureSudokuGameList(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const hasSudoku = safeItems.some((game) => String(game?.slug || '').toLowerCase() === 'sudoku');
  const merged = hasSudoku
    ? safeItems
    : [...safeItems, LOCAL_SUDOKU_GAME];

  return [...merged].sort((left, right) => {
    const leftOrder = Number.parseInt(left?.sortOrder, 10);
    const rightOrder = Number.parseInt(right?.sortOrder, 10);
    const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : 999;
    const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : 999;
    if (safeLeftOrder !== safeRightOrder) return safeLeftOrder - safeRightOrder;

    const leftTitle = String(left?.title || left?.slug || '');
    const rightTitle = String(right?.title || right?.slug || '');
    return leftTitle.localeCompare(rightTitle);
  });
}

