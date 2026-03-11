export function registerPushRoutes(app, deps) {
  const {
    PushSubscription,
    publicError,
    vapidPublicKey,
  } = deps;

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.send(vapidPublicKey || '');
  });

  app.post('/api/push/subscribe', async (req, res) => {
    try {
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
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.post('/api/push/unsubscribe', async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'Invalid operation' });
      await PushSubscription.findOneAndDelete({ endpoint });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });
}
