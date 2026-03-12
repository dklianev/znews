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
  assert.equal(helpers.sanitizeImageAlt('Promo card'), 'Promo card');
  assert.equal(helpers.sanitizeImageAlt('1773099819155-967896.webp'), '');
  assert.equal(helpers.sanitizeImageAlt('poster-final.png'), '');

  assert.deepEqual(helpers.sanitizeTags('one, two , ,three'), ['one', 'two', 'three']);
  assert.deepEqual(helpers.sanitizeTags(['alpha', ' beta ', '', 'gamma']), ['alpha', 'beta', 'gamma']);

  assert.equal(
    helpers.sanitizeSafeHtml('<p onclick="evil()" style="color:red">Hi</p><script>alert(1)</script>'),
    '<p>Hi</p>'
  );
  assert.equal(
    helpers.sanitizeSafeHtml('<a href="javascript:alert(1)">Bad</a><a href="https://example.com?q=1&x=2">Good</a>'),
    '<a>Bad</a><a href="https://example.com/?q=1&amp;x=2" target="_blank" rel="noopener noreferrer">Good</a>'
  );
  assert.equal(
    helpers.sanitizeSafeHtml('<img src="/uploads/pic.jpg" alt="Promo card" data-width="75" data-align="RIGHT" onload="x()">'),
    '<img src="/uploads/pic.jpg" alt="Promo card" loading="lazy" decoding="async" fetchpriority="low" data-width="75" data-align="right">'
  );
  assert.equal(
    helpers.sanitizeSafeHtml('<img src="/uploads/pic.jpg" alt="1773099819155-967896.webp">'),
    '<img src="/uploads/pic.jpg" alt="" loading="lazy" decoding="async" fetchpriority="low" data-width="100" data-align="center">'
  );
}
