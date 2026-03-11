export function createContentSharedHelpers({ normalizeText }) {
  const allowedShareAccentValues = new Set(['auto', 'red', 'orange', 'yellow', 'purple', 'blue', 'emerald']);

  function sanitizeShareAccent(value) {
    const accent = normalizeText(value, 20).toLowerCase();
    return allowedShareAccentValues.has(accent) ? accent : 'auto';
  }

  function snapshotsEqual(left, right) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  return {
    sanitizeShareAccent,
    snapshotsEqual,
  };
}
