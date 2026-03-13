import express from 'express';
import path from 'path';

export function registerWebSpaRoutes(app, deps) {
  const {
    __dirname,
    isProd,
  } = deps;

  const distPath = path.join(__dirname, '..', 'dist');

  app.use(express.static(distPath, {
    // Never let express.static serve index.html with long cache headers.
    // The SPA entrypoint should be revalidated, while fingerprinted assets can be cached for 1y.
    index: false,
    maxAge: isProd ? '1y' : 0,
    etag: true,
    immutable: isProd,
  }));

  app.get('/{*splat}', (_req, res) => {
    // Don't cache HTML; assets are fingerprinted and cached via express.static.
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
