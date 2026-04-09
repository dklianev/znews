import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import YouTubeEmbed from '../../src/components/YouTubeEmbed.jsx';

describe('YouTubeEmbed', () => {
  let container;
  let root;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
    root = null;
    container = null;
  });

  it('renders Bulgarian accessibility copy in the default player state', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(YouTubeEmbed, {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Тестово видео',
      }));
    });

    const playButton = container.querySelector('button[aria-label]');
    const previewImage = container.querySelector('img');

    expect(playButton?.getAttribute('aria-label')).toBe('Пусни видеото Тестово видео');
    expect(previewImage?.getAttribute('alt')).toBe('Миниатюра на видеото Тестово видео');
  });
});
