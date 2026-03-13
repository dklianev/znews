import { createHash } from 'node:crypto';

export function createShareCardObjectHelpers({
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
  fetchImpl = globalThis.fetch,
}) {
  async function localFileExists(filePath) {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async function fetchRemoteImageBuffer(sourceUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      const response = await fetchImpl(sourceUrl, {
        signal: controller.signal,
        headers: { Accept: 'image/*' },
      });
      if (!response.ok) return null;
      const contentType = normalizeText(response.headers.get('content-type') || '', 80).toLowerCase();
      if (!contentType.startsWith('image/')) return null;
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength < 256) return null;
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function buildShareCardStorageTarget(article, { categoryLabel = '' } = {}) {
    const normalized = {
      ...buildArticleSnapshot(article),
      id: Number.parseInt(article?.id, 10),
    };
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
    return {
      absolutePath: isRemoteStorage ? null : getDiskAbsolutePath(relativePath),
      fileName,
      imageSource,
      normalized,
      relativePath,
      url: toUploadsUrlFromRelative(relativePath),
    };
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
    return fetchRemoteImageBuffer(sourceUrl);
  }

  async function cleanupOldShareCards(articleId, keepFileName) {
    try {
      const prefix = `article-${articleId}-`;
      if (isRemoteStorage) {
        const prefixKey = toUploadsStorageKey(path.posix.join('_share', prefix));
        const objects = await listRemoteObjectsByPrefix(prefixKey);
        const staleKeys = objects
          .map((item) => String(item?.Key || ''))
          .filter(Boolean)
          .filter((key) => {
            const relative = key.startsWith(`${storageUploadsPrefix}/`) ? key.slice(`${storageUploadsPrefix}/`.length) : key;
            return !relative.endsWith(`/${keepFileName}`) && !relative.endsWith(keepFileName);
          });
        await deleteRemoteKeys(staleKeys);
        return;
      }

      const shareCardsDir = getDiskAbsolutePath('_share');
      const entries = await fs.promises.readdir(shareCardsDir, { withFileTypes: true });
      await Promise.all(entries
        .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name !== keepFileName)
        .map((entry) => fs.promises.unlink(path.join(shareCardsDir, entry.name)).catch(() => { })));
    } catch {
      // ignore cleanup errors
    }
  }

  async function persistShareCardObject(target, output) {
    await putStorageObject(target.relativePath, output, 'image/png');
    return target;
  }

  async function hasShareCardObject(target) {
    return storageObjectExists(target.relativePath);
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
      if (!(await localFileExists(fullPath))) return null;
      return { type: 'file', path: fullPath };
    }
    if (/^https?:\/\//i.test(sourceUrl)) return { type: 'redirect', url: sourceUrl };
    return null;
  }

  return {
    buildShareCardStorageTarget,
    cleanupOldShareCards,
    hasShareCardObject,
    persistShareCardObject,
    resolveShareBackgroundInput,
    resolveShareFallbackSource,
  };
}
