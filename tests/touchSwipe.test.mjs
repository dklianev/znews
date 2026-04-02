import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { getSwipeDirection } from '../src/utils/touchSwipe.js';

describe('touchSwipe', () => {
  it('covers legacy scenarios', async () => {
      assert.equal(getSwipeDirection(null, { x: 0, y: 0 }), null, 'missing swipe start should return null');
      assert.equal(getSwipeDirection({ x: 10, y: 10 }, { x: 20, y: 20 }), null, 'small movements under the threshold should not count as swipes');
      assert.equal(getSwipeDirection({ x: 10, y: 10 }, { x: 70, y: 18 }), 'right', 'horizontal positive swipes should resolve to right');
      assert.equal(getSwipeDirection({ x: 70, y: 18 }, { x: 10, y: 20 }), 'left', 'horizontal negative swipes should resolve to left');
      assert.equal(getSwipeDirection({ x: 20, y: 20 }, { x: 24, y: 80 }), 'down', 'vertical positive swipes should resolve to down');
      assert.equal(getSwipeDirection({ x: 20, y: 80 }, { x: 24, y: 10 }), 'up', 'vertical negative swipes should resolve to up');
  });
});
