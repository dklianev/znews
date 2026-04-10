const GAME_HUB_DESCRIPTION_BY_SLUG = Object.freeze({
  sudoku: 'Реши числовата мрежа и дръж концентрацията до последната клетка.',
  spellingbee: 'Събирай български думи около централна буква и стигни до панграма.',
  tetris: 'Класически блокове, бързи решения и истински newsroom натиск.',
  snake: 'Яж, растѝ и оцелявай колкото можеш по-дълго.',
  '2048': 'Плъзгай плочките, комбинирай числата и стигни до 2048.',
  flappybird: 'Прелети между тръбите и задръж темпото.',
  blockbust: 'Подреждай три фигури наведнъж, чисти редове и колони и трупай комбо бонуси.',
});

const PUZZLE_TYPES = new Set(['word', 'connections', 'quiz', 'sudoku', 'hangman', 'spellingbee', 'crossword']);
const ARCADE_TYPES = new Set(['tetris', 'snake', '2048', 'flappybird', 'blockbust']);
const DAILY_GAME_SLUGS = new Set(['word', 'connections', 'quiz', 'hangman', 'spellingbee', 'crossword']);

export const GAME_GROUPS = Object.freeze([
  { key: 'all', label: 'Всички' },
  { key: 'puzzles', label: 'Пъзели' },
  { key: 'arcade', label: 'Аркадни' },
]);

const GAME_THEME_VARIANT_BY_THEME = Object.freeze({
  green: 'eco',
  indigo: 'underground',
  orange: 'hot',
  purple: 'underground',
  default: 'front',
});

const GAME_STRIPE_CLASS_BY_THEME = Object.freeze({
  green: 'from-emerald-500 to-emerald-700',
  indigo: 'from-indigo-600 to-zn-navy',
  orange: 'from-zn-hot to-zn-orange',
  purple: 'from-zn-purple to-zn-purple-dark',
  default: 'from-zinc-700 to-zinc-900',
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

export function getGameGroup(game) {
  if (PUZZLE_TYPES.has(game?.type)) return 'puzzles';
  if (ARCADE_TYPES.has(game?.type)) return 'arcade';
  return 'puzzles';
}

export function isDailyGame(game) {
  return DAILY_GAME_SLUGS.has(String(game?.slug || '').trim().toLowerCase());
}

export function getDailyGames(items) {
  return sortGamesCatalog((Array.isArray(items) ? items : []).filter(isDailyGame));
}

export function getGameHubDescription(game) {
  const slug = String(game?.slug || '').trim().toLowerCase();
  if (GAME_HUB_DESCRIPTION_BY_SLUG[slug]) return GAME_HUB_DESCRIPTION_BY_SLUG[slug];
  return String(game?.description || '').trim();
}

export function getGameThemeVariant(game) {
  return GAME_THEME_VARIANT_BY_THEME[game?.theme] || GAME_THEME_VARIANT_BY_THEME.default;
}

export function getGameStripeClass(game) {
  return GAME_STRIPE_CLASS_BY_THEME[game?.theme] || GAME_STRIPE_CLASS_BY_THEME.default;
}

export function getGameProgressState(progress, streak) {
  const gameStatus = progress?.gameStatus || '';

  return {
    gameStatus,
    isPlayedToday: Boolean(progress) && gameStatus !== 'playing',
    isWonToday: gameStatus === 'won',
    isLostToday: gameStatus === 'lost',
    hasActiveStreak: Number(streak?.currentStreak) > 0,
  };
}
