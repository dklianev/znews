import { describe, expect, it } from 'vitest';

import {
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
        huntEnabled: true,
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

  it('respects manual start/end windows for decorations', () => {
    const settings = createSettings({
      autoWindow: false,
      startAt: '2026-04-01',
      endAt: '2026-04-10',
    });

    expect(shouldRenderDecorations(settings, new Date('2026-04-05T12:00:00Z'))).toBe(true);
    expect(shouldRenderDecorations(settings, new Date('2026-04-11T12:00:00Z'))).toBe(false);
  });

  it('does not render decorations when the toggle is off even inside the window', () => {
    const settings = createSettings({ decorationsEnabled: false });
    const insideWindow = new Date('2026-04-10T12:00:00Z');

    expect(isEasterCampaignActive(settings, insideWindow)).toBe(true);
    expect(shouldRenderDecorations(settings, insideWindow)).toBe(false);
  });
});
