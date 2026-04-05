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
    cleanupOldShareCards: cleanupOldArticleShareCards,
    ensureImagePipeline,
    getOriginalUploadUrl,
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
        v: 'classified-share-v2',
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

    const tierLabel = classified.tier === 'vip' ? 'VIP ОБЯВА' : classified.tier === 'highlighted' ? 'ТОП ОБЯВА' : 'ОБЯВА';
    const categoryLabel = CATEGORY_LABELS[classified.category] || 'ОБЯВИ';
    const titleText = normalizeText(classified.title, 76).toUpperCase();
    const titleLines = wrapTextLines(titleText, 18, 3);
    const priceText = classified.price ? `${classified.price}` : '';
    const contactText = normalizeText(classified.contactName || '', 32);
    const badgeText = classified.tier === 'vip' ? 'VIP ОБЯВА' : classified.tier === 'highlighted' ? 'ТОП ОБЯВА' : 'ОБЯВА';
    const categoryText = normalizeText(categoryLabel || 'Обява', 36).toUpperCase();
    const sellerText = contactText ? `от ${contactText}` : 'zNews classifieds';
    const listingLabel = Number.isInteger(Number.parseInt(classified.id, 10)) ? `ОБЯВА #${classified.id}` : 'ОБЯВА';

    const palette = classified.tier === 'vip'
      ? { primary: '#5B1A8C', secondary: '#CC0A1A', ink: '#F6EFFF' }
      : classified.tier === 'highlighted'
        ? { primary: '#B45309', secondary: '#F59E0B', ink: '#FFF3D6' }
        : { primary: '#CC0A1A', secondary: '#FF8A2A', ink: '#FFE7C8' };
    const maxTitleLen = titleLines.reduce((max, l) => Math.max(max, l.length), 0);
    const titleBaseFontSize = titleLines.length <= 1 ? 96 : titleLines.length === 2 ? 82 : 68;
    const titleFitRatio = Math.min(1, 18 / Math.max(10, maxTitleLen));
    const titleFontSize = Math.max(54, Math.round(titleBaseFontSize * titleFitRatio));
    const badgeFontSize = Math.max(34, Math.min(50, Math.round(520 / Math.max(8, badgeText.length + 2))));
    const badgeWidth = Math.max(248, Math.min(404, Math.round(104 + badgeText.length * (badgeFontSize * 0.58))));
    const categoryFontSize = Math.max(24, Math.min(34, Math.round(500 / Math.max(8, categoryText.length + 3))));
    const categoryChipWidth = Math.max(208, Math.min(320, Math.round(86 + categoryText.length * (categoryFontSize * 0.6))));
    const priceFontSize = priceText
      ? Math.max(44, Math.min(86, Math.round(760 / Math.max(5, priceText.length + 1))))
      : 0;

    const overlaySvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${shareCardWidth}" height="${shareCardHeight}" viewBox="0 0 ${shareCardWidth} ${shareCardHeight}">
  <defs>
    <linearGradient id="overlayFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#090611" stop-opacity="0.12" />
      <stop offset="38%" stop-color="#110b1d" stop-opacity="0.58" />
      <stop offset="100%" stop-color="#120a1d" stop-opacity="0.95" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.primary}" />
      <stop offset="100%" stop-color="${palette.secondary}" />
    </linearGradient>
    <linearGradient id="panelEdge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.24)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.06)" />
    </linearGradient>
    <linearGradient id="footerMetal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffaf2" />
      <stop offset="100%" stop-color="#ece4d4" />
    </linearGradient>
    <pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.23)" />
    </pattern>
    <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(15,10,24,0.86)" />
      <stop offset="100%" stop-color="rgba(21,14,34,0.95)" />
    </linearGradient>
    <linearGradient id="titleSlab" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(10,8,18,0.18)" />
      <stop offset="100%" stop-color="rgba(8,6,14,0.52)" />
    </linearGradient>
    <linearGradient id="pricePanel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(8,22,12,0.86)" />
      <stop offset="100%" stop-color="rgba(4,15,8,0.96)" />
    </linearGradient>
    <linearGradient id="metaPanel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(21,14,34,0.92)" />
      <stop offset="100%" stop-color="rgba(14,9,24,0.98)" />
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="28%" r="88%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.04)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.48)" />
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="${shareCardWidth}" height="${shareCardHeight}" fill="url(#overlayFade)" />
  <rect x="0" y="0" width="${shareCardWidth}" height="${shareCardHeight}" fill="url(#dots)" opacity="0.12" />
  <rect x="0" y="0" width="${shareCardWidth}" height="${shareCardHeight}" fill="url(#vignette)" />
  <rect x="28" y="26" width="${shareCardWidth - 56}" height="${shareCardHeight - 52}" rx="28" fill="none" stroke="#211533" stroke-width="7" />

  <rect x="70" y="52" width="${badgeWidth}" height="68" rx="16" fill="url(#accent)" stroke="#241833" stroke-width="3" />
  <rect x="${shareCardWidth - 260}" y="58" width="178" height="52" rx="13" fill="rgba(14,10,24,0.84)" stroke="rgba(255,255,255,0.16)" stroke-width="2" />

  <rect x="54" y="136" width="${shareCardWidth - 108}" height="344" rx="28" fill="url(#panelGrad)" stroke="url(#panelEdge)" stroke-width="2.8" />
  <rect x="54" y="136" width="${shareCardWidth - 108}" height="14" rx="10" fill="url(#accent)" opacity="0.95" />
  <rect x="76" y="170" width="${shareCardWidth - 152}" height="198" rx="18" fill="url(#titleSlab)" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
  <rect x="88" y="182" width="${shareCardWidth - 176}" height="6" rx="3" fill="url(#accent)" />
  <rect x="76" y="392" width="328" height="76" rx="18" fill="url(#pricePanel)" stroke="rgba(74,222,128,0.32)" stroke-width="2.2" />
  <rect x="428" y="392" width="${shareCardWidth - 504}" height="76" rx="18" fill="url(#metaPanel)" stroke="rgba(255,255,255,0.10)" stroke-width="2" />

  <rect x="54" y="498" width="${shareCardWidth - 108}" height="104" rx="22" fill="url(#footerMetal)" stroke="#2a1d3d" stroke-width="2.6" />
  <rect x="76" y="520" width="${categoryChipWidth}" height="50" rx="13" fill="url(#accent)" stroke="#2b1c40" stroke-width="2.5" />
  <rect x="${shareCardWidth - 426}" y="520" width="218" height="50" rx="13" fill="rgba(22,16,34,0.94)" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
</svg>`, 'utf8');

    const [badge, listingMeta, title, priceLabel, price, seller, category, contact] = await Promise.all([
      renderTextImage(sharp, badgeText, {
        fontSize: badgeFontSize,
        fontWeight: '900',
        color: 'white',
        width: badgeWidth - 28,
        height: 60,
        align: 'centre',
      }),
      renderTextImage(sharp, listingLabel, {
        fontSize: 21,
        fontWeight: '900',
        color: '#E9D9FF',
        width: 150,
        height: 28,
        align: 'centre',
      }),
      renderTextImage(sharp, titleLines.join('\n'), {
        fontSize: titleFontSize,
        fontWeight: '900',
        color: 'white',
        width: shareCardWidth - 196,
        height: 210,
      }),
      priceText ? renderTextImage(sharp, 'ЦЕНА', {
        fontSize: 18,
        fontWeight: '900',
        color: '#8BF7A6',
        width: 90,
        height: 22,
      }) : null,
      priceText ? renderTextImage(sharp, priceText, {
        fontSize: priceFontSize,
        fontWeight: '900',
        color: '#4ade80',
        width: 270,
        height: 54,
      }) : null,
      renderTextImage(sharp, sellerText, {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#DCCBFF',
        width: shareCardWidth - 552,
        height: 30,
      }),
      renderTextImage(sharp, categoryText, {
        fontSize: categoryFontSize,
        fontWeight: '900',
        color: palette.ink,
        width: categoryChipWidth - 34,
        height: 40,
        align: 'centre',
      }),
      contactText ? renderTextImage(sharp, contactText, {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#F8F3EA',
        width: 190,
        height: 30,
        align: 'centre',
      }) : null,
    ]);

    const composites = [{ input: overlaySvg }];

    if (badge) composites.push({
      input: badge.buffer,
      top: Math.round(54 + (68 - badge.height) / 2),
      left: Math.round(70 + (badgeWidth - badge.width) / 2),
    });

    if (listingMeta) composites.push({
      input: listingMeta.buffer,
      top: Math.round(69 + (52 - listingMeta.height) / 2),
      left: Math.round(shareCardWidth - 246 + ((150 - listingMeta.width) / 2)),
    });

    if (title) {
      const titleZoneTop = 194;
      const titleZoneHeight = 158;
      composites.push({
        input: title.buffer,
        top: Math.max(titleZoneTop, Math.round(titleZoneTop + ((titleZoneHeight - title.height) / 2))),
        left: 98,
      });
    }

    if (priceLabel) composites.push({
      input: priceLabel.buffer,
      top: Math.round(406 + (22 - priceLabel.height) / 2),
      left: 102,
    });

    if (price) composites.push({
      input: price.buffer,
      top: Math.round(424 + (30 - price.height) / 2),
      left: 100,
    });

    if (seller) composites.push({
      input: seller.buffer,
      top: Math.round(417 + ((30 - seller.height) / 2)),
      left: 448,
    });

    if (category) composites.push({
      input: category.buffer,
      top: Math.round(520 + ((50 - category.height) / 2)),
      left: Math.round(76 + ((categoryChipWidth - category.width) / 2)),
    });

    if (contact) composites.push({
      input: contact.buffer,
      top: Math.round(530 + ((30 - contact.height) / 2)),
      left: Math.round(shareCardWidth - 412 + ((190 - contact.width) / 2)),
    });

    if (brandLogoPng) {
      const meta = await sharp(brandLogoPng).metadata();
      const brandW = meta.width || 0;
      const brandH = meta.height || 0;
      composites.push({
        input: brandLogoPng,
        top: Math.round(520 + ((50 - brandH) / 2)),
        left: Math.round(shareCardWidth - 76 - brandW),
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

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Sort: VIP first (sortWeight DESC), then bumpedAt/approvedAt DESC
    const [items, total] = await Promise.all([
      Classified.find(filter).select(PUBLIC_EXCLUDE).sort({ sortWeight: -1, bumpedAt: -1, approvedAt: -1, id: -1 }).skip(skip).limit(limit).lean(),
      Classified.countDocuments(filter),
    ]);

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
