export const IMAGE_SIZES = Object.freeze({
  HERO_PRIMARY: '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 50vw, 50vw',
  HERO_SECONDARY: '(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 50vw, 50vw',
  HERO_TERTIARY: '(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) 50vw, 42vw',
  FEATURED_CARD: '(max-width: 639px) calc(100vw - 56px), (max-width: 1023px) 46vw, 31vw',
  STANDARD_CARD: '(max-width: 639px) calc(100vw - 72px), (max-width: 1023px) 46vw, 32vw',
  COMPACT_CARD: '(max-width: 639px) calc(100vw - 72px), (max-width: 1023px) 46vw, 24vw',
  HORIZONTAL_CARD: '(max-width: 639px) calc(100vw - 80px), 320px',
  LATEST_FULL: '(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) 92vw, 56vw',
  LATEST_TWO_THIRDS: '(max-width: 639px) calc(100vw - 56px), (max-width: 1023px) 62vw, 38vw',
  LATEST_HALF: '(max-width: 639px) calc(100vw - 64px), (max-width: 1023px) 48vw, 29vw',
  LATEST_THIRD: '(max-width: 639px) calc(100vw - 72px), (max-width: 1023px) 32vw, 20vw',
});

export function getLatestWallImageSizes(mdCols) {
  switch (Number(mdCols)) {
    case 12:
      return IMAGE_SIZES.LATEST_FULL;
    case 8:
      return IMAGE_SIZES.LATEST_TWO_THIRDS;
    case 6:
      return IMAGE_SIZES.LATEST_HALF;
    case 4:
      return IMAGE_SIZES.LATEST_THIRD;
    default:
      return IMAGE_SIZES.LATEST_HALF;
  }
}
