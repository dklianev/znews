import { describe, expect, it } from 'vitest';

import { formatNewsDate } from '../../src/utils/newsDate.js';

describe('newsDate helper', () => {
  it('formats valid dates and preserves invalid inputs safely', () => {
    expect(formatNewsDate('2026-03-09')).toBe('9 март 2026');
    expect(formatNewsDate('2026-03-09T22:30:00Z')).toBe('10 март 2026');
    expect(formatNewsDate('invalid-date')).toBe('invalid-date');
    expect(formatNewsDate('')).toBe('');
  });
});
