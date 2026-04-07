import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { click, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

vi.mock('motion/react', () => {
  function createMotionElement(tag) {
    return ({ children, animate, exit, initial, transition, ...props }) =>
      createElement(tag, props, children);
  }

  return {
    motion: new Proxy({}, { get: (_target, tag) => createMotionElement(tag) }),
    AnimatePresence: ({ children }) => createElement(React.Fragment, null, children),
  };
});

vi.mock('../../src/components/seasonal/EasterEgg.jsx', () => ({
  default: ({ variant, size, className }) =>
    createElement('div', {
      className,
      'data-testid': 'egg',
      'data-variant': variant,
      'data-size': size,
    }),
}));

const { default: CollectibleEasterEgg } = await import('../../src/components/seasonal/CollectibleEasterEgg.jsx');

describe('CollectibleEasterEgg', () => {
  let root;
  let container;

  afterEach(async () => {
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('shows Bulgarian collect labels and feedback without stray glyphs', async () => {
    const onCollect = vi.fn();
    ({ root, container } = await renderIntoBody(CollectibleEasterEgg, {
      eggId: 'egg-homepage',
      isCollected: false,
      onCollect,
    }));

    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Събери това великденско яйце');

    await click(button);

    expect(onCollect).toHaveBeenCalledWith('egg-homepage');
    expect(container.textContent).toContain('✓');
    expect(container.textContent).not.toContain('û');
  });

  it('exposes the collected state label when the egg is already found', async () => {
    ({ root, container } = await renderIntoBody(CollectibleEasterEgg, {
      eggId: 'egg-homepage',
      isCollected: true,
      onCollect: vi.fn(),
    }));

    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Яйцето е събрано');
    expect(button?.disabled).toBe(true);
  });
});
