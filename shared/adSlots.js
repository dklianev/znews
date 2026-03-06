export const AD_STATUS_OPTIONS = Object.freeze(['draft', 'active', 'paused', 'archived']);
export const AD_PAGE_TYPES = Object.freeze(['home', 'article', 'category']);
export const AD_TYPES = Object.freeze(['horizontal', 'side', 'inline']);

export const AD_SLOT_DEFINITIONS = Object.freeze([
  {
    id: 'home.top',
    pageType: 'home',
    variant: 'horizontal',
    label: 'Начало: горен банер',
    description: 'Показва се под игрите в началната страница.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'home.feed.afterShowcase',
    pageType: 'home',
    variant: 'horizontal',
    label: 'Начало: след акцентите',
    description: 'Широк банер след секцията с акцентите.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'home.sidebar.1',
    pageType: 'home',
    variant: 'side',
    label: 'Начало: sidebar 1',
    description: 'Първа позиция в sidebar-а на началната страница.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'home.sidebar.2',
    pageType: 'home',
    variant: 'side',
    label: 'Начало: sidebar 2',
    description: 'Втора позиция в sidebar-а на началната страница.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'home.bottom',
    pageType: 'home',
    variant: 'horizontal',
    label: 'Начало: долен банер',
    description: 'Широк банер в края на началната страница.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'article.afterCover',
    pageType: 'article',
    variant: 'inline',
    label: 'Статия: след корицата',
    description: 'Inline банер под featured image/video.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.inline.afterParagraph2',
    pageType: 'article',
    variant: 'inline',
    label: 'Статия: след 2-ри абзац',
    description: 'Inline банер в текста след втория абзац.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.inline.afterParagraph5',
    pageType: 'article',
    variant: 'inline',
    label: 'Статия: след 5-ти абзац',
    description: 'Inline банер в текста след петия абзац.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.bottom',
    pageType: 'article',
    variant: 'horizontal',
    label: 'Статия: долен банер',
    description: 'Широк банер след коментарите и преди related.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.sidebar.1',
    pageType: 'article',
    variant: 'side',
    label: 'Статия: sidebar 1',
    description: 'Първа реклама в sidebar-а на статия.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.sidebar.2',
    pageType: 'article',
    variant: 'side',
    label: 'Статия: sidebar 2',
    description: 'Втора реклама в sidebar-а на статия.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.top',
    pageType: 'category',
    variant: 'horizontal',
    label: 'Категория: горен банер',
    description: 'Широк банер под header-а на категорията.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.grid.after4',
    pageType: 'category',
    variant: 'horizontal',
    label: 'Категория: след 4 статии',
    description: 'Широк банер в грида след четвъртата статия.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.grid.after8',
    pageType: 'category',
    variant: 'horizontal',
    label: 'Категория: след 8 статии',
    description: 'Широк банер в грида след осмата статия.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.sidebar.1',
    pageType: 'category',
    variant: 'side',
    label: 'Категория: sidebar 1',
    description: 'Първа реклама в sidebar-а на категория.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.sidebar.2',
    pageType: 'category',
    variant: 'side',
    label: 'Категория: sidebar 2',
    description: 'Втора реклама в sidebar-а на категория.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
]);

export const AD_SLOT_MAP = Object.freeze(
  AD_SLOT_DEFINITIONS.reduce((acc, slot) => {
    acc[slot.id] = Object.freeze({
      ...slot,
      allowedTypes: Object.freeze([slot.variant]),
    });
    return acc;
  }, {})
);

const LEGACY_TYPE_FALLBACKS = Object.freeze({
  horizontal: Object.freeze([
    'home.top',
    'home.feed.afterShowcase',
    'home.bottom',
    'article.bottom',
    'category.top',
    'category.grid.after4',
    'category.grid.after8',
  ]),
  side: Object.freeze([
    'home.sidebar.1',
    'home.sidebar.2',
    'article.sidebar.1',
    'article.sidebar.2',
    'category.sidebar.1',
    'category.sidebar.2',
  ]),
  inline: Object.freeze([
    'article.afterCover',
    'article.inline.afterParagraph2',
    'article.inline.afterParagraph5',
  ]),
});

export function getAdSlot(slotId) {
  return AD_SLOT_MAP[String(slotId || '').trim()] || null;
}

export function isKnownAdSlot(slotId) {
  return Boolean(getAdSlot(slotId));
}

export function getSlotsForPageType(pageType) {
  const normalized = String(pageType || '').trim().toLowerCase();
  return AD_SLOT_DEFINITIONS.filter((slot) => slot.pageType === normalized);
}

export function getDefaultPlacementsForType(type) {
  const normalized = String(type || '').trim().toLowerCase();
  return [...(LEGACY_TYPE_FALLBACKS[normalized] || [])];
}

export function getAllowedAdTypesForSlot(slotId) {
  return [...(getAdSlot(slotId)?.allowedTypes || [])];
}

export function isAdTypeAllowedInSlot(type, slotId) {
  const normalizedType = String(type || '').trim().toLowerCase();
  const slot = getAdSlot(slotId);
  if (!slot) return false;
  return slot.allowedTypes.includes(normalizedType);
}
