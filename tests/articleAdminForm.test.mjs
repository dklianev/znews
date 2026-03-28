import assert from 'node:assert/strict';
import { normalizeArticleAdminForm, trimArticleAdminText } from '../src/utils/articleAdminForm.js';

export async function runArticleAdminFormTests() {
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

  assert.equal(trimArticleAdminText(undefined), '');
  assert.equal(trimArticleAdminText('  Заглавие  '), 'Заглавие');

  const normalized = normalizeArticleAdminForm({
    title: undefined,
    excerpt: null,
    content: '',
    tags: [' съд ', '', 'полиция'],
    relatedArticles: ['12', 'abc', 18],
    authorId: '7',
    readTime: '0',
    views: '-4',
    featured: 1,
    shareAccent: '',
    publishAt: null,
  }, fallback);

  assert.equal(normalized.title, '');
  assert.equal(normalized.excerpt, '');
  assert.equal(normalized.content, '<p></p>');
  assert.equal(normalized.tags, 'съд, полиция');
  assert.deepEqual(normalized.relatedArticles, [12, 18]);
  assert.equal(normalized.authorId, 7);
  assert.equal(normalized.readTime, 3);
  assert.equal(normalized.views, 0);
  assert.equal(normalized.featured, true);
  assert.equal(normalized.shareAccent, 'auto');
  assert.equal(normalized.publishAt, '');

  const restored = normalizeArticleAdminForm({
    title: 'Чернова',
    excerpt: undefined,
    slug: undefined,
  }, fallback);

  assert.equal(restored.title, 'Чернова');
  assert.equal(restored.excerpt, '');
  assert.equal(restored.slug, '');
}
