export function registerHealthRoutes(app, { buildHealthPayload }) {
  app.get('/api/health/live', (_req, res) => {
    const payload = buildHealthPayload('live');
    res.set('Cache-Control', 'no-store');
    res.status(payload.ok ? 200 : 503).json(payload);
  });

  app.get('/api/health/ready', (_req, res) => {
    const payload = buildHealthPayload('ready');
    res.set('Cache-Control', 'no-store');
    res.status(payload.ok ? 200 : 503).json(payload);
  });

  app.get('/api/health', (_req, res) => {
    const payload = buildHealthPayload('ready');
    res.set('Cache-Control', 'no-store');
    res.status(payload.ok ? 200 : 503).json(payload);
  });
}
