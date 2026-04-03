import { describe, expect, it, vi } from 'vitest';
import { registerSettingsRoutes } from '../../server/routes/settingsRoutes.js';
import { createMockApp, createResponse, runHandlers } from './helpers/routeHarness.mjs';

describe('settingsRoutes', () => {
  it('returns default site settings and saves sanitized updates', async () => {
    const app = createMockApp();
    const createSettingsRevision = vi.fn(async () => {});
    const invalidateCacheGroup = vi.fn();

    registerSettingsRoutes(app, {
      AuditLog: { create: vi.fn(() => Promise.resolve()) },
      Breaking: { findOne: () => ({ lean: async () => null }), deleteMany: async () => {}, create: async ({ items }) => ({ items }) },
      cacheMiddleware: (_req, _res, next) => next(),
      createSettingsRevision,
      DEFAULT_HERO_SETTINGS: { label: 'hero-default' },
      DEFAULT_SITE_SETTINGS: { layout: 'default' },
      formatSettingsRevisionList: (items) => items,
      HeroSettings: {
        findOne: () => ({ lean: async () => null }),
        findOneAndUpdate: () => ({ lean: async () => ({ key: 'main', hero: true }) }),
      },
      invalidateCacheGroup,
      invalidateCacheTags: vi.fn(() => 1),
      normalizeText: (value) => String(value || '').trim(),
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
      sanitizeHeroSettingsPayload: (value) => value,
      sanitizeSiteSettingsPayload: (value) => ({ ...value, sanitized: true }),
      serializeHeroSettings: (value) => value,
      serializeSiteSettings: (value) => ({ ...value, serialized: true }),
      SettingsRevision: {
        find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
        findOne: () => ({ lean: async () => null }),
      },
      SiteSettings: {
        findOne: () => ({ lean: async () => null }),
        findOneAndUpdate: () => ({ lean: async () => ({ key: 'main', title: 'Нов title', sanitized: true }) }),
      },
    });

    const getRes = createResponse();
    await runHandlers(app.routes.get('GET /api/site-settings'), {}, getRes);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body).toEqual({ layout: 'default', serialized: true });

    const putRes = createResponse();
    await runHandlers(app.routes.get('PUT /api/site-settings'), {
      body: { title: 'Нов title' },
      user: { name: 'Admin', userId: 1 },
    }, putRes);
    expect(putRes.statusCode).toBe(200);
    expect(putRes.body).toEqual({ key: 'main', title: 'Нов title', sanitized: true, serialized: true });
    expect(createSettingsRevision).toHaveBeenCalled();
    expect(invalidateCacheGroup).toHaveBeenCalledWith('settings', 'site-settings-mutation');
  });

  it('refreshes homepage cache and reports the cleared totals', async () => {
    const app = createMockApp();
    const invalidateCacheTags = vi.fn()
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(1);

    registerSettingsRoutes(app, {
      AuditLog: { create: vi.fn(() => Promise.resolve()) },
      Breaking: { findOne: () => ({ lean: async () => null }), deleteMany: async () => {}, create: async ({ items }) => ({ items }) },
      cacheMiddleware: (_req, _res, next) => next(),
      createSettingsRevision: vi.fn(async () => {}),
      DEFAULT_HERO_SETTINGS: {},
      DEFAULT_SITE_SETTINGS: {},
      formatSettingsRevisionList: (items) => items,
      HeroSettings: { findOne: () => ({ lean: async () => null }), findOneAndUpdate: () => ({ lean: async () => ({}) }) },
      invalidateCacheGroup: vi.fn(),
      invalidateCacheTags,
      normalizeText: (value) => String(value || '').trim(),
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
      sanitizeHeroSettingsPayload: (value) => value,
      sanitizeSiteSettingsPayload: (value) => value,
      serializeHeroSettings: (value) => value,
      serializeSiteSettings: (value) => value,
      SettingsRevision: {
        find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
        findOne: () => ({ lean: async () => null }),
      },
      SiteSettings: { findOne: () => ({ lean: async () => null }), findOneAndUpdate: () => ({ lean: async () => ({}) }) },
    });

    const res = createResponse();
    await runHandlers(app.routes.get('POST /api/site-settings/cache/homepage/refresh'), {
      user: { name: 'Admin', userId: 1 },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.cleared).toEqual({ homepage: 2, bootstrap: 1, total: 3 });
  });
});

