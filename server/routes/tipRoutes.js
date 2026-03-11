import { createHash } from 'crypto';

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
    publicError,
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

  app.get('/api/tips', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), async (_req, res) => {
    try {
      const tips = await Tip.find().sort({ createdAt: -1 }).lean();
      res.json(tips);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.post('/api/tips', tipRateLimiter, (req, res) => {
    upload.single('image')(req, res, async (err) => {
      try {
        if (err) return res.status(400).json({ error: err.message });

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
          return res.status(400).json({ error: 'Моля, добавете текст или снимка към сигнала.' });
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

        res.json({ ok: true, id: newTip.id });
      } catch (e) {
        res.status(500).json({ error: publicError(e) });
      }
    });
  });

  app.patch('/api/tips/:id', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), async (req, res) => {
    try {
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
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });

  app.delete('/api/tips/:id', requireAuth, requireAnyPermission(TIP_ADMIN_PERMISSIONS), async (req, res) => {
    try {
      const tip = await Tip.findOneAndDelete({ id: Number(req.params.id) });
      if (!tip) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });
}
