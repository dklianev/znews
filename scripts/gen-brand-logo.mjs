// Generate a pre-rendered brand logo PNG using SVG with proper stroke/shadow.
// Run once: node scripts/gen-brand-logo.mjs
// Output: server/fonts/brand-logo.png

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, '..', 'server', 'fonts', 'brand-logo.png');

// Use the bundled font as a base64 data URI inside the SVG so librsvg can use it.
const fontPath = path.join(__dirname, '..', 'server', 'fonts', 'NotoSans.ttf');
const fontBase64 = fs.readFileSync(fontPath).toString('base64');

async function main() {
  console.log('Generating brand logo via SVG...');

  const W = 320, H = 56;
  const fontSize = 40;
  const liveSize = 22;
  const y = 42; // baseline

  // SVG with embedded font, proper stroke via paint-order, and drop shadow.
  // "zNews" is ONE text element with tspans for different colors — no gaps.
  // We render faux-stroke by drawing the text twice: first the stroke, then the fill on top.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @font-face {
        font-family: 'Logo';
        src: url('data:font/truetype;base64,${fontBase64}');
      }
    </style>
    <linearGradient id="newsGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.5)" />
    </filter>
  </defs>
  <g filter="url(#shadow)" font-family="'Logo', 'Noto Sans', sans-serif" font-weight="900">
    <!-- Stroke layer (behind) -->
    <text x="2" y="${y}" font-size="${fontSize}" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="round">zNews</text>
    <!-- Fill layer: z=white, News=gradient -->
    <text x="2" y="${y}" font-size="${fontSize}">
      <tspan fill="#ffffff">z</tspan><tspan fill="url(#newsGrad)">News</tspan>
    </text>
    <!-- .live stroke + fill -->
    <text x="2" y="${y}" font-size="${fontSize}" fill="none" stroke="none" xml:space="preserve"><tspan visibility="hidden">zNews</tspan><tspan font-size="${liveSize}" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linejoin="round">.live</tspan></text>
    <text x="2" y="${y}" font-size="${fontSize}" fill="none" xml:space="preserve"><tspan visibility="hidden">zNews</tspan><tspan font-size="${liveSize}" fill="#f97316">.live</tspan></text>
  </g>
</svg>`;

  // Render SVG → PNG at 2x for crisp result, then resize down
  const raw = await sharp(Buffer.from(svg, 'utf8'), { density: 192 })
    .png()
    .toBuffer();

  // Trim and resize to target height
  const trimmed = await sharp(raw)
    .trim()
    .resize({ height: H, withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  fs.writeFileSync(outFile, trimmed.data);
  console.log(`Brand logo saved: ${outFile} (${trimmed.data.length} bytes, ${trimmed.info.width}x${trimmed.info.height})`);
}

main().catch(e => console.error('ERROR:', e));
