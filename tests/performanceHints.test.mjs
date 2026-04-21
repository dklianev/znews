import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildHomepagePayloadApiPath } from '../src/utils/homepagePayloadConfig.js';

const rootDir = process.cwd();

async function readProjectFile(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8');
}

describe('performance resource hints', () => {
  it('keeps critical font and Azure image hints in the app shell', async () => {
    const html = await readProjectFile('index.html');

    assert.match(
      html,
      /<link\s+rel="preconnect"\s+href="https:\/\/znewsmedia01\.blob\.core\.windows\.net"\s+crossorigin\s*\/>/,
      'index.html should preconnect to Azure Blob before image requests'
    );
    [
      '/fonts/oswald-cyrillic.woff2',
      '/fonts/oswald-latin.woff2',
      '/fonts/bangers-latin.woff2',
      '/fonts/nunito-sans-cyrillic.woff2',
    ].forEach((fontPath) => {
      assert.match(
        html,
        new RegExp(`<link\\s+rel="preload"\\s+href="${fontPath}"\\s+as="font"\\s+type="font/woff2"\\s+crossorigin\\s*/>`),
        `${fontPath} should be preloaded with crossorigin so the CSS font fetch reuses it`
      );
    });
    assert.doesNotMatch(
      html,
      /<link\s+rel="preload"\s+href="\/api\/homepage\?/,
      'route-specific homepage API fetches should be warmed conditionally from JS, not preloaded for every SPA route'
    );
  });

  it('keeps the homepage payload request contract centralized', () => {
    assert.equal(
      buildHomepagePayloadApiPath(),
      '/homepage?fields=id%2Ctitle%2Cexcerpt%2Ccategory%2CauthorId%2Cdate%2CreadTime%2Cimage%2CimageMeta%2Cfeatured%2Cbreaking%2Csponsored%2Chero%2Cviews%2Cstatus%2CpublishAt%2CcardSticker&latestShowcaseLimit=5&latestWireLimit=16&compact=1'
    );
  });

  it('keeps Bangers non-blocking for first paint', async () => {
    const css = await readProjectFile('src/index.css');

    assert.match(
      css,
      /font-family:\s*'Bangers';[\s\S]*?font-display:\s*optional;/,
      'Bangers should stay optional so display headings do not block LCP'
    );
  });

  it('runtime-caches Azure blob images through Workbox', async () => {
    const config = await readProjectFile('vite.config.js');

    assert.match(config, /runtimeCaching:\s*\[/, 'Workbox runtimeCaching should be configured');
    assert.match(config, /znewsmedia01\\\.blob\\\.core\\\.windows\\\.net/, 'Azure Blob host should be cached');
    assert.match(config, /handler:\s*'CacheFirst'/, 'Azure images should use CacheFirst');
    assert.match(config, /cacheName:\s*'znews-azure-images'/, 'Azure image cache should have a stable name');
    assert.match(config, /maxAgeSeconds:\s*60\s*\*\s*60\s*\*\s*24\s*\*\s*30/, 'Azure image cache should expire after 30 days');
  });

  it('allows Workbox image fetches through CSP connect-src', async () => {
    const app = await readProjectFile('server/app.js');

    assert.match(
      app,
      /const\s+storageConnectSrc\s*=\s*\[\.\.\.new Set\(\[/,
      'storage image origins should be collected for CSP connect-src'
    );
    assert.match(
      app,
      /getCspOrigin\(storagePublicBaseUrl\)/,
      'the configured storage public origin should be allowed for Workbox fetches'
    );
    assert.match(
      app,
      /connectSrc:\s*\["'self'",\s*\.\.\.storageConnectSrc\]/,
      'connect-src must include the storage origin because Workbox uses fetch(), not <img>'
    );
  });

  it('keeps ad banner wrappers roomy enough for labels and hover lift', async () => {
    const css = await readProjectFile('src/index.css');

    assert.match(
      css,
      /@utility\s+ad-banner-horizontal\s*\{[\s\S]*?@apply\s+ad-banner\s+w-full\s+pt-5\s+pr-2;/,
      'horizontal ad banners need top/right gutter so the rotated label is not clipped'
    );
    assert.match(
      css,
      /@utility\s+ad-banner-side\s*\{[\s\S]*?@apply\s+ad-banner\s+w-full\s+pt-5\s+pr-2;/,
      'side ad banners need the same safe gutter as horizontal ads'
    );
    assert.match(
      css,
      /@utility\s+ad-banner-inline\s*\{[\s\S]*?@apply\s+ad-banner\s+pt-4\s+pr-2;/,
      'inline ad banners need compact safe gutter for their label'
    );
  });
});
