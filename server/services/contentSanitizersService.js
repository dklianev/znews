export function createContentSanitizers() {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value, maxLen = 255) {
    return String(value ?? '').trim().slice(0, maxLen);
  }

  function sanitizeDate(value) {
    const date = normalizeText(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  }

  function sanitizeDateTime(value) {
    if (value === null || value === undefined || value === '') return null;
    const raw = normalizeText(String(value), 40);
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function sanitizeMediaUrl(value) {
    const url = normalizeText(value, 2048);
    if (!url) return '';
    if (url.startsWith('/')) return url;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch {}
    return '';
  }

  function sanitizeExternalUrl(value) {
    const url = normalizeText(value, 2048);
    if (!url) return '#';
    if (url === '#') return '#';
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    } catch {}
    return '#';
  }

  function sanitizeImageWidth(value) {
    const normalized = normalizeText(String(value || ''), 8).replace('%', '');
    return ['25', '50', '75', '100'].includes(normalized) ? normalized : '100';
  }

  function sanitizeImageAlign(value) {
    const normalized = normalizeText(String(value || ''), 16).toLowerCase();
    return ['left', 'center', 'right'].includes(normalized) ? normalized : 'center';
  }

  function sanitizeTags(value) {
    const rawTags = Array.isArray(value)
      ? value
      : String(value || '').split(',');
    return rawTags
      .map((tag) => normalizeText(String(tag), 32))
      .filter(Boolean)
      .slice(0, 12);
  }

  function sanitizeSafeHtml(value) {
    if (typeof value !== 'string') return '';
    let html = value.replace(/\u0000/g, '').slice(0, 50000);

    html = html.replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace(/<(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)[^>]*>[\s\S]*?<\/\1>/gi, '');
    html = html.replace(/<(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select)[^>]*\/?>/gi, '');
    html = html.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
    html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
    html = html.replace(/\sstyle\s*=\s*(['"]).*?\1/gi, '');
    html = html.replace(/\sstyle\s*=\s*[^\s>]+/gi, '');

    const allowedTags = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'hr', 'a', 'img']);

    html = html.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (fullMatch, rawTagName, rawAttrs) => {
      const tagName = rawTagName.toLowerCase();
      const isClosing = fullMatch.startsWith('</');

      if (!allowedTags.has(tagName)) return '';
      if (isClosing) return `</${tagName}>`;
      if (tagName === 'br' || tagName === 'hr') return `<${tagName}>`;
      if (tagName === 'img') {
        let src = '';
        let alt = '';
        let width = '';
        let align = '';

        const quotedSrcMatch = rawAttrs.match(/\ssrc\s*=\s*(['"])(.*?)\1/i);
        const bareSrcMatch = rawAttrs.match(/\ssrc\s*=\s*([^\s>]+)/i);
        const quotedAltMatch = rawAttrs.match(/\salt\s*=\s*(['"])(.*?)\1/i);
        const bareAltMatch = rawAttrs.match(/\salt\s*=\s*([^\s>]+)/i);
        const quotedWidthMatch = rawAttrs.match(/\sdata-width\s*=\s*(['"])(.*?)\1/i);
        const bareWidthMatch = rawAttrs.match(/\sdata-width\s*=\s*([^\s>]+)/i);
        const quotedAlignMatch = rawAttrs.match(/\sdata-align\s*=\s*(['"])(.*?)\1/i);
        const bareAlignMatch = rawAttrs.match(/\sdata-align\s*=\s*([^\s>]+)/i);

        if (quotedSrcMatch) src = quotedSrcMatch[2];
        else if (bareSrcMatch) src = bareSrcMatch[1];
        if (quotedAltMatch) alt = quotedAltMatch[2];
        else if (bareAltMatch) alt = bareAltMatch[1];
        if (quotedWidthMatch) width = quotedWidthMatch[2];
        else if (bareWidthMatch) width = bareWidthMatch[1];
        if (quotedAlignMatch) align = quotedAlignMatch[2];
        else if (bareAlignMatch) align = bareAlignMatch[1];

        const safeSrc = sanitizeMediaUrl(src);
        if (!safeSrc) return '';
        const safeAlt = normalizeText(alt, 180);
        const safeWidth = sanitizeImageWidth(width);
        const safeAlign = sanitizeImageAlign(align);
        return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(safeAlt)}" loading="lazy" decoding="async" fetchpriority="low" data-width="${escapeHtml(safeWidth)}" data-align="${escapeHtml(safeAlign)}">`;
      }
      if (tagName !== 'a') return `<${tagName}>`;

      let href = '';
      const quotedHrefMatch = rawAttrs.match(/\shref\s*=\s*(['"])(.*?)\1/i);
      const bareHrefMatch = rawAttrs.match(/\shref\s*=\s*([^\s>]+)/i);
      if (quotedHrefMatch) href = quotedHrefMatch[2];
      else if (bareHrefMatch) href = bareHrefMatch[1];

      const safeHref = sanitizeExternalUrl(href);
      if (safeHref === '#') return '<a>';

      return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">`;
    });

    return html;
  }

  return {
    normalizeText,
    sanitizeDate,
    sanitizeDateTime,
    sanitizeExternalUrl,
    sanitizeImageAlign,
    sanitizeImageWidth,
    sanitizeMediaUrl,
    sanitizeSafeHtml,
    sanitizeTags,
  };
}
