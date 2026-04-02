import { describe, expect, it } from 'vitest';

import { getComicCardStyle } from '../../src/utils/comicCardDesign.js';

describe('comicCardDesign helpers', () => {
  it('returns deterministic output for the same article and preset', () => {
    const article = { id: 42, cardSticker: '' };
    const first = getComicCardStyle('homeFeatured', 0, article, 'default');
    const second = getComicCardStyle('homeFeatured', 0, article, 'default');

    expect(second).toEqual(first);
  });

  it('preserves explicit article stickers and falls back for unknown presets', () => {
    const style = getComicCardStyle('homeFeatured', 0, { id: 7, cardSticker: 'Мега новина' }, 'default');
    const baseline = getComicCardStyle('homeCrime', 2, { id: 99 }, 'default');
    const unknownPreset = getComicCardStyle('homeCrime', 2, { id: 99 }, 'does-not-exist');

    expect(style.sticker).toBe('Мега новина');
    expect(unknownPreset).toEqual(baseline);
  });
});
