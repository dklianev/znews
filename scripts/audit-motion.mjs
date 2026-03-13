import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');
const distAssetsRoot = path.join(repoRoot, 'dist', 'assets');

async function collectSourceFiles(dir, bucket = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(entryPath, bucket);
      continue;
    }
    if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      bucket.push(entryPath);
    }
  }
  return bucket;
}

function toKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

const sourceFiles = await collectSourceFiles(srcRoot);
const sourceStats = [];

for (const filePath of sourceFiles) {
  const source = await readFile(filePath, 'utf8');
  if (!source.includes('framer-motion')) continue;

  sourceStats.push({
    file: path.relative(repoRoot, filePath),
    animatePresence: countMatches(source, /AnimatePresence/g),
    layoutId: countMatches(source, /layoutId=/g),
    whileHover: countMatches(source, /whileHover=/g),
    whileTap: countMatches(source, /whileTap=/g),
    motionImports: countMatches(source, /from 'framer-motion'/g),
  });
}

const assetEntries = await readdir(distAssetsRoot, { withFileTypes: true });
const jsAssets = [];
for (const entry of assetEntries) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const fullPath = path.join(distAssetsRoot, entry.name);
  const source = await readFile(fullPath, 'utf8');
  jsAssets.push({
    name: entry.name,
    size: source.length,
    includesMotionRuntime: source.includes('framer-motion') || source.includes('motion-dom') || source.includes('motion-utils'),
  });
}

jsAssets.sort((left, right) => right.size - left.size);

const motionAssets = jsAssets.filter((asset) => asset.includesMotionRuntime || asset.name.toLowerCase().includes('motion'));

console.log('Motion usage audit');
console.log('==================');
console.log(`Source files importing framer-motion: ${sourceStats.length}`);
console.log(`AnimatePresence usages: ${sourceStats.reduce((sum, item) => sum + item.animatePresence, 0)}`);
console.log(`layoutId usages: ${sourceStats.reduce((sum, item) => sum + item.layoutId, 0)}`);
console.log(`whileHover usages: ${sourceStats.reduce((sum, item) => sum + item.whileHover, 0)}`);
console.log(`whileTap usages: ${sourceStats.reduce((sum, item) => sum + item.whileTap, 0)}`);
console.log('');
console.log('Heaviest motion call-sites:');
for (const item of sourceStats.sort((left, right) => (right.animatePresence + right.whileHover + right.whileTap) - (left.animatePresence + left.whileHover + left.whileTap)).slice(0, 8)) {
  console.log(`- ${item.file}: AnimatePresence=${item.animatePresence}, layoutId=${item.layoutId}, whileHover=${item.whileHover}, whileTap=${item.whileTap}`);
}
console.log('');
console.log('Largest JS assets:');
for (const asset of jsAssets.slice(0, 10)) {
  const marker = asset.includesMotionRuntime ? ' [motion]' : '';
  console.log(`- ${asset.name}: ${toKilobytes(asset.size)}${marker}`);
}
console.log('');
console.log('Motion-related assets:');
for (const asset of motionAssets) {
  console.log(`- ${asset.name}: ${toKilobytes(asset.size)}`);
}
