import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createShareCardRuntimeHelpers } from '../server/services/shareCardRuntimeService.js';

function createBaseDeps(overrides = {}) {
  return {
    brandLogoPng: null,
    buildShareCardModel() {
      return {
        badge: 'EXCLUSIVE',
        badgeFontSize: 40,
        badgeWidth: 260,
        badgeHeight: 70,
        titleLines: ['TITLE'],
        subtitleLines: ['Subtitle'],
        titleFontSize: 72,
        subtitleFontSize: 30,
        category: 'CRIME',
        categoryFontSize: 40,
        categoryChipWidth: 320,
        dateLabel: '2026-03-11',
        palette: { primary: '#ef1f1f', ink: '#25162f' },
      };
    },
    buildShareCardOverlaySvg() {
      return '<svg />';
    },
    buildShareCardStorageTarget() {
      return {
        absolutePath: 'C:/uploads/_share/card.png',
        fileName: 'article-15-signature.png',
        normalized: {
          id: 15,
          title: 'Existing card',
          category: 'crime',
          date: '2026-03-11',
        },
        relativePath: '_share/article-15-signature.png',
        url: '/uploads/_share/article-15-signature.png',
      };
    },
    cleanupOldShareCards: async () => {},
    hasShareCardObject: async () => false,
    loadSharp: async () => ({ metadata: async () => ({ width: 0, height: 0 }) }),
    normalizeText(value, maxLen = 255) {
      return String(value ?? '').trim().slice(0, maxLen);
    },
    persistShareCardObject: async () => {},
    renderTextImage: async () => null,
    resolveShareBackgroundInput: async () => null,
    resolveShareFallbackSource: async () => null,
    resolveSharePalette() {
      return { primary: '#ef1f1f' };
    },
    shareCardHeight: 630,
    shareCardWidth: 1200,
    ...overrides,
  };
}

describe('shareCardRuntimeService', () => {
  it('keeps shareCardRuntimeService legacy coverage green', async () => {
      const originalBaseUrl = process.env.PUBLIC_BASE_URL;
      try {
        const baseHelpers = createShareCardRuntimeHelpers(createBaseDeps());
        process.env.PUBLIC_BASE_URL = 'https://znews.live///';
        assert.equal(baseHelpers.getPublicBaseUrl({ headers: {}, protocol: 'http', get: () => 'ignored' }), 'https://znews.live');
        delete process.env.PUBLIC_BASE_URL;
        assert.equal(baseHelpers.getPublicBaseUrl({
          headers: { 'x-forwarded-proto': 'https' },
          protocol: 'http',
          get(header) {
            return header === 'host' ? 'example.com' : '';
          },
        }), 'https://example.com');
      } finally {
        if (originalBaseUrl === undefined) delete process.env.PUBLIC_BASE_URL;
        else process.env.PUBLIC_BASE_URL = originalBaseUrl;
      }
    
      const delegatedBackground = Buffer.from('bg');
      const delegatedFallback = { type: 'redirect', url: 'https://example.com/direct.png' };
      const delegateHelpers = createShareCardRuntimeHelpers(createBaseDeps({
        resolveShareBackgroundInput: async () => delegatedBackground,
        resolveShareFallbackSource: async () => delegatedFallback,
      }));
      assert.equal(await delegateHelpers.resolveShareBackgroundInput({ id: 7 }), delegatedBackground);
      assert.deepEqual(await delegateHelpers.resolveShareFallbackSource({ id: 8 }), delegatedFallback);
    
      let persistedTarget = null;
      let persistedBuffer = null;
      let cleaned = null;
      const generationHelpers = createShareCardRuntimeHelpers(createBaseDeps({
        buildShareCardStorageTarget() {
          return {
            absolutePath: 'C:/uploads/_share/generated.png',
            fileName: 'article-15-generated.png',
            normalized: {
              id: 15,
              title: 'Generated card',
              category: 'crime',
              date: '2026-03-11',
            },
            relativePath: '_share/article-15-generated.png',
            url: '/uploads/_share/article-15-generated.png',
          };
        },
        cleanupOldShareCards: async (articleId, fileName) => {
          cleaned = { articleId, fileName };
        },
        loadSharp: async () => {
          const sharpFn = (input) => ({
            rotate() { return this; },
            resize() { return this; },
            modulate() { return this; },
            composite() { return this; },
            png() { return this; },
            async toBuffer() { return Buffer.from('generated'); },
            async metadata() { return { width: 0, height: 0 }; },
          });
          return sharpFn;
        },
        persistShareCardObject: async (target, output) => {
          persistedTarget = target;
          persistedBuffer = output;
        },
        renderTextImage: async () => null,
      }));
      const generatedCard = await generationHelpers.ensureArticleShareCard({ id: 15, title: 'Generated card' }, { categoryLabel: 'Crime' });
      assert.equal(generatedCard.generated, true);
      assert.equal(generatedCard.relativePath, '_share/article-15-generated.png');
      assert.equal(String(persistedBuffer), 'generated');
      assert.equal(persistedTarget.fileName, 'article-15-generated.png');
      assert.deepEqual(cleaned, { articleId: 15, fileName: 'article-15-generated.png' });
    
      let stored = false;
      const existingHelpers = createShareCardRuntimeHelpers(createBaseDeps({
        hasShareCardObject: async () => true,
        persistShareCardObject: async () => {
          stored = true;
        },
      }));
      const existingCard = await existingHelpers.ensureArticleShareCard({ id: 15, title: 'Existing card' }, { categoryLabel: 'Crime' });
      assert.equal(existingCard.generated, true);
      assert.equal(existingCard.relativePath.startsWith('_share/article-15-'), true);
      assert.equal(existingCard.url.startsWith('/uploads/_share/article-15-'), true);
      assert.equal(stored, false);
    
      const noSharpHelpers = createShareCardRuntimeHelpers(createBaseDeps({
        loadSharp: async () => null,
      }));
      assert.equal(await noSharpHelpers.ensureArticleShareCard({ id: 20 }, {}), null);
  });
});
