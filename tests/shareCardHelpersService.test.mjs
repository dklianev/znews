import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createShareCardHelpers } from '../server/services/shareCardHelpersService.js';

describe('shareCardHelpersService', () => {
  it('covers legacy scenarios', async () => {
      const helpers = createShareCardHelpers({
        normalizeText(value, maxLen = 255) {
          return String(value ?? '').trim().slice(0, maxLen);
        },
        sanitizeMediaUrl(value) {
          const text = String(value ?? '').trim();
          if (!text) return '';
          if (text.startsWith('/')) return text;
          if (/^https?:\/\//i.test(text)) return text;
          return '';
        },
        sanitizeShareAccent(value) {
          const normalized = String(value ?? '').trim().toLowerCase();
          return ['auto', 'red', 'orange', 'yellow', 'purple', 'blue', 'emerald'].includes(normalized)
            ? normalized
            : 'auto';
        },
        shareCardWidth: 1200,
        shareCardHeight: 630,
      });
    
      assert.equal(helpers.escapeHtml('<b>"test"</b>'), '&lt;b&gt;&quot;test&quot;&lt;/b&gt;');
      assert.equal(helpers.stripHtmlToText('<p>Hello <strong>world</strong></p>'), 'Hello world');
      assert.equal(helpers.clampText('breaking update from downtown', 12), 'breaking up...');
      assert.deepEqual(helpers.wrapTextLines('one two three four five six', 7, 2), ['one two', 'thre...']);
    
      assert.equal(helpers.getShareSourceUrl({ shareImage: '/uploads/share.png', image: '/uploads/fallback.png' }), '/uploads/share.png');
      assert.equal(helpers.getShareSourceUrl({ shareImage: 'bad', image: 'https://example.com/fallback.png' }), 'https://example.com/fallback.png');
      assert.equal(helpers.getShareSourceUrl({}), '');
    
      assert.deepEqual(helpers.resolveSharePalette({ shareAccent: 'auto', category: 'crime', breaking: false }), {
        primary: '#6d26ff',
        secondary: '#ff4b45',
        ink: '#25162f',
      });
      assert.deepEqual(helpers.resolveSharePalette({ shareAccent: 'blue', category: 'crime', breaking: true }), {
        primary: '#185dff',
        secondary: '#28b0ff',
        ink: '#25162f',
      });
    
      const model = helpers.buildShareCardModel({
        title: 'Very important update from downtown',
        excerpt: '<p>Extra context with <strong>markup</strong>.</p>',
        category: 'crime',
        date: '2026-03-11',
        breaking: true,
        shareAccent: 'auto',
      }, 'Crime');
    
      assert.equal(model.category, 'CRIME');
      assert.equal(model.dateLabel, '2026-03-11');
      assert.ok(model.titleLines.length >= 1);
      assert.ok(model.subtitleLines.length >= 1);
      assert.equal(model.palette.primary, '#ef1f1f');
    
      const svg = helpers.buildShareCardOverlaySvg({
        ...model,
        badgeWidth: 260,
        badgeHeight: 70,
        categoryChipWidth: 320,
      });
      assert.ok(svg.includes('width="1200" height="630"'));
      assert.ok(svg.includes(model.palette.primary));
      assert.ok(svg.includes('320'));
  });
});
