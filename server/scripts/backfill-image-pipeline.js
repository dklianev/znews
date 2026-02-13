import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', 'uploads');
const widths = [320, 640, 960, 1280];

const args = process.argv.slice(2);
const force = args.includes('--force');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : 0;

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function isOriginalUploadFile(name) {
  if (!/^[a-zA-Z0-9._-]+$/.test(name || '')) return false;
  if (name.startsWith('_')) return false;
  return !name.includes('-w') && !name.includes('-avif') && !name.includes('-webp');
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function getVariantRelativeDir(fileName) {
  return path.posix.join('_variants', path.parse(fileName).name);
}

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default || mod;
  } catch {
    return null;
  }
}

async function listSourceFiles() {
  if (!fs.existsSync(uploadsDir)) return [];
  const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => allowedExtensions.has(path.extname(name).toLowerCase()))
    .filter((name) => isOriginalUploadFile(name))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

async function readManifest(fileName) {
  try {
    const raw = await fs.promises.readFile(
      path.join(uploadsDir, getVariantRelativeDir(fileName), 'manifest.json'),
      'utf8'
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function generatePipelineForFile(fileName, sharp) {
  const sourcePath = path.join(uploadsDir, fileName);
  const variantsDir = path.join(uploadsDir, ...getVariantRelativeDir(fileName).split('/'));
  await fs.promises.mkdir(variantsDir, { recursive: true });

  const source = sharp(sourcePath, { failOn: 'none' }).rotate();
  const meta = await source.metadata();
  const sourceWidth = Number(meta.width) || null;
  const sourceHeight = Number(meta.height) || null;

  const variantWidths = [...new Set(
    widths
      .map((width) => sourceWidth ? Math.min(width, sourceWidth) : width)
      .filter((width) => Number.isFinite(width) && width > 0)
  )].sort((a, b) => a - b);

  const variants = [];
  for (const width of variantWidths) {
    const webpName = `w${width}.webp`;
    const avifName = `w${width}.avif`;

    await sharp(sourcePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toFile(path.join(variantsDir, webpName));

    await sharp(sourcePath)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .avif({ quality: 52 })
      .toFile(path.join(variantsDir, avifName));

    variants.push({
      width,
      webp: `/uploads/${toPosixPath(path.posix.join(getVariantRelativeDir(fileName), webpName))}`,
      avif: `/uploads/${toPosixPath(path.posix.join(getVariantRelativeDir(fileName), avifName))}`,
    });
  }

  const blurName = 'blur.webp';
  await sharp(sourcePath)
    .rotate()
    .resize({ width: 32, withoutEnlargement: true })
    .blur(2)
    .webp({ quality: 48 })
    .toFile(path.join(variantsDir, blurName));

  const manifest = {
    generatedAt: new Date().toISOString(),
    original: {
      url: `/uploads/${encodeURIComponent(fileName)}`,
      width: sourceWidth,
      height: sourceHeight,
      format: meta.format || '',
    },
    placeholder: `/uploads/${toPosixPath(path.posix.join(getVariantRelativeDir(fileName), blurName))}`,
    variants,
  };

  await fs.promises.writeFile(path.join(variantsDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

async function main() {
  const sharp = await loadSharp();
  if (!sharp) {
    console.error('sharp is not installed. Run: npm install sharp');
    process.exit(1);
  }

  const files = await listSourceFiles();
  const scoped = Number.isInteger(limit) && limit > 0 ? files.slice(0, limit) : files;
  const summary = {
    total: scoped.length,
    scanned: files.length,
    generated: 0,
    regenerated: 0,
    skipped: 0,
    failed: 0,
    force: Boolean(force),
  };

  for (const fileName of scoped) {
    try {
      const existing = await readManifest(fileName);
      if (existing && !force) {
        summary.skipped += 1;
        continue;
      }
      await generatePipelineForFile(fileName, sharp);
      if (existing) summary.regenerated += 1;
      else summary.generated += 1;
      process.stdout.write(`processed ${fileName}\n`);
    } catch (error) {
      summary.failed += 1;
      process.stdout.write(`failed ${fileName}: ${error?.message || error}\n`);
    }
  }

  process.stdout.write(`done: ${JSON.stringify(summary)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
