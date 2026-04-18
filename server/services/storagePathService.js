import path from 'path';

export function createStoragePathService(deps) {
  const {
    isRemoteStorage,
    storagePublicBaseUrl,
    storageUploadsPrefix,
    uploadsDir,
  } = deps;
  const normalizedStoragePublicBaseUrl = String(storagePublicBaseUrl || '').trim().replace(/\/+$/, '');
  const normalizedUploadsPrefix = String(storageUploadsPrefix || 'uploads')
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '')
    .replace(/\/+/g, '/')
    .trim()
    .toLowerCase();

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

  function toUploadsRelativePath(relativePath) {
    let normalized = toPosixRelativePath(relativePath);
    const prefix = normalizedUploadsPrefix ? `${normalizedUploadsPrefix}/` : '';
    while (prefix && normalized.toLowerCase().startsWith(prefix)) {
      normalized = normalized.slice(prefix.length);
    }
    return normalized;
  }

  function toUploadsStorageKey(relativePath) {
    const normalized = toUploadsRelativePath(relativePath);
    const prefix = normalizedUploadsPrefix || 'uploads';
    if (!normalized) return `${prefix}/`;
    return path.posix.join(prefix, normalized);
  }

  function getDiskAbsolutePath(relativePath) {
    const normalized = toUploadsRelativePath(relativePath);
    if (!normalized) return uploadsDir;
    return path.join(uploadsDir, ...normalized.split('/'));
  }

  function toUploadsUrlFromRelative(relativePath) {
    const normalized = toUploadsRelativePath(relativePath);
    if (!normalized) return isRemoteStorage ? normalizedStoragePublicBaseUrl : '/uploads';
    if (isRemoteStorage) {
      const remotePath = normalizedStoragePublicBaseUrl.toLowerCase().endsWith(`/${normalizedUploadsPrefix}`)
        ? normalized
        : toUploadsStorageKey(normalized);
      return `${normalizedStoragePublicBaseUrl}/${encodePathForUrl(remotePath)}`;
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
