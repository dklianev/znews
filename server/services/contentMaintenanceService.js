import fs from 'fs';
import path from 'path';

export function createContentMaintenanceService(deps) {
  const {
    Article,
    deleteRemoteKeys,
    invalidateCacheGroup,
    isRemoteStorage,
    listRemoteObjectsByPrefix,
    scheduledPublishPollMs,
    shareCardCleanupCheckTtlMs,
    shareCardsDir,
    storageUploadsPrefix,
    toUploadsStorageKey,
  } = deps;

  async function listShareCardEntries() {
    if (isRemoteStorage) {
      const prefixKey = toUploadsStorageKey('_share/');
      const objects = await listRemoteObjectsByPrefix(prefixKey);
      return objects
        .map((item) => {
          const fullKey = String(item?.Key || '');
          if (!fullKey) return null;
          const relative = fullKey.startsWith(`${storageUploadsPrefix}/`) ? fullKey.slice(`${storageUploadsPrefix}/`.length) : fullKey;
          const name = relative.startsWith('_share/') ? relative.slice('_share/'.length) : relative;
          if (!name || name.includes('/')) return null;
          return {
            name,
            key: fullKey,
            modifiedAt: item?.LastModified ? new Date(item.LastModified) : null,
            size: Number(item?.Size || 0),
          };
        })
        .filter(Boolean);
    }

    const entries = await fs.promises.readdir(shareCardsDir, { withFileTypes: true });
    const mapped = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
      const fullPath = path.join(shareCardsDir, entry.name);
      const stat = await fs.promises.stat(fullPath).catch(() => null);
      return {
        name: entry.name,
        key: fullPath,
        modifiedAt: stat?.mtime || null,
        size: Number(stat?.size || 0),
      };
    }));
    return mapped.filter(Boolean);
  }

  async function deleteShareCardEntries(entries) {
    const items = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (items.length === 0) return 0;
    if (isRemoteStorage) {
      await deleteRemoteKeys(items.map((item) => item.key).filter(Boolean));
      return items.length;
    }
    await Promise.all(items.map((item) => fs.promises.unlink(item.key).catch(() => {})));
    return items.length;
  }

  async function cleanupOrphanedShareCardsJob() {
    const entries = await listShareCardEntries();
    if (entries.length === 0) {
      return { message: 'No share cards to inspect', metrics: { inspected: 0, deleted: 0 } };
    }

    const orphanCandidates = [];
    const articleIds = new Set();
    const nowMs = Date.now();

    entries.forEach((entry) => {
      const name = String(entry?.name || '');
      if (!name) return;
      if (name.startsWith('_check-')) {
        const modifiedAtMs = entry.modifiedAt ? new Date(entry.modifiedAt).getTime() : 0;
        if (!modifiedAtMs || (nowMs - modifiedAtMs) >= shareCardCleanupCheckTtlMs) orphanCandidates.push(entry);
        return;
      }
      const match = /^article-(\d+)-/.exec(name);
      if (match) articleIds.add(Number.parseInt(match[1], 10));
    });

    if (articleIds.size > 0) {
      const existingArticles = await Article.find({ id: { $in: [...articleIds] } }).select({ _id: 0, id: 1 }).lean();
      const existingIds = new Set(existingArticles.map((item) => Number.parseInt(item.id, 10)).filter(Number.isInteger));
      entries.forEach((entry) => {
        const match = /^article-(\d+)-/.exec(String(entry?.name || ''));
        if (!match) return;
        const articleId = Number.parseInt(match[1], 10);
        if (Number.isInteger(articleId) && !existingIds.has(articleId)) orphanCandidates.push(entry);
      });
    }

    const deleted = await deleteShareCardEntries(orphanCandidates);
    return {
      message: deleted > 0 ? `Deleted ${deleted} orphan share cards` : 'Share card cleanup found no orphaned entries',
      metrics: { inspected: entries.length, deleted },
    };
  }

  async function refreshScheduledContentCachesJob(state) {
    const now = new Date();
    const lastProcessedIso = state?.metrics?.lastProcessedPublishAt || null;
    const fallbackLookback = new Date(now.getTime() - Math.max(scheduledPublishPollMs * 2, 15 * 60 * 1000));
    const lowerBound = lastProcessedIso ? new Date(lastProcessedIso) : fallbackLookback;
    const dueArticles = await Article.find({
      status: 'published',
      publishAt: { $gt: lowerBound, $lte: now },
    }).sort({ publishAt: 1, id: 1 }).select({ _id: 0, id: 1, publishAt: 1 }).limit(100).lean();

    const latestPublishAt = dueArticles.length > 0
      ? dueArticles[dueArticles.length - 1].publishAt
      : (lastProcessedIso || now.toISOString());

    if (dueArticles.length === 0) {
      return {
        message: 'No newly due scheduled articles',
        metrics: { lastProcessedPublishAt: latestPublishAt },
      };
    }

    const cleared = invalidateCacheGroup('articles', 'scheduled-publish');
    return {
      message: `Activated ${dueArticles.length} scheduled articles`,
      metrics: {
        lastProcessedPublishAt: new Date(latestPublishAt).toISOString(),
        lastArticleIds: dueArticles.map((item) => item.id).slice(-10),
        clearedKeys: cleared,
      },
    };
  }

  return {
    cleanupOrphanedShareCardsJob,
    refreshScheduledContentCachesJob,
  };
}
