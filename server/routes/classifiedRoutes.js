import { createHash, randomBytes } from 'crypto';
import { createImageUploadErrorHelpers } from '../services/imageUploadErrorsService.js';

const CLASSIFIED_ADMIN_PERMISSIONS = ['classifieds'];

const TIER_CONFIG = {
  standard: { price: 2000, durationDays: 7, maxImages: 1, sortWeight: 1 },
  highlighted: { price: 5000, durationDays: 10, maxImages: 3, sortWeight: 2 },
  vip: { price: 7000, durationDays: 14, maxImages: 5, sortWeight: 3 },
};

const BUMP_PRICE = 1000;
const RENEWAL_DISCOUNT = 0.5; // 50% off for VIP renewals

const VALID_CATEGORIES = ['cars', 'properties', 'services', 'looking-for', 'selling', 'other'];
const CATEGORY_LABELS = {
  cars: 'КОЛИ', properties: 'ИМОТИ', services: 'УСЛУГИ',
  'looking-for': 'ТЪРСЯ', selling: 'ПРОДАВАМ', other: 'РАЗНИ',
};

function generatePaymentRef() {
  return 'ZN-' + randomBytes(4).toString('hex').toUpperCase();
}

export function registerClassifiedRoutes(app, deps) {
  const {
    Classified,
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
        v: 'classified-share-v1',
        id: classified.id,
        title: classified.title,
        price: classified.price,
        category: classified.category,
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
    const titleText = normalizeText(classified.title, 60).toUpperCase();
    const titleLines = wrapTextLines(titleText, 18, 3);
    const priceText = classified.price ? `${classified.price}` : '';
    const contactText = normalizeText(classified.contactName || '', 40);

    const palette = classified.tier === 'vip'
      ? { primary: '#5B1A8C', secondary: '#CC0A1A' }
      : classified.tier === 'highlighted'
        ? { primary: '#b45309', secondary: '#f59e0b' }
        : { primary: '#CC0A1A', secondary: '#ff8a2a' };

    // Build SVG overlay
    const overlaySvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
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

  <rect x="72" y="54" width="280" height="68" rx="14" fill="url(#accent)" stroke="#241833" stroke-width="3" />

  <rect x="56" y="140" width="${shareCardWidth - 112}" height="340" rx="26" fill="url(#panelGrad)" stroke="rgba(255,255,255,0.30)" stroke-width="2.4" />
  <rect x="56" y="140" width="${shareCardWidth - 112}" height="12" rx="8" fill="url(#accent)" opacity="0.86" />

  <rect x="56" y="498" width="${shareCardWidth - 112}" height="104" rx="20" fill="url(#footerMetal)" stroke="#2a1d3d" stroke-width="2.4" />
  <rect x="78" y="516" width="220" height="50" rx="12" fill="url(#accent)" stroke="#2b1c40" stroke-width="2.5" />
</svg>`, 'utf8');

    // Render text layers
    const maxTitleLen = titleLines.reduce((max, l) => Math.max(max, l.length), 0);
    const titleBaseFontSize = titleLines.length <= 1 ? 96 : titleLines.length === 2 ? 82 : 68;
    const titleFitRatio = Math.min(1, 18 / Math.max(10, maxTitleLen));
    const titleFontSize = Math.max(54, Math.round(titleBaseFontSize * titleFitRatio));

    const [badge, title, price, category, contact] = await Promise.all([
      renderTextImage(sharp, tierLabel, {
        fontSize: 40,
        fontWeight: '900',
        color: 'white',
        width: 240,
        height: 60,
        align: 'centre',
      }),
      renderTextImage(sharp, titleLines.join('\n'), {
        fontSize: titleFontSize,
        fontWeight: '900',
        color: 'white',
        width: shareCardWidth - 200,
        height: 200,
      }),
      priceText ? renderTextImage(sharp, priceText, {
        fontSize: 48,
        fontWeight: '900',
        color: '#4ade80',
        width: shareCardWidth - 240,
        height: 60,
      }) : null,
      renderTextImage(sharp, categoryLabel, {
        fontSize: 28,
        fontWeight: '900',
        color: palette.primary,
        width: 180,
        height: 40,
        align: 'centre',
      }),
      contactText ? renderTextImage(sharp, contactText, {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#3f2d56',
        width: 400,
        height: 30,
      }) : null,
    ]);

    const composites = [{ input: overlaySvg }];

    if (badge) composites.push({
      input: badge.buffer,
      top: Math.round(54 + (68 - badge.height) / 2),
      left: Math.round(72 + (280 - badge.width) / 2),
    });

    if (title) composites.push({
      input: title.buffer,
      top: Math.round(170 + (180 - title.height) / 2),
      left: 94,
    });

    if (price) composites.push({
      input: price.buffer,
      top: Math.round(390 + (60 - price.height) / 2),
      left: 94,
    });

    if (category) composites.push({
      input: category.buffer,
      top: Math.round(516 + (50 - category.height) / 2),
      left: Math.round(78 + (220 - category.width) / 2),
    });

    if (contact) composites.push({
      input: contact.buffer,
      top: Math.round(530 + (30 - contact.height) / 2),
      left: 340,
    });

    // Brand logo in footer
    if (brandLogoPng) {
      const meta = await sharp(brandLogoPng).metadata();
      const brandW = meta.width || 0;
      const brandH = meta.height || 0;
      composites.push({
        input: brandLogoPng,
        top: Math.round(510 + (80 - brandH) / 2),
        left: Math.round(shareCardWidth - 56 - brandW - 16),
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
        .modulate({ brightness: 0.7, saturation: 1.1 });
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
      Classified.find(filter).sort({ sortWeight: -1, bumpedAt: -1, approvedAt: -1, id: -1 }).skip(skip).limit(limit).lean(),
      Classified.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  });

  // ─── Public: get tier prices (MUST be before /:id) ───
  app.get('/api/classifieds/prices', cacheMiddleware, async (_req, res) => {
    res.setCacheTags?.(['classifieds']);
    res.json({
      tiers: Object.fromEntries(
        Object.entries(TIER_CONFIG).map(([k, v]) => [k, { price: v.price, durationDays: v.durationDays, maxImages: v.maxImages }])
      ),
      bumpPrice: BUMP_PRICE,
      renewalDiscount: RENEWAL_DISCOUNT,
      iban: '59965607',
      beneficiary: 'zNews',
      currency: '$',
    });
  });

  // ─── Public: check status by payment reference (MUST be before /:id) ───
  app.get('/api/classifieds/status/:ref', async (req, res) => {
    const ref = normalizeText(req.params.ref || '', 20).toUpperCase();
    if (!ref) return res.status(400).json({ error: 'Invalid reference' });

    const doc = await Classified.findOne({ paymentRef: ref })
      .select({ _id: 0, id: 1, title: 1, status: 1, tier: 1, amountDue: 1, paymentRef: 1, createdAt: 1, approvedAt: 1, expiresAt: 1 })
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
    }).sort({ bumpedAt: -1, approvedAt: -1, id: -1 }).limit(3).lean();
    res.json(items);
  });

  // ─── Public: get single classified (with view count increment) ───
  app.get('/api/classifieds/:id', async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const now = new Date();
    const doc = await Classified.findOneAndUpdate(
      { id, status: 'active', expiresAt: { $gt: now } },
      { $inc: { viewCount: 1 } },
      { returnDocument: 'after' }
    ).lean();

    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  });

  // ─── Public: get share card PNG ───
  app.get('/api/classifieds/:id/share.png', async (req, res) => {
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
    // Peek at tier from query/body to determine max images
    const tierHint = String(req.query.tier || 'standard').trim();
    const tierCfgHint = TIER_CONFIG[tierHint] || TIER_CONFIG.standard;

    try {
      await runMultiUpload(req, res, tierCfgHint.maxImages);
    } catch (error) {
      return res.status(400).json(buildUploadErrorPayload(error));
    }

    const title = normalizeText(req.body.title || '', 120);
    const description = normalizeText(req.body.description || '', 1000);
    const category = String(req.body.category || '').trim();
    const price = normalizeText(req.body.price || '', 60);
    const phone = normalizeText(req.body.phone || '', 30);
    const contactName = normalizeText(req.body.contactName || '', 80);
    const tier = String(req.body.tier || 'standard').trim();

    const fieldErrors = {};
    if (!title) fieldErrors.title = 'Заглавието е задължително.';
    if (!description) fieldErrors.description = 'Описанието е задължително.';
    if (!VALID_CATEGORIES.includes(category)) fieldErrors.category = 'Невалидна категория.';
    if (!phone) fieldErrors.phone = 'Телефонът е задължителен.';
    if (!contactName) fieldErrors.contactName = 'Името за контакт е задължително.';
    if (!TIER_CONFIG[tier]) fieldErrors.tier = 'Невалиден пакет.';

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ error: 'Моля попълнете всички задължителни полета.', fieldErrors });
    }

    const tierCfg = TIER_CONFIG[tier];
    const images = [];
    const imagesMeta = [];

    const files = Array.isArray(req.files) ? req.files.slice(0, tierCfg.maxImages) : [];
    for (const file of files) {
      const result = await processUploadedFile(file);
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
      sortWeight: tierCfg.sortWeight,
      ipHash,
    });
    await doc.save();

    return res.json({
      ok: true,
      id: doc.id,
      paymentRef,
      amountDue: tierCfg.price,
      iban: '59965607',
      beneficiary: 'zNews',
      currency: '$',
    });
  });

  // ─── Public: request bump (generates payment ref) ───
  app.post('/api/classifieds/:id/bump', classifiedRateLimiter, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const now = new Date();
    const doc = await Classified.findOne({ id, status: 'active', expiresAt: { $gt: now } });
    if (!doc) return res.status(404).json({ error: 'Обявата не е намерена или не е активна.' });

    // Create a bump payment reference
    const bumpRef = generatePaymentRef();

    return res.json({
      ok: true,
      id: doc.id,
      bumpRef,
      bumpPrice: BUMP_PRICE,
      iban: '59965607',
      beneficiary: 'zNews',
      currency: '$',
      message: `Преведете $${BUMP_PRICE.toLocaleString('bg-BG')} с основание ${bumpRef} за bump на обява #${doc.id}.`,
    });
  });

  // ─── Public: request VIP renewal (50% discount) ───
  app.post('/api/classifieds/:id/renew', classifiedRateLimiter, async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const doc = await Classified.findOne({ id });
    if (!doc) return res.status(404).json({ error: 'Обявата не е намерена.' });
    if (doc.tier !== 'vip') return res.status(400).json({ error: 'Подновяването е налично само за VIP обяви.' });

    const tierCfg = TIER_CONFIG.vip;
    const renewalPrice = Math.round(tierCfg.price * RENEWAL_DISCOUNT);
    const renewRef = generatePaymentRef();

    return res.json({
      ok: true,
      id: doc.id,
      renewRef,
      renewalPrice,
      iban: '59965607',
      beneficiary: 'zNews',
      currency: '$',
      message: `Преведете $${renewalPrice.toLocaleString('bg-BG')} с основание ${renewRef} за подновяване на VIP обява #${doc.id}.`,
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

    const tierCfg = TIER_CONFIG[doc.tier] || TIER_CONFIG.standard;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tierCfg.durationDays * 24 * 60 * 60 * 1000);

    doc.status = 'active';
    doc.approvedAt = now;
    doc.bumpedAt = now;
    doc.expiresAt = expiresAt;
    doc.sortWeight = tierCfg.sortWeight;
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

    const tierCfg = TIER_CONFIG[doc.tier] || TIER_CONFIG.standard;
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
