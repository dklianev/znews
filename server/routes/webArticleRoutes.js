function isBotUserAgent(req) {
  const ua = String(req?.headers?.['user-agent'] || '').toLowerCase();
  if (!ua) return false;
  return /(discordbot|discordapp|twitterbot|slackbot|telegrambot|whatsapp|facebookexternalhit|linkedinbot|embedly|quora link preview|pinterest|googlebot|bingbot|yandex|duckduckbot)/i.test(ua);
}

export function registerWebArticleRoutes(app, deps) {
  const {
    Article,
    clampText,
    escapeHtml,
    getPublicBaseUrl,
    getPublishedFilter,
    shareCardHeight,
    shareCardWidth,
    stripHtmlToText,
  } = deps;

  // The SPA can't set dynamic OG tags reliably, so for bot user-agents we serve a small HTML shell
  // with per-article meta and let real browsers fall back to the SPA entrypoint.
  app.get('/article/:id(\\d+)', async (req, res, next) => {
    try {
      if (!isBotUserAgent(req)) return next();

      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).send('Invalid article id');

      const article = await Article.findOne({ id, ...getPublishedFilter() }).lean();
      if (!article) return res.status(404).send('Article not found');

      const baseUrl = getPublicBaseUrl(req);
      const articleUrl = `${baseUrl}/article/${id}`;
      const shareImageUrl = `${baseUrl}/api/articles/${id}/share.png`;
      const title = clampText(article.shareTitle || article.title || 'zNews.live', 140);
      const description = clampText(
        article.shareSubtitle || stripHtmlToText(article.excerpt || article.content || ''),
        220
      ) || '?????? ?????? ?? Los Santos.';

      const safeTitle = escapeHtml(title);
      const safeDescription = escapeHtml(description);
      const safeArticleUrl = escapeHtml(articleUrl);
      const safeImageUrl = escapeHtml(shareImageUrl);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(`<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeArticleUrl}" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="zNews.live" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeArticleUrl}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${shareCardWidth}" />
    <meta property="og:image:height" content="${shareCardHeight}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImageUrl}" />
  </head>
  <body></body>
</html>`);
    } catch (_error) {
      return next();
    }
  });

  app.get('/share/article/:id(\\d+)', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).send('Invalid article id');

      const article = await Article.findOne({ id, ...getPublishedFilter() }).lean();
      if (!article) {
        return res.status(404).send('Article not found');
      }

      const baseUrl = getPublicBaseUrl(req);
      const articleUrl = `${baseUrl}/article/${id}`;
      const shareUrl = `${baseUrl}/share/article/${id}`;
      const shareImageUrl = `${baseUrl}/api/articles/${id}/share.png`;
      const title = clampText(article.shareTitle || article.title || 'zNews.live', 140);
      const description = clampText(
        article.shareSubtitle || stripHtmlToText(article.excerpt || article.content || ''),
        220
      ) || '?????? ?????? ?? Los Santos.';

      const safeTitle = escapeHtml(title);
      const safeDescription = escapeHtml(description);
      const safeArticleUrl = escapeHtml(articleUrl);
      const safeShareUrl = escapeHtml(shareUrl);
      const safeImageUrl = escapeHtml(shareImageUrl);
      const safeRedirectUrl = escapeHtml(`/article/${id}`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(`<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="zNews.live" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeShareUrl}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${shareCardWidth}" />
    <meta property="og:image:height" content="${shareCardHeight}" />
    <link rel="canonical" href="${safeArticleUrl}" />
    <meta http-equiv="refresh" content="0;url=${safeRedirectUrl}" />
  </head>
  <body>
    <p style="font-family: Arial, sans-serif; padding: 16px;">???????????? ??? ????????...</p>
    <script>window.location.replace(${JSON.stringify(`/article/${id}`)});</script>
  </body>
</html>`);
    } catch (_error) {
      return res.status(500).send('Share page error');
    }
  });
}
