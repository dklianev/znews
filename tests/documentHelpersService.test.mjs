import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createDocumentHelpers } from '../server/services/documentHelpersService.js';

describe('documentHelpersService', () => {
  it('keeps documentHelpersService legacy coverage green', async () => {
      const helpers = createDocumentHelpers();
    
      const source = { _id: 'abc', __v: 7, id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' };
      const stripped = helpers.stripDocumentMetadata(source);
      assert.deepEqual(stripped, { id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' });
      assert.deepEqual(source, { _id: 'abc', __v: 7, id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' });
    
      assert.deepEqual(helpers.stripDocumentList([source, null, 'x']), [
        { id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' },
        null,
        'x',
      ]);
      assert.deepEqual(helpers.stripDocumentList(null), []);
    
      const cleaned = helpers.cleanExportItem(source);
      assert.deepEqual(cleaned, { id: 5, title: 'Hello', nested: { ok: true } });
    
      assert.equal(helpers.stripDocumentMetadata(null), null);
      assert.equal(helpers.cleanExportItem('nope'), 'nope');
  });
});
