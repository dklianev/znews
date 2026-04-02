import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createWebArticleMetaHelpers } from '../server/services/webArticleMetaHelpersService.js';

describe('webArticleMetaHelpersService', () => {
  it('covers legacy scenarios', async () => {
      const helpers = createWebArticleMetaHelpers({
        clampText(value, maxLen) {
          const text = String(value ?? '').trim();
          if (text.length <= maxLen) return text;
          return `${text.slice(0, Math.max(0, maxLen - 1)).trim()}...`;
        },
        escapeHtml(value) {
          return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        },
        shareCardHeight: 630,
        shareCardWidth: 1200,
        stripHtmlToText(value) {
          return String(value ?? '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        },
      });
    
      assert.equal(helpers.isBotUserAgent({ headers: { 'user-agent': 'DiscordBot/1.0' } }), true);
      assert.equal(helpers.isBotUserAgent({ headers: { 'user-agent': 'Mozilla/5.0 Safari' } }), false);
      assert.equal(helpers.isBotUserAgent({ headers: {} }), false);
    
      const meta = helpers.buildArticleMeta({
        article: {
          title: 'Breaking <Update>',
          excerpt: '<p>Extra <strong>details</strong> from downtown.</p>',
        },
        baseUrl: 'https://znews.live',
        id: 42,
      });
    
      assert.equal(meta.articleUrl, 'https://znews.live/article/42');
      assert.equal(meta.shareUrl, 'https://znews.live/share/article/42');
      assert.equal(meta.shareImageUrl, 'https://znews.live/api/articles/42/share.png');
      assert.equal(meta.safeTitle, 'Breaking &lt;Update&gt;');
      assert.equal(meta.description, 'Extra details from downtown.');
    
      const botHtml = helpers.renderBotArticleHtml(meta);
      assert.ok(botHtml.includes('<meta property="og:image:width" content="1200" />'));
      assert.ok(botHtml.includes('<meta property="og:image:height" content="630" />'));
      assert.ok(botHtml.includes('https://znews.live/api/articles/42/share.png'));
      assert.ok(botHtml.includes('<link rel="canonical" href="https://znews.live/article/42" />'));
    
      const shareHtml = helpers.renderShareArticleHtml(meta);
      assert.ok(shareHtml.includes('<meta property="og:url" content="https://znews.live/share/article/42" />'));
      assert.ok(shareHtml.includes('<meta http-equiv="refresh" content="0;url=/article/42" />'));
      assert.ok(shareHtml.includes('window.location.replace("/article/42")'));
  });
});
