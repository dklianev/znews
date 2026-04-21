import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { registerWebSpaRoutes } from '../server/routes/webSpaRoutes.js';

async function withTempSpaFixture(run) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'znews-webspa-'));
  const serverDir = path.join(tempRoot, 'server');
  const routesDir = path.join(serverDir, 'routes');
  const distDir = path.join(tempRoot, 'dist');

  await fs.mkdir(routesDir, { recursive: true });
  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(path.join(distDir, 'index.html'), '<!doctype html><html><body><div id="root">spa shell</div></body></html>');
  await fs.writeFile(path.join(distDir, 'app.js'), 'console.log("ok");');
  await fs.writeFile(path.join(distDir, 'manifest.webmanifest'), '{"name":"Zemun News"}');
  await fs.writeFile(path.join(distDir, 'sw.js'), 'self.__WB_MANIFEST = [];');
  await fs.writeFile(path.join(distDir, 'workbox-1d305bb8.js'), 'console.log("workbox");');

  try {
    await run({ tempRoot, serverDir });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('webSpaRoutes', () => {
  it('keeps webSpaRoutes legacy coverage green', async () => {
    await withTempSpaFixture(async ({ serverDir }) => {
      const app = express();
      registerWebSpaRoutes(app, {
        __dirname: serverDir,
        isProd: false,
      });

      await withServer(app, async (baseUrl) => {
        const rootResponse = await fetch(`${baseUrl}/`);
        assert.equal(rootResponse.status, 200);
        assert.match(await rootResponse.text(), /spa shell/);
        assert.equal(rootResponse.headers.get('cache-control'), 'no-store');

        const nestedResponse = await fetch(`${baseUrl}/category/crime`);
        assert.equal(nestedResponse.status, 200);
        assert.match(await nestedResponse.text(), /spa shell/);
        assert.equal(nestedResponse.headers.get('cache-control'), 'no-store');

        const assetResponse = await fetch(`${baseUrl}/app.js`);
        assert.equal(assetResponse.status, 200);
        assert.match(await assetResponse.text(), /console\.log/);

        const missingCssResponse = await fetch(`${baseUrl}/assets/index-missing.css`);
        assert.equal(missingCssResponse.status, 404);
        assert.equal(missingCssResponse.headers.get('cache-control'), 'no-store');
        assert.doesNotMatch(await missingCssResponse.text(), /spa shell/);

        const missingJsResponse = await fetch(`${baseUrl}/triangle-alert-missing.js`);
        assert.equal(missingJsResponse.status, 404);
        assert.equal(missingJsResponse.headers.get('cache-control'), 'no-store');
        assert.doesNotMatch(await missingJsResponse.text(), /spa shell/);

        const adminResponse = await fetch(`${baseUrl}/admin`);
        assert.equal(adminResponse.status, 200);
        assert.match(await adminResponse.text(), /spa shell/);
      });
    });
  });

  it('revalidates PWA control files in production while keeping asset caching', async () => {
    await withTempSpaFixture(async ({ serverDir }) => {
      const app = express();
      registerWebSpaRoutes(app, {
        __dirname: serverDir,
        isProd: true,
      });

      await withServer(app, async (baseUrl) => {
        const pwaControlFiles = [
          '/manifest.webmanifest',
          '/sw.js',
          '/workbox-1d305bb8.js',
        ];

        for (const requestPath of pwaControlFiles) {
          const response = await fetch(`${baseUrl}${requestPath}`);
          assert.equal(response.status, 200);
          assert.equal(response.headers.get('cache-control'), 'no-cache, max-age=0, must-revalidate');
        }

        const assetResponse = await fetch(`${baseUrl}/app.js`);
        assert.equal(assetResponse.status, 200);
        assert.equal(assetResponse.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      });
    });
  });
});
