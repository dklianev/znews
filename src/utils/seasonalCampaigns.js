const VARIANT_SETS = {
  classic: ['egg-red', 'egg-purple', 'egg-gold'],
  police: ['egg-police', 'egg-red', 'egg-cracked'],
  underground: ['egg-underground', 'egg-purple', 'egg-cracked'],
  vip: ['egg-vip', 'egg-gold', 'egg-red'],
};

const PAGE_SLOTS = {
  homepage: [
    { position: 'top-right', size: 'md', withTape: true, tapeRotation: '12deg' },
    { position: 'bottom-left-inset', size: 'sm', withTape: false },
  ],
  article: [
    { position: 'bottom-right', size: 'sm', withTape: true, tapeRotation: '-8deg' },
  ],
  classifiedDetail: [
    { position: 'top-right', size: 'sm', withTape: false },
  ],
  games: [
    { position: 'bottom-left', size: 'md', withTape: true, tapeRotation: '6deg' },
  ],
  category: [
    { position: 'top-right', size: 'sm', withTape: true, tapeRotation: '10deg' },
  ],
  about: [
    { position: 'bottom-right', size: 'md', withTape: false },
  ],
  search: [
    { position: 'top-left', size: 'sm', withTape: true, tapeRotation: '-6deg' },
  ],
};

export function isEasterCampaignActive(settings, now = new Date()) {
  const easter = settings?.seasonalCampaigns?.easter;
  if (!easter?.enabled) return false;

  if (easter.autoWindow) {
    const year = now.getFullYear();
    const easterDate = computeOrthodoxEaster(year);
    const start = new Date(easterDate);
    start.setDate(start.getDate() - 14);
    const end = new Date(easterDate);
    end.setDate(end.getDate() + 2);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  }

  if (easter.startAt && easter.endAt) {
    const start = new Date(easter.startAt);
    const end = new Date(easter.endAt);
    end.setHours(23, 59, 59, 999);
    return now >= start && now <= end;
  }

  return true;
}

export function shouldRenderDecorations(settings, now) {
  const easter = settings?.seasonalCampaigns?.easter;
  if (!easter?.enabled || !easter.decorationsEnabled) return false;
  return isEasterCampaignActive(settings, now);
}

export function resolveEasterVariants(settings) {
  const set = settings?.seasonalCampaigns?.easter?.variantSet || 'classic';
  return VARIANT_SETS[set] || VARIANT_SETS.classic;
}

export function getEggPlacements(pageId, settings) {
  const max = settings?.seasonalCampaigns?.easter?.maxVisibleEggs ?? 2;
  const slots = PAGE_SLOTS[pageId] || [];
  const variants = resolveEasterVariants(settings);
  return slots.slice(0, max).map((slot, i) => ({
    ...slot,
    variant: variants[i % variants.length],
  }));
}

export function isHuntActive(settings, now) {
  const easter = settings?.seasonalCampaigns?.easter;
  return Boolean(easter?.huntEnabled) && isEasterCampaignActive(settings, now);
}

export function getHuntEggId(pageId, index = 0) {
  return `egg-${pageId}${index > 0 ? `-${index}` : ''}`;
}

/**
 * Compute Orthodox Easter date using the Meeus Julian algorithm.
 * Returns a Date in the Gregorian calendar.
 */
export function computeOrthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);  // 3 = March, 4 = April
  const day = ((d + e + 114) % 31) + 1;

  // Julian calendar date — convert to Gregorian by adding 13 days (valid 1900–2099)
  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13);
  return julian;
}
