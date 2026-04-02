import { describe, expect, it } from 'vitest';

import { getSwipeDirection } from '../../src/utils/touchSwipe.js';

describe('touchSwipe helpers', () => {
  it('returns null when the swipe payload is incomplete or too small', () => {
    expect(getSwipeDirection(null, { x: 0, y: 0 })).toBeNull();
    expect(getSwipeDirection({ x: 10, y: 10 }, { x: 20, y: 20 })).toBeNull();
    expect(getSwipeDirection({ x: 'left', y: 0 }, { x: 30, y: 0 })).toBeNull();
  });

  it('resolves dominant horizontal and vertical directions', () => {
    expect(getSwipeDirection({ x: 10, y: 10 }, { x: 70, y: 18 })).toBe('right');
    expect(getSwipeDirection({ x: 70, y: 18 }, { x: 10, y: 20 })).toBe('left');
    expect(getSwipeDirection({ x: 20, y: 20 }, { x: 24, y: 80 })).toBe('down');
    expect(getSwipeDirection({ x: 20, y: 80 }, { x: 24, y: 10 })).toBe('up');
  });
});
