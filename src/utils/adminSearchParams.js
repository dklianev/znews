export function readSearchParam(searchParams, key, fallback = '') {
  const value = searchParams?.get?.(key);
  return typeof value === 'string' ? value : fallback;
}

export function readEnumSearchParam(searchParams, key, allowedValues, fallback) {
  const value = readSearchParam(searchParams, key, fallback);
  return allowedValues.includes(value) ? value : fallback;
}

export function readPositiveIntSearchParam(searchParams, key, fallback = 1) {
  const value = Number.parseInt(readSearchParam(searchParams, key, ''), 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function buildAdminSearchParams(currentSearchParams, updates) {
  const next = new URLSearchParams(currentSearchParams);

  Object.entries(updates).forEach(([key, value]) => {
    if (typeof value !== 'string') {
      next.delete(key);
      return;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed === 'all') {
      next.delete(key);
      return;
    }

    next.set(key, trimmed);
  });

  return next;
}
