const VARIANT_SETS = {
  classic: ['egg-red', 'egg-purple', 'egg-gold', 'egg-police', 'egg-underground', 'egg-vip', 'egg-cracked'],
  police: ['egg-police', 'egg-red', 'egg-gold', 'egg-cracked', 'egg-purple', 'egg-underground', 'egg-vip'],
  underground: ['egg-underground', 'egg-purple', 'egg-cracked', 'egg-red', 'egg-gold', 'egg-vip', 'egg-police'],
  vip: ['egg-vip', 'egg-gold', 'egg-red', 'egg-purple', 'egg-police', 'egg-underground', 'egg-cracked'],
};

const DECORATION_PAGE_MAX = {
  homepage: 2,
  article: 1,
  classifieds: 1,
  games: 3,
  category: 1,
  about: 1,
  search: 1,
};

const DECORATION_SLOTS = {
  homepage: [
    { eggId: 'egg-home-hero', position: 'top-right', size: 'md', withTape: true, tapeRotation: '12deg', mobileHidden: true },
    { eggId: 'egg-home-section', position: 'bottom-left-inset', size: 'sm', withTape: false, mobileHidden: false },
  ],
  article: [
    { eggId: 'egg-article-body', position: 'top-right', size: 'sm', withTape: true, tapeRotation: '-8deg', mobileHidden: false },
  ],
  classifieds: [
    { eggId: 'egg-classifieds-main', position: 'top-right', size: 'sm', withTape: false, mobileHidden: false },
  ],
  games: [
    { eggId: 'egg-games-hero', position: 'top-right', size: 'xl', withTape: true, tapeRotation: '9deg', mobileHidden: false, opacityClass: 'opacity-95' },
    { eggId: 'egg-games-stack', position: 'top-right-inset', size: 'lg', withTape: false, mobileHidden: false, opacityClass: 'opacity-85' },
    { eggId: 'egg-games-lower', position: 'bottom-right-inset', size: 'md', withTape: true, tapeRotation: '-7deg', mobileHidden: true, opacityClass: 'opacity-75' },
  ],
  category: [
    { eggId: 'egg-category-main', position: 'top-right', size: 'sm', withTape: true, tapeRotation: '10deg', mobileHidden: false },
  ],
  about: [
    { eggId: 'egg-about-main', position: 'bottom-right', size: 'md', withTape: false, mobileHidden: false },
  ],
  search: [
    { eggId: 'egg-search-main', position: 'top-left', size: 'sm', withTape: true, tapeRotation: '-6deg', mobileHidden: false },
  ],
};

const HUNT_SLOT_ORDER = [
  { pageId: 'homepage', eggId: 'egg-home-hero', position: 'top-right', size: 'md', withTape: true, tapeRotation: '12deg', mobileHidden: true },
  { pageId: 'homepage', eggId: 'egg-home-section', position: 'bottom-left-inset', size: 'sm', withTape: false, mobileHidden: false },
  { pageId: 'article', eggId: 'egg-article-lead', position: 'top-left', size: 'sm', withTape: true, tapeRotation: '-6deg', mobileHidden: false },
  { pageId: 'article', eggId: 'egg-article-footer', position: 'bottom-left', size: 'sm', withTape: false, mobileHidden: false },
  { pageId: 'category', eggId: 'egg-category-top', position: 'top-right', size: 'sm', withTape: true, tapeRotation: '8deg', mobileHidden: false },
  { pageId: 'category', eggId: 'egg-category-bottom', position: 'bottom-left', size: 'sm', withTape: false, mobileHidden: false },
  { pageId: 'classifieds', eggId: 'egg-classifieds-top', position: 'top-right', size: 'sm', withTape: false, mobileHidden: false },
  { pageId: 'classifieds', eggId: 'egg-classifieds-bottom', position: 'bottom-left', size: 'sm', withTape: true, tapeRotation: '5deg', mobileHidden: false },
  { pageId: 'games', eggId: 'egg-games', position: 'top-right-inset', size: 'lg', withTape: true, tapeRotation: '6deg', mobileHidden: false },
  { pageId: 'about', eggId: 'egg-about', position: 'bottom-right', size: 'sm', withTape: false, mobileHidden: false },
  { pageId: 'search', eggId: 'egg-search-top', position: 'top-left', size: 'sm', withTape: true, tapeRotation: '-6deg', mobileHidden: false },
  { pageId: 'search', eggId: 'egg-search-bottom', position: 'bottom-right', size: 'sm', withTape: false, mobileHidden: false },
];

function clamp(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toCalendarBoundary(value, endOfDay = false) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
}

function hashEggId(eggId) {
  return [...String(eggId || '')].reduce((total, char) => total + char.charCodeAt(0), 0);
}

export function resolveEasterVariants(settings) {
  const set = settings?.seasonalCampaigns?.easter?.variantSet || 'classic';
  return VARIANT_SETS[set] || VARIANT_SETS.classic;
}

export function computeOrthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;

  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13);
  return julian;
}

export function isEasterCampaignActive(settings, now = new Date()) {
  const easter = settings?.seasonalCampaigns?.easter;
  if (!easter?.enabled) return false;

  if (easter.autoWindow) {
    const year = now.getFullYear();
    const easterDate = computeOrthodoxEaster(year);
    const start = new Date(easterDate);
    start.setDate(start.getDate() - 14);
    start.setHours(0, 0, 0, 0);

    const end = new Date(easterDate);
    end.setDate(end.getDate() + 2);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  }

  const start = toCalendarBoundary(easter.startAt, false);
  const end = toCalendarBoundary(easter.endAt, true);
  if (!start || !end) return false;
  if (start > end) return false;
  return now >= start && now <= end;
}

export function shouldRenderDecorations(settings, now) {
  const easter = settings?.seasonalCampaigns?.easter;
  if (!easter?.enabled || !easter.decorationsEnabled) return false;
  return isEasterCampaignActive(settings, now);
}

export function getEggPlacements(pageId, settings) {
  const requestedMax = clamp(settings?.seasonalCampaigns?.easter?.maxVisibleEggs, 1, 6, 2);
  const pageMax = DECORATION_PAGE_MAX[pageId] ?? requestedMax;
  const slots = DECORATION_SLOTS[pageId] || [];
  const variants = resolveEasterVariants(settings);
  const limit = Math.min(pageMax, requestedMax, slots.length);

  return slots.slice(0, limit).map((slot, index) => ({
    ...slot,
    variant: variants[hashEggId(slot.eggId || `${pageId}-${index}`) % variants.length],
  }));
}

export function getConfiguredHuntEggCount(settings) {
  return clamp(settings?.seasonalCampaigns?.easter?.huntEggCount, 3, HUNT_SLOT_ORDER.length, 6);
}

export function isHuntActive(settings, now) {
  const easter = settings?.seasonalCampaigns?.easter;
  return Boolean(easter?.huntEnabled) && isEasterCampaignActive(settings, now);
}

export function getHuntEggId(pageId, index = 0) {
  const pageSlots = HUNT_SLOT_ORDER.filter((slot) => slot.pageId === pageId);
  return pageSlots[index]?.eggId || `egg-${pageId}${index > 0 ? `-${index}` : ''}`;
}

export function getHuntPlacements(pageId, settings) {
  const pageSlots = HUNT_SLOT_ORDER.filter((slot) => slot.pageId === pageId);
  if (pageSlots.length === 0) return [];

  const total = getConfiguredHuntEggCount(settings);
  const activeEggIds = new Set(HUNT_SLOT_ORDER.slice(0, total).map((slot) => slot.eggId));
  const lastActiveEggId = HUNT_SLOT_ORDER[Math.max(0, total - 1)]?.eggId || null;
  const variants = resolveEasterVariants(settings);
  const huntVariants = variants.filter((variant) => variant !== 'egg-vip' && variant !== 'egg-gold');
  const fallbackVariants = huntVariants.length > 0 ? huntVariants : variants;

  return pageSlots
    .filter((slot) => activeEggIds.has(slot.eggId))
    .map((slot) => {
      let variant = fallbackVariants[hashEggId(slot.eggId) % fallbackVariants.length];

      if (slot.eggId === 'egg-home-hero') {
        variant = 'egg-gold';
      } else if (slot.eggId === lastActiveEggId) {
        variant = 'egg-vip';
      }

      return {
        ...slot,
        variant,
      };
    });
}
