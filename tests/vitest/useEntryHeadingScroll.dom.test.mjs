import React, { createElement, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

let navigationTypeState = 'POP';

vi.mock('react-router-dom', () => ({
  useNavigationType: () => navigationTypeState,
}));

const { useEntryHeadingScroll } = await import('../../src/hooks/useEntryHeadingScroll.js');

function HeadingScrollProbe({ scrollKey }) {
  const headingRef = useRef(null);
  useEntryHeadingScroll(headingRef, scrollKey);
  return createElement('h1', { ref: headingRef }, 'Тестово заглавие');
}

describe('useEntryHeadingScroll', () => {
  let root;
  let container;
  let scrollIntoViewSpy;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  afterEach(async () => {
    navigationTypeState = 'POP';
    scrollIntoViewSpy?.mockRestore();
    scrollIntoViewSpy = null;
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

  it('scrolls the heading into view for new navigations', async () => {
    installAnimationFrameStub();
    navigationTypeState = 'PUSH';
    scrollIntoViewSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {});

    ({ root, container } = await renderIntoBody(HeadingScrollProbe, {
      scrollKey: 'ready:27',
    }));

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'start' });
  });

  it('does not override browser restoration on POP navigations', async () => {
    installAnimationFrameStub();
    navigationTypeState = 'POP';
    scrollIntoViewSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {});

    ({ root, container } = await renderIntoBody(HeadingScrollProbe, {
      scrollKey: 'ready:27',
    }));

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });
});
