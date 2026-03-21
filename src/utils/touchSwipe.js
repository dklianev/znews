function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getSwipeDirection(start, end, threshold = 20) {
  if (!start || !end) return null;

  const startX = toNumber(start.x);
  const startY = toNumber(start.y);
  const endX = toNumber(end.x);
  const endY = toNumber(end.y);
  if (startX === null || startY === null || endX === null || endY === null) return null;

  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;

  return Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up');
}
