export function registerMonitoringRoutes(app, deps) {
  const {
    buildDiagnosticsPayload,
    clientMonitoringLimiter,
    publicError,
    recordSystemEvent,
    reportServerError,
    requireAuth,
    requirePermission,
    sanitizeMonitoringMetadata,
    truncateMonitoringText,
  } = deps;

  app.post('/api/monitoring/client-error', clientMonitoringLimiter, async (req, res) => {
    try {
      const payload = req.body && typeof req.body === 'object' ? req.body : {};
      await recordSystemEvent({
        level: 'error',
        source: 'client',
        component: truncateMonitoringText(payload.component || payload.source || 'client', 120),
        message: truncateMonitoringText(payload.message || 'Client error', 600),
        metadata: {
          pathname: truncateMonitoringText(payload.pathname || '', 200),
          userAgent: truncateMonitoringText(req.headers['user-agent'] || '', 300),
          stack: truncateMonitoringText(payload.stack || '', 4000),
          extra: sanitizeMonitoringMetadata(payload.extra || payload.metadata || null),
        },
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: publicError(error) });
    }
  });

  app.get('/api/admin/diagnostics', requireAuth, requirePermission('permissions'), async (_req, res) => {
    try {
      const payload = await buildDiagnosticsPayload();
      res.set('Cache-Control', 'no-store');
      res.json(payload);
    } catch (error) {
      await reportServerError('admin-diagnostics', error);
      res.status(500).json({ error: publicError(error) });
    }
  });
}
