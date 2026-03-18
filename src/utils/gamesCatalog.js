const GAME_HUB_DESCRIPTION_BY_SLUG = Object.freeze({
  sudoku: 'Играй по всяко време, сменяй трудността от Лесно до Експерт.',
  spellingbee: 'Сглоби възможно най-много думи от седем букви и стигни до ранга „Гений”.',
  tetris: 'Подреждай фигури, чисти линии, гони рекорд. Класиката на класиките.',
  snake: 'Яж, расти, не се блъскай. Три трудности, безкраен режим.',
  '2048': 'Плъзгай плочки, сливай числа, достигни 2048. Пристрастяващ пъзел!',
  flappybird: 'Маха крилца, прелитай тръби, гони рекорд. Класическа аркада!',
});

export function sortGamesCatalog(items) {
  const safeItems = Array.isArray(items) ? items : [];
  return [...safeItems].sort((left, right) => {
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

export function getGameHubDescription(game) {
  const slug = String(game?.slug || '').trim().toLowerCase();
  if (GAME_HUB_DESCRIPTION_BY_SLUG[slug]) return GAME_HUB_DESCRIPTION_BY_SLUG[slug];
  return String(game?.description || '').trim();
}
