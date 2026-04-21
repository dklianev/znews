import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, className, style }) => createElement('div', { className, style }, children),
  },
}));

const { AdBannerHorizontal } = await import('../../src/components/AdBanner.jsx');

describe('AdBanner', () => {
  let root;
  let container;

  afterEach(async () => {
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('renders cover creatives through responsive image variants', async () => {
    ({ root, container } = await renderIntoBody(AdBannerHorizontal, {
      viewport: 'desktop',
      ad: {
        id: 901,
        title: 'Тестова реклама',
        subtitle: 'Проверка',
        type: 'horizontal',
        placements: ['home.top'],
        link: '#',
        clickable: false,
        showButton: false,
        showTitle: false,
        imagePlacement: 'cover',
        image: 'https://znewsmedia01.blob.core.windows.net/uploads/ad-original.webp',
        imageMeta: {
          width: 1200,
          height: 300,
          placeholder: 'https://znewsmedia01.blob.core.windows.net/uploads/_variants/ad/blur.webp',
          webp: [
            { width: 640, url: 'https://znewsmedia01.blob.core.windows.net/uploads/_variants/ad/w640.webp' },
            { width: 960, url: 'https://znewsmedia01.blob.core.windows.net/uploads/_variants/ad/w960.webp' },
          ],
          avif: [
            { width: 640, url: 'https://znewsmedia01.blob.core.windows.net/uploads/_variants/ad/w640.avif' },
            { width: 960, url: 'https://znewsmedia01.blob.core.windows.net/uploads/_variants/ad/w960.avif' },
          ],
          objectPosition: '42% 55%',
          objectScale: 1.12,
        },
      },
    }));

    const banner = container.querySelector('.ad-banner-horizontal');
    expect(banner).toBeTruthy();
    expect(container.textContent).toContain('РЕКЛАМА');

    const avifSource = container.querySelector('source[type="image/avif"]');
    expect(avifSource?.getAttribute('srcset')).toContain('/w640.avif 640w');
    expect(avifSource?.getAttribute('sizes')).toBe('(max-width: 767px) 100vw, 1100px');

    const image = container.querySelector('picture img');
    expect(image?.style.objectPosition).toBe('42% 55%');
    expect(image?.style.transform).toBe('scale(1.12)');
  });
});
