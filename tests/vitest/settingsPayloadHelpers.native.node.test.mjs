import { describe, expect, it } from 'vitest';

import { createSettingsPayloadHelpers } from '../../server/services/settingsPayloadHelpersService.js';

function createDefaults() {
  return {
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
      breakingBadgeLabel: 'Breaking',
      navbarLinks: [{ to: '/', label: 'Home', hot: false }],
      spotlightLinks: [
        { to: '/category/breaking', label: 'Breaking', icon: 'Flame', hot: true, tilt: '-2deg' },
        { to: '/games', label: 'Games', icon: 'Gamepad2', hot: false, tilt: '1.8deg' },
      ],
      footerPills: [{ to: '/category/business', label: 'Business', hot: false, tilt: '1deg' }],
      footerQuickLinks: [{ to: '/category/breaking', label: 'Breaking' }],
      footerInfoLinks: [{ to: '/about', label: 'About' }],
      contact: { address: 'Addr', phone: 'Phone', email: 'mail@example.com' },
      about: {
        heroText: 'Hero',
        missionTitle: 'Mission',
        missionParagraph1: 'Paragraph 1',
        missionParagraph2: 'Paragraph 2',
        adIntro: 'Ad intro',
        adPlans: [{ name: 'Plan', price: '10', desc: 'Desc' }],
      },
      layoutPresets: {
        homeFeatured: 'default',
        homeCrime: 'impact',
        homeReportage: 'noir',
        homeEmergency: 'classic',
        articleRelated: 'default',
        categoryListing: 'impact',
        searchListing: 'noir',
      },
      tipLinePromo: {
        enabled: true,
        title: 'Signal',
        description: 'Desc',
        buttonLabel: 'Send',
        buttonLink: '/tipline',
      },
    },
  };
}

describe('settingsPayloadHelpers', () => {
  it('sanitizes hero payloads and clamps ids, captions and title scale', () => {
    const defaults = createDefaults();
    const helpers = createSettingsPayloadHelpers({
      BREAKING_CATEGORY_LABEL: 'Breaking',
      DEFAULT_HERO_SETTINGS: defaults.DEFAULT_HERO_SETTINGS,
      DEFAULT_SITE_SETTINGS: defaults.DEFAULT_SITE_SETTINGS,
      normalizeText(value, maxLen = 255) {
        return String(value ?? '').trim().slice(0, maxLen);
      },
    });

    const hero = helpers.sanitizeHeroSettingsPayload({
      headline: '  New headline  ',
      shockLabel: '  Alert  ',
      ctaLabel: '  Click  ',
      headlineBoardText: '  Board text  ',
      heroTitleScale: '180',
      captions: ['  First  ', '', 'Third'],
      mainPhotoArticleId: '7',
      photoArticleIds: ['5', 'oops', '5', '3', '11'],
    });

    expect(hero.headline).toBe('New headline');
    expect(hero.heroTitleScale).toBe(130);
    expect(hero.mainPhotoArticleId).toBe(7);
    expect(hero.captions).toEqual(['First', 'Two', 'Third']);
    expect(hero.photoArticleIds).toEqual([5, 3]);
  });

  it('normalizes navigation, footer, about and promo payloads for site settings', () => {
    const defaults = createDefaults();
    const helpers = createSettingsPayloadHelpers({
      BREAKING_CATEGORY_LABEL: 'Breaking',
      DEFAULT_HERO_SETTINGS: defaults.DEFAULT_HERO_SETTINGS,
      DEFAULT_SITE_SETTINGS: defaults.DEFAULT_SITE_SETTINGS,
      normalizeText(value, maxLen = 255) {
        return String(value ?? '').trim().slice(0, maxLen);
      },
    });

    const site = helpers.sanitizeSiteSettingsPayload({
      breakingBadgeLabel: '  Fresh  ',
      navbarLinks: [{ to: 'bad', label: '  X  ', hot: 1 }],
      spotlightLinks: [{ to: 'bad', label: '  Spotlight  ', icon: 'BadIcon', hot: 1, tilt: 'bad' }],
      footerPills: [{ to: '/ok', label: '  Pill  ', hot: 0, tilt: '15deg' }],
      footerQuickLinks: [{ to: '/category/breaking', label: 'Breaking' }],
      footerInfoLinks: [{ to: 'bad', label: '  Info  ' }],
      contact: { address: '  New addr  ', phone: ' 123 ', email: ' mail@x.com ' },
      about: {
        heroText: '  Hero text  ',
        missionTitle: '  Title  ',
        missionParagraph1: '  P1  ',
        missionParagraph2: '  P2  ',
        adIntro: '  Intro  ',
        adPlans: [{ name: '  Gold  ', price: ' 20 ', desc: '  Great ' }],
      },
      layoutPresets: { homeFeatured: 'bad-preset', categoryListing: 'classic' },
      tipLinePromo: {
        enabled: 0,
        title: '  Tip  ',
        description: '  Tip desc  ',
        buttonLabel: '  Go  ',
        buttonLink: 'bad',
      },
    });

    expect(site.breakingBadgeLabel).toBe('Fresh');
    expect(site.navbarLinks).toEqual([{ to: '/', label: 'X', hot: true }]);
    expect(site.spotlightLinks).toEqual([
      { to: '/category/breaking', label: 'Spotlight', icon: 'Flame', hot: true, tilt: '-2deg' },
    ]);
    expect(site.footerPills).toEqual([{ to: '/ok', label: 'Pill', hot: false, tilt: '15deg' }]);
    expect(site.footerQuickLinks).toEqual([{ to: '/category/breaking', label: 'Breaking' }]);
    expect(site.footerInfoLinks).toEqual([{ to: '/about', label: 'Info' }]);
    expect(site.contact).toEqual({ address: 'New addr', phone: '123', email: 'mail@x.com' });
    expect(site.about).toEqual({
      heroText: 'Hero text',
      missionTitle: 'Title',
      missionParagraph1: 'P1',
      missionParagraph2: 'P2',
      adIntro: 'Intro',
      adPlans: [{ name: 'Gold', price: '20', desc: 'Great' }],
    });
    expect(site.layoutPresets.homeFeatured).toBe('default');
    expect(site.layoutPresets.categoryListing).toBe('classic');
    expect(site.tipLinePromo).toEqual({
      enabled: false,
      title: 'Tip',
      description: 'Tip desc',
      buttonLabel: 'Go',
      buttonLink: '/tipline',
    });
  });

  it('falls back to default spotlight links when payload is empty', () => {
    const defaults = createDefaults();
    const helpers = createSettingsPayloadHelpers({
      BREAKING_CATEGORY_LABEL: 'Breaking',
      DEFAULT_HERO_SETTINGS: defaults.DEFAULT_HERO_SETTINGS,
      DEFAULT_SITE_SETTINGS: defaults.DEFAULT_SITE_SETTINGS,
      normalizeText(value, maxLen = 255) {
        return String(value ?? '').trim().slice(0, maxLen);
      },
    });

    const defaultSite = helpers.sanitizeSiteSettingsPayload({});
    expect(defaultSite.spotlightLinks).toEqual(defaults.DEFAULT_SITE_SETTINGS.spotlightLinks);
  });
});
