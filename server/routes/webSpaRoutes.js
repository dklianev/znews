import express from 'express';
import path from 'path';

export function registerWebSpaRoutes(app, deps) {
  const {
    __dirname,
    isProd,
  } = deps;

  const distPath = path.join(__dirname, '..', 'dist');

  function isStaticAssetRequest(requestPath) {
    if (requestPath.startsWith('/assets/')) return true;
    return path.posix.extname(requestPath) !== '';
  }

  app.use(express.static(distPath, {
    // Never let express.static serve index.html with long cache headers.
    // The SPA entrypoint should be revalidated, while fingerprinted assets can be cached for 1y.
    index: false,
    maxAge: isProd ? '1y' : 0,
    etag: true,
    immutable: isProd,
  }));

  function sendSpaEntrypoint(_req, res) {
    // Don't cache HTML; assets are fingerprinted and cached via express.static.
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile('index.html', { root: distPath });
  }

  app.get('/', sendSpaEntrypoint);
  app.get('/{*splat}', (req, res) => {
    if (isStaticAssetRequest(req.path)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).type('text/plain').send('Not Found');
    }

    return sendSpaEntrypoint(req, res);
  });
}
