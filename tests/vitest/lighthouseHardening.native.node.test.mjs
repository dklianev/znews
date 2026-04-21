import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_SIZES, getLatestWallImageSizes } from '../../src/utils/imageSizes.js';

const rootDir = process.cwd();

async function readProjectFile(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8');
}

function extractCssBlock(source, startNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `${startNeedle} should exist`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${startNeedle} should open a CSS block`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${startNeedle} should close its CSS block`);
}

describe('Lighthouse hardening guardrails', () => {
  it('keeps card image sizes scoped below the full mobile viewport', () => {
    [
      IMAGE_SIZES.STANDARD_CARD,
      IMAGE_SIZES.COMPACT_CARD,
      IMAGE_SIZES.FEATURED_CARD,
      IMAGE_SIZES.HORIZONTAL_CARD,
      getLatestWallImageSizes(4),
      getLatestWallImageSizes(6),
      getLatestWallImageSizes(8),
      getLatestWallImageSizes(12),
    ].forEach((sizes) => {
      assert.match(sizes, /calc\(100vw - \d+px\)/);
      assert.doesNotMatch(sizes, /^\(max-width:\s*\d+px\)\s*100vw/);
    });
  });

  it('keeps poll option accessible names aligned with visible percentages', async () => {
    const source = await readProjectFile('src/components/PollWidget.jsx');

    assert.match(source, /const\s+accessibleLabel\s*=/);
    assert.match(source, /aria-label=\{accessibleLabel\}/);
    assert.match(source, /\$\{option\.text\},\s*\$\{pct\}%/);
  });

  it('keeps decorative ad titles out of the document heading outline', async () => {
    const source = await readProjectFile('src/components/AdBanner.jsx');

    assert.doesNotMatch(source, /showTitle\s*&&\s*<h[1-6]\b/);
    assert.match(source, /showTitle\s*&&\s*<span\s+className=\{`block\s+\$\{headingClass\}`\}/);
  });

  it('keeps nav and classifieds animations compositor-friendly', async () => {
    const css = await readProjectFile('src/index.css');
    const navbar = await readProjectFile('src/components/Navbar.jsx');
    const pulseBlock = extractCssBlock(css, '@keyframes classifieds-pulse');
    const navUnderlineBlock = extractCssBlock(css, '.comic-main-nav-underline');

    assert.match(pulseBlock, /transform:\s*scale/);
    assert.doesNotMatch(pulseBlock, /box-shadow/);
    assert.match(navUnderlineBlock, /transform-origin:\s*left center;/);
    assert.doesNotMatch(navUnderlineBlock, /width\s+0\.2s/);
    assert.match(navbar, /scaleX\(\$\{desktopNavIndicator\.width\s*\/\s*NAV_INDICATOR_BASE_WIDTH\}\)/);
    assert.doesNotMatch(navbar, /useLayoutEffect/);
  });
});
