function normalizeFrameAncestorToken(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (/^none$/i.test(normalized) || normalized === "'none'") return "'none'";
  if (/^self$/i.test(normalized) || normalized === "'self'") return "'self'";
  if (normalized === '*') return '*';
  return normalized;
}

function normalizeFrameAncestors(value, fallback = ['*']) {
  const rawTokens = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((token) => token.trim());

  const tokens = rawTokens
    .map((token) => normalizeFrameAncestorToken(token))
    .filter(Boolean);

  if (tokens.includes("'none'")) return ["'none'"];

  const uniqueTokens = [...new Set(tokens)];
  return uniqueTokens.length ? uniqueTokens : [...fallback];
}

function normalizePathname(value) {
  const pathname = String(value || '').trim() || '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function createFramePolicyHelpers({
  publicFrameAncestors = process.env.PUBLIC_FRAME_ANCESTORS,
} = {}) {
  const normalizedPublicFrameAncestors = normalizeFrameAncestors(publicFrameAncestors, ['*']);

  function isProtectedFramePath(pathname) {
    const normalizedPathname = normalizePathname(pathname).toLowerCase();
    return normalizedPathname === '/admin'
      || normalizedPathname.startsWith('/admin/')
      || normalizedPathname === '/api'
      || normalizedPathname.startsWith('/api/');
  }

  function getFrameAncestorsForPath(pathname) {
    if (isProtectedFramePath(pathname)) return ["'none'"];
    return [...normalizedPublicFrameAncestors];
  }

  function getFrameAncestorsDirectiveValue(reqOrPath) {
    const pathname = typeof reqOrPath === 'string'
      ? reqOrPath
      : reqOrPath?.path || reqOrPath?.originalUrl || '/';
    return getFrameAncestorsForPath(pathname).join(' ');
  }

  return {
    getFrameAncestorsDirectiveValue,
    getFrameAncestorsForPath,
    isProtectedFramePath,
    normalizeFrameAncestorToken,
    publicFrameAncestors: [...normalizedPublicFrameAncestors],
  };
}
