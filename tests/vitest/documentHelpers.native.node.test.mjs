import { describe, expect, it } from 'vitest';

import { createDocumentHelpers } from '../../server/services/documentHelpersService.js';

describe('document helpers', () => {
  it('strips mongoose metadata without mutating the original object', () => {
    const helpers = createDocumentHelpers();
    const source = { _id: 'abc', __v: 7, id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' };

    const stripped = helpers.stripDocumentMetadata(source);
    expect(stripped).toEqual({ id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' });
    expect(source).toEqual({ _id: 'abc', __v: 7, id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' });
  });

  it('handles document lists and export cleanup helpers', () => {
    const helpers = createDocumentHelpers();
    const source = { _id: 'abc', __v: 7, id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' };

    expect(helpers.stripDocumentList([source, null, 'x'])).toEqual([
      { id: 5, title: 'Hello', nested: { ok: true }, password: 'secret' },
      null,
      'x',
    ]);
    expect(helpers.stripDocumentList(null)).toEqual([]);
    expect(helpers.cleanExportItem(source)).toEqual({ id: 5, title: 'Hello', nested: { ok: true } });
    expect(helpers.stripDocumentMetadata(null)).toBeNull();
    expect(helpers.cleanExportItem('nope')).toBe('nope');
  });
});
