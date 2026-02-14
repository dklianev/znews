import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const width = 1200;
const height = 630;
const outPath = path.join(repoRoot, 'public', 'og.png');

const sourceCandidates = [
  process.env.OG_SOURCE,
  path.join(repoRoot, 'scripts', 'og-source.png'),
  path.join(repoRoot, 'scripts', 'og-source.jpg'),
  path.join(repoRoot, 'scripts', 'og-source.jpeg'),
  path.join(repoRoot, 'scripts', 'og-source.webp'),
].filter(Boolean);

const sourcePath = sourceCandidates.find((p) => fs.existsSync(p));

if (sourcePath) {
  const meta = await sharp(sourcePath).metadata();
  const sourceW = meta.width ?? 0;
  const sourceH = meta.height ?? 0;
  const targetRatio = width / height;
  const sourceRatio = sourceH ? sourceW / sourceH : 0;
  const ratioDelta = Math.abs(sourceRatio - targetRatio);

  // If the source already matches the OG ratio, do a simple resize/encode
  // to avoid unintended stylistic changes (blur/vignette).
  if (sourceW && sourceH && ratioDelta < 0.01) {
    await sharp(sourcePath)
      .resize(width, height, { fit: 'cover' })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outPath);

    console.log(`✓ Wrote ${outPath} from ${sourcePath}`);
    process.exit(0);
  }

  // Otherwise: fit the artwork inside the OG frame, and fill the rest with a
  // blurred version of itself so we don't crop important parts.
  const background = await sharp(sourcePath)
    .resize(width, height, { fit: 'cover' })
    .blur(32)
    .modulate({ brightness: 0.95, saturation: 1.08 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const foreground = await sharp(sourcePath)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await sharp(background)
    .composite([
      { input: foreground, top: 0, left: 0 },
      // Subtle vignette for contrast at the edges.
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <defs>
              <radialGradient id="v" cx="50%" cy="48%" r="70%">
                <stop offset="65%" stop-color="#000" stop-opacity="0"/>
                <stop offset="100%" stop-color="#000" stop-opacity="0.28"/>
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#v)"/>
          </svg>`,
          'utf8'
        ),
        top: 0,
        left: 0,
      },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);

  console.log(`✓ Wrote ${outPath} from ${sourcePath}`);
  process.exit(0);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#20182e"/>
      <stop offset="100%" stop-color="#3b1d2f"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff3a1e"/>
      <stop offset="100%" stop-color="#ff8d22"/>
    </linearGradient>
    <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="2" fill="#ffffff" opacity="0.06"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#dots)"/>
  <circle cx="1030" cy="90" r="210" fill="url(#accent)" opacity="0.20"/>
  <circle cx="180" cy="560" r="240" fill="url(#accent)" opacity="0.16"/>

  <!-- Card -->
  <g filter="url(#shadow)">
    <rect x="80" y="80" width="1040" height="470" rx="34" fill="#f4ead7"/>
    <rect x="80" y="80" width="1040" height="470" rx="34" fill="none" stroke="#20182e" stroke-width="10"/>
  </g>

  <!-- Logo (vector, inspired by favicon.svg) -->
  <g transform="translate(130 155) scale(5)">
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ff3a1e"/>
        <stop offset="100%" stop-color="#ff8d22"/>
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="56" height="56" rx="12" fill="#f4ead7"/>
    <rect x="4" y="4" width="56" height="56" rx="12" fill="none" stroke="#20182e" stroke-width="4"/>
    <path d="M18 19h28v7L28 45h18v7H17v-7l19-19H18z" transform="translate(0.5 -3.5)" fill="url(#logoGrad)" stroke="#20182e" stroke-width="2.5"/>
  </g>

  <!-- Text -->
  <text x="460" y="312"
    font-family="Impact, 'Arial Black', 'Segoe UI Black', 'Segoe UI', Arial, sans-serif"
    font-size="126"
    letter-spacing="1"
    fill="url(#accent)"
    stroke="#20182e"
    stroke-width="10"
    paint-order="stroke"
  >zNews</text>

  <text x="463" y="382"
    font-family="'Segoe UI', Arial, sans-serif"
    font-size="38"
    fill="#20182e"
    opacity="0.92"
  >Горещи новини, скандали и слухове.</text>

  <text x="463" y="438"
    font-family="'Segoe UI', Arial, sans-serif"
    font-size="28"
    fill="#20182e"
    opacity="0.78"
  >Los Santos • znews.live</text>

  <!-- Corner stamp -->
  <g transform="translate(920 476) rotate(-6)">
    <rect x="0" y="0" width="235" height="56" rx="14" fill="#20182e"/>
    <rect x="0" y="0" width="235" height="56" rx="14" fill="none" stroke="#20182e" stroke-width="6"/>
    <text x="118" y="38"
      text-anchor="middle"
      font-family="Impact, 'Arial Black', 'Segoe UI Black', 'Segoe UI', Arial, sans-serif"
      font-size="30"
      fill="#f4ead7"
      letter-spacing="1"
    >BREAKING</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outPath);

console.log(`✓ Wrote ${outPath}`);
