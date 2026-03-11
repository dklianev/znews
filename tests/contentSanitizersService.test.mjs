import assert from 'node:assert/strict';
import { createContentSanitizers } from '../server/services/contentSanitizersService.js';

export async function runContentSanitizersTests() {
  const helpers = createContentSanitizers();

  assert.equal(helpers.normalizeText('  hello  ', 10), 'hello');
  assert.equal(helpers.normalizeText(null, 10), '');

  assert.equal(helpers.sanitizeDate('2026-03-11'), '2026-03-11');
  assert.match(helpers.sanitizeDate('bad-date'), /^\d{4}-\d{2}-\d{2}$/);

  assert.equal(helpers.sanitizeDateTime(null), null);
  assert.equal(helpers.sanitizeDateTime('bad-date'), null);
  assert.equal(helpers.sanitizeDateTime('2026-03-11T12:30:00.000Z')?.toISOString(), '2026-03-11T12:30:00.000Z');

  assert.equal(helpers.sanitizeMediaUrl('/uploads/image.jpg'), '/uploads/image.jpg');
  assert.equal(helpers.sanitizeMediaUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(helpers.sanitizeMediaUrl('javascript:alert(1)'), '');

  assert.equal(helpers.sanitizeExternalUrl('https://example.com'), 'https://example.com/');
  assert.equal(helpers.sanitizeExternalUrl('#'), '#');
  assert.equal(helpers.sanitizeExternalUrl('ftp://example.com'), '#');

  assert.equal(helpers.sanitizeImageWidth('75%'), '75');
  assert.equal(helpers.sanitizeImageWidth('13'), '100');

  assert.equal(helpers.sanitizeImageAlign('LEFT'), 'left');
  assert.equal(helpers.sanitizeImageAlign('weird'), 'center');

  assert.deepEqual(helpers.sanitizeTags('one, two , ,three'), ['one', 'two', 'three']);
  assert.deepEqual(helpers.sanitizeTags(['alpha', ' beta ', '', 'gamma']), ['alpha', 'beta', 'gamma']);
}
