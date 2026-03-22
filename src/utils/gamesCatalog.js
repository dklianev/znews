const GAME_HUB_DESCRIPTION_BY_SLUG = Object.freeze({
  sudoku: 'Реши числовата мрежа и дръж концентрацията до последната клетка.',
  spellingbee: 'Събирай български думи около централна буква и стигни до панграма.',
  tetris: 'Класически блокове, бързи решения и истински newsroom натиск.',
  snake: 'Яж, растѝ и оцелявай колкото можеш по-дълго.',
  '2048': 'Плъзгай плочките, комбинирай числата и стигни до 2048.',
  flappybird: 'Прелети между тръбите и задръж темпото.',
  blockbust: 'Редакционен блоков рън с три фигури наведнъж, смяна на темите и пълни изчиствания.',
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
