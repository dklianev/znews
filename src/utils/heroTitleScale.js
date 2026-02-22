export const HERO_TITLE_SCALE_MIN = 70;
export const HERO_TITLE_SCALE_MAX = 130;
export const HERO_TITLE_SCALE_DEFAULT = 100;

export function normalizeHeroTitleScale(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return HERO_TITLE_SCALE_DEFAULT;
  return Math.min(HERO_TITLE_SCALE_MAX, Math.max(HERO_TITLE_SCALE_MIN, parsed));
}

export function buildScaledClamp(minSize, fluidSize, maxSize, scalePercent) {
  const normalizedScale = normalizeHeroTitleScale(scalePercent);
  const ratio = (normalizedScale / 100).toFixed(2);
  return `clamp(calc(${minSize} * ${ratio}), calc(${fluidSize} * ${ratio}), calc(${maxSize} * ${ratio}))`;
}
