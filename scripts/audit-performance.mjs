import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distAssetsRoot = path.join(repoRoot, 'dist', 'assets');

const budgets = [
  { label: 'vendor', matcher: /^vendor-.*\.js$/i, maxBytes: 210 * 1024 },
  { label: 'motion', matcher: /^motion-.*\.js$/i, maxBytes: 145 * 1024 },
  { label: 'recharts', matcher: /^recharts-.*\.js$/i, maxBytes: 420 * 1024 },
  { label: 'index', matcher: /^index-.*\.js$/i, maxBytes: 135 * 1024 },
  { label: 'ManageArticles', matcher: /^ManageArticles-.*\.js$/i, maxBytes: 110 * 1024 },
  { label: 'ManageGamePuzzles', matcher: /^ManageGamePuzzles-.*\.js$/i, maxBytes: 80 * 1024 },
  { label: 'ManageAds', matcher: /^ManageAds-.*\.js$/i, maxBytes: 65 * 1024 },
  { label: 'ManageSiteSettings', matcher: /^ManageSiteSettings-.*\.js$/i, maxBytes: 42 * 1024 },
];

function toKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

const assetEntries = await readdir(distAssetsRoot, { withFileTypes: true });
const jsAssets = [];

for (const entry of assetEntries) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const fullPath = path.join(distAssetsRoot, entry.name);
  const source = await readFile(fullPath, 'utf8');
  jsAssets.push({
    name: entry.name,
    bytes: source.length,
  });
}

jsAssets.sort((left, right) => right.bytes - left.bytes);

console.log('Performance audit');
console.log('=================');
console.log('Largest JS assets:');
for (const asset of jsAssets.slice(0, 12)) {
  console.log(`- ${asset.name}: ${toKiB(asset.bytes)}`);
}
console.log('');

let hasFailures = false;
console.log('Budget checks:');
for (const budget of budgets) {
  const asset = jsAssets.find((candidate) => budget.matcher.test(candidate.name));
  if (!asset) {
    hasFailures = true;
    console.log(`- FAIL ${budget.label}: missing built asset`);
    continue;
  }

  const withinBudget = asset.bytes <= budget.maxBytes;
  const marker = withinBudget ? 'PASS' : 'FAIL';
  console.log(`- ${marker} ${budget.label}: ${toKiB(asset.bytes)} / ${toKiB(budget.maxBytes)}`);
  if (!withinBudget) hasFailures = true;
}

if (hasFailures) {
  console.error('\nPerformance budget exceeded.');
  process.exitCode = 1;
}
