export const AD_STATUS_OPTIONS = Object.freeze(['draft', 'active', 'paused', 'archived']);
export const AD_PAGE_TYPES = Object.freeze(['home', 'article', 'category']);
export const AD_TYPES = Object.freeze(['horizontal', 'side', 'inline']);

export const AD_SLOT_DEFINITIONS = Object.freeze([
  {
    id: 'home.top',
    pageType: 'home',
    variant: 'horizontal',
    sizeProfile: 'hero',
    label: 'Начална: най-горе',
    description: 'Широк банер в началната страница, точно под водещия блок.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'home.feed.afterShowcase',
    pageType: 'home',
    variant: 'horizontal',
    sizeProfile: 'regular',
    label: 'Начална: след акцентите',
    description: 'Широк банер между началните секции и основния поток новини.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'home.sidebar.1',
    pageType: 'home',
    variant: 'side',
    sizeProfile: 'tall',
    label: 'Начална: sidebar 1',
    description: 'Първата странична позиция в дясната колона на началната страница.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'home.sidebar.2',
    pageType: 'home',
    variant: 'side',
    sizeProfile: 'tall',
    label: 'Начална: sidebar 2',
    description: 'Втората странична позиция в дясната колона на началната страница.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'home.bottom',
    pageType: 'home',
    variant: 'horizontal',
    sizeProfile: 'regular',
    label: 'Начална: най-долу',
    description: 'Широк банер в долната част на началната страница.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: false,
  },
  {
    id: 'article.afterCover',
    pageType: 'article',
    variant: 'inline',
    sizeProfile: 'compact',
    label: 'Статия: след корицата',
    description: 'Inline банер веднага след коричната снимка или видео на статията.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.inline.afterParagraph2',
    pageType: 'article',
    variant: 'inline',
    sizeProfile: 'compact',
    label: 'Статия: след 2-рия абзац',
    description: 'Inline банер в текста след втория параграф.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.inline.afterParagraph5',
    pageType: 'article',
    variant: 'inline',
    sizeProfile: 'compact',
    label: 'Статия: след 5-ия абзац',
    description: 'Inline банер в текста след петия параграф.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.bottom',
    pageType: 'article',
    variant: 'horizontal',
    sizeProfile: 'compact',
    label: 'Статия: най-долу',
    description: 'Широк банер под съдържанието на статията и преди related секцията.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.sidebar.1',
    pageType: 'article',
    variant: 'side',
    sizeProfile: 'compact',
    label: 'Статия: sidebar 1',
    description: 'Първата странична позиция до съдържанието на статията.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'article.sidebar.2',
    pageType: 'article',
    variant: 'side',
    sizeProfile: 'compact',
    label: 'Статия: sidebar 2',
    description: 'Втората странична позиция до съдържанието на статията.',
    supportsArticleTargeting: true,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.top',
    pageType: 'category',
    variant: 'horizontal',
    sizeProfile: 'hero',
    label: 'Категория: най-горе',
    description: 'Широк банер под header-а на страницата на категория.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.grid.after4',
    pageType: 'category',
    variant: 'horizontal',
    sizeProfile: 'regular',
    label: 'Категория: след 4 карти',
    description: 'Широк банер в грида след първите четири статии.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.grid.after8',
    pageType: 'category',
    variant: 'horizontal',
    sizeProfile: 'regular',
    label: 'Категория: след 8 карти',
    description: 'Широк банер в грида след осемте първи статии.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.sidebar.1',
    pageType: 'category',
    variant: 'side',
    sizeProfile: 'compact',
    label: 'Категория: sidebar 1',
    description: 'Първата странична позиция в страницата на категория.',
    supportsArticleTargeting: false,
    supportsCategoryTargeting: true,
  },
  {
    id: 'category.sidebar.2',
    pageType: 'category',
    variant: 'side',
    sizeProfile: 'compact',
    label: 'Категория: sidebar 2',
    description: 'Втората странична позиция в страницата на категория.',
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
