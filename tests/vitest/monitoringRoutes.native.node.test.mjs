import { describe, expect, it, vi } from 'vitest';
import { registerMonitoringRoutes } from '../../server/routes/monitoringRoutes.js';
import { createMockApp, createResponse, runHandlers } from './helpers/routeHarness.mjs';

describe('monitoringRoutes', () => {
  it('records client errors with sanitized payloads', async () => {
    const app = createMockApp();
    const recordSystemEvent = vi.fn(async () => {});

    registerMonitoringRoutes(app, {
      buildDiagnosticsPayload: async () => ({}),
      clientMonitoringLimiter: (_req, _res, next) => next(),
      recordSystemEvent,
      reportServerError: vi.fn(async () => {}),
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
      sanitizeMonitoringMetadata: (value) => ({ safe: value?.unsafe || null }),
      truncateMonitoringText: (value, max) => String(value || '').slice(0, max),
    });

    const res = createResponse();
    await runHandlers(app.routes.get('POST /api/monitoring/client-error'), {
      body: {
        component: 'ArticlePage',
        message: 'Maximum update depth exceeded',
        pathname: '/article/27',
        stack: 'stacktrace',
        metadata: { unsafe: 'value' },
      },
      headers: { 'user-agent': 'Vitest' },
    }, res);

    expect(res.statusCode).toBe(201);
    expect(recordSystemEvent).toHaveBeenCalledWith(expect.objectContaining({
      source: 'client',
      component: 'ArticlePage',
      message: 'Maximum update depth exceeded',
      metadata: expect.objectContaining({
        pathname: '/article/27',
        userAgent: 'Vitest',
        extra: { safe: 'value' },
      }),
    }));
  });

  it('serves diagnostics with no-store caching', async () => {
    const app = createMockApp();

    registerMonitoringRoutes(app, {
      buildDiagnosticsPayload: async () => ({ ok: true }),
      clientMonitoringLimiter: (_req, _res, next) => next(),
      recordSystemEvent: vi.fn(async () => {}),
      reportServerError: vi.fn(async () => {}),
      requireAuth: (_req, _res, next) => next(),
      requirePermission: () => (_req, _res, next) => next(),
      sanitizeMonitoringMetadata: (value) => value,
      truncateMonitoringText: (value) => value,
    });

    const res = createResponse();
    await runHandlers(app.routes.get('GET /api/admin/diagnostics'), {}, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body).toEqual({ ok: true });
  });
});

