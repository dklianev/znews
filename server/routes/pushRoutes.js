import { asyncHandler } from '../services/expressAsyncService.js';

export function registerPushRoutes(app, deps) {
  const {
    PushSubscription,
    vapidPublicKey,
  } = deps;

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.send(vapidPublicKey || '');
  });

  app.post('/api/push/subscribe', asyncHandler(async (req, res) => {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      subscription,
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true });
  }));

  app.post('/api/push/unsubscribe', asyncHandler(async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Invalid operation' });
    await PushSubscription.findOneAndDelete({ endpoint });
    res.json({ success: true });
  }));
}
