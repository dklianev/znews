import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import {
  Article,
  Category,
  Classified,
  Court,
  Event,
  Job,
  User,
  Wanted,
} from '../models.js';
import {
  deriveArticlePublishAtDate,
  normalizeClassifiedPriceValue,
  normalizeSearchField,
  normalizeSearchList,
  normalizeUsernameLower,
} from '../services/derivedFieldsService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true, quiet: true });

const BULK_WRITE_BATCH_SIZE = 500;

function parseArgs(argv = []) {
  const args = new Set((Array.isArray(argv) ? argv : []).map((item) => String(item || '').trim()));
  return {
    write: args.has('--write'),
    allowProduction: args.has('--allow-production'),
  };
}

function redactMongoUri(uri) {
  return String(uri || '').replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@');
}

function assertSafeExecution({ write, allowProduction }) {
  const uri = String(process.env.MONGODB_URI || '').trim();
  const isPlaceholder = !uri || /YOUR_PASSWORD|xxxxx|user:password/i.test(uri);
  if (isPlaceholder) {
    throw new Error('Set a real MONGODB_URI before running derived field backfill.');
  }
  if (process.env.NODE_ENV === 'production' && write && !allowProduction) {
    throw new Error('Refusing production write without --allow-production.');
  }
}

function isSameDateValue(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const leftDate = left instanceof Date ? left : new Date(left);
  const rightDate = right instanceof Date ? right : new Date(right);
  if (!Number.isFinite(leftDate.getTime()) && !Number.isFinite(rightDate.getTime())) return true;
  return leftDate.getTime() === rightDate.getTime();
}

function isSameArray(left, right) {
  if (!Array.isArray(left) && !Array.isArray(right)) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function buildArticleDerivedUpdate(doc) {
  const nextTitleSearch = normalizeSearchField(doc?.title, 240);
  const nextTagsSearch = normalizeSearchList(doc?.tags, 64, 24);
  const nextPublishAtDate = deriveArticlePublishAtDate(doc);
  const update = {};

  if ((doc?.titleSearch || '') !== nextTitleSearch) update.titleSearch = nextTitleSearch;
  if (!isSameArray(doc?.tagsSearch, nextTagsSearch)) update.tagsSearch = nextTagsSearch;
  if (!isSameDateValue(doc?.publishAtDate, nextPublishAtDate)) update.publishAtDate = nextPublishAtDate;

  return update;
}

function buildCategoryDerivedUpdate(doc) {
  const nextNameSearch = normalizeSearchField(doc?.name, 120);
  const nextIdSearch = normalizeSearchField(doc?.id, 80);
  const update = {};
  if ((doc?.nameSearch || '') !== nextNameSearch) update.nameSearch = nextNameSearch;
  if ((doc?.idSearch || '') !== nextIdSearch) update.idSearch = nextIdSearch;
  return update;
}

function buildWantedDerivedUpdate(doc) {
  const nextNameSearch = normalizeSearchField(doc?.name, 160);
  const nextChargeSearch = normalizeSearchField(doc?.charge, 160);
  const update = {};
  if ((doc?.nameSearch || '') !== nextNameSearch) update.nameSearch = nextNameSearch;
  if ((doc?.chargeSearch || '') !== nextChargeSearch) update.chargeSearch = nextChargeSearch;
  return update;
}

function buildJobDerivedUpdate(doc) {
  const nextTitleSearch = normalizeSearchField(doc?.title, 180);
  const nextOrgSearch = normalizeSearchField(doc?.org, 180);
  const update = {};
  if ((doc?.titleSearch || '') !== nextTitleSearch) update.titleSearch = nextTitleSearch;
  if ((doc?.orgSearch || '') !== nextOrgSearch) update.orgSearch = nextOrgSearch;
  return update;
}

function buildCourtDerivedUpdate(doc) {
  const nextTitleSearch = normalizeSearchField(doc?.title, 180);
  const nextDefendantSearch = normalizeSearchField(doc?.defendant, 180);
  const update = {};
  if ((doc?.titleSearch || '') !== nextTitleSearch) update.titleSearch = nextTitleSearch;
  if ((doc?.defendantSearch || '') !== nextDefendantSearch) update.defendantSearch = nextDefendantSearch;
  return update;
}

function buildEventDerivedUpdate(doc) {
  const nextTitleSearch = normalizeSearchField(doc?.title, 180);
  const nextLocationSearch = normalizeSearchField(doc?.location, 180);
  const update = {};
  if ((doc?.titleSearch || '') !== nextTitleSearch) update.titleSearch = nextTitleSearch;
  if ((doc?.locationSearch || '') !== nextLocationSearch) update.locationSearch = nextLocationSearch;
  return update;
}

function buildClassifiedDerivedUpdate(doc) {
  const nextPriceValue = normalizeClassifiedPriceValue(doc?.price);
  return doc?.priceValue === nextPriceValue ? {} : { priceValue: nextPriceValue };
}

async function flushBulkWrite(Model, operations) {
  if (!Array.isArray(operations) || operations.length === 0) return;
  await Model.bulkWrite(operations, { ordered: false });
  operations.length = 0;
}

async function runGenericBackfill(Model, label, projection, buildUpdate, { write }) {
  const docs = await Model.find({}, projection).sort({ _id: 1 }).lean();
  const operations = [];
  let changed = 0;

  for (const doc of docs) {
    const update = buildUpdate(doc);
    if (!update || Object.keys(update).length === 0) continue;
    changed += 1;
    if (!write) continue;
    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: update },
      },
    });
    if (operations.length >= BULK_WRITE_BATCH_SIZE) {
      await flushBulkWrite(Model, operations);
    }
  }

  if (write) {
    await flushBulkWrite(Model, operations);
  }

  return { label, scanned: docs.length, changed };
}

async function runUserBackfill({ write }) {
  const users = await User.find({}, { _id: 1, id: 1, username: 1, usernameLower: 1 }).sort({ _id: 1 }).lean();
  const normalizedBuckets = new Map();

  users.forEach((user) => {
    const normalized = normalizeUsernameLower(user?.username);
    if (!normalized) return;
    const bucket = normalizedBuckets.get(normalized) || [];
    bucket.push(user);
    normalizedBuckets.set(normalized, bucket);
  });

  const collisionIds = new Set();
  const collisions = [];
  normalizedBuckets.forEach((bucket, normalized) => {
    if (bucket.length <= 1) return;
    collisions.push({ normalized, ids: bucket.map((item) => item.id) });
    bucket.forEach((item) => collisionIds.add(String(item._id)));
  });

  const operations = [];
  let changed = 0;
  users.forEach((user) => {
    if (collisionIds.has(String(user._id))) return;
    const nextUsernameLower = normalizeUsernameLower(user?.username);
    if ((user?.usernameLower || '') === nextUsernameLower) return;
    changed += 1;
    if (!write) return;
    operations.push({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { usernameLower: nextUsernameLower } },
      },
    });
  });

  if (write) {
    await flushBulkWrite(User, operations);
  }

  return {
    label: 'User',
    scanned: users.length,
    changed,
    collisions,
  };
}

function printSummary(result) {
  console.log(`${result.label}: scanned=${result.scanned}, changed=${result.changed}`);
  if (Array.isArray(result.collisions) && result.collisions.length > 0) {
    result.collisions.forEach((collision) => {
      console.log(`  collision "${collision.normalized}" -> ids: ${collision.ids.join(', ')}`);
    });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertSafeExecution(options);

  const targetUri = String(process.env.MONGODB_URI || '').trim();
  console.log(`Derived field backfill target: ${redactMongoUri(targetUri)}`);
  console.log(options.write ? 'Mode: WRITE' : 'Mode: DRY RUN');

  await mongoose.connect(targetUri);

  const results = [];
  results.push(await runUserBackfill(options));
  results.push(await runGenericBackfill(
    Article,
    'Article',
    { _id: 1, title: 1, titleSearch: 1, tags: 1, tagsSearch: 1, publishAt: 1, publishAtDate: 1, date: 1 },
    buildArticleDerivedUpdate,
    options,
  ));
  results.push(await runGenericBackfill(Category, 'Category', { _id: 1, id: 1, idSearch: 1, name: 1, nameSearch: 1 }, buildCategoryDerivedUpdate, options));
  results.push(await runGenericBackfill(Wanted, 'Wanted', { _id: 1, name: 1, nameSearch: 1, charge: 1, chargeSearch: 1 }, buildWantedDerivedUpdate, options));
  results.push(await runGenericBackfill(Job, 'Job', { _id: 1, title: 1, titleSearch: 1, org: 1, orgSearch: 1 }, buildJobDerivedUpdate, options));
  results.push(await runGenericBackfill(Court, 'Court', { _id: 1, title: 1, titleSearch: 1, defendant: 1, defendantSearch: 1 }, buildCourtDerivedUpdate, options));
  results.push(await runGenericBackfill(Event, 'Event', { _id: 1, title: 1, titleSearch: 1, location: 1, locationSearch: 1 }, buildEventDerivedUpdate, options));
  results.push(await runGenericBackfill(Classified, 'Classified', { _id: 1, price: 1, priceValue: 1 }, buildClassifiedDerivedUpdate, options));

  console.log('Backfill summary:');
  results.forEach(printSummary);
  const collisionCount = results.reduce((sum, result) => sum + (Array.isArray(result.collisions) ? result.collisions.length : 0), 0);
  if (collisionCount > 0) {
    console.log(`Skipped ${collisionCount} usernameLower collisions. Resolve them manually before enforcing the index everywhere.`);
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
