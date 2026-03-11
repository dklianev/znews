import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import compression from 'compression';
import dns from 'dns';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import webpush from 'web-push';
import { isIP } from 'node:net';
import { allocateNumericId } from './numericId.js';
import { streamJsonArray, writeJsonChunk } from './jsonExport.js';
import { getClientUserAgent, getTrustedClientIp, hashTrustedClientFingerprint } from './requestIdentity.js';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { randomUUID, createHash } from 'crypto';

// Some networks have broken SRV resolution for MongoDB Atlas.
// In managed platforms (e.g. Azure App Service), overriding DNS can break SRV lookups,
// so we only override in non-production unless explicitly configured.
const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
const mongoDnsServersEnv = process.env.MONGODB_DNS_SERVERS;
if (mongoDnsServersEnv && mongoDnsServersEnv.trim()) {
  try {
    const servers = mongoDnsServersEnv.split(',').map(s => s.trim()).filter(Boolean);
    if (servers.length) dns.setServers(servers);
  } catch (e) {
    console.warn(`⚠ Failed to apply MONGODB_DNS_SERVERS: ${e?.message || e}`);
  }
} else if (nodeEnv !== 'production') {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}

import {
  Article, Author, Category, Ad, AdEvent, Breaking, User,
  Wanted, Job, Court, Event, Poll, Comment, CommentReaction, ContactMessage, Gallery, Permission, HeroSettings, SiteSettings, ArticleRevision, SettingsRevision, ArticleView, PollVote, AuthSession, AuditLog, Tip, PushSubscription, GameDefinition, GamePuzzle, Counter, SystemEvent, BackgroundJobState, AdAnalyticsAggregate, SearchQueryStat
} from './models.js';
import { ensureGameDefinitions, seedGamesOnly } from './gameSeed.js';
import { sortArticlesByRecency } from '../shared/articleRecency.js';
import { buildHomepageSections, buildHomepageSectionIdPayload } from '../shared/homepageSelectors.js';
import { AD_PAGE_TYPES, AD_STATUS_OPTIONS, AD_TYPES, getAdSlot, getDefaultPlacementsForType, isKnownAdSlot } from '../shared/adSlots.js';
import { filterPublicAds, getAdRotationPool, normalizeAdFitMode, normalizeAdImageMeta, normalizeAdRecord } from '../shared/adResolver.js';
import { AD_ANALYTICS_RETENTION_DAYS, AD_EVENT_TYPES, AD_IMPRESSION_WINDOW_MS, DEFAULT_AD_ANALYTICS_DAYS } from '../shared/adAnalytics.js';
import { analyzeCrosswordConstruction, getCrosswordEntries, MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH } from '../shared/crossword.js';
import { analyzeSpellingBeeWords, getSpellingBeeWordScore, getSpellingBeeWordValidation, hasCompleteSpellingBeeHive, normalizeSpellingBeeLetter, normalizeSpellingBeeOuterLetters, normalizeSpellingBeeWord, normalizeSpellingBeeWords, SPELLING_BEE_MIN_WORD_LENGTH } from '../shared/spellingBee.js';
import { filterSearchResultsByType, normalizeSearchType } from '../shared/search.js';
import { buildSearchRegex, getSearchSuggestions, getTrendingSearches, recordSearchQuery } from './searchService.js';
import { registerHealthRoutes } from './routes/healthRoutes.js';
import { registerSearchRoutes } from './routes/searchRoutes.js';
import { registerMonitoringRoutes } from './routes/monitoringRoutes.js';
import { registerMediaRoutes } from './routes/mediaRoutes.js';
import { registerUploadRoutes } from './routes/uploadRoutes.js';
import { registerTipRoutes } from './routes/tipRoutes.js';
import { registerPushRoutes } from './routes/pushRoutes.js';
import { registerOpsRoutes } from './routes/opsRoutes.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerPermissionRoutes } from './routes/permissionRoutes.js';
import { registerSettingsRoutes } from './routes/settingsRoutes.js';
import { createCommentsRouter } from './routes/commentsRoutes.js';
import { createCategoriesRouter } from './routes/categoriesRoutes.js';
import { createPublicGamesRouter } from './routes/publicGamesRoutes.js';
import { createAdminGamesRouter } from './routes/adminGamesRoutes.js';
import { createContactMessagesRouter } from './routes/contactMessagesRoutes.js';
import { createDiagnosticsService } from './services/diagnosticsService.js';
import { createBackgroundJobsService } from './services/backgroundJobsService.js';
import { createMonitoringService } from './services/monitoringService.js';
import { createAuthzService } from './services/authzService.js';
import { createCacheService } from './services/cacheService.js';
import { createHealthService } from './services/healthService.js';
import { createContentMaintenanceService } from './services/contentMaintenanceService.js';
import { createAdAnalyticsRollupService } from './services/adAnalyticsRollupService.js';
import { createUploadDedupService } from './services/uploadDedupService.js';
import { createBackupExportService } from './services/backupExportService.js';
import { createStoragePathService } from './services/storagePathService.js';
import { createRemoteStorageService } from './services/remoteStorageService.js';
import { createStorageObjectService } from './services/storageObjectService.js';
import { createImagePipelineService } from './services/imagePipelineService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

// ─── Web Push Configuration ───
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@znews.live',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✓ Web Push Configured');
} else {
  console.warn('⚠ Web Push VAPID keys missing in .env');
}

// ─── Bundled font for Sharp share card rendering ───
// On Azure/Linux servers there are no Cyrillic system fonts.
// We use sharp's text() API with fontfile to bypass fontconfig entirely.
const bundledFontFile = (() => {
  const p = path.join(__dirname, 'fonts', 'NotoSans.ttf');
  if (fs.existsSync(p)) {
    console.log(`✓ Bundled font: ${p}`);
    return p;
  }
  console.warn('⚠ server/fonts/NotoSans.ttf not found — share card Cyrillic text may break.');
  return null;
})();

// Pre-rendered brand logo with outline/stroke (generated by scripts/gen-brand-logo.mjs)
const brandLogoPng = (() => {
  const p = path.join(__dirname, 'fonts', 'brand-logo.png');
  if (fs.existsSync(p)) {
    console.log(`✓ Brand logo: ${p}`);
    return fs.readFileSync(p);
  }
  console.warn('⚠ server/fonts/brand-logo.png not found — share card brand will be missing.');
  return null;
})();

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const rawJwtSecret = process.env.JWT_SECRET;
const rawRefreshSecret = process.env.REFRESH_TOKEN_SECRET || rawJwtSecret;
let shuttingDown = false;

// ─── API Performance Caching ───
const apiCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const apiCacheMeta = new Map();
const apiCacheInvalidationLog = [];
const API_CACHE_INVALIDATION_LOG_LIMIT = 30;
const API_CACHE_TAG_PATTERNS = Object.freeze({
  articles: ['/api/articles', '/api/search'],
  authors: ['/api/authors', '/api/bootstrap', '/api/homepage'],
  ads: ['/api/ads', '/api/bootstrap', '/api/homepage'],
  bootstrap: ['/api/bootstrap'],
  breaking: ['/api/breaking', '/api/bootstrap', '/api/homepage'],
  categories: ['/api/categories', '/api/bootstrap', '/api/homepage'],
  contact: ['/api/contact-messages'],
  court: ['/api/court', '/api/bootstrap'],
  events: ['/api/events', '/api/bootstrap'],
  gallery: ['/api/gallery', '/api/bootstrap'],
  games: ['/api/games', '/api/bootstrap', '/api/homepage'],
  hero: ['/api/hero-settings', '/api/homepage'],
  homepage: ['/api/homepage'],
  jobs: ['/api/jobs', '/api/bootstrap'],
  media: ['/api/media'],
  permissions: ['/api/permissions'],
  polls: ['/api/polls', '/api/bootstrap', '/api/homepage'],
  search: ['/api/search'],
  'site-settings': ['/api/site-settings', '/api/bootstrap', '/api/homepage'],
  tips: ['/api/tips'],
  users: ['/api/users'],
  wanted: ['/api/wanted', '/api/bootstrap', '/api/homepage'],
});
const CACHE_TAG_GROUPS = Object.freeze({
  ads: ['ads', 'bootstrap', 'homepage'],
  articles: ['articles', 'breaking', 'bootstrap', 'homepage', 'search'],
  breaking: ['breaking', 'bootstrap', 'homepage'],
  categories: ['categories', 'bootstrap', 'homepage'],
  events: ['events', 'bootstrap'],
  gallery: ['gallery', 'bootstrap'],
  games: ['games', 'bootstrap', 'homepage'],
  hero: ['hero', 'bootstrap', 'homepage'],
  homepage: ['homepage', 'bootstrap'],
  jobs: ['jobs', 'bootstrap'],
  media: ['media'],
  permissions: ['permissions'],
  polls: ['polls', 'bootstrap', 'homepage'],
  settings: ['site-settings', 'bootstrap', 'homepage'],
  wanted: ['wanted', 'bootstrap', 'homepage'],
});

const {
  cacheMiddleware,
  clearApiCacheKeys,
  getApiCacheStats,
  invalidateCacheGroup,
  invalidateCacheTags,
} = createCacheService({
  apiCache,
  apiCacheInvalidationLog,
  apiCacheMeta,
  apiCacheTagPatterns: API_CACHE_TAG_PATTERNS,
  cacheInvalidationLogLimit: API_CACHE_INVALIDATION_LOG_LIMIT,
  cacheTagGroups: CACHE_TAG_GROUPS,
  log: (message) => console.log(message),
});

const { buildHealthPayload, getMongoHealthState } = createHealthService({
  getApiCacheStats,
  getShuttingDown: () => shuttingDown,
  mongoose,
});

registerHealthRoutes(app, { buildHealthPayload });

app.use((req, res, next) => {
  if (!shuttingDown) return next();
  // Allow load balancers/clients to drop keep-alive connections during deploy/restart.
  res.set('Connection', 'close');
  return res.status(503).json({ error: 'Server is restarting. Please try again shortly.' });
});

function publicError(error, fallback = 'Server error') {
  return isProd ? fallback : (error?.message || fallback);
}

if (isProd && (!rawJwtSecret || rawJwtSecret.length < 32 || rawJwtSecret.toLowerCase().includes('change-me'))) {
  console.error('✗ JWT_SECRET is missing or too weak for production.');
  process.exit(1);
}
if (isProd && (!rawRefreshSecret || rawRefreshSecret.length < 32 || rawRefreshSecret.toLowerCase().includes('change-me'))) {
  console.error('✗ REFRESH_TOKEN_SECRET is missing or too weak for production.');
  process.exit(1);
}

const JWT_SECRET = rawJwtSecret || 'dev-secret-change-this-before-production';
const REFRESH_TOKEN_SECRET = rawRefreshSecret || 'dev-refresh-secret-change-this-before-production';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL_DAYS = Math.max(
  1,
  Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '', 10) || 14
);
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'zn_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';
const refreshTokenMaxAgeMs = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

function parseDurationToMs(value, fallbackMs) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return fallbackMs;
  if (/^\d+$/.test(raw)) {
    const numeric = Number.parseInt(raw, 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallbackMs;
  }
  const match = raw.match(/^(\d+)\s*(ms|s|m|h|d)$/);
  if (!match) return fallbackMs;
  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;
  const unit = match[2];
  const map = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (map[unit] || 1);
}

const accessTokenMaxAgeMs = parseDurationToMs(ACCESS_TOKEN_EXPIRES_IN, 15 * 60 * 1000);
function getPublishedFilter(now = new Date()) {
  return {
    $and: [
      { $or: [{ status: 'published' }, { status: { $exists: false } }] },
      { $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }] },
    ],
  };
}
const DEFAULT_HERO_SETTINGS = Object.freeze({
  headline: 'ТАЙНИ СРЕЩИ НА ПЛАЖА\nИ ПАРКА!',
  shockLabel: 'ШОК!',
  ctaLabel: 'РАЗКРИЙ ВСИЧКО ТУК!',
  headlineBoardText: 'ШОК И СЕНЗАЦИЯ!',
  heroTitleScale: 100,
  captions: ['В КОЛАТА НА ПОЛИЦАЯ!', 'ГОРЕЩА ПРЕГРЪДКА!', 'ТАЙНА СРЕЩА В ПАРКА!'],
  mainPhotoArticleId: null,
  photoArticleIds: [],
});

const DEFAULT_SITE_SETTINGS = Object.freeze({
  breakingBadgeLabel: 'ГОРЕЩО!',
  navbarLinks: [
    { to: '/', label: 'Начало' },
    { to: '/category/crime', label: 'Криминални', hot: true },
    { to: '/category/underground', label: 'Подземен свят', hot: true },
    { to: '/category/emergency', label: 'Полиция' },
    { to: '/category/breaking', label: 'Извънредни', hot: true },
    { to: '/category/reportage', label: 'Репортажи' },
    { to: '/category/politics', label: 'Политика' },
    { to: '/category/business', label: 'Бизнес' },
    { to: '/category/society', label: 'Общество' },
    { to: '/tipline', label: 'Сигнали', hot: true },
    { to: '/jobs', label: 'Работа' },
    { to: '/court', label: 'Съд' },
    { to: '/events', label: 'Събития' },
    { to: '/gallery', label: 'Галерия' },
  ],
  spotlightLinks: [
    { to: '/category/crime', label: 'Горещо', icon: 'Flame', hot: true, tilt: '-2deg' },
    { to: '/category/underground', label: 'Скандали', icon: 'Megaphone', hot: true, tilt: '1.5deg' },
    { to: '/category/society', label: 'Слухове', icon: 'Bell', hot: false, tilt: '-1deg' },
  ],
  footerPills: [
    { label: 'Горещо', to: '/category/crime', hot: true, tilt: '-1.5deg' },
    { label: 'Скандали', to: '/category/underground', hot: true, tilt: '1deg' },
    { label: 'Слухове', to: '/category/society', hot: false, tilt: '-0.8deg' },
    { label: 'Криминални', to: '/category/crime', hot: false, tilt: '0.8deg' },
    { label: 'Бизнес', to: '/category/business', hot: false, tilt: '-1deg' },
  ],
  footerQuickLinks: [
    { label: 'Криминални', to: '/category/crime' },
    { label: 'Подземен свят', to: '/category/underground' },
    { label: 'Полиция', to: '/category/emergency' },
    { label: 'Извънредни', to: '/category/breaking' },
    { label: 'Политика', to: '/category/politics' },
    { label: 'Бизнес', to: '/category/business' },
    { label: 'Общество', to: '/category/society' },
  ],
  footerInfoLinks: [
    { label: 'За нас', to: '/about' },
    { label: 'Работа', to: '/jobs' },
    { label: 'Съдебна хроника', to: '/court' },
    { label: 'Събития', to: '/events' },
    { label: 'Галерия', to: '/gallery' },
  ],
  contact: {
    address: 'Vinewood Blvd 42, Los Santos',
    phone: '+381 11 123 4567',
    email: 'redakciq@znews.live',
  },
  about: {
    heroText: 'Независим новинарски портал за града Los Santos. Доставяме ви новини, репортажи и разследвания 24 часа в денонощието, 7 дни в седмицата.',
    missionTitle: 'Нашата мисия',
    missionParagraph1: 'zNews е създаден с целта да предостави на гражданите на Los Santos честна, навременна и безпристрастна информация за случващото се в града. Ние вярваме в силата на журналистиката да информира, образова и вдъхновява промяна.',
    missionParagraph2: 'Нашият екип от опитни журналисти работи денонощно, за да покрива всички аспекти на живота в Los Santos — от криминалните хроники до обществените събития, от бизнес новините до спортните триумфи.',
    adIntro: 'Искаш да рекламираш своя бизнес в Los Santos? zNews предлага разнообразни рекламни формати:',
    adPlans: [
      { name: 'Банер (горен)', price: '$500/месец', desc: 'Хоризонтален банер в горната част' },
      { name: 'Банер (страничен)', price: '$300/месец', desc: 'Странично каре в sidebar' },
      { name: 'Банер (в статия)', price: '$400/месец', desc: 'Вграден в съдържанието' },
    ],
  },
  layoutPresets: {
    homeFeatured: 'default',
    homeCrime: 'default',
    homeReportage: 'default',
    homeEmergency: 'default',
    articleRelated: 'default',
    categoryListing: 'default',
    searchListing: 'default',
  },
  tipLinePromo: {
    enabled: true,
    title: 'Имаш ли новина за нас?',
    description: 'Стана ли свидетел на нещо скандално, незаконно или просто интересно? Прати ни ексклузивен сигнал и снимки напълно анонимно!',
    buttonLabel: 'ПОДАЙ СИГНАЛ',
    buttonLink: '/tipline',
  },
});

const BREAKING_CATEGORY_LABEL = 'Извънредни';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001'];

if (isProd && allowedOrigins.length === 0) {
  console.error('✗ ALLOWED_ORIGINS must be configured in production.');
  process.exit(1);
}

const blockedCommentTerms = (process.env.BLOCKED_COMMENT_TERMS || 'http://,https://,<script,</script')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const imageMimeToExt = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};
const allowedImageExtensions = new Set(Object.values(imageMimeToExt));
const imagePipelineWidths = [320, 640, 960, 1280];
let sharpLoaderPromise = null;
let sharpMissingWarned = false;
const pollVoteWindowMs = Math.max(
  5 * 60 * 1000,
  Number.parseInt(process.env.POLL_VOTE_WINDOW_MS || '', 10) || (24 * 60 * 60 * 1000)
);
const articleViewWindowMs = Math.max(
  60 * 1000,
  Number.parseInt(process.env.ARTICLE_VIEW_WINDOW_MS || '', 10) || (6 * 60 * 60 * 1000)
);
const adImpressionWindowMs = AD_IMPRESSION_WINDOW_MS;
const adAnalyticsRetentionMs = AD_ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const storageDriverInput = String(process.env.STORAGE_DRIVER || 'disk').trim().toLowerCase();
const storageDriver = ['disk', 'spaces', 'azure'].includes(storageDriverInput) ? storageDriverInput : 'disk';
const isSpacesStorage = storageDriver === 'spaces';
const isAzureStorage = storageDriver === 'azure';
const isRemoteStorage = isSpacesStorage || isAzureStorage;
const spacesBucket = String(process.env.SPACES_BUCKET || '').trim();
const spacesRegion = String(process.env.SPACES_REGION || '').trim();
const spacesEndpoint = String(process.env.SPACES_ENDPOINT || '').trim();
const spacesKey = String(process.env.SPACES_KEY || '').trim();
const spacesSecret = String(process.env.SPACES_SECRET || '').trim();
const spacesObjectAcl = String(process.env.SPACES_OBJECT_ACL || 'public-read').trim();
const defaultSpacesEndpoint = spacesRegion ? `https://${spacesRegion}.digitaloceanspaces.com` : '';
const normalizedSpacesEndpoint = (spacesEndpoint || defaultSpacesEndpoint).replace(/\/+$/, '');
const spacesPublicBaseUrl = String(process.env.SPACES_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '')
  || (normalizedSpacesEndpoint && spacesBucket ? `${normalizedSpacesEndpoint}/${spacesBucket}` : '');
const azureBlobAccount = String(process.env.AZURE_BLOB_ACCOUNT || '').trim();
const azureBlobContainer = String(process.env.AZURE_BLOB_CONTAINER || '').trim();
const azureBlobEndpoint = String(process.env.AZURE_BLOB_ENDPOINT || '').trim();
const azureBlobSasToken = String(process.env.AZURE_BLOB_SAS_TOKEN || '').trim().replace(/^\?/, '');
const azureBlobApiVersion = String(process.env.AZURE_BLOB_API_VERSION || '2023-11-03').trim();
const defaultAzureBlobEndpoint = azureBlobAccount ? `https://${azureBlobAccount}.blob.core.windows.net` : '';
const normalizedAzureBlobEndpoint = (azureBlobEndpoint || defaultAzureBlobEndpoint).replace(/\/+$/, '');
const azureBlobPublicBaseUrl = String(process.env.AZURE_BLOB_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '')
  || (normalizedAzureBlobEndpoint && azureBlobContainer ? `${normalizedAzureBlobEndpoint}/${azureBlobContainer}` : '');
const storageUploadsPrefix = 'uploads';
const storagePublicBaseUrl = isSpacesStorage
  ? spacesPublicBaseUrl
  : (isAzureStorage ? azureBlobPublicBaseUrl : '');
const missingSpacesConfig = [];
const missingAzureConfig = [];
if (isSpacesStorage) {
  if (!spacesBucket) missingSpacesConfig.push('SPACES_BUCKET');
  if (!spacesRegion) missingSpacesConfig.push('SPACES_REGION');
  if (!normalizedSpacesEndpoint) missingSpacesConfig.push('SPACES_ENDPOINT');
  if (!spacesKey) missingSpacesConfig.push('SPACES_KEY');
  if (!spacesSecret) missingSpacesConfig.push('SPACES_SECRET');
  if (!spacesPublicBaseUrl) missingSpacesConfig.push('SPACES_PUBLIC_BASE_URL');
}
if (isAzureStorage) {
  if (!azureBlobContainer) missingAzureConfig.push('AZURE_BLOB_CONTAINER');
  if (!normalizedAzureBlobEndpoint) missingAzureConfig.push('AZURE_BLOB_ENDPOINT (or AZURE_BLOB_ACCOUNT)');
  if (!azureBlobSasToken) missingAzureConfig.push('AZURE_BLOB_SAS_TOKEN');
  if (!azureBlobPublicBaseUrl) missingAzureConfig.push('AZURE_BLOB_PUBLIC_BASE_URL');
}

if (storageDriverInput !== storageDriver) {
  console.warn(`⚠ Unknown STORAGE_DRIVER="${storageDriverInput}". Falling back to "disk".`);
}
if (isSpacesStorage && missingSpacesConfig.length > 0) {
  console.error(`✗ STORAGE_DRIVER=spaces requires: ${missingSpacesConfig.join(', ')}`);
  process.exit(1);
}
if (isAzureStorage && missingAzureConfig.length > 0) {
  console.error(`✗ STORAGE_DRIVER=azure requires: ${missingAzureConfig.join(', ')}`);
  process.exit(1);
}
const spacesS3Client = isSpacesStorage
  ? new S3Client({
    region: spacesRegion,
    endpoint: normalizedSpacesEndpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: spacesKey,
      secretAccessKey: spacesSecret,
    },
  })
  : null;

const trustProxyRaw = String(process.env.TRUST_PROXY || '').trim();
if (!trustProxyRaw) {
  app.set('trust proxy', 1);
} else if (/^(true|false)$/i.test(trustProxyRaw)) {
  app.set('trust proxy', trustProxyRaw.toLowerCase() === 'true');
} else {
  const trustProxyAsNumber = Number.parseInt(trustProxyRaw, 10);
  app.set('trust proxy', Number.isFinite(trustProxyAsNumber) ? trustProxyAsNumber : trustProxyRaw);
}

// ─── Security & Performance Middleware ───
app.use(compression());
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Allow Google Fonts stylesheet in production (dev uses Vite without this CSP).
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));

app.use(cors({
  origin(origin, cb) {
    // Non-browser clients don't send Origin.
    if (!origin) return cb(null, true);
    if (!isProd) return cb(null, true);
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
}));

function getClientIpForRateLimit(req) {
  return getTrustedClientIp(req);
}

function rateLimitKeyGenerator(req) {
  const ip = getClientIpForRateLimit(req);
  // Use helper so IPv6 users can't bypass limits by rotating addresses within a subnet.
  if (isIP(ip)) return ipKeyGenerator(ip, 56);

  const normalized = String(ip || '').trim();
  if (normalized && normalized !== 'unknown') return normalized;

  const fallbackFingerprint = [
    String(req.headers?.['x-forwarded-for'] || ''),
    String(req.headers?.['x-arr-clientip'] || ''),
    String(req.headers?.['cf-connecting-ip'] || ''),
    String(req.ip || ''),
    String(req.socket?.remoteAddress || ''),
    String(req.headers?.['user-agent'] || ''),
  ].join('|');

  return `fp:${createHash('sha1').update(fallbackFingerprint || 'unknown').digest('hex').slice(0, 32)}`;
}

function parseRateLimitPositiveInt(value, fallback, min = 1) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return parsed;
}

const rateLimitEnabledInDev = process.env.ENABLE_RATE_LIMIT_IN_DEV === 'true';
const shouldSkipRateLimit = () => !isProd && !rateLimitEnabledInDev;
const apiRateLimitWindowMs = parseDurationToMs(process.env.RATE_LIMIT_WINDOW, 15 * 60 * 1000);
const apiReadRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_READ_MAX, 1200, 100);
const apiWriteRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_WRITE_MAX, 300, 30);
const apiAuthRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_AUTH_MAX, 180, 30);
const apiAdminReadRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_ADMIN_READ_MAX, 1000, 100);
const apiAdminWriteRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_ADMIN_WRITE_MAX, 300, 30);
const apiMediaReadRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_MEDIA_READ_MAX, 1800, 100);
const apiMediaWriteRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_MEDIA_WRITE_MAX, 120, 10);
const isReadOnlyMethod = (method) => {
  const normalized = String(method || '').toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS';
};
const getApiPath = (req) => String(req.path || '').toLowerCase();
const isAuthApiPath = (req) => getApiPath(req).startsWith('/auth');
const isMediaApiPath = (req) => {
  const pathValue = getApiPath(req);
  return pathValue.startsWith('/upload') || pathValue.startsWith('/media');
};
const isAdminApiPath = (req) => {
  const pathValue = getApiPath(req);
  return pathValue.startsWith('/users')
    || pathValue.startsWith('/permissions')
    || pathValue.startsWith('/audit-log')
    || pathValue.startsWith('/tips')
    || pathValue.startsWith('/hero-settings/revisions')
    || pathValue.startsWith('/site-settings/revisions')
    || pathValue.startsWith('/site-settings/cache/homepage/refresh');
};

const apiReadLimiter = rateLimit({
  windowMs: apiRateLimitWindowMs,
  max: apiReadRateLimitMax,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit()
    || !isReadOnlyMethod(req.method)
    || isAuthApiPath(req)
    || isAdminApiPath(req)
    || isMediaApiPath(req),
  keyGenerator: rateLimitKeyGenerator,
});

const apiWriteLimiter = rateLimit({
  windowMs: apiRateLimitWindowMs,
  max: apiWriteRateLimitMax,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit()
    || isReadOnlyMethod(req.method)
    || isAuthApiPath(req)
    || isAdminApiPath(req)
    || isMediaApiPath(req),
  keyGenerator: rateLimitKeyGenerator,
});

const apiAuthLimiter = rateLimit({
  windowMs: apiRateLimitWindowMs,
  max: apiAuthRateLimitMax,
  message: { error: 'Too many authentication requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit() || !isAuthApiPath(req),
  keyGenerator: rateLimitKeyGenerator,
});

const apiAdminReadLimiter = rateLimit({
  windowMs: apiRateLimitWindowMs,
  max: apiAdminReadRateLimitMax,
  message: { error: 'Too many admin requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit() || !isReadOnlyMethod(req.method) || !isAdminApiPath(req),
  keyGenerator: rateLimitKeyGenerator,
});

const apiAdminWriteLimiter = rateLimit({
  windowMs: apiRateLimitWindowMs,
  max: apiAdminWriteRateLimitMax,
  message: { error: 'Too many admin write requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit() || isReadOnlyMethod(req.method) || !isAdminApiPath(req),
  keyGenerator: rateLimitKeyGenerator,
});

const apiMediaReadLimiter = rateLimit({
  windowMs: apiRateLimitWindowMs,
  max: apiMediaReadRateLimitMax,
  message: { error: 'Too many media requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit() || !isReadOnlyMethod(req.method) || !isMediaApiPath(req),
  keyGenerator: rateLimitKeyGenerator,
});

const apiMediaWriteLimiter = rateLimit({
  windowMs: apiRateLimitWindowMs,
  max: apiMediaWriteRateLimitMax,
  message: { error: 'Too many media uploads, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit() || isReadOnlyMethod(req.method) || !isMediaApiPath(req),
  keyGenerator: rateLimitKeyGenerator,
});

const clientMonitoringLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many client monitoring reports, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => shouldSkipRateLimit(),
  keyGenerator: rateLimitKeyGenerator,
});

app.use('/api/', apiReadLimiter);
app.use('/api/', apiWriteLimiter);
app.use('/api/', apiAuthLimiter);
app.use('/api/', apiAdminReadLimiter);
app.use('/api/', apiAdminWriteLimiter);
app.use('/api/', apiMediaReadLimiter);
app.use('/api/', apiMediaWriteLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
  skip: shouldSkipRateLimit,
  keyGenerator: rateLimitKeyGenerator,
});

const pollVoteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Too many poll votes from this IP. Please try again later.' },
  skip: shouldSkipRateLimit,
  keyGenerator: rateLimitKeyGenerator,
});

const commentCreateLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 3,
  message: { error: 'Too many comments from this IP. Please try again later.' },
  skip: shouldSkipRateLimit,
  keyGenerator: rateLimitKeyGenerator,
});

const commentReactionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: { error: 'Too many comment reactions from this IP. Please try again later.' },
  skip: shouldSkipRateLimit,
  keyGenerator: rateLimitKeyGenerator,
});

const contactMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many contact messages from this IP. Please try again later.' },
  skip: shouldSkipRateLimit,
  keyGenerator: rateLimitKeyGenerator,
});

app.use(express.json({ limit: '1mb' }));

// ─── File Uploads ───
const uploadsDir = path.join(__dirname, 'uploads');
if (!isRemoteStorage && !fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const uploadVariantsDir = path.join(uploadsDir, '_variants');
if (!isRemoteStorage && !fs.existsSync(uploadVariantsDir)) fs.mkdirSync(uploadVariantsDir, { recursive: true });
const shareCardsDir = path.join(uploadsDir, '_share');
if (!isRemoteStorage && !fs.existsSync(shareCardsDir)) fs.mkdirSync(shareCardsDir, { recursive: true });
const shareCardWidth = 1200;
const shareCardHeight = 630;

// Font stack for SVG text elements — fontconfig maps these to bundled Noto Sans
const shareCardFontStackDisplay = "Noto Sans, sans-serif";
const shareCardFontStackBody = "Noto Sans, sans-serif";

const {
  encodePathForUrl,
  getDiskAbsolutePath,
  getOriginalUploadUrl,
  toPosixRelativePath,
  toUploadsStorageKey,
  toUploadsUrlFromRelative,
} = createStoragePathService({
  isRemoteStorage,
  storagePublicBaseUrl,
  storageUploadsPrefix,
  uploadsDir,
});

// Multer always uses memoryStorage so we can process with sharp via buffer before writing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, GIF, and WebP files are allowed'));
  },
});

if (!isRemoteStorage) {
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: isProd ? '30d' : '1d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
} else {
  app.get('/uploads/*', (req, res) => {
    const rawSuffix = toPosixRelativePath(req.path.slice('/uploads/'.length));
    if (!rawSuffix || rawSuffix.includes('..')) return res.status(404).send('Not found');
    return res.redirect(302, toUploadsUrlFromRelative(rawSuffix));
  });
}

function isSafeUploadFilename(name) {
  return /^[a-zA-Z0-9._-]+$/.test(name || '');
}

function isOriginalUploadFileName(name) {
  if (!isSafeUploadFilename(name)) return false;
  if (name.startsWith('_')) return false;
  return !name.includes('-w') && !name.includes('-avif') && !name.includes('-webp');
}

function getVariantsRelativeDir(fileName) {
  return path.posix.join('_variants', path.parse(fileName).name);
}

function getVariantsAbsoluteDir(fileName) {
  return getDiskAbsolutePath(getVariantsRelativeDir(fileName));
}

function getManifestAbsolutePath(fileName) {
  return getDiskAbsolutePath(getManifestRelativePath(fileName));
}

function getManifestRelativePath(fileName) {
  return path.posix.join(getVariantsRelativeDir(fileName), 'manifest.json');
}

function getShareRelativePath(fileName) {
  return path.posix.join('_share', fileName);
}

async function loadSharp() {
  if (sharpLoaderPromise) return sharpLoaderPromise;
  sharpLoaderPromise = import('sharp')
    .then(mod => mod.default || mod)
    .catch(() => {
      if (!sharpMissingWarned) {
        sharpMissingWarned = true;
        console.warn('⚠ Image pipeline is disabled because optional dependency "sharp" is not available.');
      }
      return null;
    });
  return sharpLoaderPromise;
}

function createUploadFileName(mimeType) {
  const ext = imageMimeToExt[mimeType] || '.jpg';
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
}

async function readSdkBodyToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isStorageNotFoundError(error) {
  const code = error?.$metadata?.httpStatusCode;
  const name = String(error?.name || error?.Code || error?.code || '').toLowerCase();
  return code === 404 || name.includes('nosuchkey') || name.includes('notfound');
}

const {
  deleteRemoteKeys,
  listRemoteObjectsByPrefix,
  sendAzureBlobRequest,
} = createRemoteStorageService({
  azureBlobApiVersion,
  azureBlobContainer,
  azureBlobSasToken,
  encodePathForUrl,
  isAzureStorage,
  isSpacesStorage,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  normalizedAzureBlobEndpoint,
  spacesBucket,
  spacesS3Client,
});

const {
  deleteStorageObject,
  deleteStoragePrefix,
  getStorageObjectBuffer,
  putStorageObject,
  storageObjectExists,
} = createStorageObjectService({
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  deleteRemoteKeys,
  getDiskAbsolutePath,
  isAzureStorage,
  isRemoteStorage,
  isSpacesStorage,
  isStorageNotFoundError,
  listRemoteObjectsByPrefix,
  readSdkBodyToBuffer,
  sendAzureBlobRequest,
  spacesBucket,
  spacesObjectAcl,
  spacesS3Client,
  toPosixRelativePath,
  toUploadsStorageKey,
});

const {
  backfillImagePipeline,
  ensureImagePipeline,
  getImagePipelineStatus,
  getUploadFilenameFromUrl,
  listMediaFiles,
  readOriginalUploadBuffer,
  resolveImageMetaFromUrl,
  toImageMetaFromManifest,
} = createImagePipelineService({
  Article,
  Tip,
  allowedImageExtensions,
  getManifestAbsolutePath,
  getManifestRelativePath,
  getOriginalUploadUrl,
  getStorageObjectBuffer,
  getVariantsAbsoluteDir,
  getVariantsRelativeDir,
  imagePipelineWidths,
  isOriginalUploadFileName,
  isRemoteStorage,
  listRemoteObjectsByPrefix,
  loadSharp,
  logError: (...args) => console.error(...args),
  putStorageObject,
  toUploadsStorageKey,
  toUploadsUrlFromRelative,
  uploadsDir,
});

const transparentPng1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHC8IYQAAAABJRU5ErkJggg==',
  'base64'
);

const shareAccentPalettes = Object.freeze({
  red: { primary: '#ef1f1f', secondary: '#ff8a2a', ink: '#25162f' },
  orange: { primary: '#ff4d00', secondary: '#ffb22b', ink: '#25162f' },
  yellow: { primary: '#ffd548', secondary: '#ff8d22', ink: '#25162f' },
  purple: { primary: '#6d26ff', secondary: '#ff4b45', ink: '#25162f' },
  blue: { primary: '#185dff', secondary: '#28b0ff', ink: '#25162f' },
  emerald: { primary: '#00a872', secondary: '#6fd430', ink: '#25162f' },
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtmlToText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(value, maxLen) {
  const text = normalizeText(value, maxLen + 10);
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1)).trim()}...`;
}

function appendEllipsis(value, maxLen) {
  const text = String(value || '').trim();
  if (!text) return '...';
  if (text.endsWith('...')) return text;
  if (text.length >= Math.max(1, maxLen - 3)) {
    return `${text.slice(0, Math.max(1, maxLen - 3)).trim()}...`;
  }
  return `${text}...`;
}

function wrapTextLines(value, maxCharsPerLine, maxLines) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let current = '';
  let truncated = false;

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (word.length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = '';
      lines.push(clampText(word, maxCharsPerLine));
      if (lines.length >= maxLines) {
        truncated = i < words.length - 1;
        break;
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }
  if (truncated && lines.length > 0) {
    lines[lines.length - 1] = appendEllipsis(lines[lines.length - 1], Math.max(4, maxCharsPerLine));
  }
  return lines;
}

function resolveAutoShareAccent(article) {
  if (article.breaking) return 'red';
  switch (article.category) {
    case 'crime':
    case 'underground':
      return 'purple';
    case 'emergency':
      return 'red';
    case 'reportage':
    case 'business':
      return 'orange';
    case 'sports':
      return 'blue';
    case 'society':
      return 'yellow';
    default:
      return 'orange';
  }
}

function resolveSharePalette(article) {
  const accent = sanitizeShareAccent(article.shareAccent);
  const resolvedAccent = accent === 'auto' ? resolveAutoShareAccent(article) : accent;
  return shareAccentPalettes[resolvedAccent] || shareAccentPalettes.orange;
}

function getShareSourceUrl(article) {
  const shareImage = sanitizeMediaUrl(article?.shareImage);
  if (shareImage && shareImage !== '#') return shareImage;
  const image = sanitizeMediaUrl(article?.image);
  if (image && image !== '#') return image;
  return '';
}

async function resolveShareBackgroundInput(article) {
  const sourceUrl = getShareSourceUrl(article);
  if (!sourceUrl) return null;

  const uploadFileName = getUploadFilenameFromUrl(sourceUrl);
  if (uploadFileName) {
    const buffer = await readOriginalUploadBuffer(uploadFileName);
    if (buffer && buffer.byteLength > 0) return buffer;
    return null;
  }

  if (!/^https?:\/\//i.test(sourceUrl)) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: { Accept: 'image/*' },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const contentType = normalizeText(response.headers.get('content-type') || '', 80).toLowerCase();
    if (!contentType.startsWith('image/')) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 256) return null;
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function buildShareCardModel(article, categoryLabel) {
  const palette = resolveSharePalette(article);
  const normalizedTitle = normalizeText(article.shareTitle || article.title, 140) || 'zNews.live';
  const normalizedSubtitle = normalizeText(
    article.shareSubtitle || stripHtmlToText(article.excerpt || article.content || ''),
    130
  ) || 'Ексклузивни новини от града.';
  const normalizedBadge = normalizeText(
    article.shareBadge || (article.breaking ? 'ИЗВЪНРЕДНО' : 'EXCLUSIVE'),
    36
  ).toUpperCase();
  const titleLines = wrapTextLines(normalizedTitle.toUpperCase(), 18, 3);
  const subtitleLines = wrapTextLines(normalizedSubtitle, 34, 2);
  const category = normalizeText(categoryLabel || article.category || 'news', 40).replace(/[_-]+/g, ' ').toUpperCase();
  const dateLabel = normalizeText(article.date, 20);
  const maxTitleLen = titleLines.reduce((max, line) => Math.max(max, line.length), 0);
  const titleBaseFontSize = titleLines.length <= 1 ? 100 : titleLines.length === 2 ? 86 : 72;
  const titleFitRatio = Math.min(1, 18 / Math.max(10, maxTitleLen));
  const titleFontSize = Math.max(58, Math.round(titleBaseFontSize * titleFitRatio));
  const titleLineHeight = titleLines.length <= 1 ? 0 : Math.max(56, Math.round(titleFontSize * 0.93));

  const maxSubtitleLen = subtitleLines.reduce((max, line) => Math.max(max, line.length), 0);
  const subtitleBaseFontSize = subtitleLines.length > 1 ? 33 : 36;
  const subtitleFitRatio = Math.min(1, 30 / Math.max(12, maxSubtitleLen));
  const subtitleFontSize = Math.max(22, Math.round(subtitleBaseFontSize * subtitleFitRatio));
  const subtitleLineHeight = subtitleLines.length > 1 ? Math.max(28, Math.round(subtitleFontSize * 1.12)) : 0;
  const badgeFontSize = Math.max(36, Math.min(52, Math.round(560 / Math.max(8, normalizedBadge.length + 2))));
  const badgeWidth = Math.max(246, Math.min(410, Math.round(74 + normalizedBadge.length * (badgeFontSize * 0.62))));
  const badgeHeight = Math.max(62, Math.min(76, Math.round(badgeFontSize + 20)));
  const badgeTextLength = Math.max(130, badgeWidth - 56);

  const categoryText = category || 'NEWS';
  const categoryFontSize = Math.max(34, Math.min(52, Math.round(620 / Math.max(8, categoryText.length + 3))));
  const categoryChipWidth = Math.max(300, Math.min(460, Math.round(102 + categoryText.length * (categoryFontSize * 0.6))));
  const categoryTextLength = Math.max(180, categoryChipWidth - 58);
  const titleTextLength = 918;
  const subtitleTextLength = 882;
  const titleLineMeta = titleLines.map((line) => ({
    line,
    fit: line.length * titleFontSize * 0.62 > titleTextLength,
  }));
  const subtitleLineMeta = subtitleLines.map((line) => ({
    line,
    fit: line.length * subtitleFontSize * 0.55 > subtitleTextLength,
  }));

  return {
    palette,
    titleLines: titleLines.length > 0 ? titleLines : ['zNews.live'],
    subtitleLines: subtitleLines.length > 0 ? subtitleLines : ['Горещи новини и репортажи от улицата.'],
    titleLineMeta: titleLineMeta.length > 0 ? titleLineMeta : [{ line: 'zNews.live', fit: false }],
    subtitleLineMeta: subtitleLineMeta.length > 0 ? subtitleLineMeta : [{ line: 'Горещи новини и репортажи от улицата.', fit: false }],
    badge: normalizedBadge || 'EXCLUSIVE',
    category: categoryText,
    dateLabel,
    titleFontSize,
    titleLineHeight,
    subtitleFontSize,
    subtitleLineHeight,
    badgeFontSize,
    badgeWidth,
    badgeHeight,
    badgeTextLength,
    categoryFontSize,
    categoryChipWidth,
    categoryTextLength,
    titleTextLength,
    subtitleTextLength,
  };
}

function buildShareCardOverlaySvg(model) {
  const { palette } = model;

  // NOTE: This SVG contains NO text — all text is rendered via sharp text() API
  // with fontfile to guarantee Cyrillic rendering on servers without system fonts.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${shareCardWidth}" height="${shareCardHeight}" viewBox="0 0 ${shareCardWidth} ${shareCardHeight}">
  <defs>
    <linearGradient id="overlayFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#120d20" stop-opacity="0.15" />
      <stop offset="45%" stop-color="#120e21" stop-opacity="0.64" />
      <stop offset="100%" stop-color="#170f26" stop-opacity="0.96" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.primary}" />
      <stop offset="100%" stop-color="${palette.secondary}" />
    </linearGradient>
    <linearGradient id="footerMetal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#ece7f2" />
    </linearGradient>
    <pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.23)" />
    </pattern>
    <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(14,10,22,0.76)" />
      <stop offset="100%" stop-color="rgba(19,14,30,0.90)" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${shareCardWidth}" height="${shareCardHeight}" fill="url(#overlayFade)" />
  <rect x="0" y="0" width="${shareCardWidth}" height="${shareCardHeight}" fill="url(#dots)" opacity="0.12" />
  <rect x="30" y="28" width="${shareCardWidth - 60}" height="${shareCardHeight - 56}" rx="26" fill="none" stroke="#211533" stroke-width="7" />

  <rect x="72" y="54" width="${model.badgeWidth}" height="${model.badgeHeight}" rx="14" fill="url(#accent)" stroke="#241833" stroke-width="3" />

  <rect x="56" y="130" width="${shareCardWidth - 112}" height="374" rx="26" fill="url(#panelGrad)" stroke="rgba(255,255,255,0.30)" stroke-width="2.4" />
  <rect x="56" y="130" width="${shareCardWidth - 112}" height="12" rx="8" fill="url(#accent)" opacity="0.86" />
  <polygon points="${shareCardWidth - 136},148 ${shareCardWidth - 92},148 ${shareCardWidth - 130},212 ${shareCardWidth - 174},212" fill="url(#accent)" opacity="0.70" />

  <rect x="86" y="398" width="${shareCardWidth - 172}" height="96" rx="16" fill="rgba(255,255,255,0.10)" />

  <rect x="56" y="522" width="${shareCardWidth - 112}" height="86" rx="20" fill="url(#footerMetal)" stroke="#2a1d3d" stroke-width="2.4" />
  <rect x="78" y="540" width="${model.categoryChipWidth}" height="50" rx="12" fill="url(#accent)" stroke="#2b1c40" stroke-width="2.5" />
</svg>`;
}

// Render a text string as a transparent PNG buffer using Sharp's Pango text API.
// This bypasses fontconfig/librsvg and loads the font directly via fontfile.
async function renderTextImage(sharp, text, {
  fontSize = 40,
  fontWeight = 'bold',
  color = 'white',
  width = 400,
  height = 80,
  align = 'left',
} = {}) {
  if (!text || !bundledFontFile) return null;
  const pangoSize = Math.round(fontSize * 1024); // Pango uses 1/1024 pt units
  const weightAttr = fontWeight === '900' || fontWeight === 'bold' ? ' font_weight="bold"' : '';
  const escapedText = escapeHtml(text);
  const markup = `<span foreground="${color}"${weightAttr} font_size="${pangoSize}">${escapedText}</span>`;
  try {
    const { data, info } = await sharp({
      text: {
        text: markup,
        fontfile: bundledFontFile,
        rgba: true,
        width,
        height,
        align,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

async function cleanupOldShareCards(articleId, keepFileName) {
  try {
    const prefix = `article-${articleId}-`;
    if (isRemoteStorage) {
      const prefixKey = toUploadsStorageKey(path.posix.join('_share', prefix));
      const objects = await listRemoteObjectsByPrefix(prefixKey);
      const staleKeys = objects
        .map(item => String(item?.Key || ''))
        .filter(Boolean)
        .filter((key) => {
          const relative = key.startsWith(`${storageUploadsPrefix}/`) ? key.slice(`${storageUploadsPrefix}/`.length) : key;
          return !relative.endsWith(`/${keepFileName}`) && !relative.endsWith(keepFileName);
        });
      await deleteRemoteKeys(staleKeys);
      return;
    }

    const entries = await fs.promises.readdir(shareCardsDir, { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name !== keepFileName)
      .map((entry) => fs.promises.unlink(path.join(shareCardsDir, entry.name)).catch(() => { })));
  } catch {
    // ignore cleanup errors
  }
}

async function ensureArticleShareCard(article, { categoryLabel = '' } = {}) {
  const sharp = await loadSharp();
  if (!sharp || !article || !Number.isInteger(Number.parseInt(article.id, 10))) return null;

  const normalized = {
    ...buildArticleSnapshot(article),
    id: Number.parseInt(article.id, 10),
  };
  const model = buildShareCardModel(normalized, categoryLabel);
  const imageSource = getShareSourceUrl(normalized);
  const signature = createHash('sha1')
    .update(JSON.stringify({
      v: 'share-card-v24-brand-logo',
      id: normalized.id,
      title: normalized.title,
      excerpt: normalized.excerpt,
      content: normalized.content,
      category: normalized.category,
      date: normalized.date,
      breaking: normalized.breaking,
      shareTitle: normalized.shareTitle,
      shareSubtitle: normalized.shareSubtitle,
      shareBadge: normalized.shareBadge,
      shareAccent: normalized.shareAccent,
      shareImage: normalized.shareImage,
      image: normalized.image,
      imageSource,
      categoryLabel,
    }))
    .digest('hex')
    .slice(0, 14);

  const fileName = `article-${normalized.id}-${signature}.png`;
  const relativePath = getShareRelativePath(fileName);
  const absolutePath = isRemoteStorage ? null : getDiskAbsolutePath(relativePath);
  const url = toUploadsUrlFromRelative(relativePath);

  if (await storageObjectExists(relativePath)) {
    return { generated: true, fileName, absolutePath, relativePath, url };
  }

  const backgroundInput = await resolveShareBackgroundInput(normalized);
  const overlaySvg = Buffer.from(buildShareCardOverlaySvg(model), 'utf8');

  // Render all text elements via Sharp text() API with bundled fontfile.
  // This completely bypasses fontconfig/librsvg SVG text rendering.
  const titleText = model.titleLines.join('\n');
  const subtitleText = model.subtitleLines.join('\n');

  const [badge, title, subtitle, category, date] = await Promise.all([
    renderTextImage(sharp, model.badge, {
      fontSize: model.badgeFontSize,
      fontWeight: '900',
      color: 'white',
      width: model.badgeWidth - 30,
      height: model.badgeHeight,
      align: 'centre',
    }),
    renderTextImage(sharp, titleText, {
      fontSize: model.titleFontSize,
      fontWeight: '900',
      color: 'white',
      width: shareCardWidth - 200,
      height: 220,
    }),
    renderTextImage(sharp, subtitleText, {
      fontSize: model.subtitleFontSize,
      fontWeight: 'bold',
      color: '#f5f2fb',
      width: shareCardWidth - 210,
      height: 80,
    }),
    renderTextImage(sharp, model.category, {
      fontSize: model.categoryFontSize * 0.75,
      fontWeight: '900',
      color: model.palette.ink,
      width: model.categoryChipWidth - 40,
      height: 44,
      align: 'centre',
    }),
    model.dateLabel
      ? renderTextImage(sharp, model.dateLabel, {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3f2d56',
        width: 190,
        height: 26,
      })
      : null,
  ]);

  // Build composite layers: decorative SVG + precisely positioned text images.
  // Each text image is centred within its corresponding SVG decorative container.
  const composites = [{ input: overlaySvg }];

  // Badge — centred in badge rect (x=72, y=54)
  if (badge) composites.push({
    input: badge.buffer,
    top: Math.round(54 + (model.badgeHeight - badge.height) / 2),
    left: Math.round(72 + (model.badgeWidth - badge.width) / 2),
  });

  // Title — vertically centred in title zone (y=148..394, between accent strip and subtitle bg)
  if (title) {
    const zoneTop = 148, zoneH = 246;
    composites.push({
      input: title.buffer,
      top: Math.max(zoneTop, Math.round(zoneTop + (zoneH - title.height) / 2)),
      left: 94,
    });
  }

  // Subtitle — vertically centred in subtitle bg box (y=398, h=96)
  if (subtitle) composites.push({
    input: subtitle.buffer,
    top: Math.round(398 + (96 - subtitle.height) / 2),
    left: 96,
  });

  // Category — centred inside chip rect (x=78, y=540, h=50)
  if (category) composites.push({
    input: category.buffer,
    top: Math.round(540 + (50 - category.height) / 2),
    left: Math.round(78 + (model.categoryChipWidth - category.width) / 2),
  });

  // Brand logo (pre-rendered PNG with outline) + Date — right-aligned in footer (y=522, h=86)
  {
    const footerRight = shareCardWidth - 56;
    // Get brand logo dimensions
    let brandW = 0, brandH = 0;
    if (brandLogoPng) {
      const meta = await sharp(brandLogoPng).metadata();
      brandW = meta.width || 0;
      brandH = meta.height || 0;
    }
    const stackH = brandH + (date ? date.height - 2 : 0);
    const stackTop = Math.round(522 + (86 - stackH) / 2);
    if (brandLogoPng) composites.push({
      input: brandLogoPng,
      top: stackTop,
      left: Math.round(footerRight - brandW - 16),
    });
    if (date) composites.push({
      input: date.buffer,
      top: stackTop + brandH - 2,
      left: Math.round(footerRight - date.width - 16),
    });
  }

  let baseImage;
  if (backgroundInput) {
    baseImage = sharp(backgroundInput, { failOn: 'none' })
      .rotate()
      .resize(shareCardWidth, shareCardHeight, { fit: 'cover', position: 'centre' })
      .modulate({ brightness: 0.8, saturation: 1.1 });
  } else {
    const bg = resolveSharePalette(normalized);
    baseImage = sharp({
      create: {
        width: shareCardWidth,
        height: shareCardHeight,
        channels: 3,
        background: bg.primary,
      },
    });
  }

  const output = await baseImage
    .composite(composites)
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  await putStorageObject(relativePath, output, 'image/png');
  await cleanupOldShareCards(normalized.id, fileName);
  return { generated: true, fileName, absolutePath, relativePath, url };
}

async function resolveShareFallbackSource(article) {
  const sourceUrl = getShareSourceUrl(article);
  if (!sourceUrl) return null;
  const uploadFileName = getUploadFilenameFromUrl(sourceUrl);
  if (uploadFileName) {
    if (isRemoteStorage) {
      const exists = await storageObjectExists(uploadFileName);
      if (!exists) return null;
      return { type: 'redirect', url: getOriginalUploadUrl(uploadFileName) };
    }

    const fullPath = path.join(uploadsDir, uploadFileName);
    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
      return { type: 'file', path: fullPath };
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//i.test(sourceUrl)) return { type: 'redirect', url: sourceUrl };
  return null;
}

function getPublicBaseUrl(req) {
  const configured = normalizeText(process.env.PUBLIC_BASE_URL, 240);
  if (configured) return configured.replace(/\/+$/, '');
  const forwardedProto = normalizeText(req.headers['x-forwarded-proto'], 16).toLowerCase();
  const protocol = forwardedProto === 'https' ? 'https' : (req.protocol || 'http');
  const host = normalizeText(req.get('host'), 180);
  return host ? `${protocol}://${host}` : '';
}

// ─── Helpers ───
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeText(value, maxLen = 255) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, maxLen);
}

function sanitizeDate(value) {
  const date = normalizeText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
}

function sanitizeDateTime(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = normalizeText(String(value), 40);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function sanitizeMediaUrl(value) {
  const url = normalizeText(value, 2048);
  if (!url) return '';
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch { }
  return '';
}

function sanitizeExternalUrl(value) {
  const url = normalizeText(value, 2048);
  if (!url) return '#';
  if (url === '#') return '#';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch { }
  return '#';
}

function sanitizeImageWidth(value) {
  const normalized = normalizeText(String(value || ''), 8).replace('%', '');
  return ['25', '50', '75', '100'].includes(normalized) ? normalized : '100';
}

function sanitizeImageAlign(value) {
  const normalized = normalizeText(String(value || ''), 16).toLowerCase();
  return ['left', 'center', 'right'].includes(normalized) ? normalized : 'center';
}

function sanitizeTags(value) {
  const rawTags = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  return rawTags
    .map(tag => normalizeText(String(tag), 32))
    .filter(Boolean)
    .slice(0, 12);
}

const ARTICLE_FIELD_ALLOWLIST = new Set([
  'id',
  'title',
  'excerpt',
  'content',
  'category',
  'authorId',
  'date',
  'readTime',
  'image',
  'imageMeta',
  'featured',
  'breaking',
  'sponsored',
  'hero',
  'views',
  'tags',
  'status',
  'publishAt',
  'shareTitle',
  'shareSubtitle',
  'shareBadge',
  'shareAccent',
  'shareImage',
  'cardSticker',
]);

const HOMEPAGE_DEFAULT_ARTICLE_FIELDS = Object.freeze([
  'id',
  'title',
  'excerpt',
  'category',
  'authorId',
  'date',
  'readTime',
  'image',
  'imageMeta',
  'featured',
  'breaking',
  'sponsored',
  'hero',
  'views',
  'status',
  'publishAt',
  'cardSticker',
]);

const HOMEPAGE_DEFAULT_ARTICLE_PROJECTION = HOMEPAGE_DEFAULT_ARTICLE_FIELDS.reduce((acc, field) => {
  acc[field] = 1;
  return acc;
}, { _id: 0 });

const ARTICLE_SECTION_FILTERS = Object.freeze({
  homeFeatured: { featured: true },
  homeCrime: { category: { $in: ['crime', 'underground'] } },
  homeReportage: { category: 'reportage' },
  homeEmergency: { category: 'emergency' },
});

function parsePositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function escapeRegexForSearch(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildArticleProjection(fieldsParam) {
  if (typeof fieldsParam !== 'string' || !fieldsParam.trim()) return null;
  const fields = fieldsParam
    .split(',')
    .map(field => normalizeText(field, 40))
    .filter(Boolean)
    .filter(field => ARTICLE_FIELD_ALLOWLIST.has(field));

  if (fields.length === 0) return null;
  if (!fields.includes('id')) fields.unshift('id');
  return fields.reduce((acc, field) => {
    acc[field] = 1;
    return acc;
  }, { _id: 0 });
}

function getArticleSectionFilter(section) {
  const key = normalizeText(section, 40);
  return ARTICLE_SECTION_FILTERS[key] || null;
}

function combineMongoFilters(...filters) {
  const normalized = filters.filter((item) => item && typeof item === 'object' && Object.keys(item).length > 0);
  if (normalized.length === 0) return {};
  if (normalized.length === 1) return normalized[0];
  return { $and: normalized };
}

function parseCollectionPagination(query, { defaultLimit = 50, maxLimit = 250 } = {}) {
  const shouldPaginate = hasOwn(query, 'page') || hasOwn(query, 'limit');
  if (!shouldPaginate) {
    return {
      shouldPaginate: false,
      page: 1,
      limit: defaultLimit,
      skip: 0,
    };
  }

  const limit = parsePositiveInt(query.limit, defaultLimit, { min: 1, max: maxLimit });
  const page = parsePositiveInt(query.page, 1, { min: 1, max: 5000 });
  return {
    shouldPaginate: true,
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function stripDocumentList(items) {
  return (Array.isArray(items) ? items : []).map((item) => stripDocumentMetadata(item));
}

export function buildArticleRecencyPipeline(filter, fieldsProjection, { skip = 0, limit = 0 } = {}) {
  const pipeline = [
    { $match: filter || {} },
    {
      $addFields: {
        __recencySortTs: {
          $ifNull: [
            '$publishAt',
            {
              $dateFromString: {
                dateString: '$date',
                format: '%Y-%m-%d',
                onError: new Date(0),
                onNull: new Date(0),
              },
            },
          ],
        },
      },
    },
    { $sort: { __recencySortTs: -1, id: -1 } },
  ];

  if (Number.isInteger(skip) && skip > 0) {
    pipeline.push({ $skip: skip });
  }
  if (Number.isInteger(limit) && limit > 0) {
    pipeline.push({ $limit: limit });
  }

  const projection = fieldsProjection && typeof fieldsProjection === 'object'
    ? { ...fieldsProjection }
    : { _id: 0, __v: 0 };
  delete projection.__recencySortTs;
  projection._id = 0;
  // In MongoDB $project, mixing exclusion fields (like __v: 0) with inclusion
  // fields (like title: 1) is not allowed — only _id: 0 is the exception.
  // When using an inclusion projection, unlisted fields are already excluded.
  const hasInclusionFields = Object.entries(projection).some(
    ([key, val]) => key !== '_id' && (val === 1 || val === true)
  );
  if (!hasInclusionFields) {
    projection.__v = 0;
  }
  pipeline.push({ $project: projection });

  return pipeline;
}

async function findArticlesByRecency(filter, fieldsProjection, limit, options = {}) {
  const pipeline = buildArticleRecencyPipeline(filter, fieldsProjection, {
    skip: options.skip,
    limit,
  });
  const items = await Article.aggregate(pipeline);
  return stripDocumentList(items);
}

function isLegacyPublicArticle(article, now = new Date()) {
  if (!article || typeof article !== 'object') return false;

  const status = normalizeText(article.status, 24).toLowerCase();
  if (status === 'draft' || status === 'archived') return false;

  if (article.publishAt === null || article.publishAt === undefined || article.publishAt === '') {
    return true;
  }

  const publishAtTs = new Date(article.publishAt).getTime();
  if (!Number.isFinite(publishAtTs)) {
    return true;
  }

  return publishAtTs <= now.getTime();
}

async function findLegacyPublicArticles(fieldsProjection, { limit = 0, skip = 0, fetchLimit = 600 } = {}) {
  let query = Article.find().sort({ id: -1 });
  if (fieldsProjection && typeof fieldsProjection === 'object') {
    query = query.select(fieldsProjection);
  } else {
    query = query.select({ _id: 0, __v: 0 });
  }

  const desired = Number.isInteger(limit) && limit > 0 ? limit : 160;
  const offset = Number.isInteger(skip) && skip > 0 ? skip : 0;
  const safeFetchLimit = Math.min(1500, Math.max(fetchLimit, offset + desired + 80));
  const items = stripDocumentList(await query.limit(safeFetchLimit).lean());
  const visible = sortArticlesByRecency(items.filter((article) => isLegacyPublicArticle(article)));

  if (offset > 0) {
    return desired > 0 ? visible.slice(offset, offset + desired) : visible.slice(offset);
  }
  return desired > 0 ? visible.slice(0, desired) : visible;
}

async function countLegacyPublicArticles(fetchLimit = 3000) {
  const items = await Article.find().sort({ id: -1 }).select({ _id: 0, id: 1, status: 1, publishAt: 1 }).limit(fetchLimit).lean();
  return items.filter((article) => isLegacyPublicArticle(article)).length;
}

const HOMEPAGE_SECTION_BUFFER = 10;
const HOMEPAGE_LATEST_BUFFER = 24;

async function fetchHomepageArticleCandidates({ articleFilter, fieldsProjection, heroSettings, latestShowcaseLimit, latestWireLimit }) {
  const selectedHeroIds = [...new Set([
    Number.parseInt(heroSettings?.mainPhotoArticleId, 10),
    ...(Array.isArray(heroSettings?.photoArticleIds) ? heroSettings.photoArticleIds : []).map((value) => Number.parseInt(value, 10)),
  ].filter((value) => Number.isInteger(value) && value > 0))];

  const latestLimit = Math.min(
    160,
    Math.max(36, latestShowcaseLimit + latestWireLimit + HOMEPAGE_LATEST_BUFFER)
  );

  const [latest, hero, selected, featured, crime, breaking, emergency, reportage, sponsored] = await Promise.all([
    findArticlesByRecency(articleFilter, fieldsProjection, latestLimit),
    findArticlesByRecency(combineMongoFilters(articleFilter, { $or: [{ hero: true }, { breaking: true }] }), fieldsProjection, 8),
    selectedHeroIds.length > 0
      ? findArticlesByRecency(combineMongoFilters(articleFilter, { id: { $in: selectedHeroIds } }), fieldsProjection, selectedHeroIds.length)
      : Promise.resolve([]),
    findArticlesByRecency(combineMongoFilters(articleFilter, { featured: true }), fieldsProjection, 3 + HOMEPAGE_SECTION_BUFFER),
    findArticlesByRecency(combineMongoFilters(articleFilter, { category: { $in: ['crime', 'underground'] } }), fieldsProjection, 4 + HOMEPAGE_SECTION_BUFFER),
    findArticlesByRecency(combineMongoFilters(articleFilter, { category: 'breaking' }), fieldsProjection, 2 + HOMEPAGE_SECTION_BUFFER),
    findArticlesByRecency(combineMongoFilters(articleFilter, { category: 'emergency' }), fieldsProjection, 2 + HOMEPAGE_SECTION_BUFFER),
    findArticlesByRecency(combineMongoFilters(articleFilter, { category: 'reportage' }), fieldsProjection, 3 + HOMEPAGE_SECTION_BUFFER),
    findArticlesByRecency(combineMongoFilters(articleFilter, { sponsored: true }), fieldsProjection, 3 + HOMEPAGE_SECTION_BUFFER),
  ]);

  const seen = new Set();
  const merged = [];
  [selected, hero, featured, crime, breaking, emergency, reportage, sponsored, latest].forEach((group) => {
    group.forEach((article) => {
      const articleId = Number.parseInt(article?.id, 10);
      if (!Number.isInteger(articleId) || seen.has(articleId)) return;
      seen.add(articleId);
      merged.push(article);
    });
  });

  return sortArticlesByRecency(merged);
}

function isTextSearchUnavailableError(error) {
  const code = Number(error?.code);
  if (code === 27) return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes('text index required')
    || message.includes('index not found for $text')
    || message.includes('text index not found');
}

async function searchCollectionByTextAndRegex(Model, { textSearch, regexFilter, limit, projection, textSortField = 'id' }) {
  let normalizedTextItems = [];
  try {
    const textItems = await Model.find({ $text: { $search: textSearch } })
      .sort({ score: { $meta: 'textScore' }, [textSortField]: -1 })
      .limit(limit)
      .select(projection || { _id: 0, __v: 0 })
      .lean();
    normalizedTextItems = stripDocumentList(textItems);
  } catch (error) {
    if (!isTextSearchUnavailableError(error)) {
      throw error;
    }
  }

  if (normalizedTextItems.length >= limit) {
    return normalizedTextItems.slice(0, limit);
  }

  const existingIds = new Set(normalizedTextItems.map((item) => JSON.stringify(item?.id ?? item?.title ?? item?.name)));
  const fallbackItems = await Model.find(regexFilter)
    .sort({ [textSortField]: -1 })
    .limit(Math.max(limit * 2, limit + 4))
    .select(projection || { _id: 0, __v: 0 })
    .lean();

  const merged = [...normalizedTextItems];
  for (const item of stripDocumentList(fallbackItems)) {
    const dedupeKey = JSON.stringify(item?.id ?? item?.title ?? item?.name);
    if (existingIds.has(dedupeKey)) continue;
    existingIds.add(dedupeKey);
    merged.push(item);
    if (merged.length >= limit) break;
  }

  return merged;
}

function sanitizeSafeHtml(value) {
  if (typeof value !== 'string') return '';
  let html = value.replace(/\u0000/g, '').slice(0, 50000);

  // Remove dangerous blocks and obvious inline JS vectors.
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)[^>]*>[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)[^>]*\/?>/gi, '');
  html = html.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  html = html.replace(/\sstyle\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/\sstyle\s*=\s*[^\s>]+/gi, '');

  const allowedTags = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'hr', 'a', 'img']);

  html = html.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (fullMatch, rawTagName, rawAttrs) => {
    const tagName = rawTagName.toLowerCase();
    const isClosing = fullMatch.startsWith('</');

    if (!allowedTags.has(tagName)) return '';
    if (isClosing) return `</${tagName}>`;
    if (tagName === 'br' || tagName === 'hr') return `<${tagName}>`;
    if (tagName === 'img') {
      let src = '';
      let alt = '';
      let width = '';
      let align = '';

      const quotedSrcMatch = rawAttrs.match(/\ssrc\s*=\s*(['"])(.*?)\1/i);
      const bareSrcMatch = rawAttrs.match(/\ssrc\s*=\s*([^\s>]+)/i);
      const quotedAltMatch = rawAttrs.match(/\salt\s*=\s*(['"])(.*?)\1/i);
      const bareAltMatch = rawAttrs.match(/\salt\s*=\s*([^\s>]+)/i);
      const quotedWidthMatch = rawAttrs.match(/\sdata-width\s*=\s*(['"])(.*?)\1/i);
      const bareWidthMatch = rawAttrs.match(/\sdata-width\s*=\s*([^\s>]+)/i);
      const quotedAlignMatch = rawAttrs.match(/\sdata-align\s*=\s*(['"])(.*?)\1/i);
      const bareAlignMatch = rawAttrs.match(/\sdata-align\s*=\s*([^\s>]+)/i);

      if (quotedSrcMatch) src = quotedSrcMatch[2];
      else if (bareSrcMatch) src = bareSrcMatch[1];
      if (quotedAltMatch) alt = quotedAltMatch[2];
      else if (bareAltMatch) alt = bareAltMatch[1];
      if (quotedWidthMatch) width = quotedWidthMatch[2];
      else if (bareWidthMatch) width = bareWidthMatch[1];
      if (quotedAlignMatch) align = quotedAlignMatch[2];
      else if (bareAlignMatch) align = bareAlignMatch[1];

      const safeSrc = sanitizeMediaUrl(src);
      if (!safeSrc) return '';
      const safeAlt = normalizeText(alt, 180);
      const safeWidth = sanitizeImageWidth(width);
      const safeAlign = sanitizeImageAlign(align);
      return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(safeAlt)}" loading="lazy" decoding="async" data-width="${escapeHtml(safeWidth)}" data-align="${escapeHtml(safeAlign)}">`;
    }
    if (tagName !== 'a') return `<${tagName}>`;

    let href = '';
    const quotedHrefMatch = rawAttrs.match(/\shref\s*=\s*(['"])(.*?)\1/i);
    const bareHrefMatch = rawAttrs.match(/\shref\s*=\s*([^\s>]+)/i);
    if (quotedHrefMatch) href = quotedHrefMatch[2];
    else if (bareHrefMatch) href = bareHrefMatch[1];

    const safeHref = sanitizeExternalUrl(href);
    if (safeHref === '#') return '<a>';

    return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">`;
  });

  return html;
}

const allowedShareAccentValues = new Set(['auto', 'red', 'orange', 'yellow', 'purple', 'blue', 'emerald']);

function sanitizeShareAccent(value) {
  const accent = normalizeText(value, 20).toLowerCase();
  return allowedShareAccentValues.has(accent) ? accent : 'auto';
}

function sanitizeArticlePayload(payload, { partial = false } = {}) {
  const out = {};

  if (!partial || hasOwn(payload, 'title')) out.title = normalizeText(payload.title, 180);
  if (!partial || hasOwn(payload, 'excerpt')) out.excerpt = normalizeText(payload.excerpt, 450);
  if (!partial || hasOwn(payload, 'content')) out.content = sanitizeSafeHtml(payload.content);
  if (!partial || hasOwn(payload, 'category')) out.category = normalizeText(payload.category, 64);

  if (!partial || hasOwn(payload, 'authorId')) {
    const authorId = Number.parseInt(payload.authorId, 10);
    if (Number.isInteger(authorId) && authorId > 0) out.authorId = authorId;
    else if (!partial) out.authorId = 1;
  }

  if (!partial || hasOwn(payload, 'date')) out.date = sanitizeDate(payload.date);

  if (!partial || hasOwn(payload, 'readTime')) {
    const readTime = Number(payload.readTime);
    out.readTime = Number.isFinite(readTime) ? Math.max(1, Math.min(120, Math.round(readTime))) : 3;
  }

  if (!partial || hasOwn(payload, 'image')) out.image = sanitizeMediaUrl(payload.image);
  if (!partial || hasOwn(payload, 'imageMeta')) {
    out.imageMeta = payload.imageMeta && typeof payload.imageMeta === 'object' ? payload.imageMeta : null;
  }
  if (!partial || hasOwn(payload, 'youtubeUrl')) {
    out.youtubeUrl = payload.youtubeUrl ? normalizeText(payload.youtubeUrl, 500) : '';
  }
  if (!partial || hasOwn(payload, 'featured')) out.featured = Boolean(payload.featured);
  if (!partial || hasOwn(payload, 'breaking')) out.breaking = Boolean(payload.breaking);
  if (!partial || hasOwn(payload, 'sponsored')) out.sponsored = Boolean(payload.sponsored);
  if (!partial || hasOwn(payload, 'hero')) out.hero = Boolean(payload.hero);

  if (!partial || hasOwn(payload, 'tags')) out.tags = sanitizeTags(payload.tags);

  if (!partial || hasOwn(payload, 'status')) {
    out.status = payload.status === 'draft' ? 'draft' : 'published';
  }

  if (!partial || hasOwn(payload, 'publishAt')) {
    out.publishAt = sanitizeDateTime(payload.publishAt);
  }

  if (!partial || hasOwn(payload, 'views')) {
    const views = Number(payload.views);
    out.views = Number.isFinite(views) ? Math.max(0, Math.floor(views)) : 0;
  }

  if (!partial || hasOwn(payload, 'shareTitle')) {
    out.shareTitle = normalizeText(payload?.shareTitle, 120);
  }

  if (!partial || hasOwn(payload, 'shareSubtitle')) {
    out.shareSubtitle = normalizeText(payload?.shareSubtitle, 180);
  }

  if (!partial || hasOwn(payload, 'shareBadge')) {
    out.shareBadge = normalizeText(payload?.shareBadge, 36);
  }

  if (!partial || hasOwn(payload, 'shareAccent')) {
    out.shareAccent = sanitizeShareAccent(payload?.shareAccent);
  }

  if (!partial || hasOwn(payload, 'shareImage')) {
    out.shareImage = sanitizeMediaUrl(payload?.shareImage);
  }

  if (!partial || hasOwn(payload, 'cardSticker')) {
    out.cardSticker = normalizeText(payload?.cardSticker, 24);
  }

  return out;
}

function buildArticleSnapshot(articleLike) {
  return {
    title: normalizeText(articleLike?.title, 180),
    excerpt: normalizeText(articleLike?.excerpt, 450),
    content: sanitizeSafeHtml(articleLike?.content),
    category: normalizeText(articleLike?.category, 64),
    authorId: Number.isInteger(Number.parseInt(articleLike?.authorId, 10)) ? Number.parseInt(articleLike.authorId, 10) : 1,
    date: sanitizeDate(articleLike?.date),
    readTime: Number.isFinite(Number(articleLike?.readTime)) ? Math.max(1, Math.min(120, Math.round(Number(articleLike.readTime)))) : 3,
    image: sanitizeMediaUrl(articleLike?.image),
    imageMeta: articleLike?.imageMeta && typeof articleLike.imageMeta === 'object' ? articleLike.imageMeta : null,
    featured: Boolean(articleLike?.featured),
    breaking: Boolean(articleLike?.breaking),
    sponsored: Boolean(articleLike?.sponsored),
    hero: Boolean(articleLike?.hero),
    views: Number.isFinite(Number(articleLike?.views)) ? Math.max(0, Math.floor(Number(articleLike.views))) : 0,
    tags: sanitizeTags(articleLike?.tags),
    status: articleLike?.status === 'draft' ? 'draft' : 'published',
    publishAt: sanitizeDateTime(articleLike?.publishAt),
    shareTitle: normalizeText(articleLike?.shareTitle, 120),
    shareSubtitle: normalizeText(articleLike?.shareSubtitle, 180),
    shareBadge: normalizeText(articleLike?.shareBadge, 36),
    shareAccent: sanitizeShareAccent(articleLike?.shareAccent),
    shareImage: sanitizeMediaUrl(articleLike?.shareImage),
    cardSticker: normalizeText(articleLike?.cardSticker, 24),
  };
}

async function enrichArticlePayloadWithImageMeta(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  if (!partial || hasOwn(payload, 'image')) {
    const resolvedMeta = await resolveImageMetaFromUrl(payload.image, { queueIfMissing: true });
    if (resolvedMeta) {
      payload.imageMeta = { ...(payload.imageMeta || {}), ...resolvedMeta };
    }
  }
  return payload;
}

function snapshotsEqual(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

async function createArticleRevision(articleId, snapshot, { source = 'update', user = null } = {}) {
  const normalizedSnapshot = buildArticleSnapshot(snapshot);
  const latest = await ArticleRevision.findOne({ articleId }).sort({ version: -1 }).lean();
  if (latest?.snapshot && snapshotsEqual(latest.snapshot, normalizedSnapshot)) {
    return latest;
  }

  const nextVersion = (latest?.version || 0) + 1;
  const revision = await ArticleRevision.create({
    revisionId: randomUUID(),
    articleId,
    version: nextVersion,
    source,
    editorName: user?.name || '',
    editorId: Number.isInteger(user?.userId) ? user.userId : null,
    snapshot: normalizedSnapshot,
    createdAt: new Date(),
  });

  const stale = await ArticleRevision.find({ articleId }).sort({ createdAt: -1 }).skip(80).select({ revisionId: 1, _id: 0 }).lean();
  if (stale.length > 0) {
    await ArticleRevision.deleteMany({ revisionId: { $in: stale.map(item => item.revisionId) } });
  }

  return revision.toJSON();
}

function sanitizeHeroSettingsPayload(payload) {
  const inputCaptions = Array.isArray(payload?.captions) ? payload.captions : [];
  const heroTitleScaleRaw = Number.parseInt(payload?.heroTitleScale, 10);
  const heroTitleScale = Number.isInteger(heroTitleScaleRaw)
    ? Math.min(130, Math.max(70, heroTitleScaleRaw))
    : DEFAULT_HERO_SETTINGS.heroTitleScale;
  const mainPhotoArticleIdRaw = Number.parseInt(payload?.mainPhotoArticleId, 10);
  const mainPhotoArticleId = Number.isInteger(mainPhotoArticleIdRaw) && mainPhotoArticleIdRaw > 0
    ? mainPhotoArticleIdRaw
    : null;
  const inputPhotoIds = Array.isArray(payload?.photoArticleIds) ? payload.photoArticleIds : [];
  const captions = [
    normalizeText(inputCaptions[0] ?? DEFAULT_HERO_SETTINGS.captions[0], 90) || DEFAULT_HERO_SETTINGS.captions[0],
    normalizeText(inputCaptions[1] ?? DEFAULT_HERO_SETTINGS.captions[1], 90) || DEFAULT_HERO_SETTINGS.captions[1],
    normalizeText(inputCaptions[2] ?? DEFAULT_HERO_SETTINGS.captions[2], 90) || DEFAULT_HERO_SETTINGS.captions[2],
  ];
  const photoArticleIds = [...new Set(
    inputPhotoIds
      .map(v => Number.parseInt(v, 10))
      .filter(v => Number.isInteger(v) && v > 0)
  )].slice(0, 2);

  return {
    headline: normalizeText(payload?.headline ?? DEFAULT_HERO_SETTINGS.headline, 160) || DEFAULT_HERO_SETTINGS.headline,
    shockLabel: normalizeText(payload?.shockLabel ?? DEFAULT_HERO_SETTINGS.shockLabel, 32) || DEFAULT_HERO_SETTINGS.shockLabel,
    ctaLabel: normalizeText(payload?.ctaLabel ?? DEFAULT_HERO_SETTINGS.ctaLabel, 90) || DEFAULT_HERO_SETTINGS.ctaLabel,
    headlineBoardText: normalizeText(payload?.headlineBoardText ?? DEFAULT_HERO_SETTINGS.headlineBoardText, 90) || DEFAULT_HERO_SETTINGS.headlineBoardText,
    heroTitleScale,
    captions,
    mainPhotoArticleId,
    photoArticleIds,
  };
}

const allowedSpotlightIcons = new Set(['Flame', 'Megaphone', 'Bell', 'Siren', 'Zap', 'Newspaper', 'ShieldAlert']);
const allowedLayoutPresets = new Set(['default', 'impact', 'noir', 'classic']);
const layoutPresetSectionKeys = [
  'homeFeatured',
  'homeCrime',
  'homeReportage',
  'homeEmergency',
  'articleRelated',
  'categoryListing',
  'searchListing',
];

function sanitizeInternalPath(value, fallback = '/') {
  const route = normalizeText(value, 200);
  if (!route || !route.startsWith('/')) return fallback;
  return route;
}

function sanitizeTilt(value, fallback = '0deg') {
  const tilt = normalizeText(value, 20);
  return /^-?\d+(\.\d+)?deg$/i.test(tilt) ? tilt : fallback;
}

function normalizeBreakingCategoryLabel(route, rawLabel, maxLen = 50) {
  const normalizedLabel = normalizeText(rawLabel, maxLen);
  if (route !== '/category/breaking') return normalizedLabel;
  if (!normalizedLabel || normalizedLabel.toLowerCase() === 'спешни') return BREAKING_CATEGORY_LABEL;
  return normalizedLabel;
}

function sanitizeSiteSettingsPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const breakingBadgeLabel = normalizeText(
    source.breakingBadgeLabel ?? DEFAULT_SITE_SETTINGS.breakingBadgeLabel,
    24
  ) || DEFAULT_SITE_SETTINGS.breakingBadgeLabel;

  const navbarLinksInput = Array.isArray(source.navbarLinks) ? source.navbarLinks : DEFAULT_SITE_SETTINGS.navbarLinks;
  const navbarLinks = navbarLinksInput
    .map((item) => {
      const to = sanitizeInternalPath(item?.to, '/');
      return {
        to,
        label: normalizeBreakingCategoryLabel(to, item?.label, 50),
        hot: Boolean(item?.hot),
      };
    })
    .filter((item) => item.label)
    .slice(0, 16);

  const spotlightLinksInput = Array.isArray(source.spotlightLinks) ? source.spotlightLinks : DEFAULT_SITE_SETTINGS.spotlightLinks;
  const spotlightLinks = spotlightLinksInput
    .map((item, idx) => {
      const fallback = DEFAULT_SITE_SETTINGS.spotlightLinks[idx] || DEFAULT_SITE_SETTINGS.spotlightLinks[0];
      const iconCandidate = normalizeText(item?.icon, 40) || fallback.icon;
      return {
        to: sanitizeInternalPath(item?.to, fallback.to),
        label: normalizeText(item?.label, 40) || fallback.label,
        icon: allowedSpotlightIcons.has(iconCandidate) ? iconCandidate : fallback.icon,
        hot: Boolean(item?.hot),
        tilt: sanitizeTilt(item?.tilt, fallback.tilt),
      };
    })
    .filter((item) => item.label)
    .slice(0, 8);

  const footerPillsInput = Array.isArray(source.footerPills) ? source.footerPills : DEFAULT_SITE_SETTINGS.footerPills;
  const footerPills = footerPillsInput
    .map((item, idx) => {
      const fallback = DEFAULT_SITE_SETTINGS.footerPills[idx] || DEFAULT_SITE_SETTINGS.footerPills[0];
      return {
        to: sanitizeInternalPath(item?.to, fallback.to),
        label: normalizeText(item?.label, 40) || fallback.label,
        hot: Boolean(item?.hot),
        tilt: sanitizeTilt(item?.tilt, fallback.tilt),
      };
    })
    .filter((item) => item.label)
    .slice(0, 10);

  const footerQuickLinksInput = Array.isArray(source.footerQuickLinks) ? source.footerQuickLinks : DEFAULT_SITE_SETTINGS.footerQuickLinks;
  const footerQuickLinks = footerQuickLinksInput
    .map((item, idx) => {
      const fallback = DEFAULT_SITE_SETTINGS.footerQuickLinks[idx] || DEFAULT_SITE_SETTINGS.footerQuickLinks[0];
      const to = sanitizeInternalPath(item?.to, fallback.to);
      return {
        to,
        label: normalizeBreakingCategoryLabel(to, item?.label, 50)
          || normalizeBreakingCategoryLabel(to, fallback.label, 50),
      };
    })
    .filter((item) => item.label)
    .slice(0, 20);

  const footerInfoLinksInput = Array.isArray(source.footerInfoLinks) ? source.footerInfoLinks : DEFAULT_SITE_SETTINGS.footerInfoLinks;
  const footerInfoLinks = footerInfoLinksInput
    .map((item, idx) => {
      const fallback = DEFAULT_SITE_SETTINGS.footerInfoLinks[idx] || DEFAULT_SITE_SETTINGS.footerInfoLinks[0];
      return {
        to: sanitizeInternalPath(item?.to, fallback.to),
        label: normalizeText(item?.label, 50) || fallback.label,
      };
    })
    .filter((item) => item.label)
    .slice(0, 20);

  const contactInput = source.contact && typeof source.contact === 'object' ? source.contact : {};
  const contact = {
    address: normalizeText(contactInput.address ?? DEFAULT_SITE_SETTINGS.contact.address, 120) || DEFAULT_SITE_SETTINGS.contact.address,
    phone: normalizeText(contactInput.phone ?? DEFAULT_SITE_SETTINGS.contact.phone, 60) || DEFAULT_SITE_SETTINGS.contact.phone,
    email: normalizeText(contactInput.email ?? DEFAULT_SITE_SETTINGS.contact.email, 120) || DEFAULT_SITE_SETTINGS.contact.email,
  };

  const aboutInput = source.about && typeof source.about === 'object' ? source.about : {};
  const adPlansInput = Array.isArray(aboutInput.adPlans) ? aboutInput.adPlans : DEFAULT_SITE_SETTINGS.about.adPlans;
  const about = {
    heroText: normalizeText(aboutInput.heroText ?? DEFAULT_SITE_SETTINGS.about.heroText, 600) || DEFAULT_SITE_SETTINGS.about.heroText,
    missionTitle: normalizeText(aboutInput.missionTitle ?? DEFAULT_SITE_SETTINGS.about.missionTitle, 70) || DEFAULT_SITE_SETTINGS.about.missionTitle,
    missionParagraph1: normalizeText(aboutInput.missionParagraph1 ?? DEFAULT_SITE_SETTINGS.about.missionParagraph1, 1200) || DEFAULT_SITE_SETTINGS.about.missionParagraph1,
    missionParagraph2: normalizeText(aboutInput.missionParagraph2 ?? DEFAULT_SITE_SETTINGS.about.missionParagraph2, 1200) || DEFAULT_SITE_SETTINGS.about.missionParagraph2,
    adIntro: normalizeText(aboutInput.adIntro ?? DEFAULT_SITE_SETTINGS.about.adIntro, 600) || DEFAULT_SITE_SETTINGS.about.adIntro,
    adPlans: adPlansInput
      .map((plan, idx) => {
        const fallback = DEFAULT_SITE_SETTINGS.about.adPlans[idx] || DEFAULT_SITE_SETTINGS.about.adPlans[0];
        return {
          name: normalizeText(plan?.name, 70) || fallback.name,
          price: normalizeText(plan?.price, 40) || fallback.price,
          desc: normalizeText(plan?.desc, 160) || fallback.desc,
        };
      })
      .filter((plan) => plan.name)
      .slice(0, 6),
  };

  const rawLayoutPresets = source.layoutPresets && typeof source.layoutPresets === 'object'
    ? source.layoutPresets
    : {};
  const layoutPresets = layoutPresetSectionKeys.reduce((acc, sectionKey) => {
    const fallbackPreset = DEFAULT_SITE_SETTINGS.layoutPresets?.[sectionKey] || 'default';
    const candidate = normalizeText(rawLayoutPresets?.[sectionKey], 24) || fallbackPreset;
    acc[sectionKey] = allowedLayoutPresets.has(candidate) ? candidate : fallbackPreset;
    return acc;
  }, {});

  const tipLinePromoInput = source.tipLinePromo && typeof source.tipLinePromo === 'object'
    ? source.tipLinePromo
    : {};
  const tipLinePromo = {
    enabled: Boolean(tipLinePromoInput.enabled ?? DEFAULT_SITE_SETTINGS.tipLinePromo.enabled),
    title: normalizeText(tipLinePromoInput.title ?? DEFAULT_SITE_SETTINGS.tipLinePromo.title, 120) || DEFAULT_SITE_SETTINGS.tipLinePromo.title,
    description: normalizeText(tipLinePromoInput.description ?? DEFAULT_SITE_SETTINGS.tipLinePromo.description, 600) || DEFAULT_SITE_SETTINGS.tipLinePromo.description,
    buttonLabel: normalizeText(tipLinePromoInput.buttonLabel ?? DEFAULT_SITE_SETTINGS.tipLinePromo.buttonLabel, 60) || DEFAULT_SITE_SETTINGS.tipLinePromo.buttonLabel,
    buttonLink: sanitizeInternalPath(tipLinePromoInput.buttonLink, DEFAULT_SITE_SETTINGS.tipLinePromo.buttonLink),
  };

  return {
    breakingBadgeLabel,
    navbarLinks: navbarLinks.length > 0 ? navbarLinks : DEFAULT_SITE_SETTINGS.navbarLinks,
    spotlightLinks: spotlightLinks.length > 0 ? spotlightLinks : DEFAULT_SITE_SETTINGS.spotlightLinks,
    footerPills: footerPills.length > 0 ? footerPills : DEFAULT_SITE_SETTINGS.footerPills,
    footerQuickLinks: footerQuickLinks.length > 0 ? footerQuickLinks : DEFAULT_SITE_SETTINGS.footerQuickLinks,
    footerInfoLinks: footerInfoLinks.length > 0 ? footerInfoLinks : DEFAULT_SITE_SETTINGS.footerInfoLinks,
    contact,
    about,
    layoutPresets,
    tipLinePromo,
  };
}

function serializeHeroSettings(doc) {
  const source = doc && typeof doc === 'object' ? doc : DEFAULT_HERO_SETTINGS;
  const heroTitleScaleRaw = Number.parseInt(source.heroTitleScale, 10);
  const heroTitleScale = Number.isInteger(heroTitleScaleRaw)
    ? Math.min(130, Math.max(70, heroTitleScaleRaw))
    : DEFAULT_HERO_SETTINGS.heroTitleScale;
  const mainPhotoArticleIdRaw = Number.parseInt(source.mainPhotoArticleId, 10);
  const mainPhotoArticleId = Number.isInteger(mainPhotoArticleIdRaw) && mainPhotoArticleIdRaw > 0
    ? mainPhotoArticleIdRaw
    : null;
  const photoArticleIds = Array.isArray(source.photoArticleIds)
    ? [...new Set(source.photoArticleIds.map(v => Number.parseInt(v, 10)).filter(v => Number.isInteger(v) && v > 0))].slice(0, 2)
    : [];

  return {
    headline: normalizeText(source.headline ?? DEFAULT_HERO_SETTINGS.headline, 160) || DEFAULT_HERO_SETTINGS.headline,
    shockLabel: normalizeText(source.shockLabel ?? DEFAULT_HERO_SETTINGS.shockLabel, 32) || DEFAULT_HERO_SETTINGS.shockLabel,
    ctaLabel: normalizeText(source.ctaLabel ?? DEFAULT_HERO_SETTINGS.ctaLabel, 90) || DEFAULT_HERO_SETTINGS.ctaLabel,
    headlineBoardText: normalizeText(source.headlineBoardText ?? DEFAULT_HERO_SETTINGS.headlineBoardText, 90) || DEFAULT_HERO_SETTINGS.headlineBoardText,
    heroTitleScale,
    captions: Array.isArray(source.captions) && source.captions.length === 3
      ? source.captions.map((caption, idx) => normalizeText(caption, 90) || DEFAULT_HERO_SETTINGS.captions[idx])
      : DEFAULT_HERO_SETTINGS.captions,
    mainPhotoArticleId,
    photoArticleIds,
  };
}

function serializeSiteSettings(doc) {
  return sanitizeSiteSettingsPayload(doc || DEFAULT_SITE_SETTINGS);
}

function serializeSettingsSnapshot(scope, snapshot) {
  return scope === 'site'
    ? serializeSiteSettings(snapshot)
    : serializeHeroSettings(snapshot);
}

function formatSettingsRevisionList(revisions) {
  return revisions.map((revision) => ({
    revisionId: revision.revisionId,
    scope: revision.scope,
    version: revision.version,
    source: revision.source,
    editorName: revision.editorName || '',
    createdAt: revision.createdAt,
  }));
}

async function createSettingsRevision(scope, snapshot, { source = 'update', user = null } = {}) {
  const normalizedScope = scope === 'site' ? 'site' : 'hero';
  const normalizedSnapshot = serializeSettingsSnapshot(normalizedScope, snapshot);
  const latest = await SettingsRevision.findOne({ scope: normalizedScope }).sort({ version: -1 }).lean();
  if (latest?.snapshot && snapshotsEqual(latest.snapshot, normalizedSnapshot)) {
    return latest;
  }

  const nextVersion = (latest?.version || 0) + 1;
  const revision = await SettingsRevision.create({
    revisionId: randomUUID(),
    scope: normalizedScope,
    version: nextVersion,
    source,
    editorName: user?.name || '',
    editorId: Number.isInteger(user?.userId) ? user.userId : null,
    snapshot: normalizedSnapshot,
    createdAt: new Date(),
  });

  const stale = await SettingsRevision.find({ scope: normalizedScope })
    .sort({ createdAt: -1 })
    .skip(60)
    .select({ revisionId: 1, _id: 0 })
    .lean();
  if (stale.length > 0) {
    await SettingsRevision.deleteMany({ revisionId: { $in: stale.map(item => item.revisionId) } });
  }

  return revision.toJSON();
}

function decodeTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    if (decoded?.type && decoded.type !== 'access') return null;
    return decoded;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const raw = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  if (!raw) return {};
  return raw
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eqIdx = part.indexOf('=');
      if (eqIdx <= 0) return acc;
      const key = part.slice(0, eqIdx).trim();
      const valueRaw = part.slice(eqIdx + 1).trim();
      try {
        acc[key] = decodeURIComponent(valueRaw);
      } catch {
        acc[key] = valueRaw;
      }
      return acc;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.path) segments.push(`Path=${options.path}`);
  if (options.httpOnly) segments.push('HttpOnly');
  if (options.secure) segments.push('Secure');
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);
  return segments.join('; ');
}

function clearCookieHeader(name, options = {}) {
  return serializeCookie(name, '', {
    ...options,
    maxAge: 0,
  });
}

function signAccessToken(user) {
  return jwt.sign(
    {
      type: 'access',
      userId: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function signRefreshToken({ userId, jti }) {
  return jwt.sign(
    {
      type: 'refresh',
      userId,
      jti,
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` }
  );
}

function decodeRefreshToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    if (decoded?.type !== 'refresh') return null;
    if (!Number.isInteger(Number.parseInt(decoded?.userId, 10))) return null;
    if (typeof decoded?.jti !== 'string' || decoded.jti.length < 12) return null;
    return decoded;
  } catch {
    return null;
  }
}

function setRefreshCookie(res, token) {
  const cookie = serializeCookie(REFRESH_COOKIE_NAME, token, {
    path: REFRESH_COOKIE_PATH,
    maxAge: Math.floor(refreshTokenMaxAgeMs / 1000),
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
  });
  res.setHeader('Set-Cookie', cookie);
}

function clearRefreshCookie(res) {
  const cookie = clearCookieHeader(REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
  });
  res.setHeader('Set-Cookie', cookie);
}

async function createRefreshSession(req, userId) {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + refreshTokenMaxAgeMs);
  const userAgent = getClientUserAgent(req);
  const ipHash = createHash('sha256').update(getClientIp(req)).digest('hex');
  await AuthSession.create({
    jti,
    userId,
    userAgent,
    ipHash,
    expiresAt,
  });
  return {
    jti,
    expiresAt,
  };
}

async function rotateTokensForUser(req, user, previousJti = null) {
  if (previousJti) {
    await AuthSession.deleteOne({ jti: previousJti, userId: user.id });
  }
  const refreshSession = await createRefreshSession(req, user.id);
  const refreshToken = signRefreshToken({ userId: user.id, jti: refreshSession.jti });
  const accessToken = signAccessToken(user);
  return {
    accessToken,
    refreshToken,
  };
}

function getClientIp(req) {
  return getTrustedClientIp(req);
}

function hashClientFingerprint(req, scope = '') {
  return hashTrustedClientFingerprint(req, scope);
}

function getWindowKey(windowMs) {
  return Math.floor(Date.now() / windowMs);
}

function isMongoDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
}

function commentContainsBlockedTerms(text) {
  const normalized = normalizeText(text, 4000).toLowerCase();
  return blockedCommentTerms.some(term => normalized.includes(term));
}

function normalizeCommentReaction(value) {
  const normalized = normalizeText(value, 16).toLowerCase();
  if (normalized === 'like' || normalized === 'dislike') return normalized;
  return null;
}

async function syncCommentReactionTotals(commentId) {
  const [likes, dislikes] = await Promise.all([
    CommentReaction.countDocuments({ commentId, value: 'like' }),
    CommentReaction.countDocuments({ commentId, value: 'dislike' }),
  ]);

  return Comment.findOneAndUpdate(
    { id: commentId },
    { $set: { likes, dislikes } },
    { new: true }
  );
}

async function collectCommentThreadIds(rootId) {
  const parsedRootId = Number.parseInt(rootId, 10);
  if (!Number.isInteger(parsedRootId)) return [];

  const seen = new Set([parsedRootId]);
  const ids = [];
  let frontier = [parsedRootId];

  while (frontier.length > 0) {
    ids.push(...frontier);
    const children = await Comment.find({ parentId: { $in: frontier } })
      .select({ _id: 0, id: 1 })
      .lean();

    frontier = [];
    children.forEach((child) => {
      const childId = Number.parseInt(child?.id, 10);
      if (!Number.isInteger(childId) || seen.has(childId)) return;
      seen.add(childId);
      frontier.push(childId);
    });
  }

  return ids;
}

async function nextNumericId(Model, counterKey = '') {
  return allocateNumericId(Model, Counter, counterKey);
}

async function hasPermissionForSection(user, section) {
  if (!user?.role) return false;
  if (user.role === 'admin') return true;
  const rolePerm = await Permission.findOne({ role: user.role }).lean();
  return Boolean(rolePerm?.permissions?.[section]);
}

async function isKnownRole(role) {
  const normalized = normalizeText(role, 32);
  if (!normalized) return false;
  if (normalized === 'admin') return true;
  // Allow built-in roles even if the permissions collection hasn't been seeded yet.
  if (Object.prototype.hasOwnProperty.call(DEFAULT_PERMISSION_DOCS, normalized)) return true;
  return Boolean(await Permission.exists({ role: normalized }));
}

const PERMISSION_KEYS = Object.freeze([
  'articles',
  'categories',
  'ads',
  'breaking',
  'wanted',
  'jobs',
  'court',
  'events',
  'polls',
  'comments',
  'contact',
  'gallery',
  'profiles',
  'permissions',
  'games',
]);

const DEFAULT_PERMISSION_DOCS = Object.freeze({
  admin: PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {}),
  editor: {
    articles: true,
    categories: true,
    ads: true,
    breaking: true,
    wanted: false,
    jobs: false,
    court: false,
    events: true,
    polls: true,
    comments: true,
    contact: true,
    gallery: true,
    profiles: false,
    permissions: false,
    games: true,
  },
  reporter: {
    articles: true,
    categories: false,
    ads: false,
    breaking: false,
    wanted: false,
    jobs: false,
    court: false,
    events: false,
    polls: false,
    comments: false,
    contact: false,
    gallery: true,
    profiles: false,
    permissions: false,
    games: false,
  },
  photographer: {
    articles: false,
    categories: false,
    ads: false,
    breaking: false,
    wanted: false,
    jobs: false,
    court: false,
    events: false,
    polls: false,
    comments: false,
    contact: false,
    gallery: true,
    profiles: false,
    permissions: false,
    games: false,
  },
  intern: {
    articles: false,
    categories: false,
    ads: false,
    breaking: false,
    wanted: false,
    jobs: false,
    court: false,
    events: false,
    polls: false,
    comments: false,
    contact: false,
    gallery: false,
    profiles: false,
    permissions: false,
    games: false,
  },
});

function sanitizePermissionMap(value) {
  const src = value && typeof value === 'object' ? value : {};
  return PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(src[key]);
    return acc;
  }, {});
}

async function ensureDefaultPermissionDocs() {
  try {
    await Promise.all(
      Object.entries(DEFAULT_PERMISSION_DOCS).map(async ([role, permissionMap]) => {
        const permissions = sanitizePermissionMap(permissionMap);
        const existing = await Permission.findOne({ role }).lean();

        if (!existing) {
          await Permission.create({ role, permissions });
          return;
        }

        const missingPermissionPatch = {};
        PERMISSION_KEYS.forEach((key) => {
          if (typeof existing.permissions?.[key] === 'boolean') return;
          missingPermissionPatch[`permissions.${key}`] = Boolean(permissions[key]);
        });

        if (Object.keys(missingPermissionPatch).length > 0) {
          await Permission.updateOne({ role }, { $set: missingPermissionPatch });
        }
      })
    );
  } catch (error) {
    console.warn('⚠ Failed to ensure default permissions:', error?.message || error);
  }
}

async function migrateBreakingCategoryLabels() {
  try {
    await Category.updateOne(
      {
        id: 'breaking',
        $or: [
          { name: { $exists: false } },
          { name: null },
          { name: '' },
          { name: /^\s*спешни\s*$/i },
        ],
      },
      { $set: { name: BREAKING_CATEGORY_LABEL } }
    );
  } catch (error) {
    console.warn('⚠ Failed to migrate breaking category label:', error?.message || error);
  }

  try {
    const doc = await SiteSettings.findOne({ key: 'main' }).lean();
    if (!doc) return;

    const normalizeBreakingLinks = (links) => {
      if (!Array.isArray(links)) return { next: null, changed: false };
      let changed = false;
      const next = links.map((item) => {
        if (!item || item.to !== '/category/breaking') return item;
        const normalizedLabel = normalizeText(item.label, 50);
        if (normalizedLabel && normalizedLabel.toLowerCase() !== 'спешни') return item;
        changed = true;
        return { ...item, label: BREAKING_CATEGORY_LABEL };
      });
      return { next, changed };
    };

    const navbarLinks = normalizeBreakingLinks(doc.navbarLinks);
    const footerQuickLinks = normalizeBreakingLinks(doc.footerQuickLinks);

    const updates = {};
    if (navbarLinks.changed) updates.navbarLinks = navbarLinks.next;
    if (footerQuickLinks.changed) updates.footerQuickLinks = footerQuickLinks.next;
    if (Object.keys(updates).length === 0) return;

    await SiteSettings.updateOne({ key: 'main' }, { $set: updates });
  } catch (error) {
    console.warn('⚠ Failed to migrate breaking labels in site settings:', error?.message || error);
  }
}

// ─── Auth / Authorization Middleware ───
const systemEventRetentionDays = 90;
const backgroundJobLockMs = Math.max(30 * 1000, Number.parseInt(process.env.BACKGROUND_JOB_LOCK_MS || '', 10) || (2 * 60 * 1000));
const scheduledPublishPollMs = Math.max(30 * 1000, Number.parseInt(process.env.SCHEDULED_PUBLISH_POLL_MS || '', 10) || (60 * 1000));
const shareCardCleanupPollMs = Math.max(60 * 60 * 1000, Number.parseInt(process.env.SHARE_CARD_CLEANUP_POLL_MS || '', 10) || (12 * 60 * 60 * 1000));
const adAnalyticsRollupPollMs = Math.max(15 * 60 * 1000, Number.parseInt(process.env.AD_ANALYTICS_ROLLUP_POLL_MS || '', 10) || (60 * 60 * 1000));
const adAnalyticsRollupDays = Math.max(1, Number.parseInt(process.env.AD_ANALYTICS_ROLLUP_DAYS || '', 10) || 14);
const shareCardCleanupCheckTtlMs = 2 * 24 * 60 * 60 * 1000;
const {
  truncateMonitoringText,
  sanitizeMonitoringMetadata,
  serializeErrorForMonitoring,
  recordSystemEvent,
  reportServerError,
} = createMonitoringService({
  SystemEvent,
  systemEventRetentionDays,
});

const {
  cleanupOrphanedShareCardsJob,
  refreshScheduledContentCachesJob,
} = createContentMaintenanceService({
  Article,
  deleteRemoteKeys,
  invalidateCacheGroup,
  isRemoteStorage,
  listRemoteObjectsByPrefix,
  scheduledPublishPollMs,
  shareCardCleanupCheckTtlMs,
  shareCardsDir,
  storageUploadsPrefix,
  toUploadsStorageKey,
});

const {
  aggregateAdAnalyticsJob,
  toBucketDate,
} = createAdAnalyticsRollupService({
  AdAnalyticsAggregate,
  AdEvent,
  adAnalyticsRollupDays,
  adEventTypes: AD_EVENT_TYPES,
});


const {
  registerBackgroundJob,
  startBackgroundJobs,
  stopBackgroundJobs,
} = createBackgroundJobsService({
  BackgroundJobState,
  backgroundJobLockMs,
  recordSystemEvent,
  sanitizeMonitoringMetadata,
  serializeErrorForMonitoring,
  shouldDisableBackgroundJobs: () => process.env.DISABLE_BACKGROUND_JOBS === 'true',
  truncateMonitoringText,
});

const { buildDiagnosticsPayload } = createDiagnosticsService({
  AdAnalyticsAggregate,
  BackgroundJobState,
  SystemEvent,
  getApiCacheStats,
  getImagePipelineStatus,
  getMongoHealthState,
  getRecentUploadResults: () => recentUploadResults,
  getUploadRequestInFlight: () => uploadRequestInFlight,
  isRemoteStorage,
  mongoose,
  sanitizeMonitoringMetadata,
  storageDriver,
  storagePublicBaseUrl,
  toBucketDate,
});

registerBackgroundJob({ name: 'scheduled-publish-cache-refresh', intervalMs: scheduledPublishPollMs, initialDelayMs: 2500, run: refreshScheduledContentCachesJob });
registerBackgroundJob({ name: 'share-card-cleanup', intervalMs: shareCardCleanupPollMs, initialDelayMs: 4500, run: cleanupOrphanedShareCardsJob });
registerBackgroundJob({ name: 'ad-analytics-rollup', intervalMs: adAnalyticsRollupPollMs, initialDelayMs: 6500, run: aggregateAdAnalyticsJob });
const {
  requireAuth,
  requireAdmin,
  requirePermission,
  requireAnyPermission,
} = createAuthzService({
  decodeTokenFromRequest,
  hasPermissionForSection,
  publicError,
});

// ─── Monitoring / Diagnostics routes ───
registerMonitoringRoutes(app, {
  buildDiagnosticsPayload,
  clientMonitoringLimiter,
  publicError,
  recordSystemEvent,
  reportServerError,
  requireAuth,
  requirePermission,
  sanitizeMonitoringMetadata,
  truncateMonitoringText,
});

// ─── MongoDB Connection ───
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const isPlaceholder = !uri || /YOUR_PASSWORD|xxxxx|user:password/i.test(uri);

  if (isPlaceholder) {
    if (isProd) {
      throw new Error('MONGODB_URI must be configured for production.');
    }

    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri);
      console.log('✓ MongoDB in-memory (dev mode)');

      const { seedAll } = await import('./seed.js');
      await seedAll({ allowDestructive: true, reason: 'dev-inmemory-bootstrap' });
      console.log('✓ Database seeded with defaults');
      return;
    } catch (memoryErr) {
      const fallbackUri = process.env.DEV_MONGODB_FALLBACK_URI || 'mongodb://127.0.0.1:27017/zemun-news';
      console.warn(`⚠ In-memory MongoDB failed: ${memoryErr.message}`);
      console.warn(`⚠ Trying local MongoDB fallback: ${fallbackUri}`);
      try {
        await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 3000 });
        console.log('✓ MongoDB local fallback connected');
        return;
      } catch (fallbackErr) {
        throw new Error(
          `Mongo init failed. In-memory: ${memoryErr.message}. Local fallback: ${fallbackErr.message}. ` +
          'Set a valid MONGODB_URI in .env.'
        );
      }
    }
  } else {
    await mongoose.connect(uri);
    console.log('✓ MongoDB connected');
  }
}

async function ensureDbIndexes() {
  try {
    // In production Mongoose defaults to autoIndex=false, so ensure the critical indexes exist.
    const modelsWithIndexes = [
      Article,
      Author,
      Category,
      Ad,
      AdEvent,
      Breaking,
      User,
      Wanted,
      Job,
      Court,
      Event,
      Poll,
      Comment,
      CommentReaction,
      ContactMessage,
      Gallery,
      Permission,
      HeroSettings,
      SiteSettings,
      ArticleRevision,
      SettingsRevision,
      ArticleView,
      PollVote,
      AuthSession,
      AuditLog,
      Tip,
      PushSubscription,
      GameDefinition,
      GamePuzzle,
      Counter,
      SearchQueryStat,
    ];

    await Promise.all(modelsWithIndexes.map((Model) => Model.init()));
    console.log('✓ MongoDB indexes ensured');
  } catch (err) {
    console.warn('⚠ MongoDB index init failed:', err?.message || err);
  }
}

function numericCrud(Model, resourceName = 'unknown', defaultSort = { id: -1 }, sensitiveFields = [], writePermission = null) {
  const router = express.Router();
  const writeGuards = writePermission
    ? [requireAuth, requirePermission(writePermission)]
    : [requireAuth, requireAdmin];

  const sanitizeWritePayload = (payload) => {
    const next = { ...(payload || {}) };
    delete next.id;
    delete next._id;
    delete next.__v;
    return next;
  };

  router.get('/', cacheMiddleware, async (req, res) => {
    try {
      const pagination = parseCollectionPagination(req.query, { defaultLimit: 50, maxLimit: 250 });
      let query = Model.find().sort(defaultSort);
      if (pagination.shouldPaginate) {
        query = query.skip(pagination.skip).limit(pagination.limit);
      }
      const items = await query.lean();
      items.forEach(i => {
        delete i._id;
        delete i.__v;
        sensitiveFields.forEach(f => delete i[f]);
      });
      if (!pagination.shouldPaginate) {
        return res.json(items);
      }
      const total = await Model.countDocuments({});
      return res.json({
        items,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
      });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  router.post('/', ...writeGuards, async (req, res) => {
    try {
      const id = await nextNumericId(Model);
      const data = sanitizeWritePayload(req.body);
      const item = await Model.create({ ...data, id });
      const obj = item.toJSON();
      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'create',
        resource: resourceName,
        resourceId: id,
        details: obj.title || obj.name || obj.question || '',
      }).catch(() => { });

      invalidateCacheTags([resourceName, 'bootstrap', 'homepage'], { reason: `${resourceName}-mutation` });

      res.status(201).json(obj);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  router.put('/:id', ...writeGuards, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
      const data = sanitizeWritePayload(req.body);
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      const item = await Model.findOneAndUpdate({ id }, { $set: data }, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ error: 'Not found' });
      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'update',
        resource: resourceName,
        resourceId: id,
        details: data.title || data.name || '',
      }).catch(() => { });

      invalidateCacheTags([resourceName, 'bootstrap', 'homepage'], { reason: `${resourceName}-mutation` });

      res.json(item.toJSON());
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  router.delete('/:id', ...writeGuards, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
      const result = await Model.deleteOne({ id });
      if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
      AuditLog.create({
        user: req.user.name,
        userId: req.user.userId,
        action: 'delete',
        resource: resourceName,
        resourceId: id,
        details: '',
      }).catch(() => { });

      invalidateCacheTags([resourceName, 'bootstrap', 'homepage'], { reason: `${resourceName}-mutation` });

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  return router;
}

// ─── Articles ───
const articlesRouter = express.Router();

articlesRouter.get('/', cacheMiddleware, async (req, res) => {
  try {
    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const filter = canSeeDrafts ? {} : getPublishedFilter();
    const category = normalizeText(req.query.category, 64);
    const q = normalizeText(req.query.q, 160);
    const sectionFilter = getArticleSectionFilter(req.query.section);
    const fieldsProjection = buildArticleProjection(req.query.fields);
    const shouldPaginate = hasOwn(req.query, 'page') || hasOwn(req.query, 'limit');
    const page = parsePositiveInt(req.query.page, 1, { min: 1, max: 2000 });
    const limit = parsePositiveInt(req.query.limit, 24, { min: 1, max: 120 });

    if (category) filter.category = category;
    if (sectionFilter) Object.assign(filter, sectionFilter);
    if (q) filter.$text = { $search: q };

    let query = Article.find(filter);
    query = q
      ? query.sort({ score: { $meta: 'textScore' }, id: -1 })
      : query.sort({ id: -1 });
    if (fieldsProjection) {
      query = query.select(fieldsProjection);
    } else {
      query = query.select({ _id: 0, __v: 0 });
    }
    if (shouldPaginate) {
      query = query.skip((page - 1) * limit).limit(limit);
    }

    const items = await query.lean();
    items.forEach((item) => {
      delete item._id;
      delete item.__v;
    });

    if (!shouldPaginate) {
      return res.json(items);
    }

    const total = await Article.countDocuments(filter);
    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

articlesRouter.get('/:id(\\d+)', cacheMiddleware, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const filter = canSeeDrafts ? { id } : { id, ...getPublishedFilter() };
    const fieldsProjection = buildArticleProjection(req.query.fields);

    let query = Article.findOne(filter);
    if (fieldsProjection) {
      query = query.select(fieldsProjection);
    } else {
      query = query.select({ _id: 0, __v: 0 });
    }

    const item = await query.lean();
    if (!item) return res.status(404).json({ error: 'Not found' });
    delete item._id;
    delete item.__v;
    return res.json(item);
  } catch (e) {
    return res.status(500).json({ error: publicError(e) });
  }
});

articlesRouter.get('/:id/share.png', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const filter = canSeeDrafts ? { id } : { id, ...getPublishedFilter() };
    const article = await Article.findOne(filter).lean();
    if (!article) return res.status(404).json({ error: 'Not found' });

    const category = await Category.findOne({ id: article.category }).select({ _id: 0, name: 1 }).lean();
    const card = await ensureArticleShareCard(article, { categoryLabel: category?.name || article.category || '' });
    if (card?.generated) {
      if (card.absolutePath) {
        res.setHeader('Cache-Control', 'no-cache');
        return res.sendFile(card.absolutePath);
      }
      if (card.url) {
        return res.redirect(302, card.url);
      }
    }

    const fallback = await resolveShareFallbackSource(article);
    if (fallback?.type === 'file' && fallback.path) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(fallback.path);
    }
    if (fallback?.type === 'redirect' && fallback.url) {
      return res.redirect(302, fallback.url);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=120');
    return res.send(transparentPng1x1);
  } catch (e) {
    return res.status(500).json({ error: publicError(e) });
  }
});
// ─── Push Notification Helper ───
function isImmediateBreakingArticle(article, now = new Date()) {
  if (!article || !article.breaking || article.status !== 'published') return false;
  if (!article.publishAt) return true;
  const publishAtTs = new Date(article.publishAt).getTime();
  if (Number.isNaN(publishAtTs)) return false;
  return publishAtTs <= now.getTime();
}

async function sendPushNotificationForArticle(article) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  try {
    const payload = JSON.stringify({
      title: '🚨 ИЗВЪНРЕДНО',
      body: article.title || 'Гореща новина от zNews',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      url: `/article/${article.id}`
    });

    const subscriptions = await PushSubscription.find({});
    const pushPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    });
    await Promise.allSettled(pushPromises);
    console.log(`Sent push notification to ${subscriptions.length} devices.`);
  } catch (e) {
    console.error('Failed to trigger push notifications:', e);
  }
}

articlesRouter.post('/', requireAuth, requirePermission('articles'), async (req, res) => {
  try {
    const data = sanitizeArticlePayload(req.body, { partial: false });
    await enrichArticlePayloadWithImageMeta(data, { partial: false });
    if (!data.title || !data.excerpt || !data.content || !data.category) {
      return res.status(400).json({ error: 'Missing required article fields' });
    }

    const cleanContentText = data.content.replace(/<[^>]*>?/gm, '').trim();
    if (cleanContentText.length === 0) {
      return res.status(400).json({ error: 'Article content cannot be empty text' });
    }

    if (!req.body.authorId || parseInt(req.body.authorId, 10) === 1) {
      data.authorId = Number.isInteger(req.user?.userId) ? req.user.userId : 1;
    }
    const id = await nextNumericId(Article);
    const item = await Article.create({ ...data, id });
    const obj = item.toJSON();
    if (obj.hero) {
      await Article.updateMany({ id: { $ne: id }, hero: true }, { $set: { hero: false } });
    }
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'create',
      resource: 'articles',
      resourceId: id,
      details: obj.title || '',
    }).catch(() => { });
    await createArticleRevision(id, obj, { source: 'create', user: req.user });

    // Trigger push for immediate breaking news
    if (obj.breaking && obj.status === 'published' && (!obj.publishAt || new Date(obj.publishAt) <= new Date())) {
      sendPushNotificationForArticle(obj);
    }

    // Invalidate articles cache
    invalidateCacheGroup('articles', 'article-mutation');

    res.json(obj);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

articlesRouter.put('/:id', requireAuth, requirePermission('articles'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const data = sanitizeArticlePayload(req.body, { partial: true });
    await enrichArticlePayloadWithImageMeta(data, { partial: true });
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const previous = await Article.findOne({ id }).lean();
    if (!previous) return res.status(404).json({ error: 'Not found' });

    const item = await Article.findOneAndUpdate({ id }, { $set: data }, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.hero) {
      await Article.updateMany({ id: { $ne: id }, hero: true }, { $set: { hero: false } });
    }

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'articles',
      resourceId: id,
      details: data.title || '',
    }).catch(() => { });

    const updated = item.toJSON();
    await createArticleRevision(id, updated, { source: 'update', user: req.user });

    // Trigger push only when the article transitions into immediate breaking state.
    const now = new Date();
    const wasImmediateBreaking = isImmediateBreakingArticle(previous, now);
    const isNowImmediateBreaking = isImmediateBreakingArticle(updated, now);
    if (isNowImmediateBreaking && !wasImmediateBreaking) {
      sendPushNotificationForArticle(updated);
    }

    // Invalidate articles cache
    invalidateCacheGroup('articles', 'article-mutation');

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

articlesRouter.get('/:id/revisions', requireAuth, requirePermission('articles'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const revisions = await ArticleRevision.find({ articleId: id })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    const formatted = revisions.map((revision) => ({
      revisionId: revision.revisionId,
      articleId: revision.articleId,
      version: revision.version,
      source: revision.source,
      editorName: revision.editorName || '',
      createdAt: revision.createdAt,
      title: revision.snapshot?.title || '',
      excerpt: revision.snapshot?.excerpt || '',
      status: revision.snapshot?.status || 'published',
      publishAt: revision.snapshot?.publishAt || null,
    }));

    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

articlesRouter.get('/:id/revisions/:revisionId', requireAuth, requirePermission('articles'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const revisionId = normalizeText(req.params.revisionId, 80);
    if (!revisionId) return res.status(400).json({ error: 'Invalid revisionId' });

    const revision = await ArticleRevision.findOne({ articleId: id, revisionId }).lean();
    if (!revision || !revision.snapshot) return res.status(404).json({ error: 'Revision not found' });

    res.json({
      revisionId: revision.revisionId,
      articleId: revision.articleId,
      version: revision.version,
      source: revision.source,
      editorName: revision.editorName || '',
      createdAt: revision.createdAt,
      snapshot: buildArticleSnapshot(revision.snapshot),
    });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

articlesRouter.post('/:id/revisions/autosave', requireAuth, requirePermission('articles'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await Article.findOne({ id }).lean();
    if (!existing) return res.status(404).json({ error: 'Article not found' });

    const draftPatch = sanitizeArticlePayload(req.body, { partial: true });
    await enrichArticlePayloadWithImageMeta(draftPatch, { partial: true });
    const previewSnapshot = buildArticleSnapshot({ ...existing, ...draftPatch });
    const revision = await createArticleRevision(id, previewSnapshot, { source: 'autosave', user: req.user });

    res.json({
      ok: true,
      revision: revision
        ? {
          revisionId: revision.revisionId,
          version: revision.version,
          source: revision.source,
          editorName: revision.editorName,
          createdAt: revision.createdAt,
        }
        : null,
    });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

articlesRouter.post('/:id/revisions/restore', requireAuth, requirePermission('articles'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const revisionId = normalizeText(req.body?.revisionId, 80);
    if (!revisionId) return res.status(400).json({ error: 'revisionId is required' });

    const revision = await ArticleRevision.findOne({ articleId: id, revisionId }).lean();
    if (!revision || !revision.snapshot) return res.status(404).json({ error: 'Revision not found' });

    const snapshot = buildArticleSnapshot(revision.snapshot);
    await enrichArticlePayloadWithImageMeta(snapshot, { partial: false });
    const restored = await Article.findOneAndUpdate({ id }, { $set: snapshot }, { new: true });
    if (!restored) return res.status(404).json({ error: 'Article not found' });

    if (restored.hero) {
      await Article.updateMany({ id: { $ne: id }, hero: true }, { $set: { hero: false } });
    }

    const restoredObj = restored.toJSON();
    await createArticleRevision(id, restoredObj, { source: 'restore', user: req.user });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'articles',
      resourceId: id,
      details: `restore:${revisionId}`,
    }).catch(() => { });

    invalidateCacheGroup('articles', 'article-mutation');

    res.json(restoredObj);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

articlesRouter.delete('/:id', requireAuth, requirePermission('articles'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await Article.deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });
    await ArticleRevision.deleteMany({ articleId: id });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'articles',
      resourceId: id,
      details: '',
    }).catch(() => { });

    invalidateCacheGroup('articles', 'article-mutation');

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

// Public endpoint for view counter, avoids exposing write permissions.
articlesRouter.post('/:id/view', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const filter = { id, ...getPublishedFilter() };
    const existing = await Article.findOne(filter).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const viewerHash = hashClientFingerprint(req, `view:${id}`);
    const windowKey = getWindowKey(articleViewWindowMs);
    const expiresAt = new Date(Date.now() + articleViewWindowMs + (15 * 60 * 1000));

    let deduped = false;
    try {
      await ArticleView.create({
        articleId: id,
        viewerHash,
        windowKey,
        expiresAt,
      });
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) deduped = true;
      else throw error;
    }

    const item = deduped
      ? existing
      : await Article.findOneAndUpdate(filter, { $inc: { views: 1 } }, { new: true }).lean();

    if (!item) return res.status(404).json({ error: 'Not found' });
    delete item._id;
    delete item.__v;
    res.json({ ...item, deduped });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

app.use('/api/articles', articlesRouter);

// ─── Users ───
const usersRouter = express.Router();

usersRouter.get('/', requireAuth, requirePermission('profiles'), async (_req, res) => {
  try {
    const items = await User.find().sort({ id: -1 }).lean();
    items.forEach(i => {
      delete i._id;
      delete i.__v;
      delete i.password;
    });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

usersRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const username = normalizeText(req.body.username, 40).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!username || password.length < 8) {
      return res.status(400).json({ error: 'Username and password (min 8 chars) are required' });
    }
    const existing = await User.findOne({ username }).lean();
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const role = normalizeText(req.body.role, 32) || 'reporter';
    if (!(await isKnownRole(role))) {
      return res.status(400).json({ error: 'Unknown role' });
    }

    const id = await nextNumericId(User);
    const item = await User.create({
      id,
      username,
      password: await bcrypt.hash(password, 10),
      name: normalizeText(req.body.name, 80),
      role,
      profession: normalizeText(req.body.profession, 120),
      avatar: normalizeText(req.body.avatar, 16) || '👤',
      createdAt: sanitizeDate(req.body.createdAt),
    });

    const obj = item.toJSON();
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'create',
      resource: 'users',
      resourceId: id,
      details: obj.name || '',
    }).catch(() => { });
    res.json(obj);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

usersRouter.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    let passwordChanged = false;
    const data = {};

    if (hasOwn(req.body, 'name')) data.name = normalizeText(req.body.name, 80);
    if (hasOwn(req.body, 'profession')) data.profession = normalizeText(req.body.profession, 120);
    if (hasOwn(req.body, 'avatar')) data.avatar = normalizeText(req.body.avatar, 16) || '👤';

    if (hasOwn(req.body, 'username')) {
      const username = normalizeText(req.body.username, 40).toLowerCase();
      if (!username) return res.status(400).json({ error: 'Invalid username' });
      const existing = await User.findOne({ username, id: { $ne: id } }).lean();
      if (existing) return res.status(409).json({ error: 'Username already exists' });
      data.username = username;
    }

    if (hasOwn(req.body, 'role')) {
      const role = normalizeText(req.body.role, 32);
      if (!role) return res.status(400).json({ error: 'Invalid role' });
      if (!(await isKnownRole(role))) return res.status(400).json({ error: 'Unknown role' });
      if (id === 1 && role !== 'admin') {
        return res.status(403).json({ error: 'Cannot downgrade main admin account' });
      }
      data.role = role;
    }

    if (hasOwn(req.body, 'password')) {
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      if (password.length > 0 && password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      if (password.length >= 8) {
        data.password = await bcrypt.hash(password, 10);
        passwordChanged = true;
      }
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const item = await User.findOneAndUpdate({ id }, { $set: data }, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });

    if (passwordChanged) {
      // Invalidate all refresh sessions for this account so old refresh tokens can't be used.
      await AuthSession.deleteMany({ userId: id });
    }

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'users',
      resourceId: id,
      details: data.name || '',
    }).catch(() => { });

    res.json(item.toJSON());
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

usersRouter.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    if (id === 1) return res.status(403).json({ error: 'Cannot delete main admin' });

    const result = await User.deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'users',
      resourceId: id,
      details: '',
    }).catch(() => { });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

app.use('/api/users', usersRouter);

function stripDocumentMetadata(item) {
  if (!item || typeof item !== 'object') return item;
  const next = { ...item };
  delete next._id;
  delete next.__v;
  return next;
}

function uniqueNormalizedStrings(values, maxLen = 80) {
  const source = Array.isArray(values) ? values : [];
  return [...new Set(source
    .map((value) => normalizeText(value, maxLen))
    .filter(Boolean))];
}

function uniqueNormalizedLowercaseStrings(values, maxLen = 80) {
  const source = Array.isArray(values) ? values : [];
  return [...new Set(source
    .map((value) => normalizeText(value, maxLen).toLowerCase())
    .filter(Boolean))];
}

function uniqueNormalizedIntegers(values) {
  const source = Array.isArray(values) ? values : [];
  return [...new Set(source
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0))];
}
function normalizeAdTypeInput(value) {
  const normalized = normalizeText(value, 24).toLowerCase();
  return AD_TYPES.includes(normalized) ? normalized : 'horizontal';
}

function normalizeAdStatusInput(value) {
  const normalized = normalizeText(value, 24).toLowerCase();
  return AD_STATUS_OPTIONS.includes(normalized) ? normalized : 'active';
}

function normalizeAdImagePlacementInput(value) {
  return normalizeText(value, 12).toLowerCase() === 'cover' ? 'cover' : 'circle';
}

function clampInteger(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeAdDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function sanitizeAdPlacements(value, fallbackType = 'horizontal') {
  const source = Array.isArray(value) ? value : [value];
  const placements = [...new Set(source
    .map((item) => normalizeText(item, 64))
    .filter((item) => isKnownAdSlot(item)))];
  if (placements.length > 0) return placements;
  return getDefaultPlacementsForType(fallbackType);
}

function sanitizeAdTargeting(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    pageTypes: uniqueNormalizedLowercaseStrings(source.pageTypes, 24)
      .filter((item) => AD_PAGE_TYPES.includes(item)),
    articleIds: uniqueNormalizedIntegers(source.articleIds),
    categoryIds: uniqueNormalizedLowercaseStrings(source.categoryIds, 64),
    excludeArticleIds: uniqueNormalizedIntegers(source.excludeArticleIds),
    excludeCategoryIds: uniqueNormalizedLowercaseStrings(source.excludeCategoryIds, 64),
  };
}

function sanitizeAdPayload(payload, { partial = false } = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const next = {};
  const nextType = hasOwn(source, 'type') ? normalizeAdTypeInput(source.type) : 'horizontal';
  const nextShowButton = hasOwn(source, 'showButton') ? source.showButton !== false : true;
  const nextClickable = hasOwn(source, 'clickable') ? source.clickable !== false : true;
  const nextShowTitle = hasOwn(source, 'showTitle') ? source.showTitle !== false : true;
  const hasDesktopImage = hasOwn(source, 'imageDesktop') || hasOwn(source, 'image');
  const nextDesktopImage = normalizeText(hasOwn(source, 'imageDesktop') ? source.imageDesktop : source.image, 600);
  const hasDesktopImageMeta = hasOwn(source, 'imageMetaDesktop') || hasOwn(source, 'imageMeta');
  const rawDesktopImageMeta = hasOwn(source, 'imageMetaDesktop') ? source.imageMetaDesktop : source.imageMeta;

  if (!partial || hasOwn(source, 'type')) next.type = nextType;
  if (!partial || hasOwn(source, 'title')) next.title = normalizeText(source.title, 140);
  if (!partial || hasOwn(source, 'subtitle')) next.subtitle = normalizeText(source.subtitle, 240);
  if (!partial || hasOwn(source, 'showTitle')) next.showTitle = nextShowTitle;
  if (!partial || hasOwn(source, 'showButton')) next.showButton = nextShowButton;
  if (!partial || hasOwn(source, 'clickable')) next.clickable = nextClickable;
  if (!partial || hasOwn(source, 'cta')) next.cta = normalizeText(source.cta, 80) || '\u041d\u0430\u0443\u0447\u0438 \u043f\u043e\u0432\u0435\u0447\u0435';
  if (!partial || hasOwn(source, 'gradient')) next.gradient = normalizeText(source.gradient, 120);
  if (!partial || hasOwn(source, 'icon')) next.icon = normalizeText(source.icon, 16);
  if (!partial || hasOwn(source, 'link')) next.link = normalizeText(source.link, 400) || '#';
  if (!partial || hasOwn(source, 'color')) next.color = normalizeText(source.color, 40);
  if (!partial || hasDesktopImage) {
    next.imageDesktop = nextDesktopImage;
    next.image = nextDesktopImage;
  }
  if (!partial || hasOwn(source, 'imageMobile')) next.imageMobile = normalizeText(source.imageMobile, 600);
  if (!partial || hasDesktopImageMeta) {
    next.imageMetaDesktop = rawDesktopImageMeta && typeof rawDesktopImageMeta === 'object'
      ? normalizeAdImageMeta(rawDesktopImageMeta)
      : null;
    next.imageMeta = next.imageMetaDesktop;
  }
  if (!partial || hasOwn(source, 'imageMetaMobile')) {
    next.imageMetaMobile = source.imageMetaMobile && typeof source.imageMetaMobile === 'object'
      ? normalizeAdImageMeta(source.imageMetaMobile)
      : null;
  }
  if (!partial || hasOwn(source, 'imagePlacement')) next.imagePlacement = normalizeAdImagePlacementInput(source.imagePlacement);
  if (!partial || hasOwn(source, 'fitMode')) next.fitMode = normalizeAdFitMode(source.fitMode);
  if (!partial || hasOwn(source, 'status')) next.status = normalizeAdStatusInput(source.status);
  if (!partial || hasOwn(source, 'campaignName')) next.campaignName = normalizeText(source.campaignName, 120);
  if (!partial || hasOwn(source, 'notes')) next.notes = normalizeText(source.notes, 2000);
  if (!partial || hasOwn(source, 'placements')) next.placements = sanitizeAdPlacements(source.placements, next.type || nextType);
  if (!partial || hasOwn(source, 'targeting')) next.targeting = sanitizeAdTargeting(source.targeting);
  if (!partial || hasOwn(source, 'priority')) next.priority = clampInteger(source.priority, 0, { min: -1000, max: 1000 });
  if (!partial || hasOwn(source, 'weight')) next.weight = clampInteger(source.weight, 1, { min: 1, max: 100 });
  if (!partial || hasOwn(source, 'startAt')) next.startAt = sanitizeAdDate(source.startAt);
  if (!partial || hasOwn(source, 'endAt')) next.endAt = sanitizeAdDate(source.endAt);

  delete next.id;
  delete next._id;
  delete next.__v;
  return next;
}

function buildAdCandidate(existing, patch) {
  const current = existing && typeof existing === 'object' ? stripDocumentMetadata(existing) : {};
  return normalizeAdRecord({
    ...current,
    ...patch,
    targeting: hasOwn(patch, 'targeting') ? patch.targeting : current.targeting,
  });
}

function validateAdCandidate(ad) {
  const errors = [];
  const targeting = ad?.targeting || {
    pageTypes: [],
    articleIds: [],
    categoryIds: [],
    excludeArticleIds: [],
    excludeCategoryIds: [],
  };
  const slots = (Array.isArray(ad?.placements) ? ad.placements : [])
    .map((slotId) => getAdSlot(slotId))
    .filter(Boolean);

  if (!ad?.title) errors.push('Ad title is required');
  if (ad?.fitMode && !['cover', 'contain'].includes(ad.fitMode)) errors.push('Invalid ad fit mode');
  if (ad?.showButton !== false && !ad?.cta) errors.push('Ad CTA is required');
  if (ad?.clickable !== false && (!ad?.link || ad?.link === '#')) errors.push('Ad link is required for clickable ads');
  if (!AD_TYPES.includes(ad?.type)) errors.push('Invalid ad type');
  if (!AD_STATUS_OPTIONS.includes(ad?.status)) errors.push('Invalid ad status');
  if (slots.length === 0) errors.push('Select at least one valid placement');
  if (targeting.articleIds.length > 0 && !slots.some((slot) => slot.supportsArticleTargeting)) {
    errors.push('Selected placements do not support article targeting');
  }
  if (targeting.categoryIds.length > 0 && !slots.some((slot) => slot.supportsCategoryTargeting)) {
    errors.push('Selected placements do not support category targeting');
  }
  if (ad?.startAt && ad?.endAt) {
    const startMs = new Date(ad.startAt).getTime();
    const endMs = new Date(ad.endAt).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs) {
      errors.push('startAt must be before endAt');
    }
  }

  return errors;
}

async function fetchAllAdsSorted() {
  const items = await Ad.find().sort({ priority: -1, id: -1 }).lean();
  return items.map((item) => normalizeAdRecord(stripDocumentMetadata(item)));
}

async function listPublicAds() {
  const items = await fetchAllAdsSorted();
  return filterPublicAds(items);
}

async function listPublicGames() {
  const items = await GameDefinition.find({ active: true }).sort('sortOrder').lean();
  return items.map((item) => stripDocumentMetadata(item));
}

async function listAdsForRequest(req) {
  const items = await fetchAllAdsSorted();
  const maybeUser = decodeTokenFromRequest(req);
  const canManageAds = maybeUser ? await hasPermissionForSection(maybeUser, 'ads') : false;
  return canManageAds ? items : filterPublicAds(items);
}

function sanitizeAdAnalyticsContext(payload) {
  const slotId = normalizeText(payload?.slot, 120);
  if (!isKnownAdSlot(slotId)) {
    return { error: 'Invalid ad slot' };
  }

  const slot = getAdSlot(slotId);
  const rawPageType = normalizeText(payload?.pageType, 24).toLowerCase();
  const pageType = AD_PAGE_TYPES.includes(rawPageType) ? rawPageType : slot.pageType;
  const parsedArticleId = Number.parseInt(payload?.articleId, 10);
  const articleId = Number.isInteger(parsedArticleId) && parsedArticleId > 0 ? parsedArticleId : null;
  const categoryId = normalizeText(payload?.categoryId, 64).toLowerCase();

  return {
    slot: slotId,
    pageType,
    articleId,
    categoryId,
  };
}

function clampAdAnalyticsDays(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return DEFAULT_AD_ANALYTICS_DAYS;
  return Math.min(365, Math.max(1, parsed));
}

async function resolveTrackedAdCandidate(adId, context) {
  const publicAds = await listPublicAds();
  const rotationPool = getAdRotationPool(publicAds, context);
  return rotationPool.find((candidate) => Number.parseInt(candidate?.id, 10) === adId) || null;
}

async function recordAdAnalyticsEvent({ req, adId, eventType, context }) {
  if (!AD_EVENT_TYPES.includes(eventType)) {
    throw new Error('Invalid ad analytics event type');
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + adAnalyticsRetentionMs);
  const isImpression = eventType === 'impression';
  const payload = {
    adId,
    eventType,
    slot: context.slot,
    pageType: context.pageType,
    articleId: context.articleId,
    categoryId: context.categoryId,
    viewerHash: hashClientFingerprint(req, `ad:${adId}`),
    windowKey: isImpression ? getWindowKey(adImpressionWindowMs) : null,
    createdAt,
    expiresAt,
  };

  try {
    await AdEvent.create(payload);
    return { deduped: false };
  } catch (error) {
    if (isImpression && isMongoDuplicateKeyError(error)) {
      return { deduped: true };
    }
    throw error;
  }
}

async function buildAdAnalyticsSummary({ days = DEFAULT_AD_ANALYTICS_DAYS } = {}) {
  const safeDays = clampAdAnalyticsDays(days);
  const cutoff = new Date(Date.now() - (safeDays * 24 * 60 * 60 * 1000));
  const rows = await AdEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: cutoff },
        eventType: { $in: AD_EVENT_TYPES },
      },
    },
    {
      $group: {
        _id: { adId: '$adId', eventType: '$eventType' },
        count: { $sum: 1 },
        lastAt: { $max: '$createdAt' },
      },
    },
  ]);

  const itemsByAdId = new Map();
  rows.forEach((row) => {
    const adId = Number.parseInt(row?._id?.adId, 10);
    if (!Number.isInteger(adId)) return;

    const current = itemsByAdId.get(adId) || {
      adId,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      lastImpressionAt: null,
      lastClickAt: null,
    };

    if (row?._id?.eventType === 'impression') {
      current.impressions = Number(row.count) || 0;
      current.lastImpressionAt = row.lastAt || null;
    }
    if (row?._id?.eventType === 'click') {
      current.clicks = Number(row.count) || 0;
      current.lastClickAt = row.lastAt || null;
    }

    current.ctr = current.impressions > 0
      ? Number(((current.clicks / current.impressions) * 100).toFixed(2))
      : 0;

    itemsByAdId.set(adId, current);
  });

  const items = [...itemsByAdId.values()]
    .sort((left, right) => right.impressions - left.impressions || right.clicks - left.clicks || right.adId - left.adId);
  const totals = items.reduce((acc, item) => {
    acc.impressions += item.impressions;
    acc.clicks += item.clicks;
    return acc;
  }, { impressions: 0, clicks: 0, ctr: 0 });
  totals.ctr = totals.impressions > 0
    ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2))
    : 0;

  return {
    days: safeDays,
    generatedAt: new Date().toISOString(),
    totals,
    items,
  };
}

const adsRouter = express.Router();

adsRouter.get('/analytics/summary', requireAuth, requirePermission('ads'), async (req, res) => {
  try {
    const summary = await buildAdAnalyticsSummary({ days: req.query.days });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

adsRouter.post('/:id/impression', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const context = sanitizeAdAnalyticsContext(req.body);
    if (context.error) return res.status(400).json({ error: context.error });

    const resolvedAd = await resolveTrackedAdCandidate(id, context);
    if (!resolvedAd) return res.status(404).json({ error: 'Ad is not active for this slot' });

    const result = await recordAdAnalyticsEvent({ req, adId: id, eventType: 'impression', context });
    res.status(result.deduped ? 200 : 201).json({ ok: true, deduped: result.deduped });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

adsRouter.post('/:id/click', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const context = sanitizeAdAnalyticsContext(req.body);
    if (context.error) return res.status(400).json({ error: context.error });

    const resolvedAd = await resolveTrackedAdCandidate(id, context);
    if (!resolvedAd) return res.status(404).json({ error: 'Ad is not active for this slot' });

    await recordAdAnalyticsEvent({ req, adId: id, eventType: 'click', context });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

adsRouter.get('/', cacheMiddleware, async (req, res) => {
  try {
    const items = await listAdsForRequest(req);
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

adsRouter.post('/', requireAuth, requirePermission('ads'), async (req, res) => {
  try {
    const patch = sanitizeAdPayload(req.body, { partial: false });
    const candidate = buildAdCandidate(null, patch);
    const errors = validateAdCandidate(candidate);
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

    const id = await nextNumericId(Ad);
    const item = await Ad.create({ ...candidate, id });
    const obj = normalizeAdRecord(stripDocumentMetadata(item.toJSON()));

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'create',
      resource: 'ads',
      resourceId: id,
      details: obj.campaignName || obj.title || '',
    }).catch(() => { });

    invalidateCacheGroup('ads', 'ads-mutation');

    res.status(201).json(obj);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

adsRouter.put('/:id', requireAuth, requirePermission('ads'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const patch = sanitizeAdPayload(req.body, { partial: true });
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    const existing = await Ad.findOne({ id }).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const candidate = buildAdCandidate(existing, patch);
    const errors = validateAdCandidate(candidate);
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

    const { id: _ignoredId, ...updateDoc } = candidate;
    const item = await Ad.findOneAndUpdate({ id }, { $set: updateDoc }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: 'Not found' });

    const obj = normalizeAdRecord(stripDocumentMetadata(item.toJSON()));
    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'update',
      resource: 'ads',
      resourceId: id,
      details: obj.campaignName || obj.title || '',
    }).catch(() => { });

    invalidateCacheGroup('ads', 'ads-mutation');

    res.json(obj);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

adsRouter.delete('/:id', requireAuth, requirePermission('ads'), async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await Ad.deleteOne({ id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Not found' });

    AuditLog.create({
      user: req.user.name,
      userId: req.user.userId,
      action: 'delete',
      resource: 'ads',
      resourceId: id,
      details: '',
    }).catch(() => { });

    invalidateCacheGroup('ads', 'ads-mutation');

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});
app.use('/api/ads', adsRouter);
// ─── Standard CRUD Routes ───
app.use('/api/authors', numericCrud(Author, 'authors', { id: -1 }, [], 'profiles'));
app.use('/api/wanted', numericCrud(Wanted, 'wanted', { id: -1 }, [], 'wanted'));
app.use('/api/jobs', numericCrud(Job, 'jobs', { id: -1 }, [], 'jobs'));
app.use('/api/court', numericCrud(Court, 'court', { id: -1 }, [], 'court'));
app.use('/api/events', numericCrud(Event, 'events', { id: -1 }, [], 'events'));
app.use('/api/polls', numericCrud(Poll, 'polls', { id: -1 }, [], 'polls'));
app.use('/api/gallery', numericCrud(Gallery, 'gallery', { id: -1 }, [], 'gallery'));

const commentsRouter = createCommentsRouter({
  Article,
  AuditLog,
  collectCommentThreadIds,
  commentContainsBlockedTerms,
  commentCreateLimiter,
  commentReactionLimiter,
  Comment,
  CommentReaction,
  decodeTokenFromRequest,
  getPublishedFilter,
  hasOwn,
  hasPermissionForSection,
  hashClientFingerprint,
  nextNumericId,
  normalizeCommentReaction,
  normalizeText,
  parseCollectionPagination,
  publicError,
  requireAuth,
  requirePermission,
  syncCommentReactionTotals,
});

app.use('/api/comments', commentsRouter);

const contactMessagesRouter = createContactMessagesRouter({
  ContactMessage,
  contactMessageLimiter,
  hasOwn,
  nextNumericId,
  normalizeText,
  parsePositiveInt,
  publicError,
  requireAuth,
  requirePermission,
});

app.use('/api/contact-messages', contactMessagesRouter);

// ─── Roles / Permissions ───
registerPermissionRoutes(app, {
  DEFAULT_PERMISSION_DOCS,
  ensureDefaultPermissionDocs,
  hasPermissionForSection,
  normalizeText,
  Permission,
  publicError,
  requireAuth,
  requirePermission,
  sanitizePermissionMap,
});

// ─── Games API (Public) ───
const SUPPORTED_GAME_SLUGS = new Set(['word', 'connections', 'quiz', 'sudoku', 'hangman', 'spellingbee', 'crossword']);
const SUPPORTED_GAME_TYPES = new Set(['word', 'connections', 'quiz', 'sudoku', 'hangman', 'spellingbee', 'crossword']);
const SUPPORTED_PUZZLE_STATUSES = new Set(['draft', 'published', 'archived']);
const SUPPORTED_PUZZLE_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const TEMPORARILY_UNAVAILABLE_GAME_ERROR = 'Тази игра временно не е активна.';

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function statusAwarePublicError(error) {
  return error?.status && error.status < 500
    ? (error.message || 'Request failed')
    : publicError(error);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function toSafeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeStringArray(values, maxLen = 120, options = {}) {
  const { uppercase = false } = options;
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeText(String(value || ''), maxLen))
    .filter(Boolean)
    .map((value) => (uppercase ? value.toUpperCase() : value));
}

function getTodayGameDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(new Date());
  return `${year}-${month}-${day}`;
}

function getPuzzleActiveUntilDate(puzzle) {
  const activeUntilDate = normalizeText(puzzle?.activeUntilDate, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(activeUntilDate || '')) return activeUntilDate;
  return normalizeText(puzzle?.puzzleDate, 10);
}

function buildActiveGamePuzzleDateExpr(date) {
  return {
    $and: [
      { $lte: ['$puzzleDate', date] },
      { $gte: [{ $ifNull: ['$activeUntilDate', '$puzzleDate'] }, date] },
    ],
  };
}

async function findActivePublishedGamePuzzle(gameSlug, date) {
  return GamePuzzle.findOne({
    gameSlug,
    status: 'published',
    $expr: buildActiveGamePuzzleDateExpr(date),
    $or: [
      { publishAt: { $exists: false } },
      { publishAt: null },
      { publishAt: { $lte: new Date() } },
    ],
  })
    .sort({ puzzleDate: -1, activeUntilDate: -1, publishAt: -1, id: -1 })
    .lean();
}

function stripPuzzleForPublic(puzzle) {
  const safePuzzle = { ...(puzzle || {}) };
  delete safePuzzle.editorNotes;
  delete safePuzzle.solution;
  return safePuzzle;
}

async function canManageGamesFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.userId }).lean();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return await hasPermissionForSection(user, 'games');
  } catch {
    return false;
  }
}

async function resolveGameAccess(req, rawSlug) {
  const slug = normalizeText(rawSlug, 64).toLowerCase();
  const canManageGames = await canManageGamesFromRequest(req);
  const game = await GameDefinition.findOne({ slug }).lean();

  return {
    slug,
    game,
    canManageGames,
    isPubliclyAvailable: Boolean(game?.active),
  };
}

function sanitizeGameDefinitionInput(input, existingGame = null) {
  if (!isPlainObject(input)) throw badRequest('Invalid game payload.');

  const slug = existingGame
    ? existingGame.slug
    : normalizeText(input.slug, 64).toLowerCase();
  const type = existingGame
    ? existingGame.type
    : normalizeText(input.type, 32).toLowerCase();
  const title = normalizeText(hasOwn(input, 'title') ? input.title : existingGame?.title, 120);
  const description = normalizeText(hasOwn(input, 'description') ? input.description : existingGame?.description, 500);
  const icon = normalizeText(hasOwn(input, 'icon') ? input.icon : existingGame?.icon, 64);
  const theme = normalizeText(hasOwn(input, 'theme') ? input.theme : existingGame?.theme, 32);
  const active = hasOwn(input, 'active')
    ? parseBooleanFlag(input.active, true)
    : Boolean(existingGame?.active);
  const sortOrder = hasOwn(input, 'sortOrder')
    ? toSafeInteger(input.sortOrder, 0)
    : toSafeInteger(existingGame?.sortOrder, 0);

  if (!title) throw badRequest('Game title is required.');
  if (!SUPPORTED_GAME_SLUGS.has(slug)) throw badRequest('Unsupported game slug.');
  if (!SUPPORTED_GAME_TYPES.has(type)) throw badRequest('Unsupported game type.');
  if (slug !== type) throw badRequest('Game slug must match the supported game type.');

  if (existingGame) {
    if (hasOwn(input, 'slug') && normalizeText(input.slug, 64).toLowerCase() !== existingGame.slug) {
      throw badRequest('Game slug cannot be changed.');
    }
    if (hasOwn(input, 'type') && normalizeText(input.type, 32).toLowerCase() !== existingGame.type) {
      throw badRequest('Game type cannot be changed.');
    }
  }

  return {
    slug,
    title,
    type,
    description,
    icon,
    active,
    sortOrder,
    theme,
    updatedAt: new Date(),
  };
}

function validateWordPuzzle(payloadInput, solutionInput) {
  if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
    throw badRequest('Word puzzle payload and solution must be JSON objects.');
  }

  const wordLength = toSafeInteger(payloadInput.wordLength, 5);
  const maxAttempts = toSafeInteger(payloadInput.maxAttempts, 6);
  const answer = normalizeText(solutionInput.answer, 32).toUpperCase();
  const allowedWords = sanitizeStringArray(solutionInput.allowedWords, 32, { uppercase: true });
  const keyboardLayout = Array.isArray(payloadInput.keyboardLayout)
    ? sanitizeStringArray(payloadInput.keyboardLayout, 64)
    : normalizeText(String(payloadInput.keyboardLayout || ''), 160);
  const hint = normalizeText(solutionInput.hint, 160);

  if (wordLength < 3 || wordLength > 12) throw badRequest('Word puzzles must use a word length between 3 and 12.');
  if (maxAttempts < 1 || maxAttempts > 12) throw badRequest('Word puzzles must allow between 1 and 12 attempts.');
  if (!answer || answer.length !== wordLength) throw badRequest('Word puzzle answer must match the configured word length.');
  if (allowedWords.some((word) => word.length !== wordLength)) {
    throw badRequest('Every allowed guess must match the configured word length.');
  }

  const normalizedAllowedWords = [...new Set([answer, ...allowedWords])];
  return {
    payload: {
      wordLength,
      maxAttempts,
      keyboardLayout,
    },
    solution: {
      answer,
      allowedWords: normalizedAllowedWords,
      ...(hint ? { hint } : {}),
    },
  };
}

function validateConnectionsPuzzle(payloadInput, solutionInput) {
  if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
    throw badRequest('Connections puzzle payload and solution must be JSON objects.');
  }

  const items = sanitizeStringArray(payloadInput.items, 80);
  if (items.length !== 16 || new Set(items).size !== 16) {
    throw badRequest('Connections puzzles require exactly 16 unique items.');
  }

  const rawGroups = Array.isArray(solutionInput.groups) ? solutionInput.groups : [];
  if (rawGroups.length !== 4) throw badRequest('Connections puzzles require exactly 4 solution groups.');

  const groups = rawGroups.map((group, index) => {
    if (!isPlainObject(group)) throw badRequest(`Connections group #${index + 1} must be a JSON object.`);
    const label = normalizeText(group.label, 80);
    const difficulty = normalizeText(String(group.difficulty ?? index + 1), 24);
    const explanation = normalizeText(group.explanation, 240);
    const groupItems = sanitizeStringArray(group.items, 80);

    if (!label) throw badRequest(`Connections group #${index + 1} must have a label.`);
    if (groupItems.length !== 4 || new Set(groupItems).size !== 4) {
      throw badRequest(`Connections group #${index + 1} must contain 4 unique items.`);
    }

    return {
      label,
      difficulty,
      items: groupItems,
      ...(explanation ? { explanation } : {}),
    };
  });

  const groupedItems = groups.flatMap((group) => group.items);
  if (groupedItems.length !== 16 || new Set(groupedItems).size !== 16) {
    throw badRequest('Connections solution groups must cover 16 unique items.');
  }

  const groupedItemSet = new Set(groupedItems);
  if (items.some((item) => !groupedItemSet.has(item)) || groupedItems.some((item) => !items.includes(item))) {
    throw badRequest('Connections payload items must match the solution groups exactly.');
  }

  return {
    payload: { items },
    solution: { groups },
  };
}

function validateQuizPuzzle(payloadInput, solutionInput) {
  if (!isPlainObject(payloadInput)) throw badRequest('Quiz puzzle payload must be a JSON object.');

  const rawQuestions = Array.isArray(payloadInput.questions) ? payloadInput.questions : [];
  if (rawQuestions.length === 0) throw badRequest('Quiz puzzles require at least one question.');

  const questions = rawQuestions.map((question, index) => {
    if (!isPlainObject(question)) throw badRequest(`Quiz question #${index + 1} must be a JSON object.`);

    const prompt = normalizeText(question.question, 240);
    const options = sanitizeStringArray(question.options, 160);
    const correctIndex = toSafeInteger(question.correctIndex, -1);
    const explanation = normalizeText(question.explanation, 280);

    if (!prompt) throw badRequest(`Quiz question #${index + 1} must have text.`);
    if (options.length !== 4) throw badRequest(`Quiz question #${index + 1} must have exactly 4 answer options.`);
    if (correctIndex < 0 || correctIndex >= options.length) {
      throw badRequest(`Quiz question #${index + 1} must have a valid correctIndex.`);
    }

    const sanitizedQuestion = {
      question: prompt,
      options,
      correctIndex,
    };

    if (explanation) sanitizedQuestion.explanation = explanation;
    if (question.articleId !== undefined && question.articleId !== null && question.articleId !== '') {
      sanitizedQuestion.articleId = typeof question.articleId === 'number'
        ? question.articleId
        : normalizeText(String(question.articleId), 64);
    }

    return sanitizedQuestion;
  });

  return {
    payload: { questions },
    solution: isPlainObject(solutionInput) ? solutionInput : {},
  };
}

const HANGMAN_ANSWER_PATTERN = /^[\p{L}\p{N}]+$/u;
const SINGLE_CHAR_PATTERN = /^[\p{L}\p{N}]$/u;

function validateHangmanPuzzle(payloadInput, solutionInput) {
  if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
    throw badRequest('Hangman puzzle payload and solution must be JSON objects.');
  }

  const answer = normalizeText(solutionInput.answer, 32).toUpperCase();
  const answerLength = Array.from(answer).length;
  const category = normalizeText(payloadInput.category, 80);
  const hint = normalizeText(payloadInput.hint, 180);
  const maxMistakes = toSafeInteger(payloadInput.maxMistakes, 7);
  const keyboardLayout = Array.isArray(payloadInput.keyboardLayout)
    ? sanitizeStringArray(payloadInput.keyboardLayout, 64, { uppercase: true })
    : normalizeText(String(payloadInput.keyboardLayout || 'bg'), 160);

  if (!category) throw badRequest('Hangman puzzles require a category.');
  if (!answer || answerLength < 3 || answerLength > 18) {
    throw badRequest('Hangman answer must be between 3 and 18 characters.');
  }
  if (!HANGMAN_ANSWER_PATTERN.test(answer)) {
    throw badRequest('Hangman answer must contain only letters or digits and no spaces.');
  }
  if (maxMistakes < 4 || maxMistakes > 10) {
    throw badRequest('Hangman puzzles must allow between 4 and 10 mistakes.');
  }

  return {
    payload: {
      category,
      ...(hint ? { hint } : {}),
      maxMistakes,
      keyboardLayout,
      answerLength,
    },
    solution: {
      answer,
    },
  };
}

function validateSpellingBeePuzzle(payloadInput, solutionInput) {
  if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
    throw badRequest('Spelling Bee payload and solution must be JSON objects.');
  }

  const title = normalizeText(payloadInput.title, 120);
  const deck = normalizeText(payloadInput.deck, 220);
  const centerLetter = normalizeSpellingBeeLetter(payloadInput.centerLetter);
  const outerLetters = normalizeSpellingBeeOuterLetters(payloadInput.outerLetters);
  const minWordLength = Math.max(
    SPELLING_BEE_MIN_WORD_LENGTH,
    Math.min(12, toSafeInteger(payloadInput.minWordLength, SPELLING_BEE_MIN_WORD_LENGTH))
  );

  if (!hasCompleteSpellingBeeHive(centerLetter, outerLetters)) {
    throw badRequest('Spelling Bee requires 7 unique hive letters.');
  }

  const analysis = analyzeSpellingBeeWords(solutionInput.words, {
    centerLetter,
    outerLetters,
    minWordLength,
  });

  if (analysis.normalizedWords.length === 0 || analysis.totalWords === 0) {
    throw badRequest('Spelling Bee requires at least one valid word.');
  }
  if (analysis.rejectedWords.length > 0) {
    const firstRejectedWord = analysis.rejectedWords[0];
    throw badRequest('Spelling Bee word "' + firstRejectedWord.word + '" is invalid (' + firstRejectedWord.reason + ').');
  }
  if (analysis.pangramCount === 0) {
    throw badRequest('Spelling Bee requires at least one pangram.');
  }

  return {
    payload: {
      ...(title ? { title } : {}),
      ...(deck ? { deck } : {}),
      centerLetter,
      outerLetters,
      minWordLength,
      totalWords: analysis.totalWords,
      pangramCount: analysis.pangramCount,
      maxScore: analysis.maxScore,
      longestWordLength: analysis.longestWordLength,
    },
    solution: {
      words: analysis.acceptedWords,
      pangrams: analysis.pangrams,
      scoreByWord: analysis.scoreByWord,
    },
  };
}

function normalizeCrosswordLayoutRows(rawLayout, width, height) {
  if (!Array.isArray(rawLayout) || rawLayout.length !== height) {
    throw badRequest('Crossword layout must contain one row per grid row.');
  }

  return rawLayout.map((row, rowIndex) => {
    const chars = Array.from(String(row || '').toUpperCase());
    if (chars.length !== width) {
      throw badRequest(`Crossword layout row #${rowIndex + 1} must have exactly ${width} cells.`);
    }
    if (chars.some((char) => char !== '#' && char !== '.')) {
      throw badRequest('Crossword layout rows may only contain "." and "#" characters.');
    }
    return chars.join('');
  });
}

function normalizeCrosswordSolutionRows(rawGrid, layoutRows, width, height) {
  if (!Array.isArray(rawGrid) || rawGrid.length !== height) {
    throw badRequest('Crossword solution must contain one row per grid row.');
  }

  return rawGrid.map((row, rowIndex) => {
    const chars = Array.from(String(row || '').toUpperCase());
    if (chars.length !== width) {
      throw badRequest(`Crossword solution row #${rowIndex + 1} must have exactly ${width} cells.`);
    }

    return chars.map((char, colIndex) => {
      const isBlock = layoutRows[rowIndex][colIndex] === '#';
      if (isBlock) {
        if (char !== '#') throw badRequest('Crossword solution must use "#" in every blocked cell.');
        return '#';
      }
      if (char !== '?' && !SINGLE_CHAR_PATTERN.test(char)) {
        throw badRequest('Crossword solution cells must contain a single letter, digit or ? placeholder.');
      }
      return char;
    }).join('');
  });
}

function normalizeCrosswordClues(rawEntries, expectedEntries, direction, options = {}) {
  const { requireText = true, allowMissingEntries = false } = options;
  if (!Array.isArray(rawEntries)) {
    if (!allowMissingEntries) {
      throw badRequest(`Crossword ${direction} clues must be an array.`);
    }
    rawEntries = [];
  }

  const usedIndices = new Set();
  return expectedEntries.map((expected) => {
    const matchIndex = rawEntries.findIndex((entry, index) => {
      if (usedIndices.has(index) || !isPlainObject(entry)) return false;
      const row = toSafeInteger(entry.row, -1);
      const col = toSafeInteger(entry.col, -1);
      const number = toSafeInteger(entry.number, -1);
      return (row === expected.row && col === expected.col) || number === expected.number;
    });

    const match = matchIndex >= 0 ? rawEntries[matchIndex] : null;
    if (matchIndex >= 0) usedIndices.add(matchIndex);

    const clue = normalizeText(match?.clue, 220);
    if (requireText && !clue) {
      throw badRequest(`Crossword clue #${expected.number} must have text.`);
    }

    return {
      number: expected.number,
      row: expected.row,
      col: expected.col,
      length: expected.length,
      clue,
    };
  });
}

function validateCrosswordPuzzle(payloadInput, solutionInput, options = {}) {
  if (!isPlainObject(payloadInput) || !isPlainObject(solutionInput)) {
    throw badRequest('Crossword puzzle payload and solution must be JSON objects.');
  }

  const { requireClueText = true, requireCompleteSolution = true, minEntryLength = MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH } = options;
  const rawLayout = Array.isArray(payloadInput.layout) ? payloadInput.layout : [];
  const derivedHeight = rawLayout.length;
  const derivedWidth = derivedHeight > 0 ? Array.from(String(rawLayout[0] || '')).length : 0;
  const width = toSafeInteger(payloadInput.width, derivedWidth);
  const height = toSafeInteger(payloadInput.height, derivedHeight);
  const title = normalizeText(payloadInput.title, 80);
  const deck = normalizeText(payloadInput.deck, 180);

  if (width < 3 || width > 15 || height < 3 || height > 15) {
    throw badRequest('Crossword grid must be between 3x3 and 15x15.');
  }

  const layout = normalizeCrosswordLayoutRows(rawLayout, width, height);
  const solutionGrid = normalizeCrosswordSolutionRows(solutionInput.grid, layout, width, height);
  const expectedEntries = getCrosswordEntries(layout);
  if (expectedEntries.across.length === 0 || expectedEntries.down.length === 0) {
    throw badRequest('Crossword grid must include at least one across and one down entry.');
  }

  const rawClues = isPlainObject(payloadInput.clues) ? payloadInput.clues : {};
  const clues = {
    across: normalizeCrosswordClues(rawClues.across, expectedEntries.across, 'across', { requireText: requireClueText, allowMissingEntries: !requireClueText }),
    down: normalizeCrosswordClues(rawClues.down, expectedEntries.down, 'down', { requireText: requireClueText, allowMissingEntries: !requireClueText }),
  };

  const analysis = analyzeCrosswordConstruction({
    width,
    height,
    layoutRows: layout,
    clues,
    solutionGrid,
    minEntryLength,
    requireClueText,
    requireCompleteSolution,
  });
  if (analysis.blockers.length > 0) {
    throw badRequest(analysis.blockers[0].message);
  }

  return {
    payload: {
      ...(title ? { title } : {}),
      ...(deck ? { deck } : {}),
      width,
      height,
      layout,
      clues,
    },
    solution: {
      grid: solutionGrid,
    },
  };
}

function normalizeCrosswordSubmissionGrid(rawGrid, layoutRows) {
  if (!Array.isArray(rawGrid) || rawGrid.length !== layoutRows.length) {
    throw badRequest('Crossword submission must contain one row per grid row.');
  }

  return layoutRows.map((layoutRow, rowIndex) => {
    const width = Array.from(layoutRow).length;
    const chars = Array.isArray(rawGrid[rowIndex])
      ? rawGrid[rowIndex].map((value) => String(value || '').trim().toUpperCase())
      : Array.from(String(rawGrid[rowIndex] || '').toUpperCase());

    if (chars.length !== width) {
      throw badRequest(`Crossword submission row #${rowIndex + 1} must have exactly ${width} cells.`);
    }

    return Array.from(layoutRow).map((layoutChar, colIndex) => {
      if (layoutChar === '#') return '#';
      const rawValue = Array.isArray(rawGrid[rowIndex])
        ? String(rawGrid[rowIndex][colIndex] || '').trim().toUpperCase()
        : String(chars[colIndex] || '').trim().toUpperCase();
      if (!rawValue) return '.';
      const char = Array.from(rawValue)[0] || '';
      if (!SINGLE_CHAR_PATTERN.test(char)) {
        throw badRequest('Crossword submission cells must contain only one letter or digit.');
      }
      return char;
    }).join('');
  });
}

function isGenericPlaceholderText(value) {
  const normalized = normalizeText(String(value || ''), 240).toUpperCase();
  if (!normalized) return false;
  return normalized === '?'
    || normalized.includes('TODO')
    || normalized.includes('PLACEHOLDER')
    || normalized.includes('REPLACE_ME')
    || normalized.includes('ПОПЪЛНИ');
}

function isPlaceholderWordPuzzle(_payload, solution) {
  const answer = normalizeText(solution?.answer, 32).toUpperCase();
  return answer === 'ДУМА1' || isGenericPlaceholderText(answer);
}

function isPlaceholderConnectionsPuzzle(payload, solution) {
  const items = sanitizeStringArray(payload?.items, 80);
  const groups = Array.isArray(solution?.groups) ? solution.groups : [];
  const usesTemplateItems = items.length === 16 && items.every((item) => /^[АБВГ]\d$/u.test(item));
  const usesGenericItems = items.some((item) => isGenericPlaceholderText(item));
  const templateLabels = ['ГРУПА А', 'ГРУПА Б', 'ГРУПА В', 'ГРУПА Г'];
  const usesTemplateLabels = groups.length === 4
    && groups.every((group, index) => normalizeText(group?.label, 80).toUpperCase() === templateLabels[index]);
  const usesGenericLabels = groups.some((group) => isGenericPlaceholderText(group?.label));

  return usesTemplateItems || usesGenericItems || usesTemplateLabels || usesGenericLabels;
}

function isPlaceholderQuizPuzzle(payload) {
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  return questions.some((question) => {
    const prompt = normalizeText(question?.question, 240);
    const options = sanitizeStringArray(question?.options, 32);
    return (prompt === '?' && options.length === 4 && options.every((option, index) => option === String(index + 1)))
      || isGenericPlaceholderText(prompt)
      || options.some((option) => isGenericPlaceholderText(option));
  });
}

function isPlaceholderHangmanPuzzle(payload, solution) {
  return isGenericPlaceholderText(solution?.answer)
    || isGenericPlaceholderText(payload?.category)
    || isGenericPlaceholderText(payload?.hint);
}

function isPlaceholderCrosswordPuzzle(payload, solution) {
  if (isGenericPlaceholderText(payload?.title) || isGenericPlaceholderText(payload?.deck)) {
    return true;
  }

  const hasPlaceholderClues = ['across', 'down'].some((direction) => (
    Array.isArray(payload?.clues?.[direction])
      ? payload.clues[direction].some((entry) => isGenericPlaceholderText(entry?.clue))
      : false
  ));

  const hasPlaceholderSolution = Array.isArray(solution?.grid)
    ? solution.grid.some((row) => String(row || '').includes('?'))
    : false;

  return hasPlaceholderClues || hasPlaceholderSolution;
}

function isPlaceholderSpellingBeePuzzle(payload, solution) {
  return isGenericPlaceholderText(payload?.title)
    || isGenericPlaceholderText(payload?.deck)
    || (Array.isArray(solution?.words) ? solution.words.some((word) => isGenericPlaceholderText(word)) : false);
}

function isPlaceholderGamePuzzle(gameType, payload, solution) {
  if (gameType === 'word') return isPlaceholderWordPuzzle(payload, solution);
  if (gameType === 'hangman') return isPlaceholderHangmanPuzzle(payload, solution);
  if (gameType === 'connections') return isPlaceholderConnectionsPuzzle(payload, solution);
  if (gameType === 'spellingbee') return isPlaceholderSpellingBeePuzzle(payload, solution);
  if (gameType === 'crossword') return isPlaceholderCrosswordPuzzle(payload, solution);
  if (gameType === 'quiz') return isPlaceholderQuizPuzzle(payload, solution);
  return false;
}

function sanitizeGamePuzzleInput(game, input, existingPuzzle = null) {
  if (!game) throw badRequest('Game definition not found.');
  if (!isPlainObject(input)) throw badRequest('Invalid puzzle payload.');

  const puzzleDate = hasOwn(input, 'puzzleDate')
    ? normalizeText(input.puzzleDate, 10)
    : existingPuzzle?.puzzleDate;
  const status = normalizeText(
    hasOwn(input, 'status') ? input.status : existingPuzzle?.status || 'draft',
    24
  ).toLowerCase();
  const difficulty = normalizeText(
    hasOwn(input, 'difficulty') ? input.difficulty : existingPuzzle?.difficulty || 'medium',
    16
  ).toLowerCase();
  const editorNotes = normalizeText(
    hasOwn(input, 'editorNotes') ? input.editorNotes : existingPuzzle?.editorNotes,
    500
  );
  const rawPayload = hasOwn(input, 'payload') ? input.payload : existingPuzzle?.payload;
  const rawSolution = hasOwn(input, 'solution') ? input.solution : existingPuzzle?.solution;
  const requestedPublishAt = hasOwn(input, 'publishAt')
    ? sanitizeDateTime(input.publishAt)
    : existingPuzzle?.publishAt || null;
  const requestedActiveUntilDate = hasOwn(input, 'activeUntilDate')
    ? normalizeText(input.activeUntilDate, 10)
    : getPuzzleActiveUntilDate(existingPuzzle) || puzzleDate;
  const activeUntilDate = requestedActiveUntilDate || puzzleDate;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate || '')) throw badRequest('Puzzle date must be in YYYY-MM-DD format.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(activeUntilDate || '')) throw badRequest('Active until date must be in YYYY-MM-DD format.');
  if (activeUntilDate < puzzleDate) throw badRequest('Active until date cannot be before puzzle date.');
  if (!SUPPORTED_PUZZLE_STATUSES.has(status)) throw badRequest('Invalid puzzle status.');
  if (!SUPPORTED_PUZZLE_DIFFICULTIES.has(difficulty)) throw badRequest('Invalid puzzle difficulty.');

  let validatedPuzzle;
  if (game.type === 'word') {
    validatedPuzzle = validateWordPuzzle(rawPayload, rawSolution);
  } else if (game.type === 'hangman') {
    validatedPuzzle = validateHangmanPuzzle(rawPayload, rawSolution);
  } else if (game.type === 'connections') {
    validatedPuzzle = validateConnectionsPuzzle(rawPayload, rawSolution);
  } else if (game.type === 'spellingbee') {
    validatedPuzzle = validateSpellingBeePuzzle(rawPayload, rawSolution);
  } else if (game.type === 'crossword') {
    validatedPuzzle = validateCrosswordPuzzle(rawPayload, rawSolution, {
      requireClueText: status === 'published',
      requireCompleteSolution: status === 'published',
      minEntryLength: status === 'published' ? MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH : 1,
    });
  } else if (game.type === 'quiz') {
    validatedPuzzle = validateQuizPuzzle(rawPayload, rawSolution);
  } else {
    throw badRequest('Unsupported game type.');
  }

  const placeholderPuzzle = isPlaceholderGamePuzzle(game.type, validatedPuzzle.payload, validatedPuzzle.solution);
  if (status === 'published' && placeholderPuzzle) {
    throw badRequest('Replace the placeholder game content before publishing.');
  }

  return {
    gameSlug: game.slug,
    puzzleDate,
    activeUntilDate,
    status,
    publishAt: status === 'published' ? (requestedPublishAt || new Date()) : requestedPublishAt,
    difficulty,
    payload: validatedPuzzle.payload,
    solution: validatedPuzzle.solution,
    editorNotes,
    updatedAt: new Date(),
  };
}

const gamesRouter = createPublicGamesRouter({
  findActivePublishedGamePuzzle,
  GamePuzzle,
  getSpellingBeeWordScore,
  getSpellingBeeWordValidation,
  getTodayGameDate,
  isPlaceholderGamePuzzle,
  listPublicGames,
  normalizeCrosswordSubmissionGrid,
  normalizeSpellingBeeLetter,
  normalizeSpellingBeeOuterLetters,
  normalizeSpellingBeeWord,
  normalizeSpellingBeeWords,
  normalizeText,
  publicError,
  resolveGameAccess,
  sanitizeStringArray,
  SINGLE_CHAR_PATTERN,
  SPELLING_BEE_MIN_WORD_LENGTH,
  statusAwarePublicError,
  stripPuzzleForPublic,
  TEMPORARILY_UNAVAILABLE_GAME_ERROR,
  toSafeInteger,
});

app.use('/api/games', gamesRouter);

// ─── Games API (Admin) ───
const adminGamesRouter = createAdminGamesRouter({
  GameDefinition,
  GamePuzzle,
  invalidateCacheGroup,
  isPlaceholderGamePuzzle,
  MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
  nextNumericId,
  normalizeText,
  publicError,
  sanitizeGameDefinitionInput,
  sanitizeGamePuzzleInput,
  seedGamesOnly,
  statusAwarePublicError,
  validateCrosswordPuzzle,
});

app.use('/api/admin/games', requireAuth, requirePermission('games'), adminGamesRouter);

const catRouter = createCategoriesRouter({
  Article,
  Category,
  hasOwn,
  invalidateCacheGroup,
  normalizeText,
  publicError,
  requireAuth,
  requirePermission,
});

app.use('/api/categories', catRouter);

// ─── Breaking / Settings ───
registerSettingsRoutes(app, {
  AuditLog,
  Breaking,
  cacheMiddleware,
  createSettingsRevision,
  DEFAULT_HERO_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  formatSettingsRevisionList,
  HeroSettings,
  invalidateCacheGroup,
  invalidateCacheTags,
  normalizeText,
  publicError,
  requireAuth,
  requirePermission,
  sanitizeHeroSettingsPayload,
  sanitizeSiteSettingsPayload,
  serializeHeroSettings,
  serializeSiteSettings,
  SettingsRevision,
  SiteSettings,
});

// ─── Homepage payload (public initial homepage data only) ───
const BOOTSTRAP_OPTIONAL_SECTIONS = new Set(['jobs', 'court', 'events', 'gallery']);

function parseBootstrapInclude(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return new Set();
  }

  return new Set(
    input
      .split(',')
      .map((item) => String(item || '').trim().toLowerCase())
      .filter((item) => BOOTSTRAP_OPTIONAL_SECTIONS.has(item))
  );
}

app.get('/api/homepage', cacheMiddleware, async (req, res) => {
  try {
    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const articleFilter = canSeeDrafts ? {} : getPublishedFilter();
    const latestShowcaseLimit = parsePositiveInt(req.query.latestShowcaseLimit, 5, { min: 1, max: 12 });
    const latestWireLimit = parsePositiveInt(req.query.latestWireLimit, 16, { min: 0, max: 48 });
    const fieldsProjection = buildArticleProjection(req.query.fields) || HOMEPAGE_DEFAULT_ARTICLE_PROJECTION;

    const homepagePayloadFallbacks = {
      articleCandidates: [],
      totalArticles: 0,
      authors: [],
      categories: [],
      ads: [],
      breaking: [],
      siteSettings: null,
      wanted: [],
      polls: [],
      games: [],
    };

    let heroSettings = DEFAULT_HERO_SETTINGS;
    const errors = {};

    try {
      const heroDoc = await HeroSettings.findOne({ key: 'main' }).lean();
      heroSettings = serializeHeroSettings(heroDoc || DEFAULT_HERO_SETTINGS);
    } catch (error) {
      errors.heroSettings = publicError(error, 'Failed to load heroSettings');
    }

    const tasks = {
      articleCandidates: fetchHomepageArticleCandidates({
        articleFilter,
        fieldsProjection,
        heroSettings,
        latestShowcaseLimit,
        latestWireLimit,
      }),
      totalArticles: Article.countDocuments(articleFilter),
      authors: Author.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      categories: Category.find().select({ _id: 0, __v: 0 }).lean(),
      ads: listPublicAds(),
      breaking: Breaking.findOne().lean().then((doc) => doc?.items || []),
      siteSettings: SiteSettings.findOne({ key: 'main' }).lean().then((doc) => serializeSiteSettings(doc || DEFAULT_SITE_SETTINGS)),
      wanted: Wanted.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      polls: Poll.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      games: listPublicGames(),
    };

    const entries = Object.entries(tasks);
    const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
    const payload = {};

    settled.forEach((result, idx) => {
      const key = entries[idx][0];
      if (result.status === 'fulfilled') {
        payload[key] = result.value;
        return;
      }

      errors[key] = publicError(result.reason, 'Failed to load ' + key);
      payload[key] = homepagePayloadFallbacks[key] ?? null;
    });

    if (!Array.isArray(payload.articleCandidates)) payload.articleCandidates = [];
    if (!Array.isArray(payload.authors)) payload.authors = [];
    if (!Array.isArray(payload.categories)) payload.categories = [];
    if (!Array.isArray(payload.ads)) payload.ads = [];
    if (!Array.isArray(payload.breaking)) payload.breaking = [];
    if (!Array.isArray(payload.wanted)) payload.wanted = [];
    if (!Array.isArray(payload.polls)) payload.polls = [];
    if (!Array.isArray(payload.games)) payload.games = [];
    payload.totalArticles = Number.isInteger(payload.totalArticles) ? payload.totalArticles : 0;

    if (payload.articleCandidates.length === 0) {
      const legacyCandidates = await findLegacyPublicArticles(fieldsProjection, {
        limit: Math.min(160, Math.max(36, latestShowcaseLimit + latestWireLimit + HOMEPAGE_LATEST_BUFFER)),
      });
      if (legacyCandidates.length > 0) {
        payload.articleCandidates = legacyCandidates;
        payload.totalArticles = await countLegacyPublicArticles();
      }
    }

    payload.authors = stripDocumentList(payload.authors);
    payload.categories = stripDocumentList(payload.categories);
    payload.ads = stripDocumentList(payload.ads);
    payload.wanted = stripDocumentList(payload.wanted);
    payload.polls = stripDocumentList(payload.polls);

    const homepageSections = buildHomepageSections({
      articles: payload.articleCandidates,
      heroSettings,
      latestShowcaseLimit,
      latestWireLimit,
    });
    const articlePool = Array.isArray(homepageSections.selectedArticles) ? homepageSections.selectedArticles : [];
    const sections = buildHomepageSectionIdPayload(homepageSections);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      totalArticles: payload.totalArticles,
      articlePool,
      sections,
      articles: articlePool,
      authors: payload.authors,
      categories: payload.categories,
      ads: payload.ads,
      breaking: payload.breaking,
      heroSettings,
      siteSettings: payload.siteSettings,
      wanted: payload.wanted,
      polls: payload.polls,
      games: payload.games,
      ...(Object.keys(errors).length ? { errors } : {}),
    });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});
// ─── Search payload (public query data across homepage-related entities) ───
registerSearchRoutes(app, {
  Article,
  Court,
  Event,
  Job,
  Wanted,
  HOMEPAGE_DEFAULT_ARTICLE_PROJECTION,
  buildArticleProjection,
  buildSearchRegex,
  cacheMiddleware,
  decodeTokenFromRequest,
  escapeRegexForSearch,
  filterSearchResultsByType,
  getPublishedFilter,
  getSearchSuggestions,
  getTrendingSearches,
  hasPermissionForSection,
  normalizeSearchType,
  normalizeText,
  parsePositiveInt,
  publicError,
  recordSearchQuery,
  searchCollectionByTextAndRegex,
  sortArticlesByRecency,
  stripDocumentList,
});

// ─── Bootstrap (public initial payload) ───
// Consolidates the public "homepage" requests into a single roundtrip.
// Uses the same visibility rules as /api/articles (drafts are visible only to users with articles permission).
app.get('/api/bootstrap', cacheMiddleware, async (req, res) => {
  try {
    const maybeUser = decodeTokenFromRequest(req);
    const canSeeDrafts = maybeUser ? await hasPermissionForSection(maybeUser, 'articles') : false;
    const articleFilter = canSeeDrafts ? {} : getPublishedFilter();
    const fieldsProjection = buildArticleProjection(req.query.fields);
    const includeSections = parseBootstrapInclude(req.query.include);
    const articlePagination = parseCollectionPagination(req.query, { defaultLimit: 120, maxLimit: 500 });

    const tasks = {
      articles: findArticlesByRecency(
        articleFilter,
        fieldsProjection,
        articlePagination.shouldPaginate ? articlePagination.limit : 0,
        articlePagination.shouldPaginate ? { skip: articlePagination.skip } : {}
      ),
      authors: Author.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      categories: Category.find().select({ _id: 0, __v: 0 }).lean(),
      ads: listPublicAds(),
      breaking: Breaking.findOne().lean().then((doc) => doc?.items || []),
      heroSettings: HeroSettings.findOne({ key: 'main' }).lean().then((doc) => serializeHeroSettings(doc || DEFAULT_HERO_SETTINGS)),
      siteSettings: SiteSettings.findOne({ key: 'main' }).lean().then((doc) => serializeSiteSettings(doc || DEFAULT_SITE_SETTINGS)),
      wanted: Wanted.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      polls: Poll.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean(),
      games: listPublicGames(),
      ...(includeSections.has('jobs') ? { jobs: Job.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean() } : {}),
      ...(includeSections.has('court') ? { court: Court.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean() } : {}),
      ...(includeSections.has('events') ? { events: Event.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean() } : {}),
      ...(includeSections.has('gallery') ? { gallery: Gallery.find().sort({ id: -1 }).select({ _id: 0, __v: 0 }).lean() } : {}),
      ...(articlePagination.shouldPaginate ? { articleTotal: Article.countDocuments(articleFilter) } : {}),
    };

    const entries = Object.entries(tasks);
    const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
    const payload = {};
    const errors = {};

    settled.forEach((result, idx) => {
      const key = entries[idx][0];
      if (result.status === 'fulfilled') {
        payload[key] = result.value;
        return;
      }

      errors[key] = publicError(result.reason, 'Failed to load ' + key);
      payload[key] = key === 'articleTotal' ? 0 : null;
    });

    if (!Array.isArray(payload.articles)) payload.articles = [];
    if (!Array.isArray(payload.authors)) payload.authors = [];
    if (!Array.isArray(payload.categories)) payload.categories = [];
    if (!Array.isArray(payload.ads)) payload.ads = [];
    if (!Array.isArray(payload.breaking)) payload.breaking = [];
    if (!Array.isArray(payload.wanted)) payload.wanted = [];
    if (!Array.isArray(payload.games)) payload.games = [];
    if (includeSections.has('jobs') && !Array.isArray(payload.jobs)) payload.jobs = [];
    if (includeSections.has('court') && !Array.isArray(payload.court)) payload.court = [];
    if (includeSections.has('events') && !Array.isArray(payload.events)) payload.events = [];
    if (!Array.isArray(payload.polls)) payload.polls = [];
    if (includeSections.has('gallery') && !Array.isArray(payload.gallery)) payload.gallery = [];
    if (payload.articles.length === 0) {
      const legacyArticles = await findLegacyPublicArticles(fieldsProjection, {
        limit: articlePagination.shouldPaginate ? articlePagination.limit : 0,
        skip: articlePagination.shouldPaginate ? articlePagination.skip : 0,
      });
      if (legacyArticles.length > 0) {
        payload.articles = legacyArticles;
        payload.articleTotal = await countLegacyPublicArticles();
      }
    }

    payload.authors = stripDocumentList(payload.authors);
    payload.categories = stripDocumentList(payload.categories);
    payload.ads = stripDocumentList(payload.ads);
    payload.wanted = stripDocumentList(payload.wanted);
    if (includeSections.has('jobs')) payload.jobs = stripDocumentList(payload.jobs);
    else delete payload.jobs;
    if (includeSections.has('court')) payload.court = stripDocumentList(payload.court);
    else delete payload.court;
    if (includeSections.has('events')) payload.events = stripDocumentList(payload.events);
    else delete payload.events;
    payload.polls = stripDocumentList(payload.polls);
    if (includeSections.has('gallery')) payload.gallery = stripDocumentList(payload.gallery);
    else delete payload.gallery;
    const articleTotal = Number.isInteger(payload.articleTotal) ? payload.articleTotal : 0;
    delete payload.articleTotal;

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ...payload,
      ...(articlePagination.shouldPaginate ? {
        pagination: {
          page: articlePagination.page,
          limit: articlePagination.limit,
          total: articleTotal,
          totalPages: Math.max(1, Math.ceil(articleTotal / articlePagination.limit)),
        },
      } : {}),
      ...(Object.keys(errors).length ? { errors } : {}),
    });
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});
// ─── Auth ───
registerAuthRoutes(app, {
  accessTokenMaxAgeMs,
  authLimiter,
  AuthSession,
  bcrypt,
  clearRefreshCookie,
  decodeRefreshToken,
  normalizeText,
  parseCookies,
  publicError,
  REFRESH_COOKIE_NAME,
  rotateTokensForUser,
  setRefreshCookie,
  User,
});

// ─── Poll Vote ───
app.post('/api/polls/:id/vote', pollVoteLimiter, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const optionIndex = Number.parseInt(req.body.optionIndex, 10);
    if (!Number.isInteger(id) || !Number.isInteger(optionIndex)) {
      return res.status(400).json({ error: 'Invalid vote payload' });
    }

    const poll = await Poll.findOne({ id }).lean();
    if (!poll || !poll.options?.[optionIndex]) return res.status(404).json({ error: 'Not found' });

    const voterHash = hashClientFingerprint(req, `poll:${id}`);
    const windowKey = getWindowKey(pollVoteWindowMs);
    const expiresAt = new Date(Date.now() + pollVoteWindowMs + (15 * 60 * 1000));

    try {
      await PollVote.create({
        pollId: id,
        voterHash,
        windowKey,
        optionIndex,
        expiresAt,
      });
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        return res.status(429).json({ error: 'You already voted in this poll from this network' });
      }
      throw error;
    }

    const optionPath = `options.${optionIndex}.votes`;
    const updated = await Poll.findOneAndUpdate(
      { id, [`options.${optionIndex}`]: { $exists: true } },
      { $inc: { [optionPath]: 1 } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Not found' });
    delete updated._id;
    delete updated.__v;
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: publicError(e) });
  }
});

// ─── Audit / Backup / Reset ───
function cleanExportItem(item) {
  const next = stripDocumentMetadata(item);
  if (next && typeof next === 'object') {
    delete next.password;
  }
  return next;
}

const { streamBackupExport } = createBackupExportService({
  Ad,
  Article,
  ArticleRevision,
  Author,
  Breaking,
  Category,
  Comment,
  CommentReaction,
  Court,
  DEFAULT_HERO_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  Event,
  Gallery,
  GameDefinition,
  GamePuzzle,
  HeroSettings,
  Job,
  Permission,
  Poll,
  SettingsRevision,
  SiteSettings,
  User,
  Wanted,
  cleanExportItem,
  streamJsonArray,
  writeJsonChunk,
});

registerOpsRoutes(app, {
  AuditLog,
  normalizeText,
  parsePositiveInt,
  publicError,
  requireAdmin,
  requireAuth,
  requirePermission,
  streamBackupExport,
});

const {
  getRecentUploadPayload,
  makeUploadFingerprint,
  recentUploadResults,
  rememberRecentUploadPayload,
  uploadRequestInFlight,
} = createUploadDedupService();

registerUploadRoutes(app, {
  brandLogoPath: path.join(__dirname, 'fonts', 'brand-logo.png'),
  ensureImagePipeline,
  getOriginalUploadUrl,
  getRecentUploadPayload,
  imageMimeToExt,
  loadSharp,
  makeUploadFingerprint,
  normalizeText,
  parseBooleanFlag,
  putStorageObject,
  rememberRecentUploadPayload,
  requireAnyPermission,
  requireAuth,
  toImageMetaFromManifest,
  upload,
  uploadRequestInFlight,
});

registerTipRoutes(app, {
  Tip,
  ensureImagePipeline,
  getOriginalUploadUrl,
  getTrustedClientIp,
  imageMimeToExt,
  loadSharp,
  nextNumericId,
  normalizeText,
  publicError,
  putStorageObject,
  rateLimit,
  rateLimitKeyGenerator,
  requireAnyPermission,
  requireAuth,
  shouldSkipRateLimit,
  toImageMetaFromManifest,
  upload,
});

registerPushRoutes(app, {
  PushSubscription,
  publicError,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
});

registerMediaRoutes(app, {
  Ad,
  Article,
  Event,
  Gallery,
  backfillImagePipeline,
  deleteStorageObject,
  deleteStoragePrefix,
  getImagePipelineStatus,
  getOriginalUploadUrl,
  getVariantsRelativeDir,
  isOriginalUploadFileName,
  isProd,
  isStorageNotFoundError,
  listMediaFiles,
  publicError,
  readOriginalUploadBuffer,
  requireAnyPermission,
  requireAuth,
  storageObjectExists,
});

function isBotUserAgent(req) {
  const ua = String(req?.headers?.['user-agent'] || '').toLowerCase();
  if (!ua) return false;
  return /(discordbot|discordapp|twitterbot|slackbot|telegrambot|whatsapp|facebookexternalhit|linkedinbot|embedly|quora link preview|pinterest|googlebot|bingbot|yandex|duckduckbot)/i.test(ua);
}

// OG tags per article (Discord/Twitter/Slack etc).
// The SPA can't set dynamic OG tags reliably, so for bot user-agents we serve a small HTML shell
// with per-article meta and let real browsers fall back to the SPA entrypoint.
app.get('/article/:id(\\d+)', async (req, res, next) => {
  try {
    if (!isBotUserAgent(req)) return next();

    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).send('Invalid article id');

    const article = await Article.findOne({ id, ...getPublishedFilter() }).lean();
    if (!article) return res.status(404).send('Article not found');

    const baseUrl = getPublicBaseUrl(req);
    const articleUrl = `${baseUrl}/article/${id}`;
    const shareImageUrl = `${baseUrl}/api/articles/${id}/share.png`;
    const title = clampText(article.shareTitle || article.title || 'zNews.live', 140);
    const description = clampText(
      article.shareSubtitle || stripHtmlToText(article.excerpt || article.content || ''),
      220
    ) || 'Горещи новини от Los Santos.';

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeArticleUrl = escapeHtml(articleUrl);
    const safeImageUrl = escapeHtml(shareImageUrl);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(`<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeArticleUrl}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="zNews.live" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeArticleUrl}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${shareCardWidth}" />
    <meta property="og:image:height" content="${shareCardHeight}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImageUrl}" />
  </head>
  <body></body>
</html>`);
  } catch (e) {
    return next();
  }
});

app.get('/share/article/:id(\\d+)', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).send('Invalid article id');

    const article = await Article.findOne({ id, ...getPublishedFilter() }).lean();
    if (!article) {
      return res.status(404).send('Article not found');
    }

    const baseUrl = getPublicBaseUrl(req);
    const articleUrl = `${baseUrl}/article/${id}`;
    const shareUrl = `${baseUrl}/share/article/${id}`;
    const shareImageUrl = `${baseUrl}/api/articles/${id}/share.png`;
    const title = clampText(article.shareTitle || article.title || 'zNews.live', 140);
    const description = clampText(
      article.shareSubtitle || stripHtmlToText(article.excerpt || article.content || ''),
      220
    ) || 'Горещи новини от Los Santos.';

    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    const safeArticleUrl = escapeHtml(articleUrl);
    const safeShareUrl = escapeHtml(shareUrl);
    const safeImageUrl = escapeHtml(shareImageUrl);
    const safeRedirectUrl = escapeHtml(`/article/${id}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(`<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="zNews.live" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeShareUrl}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${shareCardWidth}" />
    <meta property="og:image:height" content="${shareCardHeight}" />
    <link rel="canonical" href="${safeArticleUrl}" />
    <meta http-equiv="refresh" content="0;url=${safeRedirectUrl}" />
  </head>
  <body>
    <p style="font-family: Arial, sans-serif; padding: 16px;">Пренасочване към статията...</p>
    <script>window.location.replace(${JSON.stringify(`/article/${id}`)});</script>
  </body>
</html>`);
  } catch (e) {
    return res.status(500).send('Share page error');
  }
});

// ─── Serve frontend in production ───
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath, {
  // Never let express.static serve index.html with long cache headers.
  // The SPA entrypoint should be revalidated, while fingerprinted assets can be cached for 1y.
  index: false,
  maxAge: isProd ? '1y' : 0,
  etag: true,
  immutable: isProd,
}));

app.get('*', (_req, res) => {
  // Don't cache HTML; assets are fingerprinted and cached via express.static.
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start ───
const PORT = Number(process.env.PORT) || 3001;

function registerGracefulShutdown(server) {
  const sockets = new Set();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  const shutdown = async (reason, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    try {
      console.log(`\n⚠ Graceful shutdown: ${reason}`);

      // Stop accepting new connections.
      const closePromise = new Promise((resolve) => server.close(resolve));

      // Encourage keep-alive clients to disconnect.
      sockets.forEach((socket) => {
        try { socket.end(); } catch { }
      });

      const FORCE_SHUTDOWN_MS = 12_000;
      const forceTimer = setTimeout(() => {
        console.warn(`✗ Forcing shutdown after ${FORCE_SHUTDOWN_MS}ms`);
        sockets.forEach((socket) => {
          try { socket.destroy(); } catch { }
        });
      }, FORCE_SHUTDOWN_MS);
      forceTimer.unref();

      // Wait for the server to close (or until we hit the force timer).
      await Promise.race([
        closePromise,
        new Promise((resolve) => setTimeout(resolve, FORCE_SHUTDOWN_MS)),
      ]);

      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections();
      }
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }

      stopBackgroundJobs();

      try {
        await mongoose.connection.close(false);
      } catch (error) {
        console.error('✗ Failed to close MongoDB connection:', error?.message || error);
      }

      clearTimeout(forceTimer);
    } finally {
      process.exit(exitCode);
    }
  };

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.once(signal, () => shutdown(signal, 0));
  });

  process.once('uncaughtException', (error) => {
    console.error('✗ Uncaught exception:', error);
    shutdown('uncaughtException', 1);
  });

  process.once('unhandledRejection', (reason) => {
    console.error('✗ Unhandled rejection:', reason);
    shutdown('unhandledRejection', 1);
  });
}

export async function startServer() {
  try {
    await connectDB();
    await ensureDbIndexes();
    await ensureDefaultPermissionDocs();
    await migrateBreakingCategoryLabels();
    await ensureGameDefinitions();
    mongoose.connection.on('error', (error) => {
      reportServerError('mongoose-connection', error).catch(() => {});
    });
  } catch (err) {
    console.error('✗ MongoDB error:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    startBackgroundJobs();
    console.log(`✓ Los Santos News API running on port ${PORT}`);
    if (!isProd) console.log('⚠ Running in development mode');

    if (process.env.IMAGE_PIPELINE_BACKFILL_ON_BOOT === 'true') {
      const parsedLimit = Number.parseInt(process.env.IMAGE_PIPELINE_BACKFILL_LIMIT || '', 10);
      const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0;
      backfillImagePipeline({ force: false, limit })
        .then((summary) => {
          console.log(`✓ Image pipeline backfill finished (${summary.generated} generated, ${summary.skipped} skipped, ${summary.failed} failed, synced=${summary.syncedArticleMeta}/${summary.syncedTipMeta}, engine=${summary.engine})`);
        })
        .catch((error) => {
          console.error('✗ Image pipeline backfill failed on boot:', error?.message || error);
        });
    }
  });

  registerGracefulShutdown(server);

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`✗ Port ${PORT} is already in use`);
      console.error('Stop the running process on that port, then start the server again.');
      console.error('PowerShell: netstat -ano | findstr :3001');
      console.error('PowerShell: Stop-Process -Id <PID_FROM_NETSTAT> -Force');
      process.exit(1);
    }

    console.error('✗ Server failed to start:', error);
    process.exit(1);
  });
}
