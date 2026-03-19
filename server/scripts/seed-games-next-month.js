import mongoose from 'mongoose';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { seedGamesOnly, getSofiaDateString } from '../gameSeed.js';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true, quiet: true });

const startDate = process.env.GAME_START_DATE || getSofiaDateString(1);
const days = Number.parseInt(process.env.GAME_DAYS || '30', 10);
const gameSlugs = process.env.GAME_SLUGS ? process.env.GAME_SLUGS : undefined;
const overwriteDrafts = process.env.GAME_OVERWRITE_DRAFTS === 'true';
const isProd = process.env.NODE_ENV === 'production';

if (isProd && process.env.ALLOW_PRODUCTION_GAME_SEED !== 'true') {
  throw new Error('Refusing to run games-only seed in production without ALLOW_PRODUCTION_GAME_SEED=true.');
}

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zemun-news')
  .then(async () => {
    const result = await seedGamesOnly({
      startDate,
      days,
      overwriteDrafts,
      ...(gameSlugs ? { gameSlugs } : {}),
    });
    console.log('Games-only seed complete:', result);
  })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
