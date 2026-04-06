import React, { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushEffects, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

let locationState = { pathname: '/', search: '', hash: '', key: 'home' };
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
  let hashTarget;
  let hashScrollSpy;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    window.sessionStorage.clear();
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  afterEach(async () => {
    locationState = { pathname: '/', search: '', hash: '', key: 'home' };
    navigationTypeState = 'POP';
    vi.useRealTimers();
    scrollToSpy?.mockRestore();
    scrollToSpy = null;
    hashScrollSpy?.mockRestore();
    hashScrollSpy = null;
    hashTarget?.remove();
    hashTarget = null;
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

  function installScrollSpy() {
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation((arg1, arg2) => {
      const top = typeof arg1 === 'object' ? arg1?.top : arg2;
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        writable: true,
        value: Number(top) || 0,
      });
    });
  }

  function installHashTarget(id = 'contact') {
    hashTarget = document.createElement('section');
    hashTarget.id = id;
    hashTarget.textContent = 'target';
    hashScrollSpy = vi.spyOn(hashTarget, 'scrollIntoView').mockImplementation(() => {});
    document.body.appendChild(hashTarget);
  }

  async function rerender() {
    await act(async () => {
      root.render(createElement(ScrollToTop));
      await flushEffects();
    });
  }

  it('scrolls to the top on new route pushes', async () => {
    installAnimationFrameStub();
    installScrollSpy();

    ({ root, container } = await renderIntoBody(ScrollToTop));

    locationState = { pathname: '/search', search: '', hash: '', key: 'search-1' };
    navigationTypeState = 'PUSH';
    await rerender();

    expect(scrollToSpy).toHaveBeenCalledWith({ left: 0, top: 0 });
  });

  it('restores the saved scroll position on POP navigation', async () => {
    installAnimationFrameStub();
    installScrollSpy();
    window.sessionStorage.setItem('zn-scroll:article-1', '640');

    ({ root, container } = await renderIntoBody(ScrollToTop));

    locationState = { pathname: '/article/27', search: '', hash: '', key: 'article-1' };
    navigationTypeState = 'POP';
    await rerender();

    expect(scrollToSpy).toHaveBeenCalledWith(0, 640);
  });

  it('keeps retrying POP restoration until the saved position becomes reachable', async () => {
    installAnimationFrameStub();
    vi.useFakeTimers();
    window.sessionStorage.setItem('zn-scroll:article-1', '640');

    let restoreAttempts = 0;
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation((arg1, arg2) => {
      const top = typeof arg1 === 'object' ? arg1?.top : arg2;
      restoreAttempts += 1;
      Object.defineProperty(window, 'scrollY', {
        configurable: true,
        writable: true,
        value: restoreAttempts < 3 ? 220 : Number(top) || 0,
      });
    });

    ({ root, container } = await renderIntoBody(ScrollToTop));

    locationState = { pathname: '/article/27', search: '', hash: '', key: 'article-1' };
    navigationTypeState = 'POP';
    await rerender();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(260);
      await flushEffects();
    });

    expect(restoreAttempts).toBeGreaterThanOrEqual(3);
    expect(window.scrollY).toBe(640);
  });

  it('stores the current scroll position before navigating away', async () => {
    installAnimationFrameStub();
    installScrollSpy();
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 420,
    });

    ({ root, container } = await renderIntoBody(ScrollToTop));

    locationState = { pathname: '/about', search: '', hash: '', key: 'about-1' };
    navigationTypeState = 'PUSH';
    await rerender();

    expect(window.sessionStorage.getItem('zn-scroll:home')).toBe('420');
  });

  it('aligns new hash navigations to the matching anchor target', async () => {
    installAnimationFrameStub();
    installScrollSpy();
    installHashTarget('contact');

    ({ root, container } = await renderIntoBody(ScrollToTop));

    locationState = { pathname: '/about', search: '', hash: '#contact', key: 'about-contact' };
    navigationTypeState = 'PUSH';
    await rerender();

    expect(hashScrollSpy).toHaveBeenCalledWith({ block: 'start' });
    expect(scrollToSpy).not.toHaveBeenCalledWith({ left: 0, top: 0 });
  });

});
