import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { formatNewsDate } from '../src/utils/newsDate.js';

describe('newsDate', () => {
  it('covers legacy scenarios', async () => {
      assert.equal(formatNewsDate('2026-03-09'), '9 март 2026');
      assert.equal(formatNewsDate('2026-03-09T22:30:00Z'), '10 март 2026');
      assert.equal(formatNewsDate('invalid-date'), 'invalid-date');
      assert.equal(formatNewsDate(''), '');
  });
});
