import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { getIntrinsicImageDimensions, getOptimizedImageSources, normalizeMediaResourceUrl } from '../src/utils/imageOptimization.js';

describe('imageOptimization', () => {
  it('keeps imageOptimization legacy coverage green', async () => {
      assert.deepEqual(
        getIntrinsicImageDimensions({ width: 1280, height: 720, placeholder: '/uploads/x.webp' }),
        { width: 1280, height: 720 }
      );
    
      assert.deepEqual(
        getIntrinsicImageDimensions({ width: 'bad', height: 480 }),
        { width: undefined, height: 480 }
      );
    
      assert.deepEqual(
        getIntrinsicImageDimensions(null),
        { width: undefined, height: undefined }
      );
    
      const optimized = getOptimizedImageSources('https://images.unsplash.com/photo-1', {
        widths: [320, 640],
        quality: 70,
      });
      assert.match(optimized.src, /w=640/);
      assert.match(optimized.srcSet, /320w/);
      assert.match(optimized.webpSrcSet, /fm=webp/);
    
      const untouched = getOptimizedImageSources('/uploads/local.jpg');
      assert.deepEqual(untouched, { src: '/uploads/local.jpg', srcSet: '', webpSrcSet: '' });

      assert.equal(
        normalizeMediaResourceUrl('https://znewsmedia01.blob.core.windows.net/uploads/uploads/_variants/x/w640.avif'),
        'https://znewsmedia01.blob.core.windows.net/uploads/_variants/x/w640.avif'
      );
      assert.equal(normalizeMediaResourceUrl('/uploads/uploads/uploads/photo.webp'), '/uploads/photo.webp');
  });
});
