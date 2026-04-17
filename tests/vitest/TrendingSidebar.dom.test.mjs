import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

let articlesState = [];

vi.mock('../../src/context/DataContext', () => ({
  useArticlesData: () => ({ articles: articlesState }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
}));

const { default: TrendingSidebar } = await import('../../src/components/TrendingSidebar.jsx');

describe('TrendingSidebar', () => {
  let container;
  let root;

  afterEach(async () => {
    articlesState = [];
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

  it('renders sorted articles without mutating the shared article pool', async () => {
    articlesState = [
      { id: 1, title: 'Първа новина', views: 10 },
      { id: 2, title: 'Втора новина', views: 90 },
      { id: 3, title: 'Трета новина', views: 30 },
    ];
    const originalOrder = articlesState.map((article) => article.id);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(TrendingSidebar));
      await Promise.resolve();
    });

    const renderedTitles = Array.from(container.querySelectorAll('h4')).map((node) => node.textContent?.trim());
    expect(renderedTitles.slice(0, 3)).toEqual(['Втора новина', 'Трета новина', 'Първа новина']);
    expect(articlesState.map((article) => article.id)).toEqual(originalOrder);
  });
});
