import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const loadVipClassifieds = vi.fn(async () => []);
let publicDataState = {};

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => publicDataState,
  usePublicSectionsData: () => ({
    vipClassifieds: publicDataState.vipClassifieds,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
}));

const { default: VipClassifiedsWidget } = await import('../../src/components/VipClassifiedsWidget.jsx');

describe('VipClassifiedsWidget', () => {
  let root;
  let container;

  afterEach(async () => {
    loadVipClassifieds.mockClear();
    publicDataState = {};
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('renders directly from context data without triggering a fetch on mount', async () => {
    publicDataState = {
      vipClassifieds: [
        { id: 44, title: 'Луксозен апартамент', price: '25 000', images: [] },
      ],
      loadVipClassifieds,
    };

    ({ root, container } = await renderIntoBody(VipClassifiedsWidget));

    expect(loadVipClassifieds).not.toHaveBeenCalled();
    expect(container.textContent).toContain('VIP Обяви');
    expect(container.textContent).toContain('Луксозен апартамент');
    expect(container.querySelector('a[href="/obiavi/44"]')).not.toBeNull();
  });
});
