import { describe, expect, it } from 'vitest';

import {
  getConfiguredHuntEggCount,
  getEggPlacements,
  getHuntPlacements,
  isEasterCampaignActive,
  isHuntActive,
  shouldRenderDecorations,
} from '../../src/utils/seasonalCampaigns.js';

function createSettings(overrides = {}) {
  return {
    seasonalCampaigns: {
      easter: {
        enabled: true,
        autoWindow: true,
        decorationsEnabled: true,
        variantSet: 'classic',
        maxVisibleEggs: 2,
        huntEnabled: true,
        huntEggCount: 6,
        ...overrides,
      },
    },
  };
}

describe('seasonalCampaigns', () => {
  it('disables decorations outside the active Easter window', () => {
    const settings = createSettings();
    const outsideWindow = new Date('2026-05-02T12:00:00Z');

    expect(isEasterCampaignActive(settings, outsideWindow)).toBe(false);
    expect(shouldRenderDecorations(settings, outsideWindow)).toBe(false);
    expect(isHuntActive(settings, outsideWindow)).toBe(false);
  });

  it('respects manual start/end windows for decorations using calendar-day boundaries', () => {
    const settings = createSettings({
      autoWindow: false,
      startAt: '2026-04-06T12:00:00.000Z',
      endAt: '2026-04-13T12:00:00.000Z',
    });

    expect(shouldRenderDecorations(settings, new Date('2026-04-06T00:30:00'))).toBe(true);
    expect(shouldRenderDecorations(settings, new Date('2026-04-13T23:30:00'))).toBe(true);
    expect(shouldRenderDecorations(settings, new Date('2026-04-14T00:00:00'))).toBe(false);
  });

  it('fails closed when a manual Easter window is incomplete', () => {
    const settings = createSettings({
      autoWindow: false,
      startAt: '2026-04-06T12:00:00.000Z',
      endAt: '',
    });

    expect(isEasterCampaignActive(settings, new Date('2026-04-10T12:00:00'))).toBe(false);
    expect(shouldRenderDecorations(settings, new Date('2026-04-10T12:00:00'))).toBe(false);
    expect(isHuntActive(settings, new Date('2026-04-10T12:00:00'))).toBe(false);
  });

  it('limits decorative eggs per page and keeps hunt count within the supported range', () => {
    const settings = createSettings({
      maxVisibleEggs: 6,
      huntEggCount: 12,
    });

    expect(getEggPlacements('homepage', settings)).toHaveLength(2);
    expect(getEggPlacements('article', settings)).toHaveLength(1);
    expect(getConfiguredHuntEggCount(settings)).toBe(12);
  });

  it('assigns special hunt variants for the homepage hero and final active egg', () => {
    const settings = createSettings({
      huntEggCount: 3,
      variantSet: 'police',
    });

    const homepagePlacements = getHuntPlacements('homepage', settings);
    const articlePlacements = getHuntPlacements('article', settings);

    expect(homepagePlacements.map((slot) => slot.eggId)).toEqual(['egg-home-hero', 'egg-home-section']);
    expect(homepagePlacements[0].variant).toBe('egg-gold');
    expect(articlePlacements).toHaveLength(1);
    expect(articlePlacements[0].eggId).toBe('egg-article-lead');
    expect(articlePlacements[0].variant).toBe('egg-vip');
  });

  it('does not render decorations when the toggle is off even inside the window', () => {
    const settings = createSettings({ decorationsEnabled: false });
    const insideWindow = new Date('2026-04-10T12:00:00Z');

    expect(isEasterCampaignActive(settings, insideWindow)).toBe(true);
    expect(shouldRenderDecorations(settings, insideWindow)).toBe(false);
  });
});
