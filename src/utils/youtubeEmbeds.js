function normalizeYouTubeId(candidate) {
  const value = String(candidate || '').trim();
  return /^[\w-]{11}$/.test(value) ? value : null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveCurrentArticleIdFromLocation() {
  if (typeof window === 'undefined') return '';
  const segments = String(window.location?.pathname || '')
    .split('/')
    .filter(Boolean);
  return segments[segments.length - 1] || '';
}

export function isCefYouTubeFallbackEnvironment(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /CitizenFX|Chrome\/103\.0/i.test(String(userAgent || ''));
}

export function extractYouTubeId(url) {
  if (!url) return null;

  try {
    const parsed = new URL(String(url), 'https://znews.live');
    const host = parsed.hostname.toLowerCase();

    if (host.includes('youtu.be')) {
      return normalizeYouTubeId(parsed.pathname.split('/').filter(Boolean)[0]);
    }

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const vParam = normalizeYouTubeId(parsed.searchParams.get('v'));
      if (vParam) return vParam;

      const segments = parsed.pathname.split('/').filter(Boolean);
      const embedIndex = segments.findIndex((segment) => ['embed', 'v', 'shorts', 'live'].includes(segment));
      if (embedIndex !== -1) {
        return normalizeYouTubeId(segments[embedIndex + 1]);
      }
    }
  } catch {
    // Fall through to the regex parser below.
  }

  const match = String(url).match(/^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/i);
  return normalizeYouTubeId(match?.[1]);
}

export function getYouTubePosterUrl(videoId, thumbnailUrl) {
  return thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export function getYouTubeThumbnailAlt(title) {
  return title ? `Миниатюра на видеото ${title}` : 'Миниатюра на видеото';
}

export function getYouTubeUnavailableMessageParts(articleId) {
  const resolvedArticleId = String(articleId || resolveCurrentArticleIdFromLocation()).trim();
  const articlePath = resolvedArticleId ? `znews.live/article/${resolvedArticleId}` : 'znews.live';

  return {
    heading: 'Видео плейърът е недостъпен',
    articlePath,
    prefix: 'Поради ограничения на устройствата, закупени от DigitalDen, YouTube не се поддържа тук. Моля, отворете',
    suffix: 'от друг браузър.',
  };
}

export function buildYouTubeCefFallbackMarkup({ articleId, title, thumbnailUrl, videoId }) {
  const message = getYouTubeUnavailableMessageParts(articleId);
  const posterUrl = getYouTubePosterUrl(videoId, thumbnailUrl);
  const alt = getYouTubeThumbnailAlt(title);

  return `
    <div class="not-prose relative my-6 w-full overflow-hidden rounded bg-black" style="box-shadow: 4px 4px 0 #1C1428; border: 4px solid #1C1428; min-height: 16rem;">
      <img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(alt)}" class="absolute inset-0 h-full w-full object-cover opacity-20" loading="lazy" decoding="async" />
      <div class="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
        <p class="mb-1 font-display text-2xl uppercase tracking-wide text-zn-hot drop-shadow-md">${escapeHtml(message.heading)}</p>
        <p class="max-w-sm text-sm text-white/80 drop-shadow">
          ${escapeHtml(message.prefix)}
          <span class="font-bold text-white"> ${escapeHtml(message.articlePath)} </span>
          ${escapeHtml(message.suffix)}
        </p>
      </div>
    </div>
  `.trim();
}

export function replaceInlineYouTubeIframesWithFallback(root, articleId) {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll('iframe').forEach((iframe) => {
    const src = iframe.getAttribute('src') || '';
    const videoId = extractYouTubeId(src);
    if (!videoId) return;

    const markup = buildYouTubeCefFallbackMarkup({
      articleId,
      title: iframe.getAttribute('title') || '',
      videoId,
    });

    const container = iframe.ownerDocument.createElement('div');
    container.innerHTML = markup;
    iframe.replaceWith(...Array.from(container.childNodes));
  });
}
