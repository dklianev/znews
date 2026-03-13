import { asyncHandler } from '../services/expressAsyncService.js';

const MEDIA_UPLOAD_PERMISSIONS = ['articles', 'ads', 'gallery', 'events'];

export function registerUploadRoutes(app, deps) {
  const {
    brandLogoPath,
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
  } = deps;

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

  app.post('/api/upload', requireAuth, requireAnyPermission(MEDIA_UPLOAD_PERMISSIONS), asyncHandler(async (req, res) => {
    let uploadFingerprint = null;

    try {
      try {
        await runSingleUpload(req, res);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!req.file) return res.status(400).json({ error: 'No file provided' });
      if (!Buffer.isBuffer(req.file.buffer) || req.file.buffer.byteLength === 0) {
        return res.status(400).json({ error: 'Upload buffer is empty' });
      }

      const mimeType = normalizeText(req.file.mimetype || '', 120).toLowerCase();
      const applyWatermark = parseBooleanFlag(req.body?.applyWatermark, true);
      uploadFingerprint = makeUploadFingerprint(req.file.buffer, mimeType, applyWatermark);

      const cachedPayload = getRecentUploadPayload(uploadFingerprint);
      if (cachedPayload) return res.json(cachedPayload);

      const inFlightPayload = uploadRequestInFlight.get(uploadFingerprint);
      if (inFlightPayload) {
        const payload = await inFlightPayload;
        return res.json(payload);
      }

      const processUpload = (async () => {
        const sharp = await loadSharp();
        if (!sharp) {
          const fallbackExt = imageMimeToExt[mimeType] || '.jpg';
          const fallbackName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${fallbackExt}`;

          await putStorageObject(fallbackName, req.file.buffer, mimeType || 'application/octet-stream');

          const pipelineManifest = await ensureImagePipeline(fallbackName, { sourceBuffer: req.file.buffer });
          return {
            url: getOriginalUploadUrl(fallbackName),
            imageMeta: toImageMetaFromManifest(pipelineManifest),
            pipelineReady: Boolean(pipelineManifest),
            pipelineEngine: 'disabled',
          };
        }

        const imgSharp = sharp(req.file.buffer).rotate();
        const metadata = await imgSharp.metadata();

        let finalBuffer;
        if (applyWatermark) {
          try {
            const wmWidth = Math.max(100, Math.round((metadata.width || 800) * 0.20));
            const wmBuffer = await sharp(brandLogoPath).resize({ width: wmWidth }).toBuffer();
            const wmMeta = await sharp(wmBuffer).metadata();

            const margin = Math.round((metadata.width || 800) * 0.03);
            const left = (metadata.width || 800) - (wmMeta.width || wmWidth) - margin;
            const top = (metadata.height || 600) - (wmMeta.height || wmWidth / 4) - margin;

            finalBuffer = await imgSharp
              .composite([{ input: wmBuffer, left: Math.max(0, left), top: Math.max(0, top), blend: 'over' }])
              .webp({ quality: 82, effort: 4 })
              .toBuffer();
          } catch (e) {
            console.error('Watermark failed, falling back to simple WebP:', e);
            finalBuffer = await imgSharp.webp({ quality: 82, effort: 4 }).toBuffer();
          }
        } else {
          finalBuffer = await imgSharp.webp({ quality: 82, effort: 4 }).toBuffer();
        }

        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
        await putStorageObject(fileName, finalBuffer, 'image/webp');

        const pipelineManifest = await ensureImagePipeline(fileName, { sourceBuffer: finalBuffer });
        return {
          url: getOriginalUploadUrl(fileName),
          imageMeta: toImageMetaFromManifest(pipelineManifest),
          pipelineReady: Boolean(pipelineManifest),
          pipelineEngine: 'sharp',
        };
      })();

      uploadRequestInFlight.set(uploadFingerprint, processUpload);
      const payload = await processUpload;
      rememberRecentUploadPayload(uploadFingerprint, payload);
      return res.json(payload);
    } catch (error) {
      console.error('Upload processing error:', error);
      return res.status(500).json({ error: error?.message || 'Upload failed' });
    } finally {
      if (uploadFingerprint) uploadRequestInFlight.delete(uploadFingerprint);
    }
  }));
}
