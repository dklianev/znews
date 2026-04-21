import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

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
