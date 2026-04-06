import { createHash, randomBytes } from 'crypto';
import { createImageUploadErrorHelpers } from '../services/imageUploadErrorsService.js';

const CLASSIFIED_ADMIN_PERMISSIONS = ['classifieds'];

const SORT_WEIGHTS = { standard: 1, highlighted: 2, vip: 3 };

const DEFAULT_CLASSIFIEDS_CONFIG = {
  tiers: {
    standard: { price: 2000, durationDays: 7, maxImages: 1 },
    highlighted: { price: 5000, durationDays: 10, maxImages: 3 },
    vip: { price: 7000, durationDays: 14, maxImages: 5 },
  },
  bumpPrice: 1000,
  renewalDiscount: 0.5,
  iban: '59965607',
  beneficiary: 'zNews',
  currency: '$',
};

const VALID_CATEGORIES = ['cars', 'properties', 'services', 'looking-for', 'selling', 'other'];
const CATEGORY_LABELS = {
  cars: 'КОЛИ', properties: 'ИМОТИ', services: 'УСЛУГИ',
  'looking-for': 'ТЪРСЯ', selling: 'ПРОДАВАМ', other: 'РАЗНИ',
};

function generatePaymentRef() {
  return 'ZN-' + randomBytes(8).toString('hex').toUpperCase();
}

// Fields to exclude from ALL public responses (security)
const PUBLIC_EXCLUDE = { _id: 0, __v: 0, ipHash: 0, paymentRef: 0, paidBy: 0, amountDue: 0, sortWeight: 0, imagesMeta: 0 };

// Strip bidi overrides, zero-width chars, and normalize Unicode
const BIDI_RE = /[\u200E\u200F\u200B-\u200D\u2028\u2029\u202A-\u202E\u2060-\u2069\uFEFF]/g;
function sanitizeUserText(text, maxLen) {
  return text.replace(BIDI_RE, '').normalize('NFC').slice(0, maxLen).trim();
}

export function registerClassifiedRoutes(app, deps) {
  const {
    Classified,
    SiteSettings,
    DEFAULT_SITE_SETTINGS,
    brandLogoPng,
    buildShareCardOverlaySvg,
    cacheMiddleware,
    clampText,
    cleanupOldShareCards: cleanupOldArticleShareCards,
    ensureImagePipeline,
    escapeHtml,
    getOriginalUploadUrl,
    getPublicBaseUrl,
    getShareRelativePath,
    getTrustedClientIp,
    hasShareCardObject: hasArticleShareCardObject,
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
    upload,
    uploadMaxFileSizeMb,
    wrapTextLines,
  } = deps;

  const {
    buildEmptyBufferPayload,
    buildUploadErrorPayload,
  } = createImageUploadErrorHelpers({ uploadMaxFileSizeMb });

  const classifiedRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Твърде много заявки. Опитайте отново по-късно.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    keyGenerator: rateLimitKeyGenerator,
  });

  const classifiedLookupLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: { error: 'Твърде много заявки. Опитайте отново по-късно.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    keyGenerator: rateLimitKeyGenerator,
  });

  const classifiedShareLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Твърде много заявки. Опитайте отново по-късно.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    keyGenerator: rateLimitKeyGenerator,
  });

  async function getConfig() {
    const doc = await SiteSettings.findOne({ key: 'main' }).lean();
    const c = doc?.classifieds;
    if (c?.tiers?.standard && c?.tiers?.highlighted && c?.tiers?.vip) return c;
    return DEFAULT_SITE_SETTINGS.classifieds || DEFAULT_CLASSIFIEDS_CONFIG;
  }

  function runMultiUpload(req, res, maxCount) {
    return new Promise((resolve, reject) => {
      upload.array('images', maxCount)(req, res, (error) => {
        if (error) { reject(error); return; }
        resolve();
      });
    });
  }

  async function processUploadedFile(file) {
    if (!Buffer.isBuffer(file.buffer) || file.buffer.byteLength === 0) return null;

    const sharp = await loadSharp();
    const mimeType = normalizeText(file.mimetype || '', 120).toLowerCase();
    let finalBuffer = file.buffer;
    let finalName = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    let finalMime = mimeType;

    if (sharp) {
      finalBuffer = await sharp(file.buffer).rotate().webp({ quality: 82, effort: 4 }).toBuffer();
      finalName += '.webp';
      finalMime = 'image/webp';
    } else {
      finalName += (imageMimeToExt[mimeType] || '.jpg');
    }

    await putStorageObject(finalName, finalBuffer, finalMime || 'application/octet-stream');
    const pipelineManifest = await ensureImagePipeline(finalName, { sourceBuffer: finalBuffer });

    return {
      url: getOriginalUploadUrl(finalName),
      meta: toImageMetaFromManifest(pipelineManifest),
    };
  }

  // ─── Share card helpers for classifieds ───
  function buildClassifiedShareCardTarget(classified) {
    const sig = createHash('sha1')
      .update(JSON.stringify({
        v: 'classified-share-v4',
        id: classified.id,
        title: classified.title,
        price: classified.price,
        category: classified.category,
        contactName: classified.contactName,
        tier: classified.tier,
        image: classified.images?.[0] || '',
      }))
      .digest('hex')
      .slice(0, 14);

    const fileName = `classified-${classified.id}-${sig}.png`;
    const relativePath = getShareRelativePath(fileName);
    return {
      fileName,
      relativePath,
      url: toUploadsUrlFromRelative(relativePath),
    };
  }

  async function ensureClassifiedShareCard(classified) {
    const sharp = await loadSharp();
    if (!sharp || !classified) return null;

    const target = buildClassifiedShareCardTarget(classified);

    if (await storageObjectExists(target.relativePath)) {
      return { generated: true, url: target.url, relativePath: target.relativePath };
    }

    // ─── Layout constants ───
    // Card: 1200 × 630
    // Row 1 (y 48–120):  badge chip + listing id chip
    // Row 2 (y 136–390): title zone (dark panel with accent stripe)
    // Row 3 (y 404–476): price + seller (two side-by-side panels)
    // Row 4 (y 494–588): footer bar (category chip + contact chip + logo)
    const W = shareCardWidth;

    const categoryLabel = CATEGORY_LABELS[classified.category] || 'ОБЯВИ';
    const titleText = normalizeText(classified.title, 60).toUpperCase();
    const titleLines = wrapTextLines(titleText, 20, 3);
    const rawPrice = normalizeText(classified.price || '', 30);
    const currency = classified.currency || '$';
    const priceText = rawPrice ? `${currency}${rawPrice}` : '';
    const contactText = normalizeText(classified.contactName || '', 28);
    const badgeText = classified.tier === 'vip' ? 'VIP ОБЯВА' : classified.tier === 'highlighted' ? 'ТОП ОБЯВА' : 'ОБЯВА';
    const categoryText = normalizeText(categoryLabel, 20).toUpperCase();
    const sellerText = contactText ? `от ${contactText}` : '';
    const listingLabel = Number.isInteger(Number.parseInt(classified.id, 10)) ? `#${classified.id}` : '';

    const palette = classified.tier === 'vip'
      ? { primary: '#5B1A8C', secondary: '#CC0A1A', ink: '#F6EFFF' }
      : classified.tier === 'highlighted'
        ? { primary: '#B45309', secondary: '#F59E0B', ink: '#FFF3D6' }
        : { primary: '#CC0A1A', secondary: '#FF8A2A', ink: '#FFE7C8' };

    // ─── Dynamic font sizing ───
    const maxTitleLen = titleLines.reduce((max, l) => Math.max(max, l.length), 0);
    const titleBaseFontSize = titleLines.length <= 1 ? 88 : titleLines.length === 2 ? 72 : 58;
    const titleFitRatio = Math.min(1, 20 / Math.max(10, maxTitleLen));
    const titleFontSize = Math.max(46, Math.round(titleBaseFontSize * titleFitRatio));

    const badgeFontSize = 38;
    const badgeWidth = Math.max(220, Math.min(380, Math.round(80 + badgeText.length * 22)));
    const categoryFontSize = Math.max(22, Math.min(30, Math.round(400 / Math.max(6, categoryText.length + 2))));
    const categoryChipWidth = Math.max(180, Math.min(300, Math.round(60 + categoryText.length * (categoryFontSize * 0.62))));
    const priceFontSize = priceText
      ? Math.max(40, Math.min(72, Math.round(700 / Math.max(4, priceText.length + 1))))
      : 0;

    // ─── SVG overlay (backgrounds, panels, decorations) ───
    const priceChipW = priceText ? Math.max(260, Math.min(500, Math.round(60 + priceText.length * (priceFontSize * 0.55)))) : 0;
    const sellerChipLeft = priceText ? 76 + priceChipW + 16 : 76;
    const sellerChipW = sellerText ? Math.max(200, Math.min(460, Math.round(50 + sellerText.length * 16))) : 0;
    const contactChipW = contactText ? Math.max(160, Math.min(260, Math.round(40 + contactText.length * 14))) : 0;
    const listingChipW = listingLabel ? Math.max(100, Math.min(180, Math.round(40 + listingLabel.length * 20))) : 0;

    const overlaySvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${shareCardHeight}" viewBox="0 0 ${W} ${shareCardHeight}">
  <defs>
    <linearGradient id="overlayFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#090611" stop-opacity="0.10" />
      <stop offset="30%" stop-color="#110b1d" stop-opacity="0.52" />
      <stop offset="100%" stop-color="#120a1d" stop-opacity="0.96" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.primary}" />
      <stop offset="100%" stop-color="${palette.secondary}" />
    </linearGradient>
    <linearGradient id="panelEdge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.20)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.05)" />
    </linearGradient>
    <linearGradient id="footerBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(18,12,30,0.92)" />
      <stop offset="100%" stop-color="rgba(12,8,22,0.98)" />
    </linearGradient>
    <pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.20)" />
    </pattern>
    <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(15,10,24,0.88)" />
      <stop offset="100%" stop-color="rgba(21,14,34,0.96)" />
    </linearGradient>
    <linearGradient id="pricePanel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(6,24,10,0.90)" />
      <stop offset="100%" stop-color="rgba(3,16,6,0.97)" />
    </linearGradient>
    <linearGradient id="metaPanel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(21,14,34,0.88)" />
      <stop offset="100%" stop-color="rgba(14,9,24,0.96)" />
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="26%" r="90%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.03)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.50)" />
    </radialGradient>
  </defs>

  <!-- Overlay + texture -->
  <rect width="${W}" height="${shareCardHeight}" fill="url(#overlayFade)" />
  <rect width="${W}" height="${shareCardHeight}" fill="url(#dots)" opacity="0.10" />
  <rect width="${W}" height="${shareCardHeight}" fill="url(#vignette)" />
  <rect x="28" y="26" width="${W - 56}" height="${shareCardHeight - 52}" rx="26" fill="none" stroke="#211533" stroke-width="6" />

  <!-- Row 1: Badge -->
  <rect x="66" y="48" width="${badgeWidth}" height="64" rx="14" fill="url(#accent)" stroke="#241833" stroke-width="3" />

  <!-- Row 2: Title panel -->
  <rect x="54" y="130" width="${W - 108}" height="256" rx="24" fill="url(#panelGrad)" stroke="url(#panelEdge)" stroke-width="2.5" />
  <rect x="54" y="130" width="${W - 108}" height="10" rx="6" fill="url(#accent)" opacity="0.90" />

  <!-- Row 3: Price + seller -->
  ${priceText ? `<rect x="76" y="404" width="${priceChipW}" height="72" rx="16" fill="url(#pricePanel)" stroke="rgba(74,222,128,0.30)" stroke-width="2" />` : ''}
  ${sellerText ? `<rect x="${sellerChipLeft}" y="404" width="${sellerChipW}" height="72" rx="16" fill="url(#metaPanel)" stroke="rgba(255,255,255,0.08)" stroke-width="2" />` : ''}

  <!-- Row 4: Footer bar -->
  <rect x="54" y="494" width="${W - 108}" height="94" rx="20" fill="url(#footerBar)" stroke="#2a1d3d" stroke-width="2.5" />
  <rect x="76" y="516" width="${categoryChipWidth}" height="48" rx="12" fill="url(#accent)" stroke="#2b1c40" stroke-width="2.5" />
  ${contactText ? `<rect x="${76 + categoryChipWidth + 16}" y="516" width="${contactChipW}" height="48" rx="12" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.06)" stroke-width="2" />` : ''}
  ${listingLabel ? `<rect x="${W - 76 - 140 - listingChipW}" y="516" width="${listingChipW}" height="48" rx="12" fill="rgba(14,10,24,0.86)" stroke="rgba(255,255,255,0.14)" stroke-width="2" />` : ''}
</svg>`, 'utf8');

    // ─── Render text layers as PNG images ───
    const [badge, listingIdImg, title, price, seller, category, contact] = await Promise.all([
      renderTextImage(sharp, badgeText, {
        fontSize: badgeFontSize,
        fontWeight: '900',
        color: 'white',
        width: badgeWidth - 24,
        height: 56,
        align: 'centre',
      }),
      listingLabel ? renderTextImage(sharp, listingLabel, {
        fontSize: 22,
        fontWeight: '900',
        color: '#D4C4F0',
        width: 120,
        height: 30,
        align: 'centre',
      }) : null,
      renderTextImage(sharp, titleLines.join('\n'), {
        fontSize: titleFontSize,
        fontWeight: '900',
        color: 'white',
        width: W - 180,
        height: 230,
      }),
      priceText ? renderTextImage(sharp, priceText, {
        fontSize: priceFontSize,
        fontWeight: '900',
        color: '#4ade80',
        width: priceChipW - 48,
        height: 56,
      }) : null,
      sellerText ? renderTextImage(sharp, sellerText, {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#DCCBFF',
        width: Math.max(100, sellerChipW - 40),
        height: 34,
      }) : null,
      renderTextImage(sharp, categoryText, {
        fontSize: categoryFontSize,
        fontWeight: '900',
        color: palette.ink,
        width: categoryChipWidth - 30,
        height: 38,
        align: 'centre',
      }),
      contactText ? renderTextImage(sharp, contactText, {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#F0EAE0',
        width: contactChipW - 24,
        height: 28,
        align: 'centre',
      }) : null,
    ]);

    // ─── Compose all layers ───
    const composites = [{ input: overlaySvg }];

    if (badge) composites.push({
      input: badge.buffer,
      top: Math.round(48 + (64 - badge.height) / 2),
      left: Math.round(66 + (badgeWidth - badge.width) / 2),
    });

    if (listingIdImg) composites.push({
      input: listingIdImg.buffer,
      top: Math.round(516 + (48 - listingIdImg.height) / 2),
      left: Math.round(W - 76 - 140 - listingChipW + (listingChipW - listingIdImg.width) / 2),
    });

    if (title) {
      // Vertically center title in the panel (y:148 to y:370 = 222px usable)
      const titleZoneTop = 148;
      const titleZoneHeight = 222;
      const titleTop = Math.round(titleZoneTop + Math.max(0, (titleZoneHeight - title.height) / 2));
      composites.push({
        input: title.buffer,
        top: titleTop,
        left: 90,
      });
    }

    if (price) composites.push({
      input: price.buffer,
      top: Math.round(404 + (72 - price.height) / 2),
      left: Math.round(76 + 24),
    });

    if (seller) composites.push({
      input: seller.buffer,
      top: Math.round(404 + (72 - seller.height) / 2),
      left: Math.round(sellerChipLeft + 20),
    });

    if (category) composites.push({
      input: category.buffer,
      top: Math.round(516 + (48 - category.height) / 2),
      left: Math.round(76 + (categoryChipWidth - category.width) / 2),
    });

    if (contact) composites.push({
      input: contact.buffer,
      top: Math.round(516 + (48 - contact.height) / 2),
      left: Math.round(76 + categoryChipWidth + 16 + (contactChipW - contact.width) / 2),
    });

    if (brandLogoPng) {
      const meta = await sharp(brandLogoPng).metadata();
      const brandW = meta.width || 0;
      const brandH = meta.height || 0;
      composites.push({
        input: brandLogoPng,
        top: Math.round(516 + (48 - brandH) / 2),
        left: Math.round(W - 76 - brandW),
      });
    }

    // Background: use first image if available, else solid color
    let baseImage;
    const firstImageUrl = classified.images?.[0];
    let bgBuffer = null;

    if (firstImageUrl) {
      const uploadFileName = firstImageUrl.split('/').pop();
      if (uploadFileName && readOriginalUploadBuffer) {
        bgBuffer = await readOriginalUploadBuffer(uploadFileName).catch(() => null);
      }
    }

    if (bgBuffer) {
      baseImage = sharp(bgBuffer, { failOn: 'none' })
        .rotate()
        .resize(shareCardWidth, shareCardHeight, { fit: 'cover', position: 'centre' })
        .modulate({ brightness: 0.68, saturation: 1.08 });
    } else {
      baseImage = sharp({
        create: {
          width: shareCardWidth,
          height: shareCardHeight,
          channels: 3,
          background: { r: 28, g: 20, b: 40 },
        },
      });
    }

    const output = await baseImage
      .composite(composites)
      .png({ compressionLevel: 9, quality: 92 })
      .toBuffer();

    await persistShareCardObject(target, output);
    return { generated: true, url: target.url, relativePath: target.relativePath };
  }

  // ─── SSR: bot-friendly meta tags for classified detail pages ───
  const BOT_UA_RE = /(discordbot|discordapp|twitterbot|slackbot|telegrambot|whatsapp|facebookexternalhit|linkedinbot|embedly|quora link preview|pinterest|googlebot|bingbot|yandex|duckduckbot)/i;

  app.get('/obiavi/:id', async (req, res, next) => {
    try {
      const ua = String(req.headers?.['user-agent'] || '');
      if (!BOT_UA_RE.test(ua)) return next();

      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return next();

      const now = new Date();
      const doc = await Classified.findOne({ id, status: 'active', expiresAt: { $gt: now } }).lean();
      if (!doc) return next();

      const baseUrl = getPublicBaseUrl(req);
      const title = clampText(doc.title || 'Обява', 140);
      const desc = clampText(doc.description || '', 220) || 'Малки обяви в zNews.live';
      const url = `${baseUrl}/obiavi/${id}`;
      const imageUrl = `${baseUrl}/api/classifieds/${id}/share.png`;

      const html = `<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — zNews Обяви</title>
    <meta name="description" content="${escapeHtml(desc)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="zNews.live" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(desc)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${shareCardWidth}" />
    <meta property="og:image:height" content="${shareCardHeight}" />
    ${doc.price ? `<meta property="product:price:amount" content="${escapeHtml(String(doc.price))}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(desc)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  </head>
  <body></body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(html);
    } catch (_err) {
      return next();
    }
  });

  // ─── Public: list active classifieds ───
  app.get('/api/classifieds', cacheMiddleware, async (req, res) => {
    res.setCacheTags?.(['classifieds']);
    const now = new Date();
    const filter = { status: 'active', expiresAt: { $gt: now } };

    const category = String(req.query.category || '').trim();
    if (category && VALID_CATEGORIES.includes(category)) {
      filter.category = category;
    }

    const search = String(req.query.search || '').trim();
    if (search) {
      filter.$text = { $search: search };
    }

    // Price range filter (price is stored as string, use $expr for numeric comparison)
    const priceMin = Number.parseFloat(req.query.priceMin);
    const priceMax = Number.parseFloat(req.query.priceMax);
    if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
      const priceExpr = { $toDouble: { $ifNull: [{ $replaceAll: { input: '$price', find: ' ', replacement: '' } }, '0'] } };
      const conditions = [];
      if (Number.isFinite(priceMin)) conditions.push({ $gte: [priceExpr, priceMin] });
      if (Number.isFinite(priceMax)) conditions.push({ $lte: [priceExpr, priceMax] });
      filter.$expr = conditions.length === 1 ? conditions[0] : { $and: conditions };
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Sort: VIP first (sortWeight DESC), then bumpedAt/approvedAt DESC
    // Include imagesMeta to extract thumbnails, then strip it from response
    const listExclude = { ...PUBLIC_EXCLUDE };
    delete listExclude.imagesMeta; // temporarily include for thumbnail extraction
    const [rawItems, total] = await Promise.all([
      Classified.find(filter).select(listExclude).sort({ sortWeight: -1, bumpedAt: -1, approvedAt: -1, id: -1 }).skip(skip).limit(limit).lean(),
      Classified.countDocuments(filter),
    ]);

    // Extract smallest webp variant as thumbnail, then remove imagesMeta
    const items = rawItems.map(item => {
      const meta = item.imagesMeta?.[0];
      const smallest = meta?.webp?.sort((a, b) => (a.width || 0) - (b.width || 0))?.[0];
      const result = { ...item, thumbnail: smallest?.url || null };
      delete result.imagesMeta;
      return result;
    });

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  });

  // ─── Public: get tier prices (MUST be before /:id) ───
  app.get('/api/classifieds/prices', cacheMiddleware, async (_req, res) => {
    res.setCacheTags?.(['classifieds', 'site-settings']);
    const cfg = await getConfig();
    res.json({
      tiers: {
        standard: { price: cfg.tiers.standard.price, durationDays: cfg.tiers.standard.durationDays, maxImages: cfg.tiers.standard.maxImages },
        highlighted: { price: cfg.tiers.highlighted.price, durationDays: cfg.tiers.highlighted.durationDays, maxImages: cfg.tiers.highlighted.maxImages },
        vip: { price: cfg.tiers.vip.price, durationDays: cfg.tiers.vip.durationDays, maxImages: cfg.tiers.vip.maxImages },
      },
      bumpPrice: cfg.bumpPrice,
      renewalDiscount: cfg.renewalDiscount,
      iban: cfg.iban,
      beneficiary: cfg.beneficiary,
      currency: cfg.currency,
    });
  });

  // ─── Public: check status by payment reference (MUST be before /:id) ───
  app.get('/api/classifieds/status/:ref', classifiedLookupLimiter, async (req, res) => {
    const ref = normalizeText(req.params.ref || '', 20).toUpperCase();
    if (!ref) return res.status(400).json({ error: 'Invalid reference' });

    const doc = await Classified.findOne({ paymentRef: ref })
      .select({ _id: 0, id: 1, title: 1, status: 1, tier: 1, amountDue: 1, currency: 1, paymentRef: 1, createdAt: 1, approvedAt: 1, expiresAt: 1 })
      .lean();

    if (!doc) return res.status(404).json({ error: 'Не е намерена обява с този код.' });
    res.json(doc);
  });

  // ─── Public: VIP widget (latest 3 VIP classifieds, MUST be before /:id) ───
  app.get('/api/classifieds/vip-widget', cacheMiddleware, async (_req, res) => {
    res.setCacheTags?.(['classifieds']);
    const now = new Date();
    const items = await Classified.find({
      status: 'active',
      tier: 'vip',
      expiresAt: { $gt: now },
    }).select(PUBLIC_EXCLUDE).sort({ bumpedAt: -1, approvedAt: -1, id: -1 }).limit(3).lean();
    res.json(items);
  });

  // ─── Public: get single classified (with view count increment) ───
  app.get('/api/classifieds/:id', classifiedLookupLimiter, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const now = new Date();
    const doc = await Classified.findOneAndUpdate(
      { id, status: 'active', expiresAt: { $gt: now } },
      { $inc: { viewCount: 1 } },
      { returnDocument: 'after', projection: PUBLIC_EXCLUDE }
    ).lean();

    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  });

  // ─── Public: get share card PNG ───
  app.get('/api/classifieds/:id/share.png', classifiedShareLimiter, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const now = new Date();
    const doc = await Classified.findOne({ id, status: 'active', expiresAt: { $gt: now } }).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const card = await ensureClassifiedShareCard(doc);
    if (card?.generated && card.url) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      return res.redirect(302, card.url);
    }

    return res.status(404).json({ error: 'Share card unavailable' });
  });

  // ─── Public: submit a classified ───
  app.post('/api/classifieds', classifiedRateLimiter, async (req, res) => {
    const cfg = await getConfig();
    // Peek at tier from query/body to determine max images
    const tierHint = String(req.query.tier || 'standard').trim();
    const tierCfgHint = cfg.tiers[tierHint] || cfg.tiers.standard;

    try {
      await runMultiUpload(req, res, tierCfgHint.maxImages);
    } catch (error) {
      return res.status(400).json(buildUploadErrorPayload(error));
    }

    const title = sanitizeUserText(normalizeText(req.body.title || '', 120), 120);
    const description = sanitizeUserText(normalizeText(req.body.description || '', 1000), 1000);
    const category = String(req.body.category || '').trim();
    const price = sanitizeUserText(normalizeText(req.body.price || '', 60), 60);
    const phone = sanitizeUserText(normalizeText(req.body.phone || '', 30), 30);
    const contactName = sanitizeUserText(normalizeText(req.body.contactName || '', 80), 80);
    const tier = String(req.body.tier || 'standard').trim();

    const fieldErrors = {};
    if (!title) fieldErrors.title = 'Заглавието е задължително.';
    if (!description) fieldErrors.description = 'Описанието е задължително.';
    if (!VALID_CATEGORIES.includes(category)) fieldErrors.category = 'Невалидна категория.';
    if (!phone) fieldErrors.phone = 'Телефонът е задължителен.';
    if (!contactName) fieldErrors.contactName = 'Името за контакт е задължително.';
    if (!cfg.tiers[tier]) fieldErrors.tier = 'Невалиден пакет.';

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ error: 'Моля попълнете всички задължителни полета.', fieldErrors });
    }

    const tierCfg = cfg.tiers[tier];
    const images = [];
    const imagesMeta = [];

    const files = Array.isArray(req.files) ? req.files.slice(0, tierCfg.maxImages) : [];
    for (const file of files) {
      const result = await processUploadedFile(file);
      // Release raw buffer after processing to reduce memory pressure
      file.buffer = null;
      if (result) {
        images.push(result.url);
        imagesMeta.push(result.meta);
      }
    }

    const paymentRef = generatePaymentRef();
    const ipHash = createHash('sha256').update(getTrustedClientIp(req)).digest('hex');
    const classifiedId = await nextNumericId(Classified);

    const doc = new Classified({
      id: classifiedId,
      title,
      description,
      category,
      price,
      phone,
      contactName,
      images,
      imagesMeta,
      tier,
      status: 'awaiting_payment',
      paymentRef,
      amountDue: tierCfg.price,
      currency: cfg.currency,
      sortWeight: SORT_WEIGHTS[tier] || 1,
      ipHash,
    });
    await doc.save();

    return res.json({
      ok: true,
      id: doc.id,
      paymentRef,
      amountDue: tierCfg.price,
      iban: cfg.iban,
      beneficiary: cfg.beneficiary,
      currency: cfg.currency,
    });
  });

  // ─── Public: request bump (generates payment ref) ───
  app.post('/api/classifieds/:id/bump', classifiedRateLimiter, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const now = new Date();
    const doc = await Classified.findOne({ id, status: 'active', expiresAt: { $gt: now } });
    if (!doc) return res.status(404).json({ error: 'Обявата не е намерена или не е активна.' });

    const cfg = await getConfig();
    const bumpRef = generatePaymentRef();

    return res.json({
      ok: true,
      id: doc.id,
      bumpRef,
      bumpPrice: cfg.bumpPrice,
      iban: cfg.iban,
      beneficiary: cfg.beneficiary,
      currency: cfg.currency,
      message: `Преведете ${cfg.currency}${cfg.bumpPrice.toLocaleString('bg-BG')} с основание ${bumpRef} за bump на обява #${doc.id}.`,
    });
  });

  // ─── Public: request VIP renewal (50% discount) ───
  app.post('/api/classifieds/:id/renew', classifiedRateLimiter, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Classified.findOne({ id });
    if (!doc) return res.status(404).json({ error: 'Обявата не е намерена.' });
    if (doc.tier !== 'vip') return res.status(400).json({ error: 'Подновяването е налично само за VIP обяви.' });

    const cfg = await getConfig();
    const renewalPrice = Math.round(cfg.tiers.vip.price * cfg.renewalDiscount);
    const renewRef = generatePaymentRef();

    return res.json({
      ok: true,
      id: doc.id,
      renewRef,
      renewalPrice,
      iban: cfg.iban,
      beneficiary: cfg.beneficiary,
      currency: cfg.currency,
      message: `Преведете ${cfg.currency}${renewalPrice.toLocaleString('bg-BG')} с основание ${renewRef} за подновяване на VIP обява #${doc.id}.`,
    });
  });

  // ─── Admin: list all classifieds ───
  app.get('/api/admin/classifieds', requireAuth, requireAnyPermission(CLASSIFIED_ADMIN_PERMISSIONS), async (_req, res) => {
    const items = await Classified.find().sort({ id: -1 }).lean();
    res.json(items);
  });

  // ─── Admin: approve (payment confirmed) ───
  app.patch('/api/admin/classifieds/:id/approve', requireAuth, requireAnyPermission(CLASSIFIED_ADMIN_PERMISSIONS), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Classified.findOne({ id });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const cfg = await getConfig();
    const tierCfg = cfg.tiers[doc.tier] || cfg.tiers.standard;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tierCfg.durationDays * 24 * 60 * 60 * 1000);

    doc.status = 'active';
    doc.approvedAt = now;
    doc.bumpedAt = now;
    doc.expiresAt = expiresAt;
    doc.sortWeight = SORT_WEIGHTS[doc.tier] || 1;
    doc.paidBy = normalizeText(req.body.paidBy || '', 200);
    await doc.save();

    invalidateCacheTags(['classifieds']);
    res.json(doc.toJSON());
  });

  // ─── Admin: bump a classified ───
  app.patch('/api/admin/classifieds/:id/bump', requireAuth, requireAnyPermission(CLASSIFIED_ADMIN_PERMISSIONS), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Classified.findOneAndUpdate(
      { id, status: 'active' },
      { bumpedAt: new Date() },
      { returnDocument: 'after' }
    );
    if (!doc) return res.status(404).json({ error: 'Not found or not active' });

    invalidateCacheTags(['classifieds']);
    res.json(doc.toJSON());
  });

  // ─── Admin: renew VIP (extend expiry) ───
  app.patch('/api/admin/classifieds/:id/renew', requireAuth, requireAnyPermission(CLASSIFIED_ADMIN_PERMISSIONS), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Classified.findOne({ id });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const cfg = await getConfig();
    const tierCfg = cfg.tiers[doc.tier] || cfg.tiers.standard;
    const baseDate = doc.expiresAt && doc.expiresAt > new Date() ? doc.expiresAt : new Date();
    doc.expiresAt = new Date(baseDate.getTime() + tierCfg.durationDays * 24 * 60 * 60 * 1000);
    doc.status = 'active';
    doc.paidBy = normalizeText(req.body.paidBy || doc.paidBy || '', 200);
    await doc.save();

    invalidateCacheTags(['classifieds']);
    res.json(doc.toJSON());
  });

  // ─── Admin: reject ───
  app.patch('/api/admin/classifieds/:id/reject', requireAuth, requireAnyPermission(CLASSIFIED_ADMIN_PERMISSIONS), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Classified.findOneAndUpdate(
      { id },
      { status: 'rejected' },
      { returnDocument: 'after' }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });

    invalidateCacheTags(['classifieds']);
    res.json(doc.toJSON());
  });

  // ─── Admin: delete ───
  app.delete('/api/admin/classifieds/:id', requireAuth, requireAnyPermission(CLASSIFIED_ADMIN_PERMISSIONS), async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Classified.findOneAndDelete({ id });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    invalidateCacheTags(['classifieds']);
    res.json({ ok: true });
  });
}
