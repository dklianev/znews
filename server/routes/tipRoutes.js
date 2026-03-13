import { createHash } from 'crypto';
import { asyncHandler } from '../services/expressAsyncService.js';

const TIP_ADMIN_PERMISSIONS = ['articles'];

export function registerTipRoutes(app, deps) {
  const {
    Tip,
    ensureImagePipeline,
    getOriginalUploadUrl,
    getTrustedClientIp,
    imageMimeToExt,
    loadSharp,
    nextNumericId,
    normalizeText,
    putStorageObject,
    rateLimit,
    rateLimitKeyGenerator,
    requireAnyPermission,
    requireAuth,
    shouldSkipRateLimit,
    toImageMetaFromManifest,
    upload,
  } = deps;

  const tipRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { error: 'Too many tip submissions from this IP. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    keyGenerator: rateLimitKeyGenerator,
  });

  function runSingleUpload(req, res) {
    return new Promise((resolve, reject) => {
      upload.single('image')(req, res, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  app.get('/api/tips', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), asyncHandler(async (_req, res) => {
    const tips = await Tip.find().sort({ createdAt: -1 }).lean();
    res.json(tips);
  }));

  app.post('/api/tips', tipRateLimiter, asyncHandler(async (req, res) => {
    try {
      await runSingleUpload(req, res);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    let imageUrl = '';
    let imageMeta = null;

    if (req.file) {
      if (!Buffer.isBuffer(req.file.buffer) || req.file.buffer.byteLength === 0) {
        return res.status(400).json({ error: 'Upload buffer is empty' });
      }

      const sharp = await loadSharp();
      const mimeType = normalizeText(req.file.mimetype || '', 120).toLowerCase();

      let finalBuffer = req.file.buffer;
      let finalName = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      let finalMime = mimeType;

      if (sharp) {
        finalBuffer = await sharp(req.file.buffer).rotate().webp({ quality: 82, effort: 4 }).toBuffer();
        finalName += '.webp';
        finalMime = 'image/webp';
      } else {
        finalName += (imageMimeToExt[mimeType] || '.jpg');
      }

      await putStorageObject(finalName, finalBuffer, finalMime || 'application/octet-stream');
      const pipelineManifest = await ensureImagePipeline(finalName, { sourceBuffer: finalBuffer });

      imageUrl = getOriginalUploadUrl(finalName);
      imageMeta = toImageMetaFromManifest(pipelineManifest);
    }

    const text = normalizeText(req.body.text || '', 2000);
    if (!text && !imageUrl) {
      return res.status(400).json({
        error: '\u0414\u043e\u0431\u0430\u0432\u0438 \u0442\u0435\u043a\u0441\u0442 \u0438\u043b\u0438 \u0441\u043d\u0438\u043c\u043a\u0430, \u0437\u0430 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0442\u0438\u0448 \u0441\u0438\u0433\u043d\u0430\u043b\u0430.',
        fieldErrors: {
          text: '\u0414\u043e\u0431\u0430\u0432\u0438 \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u043e\u0441\u0442\u0438 \u0437\u0430 \u0441\u0438\u0433\u043d\u0430\u043b\u0430 \u0438\u043b\u0438 \u043a\u0430\u0447\u0438 \u0441\u043d\u0438\u043c\u043a\u0430.',
          image: '\u041a\u0430\u0447\u0438 \u0441\u043d\u0438\u043c\u043a\u0430, \u0430\u043a\u043e \u043d\u0435 \u0438\u0441\u043a\u0430\u0448 \u0434\u0430 \u0438\u0437\u043f\u0440\u0430\u0449\u0430\u0448 \u0442\u0435\u043a\u0441\u0442.',
        },
      });
    }

    const ipHash = createHash('sha256').update(getTrustedClientIp(req)).digest('hex');
    const tipId = await nextNumericId(Tip);

    const newTip = new Tip({
      id: tipId,
      text,
      location: normalizeText(req.body.location || '', 300),
      image: imageUrl,
      imageMeta,
      ipHash,
    });
    await newTip.save();

    return res.json({ ok: true, id: newTip.id });
  }));

  app.patch('/api/tips/:id', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['new', 'processed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const tip = await Tip.findOneAndUpdate(
      { id: Number(req.params.id) },
      { status },
      { new: true }
    );
    if (!tip) return res.status(404).json({ error: 'Not found' });
    res.json(tip);
  }));

  app.delete('/api/tips/:id', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), asyncHandler(async (req, res) => {
    const tip = await Tip.findOneAndDelete({ id: Number(req.params.id) });
    if (!tip) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  }));
}
