import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createContentSharedHelpers } from '../server/services/contentSharedHelpersService.js';

describe('contentSharedHelpersService', () => {
  it('covers legacy scenarios', async () => {
      const helpers = createContentSharedHelpers({
        normalizeText(value, maxLen = 255) {
          return String(value ?? '').trim().slice(0, maxLen);
        },
      });
    
      assert.equal(helpers.sanitizeShareAccent(' purple '), 'purple');
      assert.equal(helpers.sanitizeShareAccent('LOUD'), 'auto');
      assert.equal(helpers.sanitizeShareAccent(null), 'auto');
    
      assert.equal(helpers.snapshotsEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }), true);
      assert.equal(helpers.snapshotsEqual({ a: 1 }, { a: 2 }), false);
    
      const circular = {};
      circular.self = circular;
      assert.equal(helpers.snapshotsEqual(circular, circular), false);
  });
});
