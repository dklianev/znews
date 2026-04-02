import { describe, expect, it } from 'vitest';

import { buildScaledClamp, normalizeHeroTitleScale } from '../../src/utils/heroTitleScale.js';

describe('heroTitleScale helpers', () => {
  it('normalizes scale inputs into the allowed range', () => {
    expect(normalizeHeroTitleScale(undefined)).toBe(100);
    expect(normalizeHeroTitleScale('abc')).toBe(100);
    expect(normalizeHeroTitleScale(50)).toBe(70);
    expect(normalizeHeroTitleScale(100)).toBe(100);
    expect(normalizeHeroTitleScale(180)).toBe(130);
  });

  it('builds a clamp string with the normalized ratio', () => {
    const scaled = buildScaledClamp('2rem', '5vw', '4rem', 85);
    expect(typeof scaled).toBe('string');
    expect(scaled).toContain('0.85');
  });
});
