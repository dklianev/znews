import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { Article } from '../models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true, quiet: true });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv = []) {
  const args = new Set((Array.isArray(argv) ? argv : []).map((item) => String(item || '').trim()));
  return {
    write: args.has('--write'),
    allowProduction: args.has('--allow-production'),
    limit: Number.parseInt(Array.from(args).find((item) => item.startsWith('--limit='))?.split('=')[1] || '200', 10),
  };
}

function redactMongoUri(uri) {
  return String(uri || '').replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@');
}

function assertSafeExecution({ write, allowProduction }) {
  const uri = String(process.env.MONGODB_URI || '').trim();
  const isPlaceholder = !uri || /YOUR_PASSWORD|xxxxx|user:password/i.test(uri);
  if (isPlaceholder) {
    throw new Error('Set a real MONGODB_URI before running article date audit. Refusing to guess a database target.');
  }
  if (process.env.NODE_ENV === 'production' && write && !allowProduction) {
    throw new Error('Refusing production write without --allow-production.');
  }
}

function isValidDateString(value) {
  return DATE_RE.test(String(value || '').trim());
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function buildAuditEntry(article) {
  const rawDate = typeof article?.date === 'string' ? article.date.trim() : '';
  const publishAtIso = article?.publishAt ? toIsoDate(article.publishAt) : '';
  const createdAtIso = article?.createdAt ? toIsoDate(article.createdAt) : '';
  const hasValidDate = isValidDateString(rawDate);
  const suggestedDate = publishAtIso || '';
  const canAutoFix = !hasValidDate && Boolean(suggestedDate);

  return {
    id: Number(article?.id),
    title: String(article?.title || '').trim(),
    status: String(article?.status || '').trim(),
    date: rawDate,
    publishAt: article?.publishAt || null,
    createdAt: article?.createdAt || null,
    hasValidDate,
    suggestedDate,
    canAutoFix,
    needsManualReview: !hasValidDate && !canAutoFix,
    reason: hasValidDate
      ? 'valid'
      : suggestedDate
        ? 'invalid-or-missing-date_with-publishAt-fallback'
        : 'invalid-or-missing-date_without-safe-fallback',
    createdAtIso,
  };
}

function printEntry(entry) {
  console.log(`- [${entry.id}] ${entry.title || '(untitled)'}`);
  console.log(`  status=${entry.status || '(none)'}`);
  console.log(`  date=${entry.date || '(empty)'}`);
  console.log(`  publishAt=${entry.publishAt ? new Date(entry.publishAt).toISOString() : '(empty)'}`);
  console.log(`  suggestedDate=${entry.suggestedDate || '(none)'}`);
  console.log(`  action=${entry.canAutoFix ? 'auto-fixable' : entry.needsManualReview ? 'manual-review' : 'none'}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertSafeExecution(options);

  const targetUri = String(process.env.MONGODB_URI || '').trim();
  console.log(`Article date audit target: ${redactMongoUri(targetUri)}`);
  console.log(options.write ? 'Mode: WRITE (safe fixes only)' : 'Mode: DRY RUN (no writes)');

  await mongoose.connect(targetUri);

  const articles = await Article.find({}, {
    _id: 0,
    id: 1,
    title: 1,
    status: 1,
    date: 1,
    publishAt: 1,
    createdAt: 1,
  }).sort({ id: -1 }).lean();

  const invalidEntries = articles
    .map(buildAuditEntry)
    .filter((entry) => !entry.hasValidDate);

  const autoFixable = invalidEntries.filter((entry) => entry.canAutoFix);
  const manualReview = invalidEntries.filter((entry) => entry.needsManualReview);

  console.log(`Scanned articles: ${articles.length}`);
  console.log(`Articles with invalid/missing date: ${invalidEntries.length}`);
  console.log(`Auto-fixable from publishAt: ${autoFixable.length}`);
  console.log(`Manual review required: ${manualReview.length}`);

  const previewLimit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 200;
  if (invalidEntries.length > 0) {
    console.log(`Previewing up to ${previewLimit} problematic articles:`);
    invalidEntries.slice(0, previewLimit).forEach(printEntry);
  }

  if (!options.write) {
    console.log('Dry run finished. Re-run with --write to persist safe fixes.');
    return;
  }

  if (autoFixable.length === 0) {
    console.log('No safe auto-fixes available.');
    return;
  }

  let updated = 0;
  for (const entry of autoFixable) {
    const result = await Article.updateOne(
      { id: entry.id, $or: [{ date: { $exists: false } }, { date: entry.date }] },
      { $set: { date: entry.suggestedDate } }
    );
    updated += Number(result?.modifiedCount || 0);
  }

  console.log(`Applied safe date fixes to ${updated} articles.`);
  if (manualReview.length > 0) {
    console.log(`${manualReview.length} articles still require manual review.`);
  }
}

main()
  .then(() => mongoose.connection.close())
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error?.message || error);
    try {
      await mongoose.connection.close();
    } catch {
      // ignore close errors on failure path
    }
    process.exit(1);
  });
