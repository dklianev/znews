import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { getComicCardStyle } from '../src/utils/comicCardDesign.js';

describe('comicCardDesign', () => {
  it('covers legacy scenarios', async () => {
      const article = { id: 42, cardSticker: '' };
      const first = getComicCardStyle('homeFeatured', 0, article, 'default');
      const second = getComicCardStyle('homeFeatured', 0, article, 'default');
    
      assert.deepEqual(second, first);
      const style = getComicCardStyle('homeFeatured', 0, { id: 7, cardSticker: 'Моят етикет' }, 'default');
      assert.equal(style.sticker, 'Моят етикет');
      const baseline = getComicCardStyle('homeCrime', 2, { id: 99 }, 'default');
      const unknownPreset = getComicCardStyle('homeCrime', 2, { id: 99 }, 'does-not-exist');
    
      assert.deepEqual(unknownPreset, baseline);
  });
});
