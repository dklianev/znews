import React, { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushEffects, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

let locationState = { pathname: '/' };
let navigationTypeState = 'POP';

vi.mock('motion/react', () => {
  function createMotionElement(tag) {
    return ({ children, animate, exit, initial, layout, layoutId, transition, whileHover, whileTap, ...props }) =>
      createElement(tag, props, children);
  }

  return {
    motion: new Proxy({}, { get: (_target, tag) => createMotionElement(tag) }),
    AnimatePresence: ({ children }) => createElement(React.Fragment, null, children),
  };
});

vi.mock('react-router-dom', () => ({
  useLocation: () => locationState,
  useNavigationType: () => navigationTypeState,
}));

const { default: ScrollToTop } = await import('../../src/components/ScrollToTop.jsx');

describe('ScrollToTop', () => {
  let root;
  let container;
  let scrollToSpy;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  afterEach(async () => {
    locationState = { pathname: '/' };
    navigationTypeState = 'POP';
    scrollToSpy?.mockRestore();
    scrollToSpy = null;
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
    if (originalCancelAnimationFrame) {
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  function installAnimationFrameStub() {
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      callback(0);
      return 1;
    };
    window.cancelAnimationFrame = () => {};
  }

  async function rerender() {
    await act(async () => {
      root.render(createElement(ScrollToTop));
      await flushEffects();
    });
  }

  it('scrolls to the top on new route pushes', async () => {
    installAnimationFrameStub();
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    ({ root, container } = await renderIntoBody(ScrollToTop));

    locationState = { pathname: '/search' };
    navigationTypeState = 'PUSH';
    await rerender();

    expect(scrollToSpy).toHaveBeenCalledWith({ left: 0, top: 0 });
  });

  it('keeps browser restoration intact on POP navigation', async () => {
    installAnimationFrameStub();
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    ({ root, container } = await renderIntoBody(ScrollToTop));

    locationState = { pathname: '/article/27' };
    navigationTypeState = 'POP';
    await rerender();

    expect(scrollToSpy).not.toHaveBeenCalledWith({ left: 0, top: 0 });
  });
});
