export function createWebArticleMetaHelpers({
  clampText,
  escapeHtml,
  shareCardHeight,
  shareCardWidth,
  stripHtmlToText,
}) {
  function isBotUserAgent(req) {
    const ua = String(req?.headers?.['user-agent'] || '').toLowerCase();
    if (!ua) return false;
    return /(discordbot|discordapp|twitterbot|slackbot|telegrambot|whatsapp|facebookexternalhit|linkedinbot|embedly|quora link preview|pinterest|googlebot|bingbot|yandex|duckduckbot)/i.test(ua);
  }

  function buildArticleMeta({ article, baseUrl, id }) {
    const articleUrl = `${baseUrl}/article/${id}`;
    const shareUrl = `${baseUrl}/share/article/${id}`;
    const shareImageUrl = `${baseUrl}/api/articles/${id}/share.png`;
    const title = clampText(article.shareTitle || article.title || 'zNews.live', 140);
    const description = clampText(
      article.shareSubtitle || stripHtmlToText(article.excerpt || article.content || ''),
      220
    ) || '?????? ?????? ?? Los Santos.';

    return {
      articleUrl,
      description,
      id,
      safeArticleUrl: escapeHtml(articleUrl),
      safeDescription: escapeHtml(description),
      safeImageUrl: escapeHtml(shareImageUrl),
      safeRedirectUrl: escapeHtml(`/article/${id}`),
      safeShareUrl: escapeHtml(shareUrl),
      safeTitle: escapeHtml(title),
      shareImageUrl,
      shareUrl,
      title,
    };
  }

  function renderBotArticleHtml(meta) {
    return `<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${meta.safeTitle}</title>
    <meta name="description" content="${meta.safeDescription}" />
    <link rel="canonical" href="${meta.safeArticleUrl}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="zNews.live" />
    <meta property="og:title" content="${meta.safeTitle}" />
    <meta property="og:description" content="${meta.safeDescription}" />
    <meta property="og:url" content="${meta.safeArticleUrl}" />
    <meta property="og:image" content="${meta.safeImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${shareCardWidth}" />
    <meta property="og:image:height" content="${shareCardHeight}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.safeTitle}" />
    <meta name="twitter:description" content="${meta.safeDescription}" />
    <meta name="twitter:image" content="${meta.safeImageUrl}" />
  </head>
  <body></body>
</html>`;
  }

  function renderShareArticleHtml(meta) {
    return `<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${meta.safeTitle}</title>
    <meta name="description" content="${meta.safeDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="zNews.live" />
    <meta property="og:title" content="${meta.safeTitle}" />
    <meta property="og:description" content="${meta.safeDescription}" />
    <meta property="og:url" content="${meta.safeShareUrl}" />
    <meta property="og:image" content="${meta.safeImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${shareCardWidth}" />
    <meta property="og:image:height" content="${shareCardHeight}" />
    <link rel="canonical" href="${meta.safeArticleUrl}" />
    <meta http-equiv="refresh" content="0;url=${meta.safeRedirectUrl}" />
  </head>
  <body>
    <p style="font-family: Arial, sans-serif; padding: 16px;">???????????? ??? ????????...</p>
    <script>window.location.replace(${JSON.stringify(`/article/${meta.id}`)});</script>
  </body>
</html>`;
  }

  return {
    buildArticleMeta,
    isBotUserAgent,
    renderBotArticleHtml,
    renderShareArticleHtml,
  };
}
