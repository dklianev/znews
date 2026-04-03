import { describe, expect, it, vi } from 'vitest';
import { registerPushRoutes } from '../../server/routes/pushRoutes.js';
import { createMockApp, createResponse, runHandlers } from './helpers/routeHarness.mjs';

describe('pushRoutes', () => {
  it('serves the public VAPID key and rejects invalid subscriptions', async () => {
    const app = createMockApp();
    const findOneAndUpdate = vi.fn();

    registerPushRoutes(app, {
      PushSubscription: { findOneAndUpdate },
      vapidPublicKey: 'public-key-123',
    });

    const vapidRes = createResponse();
    await runHandlers(app.routes.get('GET /api/push/vapid-public-key'), {}, vapidRes);
    expect(vapidRes.body).toBe('public-key-123');

    const invalidRes = createResponse();
    await runHandlers(app.routes.get('POST /api/push/subscribe'), { body: {} }, invalidRes);
    expect(invalidRes.statusCode).toBe(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('upserts subscriptions and deletes unsubscribe requests', async () => {
    const app = createMockApp();
    const findOneAndUpdate = vi.fn(async () => ({}));
    const findOneAndDelete = vi.fn(async () => ({}));

    registerPushRoutes(app, {
      PushSubscription: { findOneAndUpdate, findOneAndDelete },
      vapidPublicKey: '',
    });

    const subscribeRes = createResponse();
    await runHandlers(app.routes.get('POST /api/push/subscribe'), {
      body: { endpoint: 'https://push.example.com/sub', keys: { auth: 'x' } },
    }, subscribeRes);
    expect(subscribeRes.statusCode).toBe(201);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { endpoint: 'https://push.example.com/sub' },
      { endpoint: 'https://push.example.com/sub', keys: { auth: 'x' } },
      { upsert: true, returnDocument: 'after' },
    );

    const unsubscribeRes = createResponse();
    await runHandlers(app.routes.get('POST /api/push/unsubscribe'), {
      body: { endpoint: 'https://push.example.com/sub' },
    }, unsubscribeRes);
    expect(unsubscribeRes.statusCode).toBe(200);
    expect(findOneAndDelete).toHaveBeenCalledWith({ endpoint: 'https://push.example.com/sub' });
  });
});

