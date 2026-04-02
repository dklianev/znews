import { describe, expect, it } from 'vitest';

import { normalizeArticleAdminForm, trimArticleAdminText } from '../../src/utils/articleAdminForm.js';

describe('articleAdminForm helpers', () => {
  const fallback = {
    title: '',
    slug: '',
    excerpt: '',
    content: '<p></p>',
    category: 'crime',
    authorId: 1,
    date: '2026-03-29',
    readTime: 3,
    views: 0,
    image: '',
    youtubeUrl: '',
    featured: false,
    breaking: false,
    sponsored: false,
    hero: false,
    tags: '',
    relatedArticles: [],
    status: 'published',
    publishAt: '',
    cardSticker: '',
    shareTitle: '',
    shareSubtitle: '',
    shareBadge: '',
    shareAccent: 'auto',
    shareImage: '',
  };

  it('trims nullable text safely', () => {
    expect(trimArticleAdminText(undefined)).toBe('');
    expect(trimArticleAdminText('  headline  ')).toBe('headline');
  });

  it('normalizes drafts and prefills missing values from the fallback', () => {
    const normalized = normalizeArticleAdminForm({
      title: undefined,
      excerpt: null,
      content: '',
      tags: [' alpha ', '', 'beta'],
      relatedArticles: ['12', 'abc', 18],
      authorId: '7',
      readTime: '0',
      views: '-4',
      featured: 1,
      shareAccent: '',
      publishAt: null,
    }, fallback);

    expect(normalized.title).toBe('');
    expect(normalized.excerpt).toBe('');
    expect(normalized.content).toBe('<p></p>');
    expect(normalized.tags).toBe('alpha, beta');
    expect(normalized.relatedArticles).toEqual([12, 18]);
    expect(normalized.authorId).toBe(7);
    expect(normalized.readTime).toBe(3);
    expect(normalized.views).toBe(0);
    expect(normalized.featured).toBe(true);
    expect(normalized.shareAccent).toBe('auto');
    expect(normalized.publishAt).toBe('');
  });

  it('preserves explicit values while still stringifying optional fields', () => {
    const restored = normalizeArticleAdminForm({
      title: 'Restored title',
      excerpt: undefined,
      slug: undefined,
    }, fallback);

    expect(restored.title).toBe('Restored title');
    expect(restored.excerpt).toBe('');
    expect(restored.slug).toBe('');
  });
});
