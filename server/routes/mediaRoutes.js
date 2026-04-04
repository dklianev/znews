import path from 'path';

const MEDIA_PERMISSIONS = ['articles', 'ads', 'gallery', 'events'];

export function registerMediaRoutes(app, deps) {
  const {
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
    readOriginalUploadBuffer,
    requireAnyPermission,
    requireAuth,
    storageObjectExists,
  } = deps;

  const mediaAccess = [requireAuth, requireAnyPermission(MEDIA_PERMISSIONS)];

  app.get('/api/media', ...mediaAccess, async (_req, res) => {
    const files = await listMediaFiles();
    return res.json(files);
  });

  app.get('/api/media/source/:fileName', ...mediaAccess, async (req, res) => {
    try {
      const decoded = decodeURIComponent(req.params.fileName || '');
      const fileName = path.basename(decoded);
      if (!isOriginalUploadFileName(fileName)) return res.status(400).json({ error: 'Invalid filename' });

      const buffer = await readOriginalUploadBuffer(fileName);
      if (!buffer || !buffer.byteLength) return res.status(404).json({ error: 'File not found' });

      res.set('Cache-Control', isProd ? 'public, max-age=31536000, immutable' : 'no-store');
      res.type(fileName);
      return res.send(buffer);
    } catch (error) {
      if (error?.code === 'ENOENT' || isStorageNotFoundError(error)) {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  });

  app.get('/api/media/pipeline/status', ...mediaAccess, async (_req, res) => {
    const status = await getImagePipelineStatus();
    return res.json(status);
  });

  app.post('/api/media/pipeline/backfill', ...mediaAccess, async (req, res) => {
    const force = Boolean(req.body?.force);
    const parsedLimit = Number.parseInt(req.body?.limit, 10);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 5000)
      : 0;
    const summary = await backfillImagePipeline({ force, limit });
    return res.json(summary);
  });

  app.delete('/api/media/:fileName', ...mediaAccess, async (req, res) => {
    try {
      const decoded = decodeURIComponent(req.params.fileName || '');
      const fileName = path.basename(decoded);
      if (!isOriginalUploadFileName(fileName)) return res.status(400).json({ error: 'Invalid filename' });
      const candidateMediaUrls = [...new Set([
        `/uploads/${encodeURIComponent(fileName)}`,
        getOriginalUploadUrl(fileName),
      ])];

      const escapedContentUrls = candidateMediaUrls
        .map((candidateUrl) => String(candidateUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .filter(Boolean);
      const contentUsageRegex = escapedContentUrls.length > 0
        ? new RegExp(escapedContentUrls.join('|'))
        : null;

      const [articleUse, articleContentUse, adUse, galleryUse, eventUse] = await Promise.all([
        Article.exists({ image: { $in: candidateMediaUrls } }),
        contentUsageRegex ? Article.exists({ content: contentUsageRegex }) : Promise.resolve(false),
        Ad.exists({ image: { $in: candidateMediaUrls } }),
        Gallery.exists({ image: { $in: candidateMediaUrls } }),
        Event.exists({ image: { $in: candidateMediaUrls } }),
      ]);

      if (articleUse || articleContentUse || adUse || galleryUse || eventUse) {
        return res.status(409).json({ error: 'File is used in content and cannot be deleted' });
      }

      const exists = await storageObjectExists(fileName);
      if (!exists) return res.status(404).json({ error: 'File not found' });

      await deleteStorageObject(fileName);
      await deleteStoragePrefix(getVariantsRelativeDir(fileName));
      return res.json({ ok: true });
    } catch (error) {
      if (error?.code === 'ENOENT' || isStorageNotFoundError(error)) {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  });
}
