const BULGARIAN_NEWS_DATE_FORMATTER = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Sofia',
});

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseNewsDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(Date.UTC(year, month - 1, day, 12));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatNewsDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const parsed = parseNewsDate(raw);
  if (!parsed) return raw;

  const parts = BULGARIAN_NEWS_DATE_FORMATTER.formatToParts(parsed);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;

  if (!day || !month || !year) {
    return BULGARIAN_NEWS_DATE_FORMATTER.format(parsed).replace(/\s*г\.\s*$/u, '');
  }

  return `${day} ${month} ${year}`;
}
