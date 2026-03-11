export function createShareCardHelpers({
  normalizeText,
  sanitizeMediaUrl,
  sanitizeShareAccent,
  shareCardHeight,
  shareCardWidth,
}) {
  const shareAccentPalettes = Object.freeze({
    red: { primary: '#ef1f1f', secondary: '#ff8a2a', ink: '#25162f' },
    orange: { primary: '#ff4d00', secondary: '#ffb22b', ink: '#25162f' },
    yellow: { primary: '#ffd548', secondary: '#ff8d22', ink: '#25162f' },
    purple: { primary: '#6d26ff', secondary: '#ff4b45', ink: '#25162f' },
    blue: { primary: '#185dff', secondary: '#28b0ff', ink: '#25162f' },
    emerald: { primary: '#00a872', secondary: '#6fd430', ink: '#25162f' },
  });

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripHtmlToText(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function clampText(value, maxLen) {
    const text = normalizeText(value, maxLen + 10);
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(0, maxLen - 1)).trim()}...`;
  }

  function appendEllipsis(value, maxLen) {
    const text = String(value || '').trim();
    if (!text) return '...';
    if (text.endsWith('...')) return text;
    if (text.length >= Math.max(1, maxLen - 3)) {
      return `${text.slice(0, Math.max(1, maxLen - 3)).trim()}...`;
    }
    return `${text}...`;
  }

  function wrapTextLines(value, maxCharsPerLine, maxLines) {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
  
    const lines = [];
    let current = '';
    let truncated = false;
  
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      if (word.length > maxCharsPerLine) {
        if (current) lines.push(current);
        current = '';
        lines.push(clampText(word, maxCharsPerLine));
        if (lines.length >= maxLines) {
          truncated = i < words.length - 1;
          break;
        }
        continue;
      }
  
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    }
  
    if (current && lines.length < maxLines) {
      lines.push(current);
    }
  
    if (lines.length > maxLines) {
      lines.length = maxLines;
      truncated = true;
    }
    if (truncated && lines.length > 0) {
      lines[lines.length - 1] = appendEllipsis(lines[lines.length - 1], Math.max(4, maxCharsPerLine));
    }
    return lines;
  }

  function resolveAutoShareAccent(article) {
    if (article.breaking) return 'red';
    switch (article.category) {
      case 'crime':
      case 'underground':
        return 'purple';
      case 'emergency':
        return 'red';
      case 'reportage':
      case 'business':
        return 'orange';
      case 'sports':
        return 'blue';
      case 'society':
        return 'yellow';
      default:
        return 'orange';
    }
  }

  function resolveSharePalette(article) {
    const accent = sanitizeShareAccent(article.shareAccent);
    const resolvedAccent = accent === 'auto' ? resolveAutoShareAccent(article) : accent;
    return shareAccentPalettes[resolvedAccent] || shareAccentPalettes.orange;
  }

  function getShareSourceUrl(article) {
    const shareImage = sanitizeMediaUrl(article?.shareImage);
    if (shareImage && shareImage !== '#') return shareImage;
    const image = sanitizeMediaUrl(article?.image);
    if (image && image !== '#') return image;
    return '';
  }

  function buildShareCardModel(article, categoryLabel) {
    const palette = resolveSharePalette(article);
    const normalizedTitle = normalizeText(article.shareTitle || article.title, 140) || 'zNews.live';
    const normalizedSubtitle = normalizeText(
      article.shareSubtitle || stripHtmlToText(article.excerpt || article.content || ''),
      130
    ) || 'Ексклузивни новини от града.';
    const normalizedBadge = normalizeText(
      article.shareBadge || (article.breaking ? 'ИЗВЪНРЕДНО' : 'EXCLUSIVE'),
      36
    ).toUpperCase();
    const titleLines = wrapTextLines(normalizedTitle.toUpperCase(), 18, 3);
    const subtitleLines = wrapTextLines(normalizedSubtitle, 34, 2);
    const category = normalizeText(categoryLabel || article.category || 'news', 40).replace(/[_-]+/g, ' ').toUpperCase();
    const dateLabel = normalizeText(article.date, 20);
    const maxTitleLen = titleLines.reduce((max, line) => Math.max(max, line.length), 0);
    const titleBaseFontSize = titleLines.length <= 1 ? 100 : titleLines.length === 2 ? 86 : 72;
    const titleFitRatio = Math.min(1, 18 / Math.max(10, maxTitleLen));
    const titleFontSize = Math.max(58, Math.round(titleBaseFontSize * titleFitRatio));
    const titleLineHeight = titleLines.length <= 1 ? 0 : Math.max(56, Math.round(titleFontSize * 0.93));
  
    const maxSubtitleLen = subtitleLines.reduce((max, line) => Math.max(max, line.length), 0);
    const subtitleBaseFontSize = subtitleLines.length > 1 ? 33 : 36;
    const subtitleFitRatio = Math.min(1, 30 / Math.max(12, maxSubtitleLen));
    const subtitleFontSize = Math.max(22, Math.round(subtitleBaseFontSize * subtitleFitRatio));
    const subtitleLineHeight = subtitleLines.length > 1 ? Math.max(28, Math.round(subtitleFontSize * 1.12)) : 0;
    const badgeFontSize = Math.max(36, Math.min(52, Math.round(560 / Math.max(8, normalizedBadge.length + 2))));
    const badgeWidth = Math.max(246, Math.min(410, Math.round(74 + normalizedBadge.length * (badgeFontSize * 0.62))));
    const badgeHeight = Math.max(62, Math.min(76, Math.round(badgeFontSize + 20)));
    const badgeTextLength = Math.max(130, badgeWidth - 56);
  
    const categoryText = category || 'NEWS';
    const categoryFontSize = Math.max(34, Math.min(52, Math.round(620 / Math.max(8, categoryText.length + 3))));
    const categoryChipWidth = Math.max(300, Math.min(460, Math.round(102 + categoryText.length * (categoryFontSize * 0.6))));
    const categoryTextLength = Math.max(180, categoryChipWidth - 58);
    const titleTextLength = 918;
    const subtitleTextLength = 882;
    const titleLineMeta = titleLines.map((line) => ({
      line,
      fit: line.length * titleFontSize * 0.62 > titleTextLength,
    }));
    const subtitleLineMeta = subtitleLines.map((line) => ({
      line,
      fit: line.length * subtitleFontSize * 0.55 > subtitleTextLength,
    }));
  
    return {
      palette,
      titleLines: titleLines.length > 0 ? titleLines : ['zNews.live'],
      subtitleLines: subtitleLines.length > 0 ? subtitleLines : ['Горещи новини и репортажи от улицата.'],
      titleLineMeta: titleLineMeta.length > 0 ? titleLineMeta : [{ line: 'zNews.live', fit: false }],
      subtitleLineMeta: subtitleLineMeta.length > 0 ? subtitleLineMeta : [{ line: 'Горещи новини и репортажи от улицата.', fit: false }],
      badge: normalizedBadge || 'EXCLUSIVE',
      category: categoryText,
      dateLabel,
      titleFontSize,
      titleLineHeight,
      subtitleFontSize,
      subtitleLineHeight,
      badgeFontSize,
      badgeWidth,
      badgeHeight,
      badgeTextLength,
      categoryFontSize,
      categoryChipWidth,
      categoryTextLength,
      titleTextLength,
      subtitleTextLength,
    };
  }

  function buildShareCardOverlaySvg(model) {
    const { palette } = model;
  
    // NOTE: This SVG contains NO text — all text is rendered via sharp text() API
    // with fontfile to guarantee Cyrillic rendering on servers without system fonts.
    return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${shareCardWidth}" height="${shareCardHeight}" viewBox="0 0 ${shareCardWidth} ${shareCardHeight}">
    <defs>
      <linearGradient id="overlayFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#120d20" stop-opacity="0.15" />
        <stop offset="45%" stop-color="#120e21" stop-opacity="0.64" />
        <stop offset="100%" stop-color="#170f26" stop-opacity="0.96" />
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.primary}" />
        <stop offset="100%" stop-color="${palette.secondary}" />
      </linearGradient>
      <linearGradient id="footerMetal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#ece7f2" />
      </linearGradient>
      <pattern id="dots" width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.23)" />
      </pattern>
      <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(14,10,22,0.76)" />
        <stop offset="100%" stop-color="rgba(19,14,30,0.90)" />
      </linearGradient>
    </defs>
  
    <rect x="0" y="0" width="${shareCardWidth}" height="${shareCardHeight}" fill="url(#overlayFade)" />
    <rect x="0" y="0" width="${shareCardWidth}" height="${shareCardHeight}" fill="url(#dots)" opacity="0.12" />
    <rect x="30" y="28" width="${shareCardWidth - 60}" height="${shareCardHeight - 56}" rx="26" fill="none" stroke="#211533" stroke-width="7" />
  
    <rect x="72" y="54" width="${model.badgeWidth}" height="${model.badgeHeight}" rx="14" fill="url(#accent)" stroke="#241833" stroke-width="3" />
  
    <rect x="56" y="130" width="${shareCardWidth - 112}" height="374" rx="26" fill="url(#panelGrad)" stroke="rgba(255,255,255,0.30)" stroke-width="2.4" />
    <rect x="56" y="130" width="${shareCardWidth - 112}" height="12" rx="8" fill="url(#accent)" opacity="0.86" />
    <polygon points="${shareCardWidth - 136},148 ${shareCardWidth - 92},148 ${shareCardWidth - 130},212 ${shareCardWidth - 174},212" fill="url(#accent)" opacity="0.70" />
  
    <rect x="86" y="398" width="${shareCardWidth - 172}" height="96" rx="16" fill="rgba(255,255,255,0.10)" />
  
    <rect x="56" y="522" width="${shareCardWidth - 112}" height="86" rx="20" fill="url(#footerMetal)" stroke="#2a1d3d" stroke-width="2.4" />
    <rect x="78" y="540" width="${model.categoryChipWidth}" height="50" rx="12" fill="url(#accent)" stroke="#2b1c40" stroke-width="2.5" />
  </svg>`;
  }

  return {
    clampText,
    buildShareCardModel,
    buildShareCardOverlaySvg,
    escapeHtml,
    getShareSourceUrl,
    resolveSharePalette,
    stripHtmlToText,
    wrapTextLines,
  };
}
