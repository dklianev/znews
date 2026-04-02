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
  it('covers legacy scenarios', async () => {
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
        });
      });
  });
});
