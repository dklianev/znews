import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { Ad } from '../models.js';
import { buildAdMigrationPlan } from '../../shared/adMigration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

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
    throw new Error('Set a real MONGODB_URI before running ad migration. Refusing to guess a database target.');
  }
  if (process.env.NODE_ENV === 'production' && write && !allowProduction) {
    throw new Error('Refusing production write without --allow-production.');
  }
}

function formatPatch(patch) {
  return JSON.stringify(patch, null, 2);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertSafeExecution(options);

  const targetUri = String(process.env.MONGODB_URI || '').trim();
  console.log(`Ad migration target: ${redactMongoUri(targetUri)}`);
  console.log(options.write ? 'Mode: WRITE (update-only, no deletes)' : 'Mode: DRY RUN (no writes)');

  await mongoose.connect(targetUri);

  const ads = await Ad.find().sort({ id: 1 }).lean();
  const plans = ads.map((ad) => buildAdMigrationPlan(ad)).filter((plan) => plan.hasChanges);

  console.log(`Scanned ads: ${ads.length}`);
  console.log(`Ads needing normalization: ${plans.length}`);

  if (plans.length === 0) {
    console.log('No ad updates required.');
    return;
  }

  plans.forEach((plan) => {
    console.log(`- [${plan.id}] ${plan.title}`);
    console.log(formatPatch(plan.patch));
  });

  if (!options.write) {
    console.log('Dry run finished. Re-run with --write to persist these updates.');
    return;
  }

  let updated = 0;
  for (const plan of plans) {
    await Ad.updateOne({ id: plan.id }, { $set: plan.patch });
    updated += 1;
  }

  console.log(`Applied updates to ${updated} ads.`);
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
