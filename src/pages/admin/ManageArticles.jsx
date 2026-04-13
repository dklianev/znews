import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminData, usePublicData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, Eye, Star, RefreshCw, History, RotateCcw, Clock3, Loader2, Search, Copy, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, CheckSquare, Square, ArrowUp, Archive, ArchiveRestore } from 'lucide-react';
import { estimateReadTimeFromHtml, normalizeRichTextHtml } from '../../utils/richText';
import { normalizeArticleAdminForm, trimArticleAdminText } from '../../utils/articleAdminForm';
import { api } from '../../utils/api';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import RevisionComparePanel from '../../components/admin/RevisionComparePanel';
import { buildAdminSearchParams, readPositiveIntSearchParam, readSearchParam } from '../../utils/adminSearchParams';

const LazyRichTextEditor = lazy(() => import('../../components/admin/RichTextEditor'));
const LazyAdminImageField = lazy(() => import('../../components/admin/AdminImageField'));
const LazyLivePreviewModal = lazy(() => import('../../components/admin/LivePreviewModal'));

const ARTICLE_DRAFT_KEY = 'zn_manage_articles_draft_v1';
const ARTICLE_HISTORY_KEY = 'zn_manage_articles_history_v1';
const ARTICLE_INTAKE_PREFILL_KEY = 'znews_intake_article_prefill_v1';
const LEGACY_TIP_PREFILL_KEY = 'znews_tip_prefill';
const FIELD_TAB_BY_KEY = Object.freeze({
  title: 'content',
  excerpt: 'content',
  content: 'content',
  image: 'media',
  category: 'settings',
  authorId: 'settings',
});

function dateTimeToLocalInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function localInputToIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readIncomingArticlePrefill() {
  if (typeof window === 'undefined') return null;
  const keys = [ARTICLE_INTAKE_PREFILL_KEY, LEGACY_TIP_PREFILL_KEY];
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // ignore malformed storage payloads
    }
  }
  return null;
}

function clearIncomingArticlePrefill() {
  if (typeof window === 'undefined') return;
  [ARTICLE_INTAKE_PREFILL_KEY, LEGACY_TIP_PREFILL_KEY].forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage cleanup errors
    }
  });
}

function getRightOfReplyIntakeMeta(value) {
  if (!value || typeof value !== 'object') return null;
  const source = String(value.source || '').trim();
  const requestKind = String(value.requestKind || '').trim();
  const requestId = Number.parseInt(String(value.requestId || ''), 10);
  if (source !== 'contact' || requestKind !== 'right_of_reply' || !Number.isInteger(requestId) || requestId <= 0) {
    return null;
  }

  const relatedArticleId = Number.parseInt(String(value.relatedArticleId || ''), 10);
  const relatedArticleTitle = String(value.relatedArticleTitle || '').trim();
  return {
    source,
    requestKind,
    requestId,
    relatedArticleId: Number.isInteger(relatedArticleId) && relatedArticleId > 0 ? relatedArticleId : null,
    relatedArticleTitle,
  };
}

const REVISION_COMPARE_FIELDS = [
  { key: 'title', label: 'Заглавие' },
  { key: 'slug', label: 'SEO Slug' },
  { key: 'excerpt', label: 'Резюме' },
  { key: 'content', label: 'Съдържание' },
  { key: 'category', label: 'Категория' },
  { key: 'authorId', label: 'Автор' },
  { key: 'date', label: 'Дата' },
  { key: 'readTime', label: 'Време за четене' },
  { key: 'image', label: 'Снимка URL' },
  { key: 'youtubeUrl', label: 'YouTube Линк' },
  { key: 'featured', label: 'Водеща' },
  { key: 'breaking', label: 'Breaking' },
  { key: 'sponsored', label: 'Платена' },
  { key: 'hero', label: 'Hero' },
  { key: 'status', label: 'Статус' },
  { key: 'publishAt', label: 'Планирано публикуване' },
  { key: 'tags', label: 'Тагове' },
  { key: 'views', label: 'Прегледи' },
  { key: 'shareTitle', label: 'Share заглавие' },
  { key: 'shareSubtitle', label: 'Share подзаглавие' },
  { key: 'shareBadge', label: 'Share badge' },
  { key: 'cardSticker', label: 'Card етикет' },
  { key: 'shareAccent', label: 'Share акцент' },
  { key: 'shareImage', label: 'Share снимка' },
  { key: 'relatedArticles', label: 'Свързани статии' },
];
const VALIDATION_FIELD_LABELS = Object.freeze(
  Object.fromEntries(REVISION_COMPARE_FIELDS.map(({ key, label }) => [key, label])),
);

function stripHtmlToText(value) {
  if (!value) return '';
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompareValue(key, value) {
  if (key === 'content' || key === 'excerpt') return stripHtmlToText(value);
  if (key === 'tags') {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean).join(', ');
    return String(value || '').trim();
  }
  if (key === 'featured' || key === 'breaking' || key === 'sponsored' || key === 'hero') return value ? '1' : '0';
  if (key === 'authorId' || key === 'readTime' || key === 'views') {
    const num = Number(value);
    return Number.isFinite(num) ? String(num) : '';
  }
  if (key === 'publishAt') {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
  }
  return String(value ?? '').trim();
}

function getHistoryScope(editingValue) {
  return editingValue === 'new' ? 'new' : `article:${editingValue}`;
}

const emptyForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '<p></p>',
  category: 'crime',
  authorId: 1,
  date: new Date().toISOString().slice(0, 10),
  readTime: 3,
  views: 0,
  image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
  youtubeUrl: '',
  featured: false,
  breaking: false,
  sponsored: false,
  hero: false,
  tags: '',
  relatedArticles: [],
  status: 'published',
  publishAt: '',
  cardSticker: '',
  shareTitle: '',
  shareSubtitle: '',
  shareBadge: '',
  shareAccent: 'auto',
  shareImage: '',
};

export default function ManageArticles() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    authors,
    categories,
    addArticle,
    updateArticle,
    deleteArticle,
    refresh,
  } = usePublicData();
  const {
    articleRevisions,
    loadArticleRevisions,
    autosaveArticleRevision,
    restoreArticleRevision,
  } = useAdminData();
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('content');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [lastServerVersion, setLastServerVersion] = useState(null);
  const [concurrentWarning, setConcurrentWarning] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [contentMode, setContentMode] = useState('write');
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [autosavedAt, setAutosavedAt] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [restoringRevision, setRestoringRevision] = useState(null);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [selectedRevisionIds, setSelectedRevisionIds] = useState([]);
  const [revisionDetailsById, setRevisionDetailsById] = useState({});
  const [loadingRevisionDetails, setLoadingRevisionDetails] = useState({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const ARTICLES_PER_PAGE = 15;
  const searchQuery = readSearchParam(searchParams, 'q', '');
  const requestedFilterCategory = readSearchParam(searchParams, 'category', 'all');
  const currentPage = readPositiveIntSearchParam(searchParams, 'page', 1);
  const showArchived = readSearchParam(searchParams, 'view', '') === 'archived';
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const initialFormRef = useRef(emptyForm);
  const fieldRefs = useRef({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [archivedArticles, setArchivedArticles] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [listArticles, setListArticles] = useState([]);
  const [listTotal, setListTotal] = useState(0);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [listReloadNonce, setListReloadNonce] = useState(0);
  const [adminMeta, setAdminMeta] = useState({ total: 0, byCategory: {}, popularTags: [] });
  const [relatedSearchQuery, setRelatedSearchQuery] = useState('');
  const deferredRelatedSearchQuery = useDeferredValue(relatedSearchQuery);
  const [relatedOptions, setRelatedOptions] = useState([]);
  const [relatedOptionsLoading, setRelatedOptionsLoading] = useState(false);
  const [relatedArticleMap, setRelatedArticleMap] = useState({});
  const listRequestRef = useRef(0);
  const relatedRequestRef = useRef(0);
  const toast = useToast();
  const confirm = useConfirm();
  const filterCat = useMemo(() => {
    if (requestedFilterCategory === 'all') return 'all';
    return categories.some((category) => category.id === requestedFilterCategory)
      ? requestedFilterCategory
      : 'all';
  }, [categories, requestedFilterCategory]);

  const registerFieldRef = useCallback((field) => (node) => {
    if (node) {
      fieldRefs.current[field] = node;
      return;
    }
    delete fieldRefs.current[field];
  }, []);

  const clearValidationError = useCallback((field) => {
    setValidationErrors((prev) => {
      if (!prev || !Object.prototype.hasOwnProperty.call(prev, field)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const focusValidationField = useCallback((field) => {
    if (!field) return;

    const targetTab = FIELD_TAB_BY_KEY[field];
    if (targetTab && targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
    if (field === 'content' && contentMode !== 'write') {
      setContentMode('write');
    }

    const focusTarget = () => {
      const node = fieldRefs.current[field];
      if (!node) return;

      if (typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const selector = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])';
      const focusable = typeof node.matches === 'function' && node.matches(selector)
        ? node
        : node.querySelector?.(selector);

      if (focusable && typeof focusable.focus === 'function') {
        focusable.focus({ preventScroll: true });
        return;
      }

      if (typeof node.focus === 'function') {
        node.focus({ preventScroll: true });
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(focusTarget);
      });
      return;
    }

    focusTarget();
  }, [activeTab, contentMode]);

  useEffect(() => {
    const entries = Object.entries(validationErrors || {});
    if (entries.length === 0) return;

    const normalizedEntries = entries.filter(([, value]) => value != null && value !== '');
    if (normalizedEntries.length === entries.length) return;

    setValidationErrors(Object.fromEntries(normalizedEntries));
  }, [validationErrors]);

  const allExistingTags = useMemo(
    () => (Array.isArray(adminMeta.popularTags) ? adminMeta.popularTags.map((item) => item?.tag).filter(Boolean) : []),
    [adminMeta.popularTags],
  );
  const relatedArticleIdMap = useMemo(() => new Map(
    Object.values(relatedArticleMap || {})
      .filter((item) => Number.isInteger(Number(item?.id)))
      .map((item) => [Number(item.id), item]),
  ), [relatedArticleMap]);

  const handleAddTag = useCallback((tag) => {
    const currentTags = typeof form.tags === 'string'
      ? form.tags.split(',').map(t => t.trim()).filter(Boolean)
      : (form.tags || []);
    if (!currentTags.includes(tag)) {
      setForm(prev => ({ ...prev, tags: [...currentTags, tag].join(', ') }));
    }
  }, [form.tags]);

  const refreshList = useCallback(() => {
    setListReloadNonce((prev) => prev + 1);
  }, []);

  const setListSearchParams = useCallback((updates, { replace = true } = {}) => {
    setSearchParams((current) => {
      const next = buildAdminSearchParams(current, {
        q: Object.prototype.hasOwnProperty.call(updates, 'q') ? updates.q : readSearchParam(current, 'q', ''),
        category: Object.prototype.hasOwnProperty.call(updates, 'category') ? updates.category : readSearchParam(current, 'category', 'all'),
      });

      const nextPage = Object.prototype.hasOwnProperty.call(updates, 'page')
        ? updates.page
        : readSearchParam(current, 'page', '');
      if (typeof nextPage === 'string') {
        const normalizedPage = nextPage.trim();
        if (!normalizedPage || normalizedPage === '1') next.delete('page');
        else next.set('page', normalizedPage);
      }

      const nextView = Object.prototype.hasOwnProperty.call(updates, 'view')
        ? updates.view
        : readSearchParam(current, 'view', '');
      if (typeof nextView === 'string') {
        if (!nextView.trim()) next.delete('view');
        else next.set('view', nextView.trim());
      }

      return next;
    }, { replace });
  }, [setSearchParams]);

  const mergeRelatedArticles = useCallback((items) => {
    setRelatedArticleMap((prev) => {
      const next = { ...prev };
      (Array.isArray(items) ? items : []).forEach((item) => {
        const id = Number(item?.id);
        if (!Number.isInteger(id)) return;
        next[id] = item;
      });
      return next;
    });
  }, []);

  const loadAdminMeta = useCallback(async () => {
    try {
      const payload = await api.articles.getAdminMeta();
      setAdminMeta({
        total: Number.isInteger(payload?.total) ? payload.total : 0,
        byCategory: payload?.byCategory && typeof payload.byCategory === 'object' ? payload.byCategory : {},
        popularTags: Array.isArray(payload?.popularTags) ? payload.popularTags : [],
      });
    } catch (error) {
      console.error('Failed to load article admin meta:', error);
    }
  }, []);

  const loadArticlePage = useCallback(async () => {
    const requestId = listRequestRef.current + 1;
    listRequestRef.current = requestId;
    setListLoading(true);
    setListError('');

    try {
      const payload = await api.articles.listAdmin({
        page: currentPage,
        limit: ARTICLES_PER_PAGE,
        category: filterCat,
        q: deferredSearchQuery.trim(),
      });
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const total = Number.isInteger(payload?.total) ? payload.total : items.length;
      const totalPages = Number.isInteger(payload?.totalPages)
        ? Math.max(1, payload.totalPages)
        : Math.max(1, Math.ceil(total / ARTICLES_PER_PAGE));
      const safePage = Number.isInteger(payload?.page) ? payload.page : currentPage;

      if (listRequestRef.current !== requestId) return;

      setListArticles(items);
      setListTotal(total);
      setListTotalPages(totalPages);

      if (safePage !== currentPage) {
        setListSearchParams({ page: String(safePage) });
      }
    } catch (error) {
      if (listRequestRef.current !== requestId) return;
      setListError(error?.message || 'Грешка при зареждане на статии');
      setListArticles([]);
      setListTotal(0);
      setListTotalPages(1);
    } finally {
      if (listRequestRef.current === requestId) {
        setListLoading(false);
      }
    }
  }, [ARTICLES_PER_PAGE, currentPage, deferredSearchQuery, filterCat]);

  const resolveArticleForMutation = useCallback(async (id) => {
    const normalizedId = Number(id);
    const fromList = listArticles.find((item) => Number(item?.id) === normalizedId);
    if (fromList) return fromList;
    const fromMap = relatedArticleIdMap.get(normalizedId);
    if (fromMap) return fromMap;
    try {
      const detailed = await api.articles.getById(normalizedId);
      return detailed && typeof detailed === 'object' ? detailed : null;
    } catch {
      return null;
    }
  }, [listArticles, relatedArticleIdMap]);

  const hasDraftUnsavedChanges = useMemo(() => {
    if (editing === 'new') return form.title !== '' || form.content !== '<p></p>';
    if (!lastServerVersion) return false;
    const ref = lastServerVersion;
    const refTags = Array.isArray(ref.tags)
      ? ref.tags.join(', ')
      : (typeof ref.tags === 'string' ? ref.tags : '');
    const formTags = Array.isArray(form.tags)
      ? form.tags.join(', ')
      : (typeof form.tags === 'string' ? form.tags : '');
    const refRelated = Array.isArray(ref.relatedArticles) ? ref.relatedArticles.join(',') : '';
    const formRelated = Array.isArray(form.relatedArticles) ? form.relatedArticles.join(',') : '';

    return ref.title !== form.title || ref.slug !== form.slug || ref.excerpt !== form.excerpt || ref.content !== form.content
      || ref.category !== form.category || ref.authorId !== form.authorId
      || ref.image !== form.image || ref.status !== form.status
      || localInputToIso(ref.publishAt) !== localInputToIso(form.publishAt)
      || refTags !== formTags
      || JSON.stringify(ref.imageMeta || null) !== JSON.stringify(form.imageMeta || null)
      || ref.cardSticker !== form.cardSticker
      || Boolean(ref.sponsored) !== Boolean(form.sponsored)
      || ref.shareTitle !== form.shareTitle || ref.shareSubtitle !== form.shareSubtitle
      || ref.shareBadge !== form.shareBadge || ref.shareAccent !== form.shareAccent
      || ref.shareImage !== form.shareImage
      || refRelated !== formRelated;
  }, [editing, form, lastServerVersion]);

  const computedReadTime = useMemo(
    () => estimateReadTimeFromHtml(form.content || form.excerpt || ''),
    [form.content, form.excerpt]
  );

  const normalizedPreviewContent = useMemo(
    () => normalizeRichTextHtml(form.content || ''),
    [form.content]
  );

  const draftSavedLabel = useMemo(() => {
    if (!draftSavedAt) return null;
    try {
      return new Date(draftSavedAt).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [draftSavedAt]);

  const autosavedLabel = useMemo(() => {
    if (!autosavedAt) return null;
    try {
      return new Date(autosavedAt).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [autosavedAt]);

  const currentRevisionItems = useMemo(() => {
    if (!editing || editing === 'new') return [];
    return articleRevisions[Number(editing)] || [];
  }, [articleRevisions, editing]);

  const authorNameMap = useMemo(() => new Map(authors.map((author) => [Number(author.id), author.name])), [authors]);
  const categoryNameMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  const currentDraftSnapshot = useMemo(() => ({
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    content: normalizeRichTextHtml(form.content || ''),
    category: form.category,
    authorId: Number(form.authorId) || 1,
    date: form.date,
    readTime: Number(form.readTime) || 0,
    image: form.image,
    imageMeta: form.imageMeta || null,
    youtubeUrl: form.youtubeUrl || '',
    featured: Boolean(form.featured),
    breaking: Boolean(form.breaking),
    sponsored: Boolean(form.sponsored),
    hero: Boolean(form.hero),
    tags: typeof form.tags === 'string'
      ? form.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      : (Array.isArray(form.tags) ? form.tags : []),
    status: form.status === 'draft' ? 'draft' : 'published',
    publishAt: localInputToIso(form.publishAt),
    views: Number(form.views) || 0,
    cardSticker: form.cardSticker || '',
    shareTitle: form.shareTitle || '',
    shareSubtitle: form.shareSubtitle || '',
    shareBadge: form.shareBadge || '',
    shareAccent: form.shareAccent || 'auto',
    shareImage: form.shareImage || '',
    relatedArticles: form.relatedArticles || [],
  }), [form]);

  const revisionCompare = useMemo(() => {
    if (!editing || editing === 'new' || selectedRevisionIds.length === 0) return null;

    const leftRevisionId = selectedRevisionIds[0];
    const rightRevisionId = selectedRevisionIds[1] || null;
    const leftRevision = revisionDetailsById[leftRevisionId];
    const rightRevision = rightRevisionId ? revisionDetailsById[rightRevisionId] : null;

    if (!leftRevision?.snapshot) return null;
    if (rightRevisionId && !rightRevision?.snapshot) return null;

    const leftSnapshot = leftRevision.snapshot;
    const rightSnapshot = rightRevisionId ? rightRevision.snapshot : currentDraftSnapshot;

    const formatValue = (key, value) => {
      const normalized = normalizeCompareValue(key, value);
      if (!normalized) return '—';
      if (key === 'authorId') return authorNameMap.get(Number(normalized)) || normalized;
      if (key === 'category') return categoryNameMap.get(normalized) || normalized;
      if (key === 'featured' || key === 'breaking' || key === 'sponsored' || key === 'hero') return normalized === '1' ? 'Да' : 'Не';
      if (key === 'status') return normalized === 'draft' ? 'Чернова' : 'Публикувана';
      if (key === 'publishAt') {
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime())
          ? normalized
          : parsed.toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });
      }
      if (key === 'content' || key === 'excerpt') {
        return normalized.length > 170 ? `${normalized.slice(0, 170)}...` : normalized;
      }
      return normalized;
    };

    const rows = REVISION_COMPARE_FIELDS.map(({ key, label }) => {
      const leftRaw = normalizeCompareValue(key, leftSnapshot?.[key]);
      const rightRaw = normalizeCompareValue(key, rightSnapshot?.[key]);
      return {
        key,
        label,
        changed: leftRaw !== rightRaw,
        left: formatValue(key, leftSnapshot?.[key]),
        right: formatValue(key, rightSnapshot?.[key]),
      };
    }).filter(row => row.changed);

    const leftLabel = `v${leftRevision.version} (${leftRevision.source})`;
    const rightLabel = rightRevisionId
      ? `v${rightRevision.version} (${rightRevision.source})`
      : 'Текуща форма';

    return { rows, leftLabel, rightLabel };
  }, [editing, selectedRevisionIds, revisionDetailsById, currentDraftSnapshot, authorNameMap, categoryNameMap]);

  const compareLoadError = useMemo(
    () => selectedRevisionIds.some((revisionId) => revisionDetailsById[revisionId]?.error),
    [selectedRevisionIds, revisionDetailsById]
  );

  const loadDraft = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(ARTICLE_DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        ...emptyForm,
        ...parsed,
        authorId: Number(parsed.authorId) || emptyForm.authorId,
        readTime: Number(parsed.readTime) || emptyForm.readTime,
        views: Number(parsed.views) || 0,
        content: parsed.content || '<p></p>',
        publishAt: typeof parsed.publishAt === 'string' ? parsed.publishAt : '',
        _savedAt: parsed._savedAt || null,
      };
    } catch {
      return null;
    }
  };

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ARTICLE_DRAFT_KEY);
    }
    setDraftSavedAt(null);
  };

  const readHistory = () => {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(ARTICLE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  };

  const writeHistory = (nextItems) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ARTICLE_HISTORY_KEY, JSON.stringify(nextItems));
  };

  const loadHistoryForScope = (scope) => {
    const entries = readHistory().filter(item => item.scope === scope);
    setHistoryItems(entries);
  };

  const pushHistorySnapshot = (scope, snapshotForm) => {
    const entries = readHistory();
    const savedAt = new Date().toISOString();
    const next = [
      {
        id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
        scope,
        savedAt,
        snapshot: {
          ...snapshotForm,
          publishAt: snapshotForm.publishAt || '',
          content: snapshotForm.content || '<p></p>',
        },
      },
      ...entries,
    ].slice(0, 80);
    writeHistory(next);
    setHistoryItems(next.filter(item => item.scope === scope));
    return savedAt;
  };

  const restoreHistorySnapshot = (entry) => {
    if (!entry?.snapshot) return;
    setForm(normalizeArticleAdminForm(entry.snapshot, emptyForm));
  };

  useEffect(() => {
    if (editing !== 'new') return undefined;
    if (typeof window === 'undefined') return undefined;

    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const payload = {
        ...form,
        content: form.content || '<p></p>',
        _savedAt: savedAt,
      };
      window.localStorage.setItem(ARTICLE_DRAFT_KEY, JSON.stringify(payload));
      setDraftSavedAt(savedAt);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [editing, form]);

  useEffect(() => {
    if (!editing || editing === 'new') return undefined;
    const scope = getHistoryScope(editing);
    const timer = window.setTimeout(() => {
      const savedAt = pushHistorySnapshot(scope, form);
      setAutosavedAt(savedAt);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [editing, form]);

  useEffect(() => {
    if (!editing || editing === 'new') return undefined;
    const timer = window.setTimeout(async () => {
      try {
        await autosaveArticleRevision(editing, {
          title: form.title,
          excerpt: form.excerpt,
          content: normalizeRichTextHtml(form.content || ''),
          category: form.category,
          authorId: Number(form.authorId),
          date: form.date,
          readTime: Number(form.readTime),
          image: form.image,
          featured: Boolean(form.featured),
          breaking: Boolean(form.breaking),
          sponsored: Boolean(form.sponsored),
          hero: Boolean(form.hero),
          tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
          status: form.status,
          publishAt: localInputToIso(form.publishAt),
          views: Number(form.views) || 0,
          cardSticker: form.cardSticker || '',
        });
      } catch {
        // ignore autosave network errors to avoid blocking editing
      }
    }, 25000);
    return () => window.clearTimeout(timer);
  }, [autosaveArticleRevision, editing, form]);

  // Concurrent Edit Detection
  useEffect(() => {
    if (!editing || editing === 'new' || !lastServerVersion) return undefined;

    const interval = window.setInterval(async () => {
      try {
        const current = await api.articles.getById(editing);
        if (current && current.id === lastServerVersion.id) {
          const currentHash = JSON.stringify({ t: current.title, c: current.content, e: current.excerpt });
          const initialHash = JSON.stringify({ t: lastServerVersion.title, c: lastServerVersion.content, e: lastServerVersion.excerpt });

          if (currentHash !== initialHash) {
            setConcurrentWarning('Внимание: Статията е била променена на сървъра от друг редактор след като започнахте. Предварително запазете промените си някъде!');
          } else {
            setConcurrentWarning(null);
          }
        }
      } catch {
        // Ignore network errors during polling
      }
    }, 20000); // Check every 20 seconds

    return () => window.clearInterval(interval);
  }, [editing, lastServerVersion]);

  useEffect(() => {
    setSelectedRevisionIds([]);
    setRevisionDetailsById({});
    setLoadingRevisionDetails({});
  }, [editing]);

  useEffect(() => {
    if (!editing || editing === 'new') return undefined;
    const pendingRevisionIds = selectedRevisionIds.filter((revisionId) => (
      !Object.prototype.hasOwnProperty.call(revisionDetailsById, revisionId) && !loadingRevisionDetails[revisionId]
    ));
    if (pendingRevisionIds.length === 0) return undefined;

    let cancelled = false;
    pendingRevisionIds.forEach(async (revisionId) => {
      setLoadingRevisionDetails(prev => ({ ...prev, [revisionId]: true }));
      try {
        const detail = await api.articles.getRevision(editing, revisionId);
        if (!cancelled && detail) {
          setRevisionDetailsById(prev => ({ ...prev, [revisionId]: detail }));
        }
      } catch {
        if (!cancelled) {
          setRevisionDetailsById(prev => ({ ...prev, [revisionId]: { error: true } }));
        }
      } finally {
        if (!cancelled) {
          setLoadingRevisionDetails(prev => ({ ...prev, [revisionId]: false }));
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [editing, selectedRevisionIds, revisionDetailsById, loadingRevisionDetails]);

  const startNewArticle = () => {
    const draft = loadDraft();
    setEditing('new');
    setActiveTab('content');
    setLastServerVersion(null);
    setConcurrentWarning(null);
    setContentMode('write');
    setRelatedSearchQuery('');
    setAutosavedAt(null);
    setValidationErrors({});
    loadHistoryForScope('new');
    if (draft) {
      const normalizedDraft = normalizeArticleAdminForm(draft, emptyForm);
      setForm(normalizedDraft);
      initialFormRef.current = normalizedDraft;
      setDraftSavedAt(draft._savedAt);
      return;
    }
    setForm(emptyForm);
    initialFormRef.current = emptyForm;
    setDraftSavedAt(null);
  };

  // Auto-load prefill from Tip Line
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const prefill = readIncomingArticlePrefill();
      if (prefill) {
        setEditing('new');
        setContentMode('write');
        setAutosavedAt(null);
        setValidationErrors({});
        loadHistoryForScope('new');
        const normalizedPrefill = normalizeArticleAdminForm(prefill, emptyForm);
        setForm(normalizedPrefill);
        initialFormRef.current = normalizedPrefill;
        clearIncomingArticlePrefill();
      }
    } catch {
      clearIncomingArticlePrefill();
    }
  }, []);

  const syncRightOfReplyRequest = useCallback(async (intakeMeta, articleRecord, articleStatus) => {
    const normalizedMeta = getRightOfReplyIntakeMeta(intakeMeta);
    const responseArticleId = Number.parseInt(String(articleRecord?.id || ''), 10);
    if (!normalizedMeta || !Number.isInteger(responseArticleId) || responseArticleId <= 0) return false;

    const responseArticleStatus = articleStatus === 'archived'
      ? 'archived'
      : articleStatus === 'draft'
        ? 'draft'
        : 'published';

    await api.contactMessages.update(normalizedMeta.requestId, {
      status: responseArticleStatus === 'published' ? 'archived' : 'read',
      responseArticleId,
      responseArticleStatus,
      relatedArticleId: normalizedMeta.relatedArticleId,
      relatedArticleTitle: normalizedMeta.relatedArticleTitle,
    });
    return true;
  }, []);

  const validateForm = useCallback(() => {
    const errors = {};
    const isPublishing = form.status === 'published';
    const normalizedContent = (form.content || '').replace(/<[^>]*>?/gm, '').trim();
    const normalizedTitle = trimArticleAdminText(form.title);
    const normalizedExcerpt = trimArticleAdminText(form.excerpt);

    if (isPublishing) {
      if (!normalizedTitle) errors.title = 'Заглавието е задължително за публикувана статия';
      if (!normalizedExcerpt) errors.excerpt = 'Резюмето е задължително за публикувана статия';
      if (!normalizedContent) errors.content = 'Съдържанието не може да е празно за публикувана статия';
      else if (normalizedContent.length < 50) errors.content = 'Съдържанието е твърде кратко за публикувана статия (минимум 50 символа чист текст)';
      if (!form.category || form.category === 'all') errors.category = 'Категорията е задължителна';
      if (!form.authorId) errors.authorId = 'Авторът е задължителен';
      if (!form.image) errors.image = 'Основната снимка е задължителна';
    } else {
      if (!normalizedTitle) errors.title = 'Заглавието е задължително дори и за чернова';
    }

    return errors;
  }, [form.title, form.excerpt, form.content, form.status, form.category, form.authorId, form.image]);

  const handleSave = async () => {
    const errors = validateForm();
    const firstInvalidField = Object.keys(errors)[0];
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusValidationField(firstInvalidField);
      toast.error('Моля поправи грешките преди запазване');
      return;
    }
    setSaving(true);
    try {
      const normalizedContent = normalizeRichTextHtml(form.content || '');
      const autoReadTime = estimateReadTimeFromHtml(normalizedContent || form.excerpt);
      const normalizedTitle = trimArticleAdminText(form.title);
      const normalizedExcerpt = trimArticleAdminText(form.excerpt);

      let finalSlug = form.slug;
      if (form.status === 'published' && !form.slug && form.title) {
        finalSlug = form.title
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9а-я-]/gi, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      }

      const data = {
        ...form,
        title: normalizedTitle,
        slug: finalSlug,
        excerpt: normalizedExcerpt,
        content: normalizedContent,
        authorId: Number(form.authorId),
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
        relatedArticles: Array.isArray(form.relatedArticles) ? form.relatedArticles : [],
        readTime: Number(form.readTime) > 0 ? Number(form.readTime) : autoReadTime,
        views: Number(form.views) || 0,
        publishAt: localInputToIso(form.publishAt),
        cardSticker: (form.cardSticker || '').trim(),
      };
      const intakeMeta = getRightOfReplyIntakeMeta(form.intakeMeta);
      let savedArticle = null;

      if (editing === 'new') {
        savedArticle = await addArticle(data);
        clearDraft();
        setListSearchParams({ page: '1' });
        toast.success('Статията е създадена успешно');
      } else {
        savedArticle = await updateArticle(editing, data);
        await loadArticleRevisions(editing);
        toast.success('Промените са запазени');
      }

      if (intakeMeta) {
        try {
          await syncRightOfReplyRequest(intakeMeta, savedArticle, data.status);
        } catch (syncError) {
          console.error('Failed to sync right-of-reply intake request:', syncError);
          toast.warning('Статията е запазена, но заявката за право на отговор не беше обновена');
        }
      }

      refreshList();

      setEditing(null);
      setForm(emptyForm);
      setContentMode('write');
      setRelatedSearchQuery('');
      setDraftSavedAt(null);
      setAutosavedAt(null);
      setHistoryItems([]);
      setLastServerVersion(null);
      setConcurrentWarning(null);
      setLoadingRevisions(false);
      setValidationErrors({});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Архивиране на статия',
      message: 'Статията ще бъде преместена в архива. Може да бъде възстановена по-късно.',
      confirmLabel: 'Архивирай',
      variant: 'warning',
    });
    if (!confirmed) return;
    await deleteArticle(id);
    setSelectedIds(prev => prev.filter(sid => sid !== id));
    refreshList();
    toast.success('Статията е архивирана');
  };

  // Bulk actions
  const toggleSelectId = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAllOnPage = () => {
    const pageIds = listArticles.map(a => a.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter(id => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])]);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = await confirm({
      title: 'Архивиране на статии',
      message: `${selectedIds.length} статии ще бъдат преместени в архива.`,
      confirmLabel: 'Архивирай',
      variant: 'warning',
    });
    if (!confirmed) return;
    for (const id of selectedIds) await deleteArticle(id);
    refreshList();
    toast.success(`${selectedIds.length} статии архивирани`);
    setSelectedIds([]);
  };

  const loadArchivedArticles = useCallback(async () => {
    setLoadingArchived(true);
    try {
      const data = await api.articles.listArchived();
      setArchivedArticles(Array.isArray(data) ? data : data?.items || []);
    } catch {
      toast.error('Грешка при зареждане на архива');
    } finally {
      setLoadingArchived(false);
    }
  }, [toast]);

  const handleRestoreArticle = async (id) => {
    try {
      await api.articles.restore(id);
      setArchivedArticles(prev => prev.filter(a => a.id !== id));
      setListSearchParams({ view: '', page: '1' });
      refreshList();
      void refresh().catch((err) => { console.warn('Refresh after restore failed:', err); });
      toast.success('Статията е възстановена като чернова');
    } catch {
      toast.error('Грешка при възстановяване');
    }
  };

  const handlePermanentDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Окончателно изтриване',
      message: 'Статията и всички ревизии ще бъдат изтрити безвъзвратно!',
      confirmLabel: 'Изтрий завинаги',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await api.articles.permanentDelete(id);
      setArchivedArticles(prev => prev.filter(a => a.id !== id));
      refreshList();
      toast.success('Статията е изтрита окончателно');
    } catch {
      toast.error('Грешка при изтриване');
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (!selectedIds.length) return;
    const label = newStatus === 'published' ? 'публикувани' : 'върнати в чернова';
    for (const id of selectedIds) {
      const article = await resolveArticleForMutation(id);
      if (article) await updateArticle(id, { ...article, status: newStatus });
    }
    refreshList();
    toast.success(`${selectedIds.length} статии ${label}`);
    setSelectedIds([]);
  };

  const startEdit = async (article) => {
    let resolvedArticle = article;
    if (!article?.content) {
      try {
        const detailed = await api.articles.getById(article.id);
        if (detailed && typeof detailed === 'object') {
          resolvedArticle = { ...article, ...detailed };
        }
      } catch {
        toast.error('Не успяхме да заредим пълната статия за редакция. Опитайте отново.');
        return;
      }
    }

    if (!resolvedArticle?.content) {
      toast.error('Липсва пълното съдържание на статията и редакцията е спряна.');
      return;
    }

    setEditing(article.id);
    setActiveTab('content');
    setContentMode('write');
    setRelatedSearchQuery('');
    setDraftSavedAt(null);
    setAutosavedAt(null);
    loadHistoryForScope(getHistoryScope(article.id));
    const resolvedForm = normalizeArticleAdminForm({
      ...resolvedArticle,
      content: resolvedArticle.content || '<p></p>',
      tags: Array.isArray(resolvedArticle.tags) ? resolvedArticle.tags.join(', ') : resolvedArticle.tags || '',
      publishAt: dateTimeToLocalInput(resolvedArticle.publishAt),
      cardSticker: resolvedArticle.cardSticker || '',
      shareTitle: resolvedArticle.shareTitle || '',
      shareSubtitle: resolvedArticle.shareSubtitle || '',
      shareBadge: resolvedArticle.shareBadge || '',
      shareAccent: resolvedArticle.shareAccent || 'auto',
      shareImage: resolvedArticle.shareImage || '',
    }, emptyForm);
    setForm(resolvedForm);
    initialFormRef.current = resolvedForm;
    setLastServerVersion(resolvedForm);
    setConcurrentWarning(null);
    setValidationErrors({});
    setLoadingRevisions(true);
    try {
      await loadArticleRevisions(article.id);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleCancel = async () => {
    if (hasDraftUnsavedChanges) {
      const confirmed = await confirm({
        title: 'Незапазени промени',
        message: 'Имаш незапазени промени. Сигурен ли си, че искаш да излезеш?',
        confirmLabel: 'Излез без запис',
        variant: 'warning',
      });
      if (!confirmed) return;
    }
    setEditing(null);
    setActiveTab('content');
    setForm(emptyForm);
    setContentMode('write');
    setRelatedSearchQuery('');
    setHistoryItems([]);
    setAutosavedAt(null);
    setDraftSavedAt(null);
    setLastServerVersion(null);
    setConcurrentWarning(null);
    setLoadingRevisions(false);
    setValidationErrors({});
  };

  const setAutoReadTime = () => {
    setForm(prev => ({ ...prev, readTime: computedReadTime }));
  };

  const handleRestoreServerRevision = async (revisionId) => {
    if (!editing || editing === 'new') return;
    const confirmed = await confirm({
      title: 'Възстановяване на версия',
      message: 'Възстанови тази версия? Текущите незапазени промени ще бъдат заменени.',
      confirmLabel: 'Възстанови',
      variant: 'warning',
    });
    if (!confirmed) return;
    setRestoringRevision(revisionId);
    try {
      const restored = await restoreArticleRevision(editing, revisionId);
      if (!restored) return;
      const normalizedRestoredForm = normalizeArticleAdminForm({
        ...restored,
        content: restored.content || '<p></p>',
        tags: Array.isArray(restored.tags) ? restored.tags.join(', ') : restored.tags || '',
        publishAt: dateTimeToLocalInput(restored.publishAt),
        cardSticker: restored.cardSticker || '',
        shareTitle: restored.shareTitle || '',
        shareSubtitle: restored.shareSubtitle || '',
        shareBadge: restored.shareBadge || '',
        shareAccent: restored.shareAccent || 'auto',
        shareImage: restored.shareImage || '',
      }, emptyForm);
      setForm(normalizedRestoredForm);
      initialFormRef.current = normalizedRestoredForm;
      setSelectedRevisionIds([]);
      setRevisionDetailsById({});
      setLoadingRevisionDetails({});
    } finally {
      setRestoringRevision(null);
    }
  };

  const toggleRevisionCompareSelection = (revisionId) => {
    setSelectedRevisionIds((prev) => {
      if (prev.includes(revisionId)) return prev.filter((id) => id !== revisionId);
      return [revisionId, ...prev].slice(0, 2);
    });
  };

  const getAuthorName = (id) => {
    const normalizedId = Number(id);
    return authors.find(a => Number(a?.id) === normalizedId)?.name || 'Неизвестен';
  };
  const getCategoryLabel = (catId) => categories.find(c => c.id === catId)?.name || catId;

  // Feature 7: Auto-generate excerpt from content
  const autoGenerateExcerpt = () => {
    const text = (form.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    const excerpt = sentences ? sentences.slice(0, 2).join(' ').trim() : text.slice(0, 200);
    setForm(prev => ({ ...prev, excerpt }));
  };

  // Feature 6: Quick status toggle
  const handleQuickStatusToggle = async (article) => {
    const newStatus = article.status === 'draft' ? 'published' : 'draft';
    await updateArticle(article.id, { ...article, status: newStatus });
    refreshList();
    toast.success(newStatus === 'published' ? 'Статията е публикувана' : 'Статията е в чернова');
  };

  // Feature 8: Duplicate article
  const handleDuplicate = async (article) => {
    let fullArticle = article;
    if (!article.content) {
      try {
        const detailed = await api.articles.getById(article.id);
        if (detailed) fullArticle = { ...article, ...detailed };
      } catch { /* use partial */ }
    }
    const dup = {
      ...fullArticle,
      title: `${trimArticleAdminText(fullArticle.title) || 'Статия'} (копие)`,
      status: 'draft',
      featured: false,
      breaking: false,
      sponsored: false,
      hero: false,
      date: new Date().toISOString().slice(0, 10),
      views: 0,
      publishAt: null,
    };
    delete dup.id;
    await addArticle(dup);
    setListSearchParams({ page: '1' });
    refreshList();
    toast.success('Статията е дублирана като чернова');
  };

  // Feature 1: Ctrl+S keyboard shortcut
  useEffect(() => {
    if (!editing) return undefined;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, handleSave]);

  // Feature 2: beforeunload warning
  useEffect(() => {
    if (!hasDraftUnsavedChanges) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDraftUnsavedChanges]);

  useEffect(() => {
    if (showArchived) return undefined;
    loadArticlePage();
    return undefined;
  }, [loadArticlePage, listReloadNonce, showArchived]);

  useEffect(() => {
    if (!showArchived) return undefined;
    loadArchivedArticles();
    return undefined;
  }, [loadArchivedArticles, showArchived]);

  useEffect(() => {
    loadAdminMeta();
  }, [loadAdminMeta, listReloadNonce]);

  useEffect(() => {
    if (!editing) {
      setRelatedSearchQuery('');
      setRelatedOptions([]);
      setRelatedOptionsLoading(false);
      return undefined;
    }

    const requestId = relatedRequestRef.current + 1;
    relatedRequestRef.current = requestId;
    setRelatedOptionsLoading(true);

    const params = {
      limit: 20,
      excludeId: editing !== 'new' ? Number(editing) : undefined,
    };
    const query = deferredRelatedSearchQuery.trim();
    if (query) params.q = query;

    api.articles.searchRelatedAdmin(params)
      .then((payload) => {
        if (relatedRequestRef.current !== requestId) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setRelatedOptions(items);
        mergeRelatedArticles(items);
      })
      .catch(() => {
        if (relatedRequestRef.current !== requestId) return;
        setRelatedOptions([]);
      })
      .finally(() => {
        if (relatedRequestRef.current === requestId) {
          setRelatedOptionsLoading(false);
        }
      });

    return undefined;
  }, [deferredRelatedSearchQuery, editing, mergeRelatedArticles]);

  useEffect(() => {
    if (!editing) return undefined;
    const ids = Array.isArray(form.relatedArticles)
      ? form.relatedArticles.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
      : [];
    if (ids.length === 0) return undefined;

    api.articles.searchRelatedAdmin({
      ids: ids.join(','),
      limit: ids.length,
      excludeId: editing !== 'new' ? Number(editing) : undefined,
    })
      .then((payload) => {
        mergeRelatedArticles(Array.isArray(payload?.items) ? payload.items : []);
      })
      .catch(() => {});

    return undefined;
  }, [editing, form.relatedArticles, mergeRelatedArticles]);

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  const labelCls = "block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1";

  // Scroll-to-top
  const topRef = useRef(null);
  const mainRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    mainRef.current = main;
    const onScroll = () => setShowScrollTop(main.scrollTop > 400);
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-8" ref={topRef}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Статии</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление на новини и репортажи</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !showArchived;
              setListSearchParams({ view: next ? 'archived' : '', page: '1' });
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-sans font-semibold border transition-colors ${showArchived ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'}`}
          >
            <Archive className="w-4 h-4" />
            Архив
          </button>
          {!showArchived && (
            <button
              onClick={startNewArticle}
              className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <Plus className="w-4 h-4" />
              Нова статия
            </button>
          )}
        </div>
      </div>

      {/* Archived articles view */}
      {showArchived && (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans font-semibold text-gray-900 flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-600" />
              Архивирани статии ({archivedArticles.length})
            </h3>
            <button onClick={loadArchivedArticles} disabled={loadingArchived} className="text-xs font-sans text-gray-500 hover:text-gray-700 flex items-center gap-1 disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${loadingArchived ? 'animate-spin' : ''}`} />
              Обнови
            </button>
          </div>
          {loadingArchived && <p className="text-sm font-sans text-gray-400 py-4 text-center">Зареждане...</p>}
          {!loadingArchived && archivedArticles.length === 0 && (
            <p className="text-sm font-sans text-gray-400 py-8 text-center">Няма архивирани статии</p>
          )}
          {!loadingArchived && archivedArticles.map((article) => (
            <div key={article.id} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-medium text-gray-900 truncate">{article.title || `Статия #${article.id}`}</p>
                <p className="text-[10px] font-sans text-gray-400 mt-0.5">
                  {article.deletedBy && <span>Архивирана от {article.deletedBy}</span>}
                  {article.deletedAt && <span> • {new Date(article.deletedAt).toLocaleDateString('bg-BG')}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleRestoreArticle(article.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  title="Възстанови като чернова"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  Възстанови
                </button>
                <button
                  onClick={() => handlePermanentDelete(article.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  title="Изтрий завинаги"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="bg-white border border-gray-200 pb-6 mb-6">
          {/* Sticky Header with Actions */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 px-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex-1 min-w-0">
              <h3 className="font-sans font-semibold text-gray-900 truncate">
                {editing === 'new' ? 'Нова статия' : 'Редактирай статия'}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-gray-500 mt-1">
                {editing === 'new' && draftSavedLabel && (
                  <span>Чернова записана в {draftSavedLabel}</span>
                )}
                {autosavedLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" />
                    История обновена в {autosavedLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-sans font-semibold hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <Eye className="w-4 h-4" /> Live Preview
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                aria-busy={saving}
                className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-sans font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white ${saving ? 'bg-zn-purple/60 cursor-not-allowed' : 'bg-zn-purple hover:bg-zn-purple-dark'}`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Запазване...' : 'Запази'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <X className="w-4 h-4" /> Откажи
              </button>
              {editing === 'new' && (
                <button
                  onClick={() => { clearDraft(); setForm(emptyForm); setAutosavedAt(null); loadHistoryForScope('new'); }}
                  className="flex items-center px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  title="Изчисти чернова"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {concurrentWarning && (
            <div className="mx-6 mt-6 p-4 bg-orange-50 border border-orange-200 text-orange-900 text-sm font-sans flex items-start gap-3 shadow-sm rounded-md">
              <svg className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <strong className="block mb-1 font-bold text-orange-800 text-base">Опасност от презаписване</strong>
                {concurrentWarning}
              </div>
            </div>
          )}

          <div className="px-6 border-b border-gray-200 bg-gray-50 flex gap-6 overflow-x-auto">
            <button type="button" onClick={() => setActiveTab('content')} className={`py-3 text-sm font-sans font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'content' ? 'border-zn-purple text-zn-purple' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Съдържание</button>
            <button type="button" onClick={() => setActiveTab('media')} className={`py-3 text-sm font-sans font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'media' ? 'border-zn-purple text-zn-purple' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Медия</button>
            <button type="button" onClick={() => setActiveTab('settings')} className={`py-3 text-sm font-sans font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'settings' ? 'border-zn-purple text-zn-purple' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Настройки</button>
            <button type="button" onClick={() => setActiveTab('seo')} className={`py-3 text-sm font-sans font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === 'seo' ? 'border-zn-purple text-zn-purple' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>SEO</button>
          </div>

          {Object.keys(validationErrors).length > 0 && (
            <div
              className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 text-red-800 text-sm font-sans"
              role="alert"
              aria-live="assertive"
            >
              <strong className="block mb-2 text-base">Грешки при валидация:</strong>
              <ul className="space-y-1">
                {Object.entries(validationErrors).map(([field, error]) => (
                  <li key={field}>
                    <button
                      type="button"
                      onClick={() => focusValidationField(field)}
                      className="text-left hover:underline underline-offset-2"
                    >
                      <span className="font-semibold uppercase text-xs mr-2 opacity-70">
                        {VALIDATION_FIELD_LABELS[field] || field}
                      </span>
                      {error}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-6">
            {/* CONTENT TAB */}
            <div className={activeTab === 'content' ? 'block' : 'hidden'}>
              <div className="space-y-6 max-w-full">
                <div ref={registerFieldRef('title')}>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Заглавие <span className="text-red-500">*</span></label>
                    <span className={`text-[10px] font-sans tabular-nums ${form.title.length > 100 ? 'text-amber-600' : 'text-gray-400'}`}>{form.title.length}/120</span>
                  </div>
                  <input id="article-title" className={inputCls + (validationErrors.title ? ' !border-red-400 bg-red-50/30' : '')} value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); clearValidationError('title'); }} placeholder="Заглавие на статията" aria-invalid={validationErrors.title ? 'true' : 'false'} aria-describedby={validationErrors.title ? 'article-title-error' : undefined} />
                  {validationErrors.title && <p id="article-title-error" className="text-xs text-red-500 mt-1 font-sans">{validationErrors.title}</p>}
                </div>
                <div ref={registerFieldRef('excerpt')}>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Резюме <span className="text-red-500">*</span></label>
                    <button type="button" onClick={autoGenerateExcerpt} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zn-purple text-zn-purple bg-zn-purple/5 hover:bg-zn-purple/10 text-[10px] font-sans font-bold uppercase tracking-wider transition-colors mb-2" title="Генерирай от съдържанието">✨ AI Резюме</button>
                  </div>
                  <textarea id="article-excerpt" className={inputCls + ' h-20 resize-none ' + (validationErrors.excerpt ? ' !border-red-400 bg-red-50/30' : '')} value={form.excerpt} onChange={e => { setForm({ ...form, excerpt: e.target.value }); clearValidationError('excerpt'); }} placeholder="Кратко описание..." aria-invalid={validationErrors.excerpt ? 'true' : 'false'} aria-describedby={validationErrors.excerpt ? 'article-excerpt-error' : undefined} />
                  {validationErrors.excerpt && <p id="article-excerpt-error" className="text-xs text-red-500 mt-1 font-sans">{validationErrors.excerpt}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelCls + ' mb-0'}>Съдържание</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setContentMode('write')}
                        className={`px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-wider border transition-colors ${contentMode === 'write' ? 'bg-zn-purple text-white border-zn-purple' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                      >
                        Редактор
                      </button>
                      <button
                        type="button"
                        onClick={() => setContentMode('preview')}
                        className={`px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-wider border transition-colors ${contentMode === 'preview' ? 'bg-zn-purple text-white border-zn-purple' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                      >
                        Преглед
                      </button>
                    </div>
                  </div>

                  {contentMode === 'write' ? (
                    <div
                      ref={registerFieldRef('content')}
                      tabIndex={-1}
                      aria-invalid={validationErrors.content ? 'true' : 'false'}
                      aria-describedby={validationErrors.content ? 'article-content-error' : undefined}
                      className={`overflow-hidden border rounded-sm shadow-sm ${validationErrors.content ? 'border-red-400' : 'border-gray-200'}`}
                    >
                      <Suspense fallback={(
                        <div className="flex min-h-[500px] items-center justify-center bg-white text-sm font-sans text-gray-500">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Зареждане на редактора...
                        </div>
                      )}>
                        <LazyRichTextEditor
                          className="min-h-[500px] border-none"
                          value={form.content}
                          onChange={(nextHtml) => { setForm(prev => ({ ...prev, content: nextHtml })); clearValidationError('content'); }}
                          placeholder="Напиши текста на статията..."
                        />
                      </Suspense>
                    </div>
                  ) : (
                    <div className="border border-gray-200 min-h-[500px] p-6 bg-white overflow-auto shadow-sm">
                      <div
                        className="article-body prose prose-lg max-w-none [&_p]:font-sans [&_p]:leading-relaxed [&_p]:mb-4 [&_h2]:font-display [&_h2]:font-black [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-display [&_h3]:font-bold [&_h3]:mt-5 [&_h3]:mb-2 [&_h4]:font-display [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-zn-purple [&_blockquote]:pl-4 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-zn-hot [&_a]:underline [&_img]:w-full [&_img]:h-auto [&_img]:my-6 [&_img]:rounded-sm [&_img]:border [&_img]:border-gray-200"
                        dangerouslySetInnerHTML={{ __html: normalizedPreviewContent }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] font-sans text-gray-400">
                      Разрешени формати: bold, italic, underline, strike, H2/H3/H4, списъци, цитат, линк и снимки от медийната библиотека.
                    </p>
                  </div>
                  {validationErrors.content && <p id="article-content-error" className="text-xs text-red-500 mt-1 font-sans">{validationErrors.content}</p>}
                </div>

                {/* Revision history inside the Editor column if editing */}
                <div className={`grid gap-4 mt-8 ${editing === 'new' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                  {/* Autosave History Block */}
                  <div className="border border-gray-200 bg-gray-50/60 p-4">
                    <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-3 inline-flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      Локални чернови
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {historyItems.slice(0, 12).map((entry) => (
                        <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-gray-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-sans font-semibold text-gray-700 truncate">
                              {entry.snapshot?.title || 'Без заглавие'}
                            </p>
                            <p className="text-[10px] font-sans text-gray-400">
                              {new Date(entry.savedAt).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => restoreHistorySnapshot(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-sans font-semibold text-zn-purple border border-zn-purple/30 hover:bg-zn-purple/5 transition-colors self-start sm:self-auto"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Върни
                          </button>
                        </div>
                      ))}
                      {historyItems.length === 0 && (
                        <p className="text-xs font-sans text-gray-400 py-2">Няма локални записи.</p>
                      )}
                    </div>
                  </div>

                  {/* Server Revisions */}
                  {editing !== 'new' && (
                    <div className="border border-gray-200 bg-gray-50/60 p-4">
                      <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-3 inline-flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" />
                        Сървърни версии
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {loadingRevisions && <p className="text-xs font-sans text-gray-400 py-2">Зареждане...</p>}
                        {!loadingRevisions && currentRevisionItems.slice(0, 20).map((revision) => (
                          <div key={revision.revisionId} className={`flex flex-col gap-2 border px-3 py-2 ${selectedRevisionIds.includes(revision.revisionId) ? 'border-zn-purple/40 bg-zn-purple/5' : 'border-gray-200 bg-white'}`}>
                            <div className="min-w-0">
                              <p className="text-xs font-sans font-semibold text-gray-700 truncate">
                                v{revision.version} · {revision.title || 'Без заглавие'}
                              </p>
                              <p className="text-[10px] font-sans text-gray-400 mt-0.5">
                                {revision.source} · {new Date(revision.createdAt).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleRevisionCompareSelection(revision.revisionId)}
                                className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-sans font-semibold border transition-colors ${selectedRevisionIds.includes(revision.revisionId) ? 'text-zn-purple border-zn-purple/40 bg-white' : 'text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-50'}`}
                              >
                                {loadingRevisionDetails[revision.revisionId] ? '...' : selectedRevisionIds.includes(revision.revisionId) ? 'Избрана' : 'Сравни'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRestoreServerRevision(revision.revisionId)}
                                disabled={restoringRevision === revision.revisionId}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-sans font-semibold text-zn-purple border border-zn-purple/30 hover:bg-white transition-colors disabled:opacity-50 bg-white"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Restore
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Revision Comparison Details */}
                {selectedRevisionIds.length > 0 && (
                  <div className="mt-4 border border-gray-200 bg-white p-4">
                    <RevisionComparePanel
                      title={`Сравнение на версии ${selectedRevisionIds.length === 1 ? '(избрана срещу текуща форма)' : '(две избрани)'}`}
                      compare={revisionCompare}
                      loading={!revisionCompare && !compareLoadError}
                      error={compareLoadError ? 'Някоя от избраните версии не успя да се зареди.' : ''}
                      emptyMessage="Няма открити разлики."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* MEDIA TAB */}
            <div className={activeTab === 'media' ? 'block' : 'hidden'}>
              <div className="space-y-6 max-w-4xl">
                <div
                  ref={registerFieldRef('image')}
                  tabIndex={-1}
                  aria-invalid={validationErrors.image ? 'true' : 'false'}
                  aria-describedby={validationErrors.image ? 'article-image-error' : undefined}
                  className={`p-4 border bg-gray-50/30 ${validationErrors.image ? 'border-red-300 bg-red-50/20' : 'border-gray-200'}`}
                >
                  <Suspense fallback={(
                    <div className="flex h-64 items-center justify-center rounded border border-dashed border-gray-300 bg-white text-sm font-sans text-gray-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Зареждане на полето за снимка...
                    </div>
                  )}>
                    <LazyAdminImageField
                      label="Основна Снимка"
                      required
                      value={form.image}
                      onChange={(nextValue) => { setForm(prev => ({ ...prev, image: nextValue })); clearValidationError('image'); }}
                      imageMeta={form.imageMeta}
                      onChangeMeta={(nextMeta) => { setForm(prev => ({ ...prev, imageMeta: nextMeta })); clearValidationError('image'); }}
                      helperText="Избери снимка (16:9 препоръчително) или качи нова от компютъра."
                      previewClassName="h-64"
                    />
                  </Suspense>
                  {validationErrors.image && <p id="article-image-error" className="text-xs text-red-500 mt-3 font-sans">{validationErrors.image}</p>}
                </div>

                <div className="p-4 border border-gray-200 bg-gray-50/30">
                  <label className={labelCls}>YouTube Линк (Опционално)</label>
                  <input
                    className={inputCls}
                    value={form.youtubeUrl || ''}
                    onChange={e => setForm({ ...form, youtubeUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Ако добавиш линк, видеото ще се покаже вместо или над основната снимка.</p>
                </div>
              </div>
            </div>

            {/* SETTINGS TAB */}
            <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
              <div className="space-y-6 max-w-4xl">
                <div className="p-4 border border-gray-200 bg-gray-50/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Статус на публикацията</label>
                    <select className={inputCls + ' font-semibold'} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="published">🟢 Публикувана (излиза на сайта)</option>
                      <option value="draft">🟡 Чернова (скрита от читателите)</option>
                    </select>
                  </div>
                  <div ref={registerFieldRef('category')}>
                    <label className={labelCls}>Категория</label>
                    <select className={inputCls + (validationErrors.category ? ' !border-red-400 bg-red-50/30' : '')} value={form.category} onChange={e => { setForm({ ...form, category: e.target.value }); clearValidationError('category'); }} aria-invalid={validationErrors.category ? 'true' : 'false'} aria-describedby={validationErrors.category ? 'article-category-error' : undefined}>
                      {categories.filter(c => c.id !== 'all').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {validationErrors.category && <p id="article-category-error" className="text-xs text-red-500 mt-1 font-sans">{validationErrors.category}</p>}
                  </div>
                  <div ref={registerFieldRef('authorId')}>
                    <label className={labelCls}>Автор</label>
                    <select className={inputCls + (validationErrors.authorId ? ' !border-red-400 bg-red-50/30' : '')} value={form.authorId} onChange={e => { setForm({ ...form, authorId: e.target.value }); clearValidationError('authorId'); }} aria-invalid={validationErrors.authorId ? 'true' : 'false'} aria-describedby={validationErrors.authorId ? 'article-author-error' : undefined}>
                      {authors.map(a => (
                        <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                      ))}
                    </select>
                    {validationErrors.authorId && <p id="article-author-error" className="text-xs text-red-500 mt-1 font-sans">{validationErrors.authorId}</p>}
                  </div>
                </div>

                <div className="p-4 border border-gray-200 bg-gray-50/30 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white border border-transparent hover:border-gray-200 transition-all">
                    <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} className="w-5 h-5 accent-amber-500 cursor-pointer" />
                    <div>
                      <span className="flex items-center gap-1.5 text-sm font-sans font-semibold text-gray-900">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Водеща статия (Featured)
                      </span>
                      <p className="text-xs font-sans text-gray-500 mt-0.5">Показва се първа в категорията си и е по-забележима.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white border border-transparent hover:border-gray-200 transition-all">
                    <input type="checkbox" checked={form.breaking} onChange={e => setForm({ ...form, breaking: e.target.checked })} className="w-5 h-5 accent-red-600 cursor-pointer" />
                    <div>
                      <span className="flex items-center gap-1.5 text-sm font-sans font-semibold text-red-600">
                        Извънредна новина (Breaking)
                      </span>
                      <p className="text-xs font-sans text-gray-500 mt-0.5">Ще бъде маркирана с червена лента.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white border border-transparent hover:border-gray-200 transition-all">
                    <input type="checkbox" checked={form.sponsored} onChange={e => setForm({ ...form, sponsored: e.target.checked })} className="w-5 h-5 accent-emerald-600 cursor-pointer" />
                    <div>
                      <span className="flex items-center gap-1.5 text-sm font-sans font-semibold text-emerald-700">
                        💰 Платена публикация (Sponsored)
                      </span>
                      <p className="text-xs font-sans text-gray-500 mt-0.5">Ще бъде маркирана с етикет „Платена публикация".</p>
                    </div>
                  </label>
                </div>

                <div className="p-4 border border-gray-200 bg-gray-50/30 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Тагове (ключови думи)</label>
                    <input className={inputCls} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="криминал, съд, полиция (разделени със запетая)" />
                    {allExistingTags.length > 0 && (
                      <div className="mt-2 text-xs font-sans">
                        <span className="text-gray-500 mr-2 font-semibold uppercase tracking-wider text-[10px]">Чести тагове:</span>
                        <div className="inline-flex flex-wrap gap-1.5 mt-1">
                          {allExistingTags.slice(0, 15).map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleAddTag(tag)}
                              className="px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 hover:bg-zn-purple hover:text-white transition-colors rounded-sm"
                            >
                              +{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Етикет за картите (Опционално)</label>
                    <input
                      className={inputCls}
                      value={form.cardSticker || ''}
                      onChange={e => setForm({ ...form, cardSticker: e.target.value })}
                      placeholder="Напр. Фронт, Досие, Акцент"
                      maxLength={24}
                    />
                    <p className="text-[10px] text-gray-500 mt-1 font-sans">
                      Ако е празно, сайтът ползва автоматичен етикет според секцията.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Оригинална дата</label>
                    <input className={inputCls} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Време за четене (мин)</label>
                    <div className="flex gap-2">
                      <input className={inputCls} type="number" min="1" value={form.readTime} onChange={e => setForm({ ...form, readTime: Number(e.target.value) || 1 })} placeholder="3" />
                      <button
                        type="button"
                        onClick={setAutoReadTime}
                        className="px-3 py-2 text-xs font-sans font-semibold text-zn-purple border border-zn-purple/30 bg-white hover:bg-zn-purple/5 transition-colors"
                        title="Изчисли автоматично от съдържанието"
                      >
                        Авто
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2 mt-2 pt-2 border-t border-gray-200">
                    <label className={labelCls}>Планирано публикуване (Опционално)</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        className={inputCls + ' max-w-[240px]'}
                        type="datetime-local"
                        value={form.publishAt || ''}
                        onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                      />
                      {form.publishAt && (
                        <button type="button" onClick={() => setForm({ ...form, publishAt: '' })} className="text-[10px] font-sans font-bold uppercase tracking-wider text-red-500 hover:text-red-700 hover:underline">
                          Изчисти датата
                        </button>
                      )}
                    </div>
                    {form.publishAt && new Date(form.publishAt) > new Date() && form.status === 'published' ? (
                      <div className="text-xs text-blue-700 mt-2 font-sans font-semibold bg-blue-50 border border-blue-100 px-3 py-2 rounded-sm inline-block">
                        ⌛ Тази статия ще се публикува автоматично на {new Date(form.publishAt).toLocaleString('bg-BG')}.
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500 mt-1 font-sans">
                        Ако изберете дата в бъдещето и статус "Публикувана", статията ще излезе автоматично.
                      </p>
                    )}
                  </div>
                </div>

                {/* RELATЕD ARTICLES COMPONENT */}
                <div className="p-4 border border-gray-200 bg-gray-50/30">
                  <label className={labelCls}>Свързани статии</label>
                  <p className="text-xs text-gray-500 font-sans mb-3">Избери статии, които да се показват под текущата като препоръчано съдържание.</p>
                  <div className="flex flex-col gap-2">
                    {form.relatedArticles?.map(id => {
                      const article = relatedArticleIdMap.get(Number(id));
                      return (
                        <div key={id} className="flex items-center justify-between p-2 bg-white border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            {article?.image && <img src={article.image} alt="" className="w-12 h-8 object-cover rounded-sm border border-gray-100" />}
                            <div className="min-w-0">
                              <span className="block text-sm font-sans font-semibold text-gray-700 truncate">{article?.title || `Статия #${id}`}</span>
                              {!article && (
                                <span className="block text-[11px] font-sans text-gray-400">Зареждане на детайли...</span>
                              )}
                            </div>
                          </div>
                          <button type="button" onClick={() => setForm(prev => ({ ...prev, relatedArticles: prev.relatedArticles.filter(r => r !== id) }))} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 transition-colors rounded flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    <div className="mt-2">
                      <input
                        className={inputCls}
                        value={relatedSearchQuery}
                        onChange={(e) => setRelatedSearchQuery(e.target.value)}
                        placeholder="Търси заглавие за свързана статия"
                      />
                    </div>
                    <div className="relative mt-2">
                      <select
                        className={inputCls + ' cursor-pointer'}
                        value=""
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (val && !form.relatedArticles?.includes(val)) {
                            setForm(prev => ({ ...prev, relatedArticles: [...(prev.relatedArticles || []), val] }));
                          }
                        }}
                      >
                        <option value="">-- Търси и добави свързана статия --</option>
                        {relatedOptions
                          .filter((article) => !form.relatedArticles?.includes(article.id))
                          .map((article) => (
                            <option key={article.id} value={article.id}>{article.title}</option>
                          ))}
                      </select>
                      {relatedOptionsLoading && (
                        <div className="mt-2 text-[11px] font-sans text-gray-500">Зареждане на предложения...</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEO TAB */}
            <div className={activeTab === 'seo' ? 'block' : 'hidden'}>
              <div className="space-y-6 max-w-5xl">

                <div className="mb-8 border-b border-gray-100 pb-6">
                  <h3 className="font-sans font-semibold text-gray-900 mb-4 items-center flex gap-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    Google Search Preview
                  </h3>
                  <div className="p-4 bg-white border border-gray-200 rounded shadow-sm max-w-2xl font-sans">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500 text-xs">ZN</div>
                      <div>
                        <p className="text-sm text-gray-900 leading-tight">Zemun News</p>
                        <p className="text-[12px] text-gray-500 leading-tight">https://zemun-news.com/article/{editing === 'new' ? '...' : editing}/{form.slug || '...'}</p>
                      </div>
                    </div>
                    <h4 className="text-[20px] text-[#1a0dab] font-normal hover:underline cursor-pointer leading-tight mb-1 truncate">
                      {form.shareTitle || form.title || 'Нова Статия'} - Zemun News
                    </h4>
                    <p className="text-[14px] text-[#4d5156] leading-snug line-clamp-2">
                      <span className="text-gray-500 mr-1">{form.date && new Date(form.date).toLocaleDateString('bg-BG')} —</span>
                      {form.shareSubtitle || form.excerpt || 'Кратко описание на статията, което се показва в резултатите от търсенето...'}
                    </p>
                  </div>

                  <div className="mt-6">
                    <label className={labelCls}>SEO Permalink (Slug)</label>
                    <div className="flex items-center">
                      <div className="px-3 py-2 bg-gray-50 border border-gray-300 border-r-0 text-gray-500 font-sans text-sm rounded-l">
                        /article/{editing === 'new' ? '...' : editing}/
                      </div>
                      <input
                        className={inputCls + ' !rounded-l-none !border-l-0 focus:ring-0'}
                        value={form.slug || ''}
                        onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9а-я-]/gi, '-') })}
                        placeholder="my-awesome-article"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const generated = (form.title || '')
                            .toLowerCase()
                            .replace(/[^a-z0-9а-я-]/gi, '-')
                            .replace(/-+/g, '-')
                            .replace(/^-|-$/g, '');
                          setForm({ ...form, slug: generated });
                        }}
                        className="px-4 py-2 bg-gray-100 border border-gray-300 border-l-0 text-gray-700 font-sans text-sm hover:bg-gray-200 transition-colors whitespace-nowrap rounded-r"
                      >
                        От заглавието
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Остави празно за автоматично генериране при публикуване. Позволени са само букви, цифри и тирета.</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-sans font-semibold text-gray-900 mb-1">Social Sharing Metadata</h3>
                  <p className="text-xs text-gray-500 font-sans mb-4">
                    Персонализирай как изглежда връзката, когато бъде споделена във Facebook, Viber, Telegram или X.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Share заглавие (Social Title)</label>
                  <input
                    className={inputCls}
                    value={form.shareTitle || ''}
                    onChange={e => setForm({ ...form, shareTitle: e.target.value })}
                    placeholder="Ако е празно, ползва основното заглавие на статията"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-right">{form.shareTitle?.length || 0}/80-100</p>
                </div>

                <div>
                  <label className={labelCls}>Share подзаглавие (Social Description)</label>
                  <textarea
                    className={inputCls + ' h-20 resize-none'}
                    value={form.shareSubtitle || ''}
                    onChange={e => setForm({ ...form, shareSubtitle: e.target.value })}
                    placeholder="Ако е празно, ползва резюмето"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 text-right">{form.shareSubtitle?.length || 0}/150-160</p>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={labelCls}>Badge (Етикет)</label>
                    <input
                      className={inputCls}
                      value={form.shareBadge || ''}
                      onChange={e => setForm({ ...form, shareBadge: e.target.value })}
                      placeholder="Напр. EXCLUSIVE, ЖИВО, РАЗСЛЕДВАНЕ"
                    />
                  </div>
                  <div className="flex-1">
                    <label className={labelCls}>Цветен акцент</label>
                    <select
                      className={inputCls}
                      value={form.shareAccent || 'auto'}
                      onChange={e => setForm({ ...form, shareAccent: e.target.value })}
                    >
                      <option value="auto">Auto (спрямо категорията)</option>
                      <option value="red">🔴 Червен</option>
                      <option value="orange">🟠 Оранжев</option>
                      <option value="yellow">🟡 Жълт</option>
                      <option value="purple">🟣 Лилав</option>
                      <option value="blue">🔵 Син</option>
                      <option value="emerald">🟢 Зелен</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Suspense fallback={(
                    <div className="flex h-48 items-center justify-center rounded border border-dashed border-gray-300 bg-white text-sm font-sans text-gray-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Зареждане на share изображението...
                    </div>
                  )}>
                    <LazyAdminImageField
                      label="Отделна Share снимка (Опционално, 1200x630)"
                      value={form.shareImage || ''}
                      onChange={(nextValue) => setForm({ ...form, shareImage: nextValue })}
                      helperText="Ако е празно, ще се ползва основната снимка."
                      previewClassName="h-48"
                      required={false}
                    />
                  </Suspense>
                </div>

                {editing !== 'new' && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-sans font-bold uppercase tracking-wider text-gray-500">
                        Генериран Preview Card
                      </p>
                      <a
                        href={`/share/article/${editing}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-sans font-semibold text-zn-purple border border-zn-purple/30 px-3 py-1 hover:bg-zn-purple hover:text-white transition-colors"
                      >
                        Отвори share линк в нов таб
                      </a>
                    </div>
                    <img
                      src={`/api/articles/${editing}/share.png`}
                      alt="Open Graph Preview"
                      className="w-full h-auto border border-gray-200 shadow-lg rounded"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Search + Category filter — sticky */}
      <div className="sticky top-0 z-[5] bg-gray-50 -mx-8 px-8 pt-4 pb-3 border-b border-gray-200 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
              className={inputCls + ' !pl-9'}
              value={searchQuery}
              onChange={(e) => setListSearchParams({ q: e.target.value, page: '1' })}
              placeholder="Търси по заглавие..."
            />
        </div>
        <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setListSearchParams({ category: 'all', page: '1' })}
            className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${filterCat === 'all' ? 'bg-zn-hot text-white border-zn-hot' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'}`}
          >
            Всички ({adminMeta.total})
          </button>
          {categories.filter(c => c.id !== 'all').map(c => {
            const count = Number(adminMeta.byCategory?.[c.id]) || 0;
            return (
                <button
                  key={c.id}
                  onClick={() => setListSearchParams({ category: c.id, page: '1' })}
                className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${filterCat === c.id ? 'bg-zn-hot text-white border-zn-hot' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'}`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-zn-purple/5 border border-zn-purple/20">
          <span className="text-xs font-sans font-semibold text-zn-purple">{selectedIds.length} избрани</span>
          <button onClick={() => handleBulkStatusChange('published')} className="px-3 py-1 text-xs font-sans font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">Публикувай</button>
          <button onClick={() => handleBulkStatusChange('draft')} className="px-3 py-1 text-xs font-sans font-semibold text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors">Чернова</button>
          <button onClick={handleBulkDelete} className="px-3 py-1 text-xs font-sans font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">Архивирай</button>
          <button onClick={() => setSelectedIds([])} className="ml-auto text-xs font-sans text-gray-500 hover:text-gray-700 transition-colors">Отмени</button>
        </div>
      )}

      {/* Articles list */}
      <div className="space-y-2">
        {listError && (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-sans text-red-700">
            {listError}
          </div>
        )}
        {listLoading && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm font-sans text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Зареждане на статии...
          </div>
        )}
        {/* Select all row */}
        {listArticles.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-1.5">
            <button onClick={selectAllOnPage} className="text-gray-400 hover:text-zn-purple transition-colors">
              {listArticles.every(a => selectedIds.includes(a.id)) ? <CheckSquare className="w-4 h-4 text-zn-purple" /> : <Square className="w-4 h-4" />}
            </button>
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400">Избери всички на страницата</span>
          </div>
        )}
        {listArticles.map(article => {
          const publishAtDate = article.publishAt ? new Date(article.publishAt) : null;
          const isScheduled = article.status === 'published' && publishAtDate && publishAtDate > new Date();
          const publishAtLabel = publishAtDate && !Number.isNaN(publishAtDate.getTime())
            ? publishAtDate.toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })
            : null;
          const isSelected = selectedIds.includes(article.id);
          const viewCountLabel = Number(article.views || 0).toLocaleString('bg-BG');

          return (
            <div key={article.id} className={`bg-white border p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors group ${isSelected ? 'border-zn-purple/40 bg-zn-purple/5' : 'border-gray-200'}`}>
              <button onClick={() => toggleSelectId(article.id)} className="mt-0.5 text-gray-400 hover:text-zn-purple transition-colors shrink-0">
                {isSelected ? <CheckSquare className="w-4 h-4 text-zn-purple" /> : <Square className="w-4 h-4" />}
              </button>
              {article.image && (
                <img src={article.image} alt="" className="w-16 h-12 object-cover border border-gray-200 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase ${getCategoryLabel(article.category)?.includes('Криминални') ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{getCategoryLabel(article.category)}</span>
                  {article.featured && <span className="text-[9px] font-sans font-bold uppercase text-amber-600">★ FEATURED</span>}
                  {article.breaking && <span className="text-[9px] font-sans font-bold uppercase text-red-600">BREAKING</span>}
                  {article.status === 'draft' && <span className="text-[9px] font-sans font-bold uppercase text-gray-500 bg-gray-200 px-1 py-0.5 rounded">ЧЕРНОВА</span>}
                  {isScheduled && <span className="text-[9px] font-sans font-bold uppercase text-blue-700 bg-blue-50 px-1 py-0.5 rounded">ПЛАНИРАНА</span>}
                </div>
                <h3 className="text-sm font-sans font-bold text-gray-900 truncate">{article.title}</h3>
                <p className="text-xs font-sans text-gray-500 mt-0.5">
                  {getAuthorName(article.authorId)} · {article.date} · {article.readTime} мин
                  {` · ${viewCountLabel} прегл.`}
                  {publishAtLabel ? ` · publishAt: ${publishAtLabel}` : ''}
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-wider text-amber-700 sm:flex">
                <Eye className="h-3.5 w-3.5" />
                {viewCountLabel}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleQuickStatusToggle(article)}
                  className="p-1.5 text-gray-400 hover:text-zn-purple transition-colors"
                  title={article.status === 'draft' ? 'Публикувай' : 'Върни в чернова'}
                  aria-label={article.status === 'draft' ? 'Публикувай статията' : 'Върни статията в чернова'}
                >
                  {article.status === 'draft' ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4 text-green-500" />}
                </button>
                <button onClick={() => handleDuplicate(article)} className="p-1.5 text-gray-400 hover:text-zn-purple transition-colors" title="Дублирай" aria-label="Дублирай статията">
                  <Copy className="w-4 h-4" />
                </button>
                <a href={`/article/${article.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors" aria-label="Виж статията" title="Виж статията">
                  <Eye className="w-4 h-4" />
                </a>
                <button onClick={() => startEdit(article)} className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors" aria-label="Редактирай статията" title="Редактирай">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(article.id)} className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors" title="Архивирай" aria-label="Архивирай статията">
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {!listLoading && listArticles.length === 0 && (
          <div className="text-center py-12 text-sm font-sans text-gray-400">Няма статии {searchQuery ? 'със съвпадащо заглавие' : 'в тази категория'}</div>
        )}
      </div>

      {/* Pagination */}
      {listTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setListSearchParams({ page: String(Math.max(1, currentPage - 1)) })}
            disabled={currentPage <= 1}
            className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-sans text-gray-600">
            {currentPage} / {listTotalPages}
          </span>
            <button
              onClick={() => setListSearchParams({ page: String(Math.min(listTotalPages, currentPage + 1)) })}
            disabled={currentPage >= listTotalPages}
            className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs font-sans text-gray-400 ml-2">({listTotal} статии)</span>
        </div>
      )}

      {/* Scroll to top FAB */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 w-10 h-10 bg-zn-purple text-white rounded-full shadow-lg flex items-center justify-center hover:bg-zn-purple-dark transition-all hover:scale-110"
          title="Нагоре"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {showPreviewModal && (
        <Suspense fallback={(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
            <div className="rounded-2xl bg-white px-6 py-5 text-sm font-sans text-gray-600 shadow-xl">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-gray-400" />
              Зареждане на live preview...
            </div>
          </div>
        )}>
          <LazyLivePreviewModal
            form={form}
            onClose={() => setShowPreviewModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
