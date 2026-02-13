export const COMIC_CARD_VARIANTS = ['front', 'dossier', 'flash', 'spotlight'];
export const COMIC_LAYOUT_PRESETS = ['default', 'impact', 'noir', 'classic'];
export const COMIC_LAYOUT_PRESET_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'impact', label: 'Impact' },
  { id: 'noir', label: 'Noir' },
  { id: 'classic', label: 'Classic' },
];

const fallbackRecipe = {
  variants: ['front', 'dossier', 'flash', 'spotlight'],
  stickers: ['Фронт', 'Радар', 'Досие', 'Акцент'],
  stripes: ['from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue', 'from-zn-orange to-zn-gold'],
  tilts: [-0.8, 0.9, -0.6, 0.7],
};

const sectionRecipes = {
  homeFeatured: {
    variants: ['front', 'spotlight', 'dossier', 'flash'],
    stickers: ['Фронт', 'Ексклузив', 'Досие', 'Радар'],
    stripes: ['from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue', 'from-zn-orange to-zn-gold'],
    tilts: [-0.8, 1, -0.55, 0.65],
  },
  homeCrime: {
    variants: ['flash', 'dossier', 'front', 'spotlight'],
    stickers: ['Сигнал', 'Горещо', 'Досие', 'Операция'],
    stripes: ['from-zn-hot to-red-700', 'from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue'],
    tilts: [-0.7, 0.75, -0.6, 0.7],
  },
  homeReportage: {
    variants: ['dossier', 'spotlight', 'front', 'flash'],
    stickers: ['Репортаж', 'Разкритие', 'Фронт', 'Радар'],
    stripes: ['from-zn-orange to-zn-gold', 'from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue'],
    tilts: [-0.55, 0.65, -0.5, 0.6],
  },
  homeEmergency: {
    variants: ['flash', 'front', 'spotlight', 'dossier'],
    stickers: ['Сигнал', 'Патрул', 'Аларма', 'Радар'],
    stripes: ['from-zn-hot to-red-700', 'from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue'],
    tilts: [-0.45, 0.55, -0.42, 0.5],
  },
  articleRelated: {
    variants: ['dossier', 'flash', 'spotlight', 'front'],
    stickers: ['Свързана', 'Близка', 'Още', 'Фронт'],
    stripes: ['from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue', 'from-zn-orange to-zn-gold'],
    tilts: [-0.6, 0.6, -0.5, 0.55],
  },
  categoryListing: {
    variants: ['front', 'dossier', 'spotlight', 'flash'],
    stickers: ['Фронт', 'Рубрика', 'Акцент', 'Радар'],
    stripes: ['from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue', 'from-zn-orange to-zn-gold'],
    tilts: [-0.65, 0.65, -0.5, 0.55],
  },
  searchListing: {
    variants: ['spotlight', 'front', 'dossier', 'flash'],
    stickers: ['Резултат', 'Фронт', 'Досие', 'Радар'],
    stripes: ['from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue', 'from-zn-orange to-zn-gold'],
    tilts: [-0.6, 0.6, -0.55, 0.55],
  },
};

const presetRecipes = {
  default: {},
  impact: {
    variants: ['flash', 'front', 'spotlight', 'dossier'],
    stickers: ['Спешно', 'Фронт', 'Разкритие', 'Досие'],
    stripes: ['from-zn-hot to-red-700', 'from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue'],
    tilts: [-1.1, 1.2, -0.95, 1.05],
  },
  noir: {
    variants: ['dossier', 'spotlight', 'front', 'flash'],
    stickers: ['Архив', 'Досие', 'Радар', 'Операция'],
    stripes: ['from-zn-navy to-zn-purple', 'from-zn-purple to-zn-blue', 'from-zn-hot to-zn-orange'],
    tilts: [-0.35, 0.4, -0.3, 0.32],
  },
  classic: {
    variants: ['front', 'dossier', 'spotlight', 'flash'],
    stickers: ['Фронт', 'Рубрика', 'Акцент', 'Радар'],
    stripes: ['from-zn-orange to-zn-gold', 'from-zn-hot to-zn-orange', 'from-zn-purple to-zn-blue'],
    tilts: [-0.6, 0.65, -0.55, 0.58],
  },
};

function pickFromList(list, seed, fallbackValue) {
  if (!Array.isArray(list) || list.length === 0) return fallbackValue;
  return list[seed % list.length];
}

function mergeRecipe(baseRecipe, presetKey) {
  const presetRecipe = presetRecipes[presetKey] || presetRecipes.default;
  return {
    variants: Array.isArray(presetRecipe.variants) && presetRecipe.variants.length > 0
      ? presetRecipe.variants
      : baseRecipe.variants,
    stickers: Array.isArray(presetRecipe.stickers) && presetRecipe.stickers.length > 0
      ? presetRecipe.stickers
      : baseRecipe.stickers,
    stripes: Array.isArray(presetRecipe.stripes) && presetRecipe.stripes.length > 0
      ? presetRecipe.stripes
      : baseRecipe.stripes,
    tilts: Array.isArray(presetRecipe.tilts) && presetRecipe.tilts.length > 0
      ? presetRecipe.tilts
      : baseRecipe.tilts,
  };
}

export function getComicCardStyle(sectionKey, index, article, preset = 'default') {
  const recipe = sectionRecipes[sectionKey] || fallbackRecipe;
  const effectiveRecipe = mergeRecipe(recipe, COMIC_LAYOUT_PRESETS.includes(preset) ? preset : 'default');
  const articleId = Math.abs(Number(article?.id) || 0);
  const seed = (articleId * 13 + index * 7) % 997;
  const variant = pickFromList(effectiveRecipe.variants, seed, fallbackRecipe.variants[0]);
  const sticker = pickFromList(effectiveRecipe.stickers, seed, fallbackRecipe.stickers[0]);
  const stripe = pickFromList(effectiveRecipe.stripes, seed, fallbackRecipe.stripes[0]);
  const tilt = pickFromList(effectiveRecipe.tilts, seed, fallbackRecipe.tilts[0]);

  return {
    variant,
    sticker,
    stripe,
    tilt: `${Number(tilt) || 0}deg`,
  };
}
