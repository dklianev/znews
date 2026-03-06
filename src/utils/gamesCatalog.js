const GAME_HUB_DESCRIPTION_BY_SLUG = Object.freeze({
  sudoku: '\u0418\u0433\u0440\u0430\u0439 \u043f\u043e \u0432\u0441\u044f\u043a\u043e \u0432\u0440\u0435\u043c\u0435, \u0441\u043c\u0435\u043d\u044f\u0439 \u0442\u0440\u0443\u0434\u043d\u043e\u0441\u0442\u0442\u0430 \u043e\u0442 \u041b\u0435\u0441\u043d\u043e \u0434\u043e \u0415\u043a\u0441\u043f\u0435\u0440\u0442.',
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
