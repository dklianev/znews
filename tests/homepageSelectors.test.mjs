import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { sortArticlesByRecency } from '../shared/articleRecency.js';
import { buildHomepageSections, buildHomepageSectionIdPayload } from '../shared/homepageSelectors.js';

function flattenSectionIds(sections) {
  const groups = [
    sections.heroArticle,
    sections.heroPrimaryPhoto,
    ...(Array.isArray(sections.heroSiblings) ? sections.heroSiblings : []),
    ...(Array.isArray(sections.featuredArticles) ? sections.featuredArticles : []),
    ...(Array.isArray(sections.crimeArticles) ? sections.crimeArticles : []),
    ...(Array.isArray(sections.breakingArticles) ? sections.breakingArticles : []),
    ...(Array.isArray(sections.emergencyArticles) ? sections.emergencyArticles : []),
    ...(Array.isArray(sections.reportageArticles) ? sections.reportageArticles : []),
    ...(Array.isArray(sections.latestShowcase) ? sections.latestShowcase : []),
    ...(Array.isArray(sections.latestWire) ? sections.latestWire : []),
  ];

  return groups
    .map((article) => Number(article?.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

describe('homepageSelectors', () => {
  it('covers legacy scenarios', async () => {
      const sorted = sortArticlesByRecency([
        { id: 1, date: '2026-02-10' },
        { id: 2, publishAt: '2026-02-15T12:00:00.000Z' },
        { id: 3, publishAt: '2026-02-11T12:00:00.000Z' },
      ]);
      assert.deepEqual(sorted.map((item) => item.id), [2, 3, 1]);
    
      const inputArticles = [
        { id: 20, title: 'Hero', hero: true, featured: true, category: 'crime' },
        { id: 19, title: 'Feature', featured: true, category: 'crime' },
        { id: 18, title: 'Crime', category: 'crime' },
        { id: 17, title: 'Breaking', category: 'breaking' },
        { id: 16, title: 'Emergency', category: 'emergency' },
        { id: 15, title: 'Reportage', category: 'reportage' },
        { id: 14, title: 'Wire 1', category: 'society' },
        { id: 13, title: 'Wire 2', category: 'society' },
        { id: 12, title: 'Wire 3', category: 'society' },
        { id: 11, title: 'Wire 4', category: 'society' },
        { id: 10, title: 'Wire 5', category: 'society' },
        { id: 9, title: 'Wire 6', category: 'society' },
      ];
    
      const sections = buildHomepageSections({
        articles: inputArticles,
        heroSettings: {},
        latestShowcaseLimit: 3,
        latestWireLimit: 3,
      });
      const ids = flattenSectionIds(sections);
      const heroId = Number(sections.heroArticle?.id);
      const heroPrimaryId = Number(sections.heroPrimaryPhoto?.id);
      const idsWithoutHeroMirror = heroId > 0 && heroPrimaryId === heroId
        ? ids.filter((id, index) => !(index === 1 && id === heroId))
        : ids;
      assert.equal(new Set(idsWithoutHeroMirror).size, idsWithoutHeroMirror.length);
      assert.equal(Number(sections.heroArticle?.id), 20);
      assert.ok(Array.isArray(sections.latestShowcase));
      assert.ok(Array.isArray(sections.latestWire));
    
      const sectionIdPayload = buildHomepageSectionIdPayload(sections);
      assert.equal(Number(sectionIdPayload.heroArticleId), 20);
      assert.ok(Array.isArray(sectionIdPayload.featuredIds));
    
      const sponsoredSections = buildHomepageSections({
        articles: [
          { id: 30, title: 'Hero', hero: true, category: 'society' },
          { id: 29, title: 'Featured Sponsored', featured: true, sponsored: true, category: 'society' },
          { id: 28, title: 'Sponsored Only', sponsored: true, category: 'society' },
          { id: 27, title: 'Wire 1', category: 'society' },
          { id: 26, title: 'Wire 2', category: 'society' },
          { id: 25, title: 'Wire 3', category: 'society' },
        ],
        heroSettings: {},
        latestShowcaseLimit: 2,
        latestWireLimit: 2,
      });
    
      assert.deepEqual(
        sponsoredSections.featuredArticles.map((article) => Number(article.id)),
        [29],
        'featured sponsored stories should stay in featured sections'
      );
      assert.deepEqual(
        sponsoredSections.sponsoredArticles.map((article) => Number(article.id)),
        [28],
        'sponsored rail should only backfill with unclaimed sponsored stories'
      );
      assert.equal(
        sponsoredSections.latestShowcase.some((article) => Number(article.id) === 28),
        false,
        'sponsored rail stories should not duplicate into latest showcase'
      );
      assert.equal(
        sponsoredSections.latestWire.some((article) => Number(article.id) === 28),
        false,
        'sponsored rail stories should not duplicate into latest wire'
      );
  });
});
