function getPathSegments(path) {
  return String(path || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function getRevisionSnapshotValue(snapshot, path) {
  return getPathSegments(path).reduce((current, segment) => {
    if (current == null) return undefined;
    return current[segment];
  }, snapshot);
}

function stableNormalize(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return `[${value.map((item) => stableNormalize(item)).join('|')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableNormalize(value[key])}`).join('|')}}`;
  }
  return String(value).trim();
}

export function normalizeRevisionCompareValue(value) {
  return stableNormalize(value);
}

export function formatRevisionDisplayValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Не';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim() || '—';
  if (Array.isArray(value) || typeof value === 'object') {
    const asJson = JSON.stringify(value, null, 2);
    return asJson && asJson !== '{}' && asJson !== '[]' ? asJson : '—';
  }
  return String(value);
}

export function buildRevisionCompare({
  fields,
  leftSnapshot,
  rightSnapshot,
  leftLabel,
  rightLabel,
}) {
  if (!leftSnapshot || !rightSnapshot || !Array.isArray(fields) || fields.length === 0) return null;

  const rows = fields.map((field) => {
    const getValue = typeof field.getValue === 'function'
      ? field.getValue
      : (snapshot) => getRevisionSnapshotValue(snapshot, field.key);
    const normalizeValue = typeof field.normalize === 'function'
      ? field.normalize
      : (value) => normalizeRevisionCompareValue(value);
    const formatValue = typeof field.format === 'function'
      ? field.format
      : (value) => formatRevisionDisplayValue(value);

    const leftValue = getValue(leftSnapshot);
    const rightValue = getValue(rightSnapshot);
    const leftRaw = normalizeValue(leftValue, leftSnapshot);
    const rightRaw = normalizeValue(rightValue, rightSnapshot);

    return {
      key: field.key,
      label: field.label,
      group: field.group || 'Други',
      changed: leftRaw !== rightRaw,
      left: formatValue(leftValue, leftSnapshot),
      right: formatValue(rightValue, rightSnapshot),
    };
  }).filter((row) => row.changed);

  return {
    leftLabel,
    rightLabel,
    rows,
  };
}
