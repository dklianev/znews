export function getUploadFilenameFromMediaUrl(mediaUrl) {
  if (typeof mediaUrl !== 'string') return null;

  const trimmed = mediaUrl.trim();
  if (!trimmed) return null;

  const sourcePrefix = '/api/media/source/';
  if (trimmed.startsWith(sourcePrefix)) {
    const rawName = trimmed.slice(sourcePrefix.length).split(/[?#]/, 1)[0];
    try {
      return decodeURIComponent(rawName || '').trim() || null;
    } catch {
      return rawName || null;
    }
  }

  const marker = '/uploads/';
  let rawPath = '';

  if (trimmed.startsWith(marker)) {
    rawPath = trimmed.slice(marker.length);
  } else {
    try {
      const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex < 0) return null;
      rawPath = parsed.pathname.slice(markerIndex + marker.length);
    } catch {
      return null;
    }
  }

  const normalized = rawPath.replace(/^\/+/, '');
  if (!normalized || normalized.includes('/') || normalized.includes('\\')) return null;

  try {
    return decodeURIComponent(normalized).trim() || null;
  } catch {
    return normalized || null;
  }
}

export function getEditableMediaUrl(mediaUrl) {
  const fileName = getUploadFilenameFromMediaUrl(mediaUrl);
  if (!fileName) return typeof mediaUrl === 'string' ? mediaUrl : '';
  return '/api/media/source/' + encodeURIComponent(fileName);
}
