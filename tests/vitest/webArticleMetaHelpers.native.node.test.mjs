import { describe, expect, it } from 'vitest';

import { createWebArticleMetaHelpers } from '../../server/services/webArticleMetaHelpersService.js';

describe('web article meta helpers', () => {
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

  it('detects bot user agents safely', () => {
    expect(helpers.isBotUserAgent({ headers: { 'user-agent': 'DiscordBot/1.0' } })).toBe(true);
    expect(helpers.isBotUserAgent({ headers: { 'user-agent': 'Mozilla/5.0 Safari' } })).toBe(false);
    expect(helpers.isBotUserAgent({ headers: {} })).toBe(false);
  });

  it('builds article meta and renders bot/share html with canonical urls', () => {
    const meta = helpers.buildArticleMeta({
      article: {
        title: 'Breaking <Update>',
        excerpt: '<p>Extra <strong>details</strong> from downtown.</p>',
      },
      baseUrl: 'https://znews.live',
      id: 42,
    });

    expect(meta.articleUrl).toBe('https://znews.live/article/42');
    expect(meta.shareUrl).toBe('https://znews.live/share/article/42');
    expect(meta.shareImageUrl).toBe('https://znews.live/api/articles/42/share.png');
    expect(meta.safeTitle).toBe('Breaking &lt;Update&gt;');
    expect(meta.description).toBe('Extra details from downtown.');

    const botHtml = helpers.renderBotArticleHtml(meta);
    expect(botHtml).toContain('<meta property="og:image:width" content="1200" />');
    expect(botHtml).toContain('<meta property="og:image:height" content="630" />');
    expect(botHtml).toContain('https://znews.live/api/articles/42/share.png');
    expect(botHtml).toContain('<link rel="canonical" href="https://znews.live/article/42" />');

    const shareHtml = helpers.renderShareArticleHtml(meta);
    expect(shareHtml).toContain('<meta property="og:url" content="https://znews.live/share/article/42" />');
    expect(shareHtml).toContain('<meta http-equiv="refresh" content="0;url=/article/42" />');
    expect(shareHtml).toContain('window.location.replace("/article/42")');
  });
});
