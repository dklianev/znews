import fs from 'fs';
import path from 'path';

export function createImagePipelineService(deps) {
  const {
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
    logError = console.error,
    putStorageObject,
    toUploadsStorageKey,
    toUploadsUrlFromRelative,
    uploadsDir,
  } = deps;

  const imagePipelineBackfillInFlight = new Map();
  const MEDIA_LIBRARY_SNAPSHOT_TTL_MS = 15 * 1000;
  let mediaLibrarySnapshotCache = null;
  let mediaLibrarySnapshotExpiresAt = 0;
  let mediaLibrarySnapshotInFlight = null;
  let mediaLibrarySnapshotEpoch = 0;

  function invalidateMediaLibrarySnapshot() {
    mediaLibrarySnapshotCache = null;
    mediaLibrarySnapshotExpiresAt = 0;
    mediaLibrarySnapshotInFlight = null;
    mediaLibrarySnapshotEpoch += 1;
  }

  function getVariantRelativePath(fileName, variantFileName) {
    return path.posix.join(getVariantsRelativeDir(fileName), variantFileName);
  }

  function getVariantUrl(fileName, variantFileName) {
    return toUploadsUrlFromRelative(getVariantRelativePath(fileName, variantFileName));
  }

  function normalizePipelineWidths(sourceWidth) {
    return [...new Set(
      imagePipelineWidths
        .map((width) => sourceWidth ? Math.min(width, sourceWidth) : width)
        .filter((width) => Number.isFinite(width) && width > 0)
    )].sort((a, b) => a - b);
  }

  async function listRemoteOriginalUploadEntries() {
    const prefixKey = toUploadsStorageKey('');
    const objects = await listRemoteObjectsByPrefix(prefixKey);
    return objects
      .map((item) => {
        const key = String(item?.Key || '');
        if (!key.startsWith(prefixKey)) return null;
        const relativePath = key.slice(prefixKey.length);
        if (!relativePath || relativePath.includes('/')) return null;
        const ext = path.extname(relativePath).toLowerCase();
        if (!allowedImageExtensions.has(ext)) return null;
        if (!isOriginalUploadFileName(relativePath)) return null;
        return {
          name: relativePath,
          size: Number(item.Size) || 0,
          updatedAt: item.LastModified ? new Date(item.LastModified).toISOString() : new Date(0).toISOString(),
        };
      })
      .filter(Boolean);
  }

  async function listLocalOriginalUploadEntries() {
    const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
    const mapped = await Promise.all(entries.map(async (entry) => {
      if (!entry.isFile()) return null;
      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedImageExtensions.has(ext)) return null;
      if (!isOriginalUploadFileName(entry.name)) return null;
      const stats = await fs.promises.stat(path.join(uploadsDir, entry.name));
      return {
        name: entry.name,
        size: stats.size,
        updatedAt: stats.mtime.toISOString(),
      };
    }));
    return mapped.filter(Boolean);
  }

  async function readImageManifest(fileName) {
    try {
      if (!fileName || !isOriginalUploadFileName(fileName)) return null;
      let raw = '';
      if (isRemoteStorage) {
        const buffer = await getStorageObjectBuffer(getManifestRelativePath(fileName));
        if (!buffer) return null;
        raw = buffer.toString('utf8');
      } else {
        raw = await fs.promises.readFile(getManifestAbsolutePath(fileName), 'utf8');
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async function writeImageManifest(fileName, manifest) {
    if (!fileName || !isOriginalUploadFileName(fileName)) return;
    const payload = JSON.stringify(manifest, null, 2);
    if (isRemoteStorage) {
      await putStorageObject(getManifestRelativePath(fileName), payload, 'application/json; charset=utf-8');
      return;
    }
    const dir = getVariantsAbsoluteDir(fileName);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, 'manifest.json'), payload, 'utf8');
  }

  async function readOriginalUploadBuffer(fileName) {
    return getStorageObjectBuffer(fileName);
  }

  async function generateImagePipeline(fileName, { sourceBuffer = null } = {}) {
    if (!fileName || !isOriginalUploadFileName(fileName)) return null;
    const sharp = await loadSharp();
    if (!sharp) return null;

    const originalBuffer = sourceBuffer || await readOriginalUploadBuffer(fileName);
    if (!originalBuffer) return null;

    const source = sharp(originalBuffer, { failOn: 'none' }).rotate();
    const meta = await source.metadata();
    const sourceWidth = Number(meta.width) || null;
    const sourceHeight = Number(meta.height) || null;

    const widths = normalizePipelineWidths(sourceWidth);

    const variants = [];
    for (const width of widths) {
      const webpName = `w${width}.webp`;
      const avifName = `w${width}.avif`;
      const webpBuffer = await sharp(originalBuffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
      const avifBuffer = await sharp(originalBuffer).rotate().resize({ width, withoutEnlargement: true }).avif({ quality: 52 }).toBuffer();
      await putStorageObject(getVariantRelativePath(fileName, webpName), webpBuffer, 'image/webp');
      await putStorageObject(getVariantRelativePath(fileName, avifName), avifBuffer, 'image/avif');

      variants.push({
        width,
        webp: getVariantUrl(fileName, webpName),
        avif: getVariantUrl(fileName, avifName),
      });
    }

    const blurName = 'blur.webp';
    const blurBuffer = await sharp(originalBuffer).rotate().resize({ width: 32, withoutEnlargement: true }).blur(2).webp({ quality: 48 }).toBuffer();
    await putStorageObject(getVariantRelativePath(fileName, blurName), blurBuffer, 'image/webp');

    const manifest = {
      generatedAt: new Date().toISOString(),
      original: {
        url: getOriginalUploadUrl(fileName),
        width: sourceWidth,
        height: sourceHeight,
        format: meta.format || '',
      },
      placeholder: getVariantUrl(fileName, blurName),
      variants,
    };

    await writeImageManifest(fileName, manifest);
    invalidateMediaLibrarySnapshot();
    return manifest;
  }

  async function ensureImagePipeline(fileName, options = {}) {
    const existing = await readImageManifest(fileName);
    if (existing) return existing;
    try {
      return await generateImagePipeline(fileName, options);
    } catch {
      return null;
    }
  }

  function toImageMetaFromManifest(manifest) {
    if (!manifest || !Array.isArray(manifest.variants) || manifest.variants.length === 0) return null;
    return {
      width: Number(manifest.original?.width) || null,
      height: Number(manifest.original?.height) || null,
      placeholder: typeof manifest.placeholder === 'string' ? manifest.placeholder : '',
      webp: manifest.variants
        .filter(item => Number.isFinite(item.width) && typeof item.webp === 'string')
        .map(item => ({ width: item.width, url: item.webp })),
      avif: manifest.variants
        .filter(item => Number.isFinite(item.width) && typeof item.avif === 'string')
        .map(item => ({ width: item.width, url: item.avif })),
    };
  }

  function extractUploadsRelativePathFromUrl(mediaUrl) {
    if (typeof mediaUrl !== 'string') return '';
    const marker = '/uploads/';
    let raw = '';

    if (mediaUrl.startsWith(marker)) {
      raw = mediaUrl.slice(marker.length);
    } else {
      try {
        const parsed = new URL(mediaUrl);
        const markerIndex = parsed.pathname.indexOf(marker);
        if (markerIndex < 0) return '';
        raw = parsed.pathname.slice(markerIndex + marker.length);
      } catch {
        return '';
      }
    }

    try {
      let normalized = decodeURIComponent(raw).replace(/^\/+/, '');
      while (normalized.toLowerCase().startsWith('uploads/')) {
        normalized = normalized.slice('uploads/'.length);
      }
      return normalized;
    } catch {
      return '';
    }
  }

  function getUploadFilenameFromUrl(mediaUrl) {
    const raw = extractUploadsRelativePathFromUrl(mediaUrl);
    if (!raw || raw.includes('/') || raw.includes('\\')) return null;
    const fileName = path.basename(raw);
    if (!isOriginalUploadFileName(fileName)) return null;
    return fileName;
  }

  function getCandidateMediaUrlsForFile(fileName) {
    if (!fileName || !isOriginalUploadFileName(fileName)) return [];
    return [...new Set([
      `/uploads/${fileName}`,
      `/uploads/${encodeURIComponent(fileName)}`,
      getOriginalUploadUrl(fileName),
    ].filter(Boolean))];
  }

  async function syncStoredImageMetaForFile(fileName, { force = false } = {}) {
    if (!fileName || !isOriginalUploadFileName(fileName)) {
      return { articles: 0, tips: 0 };
    }

    const manifest = await readImageManifest(fileName);
    const imageMeta = toImageMetaFromManifest(manifest);
    if (!imageMeta) {
      return { articles: 0, tips: 0 };
    }

    const candidateMediaUrls = getCandidateMediaUrlsForFile(fileName);
    const filter = force
      ? { image: { $in: candidateMediaUrls } }
      : {
        image: { $in: candidateMediaUrls },
        $or: [
          { imageMeta: { $exists: false } },
          { imageMeta: null },
        ],
      };

    const [articleResult, tipResult] = await Promise.all([
      Article.updateMany(filter, { $set: { imageMeta } }),
      Tip.updateMany(filter, { $set: { imageMeta } }),
    ]);

    return {
      articles: Number(articleResult?.modifiedCount) || 0,
      tips: Number(tipResult?.modifiedCount) || 0,
    };
  }

  function queueImagePipelineBackfillForFile(fileName, { force = false } = {}) {
    if (!fileName || !isOriginalUploadFileName(fileName)) return Promise.resolve(null);
    const key = `${fileName}:${force ? 'force' : 'soft'}`;
    if (imagePipelineBackfillInFlight.has(key)) {
      return imagePipelineBackfillInFlight.get(key);
    }

    const task = (async () => {
      const manifest = force
        ? await generateImagePipeline(fileName)
        : await ensureImagePipeline(fileName);
      if (!manifest) return null;
      await syncStoredImageMetaForFile(fileName, { force: true });
      return manifest;
    })()
      .catch((error) => {
        logError('Image pipeline async backfill failed:', error?.message || error);
        return null;
      })
      .finally(() => {
        imagePipelineBackfillInFlight.delete(key);
      });

    imagePipelineBackfillInFlight.set(key, task);
    return task;
  }

  function queueImagePipelineBackfillForUrl(mediaUrl, options = {}) {
    const fileName = getUploadFilenameFromUrl(mediaUrl);
    if (!fileName) return Promise.resolve(null);
    return queueImagePipelineBackfillForFile(fileName, options);
  }

  async function resolveImageMetaFromUrl(mediaUrl, { queueIfMissing = false } = {}) {
    const fileName = getUploadFilenameFromUrl(mediaUrl);
    if (!fileName) return null;
    const manifest = await readImageManifest(fileName);
    if (!manifest && queueIfMissing) {
      void queueImagePipelineBackfillForFile(fileName);
    }
    return toImageMetaFromManifest(manifest);
  }

  async function listOriginalUploadEntries() {
    if (isRemoteStorage) {
      return listRemoteOriginalUploadEntries();
    }
    return listLocalOriginalUploadEntries();
  }

  async function listRemoteManifestDirectories() {
    const prefixKey = toUploadsStorageKey('_variants/');
    const objects = await listRemoteObjectsByPrefix(prefixKey);
    const manifestDirs = new Set();

    objects.forEach((item) => {
      const key = String(item?.Key || '');
      if (!key.startsWith(prefixKey)) return;
      const relativePath = key.slice(prefixKey.length);
      if (!relativePath.endsWith('/manifest.json')) return;
      const dirName = relativePath.slice(0, -'/manifest.json'.length).replace(/\/+$/, '');
      if (!dirName || dirName.includes('/')) return;
      manifestDirs.add(dirName);
    });

    return manifestDirs;
  }

  async function listLocalManifestDirectories() {
    const variantsDir = path.join(uploadsDir, '_variants');
    try {
      const entries = await fs.promises.readdir(variantsDir, { withFileTypes: true });
      const manifestDirs = new Set();

      await Promise.all(entries.map(async (entry) => {
        if (!entry.isDirectory()) return;
        try {
          await fs.promises.access(path.join(variantsDir, entry.name, 'manifest.json'), fs.constants.R_OK);
          manifestDirs.add(entry.name);
        } catch {
          // Ignore directories without a readable manifest.
        }
      }));

      return manifestDirs;
    } catch (error) {
      if (error?.code === 'ENOENT') return new Set();
      throw error;
    }
  }

  async function listManifestDirectories() {
    if (isRemoteStorage) {
      return listRemoteManifestDirectories();
    }
    return listLocalManifestDirectories();
  }

  async function buildMediaLibrarySnapshot() {
    const [entries, manifestDirs] = await Promise.all([
      listOriginalUploadEntries(),
      listManifestDirectories(),
    ]);
    const engine = await getPipelineEngineName();
    const items = entries.map((entry) => {
      const manifestDirName = path.parse(entry.name).name;
      return {
        id: entry.name,
        name: entry.name,
        url: getOriginalUploadUrl(entry.name),
        size: entry.size,
        updatedAt: entry.updatedAt,
        imageMeta: null,
        pipelineReady: manifestDirs.has(manifestDirName),
        pipelineEngine: engine,
      };
    });

    const ready = items.reduce((count, item) => count + (item.pipelineReady ? 1 : 0), 0);
    const total = items.length;

    return {
      items: items
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
      pipelineStatus: {
        total,
        ready,
        pending: Math.max(total - ready, 0),
        engine,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  async function getMediaLibrarySnapshot({ force = false } = {}) {
    const now = Date.now();
    if (!force && mediaLibrarySnapshotCache && mediaLibrarySnapshotExpiresAt > now) {
      return mediaLibrarySnapshotCache;
    }

    if (!force && mediaLibrarySnapshotInFlight) {
      return mediaLibrarySnapshotInFlight;
    }

    const startEpoch = mediaLibrarySnapshotEpoch;
    const task = buildMediaLibrarySnapshot()
      .then((snapshot) => {
        if (startEpoch !== mediaLibrarySnapshotEpoch) {
          return snapshot;
        }
        mediaLibrarySnapshotCache = snapshot;
        mediaLibrarySnapshotExpiresAt = Date.now() + MEDIA_LIBRARY_SNAPSHOT_TTL_MS;
        return snapshot;
      })
      .finally(() => {
        if (mediaLibrarySnapshotInFlight === task) {
          mediaLibrarySnapshotInFlight = null;
        }
      });

    mediaLibrarySnapshotInFlight = task;
    return task;
  }

  async function getPipelineEngineName() {
    const sharp = await loadSharp();
    return sharp ? 'sharp' : 'disabled';
  }

  async function getImagePipelineStatus() {
    return (await getMediaLibrarySnapshot()).pipelineStatus;
  }

  async function backfillImagePipeline({ force = false, limit = 0 } = {}) {
    invalidateMediaLibrarySnapshot();
    const entries = await listOriginalUploadEntries();
    const scopedEntries = Number.isInteger(limit) && limit > 0
      ? entries.slice(0, limit)
      : entries;
    const engine = await getPipelineEngineName();
    const summary = {
      engine,
      force: Boolean(force),
      scanned: entries.length,
      total: scopedEntries.length,
      generated: 0,
      regenerated: 0,
      skipped: 0,
      failed: 0,
      syncedArticleMeta: 0,
      syncedTipMeta: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    if (engine === 'disabled') {
      summary.finishedAt = new Date().toISOString();
      return summary;
    }

    for (const entry of scopedEntries) {
      try {
        const before = await readImageManifest(entry.name);
        if (before && !force) {
          summary.skipped += 1;
          const syncSummary = await syncStoredImageMetaForFile(entry.name);
          summary.syncedArticleMeta += syncSummary.articles;
          summary.syncedTipMeta += syncSummary.tips;
          continue;
        }

        const manifest = force
          ? await generateImagePipeline(entry.name)
          : await ensureImagePipeline(entry.name);

        if (manifest) {
          if (before) summary.regenerated += 1;
          else summary.generated += 1;
          const syncSummary = await syncStoredImageMetaForFile(entry.name, { force: true });
          summary.syncedArticleMeta += syncSummary.articles;
          summary.syncedTipMeta += syncSummary.tips;
        } else {
          summary.failed += 1;
        }
      } catch {
        summary.failed += 1;
      }
    }

    summary.finishedAt = new Date().toISOString();
    invalidateMediaLibrarySnapshot();
    return summary;
  }

  async function listMediaFiles() {
    return (await getMediaLibrarySnapshot()).items;
  }

  return {
    backfillImagePipeline,
    ensureImagePipeline,
    getMediaLibrarySnapshot,
    getImagePipelineStatus,
    getUploadFilenameFromUrl,
    invalidateMediaLibrarySnapshot,
    listMediaFiles,
    readOriginalUploadBuffer,
    resolveImageMetaFromUrl,
    toImageMetaFromManifest,
  };
}
