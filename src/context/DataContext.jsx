import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { api, getSession, saveSession, clearSession } from '../utils/api';

const DataContext = createContext();
const ARTICLE_LIST_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,hero,views,tags,status,publishAt,shareTitle,shareSubtitle,shareBadge,shareAccent,shareImage,cardSticker';
const HOMEPAGE_ARTICLE_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,hero,views,status,publishAt,cardSticker';

function collectCommentThreadIdsLocal(items, rootId) {
  const parsedRootId = Number.parseInt(rootId, 10);
  if (!Number.isInteger(parsedRootId)) return new Set();

  const childrenByParent = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const parsedParentId = Number.parseInt(item?.parentId, 10);
    const parsedId = Number.parseInt(item?.id, 10);
    if (!Number.isInteger(parsedParentId) || !Number.isInteger(parsedId)) return;
    if (!childrenByParent.has(parsedParentId)) childrenByParent.set(parsedParentId, []);
    childrenByParent.get(parsedParentId).push(parsedId);
  });

  const ids = new Set([parsedRootId]);
  const queue = [parsedRootId];

  while (queue.length > 0) {
    const parentId = queue.shift();
    const childIds = childrenByParent.get(parentId) || [];
    childIds.forEach((childId) => {
      if (ids.has(childId)) return;
      ids.add(childId);
      queue.push(childId);
    });
  }

  return ids;
}

export function DataProvider({ children }) {
  const [articles, setArticles] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ads, setAds] = useState([]);
  const [breaking, setBreaking] = useState([]);
  const [heroSettings, setHeroSettings] = useState(null);
  const [siteSettings, setSiteSettings] = useState(null);
  const [heroSettingsRevisions, setHeroSettingsRevisions] = useState([]);
  const [siteSettingsRevisions, setSiteSettingsRevisions] = useState([]);
  const [wanted, setWanted] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [court, setCourt] = useState([]);
  const [events, setEvents] = useState([]);
  const [polls, setPolls] = useState([]);
  const [homepage, setHomepage] = useState(null);
  const [comments, setComments] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaPipelineStatus, setMediaPipelineStatus] = useState(null);
  const [articleRevisions, setArticleRevisions] = useState({});
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [tips, setTips] = useState([]);
  const [session, setSession] = useState(getSession);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleSessionUpdated = (event) => {
      setSession(event?.detail || null);
    };
    window.addEventListener('zn-session-updated', handleSessionUpdated);
    return () => window.removeEventListener('zn-session-updated', handleSessionUpdated);
  }, []);

  // ─── Initial fetch ───
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setArticleRevisions({});
    const isHomePath = typeof window !== 'undefined' && window.location.pathname === '/';
    const shouldUseHomepagePayload = !session?.token && isHomePath;

    const toArray = (value) => (Array.isArray(value) ? value : []);
    const isRateLimitedError = (error) => {
      if (!error) return false;
      if (Number(error?.status) === 429) return true;
      const message = String(error?.message || '').toLowerCase();
      return message.includes('too many requests') || message.includes('429');
    };
    const logPartialErrors = (errors) => {
      if (!errors || typeof errors !== 'object') return;
      Object.entries(errors).forEach(([key, message]) => {
        if (!message) return;
        console.error(`Failed to load ${key}:`, message);
      });
    };
    const normalizeHomepagePayload = (payload) => {
      const articlePool = toArray(payload?.articlePool).length > 0
        ? toArray(payload?.articlePool)
        : toArray(payload?.articles);
      const sections = payload?.sections && typeof payload.sections === 'object'
        ? payload.sections
        : null;
      const schemaVersion = Number.parseInt(payload?.schemaVersion, 10);
      const totalArticles = Number.parseInt(payload?.totalArticles, 10);

      return {
        schemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : 1,
        generatedAt: typeof payload?.generatedAt === 'string' ? payload.generatedAt : null,
        totalArticles: Number.isFinite(totalArticles) ? totalArticles : articlePool.length,
        articlePool,
        sections,
      };
    };

    const applyHomepagePayload = (payload) => {
      const normalizedHomepage = normalizeHomepagePayload(payload);
      setHomepage(normalizedHomepage);
      setArticles(normalizedHomepage.articlePool);
      setAuthors(toArray(payload?.authors));
      setCategories(toArray(payload?.categories));
      setAds(toArray(payload?.ads));
      setBreaking(toArray(payload?.breaking));
      setHeroSettings(payload?.heroSettings || null);
      setSiteSettings(payload?.siteSettings || null);
      setWanted(toArray(payload?.wanted));
      setPolls(toArray(payload?.polls));
      // Not part of /api/homepage (loaded in background or on non-home routes).
      setJobs([]);
      setCourt([]);
      setEvents([]);
      setGallery([]);
      // Comments are loaded on-demand per article (public) or fully for admins (see below).
      setComments([]);
      logPartialErrors(payload?.errors);
    };

    const applyBootstrapPayload = (payload) => {
      setHomepage(null);
      setArticles(toArray(payload?.articles));
      setAuthors(toArray(payload?.authors));
      setCategories(toArray(payload?.categories));
      setAds(toArray(payload?.ads));
      setBreaking(toArray(payload?.breaking));
      setHeroSettings(payload?.heroSettings || null);
      setSiteSettings(payload?.siteSettings || null);
      setWanted(toArray(payload?.wanted));
      setJobs(toArray(payload?.jobs));
      setCourt(toArray(payload?.court));
      setEvents(toArray(payload?.events));
      setPolls(toArray(payload?.polls));
      // Comments are loaded on-demand per article (public) or fully for admins (see below).
      setComments([]);
      setGallery(toArray(payload?.gallery));
      logPartialErrors(payload?.errors);
    };

    const loadLegacyPublicData = async () => {
      setHomepage(null);
      const publicResultKeys = [
        'articles',
        'authors',
        'categories',
        'ads',
        'breaking',
        'heroSettings',
        'siteSettings',
        'wanted',
        'jobs',
        'court',
        'events',
        'polls',
        'gallery',
      ];
      const publicResults = await Promise.allSettled([
        api.articles.getAll({ fields: ARTICLE_LIST_FIELDS }),
        api.authors.getAll(),
        api.categories.getAll(),
        api.ads.getAll(),
        api.breaking.get(),
        api.heroSettings.get(),
        api.siteSettings.get(),
        api.wanted.getAll(),
        api.jobs.getAll(),
        api.court.getAll(),
        api.events.getAll(),
        api.polls.getAll(),
        api.gallery.getAll(),
      ]);

      const pick = (result, fallback) => (result.status === 'fulfilled' ? result.value : fallback);
      setArticles(pick(publicResults[0], []));
      setAuthors(pick(publicResults[1], []));
      setCategories(pick(publicResults[2], []));
      setAds(pick(publicResults[3], []));
      setBreaking(pick(publicResults[4], []));
      setHeroSettings(pick(publicResults[5], null));
      setSiteSettings(pick(publicResults[6], null));
      setWanted(pick(publicResults[7], []));
      setJobs(pick(publicResults[8], []));
      setCourt(pick(publicResults[9], []));
      setEvents(pick(publicResults[10], []));
      setPolls(pick(publicResults[11], []));
      setComments([]);
      setGallery(pick(publicResults[12], []));

      publicResults.forEach((result, idx) => {
        if (result.status === 'rejected') {
          console.error(`Failed to load ${publicResultKeys[idx]}:`, result.reason);
        }
      });
    };

    const loadDeferredPublicData = async () => {
      const deferred = await Promise.allSettled([
        api.jobs.getAll(),
        api.court.getAll(),
        api.events.getAll(),
        api.gallery.getAll(),
      ]);

      if (deferred[0].status === 'fulfilled') setJobs(Array.isArray(deferred[0].value) ? deferred[0].value : []);
      else console.error('Failed to load jobs:', deferred[0].reason);

      if (deferred[1].status === 'fulfilled') setCourt(Array.isArray(deferred[1].value) ? deferred[1].value : []);
      else console.error('Failed to load court:', deferred[1].reason);

      if (deferred[2].status === 'fulfilled') setEvents(Array.isArray(deferred[2].value) ? deferred[2].value : []);
      else console.error('Failed to load events:', deferred[2].reason);

      if (deferred[3].status === 'fulfilled') setGallery(Array.isArray(deferred[3].value) ? deferred[3].value : []);
      else console.error('Failed to load gallery:', deferred[3].reason);
    };

    let loadedFromHomepagePayload = false;
    let hitRateLimit = false;
    if (shouldUseHomepagePayload) {
      try {
        const homepagePayload = await api.homepage.get({
          fields: HOMEPAGE_ARTICLE_FIELDS,
          latestShowcaseLimit: 5,
          latestWireLimit: 16,
        });
        applyHomepagePayload(homepagePayload);
        loadedFromHomepagePayload = true;
      } catch (error) {
        console.error('Failed to load homepage payload:', error);
        setLoadError(error?.message || 'Неуспешно зареждане на началната страница.');
        if (isRateLimitedError(error)) {
          hitRateLimit = true;
        }
      }
    }

    if (!loadedFromHomepagePayload && !hitRateLimit) {
      // Consolidate public data into a single request.
      // Fallback to the legacy parallel requests if bootstrap fails (older server/network edge cases).
      try {
        const payload = await api.bootstrap.get({ fields: ARTICLE_LIST_FIELDS });
        applyBootstrapPayload(payload);
        setLoadError('');
      } catch (error) {
        console.error('Failed to load bootstrap:', error);
        setLoadError(error?.message || 'Неуспешно зареждане на сайта.');
        if (isRateLimitedError(error)) {
          hitRateLimit = true;
        } else {
          await loadLegacyPublicData();
        }
      }
    } else if (loadedFromHomepagePayload) {
      setLoadError('');
    }

    if (hitRateLimit) {
      setLoading(false);
      return;
    }

    if (session?.token) {
      const [usersResult, permsResult, commentsResult, mediaResult, mediaPipelineResult, heroRevisionsResult, siteRevisionsResult, tipsResult] = await Promise.allSettled([
        api.users.getAll(),
        api.permissions.getAll(),
        api.comments.getAll(),
        api.media.getAll(),
        api.media.getPipelineStatus(),
        api.heroSettings.getRevisions(),
        api.siteSettings.getRevisions(),
        api.tips.getAll(),
      ]);
      setUsers(usersResult.status === 'fulfilled' ? usersResult.value : []);
      setPermissions(permsResult.status === 'fulfilled' ? permsResult.value : []);
      setComments(commentsResult.status === 'fulfilled' ? commentsResult.value : []);
      setMedia(mediaResult.status === 'fulfilled' ? mediaResult.value : []);
      setMediaPipelineStatus(mediaPipelineResult.status === 'fulfilled' ? mediaPipelineResult.value : null);
      setHeroSettingsRevisions(heroRevisionsResult.status === 'fulfilled' ? heroRevisionsResult.value : []);
      setSiteSettingsRevisions(siteRevisionsResult.status === 'fulfilled' ? siteRevisionsResult.value : []);
      setTips(tipsResult.status === 'fulfilled' ? tipsResult.value : []);

      if (usersResult.status === 'rejected') console.error('Failed to load users:', usersResult.reason);
      if (permsResult.status === 'rejected') console.error('Failed to load permissions:', permsResult.reason);
      if (commentsResult.status === 'rejected') console.error('Failed to load comments:', commentsResult.reason);
      if (mediaResult.status === 'rejected') console.error('Failed to load media:', mediaResult.reason);
      if (mediaPipelineResult.status === 'rejected') console.error('Failed to load media pipeline status:', mediaPipelineResult.reason);
    } else {
      setUsers([]);
      setPermissions([]);
      setMedia([]);
      setMediaPipelineStatus(null);
      setArticleRevisions({});
      setHeroSettingsRevisions([]);
      setSiteSettingsRevisions([]);
      setComments([]);
      setTips([]);
    }
    setLoading(false);

    if (loadedFromHomepagePayload) {
      void loadDeferredPublicData();
    }
  }, [session?.token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (session?.token) return undefined;
    let cancelled = false;

    api.auth.refresh()
      .then((restoredSession) => {
        if (cancelled || !restoredSession?.token) return;
        saveSession(restoredSession);
        setSession(restoredSession);
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  // ─── Auth ───
  const login = useCallback(async (username, password) => {
    try {
      const s = await api.auth.login(username, password);
      saveSession(s);
      setSession(s);
      return s;
    } catch { return null; }
  }, []);

  const logout = useCallback(() => {
    api.auth.logout().catch(() => { });
    clearSession();
    setSession(null);
    setHomepage(null);
    setUsers([]);
    setPermissions([]);
    setMedia([]);
    setMediaPipelineStatus(null);
    setArticleRevisions({});
    setHeroSettingsRevisions([]);
    setSiteSettingsRevisions([]);
    setComments([]);
    setTips([]);
  }, []);

  // ─── Articles ───
  const addArticle = useCallback(async (a) => { const n = await api.articles.create(a); setArticles(prev => [n, ...prev]); }, []);
  const updateArticle = useCallback(async (id, u) => { const updated = await api.articles.update(id, u); setArticles(prev => prev.map(a => a.id === id ? updated : a)); }, []);
  const deleteArticle = useCallback(async (id) => { await api.articles.delete(id); setArticles(prev => prev.filter(a => a.id !== id)); }, []);
  const incrementArticleView = useCallback(async (id) => {
    try {
      const updated = await api.articles.incrementView(id);
      setArticles(prev => prev.map(a => a.id === id ? { ...a, views: updated.views } : a));
    } catch { }
  }, []);
  const loadArticleRevisions = useCallback(async (articleId) => {
    const id = Number(articleId);
    if (!Number.isFinite(id)) return [];
    const revisions = await api.articles.getRevisions(id);
    setArticleRevisions(prev => ({ ...prev, [id]: revisions }));
    return revisions;
  }, []);
  const autosaveArticleRevision = useCallback(async (articleId, payload) => {
    const id = Number(articleId);
    if (!Number.isFinite(id)) return null;
    const result = await api.articles.autosaveRevision(id, payload);
    await loadArticleRevisions(id);
    return result;
  }, [loadArticleRevisions]);
  const restoreArticleRevision = useCallback(async (articleId, revisionId) => {
    const id = Number(articleId);
    if (!Number.isFinite(id)) return null;
    const updated = await api.articles.restoreRevision(id, revisionId);
    setArticles(prev => prev.map(a => a.id === id ? updated : a));
    await loadArticleRevisions(id);
    return updated;
  }, [loadArticleRevisions]);

  // ─── Authors ───
  const addAuthor = useCallback(async (a) => { const n = await api.authors.create(a); setAuthors(prev => [...prev, n]); }, []);
  const updateAuthor = useCallback(async (id, u) => { const updated = await api.authors.update(id, u); setAuthors(prev => prev.map(a => a.id === id ? updated : a)); }, []);
  const deleteAuthor = useCallback(async (id) => { await api.authors.delete(id); setAuthors(prev => prev.filter(a => a.id !== id)); }, []);

  // ─── Ads ───
  const addAd = useCallback(async (a) => { const n = await api.ads.create(a); setAds(prev => [...prev, n]); }, []);
  const updateAd = useCallback(async (id, u) => { const updated = await api.ads.update(id, u); setAds(prev => prev.map(a => a.id === id ? updated : a)); }, []);
  const deleteAd = useCallback(async (id) => { await api.ads.delete(id); setAds(prev => prev.filter(a => a.id !== id)); }, []);

  // ─── Breaking ───
  const saveBreaking = useCallback(async (items) => { await api.breaking.save(items); setBreaking(items); }, []);

  // ─── Hero Settings ───
  const saveHeroSettings = useCallback(async (settings) => {
    const saved = await api.heroSettings.save(settings);
    setHeroSettings(saved);
    try {
      const revisions = await api.heroSettings.getRevisions();
      setHeroSettingsRevisions(revisions);
    } catch { }
  }, []);
  const loadHeroSettingsRevisions = useCallback(async () => {
    const revisions = await api.heroSettings.getRevisions();
    setHeroSettingsRevisions(revisions);
    return revisions;
  }, []);
  const restoreHeroSettingsRevision = useCallback(async (revisionId) => {
    const restored = await api.heroSettings.restoreRevision(revisionId);
    setHeroSettings(restored);
    await loadHeroSettingsRevisions();
    return restored;
  }, [loadHeroSettingsRevisions]);

  // ─── Site Settings ───
  const saveSiteSettings = useCallback(async (settings) => {
    const saved = await api.siteSettings.save(settings);
    setSiteSettings(saved);
    try {
      const revisions = await api.siteSettings.getRevisions();
      setSiteSettingsRevisions(revisions);
    } catch { }
  }, []);
  const loadSiteSettingsRevisions = useCallback(async () => {
    const revisions = await api.siteSettings.getRevisions();
    setSiteSettingsRevisions(revisions);
    return revisions;
  }, []);
  const restoreSiteSettingsRevision = useCallback(async (revisionId) => {
    const restored = await api.siteSettings.restoreRevision(revisionId);
    setSiteSettings(restored);
    await loadSiteSettingsRevisions();
    return restored;
  }, [loadSiteSettingsRevisions]);
  const forceRefreshHomepageCache = useCallback(async () => {
    return await api.siteSettings.forceRefreshHomepageCache();
  }, []);

  // ─── Categories ───
  const addCategory = useCallback(async (c) => { const n = await api.categories.create(c); setCategories(prev => [...prev, n]); }, []);
  const updateCategory = useCallback(async (id, u) => { const updated = await api.categories.update(id, u); setCategories(prev => prev.map(c => c.id === id ? updated : c)); }, []);
  const deleteCategory = useCallback(async (id) => { if (id === 'all') return; await api.categories.delete(id); setCategories(prev => prev.filter(c => c.id !== id)); }, []);
  const saveCategories = useCallback(async (cats) => {
    const desiredRaw = Array.isArray(cats) ? cats : [];
    const desired = desiredRaw
      .map((c) => ({
        id: String(c?.id || '').trim(),
        name: String(c?.name || '').trim(),
        icon: String(c?.icon || '').trim(),
      }))
      .filter((c) => c.id && c.name && c.id !== 'all');

    const desiredById = new Map(desired.map((c) => [c.id, c]));
    const existingRaw = await api.categories.getAll();
    const existing = Array.isArray(existingRaw) ? existingRaw : [];
    const existingById = new Map(existing.map((c) => [c.id, c]));

    // Apply creates/updates first (no data-loss even if a later step fails).
    const upsertOps = [];
    desiredById.forEach((next, id) => {
      const prev = existingById.get(id);
      if (!prev) {
        upsertOps.push(() => api.categories.create(next));
        return;
      }

      const patch = {};
      if (String(prev.name || '') !== next.name) patch.name = next.name;
      if (String(prev.icon || '') !== next.icon) patch.icon = next.icon;
      if (Object.keys(patch).length > 0) {
        upsertOps.push(() => api.categories.update(id, patch));
      }
    });

    const upsertResults = await Promise.allSettled(upsertOps.map(fn => fn()));
    const upsertFailed = upsertResults.find(r => r.status === 'rejected');
    if (upsertFailed) throw upsertFailed.reason;

    // Then remove categories that no longer exist in the desired set.
    const deleteOps = existing
      .filter((c) => c?.id && c.id !== 'all' && !desiredById.has(c.id))
      .map((c) => () => api.categories.delete(c.id));

    const deleteResults = await Promise.allSettled(deleteOps.map(fn => fn()));
    const deleteFailed = deleteResults.find(r => r.status === 'rejected');
    if (deleteFailed) throw deleteFailed.reason;

    const finalRaw = await api.categories.getAll();
    const finalItems = Array.isArray(finalRaw) ? finalRaw : desired;
    setCategories(finalItems);
    return finalItems;
  }, []);

  // ─── Wanted ───
  const addWanted = useCallback(async (w) => { const n = await api.wanted.create(w); setWanted(prev => [...prev, n]); }, []);
  const updateWanted = useCallback(async (id, u) => { const updated = await api.wanted.update(id, u); setWanted(prev => prev.map(w => w.id === id ? updated : w)); }, []);
  const deleteWanted = useCallback(async (id) => { await api.wanted.delete(id); setWanted(prev => prev.filter(w => w.id !== id)); }, []);

  // ─── Jobs ───
  const addJob = useCallback(async (j) => { const n = await api.jobs.create(j); setJobs(prev => [n, ...prev]); }, []);
  const updateJob = useCallback(async (id, u) => { const updated = await api.jobs.update(id, u); setJobs(prev => prev.map(j => j.id === id ? updated : j)); }, []);
  const deleteJob = useCallback(async (id) => { await api.jobs.delete(id); setJobs(prev => prev.filter(j => j.id !== id)); }, []);

  // ─── Court ───
  const addCourtCase = useCallback(async (c) => { const n = await api.court.create(c); setCourt(prev => [n, ...prev]); }, []);
  const updateCourtCase = useCallback(async (id, u) => { const updated = await api.court.update(id, u); setCourt(prev => prev.map(c => c.id === id ? updated : c)); }, []);
  const deleteCourtCase = useCallback(async (id) => { await api.court.delete(id); setCourt(prev => prev.filter(c => c.id !== id)); }, []);

  // ─── Events ───
  const addEvent = useCallback(async (e) => { const n = await api.events.create(e); setEvents(prev => [n, ...prev]); }, []);
  const updateEvent = useCallback(async (id, u) => { const updated = await api.events.update(id, u); setEvents(prev => prev.map(e => e.id === id ? updated : e)); }, []);
  const deleteEvent = useCallback(async (id) => { await api.events.delete(id); setEvents(prev => prev.filter(e => e.id !== id)); }, []);

  // ─── Polls ───
  const addPoll = useCallback(async (p) => { const n = await api.polls.create(p); setPolls(prev => [n, ...prev]); }, []);
  const updatePoll = useCallback(async (id, u) => { const updated = await api.polls.update(id, u); setPolls(prev => prev.map(p => p.id === id ? updated : p)); }, []);
  const deletePoll = useCallback(async (id) => { await api.polls.delete(id); setPolls(prev => prev.filter(p => p.id !== id)); }, []);
  const votePoll = useCallback(async (pollId, optIdx) => { const updated = await api.polls.vote(pollId, optIdx); setPolls(prev => prev.map(p => p.id === pollId ? updated : p)); }, []);

  // ─── Comments ───
  const loadCommentsForArticle = useCallback(async (articleId) => {
    const id = Number(articleId);
    if (!Number.isFinite(id)) return [];
    const items = await api.comments.getAll({ articleId: id });
    setComments(prev => [...prev.filter(c => Number(c.articleId) !== id), ...(Array.isArray(items) ? items : [])]);
    return items;
  }, []);

  const loadAllComments = useCallback(async () => {
    const items = await api.comments.getAll();
    setComments(Array.isArray(items) ? items : []);
    return items;
  }, []);

  const addComment = useCallback(async (c) => { const n = await api.comments.create(c); setComments(prev => [...prev, n]); }, []);
  const updateComment = useCallback(async (id, u) => {
    const updated = await api.comments.update(id, u);
    const parsedId = Number.parseInt(id, 10);
    const shouldCascadeHide = Object.prototype.hasOwnProperty.call(u || {}, 'approved') && u?.approved === false;

    setComments((prev) => {
      if (!shouldCascadeHide || !Number.isInteger(parsedId)) {
        return prev.map(c => Number(c.id) === Number(id) ? { ...c, ...updated } : c);
      }

      const threadIds = collectCommentThreadIdsLocal(prev, parsedId);
      return prev.map((comment) => {
        const commentId = Number.parseInt(comment?.id, 10);
        if (!Number.isInteger(commentId)) return comment;
        if (commentId === parsedId) return { ...comment, ...updated };
        if (threadIds.has(commentId)) return { ...comment, approved: false };
        return comment;
      });
    });

    return updated;
  }, []);
  const deleteComment = useCallback(async (id) => {
    await api.comments.delete(id);
    setComments((prev) => {
      const threadIds = collectCommentThreadIdsLocal(prev, id);
      return prev.filter((comment) => !threadIds.has(Number.parseInt(comment?.id, 10)));
    });
  }, []);
  const reactToComment = useCallback(async (id, reaction) => {
    const updated = await api.comments.react(id, reaction);
    setComments(prev => prev.map(c => Number(c.id) === Number(id) ? { ...c, ...updated } : c));
    return updated;
  }, []);

  // ─── Gallery ───
  const addGalleryItem = useCallback(async (g) => { const n = await api.gallery.create(g); setGallery(prev => [...prev, n]); }, []);
  const updateGalleryItem = useCallback(async (id, u) => { const updated = await api.gallery.update(id, u); setGallery(prev => prev.map(g => g.id === id ? updated : g)); }, []);
  const deleteGalleryItem = useCallback(async (id) => { await api.gallery.delete(id); setGallery(prev => prev.filter(g => g.id !== id)); }, []);

  // ─── Media Library ───
  const refreshMedia = useCallback(async () => {
    try {
      const [items, pipelineStatus] = await Promise.all([
        api.media.getAll(),
        api.media.getPipelineStatus(),
      ]);
      setMedia(items);
      setMediaPipelineStatus(pipelineStatus);
    } catch {
      setMedia([]);
      setMediaPipelineStatus(null);
    }
  }, []);
  const uploadMedia = useCallback(async (file, options = {}) => {
    const uploaded = await api.media.upload(file);
    if (!options?.skipRefresh) await refreshMedia();
    return uploaded;
  }, [refreshMedia]);
  const deleteMedia = useCallback(async (fileName) => {
    await api.media.delete(fileName);
    await refreshMedia();
  }, [refreshMedia]);
  const backfillMediaPipeline = useCallback(async (options = {}) => {
    const summary = await api.media.backfillPipeline(options);
    await refreshMedia();
    return summary;
  }, [refreshMedia]);

  // ─── Users (admin) ───
  const addUser = useCallback(async (u) => { const n = await api.users.create(u); setUsers(prev => [...prev, n]); }, []);
  const updateUser = useCallback(async (id, u) => { const updated = await api.users.update(id, u); setUsers(prev => prev.map(x => x.id === id ? updated : x)); }, []);
  const deleteUser = useCallback(async (id) => { if (id === 1) return; await api.users.delete(id); setUsers(prev => prev.filter(x => x.id !== id)); }, []);

  // ─── Permissions ───
  const hasPermission = useCallback((section) => {
    if (!session) return false;
    if (session.role === 'admin') return true; // admin always has all permissions
    const rolePerm = permissions.find(p => p.role === session.role);
    if (!rolePerm?.permissions) return false;

    const has = (key) => Boolean(rolePerm.permissions?.[key]);
    if (Array.isArray(section)) return section.some(has);
    if (typeof section === 'string') return has(section);
    return false;
  }, [session, permissions]);

  const updatePermission = useCallback(async (role, perms) => {
    const updated = await api.permissions.update(role, perms);
    setPermissions((prev) => {
      const idx = prev.findIndex(p => p.role === role);
      if (idx === -1) return [...prev, updated];
      return prev.map(p => p.role === role ? updated : p);
    });
    return updated;
  }, []);

  const createRole = useCallback(async (role) => {
    const ensured = await api.roles.ensure(role);
    setPermissions((prev) => {
      const idx = prev.findIndex(p => p.role === ensured.role);
      if (idx === -1) return [...prev, ensured];
      return prev.map(p => p.role === ensured.role ? ensured : p);
    });
    return ensured;
  }, []);

  // ─── Reset ───
  const resetAll = useCallback(async () => {
    await api.reset();
    await fetchAll();
  }, [fetchAll]);

  // ─── Tips ───
  const refreshTips = useCallback(async () => {
    if (!session?.token) return;
    try {
      const ts = await api.tips.getAll();
      setTips(ts);
    } catch { }
  }, [session?.token]);
  const deleteTip = useCallback(async (id) => {
    await api.tips.delete(id);
    setTips(prev => prev.filter(t => t.id !== id));
  }, []);
  const updateTip = useCallback(async (id, status) => {
    const updated = await api.tips.update(id, status);
    setTips(prev => prev.map(t => t.id === id ? updated : t));
  }, []);
  const createTip = useCallback(async (formData) => {
    return await api.tips.create(formData);
  }, []);

  const contextValue = useMemo(() => ({
    loading, loadError,
    homepage,
    articles, addArticle, updateArticle, deleteArticle, incrementArticleView,
    articleRevisions, loadArticleRevisions, autosaveArticleRevision, restoreArticleRevision,
    authors, addAuthor, updateAuthor, deleteAuthor,
    categories, addCategory, updateCategory, deleteCategory, saveCategories,
    ads, addAd, updateAd, deleteAd,
    breaking, saveBreaking,
    heroSettings, heroSettingsRevisions, saveHeroSettings, loadHeroSettingsRevisions, restoreHeroSettingsRevision,
    siteSettings, siteSettingsRevisions, saveSiteSettings, loadSiteSettingsRevisions, restoreSiteSettingsRevision, forceRefreshHomepageCache,
    wanted, addWanted, updateWanted, deleteWanted,
    jobs, addJob, updateJob, deleteJob,
    court, addCourtCase, updateCourtCase, deleteCourtCase,
    events, addEvent, updateEvent, deleteEvent,
    polls, addPoll, updatePoll, deletePoll, votePoll,
    comments, loadCommentsForArticle, loadAllComments, addComment, updateComment, deleteComment, reactToComment,
    gallery, addGalleryItem, updateGalleryItem, deleteGalleryItem,
    media, mediaPipelineStatus, refreshMedia, uploadMedia, deleteMedia, backfillMediaPipeline,
    users, addUser, updateUser, deleteUser,
    permissions, hasPermission, updatePermission, createRole,
    tips, refreshTips, deleteTip, updateTip, createTip,
    session, login, logout,
    refresh: fetchAll, resetAll,
  }), [
    loading, loadError,
    homepage,
    articles, addArticle, updateArticle, deleteArticle, incrementArticleView,
    articleRevisions, loadArticleRevisions, autosaveArticleRevision, restoreArticleRevision,
    authors, addAuthor, updateAuthor, deleteAuthor,
    categories, addCategory, updateCategory, deleteCategory, saveCategories,
    ads, addAd, updateAd, deleteAd,
    breaking, saveBreaking,
    heroSettings, heroSettingsRevisions, saveHeroSettings, loadHeroSettingsRevisions, restoreHeroSettingsRevision,
    siteSettings, siteSettingsRevisions, saveSiteSettings, loadSiteSettingsRevisions, restoreSiteSettingsRevision, forceRefreshHomepageCache,
    wanted, addWanted, updateWanted, deleteWanted,
    jobs, addJob, updateJob, deleteJob,
    court, addCourtCase, updateCourtCase, deleteCourtCase,
    events, addEvent, updateEvent, deleteEvent,
    polls, addPoll, updatePoll, deletePoll, votePoll,
    comments, loadCommentsForArticle, loadAllComments, addComment, updateComment, deleteComment, reactToComment,
    gallery, addGalleryItem, updateGalleryItem, deleteGalleryItem,
    media, mediaPipelineStatus, refreshMedia, uploadMedia, deleteMedia, backfillMediaPipeline,
    users, addUser, updateUser, deleteUser,
    permissions, hasPermission, updatePermission, createRole,
    tips, refreshTips, deleteTip, updateTip, createTip,
    session, login, logout,
    fetchAll, resetAll,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
