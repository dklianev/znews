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
import { getClientUserAgent, getTrustedClientIp, hashTrustedBrowserClientFingerprint, hashTrustedClientFingerprint } from './requestIdentity.js';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { randomUUID, createHash } from 'crypto';

import {
  Article, Author, Category, Ad, AdEvent, Breaking, User,
  Wanted, Job, Court, Event, Poll, Comment, CommentReaction, ContactMessage, Gallery, Permission, HeroSettings, SiteSettings, ArticleRevision, SettingsRevision, ArticleView, ArticleReaction, PollVote, AuthSession, AuditLog, Tip, Classified, PushSubscription, GameDefinition, GamePuzzle, Counter, SystemEvent, BackgroundJobState, AdAnalyticsAggregate, SearchQueryStat
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
import { registerClassifiedRoutes } from './routes/classifiedRoutes.js';
import { registerPushRoutes } from './routes/pushRoutes.js';
import { registerOpsRoutes } from './routes/opsRoutes.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerPermissionRoutes } from './routes/permissionRoutes.js';
import { registerSettingsRoutes } from './routes/settingsRoutes.js';
import { createArticlesPublicRouter } from './routes/articlesPublicRoutes.js';
import { registerArticlesAdminRoutes } from './routes/articlesAdminRoutes.js';
import { registerWebArticleRoutes } from './routes/webArticleRoutes.js';
import { registerWebSpaRoutes } from './routes/webSpaRoutes.js';
import { createCommentsRouter } from './routes/commentsRoutes.js';
import { createCategoriesRouter } from './routes/categoriesRoutes.js';
import { createUsersRouter } from './routes/usersRoutes.js';
import { createAdsRouter } from './routes/adsRoutes.js';
import { registerPublicFeedRoutes } from './routes/publicFeedRoutes.js';
import { registerPollVoteRoutes } from './routes/pollVoteRoutes.js';
import { createNumericCrudFactory } from './routes/factories/numericCrudFactory.js';
import { createPublicGamesRouter } from './routes/publicGamesRoutes.js';
import { createAdminGamesRouter } from './routes/adminGamesRoutes.js';
import { createContactMessagesRouter } from './routes/contactMessagesRoutes.js';
import { createDiagnosticsService } from './services/diagnosticsService.js';
import { createBackgroundJobsService } from './services/backgroundJobsService.js';
import { createMonitoringService } from './services/monitoringService.js';
import { createAuthzService } from './services/authzService.js';
import { createCacheService } from './services/cacheService.js';
import { createHealthService } from './services/healthService.js';
import { createAdHelpers } from './services/adHelpersService.js';
import { createGameSharedHelpers } from './services/gameSharedHelpersService.js';
import { createContentMaintenanceService } from './services/contentMaintenanceService.js';
import { createAdAnalyticsRollupService } from './services/adAnalyticsRollupService.js';
import { createUploadDedupService } from './services/uploadDedupService.js';
import { createBackupExportService } from './services/backupExportService.js';
import { createStoragePathService } from './services/storagePathService.js';
import { createRemoteStorageService } from './services/remoteStorageService.js';
import { createStorageObjectService } from './services/storageObjectService.js';
import { createMediaStorageHelpers } from './services/mediaStorageHelpersService.js';
import { createImagePipelineService } from './services/imagePipelineService.js';
import { createArticleHelpers } from './services/articleHelpersService.js';
import { createGamePuzzleHelpers } from './services/gamePuzzleHelpersService.js';
import { createSettingsHelpers } from './services/settingsHelpersService.js';
import { createArticlePushHelpers } from './services/articlePushHelpersService.js';
import { createDocumentHelpers } from './services/documentHelpersService.js';
import { createGamesCatalogService } from './services/gamesCatalogService.js';
import { createAccessHelpers } from './services/accessHelpersService.js';
import { createAuthTokenHelpers } from './services/authTokenHelpersService.js';
import { createAuthSessionHelpers } from './services/authSessionHelpersService.js';
import { createCommentsHelpers } from './services/commentsHelpersService.js';
import { createRateLimitHelpers } from './services/rateLimitHelpersService.js';
import { createDbBootstrapService } from './services/dbBootstrapService.js';
import { createArticleCollectionHelpers } from './services/articleCollectionHelpersService.js';
import { createArticleRecencyHelpers } from './services/articleRecencyHelpersService.js';
import { createSearchCollectionHelpers } from './services/searchCollectionHelpersService.js';
import { createCoreHelpers } from './services/coreHelpersService.js';
import { createContentSharedHelpers } from './services/contentSharedHelpersService.js';
import { createSettingsPayloadHelpers } from './services/settingsPayloadHelpersService.js';
import { createContentSanitizers } from './services/contentSanitizersService.js';
import { createShareCardHelpers } from './services/shareCardHelpersService.js';
import { createShareCardObjectHelpers } from './services/shareCardObjectService.js';
import { createShareCardRuntimeHelpers } from './services/shareCardRuntimeService.js';
import { createServerLifecycleService } from './services/serverLifecycleService.js';
import { createApiErrorHandler } from './services/expressAsyncService.js';
import { createRequestHelpers } from './services/requestHelpersService.js';
import { createFramePolicyHelpers } from './services/framePolicyService.js';
import { createRuntimeBootstrapHelpers } from './services/runtimeBootstrapHelpersService.js';
import { createRequestMetricsService } from './services/requestMetricsService.js';

const {
  applyMongoDnsServers,
  configureWebPush,
  loadBrandLogoPng,
  loadBundledFontFile,
} = createRuntimeBootstrapHelpers({
  dns,
  fs,
  path,
  webpush,
  logInfo: (message) => console.log(message),
  logWarning: (message) => console.warn(message),
});

applyMongoDnsServers({
  nodeEnv: process.env.NODE_ENV,
  mongoDnsServersEnv: process.env.MONGODB_DNS_SERVERS,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '.env'), override: true, quiet: true });

// Web Push Configuration
configureWebPush({
  contactEmail: 'mailto:admin@znews.live',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
});

// Bundled font for Sharp share card rendering
// On Azure/Linux servers there are no Cyrillic system fonts.
// We use sharp's text() API with fontfile to bypass fontconfig entirely.
const bundledFontFile = loadBundledFontFile(__dirname);

// Pre-rendered brand logo with outline/stroke (generated by scripts/gen-brand-logo.mjs)
const brandLogoPng = loadBrandLogoPng(__dirname);

const app = express();
app.disable('x-powered-by');
const isProd = process.env.NODE_ENV === 'production';
const rawJwtSecret = process.env.JWT_SECRET;
const rawRefreshSecret = process.env.REFRESH_TOKEN_SECRET || rawJwtSecret;
let shuttingDown = false;

const {
  escapeRegexForSearch,
  getPublishedFilter,
  parseDurationToMs,
  parsePositiveInt,
  publicError,
} = createCoreHelpers({ isProd });

const apiErrorHandler = createApiErrorHandler({ publicError });

// ─── API Performance Caching ───
const apiCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const apiCacheMeta = new Map();
const apiCacheInvalidationLog = [];
const API_CACHE_INVALIDATION_LOG_LIMIT = 30;
const API_CACHE_TAG_PATTERNS = Object.freeze({
  articles: ['/api/articles', '/api/search'],
  'article-detail': ['/api/articles/'],
  'article-list': ['/api/articles'],
  'author-stats': ['/api/articles/author-stats/', '/api/authors/'],
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
  classifieds: ['/api/classifieds'],
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

const {
  getRequestMetricsSnapshot,
  requestMetricsMiddleware,
} = createRequestMetricsService();

const { buildHealthPayload, getMongoHealthState } = createHealthService({
  getApiCacheStats,
  getShuttingDown: () => shuttingDown,
  mongoose,
});

registerHealthRoutes(app, { buildHealthPayload });

app.use(requestMetricsMiddleware);

app.use((req, res, next) => {
  if (!shuttingDown) return next();
  // Allow load balancers/clients to drop keep-alive connections during deploy/restart.
  res.set('Connection', 'close');
  return res.status(503).json({ error: 'Server is restarting. Please try again shortly.' });
});

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

const accessTokenMaxAgeMs = parseDurationToMs(ACCESS_TOKEN_EXPIRES_IN, 15 * 60 * 1000);
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
    { to: '/category/breaking', label: 'Горещо', icon: 'Flame', hot: true, tilt: '-2deg' },
    { to: '/category/underground', label: 'Скандали', icon: 'Megaphone', hot: true, tilt: '1.5deg' },
    { to: '/category/society', label: 'Слухове', icon: 'Bell', hot: false, tilt: '-1deg' },
    { to: '/games', label: 'Игри', icon: 'Gamepad2', hot: false, tilt: '1.8deg' },
  ],
  footerPills: [
    { label: 'Горещо', to: '/category/crime', hot: true, tilt: '-1.5deg' },
    { label: 'Скандали', to: '/category/underground', hot: true, tilt: '1deg' },
    { label: 'Слухове', to: '/category/society', hot: false, tilt: '-0.8deg' },
    { label: 'Криминални', to: '/category/crime', hot: false, tilt: '0.8deg' },
    { label: 'Бизнес', to: '/category/business', hot: false, tilt: '-1deg' },
  ],
  footerQuickLinks: [
    { label: 'Последни новини', to: '/latest' },
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
  classifieds: {
    tiers: {
      standard:    { price: 2000, durationDays: 7, maxImages: 1 },
      highlighted: { price: 5000, durationDays: 10, maxImages: 3 },
      vip:         { price: 7000, durationDays: 14, maxImages: 5 },
    },
    bumpPrice: 1000,
    renewalDiscount: 0.5,
    iban: '59965607',
    beneficiary: 'zNews',
    currency: '$',
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
const pollVoteWindowMs = Math.max(
  5 * 60 * 1000,
  Number.parseInt(process.env.POLL_VOTE_WINDOW_MS || '', 10) || (24 * 60 * 60 * 1000)
);
const articleViewWindowMs = Math.max(
  60 * 1000,
  Number.parseInt(process.env.ARTICLE_VIEW_WINDOW_MS || '', 10) || (6 * 60 * 60 * 1000)
);
const articleReactionWindowMs = Math.max(
  60 * 1000,
  Number.parseInt(process.env.ARTICLE_REACTION_WINDOW_MS || '', 10) || (24 * 60 * 60 * 1000)
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
const {
  getFrameAncestorsDirectiveValue,
  isProtectedFramePath,
} = createFramePolicyHelpers();

app.use((req, res, next) => {
  if (isProtectedFramePath(req.path || req.originalUrl || '/')) {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  next();
});

app.use(compression({ threshold: 1024, level: 6 }));
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  xFrameOptions: false,
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
      frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://youtube.com', 'https://player.vimeo.com', 'https://www.facebook.com'],
      objectSrc: ["'none'"],
      frameAncestors: [(req) => getFrameAncestorsDirectiveValue(req)],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));

app.use(cors({
  origin(origin, cb) {
    // Non-browser clients don't send Origin.
    if (!origin) return cb(null, true);
    if (!isProd) {
      // Allow known dev origins only (Vite defaults).
      const devOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:5173'];
      return cb(null, devOrigins.includes(origin));
    }
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
}));

const rateLimitEnabledInDev = process.env.ENABLE_RATE_LIMIT_IN_DEV === 'true';
const {
  getClientIpForRateLimit,
  isAdminApiPath,
  isAuthApiPath,
  isMediaApiPath,
  isReadOnlyMethod,
  parseRateLimitPositiveInt,
  rateLimitKeyGenerator,
  shouldSkipRateLimit,
} = createRateLimitHelpers({
  createHash,
  getTrustedClientIp,
  ipKeyGenerator,
  isIP,
  isProd,
  rateLimitEnabledInDev,
});
const apiRateLimitWindowMs = parseDurationToMs(process.env.RATE_LIMIT_WINDOW, 15 * 60 * 1000);
const apiReadRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_READ_MAX, 1200, 100);
const apiWriteRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_WRITE_MAX, 300, 30);
const apiAuthRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_AUTH_MAX, 180, 30);
const apiAdminReadRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_ADMIN_READ_MAX, 1000, 100);
const apiAdminWriteRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_ADMIN_WRITE_MAX, 300, 30);
const apiMediaReadRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_MEDIA_READ_MAX, 1800, 100);
const apiMediaWriteRateLimitMax = parseRateLimitPositiveInt(process.env.RATE_LIMIT_MEDIA_WRITE_MAX, 120, 10);
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

const articleReactionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: { error: 'Too many article reactions from this IP. Please try again later.' },
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

const adTrackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many ad tracking requests from this IP. Please try again later.' },
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
const rawUploadMaxFileSizeMb = Number.parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '', 10);
const uploadMaxFileSizeMb = Number.isInteger(rawUploadMaxFileSizeMb)
  && rawUploadMaxFileSizeMb >= 1
  && rawUploadMaxFileSizeMb <= 25
  ? rawUploadMaxFileSizeMb
  : 10;
const uploadMaxFileSizeBytes = uploadMaxFileSizeMb * 1024 * 1024;

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
  limits: { fileSize: uploadMaxFileSizeBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (allowedImageMimeTypes.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, GIF, and WebP files are allowed'));
  },
});

// Multi-file upload instance for classifieds (up to 5 images)
const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadMaxFileSizeBytes, files: 5 },
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
  app.get('/uploads/{*splat}', (req, res) => {
    const rawSuffix = toPosixRelativePath(req.path.slice('/uploads/'.length));
    if (!rawSuffix || rawSuffix.includes('..')) return res.status(404).send('Not found');
    return res.redirect(302, toUploadsUrlFromRelative(rawSuffix));
  });
}

const {
  getManifestAbsolutePath,
  getManifestRelativePath,
  getShareRelativePath,
  getVariantsAbsoluteDir,
  getVariantsRelativeDir,
  isOriginalUploadFileName,
  isStorageNotFoundError,
  loadSharp,
  readSdkBodyToBuffer,
  renderTextImage,
} = createMediaStorageHelpers({
  bundledFontFile,
  fs,
  getDiskAbsolutePath,
  imageMimeToExt,
  path,
});

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

const {
  getClientIp,
  getWindowKey,
  hasOwn,
  hashBrowserClientFingerprint,
  hashClientFingerprint,
  isMongoDuplicateKeyError,
} = createRequestHelpers({
  getTrustedClientIp,
  hashTrustedBrowserClientFingerprint,
  hashTrustedClientFingerprint,
});

const {
  normalizeText,
  sanitizeDate,
  sanitizeDateTime,
  sanitizeExternalUrl,
  sanitizeImageAlign,
  sanitizeImageWidth,
  sanitizeMediaUrl,
  sanitizeSafeHtml,
  sanitizeTags,
} = createContentSanitizers();

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

const {
  buildArticleProjection,
  combineMongoFilters,
  getArticleSectionFilter,
  parseCollectionPagination,
} = createArticleCollectionHelpers({
  ARTICLE_FIELD_ALLOWLIST,
  ARTICLE_SECTION_FILTERS,
  hasOwn,
  normalizeText,
  parsePositiveInt,
});

const {
  cleanExportItem,
  stripDocumentList,
  stripDocumentMetadata,
} = createDocumentHelpers();

const HOMEPAGE_SECTION_BUFFER = 10;
const HOMEPAGE_LATEST_BUFFER = 24;

const {
  buildArticleRecencyPipeline,
  countLegacyPublicArticles,
  fetchHomepageArticleCandidates,
  findArticlesByRecency,
  findLegacyPublicArticles,
} = createArticleRecencyHelpers({
  Article,
  HOMEPAGE_LATEST_BUFFER,
  HOMEPAGE_SECTION_BUFFER,
  combineMongoFilters,
  normalizeText,
  sortArticlesByRecency,
  stripDocumentList,
});

export { buildArticleRecencyPipeline };

const {
  isTextSearchUnavailableError,
  searchCollectionByTextAndRegex,
} = createSearchCollectionHelpers({
  stripDocumentList,
});

const {
  sanitizeShareAccent,
  snapshotsEqual,
} = createContentSharedHelpers({
  normalizeText,
});

const {
  clampText,
  buildShareCardModel,
  buildShareCardOverlaySvg,
  escapeHtml,
  getShareSourceUrl,
  resolveSharePalette,
  stripHtmlToText,
  wrapTextLines,
} = createShareCardHelpers({
  normalizeText,
  sanitizeMediaUrl,
  sanitizeShareAccent,
  shareCardHeight,
  shareCardWidth,
});

const {
  buildArticleSnapshot,
  createArticleRevision,
  enrichArticlePayloadWithImageMeta,
  sanitizeArticlePayload,
} = createArticleHelpers({
  ArticleRevision,
  hasOwn,
  normalizeText,
  randomUUID,
  resolveImageMetaFromUrl,
  sanitizeDate,
  sanitizeDateTime,
  sanitizeMediaUrl,
  sanitizeSafeHtml,
  sanitizeShareAccent,
  sanitizeTags,
});

const {
  buildShareCardStorageTarget,
  cleanupOldShareCards,
  hasShareCardObject,
  persistShareCardObject,
  resolveShareBackgroundInput,
  resolveShareFallbackSource,
} = createShareCardObjectHelpers({
  buildArticleSnapshot,
  deleteRemoteKeys,
  fs,
  getDiskAbsolutePath,
  getOriginalUploadUrl,
  getShareRelativePath,
  getShareSourceUrl,
  getUploadFilenameFromUrl,
  isRemoteStorage,
  listRemoteObjectsByPrefix,
  normalizeText,
  path,
  putStorageObject,
  readOriginalUploadBuffer,
  storageObjectExists,
  storageUploadsPrefix,
  toUploadsStorageKey,
  toUploadsUrlFromRelative,
  uploadsDir,
});

const {
  ensureArticleShareCard,
  getPublicBaseUrl,
} = createShareCardRuntimeHelpers({
  brandLogoPng,
  buildShareCardModel,
  buildShareCardOverlaySvg,
  buildShareCardStorageTarget,
  cleanupOldShareCards,
  hasShareCardObject,
  loadSharp,
  normalizeText,
  persistShareCardObject,
  renderTextImage,
  resolveShareBackgroundInput,
  resolveShareFallbackSource,
  resolveSharePalette,
  shareCardHeight,
  shareCardWidth,
});

const {
  sanitizeHeroSettingsPayload,
  sanitizeSiteSettingsPayload,
} = createSettingsPayloadHelpers({
  BREAKING_CATEGORY_LABEL,
  DEFAULT_HERO_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  normalizeText,
});

const {
  createSettingsRevision,
  formatSettingsRevisionList,
  serializeHeroSettings,
  serializeSiteSettings,
} = createSettingsHelpers({
  DEFAULT_HERO_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  SettingsRevision,
  normalizeText,
  randomUUID,
  sanitizeSiteSettingsPayload,
  snapshotsEqual,
});

const {
  clearCookieHeader,
  clearRefreshCookie,
  decodeRefreshToken,
  decodeTokenFromRequest,
  parseCookies,
  serializeCookie,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
} = createAuthTokenHelpers({
  ACCESS_TOKEN_EXPIRES_IN,
  JWT_SECRET,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_TTL_DAYS,
  isProd,
  jwt,
  refreshTokenMaxAgeMs,
});

const {
  createRefreshSession,
  rotateTokensForUser,
} = createAuthSessionHelpers({
  AuthSession,
  createHash,
  getClientIp,
  getClientUserAgent,
  randomUUID,
  refreshTokenMaxAgeMs,
  signAccessToken,
  signRefreshToken,
});



const {
  collectCommentThreadIds,
  commentContainsBlockedTerms,
  normalizeCommentReaction,
  syncCommentReactionTotals,
} = createCommentsHelpers({
  blockedCommentTerms,
  Comment,
  CommentReaction,
  normalizeText,
});

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
  'classifieds',
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

const {
  hasPermissionForSection,
  isKnownRole,
  nextNumericId,
} = createAccessHelpers({
  Counter,
  Permission,
  allocateNumericId,
  hasBuiltInRole: (role) => Object.prototype.hasOwnProperty.call(DEFAULT_PERMISSION_DOCS, role),
  normalizeText,
});

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
  getRequestMetricsSnapshot,
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
registerBackgroundJob({
  name: 'classifieds-auto-expire',
  intervalMs: 10 * 60 * 1000, // every 10 minutes
  initialDelayMs: 8000,
  run: async () => {
    const now = new Date();
    const result = await Classified.updateMany(
      { status: 'active', expiresAt: { $lte: now } },
      { $set: { status: 'expired' } },
    );
    const expired = result.modifiedCount || 0;
    if (expired > 0) invalidateCacheTags(['classifieds']);
    return { message: `Expired ${expired} classifieds`, metrics: { expired } };
  },
});
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
const numericCrud = createNumericCrudFactory({
  AuditLog,
  cacheMiddleware,
  invalidateCacheTags,
  nextNumericId,
  parseCollectionPagination,
  publicError,
  requireAdmin,
  requireAuth,
  requirePermission,
});

const articlesRouter = createArticlesPublicRouter({
  Article,
  ArticleReaction,
  ArticleView,
  Category,
  articleReactionLimiter,
  articleReactionWindowMs,
  articleViewWindowMs,
  buildArticleProjection,
  cacheMiddleware,
  decodeTokenFromRequest,
  ensureArticleShareCard,
  getArticleSectionFilter,
  getPublishedFilter,
  getWindowKey,
  hasOwn,
  hasPermissionForSection,
  hashBrowserClientFingerprint,
  hashClientFingerprint,
  invalidateCacheTags,
  isMongoDuplicateKeyError,
  isProd,
  normalizeText,
  parseCookies,
  parsePositiveInt,
  randomUUID,
  publicError,
  resolveShareFallbackSource,
  serializeCookie,
  transparentPng1x1,
});

const {
  isImmediateBreakingArticle,
  sendPushNotificationForArticle,
} = createArticlePushHelpers({
  PushSubscription,
  webpush,
});

const {
  connectDB,
  ensureDbIndexes,
  ensureDefaultPermissionDocs,
  migrateBreakingCategoryLabels,
  sanitizePermissionMap,
} = createDbBootstrapService({
  ArticleReaction,
  BREAKING_CATEGORY_LABEL,
  Category,
  DEFAULT_PERMISSION_DOCS,
  Permission,
  PERMISSION_KEYS,
  SiteSettings,
  devMongoFallbackUri: process.env.DEV_MONGODB_FALLBACK_URI || 'mongodb://127.0.0.1:27017/zemun-news',
  isProd,
  modelsWithIndexes: [
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
    ArticleReaction,
    PollVote,
    AuthSession,
    AuditLog,
    Tip,
    PushSubscription,
    GameDefinition,
    GamePuzzle,
    Counter,
    SearchQueryStat,
  ],
  mongoUri: process.env.MONGODB_URI,
  mongoose,
  normalizeText,
});

registerArticlesAdminRoutes(articlesRouter, {
  Article,
  ArticleRevision,
  AuditLog,
  buildArticleRecencyPipeline,
  buildArticleSnapshot,
  createArticleRevision,
  enrichArticlePayloadWithImageMeta,
  invalidateCacheGroup,
  isImmediateBreakingArticle,
  nextNumericId,
  normalizeText,
  parsePositiveInt,
  publicError,
  requireAuth,
  requirePermission,
  sanitizeArticlePayload,
  sendPushNotificationForArticle,
});

app.use('/api/articles', articlesRouter);

// ─── Users ───
const usersRouter = createUsersRouter({
  AuditLog,
  AuthSession,
  bcrypt,
  hasOwn,
  isKnownRole,
  nextNumericId,
  normalizeText,
  publicError,
  requireAdmin,
  requireAuth,
  requirePermission,
  sanitizeDate,
  User,
});

app.use('/api/users', usersRouter);

const {
  buildAdAnalyticsSummary,
  buildAdCandidate,
  listAdsForRequest,
  listPublicAds,
  recordAdAnalyticsEvent,
  resolveTrackedAdCandidate,
  sanitizeAdAnalyticsContext,
  sanitizeAdPayload,
  validateAdCandidate,
} = createAdHelpers({
  Ad,
  AdEvent,
  AD_EVENT_TYPES,
  AD_PAGE_TYPES,
  AD_STATUS_OPTIONS,
  AD_TYPES,
  DEFAULT_AD_ANALYTICS_DAYS,
  adAnalyticsRetentionMs,
  adImpressionWindowMs,
  decodeTokenFromRequest,
  filterPublicAds,
  getAdRotationPool,
  getAdSlot,
  getDefaultPlacementsForType,
  getWindowKey,
  hasOwn,
  hasPermissionForSection,
  hashClientFingerprint,
  isKnownAdSlot,
  isMongoDuplicateKeyError,
  normalizeAdFitMode,
  normalizeAdImageMeta,
  normalizeAdRecord,
  normalizeText,
  stripDocumentMetadata,
});

const {
  listPublicGames,
} = createGamesCatalogService({
  GameDefinition,
  stripDocumentMetadata,
});

const adsRouter = createAdsRouter({
  Ad,
  AuditLog,
  adTrackingLimiter,
  buildAdAnalyticsSummary,
  buildAdCandidate,
  cacheMiddleware,
  invalidateCacheGroup,
  listAdsForRequest,
  nextNumericId,
  normalizeAdRecord,
  publicError,
  recordAdAnalyticsEvent,
  requireAuth,
  requirePermission,
  resolveTrackedAdCandidate,
  sanitizeAdAnalyticsContext,
  sanitizeAdPayload,
  stripDocumentMetadata,
  validateAdCandidate,
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
  AuditLog,
  Article,
  ContactMessage,
  contactMessageLimiter,
  getPublishedFilter,
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
const SUPPORTED_GAME_SLUGS = new Set(['word', 'connections', 'quiz', 'sudoku', 'hangman', 'spellingbee', 'crossword', 'tetris', 'snake', '2048', 'flappybird', 'blockbust']);
const SUPPORTED_GAME_TYPES = new Set(['word', 'connections', 'quiz', 'sudoku', 'hangman', 'spellingbee', 'crossword', 'tetris', 'snake', '2048', 'flappybird', 'blockbust']);
const SUPPORTED_PUZZLE_STATUSES = new Set(['draft', 'published', 'archived']);
const SUPPORTED_PUZZLE_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const TEMPORARILY_UNAVAILABLE_GAME_ERROR = 'Тази игра временно не е активна.';

const {
  badRequest,
  findActivePublishedGamePuzzle,
  getPuzzleActiveUntilDate,
  getTodayGameDate,
  isPlainObject,
  parseBooleanFlag,
  resolveGameAccess,
  sanitizeGameDefinitionInput,
  sanitizeStringArray,
  statusAwarePublicError,
  stripPuzzleForPublic,
  toSafeInteger,
} = createGameSharedHelpers({
  GameDefinition,
  GamePuzzle,
  JWT_SECRET,
  SUPPORTED_GAME_SLUGS,
  SUPPORTED_GAME_TYPES,
  User,
  hasOwn,
  hasPermissionForSection,
  jwt,
  normalizeText,
  publicError,
});

const {
  SINGLE_CHAR_PATTERN,
  isPlaceholderGamePuzzle,
  normalizeCrosswordSubmissionGrid,
  sanitizeGamePuzzleInput,
  validateCrosswordPuzzle,
} = createGamePuzzleHelpers({
  MIN_CROSSWORD_PUBLISH_ENTRY_LENGTH,
  SPELLING_BEE_MIN_WORD_LENGTH,
  SUPPORTED_PUZZLE_DIFFICULTIES,
  SUPPORTED_PUZZLE_STATUSES,
  analyzeCrosswordConstruction,
  analyzeSpellingBeeWords,
  badRequest,
  getCrosswordEntries,
  getPuzzleActiveUntilDate,
  hasCompleteSpellingBeeHive,
  hasOwn,
  isPlainObject,
  normalizeSpellingBeeLetter,
  normalizeSpellingBeeOuterLetters,
  normalizeText,
  sanitizeDateTime,
  sanitizeStringArray,
  toSafeInteger,
});

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
registerPublicFeedRoutes(app, {
  Article,
  Author,
  Breaking,
  Category,
  Court,
  DEFAULT_HERO_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  Event,
  Gallery,
  HeroSettings,
  HOMEPAGE_DEFAULT_ARTICLE_PROJECTION,
  HOMEPAGE_LATEST_BUFFER,
  Job,
  Poll,
  SiteSettings,
  Wanted,
  buildArticleProjection,
  cacheMiddleware,
  countLegacyPublicArticles,
  decodeTokenFromRequest,
  fetchHomepageArticleCandidates,
  findArticlesByRecency,
  findLegacyPublicArticles,
  getPublishedFilter,
  hasPermissionForSection,
  listPublicAds,
  listPublicGames,
  parseCollectionPagination,
  parsePositiveInt,
  publicError,
  serializeHeroSettings,
  serializeSiteSettings,
  stripDocumentList,
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
registerPollVoteRoutes(app, {
  Poll,
  PollVote,
  getWindowKey,
  hashClientFingerprint,
  isMongoDuplicateKeyError,
  pollVoteLimiter,
  pollVoteWindowMs,
  publicError,
});

// ─── Audit / Backup / Reset ───
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
  uploadMaxFileSizeMb,
  uploadRequestInFlight,
});

registerTipRoutes(app, {
  AuditLog,
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
  uploadMaxFileSizeMb,
});

registerClassifiedRoutes(app, {
  Classified,
  SiteSettings,
  DEFAULT_SITE_SETTINGS,
  brandLogoPng,
  buildShareCardOverlaySvg,
  cacheMiddleware,
  clampText,
  ensureImagePipeline,
  escapeHtml,
  getOriginalUploadUrl,
  getPublicBaseUrl,
  getShareRelativePath,
  getTrustedClientIp,
  imageMimeToExt,
  invalidateCacheTags,
  loadSharp,
  nextNumericId,
  normalizeText,
  persistShareCardObject,
  publicError,
  putStorageObject,
  rateLimit,
  rateLimitKeyGenerator,
  readOriginalUploadBuffer,
  renderTextImage,
  requireAnyPermission,
  requireAuth,
  shareCardHeight,
  shareCardWidth,
  shouldSkipRateLimit,
  storageObjectExists,
  toImageMetaFromManifest,
  toUploadsUrlFromRelative,
  upload: uploadMulti,
  uploadMaxFileSizeMb,
  wrapTextLines,
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

app.use('/api', apiErrorHandler);

registerWebArticleRoutes(app, {
  Article,
  clampText,
  escapeHtml,
  getPublicBaseUrl,
  getPublishedFilter,
  shareCardHeight,
  shareCardWidth,
  stripHtmlToText,
});

registerWebSpaRoutes(app, {
  __dirname,
  isProd,
});

// Start
const PORT = Number(process.env.PORT) || 3001;

const { startServer } = createServerLifecycleService({
  app,
  backfillImagePipeline,
  connectDB,
  ensureDbIndexes,
  ensureDefaultPermissionDocs,
  ensureGameDefinitions,
  getShuttingDown: () => shuttingDown,
  isProd,
  logError: (...args) => console.error(...args),
  logInfo: (...args) => console.log(...args),
  logWarning: (...args) => console.warn(...args),
  migrateBreakingCategoryLabels,
  mongoose,
  port: PORT,
  processEnv: process.env,
  processObject: process,
  reportServerError,
  setShuttingDown: (value) => {
    shuttingDown = Boolean(value);
  },
  startBackgroundJobs,
  stopBackgroundJobs,
});

export { startServer };
