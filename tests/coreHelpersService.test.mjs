import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createCoreHelpers } from '../server/services/coreHelpersService.js';

describe('coreHelpersService', () => {
  it('keeps coreHelpersService legacy coverage green', async () => {
      const devHelpers = createCoreHelpers({ isProd: false });
      const prodHelpers = createCoreHelpers({ isProd: true });
      const now = new Date('2026-03-11T12:00:00.000Z');
    
      assert.equal(devHelpers.publicError(new Error('boom')), 'boom');
      assert.equal(prodHelpers.publicError(new Error('boom')), 'Server error');
      assert.equal(prodHelpers.publicError(new Error('boom'), 'Fallback'), 'Fallback');
    
      assert.equal(devHelpers.parseDurationToMs('', 5000), 5000);
      assert.equal(devHelpers.parseDurationToMs('45', 5000), 45);
      assert.equal(devHelpers.parseDurationToMs('15m', 5000), 15 * 60 * 1000);
      assert.equal(devHelpers.parseDurationToMs('2h', 5000), 2 * 60 * 60 * 1000);
      assert.equal(devHelpers.parseDurationToMs('bad', 5000), 5000);
    
      assert.deepEqual(devHelpers.getPublishedFilter(now), {
        $and: [
          { status: { $ne: 'archived' } },
          { $or: [{ status: 'published' }, { status: { $exists: false } }] },
          { $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }] },
        ],
      });
    
      assert.equal(devHelpers.parsePositiveInt('25', 10, { min: 1, max: 30 }), 25);
      assert.equal(devHelpers.parsePositiveInt('0', 10, { min: 1, max: 30 }), 1);
      assert.equal(devHelpers.parsePositiveInt('100', 10, { min: 1, max: 30 }), 30);
      assert.equal(devHelpers.parsePositiveInt('oops', 10, { min: 1, max: 30 }), 10);
    
      assert.equal(devHelpers.escapeRegexForSearch('crime.*(test)?'), 'crime\\.\\*\\(test\\)\\?');
  });
});
