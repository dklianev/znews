import path from 'path';

export function createStoragePathService(deps) {
  const {
    isRemoteStorage,
    storagePublicBaseUrl,
    storageUploadsPrefix,
    uploadsDir,
  } = deps;

  function toPosixRelativePath(value) {
    return String(value || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/g, '')
      .replace(/\/+/g, '/')
      .trim();
  }

  function encodePathForUrl(value) {
    return toPosixRelativePath(value)
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  function toUploadsStorageKey(relativePath) {
    const normalized = toPosixRelativePath(relativePath);
    if (!normalized) return `${storageUploadsPrefix}/`;
    return path.posix.join(storageUploadsPrefix, normalized);
  }

  function getDiskAbsolutePath(relativePath) {
    const normalized = toPosixRelativePath(relativePath);
    if (!normalized) return uploadsDir;
    return path.join(uploadsDir, ...normalized.split('/'));
  }

  function toUploadsUrlFromRelative(relativePath) {
    const normalized = toPosixRelativePath(relativePath);
    if (!normalized) return isRemoteStorage ? storagePublicBaseUrl : '/uploads';
    if (isRemoteStorage) {
      return `${storagePublicBaseUrl}/${encodePathForUrl(toUploadsStorageKey(normalized))}`;
    }
    return `/uploads/${encodePathForUrl(normalized)}`;
  }

  function getOriginalUploadUrl(fileName) {
    return toUploadsUrlFromRelative(fileName);
  }

  return {
    encodePathForUrl,
    getDiskAbsolutePath,
    getOriginalUploadUrl,
    toPosixRelativePath,
    toUploadsStorageKey,
    toUploadsUrlFromRelative,
  };
}
