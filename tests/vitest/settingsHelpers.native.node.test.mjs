import { describe, expect, it } from 'vitest';

import { createSettingsHelpers } from '../../server/services/settingsHelpersService.js';

function normalizeText(value, maxLen = 255) {
  return String(value ?? '').trim().slice(0, maxLen);
}

describe('settingsHelpers', () => {
  it('serializes hero and site payloads with normalized values', () => {
    const helpers = createSettingsHelpers({
      DEFAULT_HERO_SETTINGS: {
        headline: 'Default headline',
        shockLabel: 'Shock',
        ctaLabel: 'Read more',
        headlineBoardText: 'Board',
        heroTitleScale: 100,
        captions: ['One', 'Two', 'Three'],
        mainPhotoArticleId: null,
        photoArticleIds: [],
      },
      DEFAULT_SITE_SETTINGS: {
        siteTitle: 'Znews',
        navbarLinks: [],
      },
      SettingsRevision: {},
      normalizeText,
      randomUUID: () => 'unused',
      sanitizeSiteSettingsPayload: (value) => ({
        siteTitle: normalizeText(value?.siteTitle || 'Znews', 80),
        navbarLinks: Array.isArray(value?.navbarLinks) ? value.navbarLinks : [],
      }),
      snapshotsEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    });

    expect(helpers.serializeHeroSettings({
      headline: '  Breaking hero  ',
      shockLabel: '  Shockwave  ',
      ctaLabel: '  Read now  ',
      headlineBoardText: '  Board text  ',
      heroTitleScale: '180',
      captions: ['  First  ', 'Second', 'Third'],
      mainPhotoArticleId: '7',
      photoArticleIds: ['5', 5, 'oops', '3', '11'],
    })).toEqual(expect.objectContaining({
      headline: 'Breaking hero',
      heroTitleScale: 130,
      mainPhotoArticleId: 7,
      photoArticleIds: [5, 3],
    }));

    expect(helpers.serializeSiteSettings({
      siteTitle: '  New title  ',
      navbarLinks: ['/', '/news'],
    })).toEqual({
      siteTitle: 'New title',
      navbarLinks: ['/', '/news'],
    });
  });

  it('deduplicates identical revisions and formats revision history', async () => {
    let revisionStore = [];
    let uuidCounter = 0;

    const SettingsRevision = {
      findOne(query) {
        return {
          sort() {
            return {
              async lean() {
                return revisionStore
                  .filter((item) => item.scope === query.scope)
                  .sort((a, b) => b.version - a.version)[0] || null;
              },
            };
          },
        };
      },
      async create(doc) {
        const created = {
          ...doc,
          toJSON() {
            return { ...doc };
          },
        };
        revisionStore.push(created);
        return created;
      },
      find(query) {
        return {
          sort() {
            return {
              skip(count) {
                return {
                  select() {
                    return {
                      async lean() {
                        return revisionStore
                          .filter((item) => item.scope === query.scope)
                          .sort((a, b) => b.createdAt - a.createdAt)
                          .slice(count)
                          .map((item) => ({ revisionId: item.revisionId }));
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
      async deleteMany(query) {
        const ids = new Set(query?.revisionId?.$in || []);
        revisionStore = revisionStore.filter((item) => !ids.has(item.revisionId));
      },
    };

    const helpers = createSettingsHelpers({
      DEFAULT_HERO_SETTINGS: {
        headline: 'Default headline',
        shockLabel: 'Shock',
        ctaLabel: 'Read more',
        headlineBoardText: 'Board',
        heroTitleScale: 100,
        captions: ['One', 'Two', 'Three'],
        mainPhotoArticleId: null,
        photoArticleIds: [],
      },
      DEFAULT_SITE_SETTINGS: {
        siteTitle: 'Znews',
        navbarLinks: [],
      },
      SettingsRevision,
      normalizeText,
      randomUUID: () => `revision-${++uuidCounter}`,
      sanitizeSiteSettingsPayload: (value) => ({
        siteTitle: normalizeText(value?.siteTitle || 'Znews', 80),
        navbarLinks: Array.isArray(value?.navbarLinks) ? value.navbarLinks : [],
      }),
      snapshotsEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    });

    const serializedHero = helpers.serializeHeroSettings({
      headline: 'Breaking hero',
      shockLabel: 'Shockwave',
      ctaLabel: 'Read now',
      headlineBoardText: 'Board text',
      heroTitleScale: 120,
      captions: ['First', 'Second', 'Third'],
      mainPhotoArticleId: 7,
      photoArticleIds: [5, 3],
    });

    const firstRevision = await helpers.createSettingsRevision('hero', serializedHero, {
      source: 'update',
      user: { userId: 42, name: 'Admin' },
    });
    const duplicateRevision = await helpers.createSettingsRevision('hero', { ...serializedHero }, {
      source: 'update',
      user: { userId: 42, name: 'Admin' },
    });
    const secondRevision = await helpers.createSettingsRevision('hero', {
      ...serializedHero,
      headline: 'Different hero',
    }, {
      source: 'restore',
      user: { userId: 7, name: 'Editor' },
    });

    expect(firstRevision.version).toBe(1);
    expect(duplicateRevision.version).toBe(1);
    expect(secondRevision.version).toBe(2);
    expect(revisionStore).toHaveLength(2);
    expect(helpers.formatSettingsRevisionList(revisionStore)).toEqual([
      {
        revisionId: 'revision-1',
        scope: 'hero',
        version: 1,
        source: 'update',
        editorName: 'Admin',
        createdAt: firstRevision.createdAt,
        snapshot: serializedHero,
      },
      {
        revisionId: 'revision-2',
        scope: 'hero',
        version: 2,
        source: 'restore',
        editorName: 'Editor',
        createdAt: secondRevision.createdAt,
        snapshot: {
          ...serializedHero,
          headline: 'Different hero',
        },
      },
    ]);
  });
});
