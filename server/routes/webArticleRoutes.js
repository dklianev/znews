import { createWebArticleMetaHelpers } from '../services/webArticleMetaHelpersService.js';

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

  const {
    buildArticleMeta,
    isBotUserAgent,
    renderBotArticleHtml,
    renderShareArticleHtml,
  } = createWebArticleMetaHelpers({
    clampText,
    escapeHtml,
    shareCardHeight,
    shareCardWidth,
    stripHtmlToText,
  });

  // The SPA can't set dynamic OG tags reliably, so for bot user-agents we serve a small HTML shell
  // with per-article meta and let real browsers fall back to the SPA entrypoint.
  // Express 5 no longer supports regexp sub-expressions in string paths.
  // We keep numeric validation inside the handler to preserve behavior.
  app.get('/article/:id', async (req, res, next) => {
    try {
      if (!isBotUserAgent(req)) return next();

      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).send('Invalid article id');

      const article = await Article.findOne({ id, ...getPublishedFilter() }).lean();
      if (!article) return res.status(404).send('Article not found');

      const meta = buildArticleMeta({
        article,
        baseUrl: getPublicBaseUrl(req),
        id,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(renderBotArticleHtml(meta));
    } catch (_error) {
      return next();
    }
  });

  app.get('/share/article/:id', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) return res.status(400).send('Invalid article id');

      const article = await Article.findOne({ id, ...getPublishedFilter() }).lean();
      if (!article) {
        return res.status(404).send('Article not found');
      }

      const meta = buildArticleMeta({
        article,
        baseUrl: getPublicBaseUrl(req),
        id,
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(renderShareArticleHtml(meta));
    } catch (_error) {
      return res.status(500).send('Share page error');
    }
  });
}
