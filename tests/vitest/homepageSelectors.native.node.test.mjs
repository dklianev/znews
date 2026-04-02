import { describe, expect, it } from 'vitest';

import { sortArticlesByRecency } from '../../shared/articleRecency.js';
import { buildHomepageSections, buildHomepageSectionIdPayload } from '../../shared/homepageSelectors.js';

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

describe('homepageSelectors helpers', () => {
  it('sorts articles by publishAt/date recency', () => {
    const sorted = sortArticlesByRecency([
      { id: 1, date: '2026-02-10' },
      { id: 2, publishAt: '2026-02-15T12:00:00.000Z' },
      { id: 3, publishAt: '2026-02-11T12:00:00.000Z' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it('builds deduped homepage sections and id payloads', () => {
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

    expect(new Set(idsWithoutHeroMirror).size).toBe(idsWithoutHeroMirror.length);
    expect(Number(sections.heroArticle?.id)).toBe(20);
    expect(Array.isArray(sections.latestShowcase)).toBe(true);
    expect(Array.isArray(sections.latestWire)).toBe(true);

    const sectionIdPayload = buildHomepageSectionIdPayload(sections);
    expect(Number(sectionIdPayload.heroArticleId)).toBe(20);
    expect(Array.isArray(sectionIdPayload.featuredIds)).toBe(true);
  });

  it('keeps sponsored stories out of latest rails once claimed by the sponsored rail', () => {
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

    expect(sponsoredSections.featuredArticles.map((article) => Number(article.id))).toEqual([29]);
    expect(sponsoredSections.sponsoredArticles.map((article) => Number(article.id))).toEqual([28]);
    expect(sponsoredSections.latestShowcase.some((article) => Number(article.id) === 28)).toBe(false);
    expect(sponsoredSections.latestWire.some((article) => Number(article.id) === 28)).toBe(false);
  });
});
