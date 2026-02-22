import assert from 'node:assert/strict';

import { buildScaledClamp, normalizeHeroTitleScale } from '../src/utils/heroTitleScale.js';

export function runHeroTitleScaleTests() {
  assert.equal(normalizeHeroTitleScale(undefined), 100);
  assert.equal(normalizeHeroTitleScale('abc'), 100);
  assert.equal(normalizeHeroTitleScale(50), 70);
  assert.equal(normalizeHeroTitleScale(100), 100);
  assert.equal(normalizeHeroTitleScale(180), 130);

  const scaled = buildScaledClamp('2rem', '5vw', '4rem', 85);
  assert.ok(typeof scaled === 'string' && scaled.includes('0.85'));
}
