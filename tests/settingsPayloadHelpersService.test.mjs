import assert from 'node:assert/strict';
import { createSettingsPayloadHelpers } from '../server/services/settingsPayloadHelpersService.js';

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
      footerQuickLinks: [{ to: '/category/breaking', label: 'Спешни' }],
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

export async function runSettingsPayloadHelpersTests() {
  const defaults = createDefaults();
  const helpers = createSettingsPayloadHelpers({
    BREAKING_CATEGORY_LABEL: 'Извънредни',
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
  assert.equal(hero.headline, 'New headline');
  assert.equal(hero.heroTitleScale, 130);
  assert.equal(hero.mainPhotoArticleId, 7);
  assert.deepEqual(hero.captions, ['First', 'Two', 'Third']);
  assert.deepEqual(hero.photoArticleIds, [5, 3]);

  assert.equal(helpers.sanitizeInternalPath('/valid/path', '/fallback'), '/valid/path');
  assert.equal(helpers.sanitizeInternalPath('https://bad', '/fallback'), '/fallback');
  assert.equal(helpers.sanitizeTilt('-2.5deg', '0deg'), '-2.5deg');
  assert.equal(helpers.sanitizeTilt('bad', '0deg'), '0deg');
  assert.equal(helpers.normalizeBreakingCategoryLabel('/category/breaking', '', 50), 'Извънредни');
  assert.equal(helpers.normalizeBreakingCategoryLabel('/category/breaking', 'Спешни', 50), 'Извънредни');
  assert.equal(helpers.normalizeBreakingCategoryLabel('/category/crime', 'Криме', 50), 'Криме');

  const site = helpers.sanitizeSiteSettingsPayload({
    breakingBadgeLabel: '  Fresh  ',
    navbarLinks: [{ to: 'bad', label: '  X  ', hot: 1 }],
    spotlightLinks: [{ to: 'bad', label: '  Spotlight  ', icon: 'BadIcon', hot: 1, tilt: 'bad' }],
    footerPills: [{ to: '/ok', label: '  Pill  ', hot: 0, tilt: '15deg' }],
    footerQuickLinks: [{ to: '/category/breaking', label: 'Спешни' }],
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

  assert.equal(site.breakingBadgeLabel, 'Fresh');
  assert.deepEqual(site.navbarLinks, [{ to: '/', label: 'X', hot: true }]);
  assert.deepEqual(site.spotlightLinks, [
    { to: '/category/breaking', label: 'Spotlight', icon: 'Flame', hot: true, tilt: '-2deg' },
  ]);
  assert.deepEqual(site.footerPills, [{ to: '/ok', label: 'Pill', hot: false, tilt: '15deg' }]);
  assert.deepEqual(site.footerQuickLinks, [{ to: '/category/breaking', label: 'Извънредни' }]);
  assert.deepEqual(site.footerInfoLinks, [{ to: '/about', label: 'Info' }]);
  assert.deepEqual(site.contact, { address: 'New addr', phone: '123', email: 'mail@x.com' });
  assert.deepEqual(site.about, {
    heroText: 'Hero text',
    missionTitle: 'Title',
    missionParagraph1: 'P1',
    missionParagraph2: 'P2',
    adIntro: 'Intro',
    adPlans: [{ name: 'Gold', price: '20', desc: 'Great' }],
  });
  assert.equal(site.layoutPresets.homeFeatured, 'default');
  assert.equal(site.layoutPresets.categoryListing, 'classic');
  assert.deepEqual(site.tipLinePromo, {
    enabled: false,
    title: 'Tip',
    description: 'Tip desc',
    buttonLabel: 'Go',
    buttonLink: '/tipline',
  });

  const defaultSite = helpers.sanitizeSiteSettingsPayload({});
  assert.deepEqual(defaultSite.spotlightLinks, defaults.DEFAULT_SITE_SETTINGS.spotlightLinks);
}
