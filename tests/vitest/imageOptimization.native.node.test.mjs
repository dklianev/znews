import { describe, expect, it } from 'vitest';

import { getIntrinsicImageDimensions, getOptimizedImageSources, normalizeMediaResourceUrl } from '../../src/utils/imageOptimization.js';

describe('image optimization helpers', () => {
  it('derives intrinsic dimensions safely from metadata', () => {
    expect(
      getIntrinsicImageDimensions({ width: 1280, height: 720, placeholder: '/uploads/x.webp' }),
    ).toEqual({ width: 1280, height: 720 });

    expect(getIntrinsicImageDimensions({ width: 'bad', height: 480 })).toEqual({
      width: undefined,
      height: 480,
    });

    expect(getIntrinsicImageDimensions(null)).toEqual({
      width: undefined,
      height: undefined,
    });
  });

  it('builds optimized remote image sources and leaves local uploads untouched', () => {
    const optimized = getOptimizedImageSources('https://images.unsplash.com/photo-1', {
      widths: [320, 640],
      quality: 70,
    });
    expect(optimized.src).toMatch(/w=640/);
    expect(optimized.srcSet).toMatch(/320w/);
    expect(optimized.webpSrcSet).toMatch(/fm=webp/);

    expect(getOptimizedImageSources('/uploads/local.jpg')).toEqual({
      src: '/uploads/local.jpg',
      srcSet: '',
      webpSrcSet: '',
    });
  });

  it('collapses duplicated uploads path segments in media URLs', () => {
    expect(
      normalizeMediaResourceUrl('https://znewsmedia01.blob.core.windows.net/uploads/uploads/_variants/x/w640.avif'),
    ).toBe('https://znewsmedia01.blob.core.windows.net/uploads/_variants/x/w640.avif');
    expect(normalizeMediaResourceUrl('/uploads/uploads/uploads/photo.webp')).toBe('/uploads/photo.webp');
  });
});
