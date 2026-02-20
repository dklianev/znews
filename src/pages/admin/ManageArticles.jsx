import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, Eye, Star, RefreshCw, History, RotateCcw, Clock3, Loader2, Search, Copy, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, CheckSquare, Square } from 'lucide-react';
import RichTextEditor from '../../components/admin/RichTextEditor';
import AdminImageField from '../../components/admin/AdminImageField';
import { estimateReadTimeFromHtml, normalizeRichTextHtml } from '../../utils/richText';
import { api } from '../../utils/api';
import { useToast } from '../../components/admin/Toast';

const ARTICLE_DRAFT_KEY = 'zn_manage_articles_draft_v1';
const ARTICLE_HISTORY_KEY = 'zn_manage_articles_history_v1';

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

const REVISION_COMPARE_FIELDS = [
  { key: 'title', label: 'Заглавие' },
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
  { key: 'hero', label: 'Hero' },
  { key: 'status', label: 'Статус' },
  { key: 'publishAt', label: 'Планирано публикуване' },
  { key: 'tags', label: 'Тагове' },
  { key: 'views', label: 'Прегледи' },
  { key: 'shareTitle', label: 'Share заглавие' },
  { key: 'shareSubtitle', label: 'Share подзаглавие' },
  { key: 'shareBadge', label: 'Share badge' },
  { key: 'shareAccent', label: 'Share акцент' },
  { key: 'shareImage', label: 'Share снимка' },
];

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
  if (key === 'featured' || key === 'breaking' || key === 'hero') return value ? '1' : '0';
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
  hero: false,
  tags: '',
  status: 'published',
  publishAt: '',
  shareTitle: '',
  shareSubtitle: '',
  shareBadge: '',
  shareAccent: 'auto',
  shareImage: '',
};

export default function ManageArticles() {
  const {
    articles,
    authors,
    categories,
    addArticle,
    updateArticle,
    deleteArticle,
    articleRevisions,
    loadArticleRevisions,
    autosaveArticleRevision,
    restoreArticleRevision,
  } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCat, setFilterCat] = useState('all');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ARTICLES_PER_PAGE = 15;
  const initialFormRef = useRef(emptyForm);
  const [selectedIds, setSelectedIds] = useState([]);
  const toast = useToast();

  const filtered = useMemo(() => {
    let result = filterCat === 'all' ? articles : articles.filter(a => a.category === filterCat);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(a => a.title?.toLowerCase().includes(q));
    }
    return result;
  }, [articles, filterCat, searchQuery]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filtered]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / ARTICLES_PER_PAGE));
  const paginatedArticles = useMemo(
    () => sorted.slice((currentPage - 1) * ARTICLES_PER_PAGE, currentPage * ARTICLES_PER_PAGE),
    [sorted, currentPage]
  );

  const isFormDirty = useMemo(() => {
    if (!editing) return false;
    const ref = initialFormRef.current;
    return ref.title !== form.title || ref.excerpt !== form.excerpt || ref.content !== form.content
      || ref.category !== form.category || ref.image !== form.image || ref.tags !== form.tags
      || ref.youtubeUrl !== form.youtubeUrl
      || JSON.stringify(ref.imageMeta || null) !== JSON.stringify(form.imageMeta || null);
  }, [editing, form]);

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
    hero: Boolean(form.hero),
    tags: typeof form.tags === 'string'
      ? form.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      : (Array.isArray(form.tags) ? form.tags : []),
    status: form.status === 'draft' ? 'draft' : 'published',
    publishAt: localInputToIso(form.publishAt),
    views: Number(form.views) || 0,
    shareTitle: form.shareTitle || '',
    shareSubtitle: form.shareSubtitle || '',
    shareBadge: form.shareBadge || '',
    shareAccent: form.shareAccent || 'auto',
    shareImage: form.shareImage || '',
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
      if (key === 'featured' || key === 'breaking' || key === 'hero') return normalized === '1' ? 'Да' : 'Не';
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
    setForm({
      ...emptyForm,
      ...entry.snapshot,
      publishAt: entry.snapshot.publishAt || '',
      content: entry.snapshot.content || '<p></p>',
    });
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
    if (!editing) return undefined;
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
          hero: Boolean(form.hero),
          tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
          status: form.status,
          publishAt: localInputToIso(form.publishAt),
          views: Number(form.views) || 0,
        });
      } catch {
        // ignore autosave network errors to avoid blocking editing
      }
    }, 25000);
    return () => window.clearTimeout(timer);
  }, [autosaveArticleRevision, editing, form]);

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
    setContentMode('write');
    setAutosavedAt(null);
    setValidationErrors({});
    loadHistoryForScope('new');
    if (draft) {
      setForm(draft);
      initialFormRef.current = draft;
      setDraftSavedAt(draft._savedAt);
      return;
    }
    setForm(emptyForm);
    initialFormRef.current = emptyForm;
    setDraftSavedAt(null);
  };

  const validateForm = useCallback(() => {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Заглавието е задължително';
    if (!form.excerpt.trim()) errors.excerpt = 'Резюмето е задължително';
    const cleanContent = (form.content || '').replace(/<[^>]*>?/gm, '').trim();
    if (!cleanContent) errors.content = 'Съдържанието не може да бъде празно';
    return errors;
  }, [form.title, form.excerpt, form.content]);

  const handleSave = async () => {
    const errors = validateForm();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      const normalizedContent = normalizeRichTextHtml(form.content || '');
      const autoReadTime = estimateReadTimeFromHtml(normalizedContent || form.excerpt);

      const data = {
        ...form,
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        content: normalizedContent,
        authorId: Number(form.authorId),
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
        readTime: Number(form.readTime) > 0 ? Number(form.readTime) : autoReadTime,
        views: Number(form.views) || 0,
        publishAt: localInputToIso(form.publishAt),
      };

      if (editing === 'new') {
        await addArticle(data);
        clearDraft();
        toast.success('Статията е създадена успешно');
      } else {
        await updateArticle(editing, data);
        await loadArticleRevisions(editing);
        toast.success('Промените са запазени');
      }

      setEditing(null);
      setForm(emptyForm);
      setContentMode('write');
      setDraftSavedAt(null);
      setAutosavedAt(null);
      setHistoryItems([]);
      setLoadingRevisions(false);
      setValidationErrors({});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Изтрий статията?')) return;
    await deleteArticle(id);
    setSelectedIds(prev => prev.filter(sid => sid !== id));
    toast.success('Статията е изтрита');
  };

  // Bulk actions
  const toggleSelectId = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAllOnPage = () => {
    const pageIds = paginatedArticles.map(a => a.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter(id => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])]);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length || !confirm(`Изтрий ${selectedIds.length} статии?`)) return;
    for (const id of selectedIds) await deleteArticle(id);
    toast.success(`${selectedIds.length} статии изтрити`);
    setSelectedIds([]);
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (!selectedIds.length) return;
    const label = newStatus === 'published' ? 'публикувани' : 'върнати в чернова';
    for (const id of selectedIds) {
      const article = articles.find(a => a.id === id);
      if (article) await updateArticle(id, { ...article, status: newStatus });
    }
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
        resolvedArticle = article;
      }
    }

    setEditing(article.id);
    setContentMode('write');
    setDraftSavedAt(null);
    setAutosavedAt(null);
    loadHistoryForScope(getHistoryScope(article.id));
    const resolvedForm = {
      ...resolvedArticle,
      content: resolvedArticle.content || '<p></p>',
      tags: Array.isArray(resolvedArticle.tags) ? resolvedArticle.tags.join(', ') : resolvedArticle.tags || '',
      publishAt: dateTimeToLocalInput(resolvedArticle.publishAt),
      shareTitle: resolvedArticle.shareTitle || '',
      shareSubtitle: resolvedArticle.shareSubtitle || '',
      shareBadge: resolvedArticle.shareBadge || '',
      shareAccent: resolvedArticle.shareAccent || 'auto',
      shareImage: resolvedArticle.shareImage || '',
    };
    setForm(resolvedForm);
    initialFormRef.current = resolvedForm;
    setValidationErrors({});
    setLoadingRevisions(true);
    try {
      await loadArticleRevisions(article.id);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleCancel = () => {
    if (isFormDirty && !confirm('Имаш незапазени промени. Сигурен ли си, че искаш да излезеш?')) return;
    setEditing(null);
    setForm(emptyForm);
    setContentMode('write');
    setHistoryItems([]);
    setAutosavedAt(null);
    setLoadingRevisions(false);
    setValidationErrors({});
    if (editing !== 'new') {
      setDraftSavedAt(null);
    }
  };

  const setAutoReadTime = () => {
    setForm(prev => ({ ...prev, readTime: computedReadTime }));
  };

  const handleRestoreServerRevision = async (revisionId) => {
    if (!editing || editing === 'new') return;
    if (!confirm('Възстанови тази версия? Текущите незапазени промени ще бъдат заменени.')) return;
    setRestoringRevision(revisionId);
    try {
      const restored = await restoreArticleRevision(editing, revisionId);
      if (!restored) return;
      setForm({
        ...restored,
        content: restored.content || '<p></p>',
        tags: Array.isArray(restored.tags) ? restored.tags.join(', ') : restored.tags || '',
        publishAt: dateTimeToLocalInput(restored.publishAt),
        shareTitle: restored.shareTitle || '',
        shareSubtitle: restored.shareSubtitle || '',
        shareBadge: restored.shareBadge || '',
        shareAccent: restored.shareAccent || 'auto',
        shareImage: restored.shareImage || '',
      });
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

  const getAuthorName = (id) => authors.find(a => a.id === id)?.name || 'Неизвестен';
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
      title: `${fullArticle.title} (копие)`,
      status: 'draft',
      featured: false,
      breaking: false,
      hero: false,
      date: new Date().toISOString().slice(0, 10),
      views: 0,
      publishAt: null,
    };
    delete dup.id;
    await addArticle(dup);
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
    if (!isFormDirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isFormDirty]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filterCat, searchQuery]);

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
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
        <button
          onClick={startNewArticle}
          className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Нова статия
        </button>
      </div>

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
              <button onClick={handleSave} disabled={saving} className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-sans font-semibold transition-colors ${saving ? 'bg-zn-purple/60 cursor-not-allowed' : 'bg-zn-purple hover:bg-zn-purple-dark'}`}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Запазване...' : 'Запази'}
              </button>
              <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors">
                <X className="w-4 h-4" /> Откажи
              </button>
              {editing === 'new' && (
                <button
                  onClick={() => { clearDraft(); setForm(emptyForm); setAutosavedAt(null); loadHistoryForScope('new'); }}
                  className="flex items-center px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  title="Изчисти чернова"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Заглавие <span className="text-red-500">*</span></label>
                  <span className={`text-[10px] font-sans tabular-nums ${form.title.length > 100 ? 'text-amber-600' : 'text-gray-400'}`}>{form.title.length}/120</span>
                </div>
                <input className={inputCls + (validationErrors.title ? ' !border-red-400 bg-red-50/30' : '')} value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); if (validationErrors.title) setValidationErrors(prev => ({ ...prev, title: undefined })); }} placeholder="Заглавие на статията" />
                {validationErrors.title && <p className="text-xs text-red-500 mt-1 font-sans">{validationErrors.title}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Резюме <span className="text-red-500">*</span></label>
                  <button type="button" onClick={autoGenerateExcerpt} className="text-[10px] font-sans font-semibold text-zn-purple hover:text-zn-purple-dark transition-colors" title="Генерирай от съдържанието">✨ Авто</button>
                </div>
                <textarea className={inputCls + ' h-20 resize-none' + (validationErrors.excerpt ? ' !border-red-400 bg-red-50/30' : '')} value={form.excerpt} onChange={e => { setForm({ ...form, excerpt: e.target.value }); if (validationErrors.excerpt) setValidationErrors(prev => ({ ...prev, excerpt: undefined })); }} placeholder="Кратко описание..." />
                {validationErrors.excerpt && <p className="text-xs text-red-500 mt-1 font-sans">{validationErrors.excerpt}</p>}
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
                  <div className={`h-[600px] overflow-hidden border ${validationErrors.content ? 'border-red-400' : 'border-gray-200'}`}>
                    <RichTextEditor
                      className="!h-full border-none"
                      value={form.content}
                      onChange={(nextHtml) => { setForm(prev => ({ ...prev, content: nextHtml })); if (validationErrors.content) setValidationErrors(prev => ({ ...prev, content: undefined })); }}
                      placeholder="Напиши текста на статията..."
                    />
                  </div>
                ) : (
                  <div className="border border-gray-200 min-h-[600px] p-6 bg-white overflow-auto">
                    <div
                      className="article-body prose prose-lg max-w-none [&_p]:font-sans [&_p]:leading-relaxed [&_p]:mb-4 [&_h2]:font-display [&_h2]:font-black [&_h2]:uppercase [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-display [&_h3]:font-bold [&_h3]:uppercase [&_h3]:mt-5 [&_h3]:mb-2 [&_h4]:font-display [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:mt-4 [&_h4]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-zn-purple [&_blockquote]:pl-4 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-zn-hot [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: normalizedPreviewContent }}
                    />
                  </div>
                )}
                <p className="mt-2 text-xs font-sans text-gray-500">
                  Разрешени формати: bold, italic, underline, strike, H2/H3/H4, списъци, цитат и линк.
                </p>
                {validationErrors.content && <p className="text-xs text-red-500 mt-1 font-sans">{validationErrors.content}</p>}
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
                  <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Сравнение на версии {selectedRevisionIds.length === 1 ? '(избрана срещу текуща форма)' : '(две избрани)'}
                  </p>
                  {!revisionCompare && !compareLoadError && (
                    <p className="text-xs font-sans text-gray-400">Зареждам...</p>
                  )}
                  {revisionCompare && (
                    <>
                      <div className="flex items-center gap-2 text-[11px] font-sans text-gray-600 mb-4 pb-2 border-b border-gray-100">
                        <span className="font-semibold text-red-500 bg-red-50 px-2 py-0.5">{revisionCompare.leftLabel}</span>
                        <span>срещу</span>
                        <span className="font-semibold text-green-600 bg-green-50 px-2 py-0.5">{revisionCompare.rightLabel}</span>
                      </div>
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {revisionCompare.rows.map((row) => (
                          <div key={row.key} className="p-3 border border-gray-100 bg-gray-50 sm:grid sm:grid-cols-2 gap-4">
                            <div className="col-span-2 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 mb-1">{row.label}</div>
                            <div className="prose prose-sm max-w-none text-xs text-red-700 bg-red-50/50 p-2 border border-red-100/50 break-words whitespace-pre-wrap">{row.left}</div>
                            <div className="prose prose-sm max-w-none text-xs text-green-800 bg-green-50/50 p-2 border border-green-100/50 break-words whitespace-pre-wrap mt-2 sm:mt-0">{row.right}</div>
                          </div>
                        ))}
                        {revisionCompare.rows.length === 0 && (
                          <p className="text-xs font-sans text-gray-400 py-2">Няма открити разлики.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Metadata & Settings */}
            <div className="lg:col-span-1 space-y-6">
              {/* Categories and Taxonomies */}
              <div className="p-4 border border-gray-200 bg-gray-50/30 space-y-4">
                <div>
                  <label className={labelCls}>Статус</label>
                  <select className={inputCls + ' font-semibold'} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="published">🟢 Публикувана</option>
                    <option value="draft">🟡 Чернова</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Категория</label>
                  <select className={inputCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {categories.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Автор</label>
                  <select className={inputCls} value={form.authorId} onChange={e => setForm({ ...form, authorId: e.target.value })}>
                    {authors.map(a => (
                      <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Main Image */}
              <div className="p-4 border border-gray-200 bg-gray-50/30">
                <AdminImageField
                  label="Основна Снимка"
                  required
                  value={form.image}
                  onChange={(nextValue) => setForm({ ...form, image: nextValue })}
                  imageMeta={form.imageMeta}
                  onChangeMeta={(nextMeta) => setForm({ ...form, imageMeta: nextMeta })}
                  helperText="Избери снимка (16:9 препоръчително) или качи нова от компютъра."
                  previewClassName="h-40"
                />
              </div>

              {/* YouTube Video */}
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

              <div className="p-4 border border-gray-200 bg-gray-50/30 space-y-4">
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white border border-transparent hover:border-gray-200 transition-all">
                    <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                    <div>
                      <span className="flex items-center gap-1.5 text-sm font-sans font-semibold text-gray-900">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Водеща статия
                      </span>
                      <p className="text-[10px] font-sans text-gray-500 mt-0.5">Показва се първа в категорията си</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white border border-transparent hover:border-gray-200 transition-all">
                    <input type="checkbox" checked={form.breaking} onChange={e => setForm({ ...form, breaking: e.target.checked })} className="w-4 h-4 accent-red-600" />
                    <div>
                      <span className="flex items-center gap-1.5 text-sm font-sans font-semibold text-red-600">
                        Breaking News
                      </span>
                      <p className="text-[10px] font-sans text-gray-500 mt-0.5">Червена лента за извънредна новина</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-4 border border-gray-200 bg-gray-50/30 space-y-4">
                <div>
                  <label className={labelCls}>Тагове</label>
                  <input className={inputCls} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="криминал, съд, полиция" />
                  <p className="text-[10px] text-gray-500 mt-1">Разделени със запетая</p>
                </div>
                <div>
                  <label className={labelCls}>Оригинална дата</label>
                  <input className={inputCls} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Планирано публикуване (publishAt)</label>
                  <input
                    className={inputCls}
                    type="datetime-local"
                    value={form.publishAt || ''}
                    onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Ако зададеш час в бъдещето, статията ще излезе на сайта.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Време за четене (мин)</label>
                  <div className="flex gap-2">
                    <input className={inputCls} type="number" min="1" value={form.readTime} onChange={e => setForm({ ...form, readTime: Number(e.target.value) || 1 })} placeholder="3" />
                    <button
                      type="button"
                      onClick={setAutoReadTime}
                      className="px-3 py-2 text-xs font-sans font-semibold text-zn-purple border border-zn-purple/30 bg-white hover:bg-zn-purple/5 transition-colors"
                      title="Изчисли автоматично"
                    >
                      Авто
                    </button>
                  </div>
                </div>
              </div>

              {/* SEO & Social Accordion using Details/Summary */}
              <details className="group border border-gray-200 bg-white shadow-sm open:pb-4">
                <summary className="p-4 font-sans font-semibold text-sm text-gray-900 cursor-pointer hover:bg-gray-50 select-none list-none flex items-center justify-between">
                  SEO & Social Sharing
                  <div className="w-5 h-5 border border-gray-200 rounded flex items-center justify-center bg-white text-gray-500 group-open:rotate-180 transition-transform">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </summary>

                <div className="px-4 pt-2 space-y-4 border-t border-gray-100 mt-2">
                  <p className="text-xs text-gray-500 font-sans">
                    Персонализирай как изглежда връзката във Facebook, Viber и други мрежи.
                  </p>
                  <div>
                    <label className={labelCls}>Share заглавие</label>
                    <input
                      className={inputCls}
                      value={form.shareTitle || ''}
                      onChange={e => setForm({ ...form, shareTitle: e.target.value })}
                      placeholder="Ако е празно, ползва основното"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Share подзаглавие</label>
                    <input
                      className={inputCls}
                      value={form.shareSubtitle || ''}
                      onChange={e => setForm({ ...form, shareSubtitle: e.target.value })}
                      placeholder="Ако е празно, ползва резюмето"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className={labelCls}>Badge</label>
                      <input
                        className={inputCls}
                        value={form.shareBadge || ''}
                        onChange={e => setForm({ ...form, shareBadge: e.target.value })}
                        placeholder="EXCLUSIVE"
                      />
                    </div>
                    <div className="flex-1">
                      <label className={labelCls}>Цвят</label>
                      <select
                        className={inputCls}
                        value={form.shareAccent || 'auto'}
                        onChange={e => setForm({ ...form, shareAccent: e.target.value })}
                      >
                        <option value="auto">Auto</option>
                        <option value="red">Червен</option>
                        <option value="orange">Оранжев</option>
                        <option value="yellow">Жълт</option>
                        <option value="purple">Лилав</option>
                        <option value="blue">Син</option>
                        <option value="emerald">Зелен</option>
                      </select>
                    </div>
                  </div>
                  <AdminImageField
                    label="Отделна Share снимка"
                    value={form.shareImage || ''}
                    onChange={(nextValue) => setForm({ ...form, shareImage: nextValue })}
                    helperText="Ако е празно, ползва основната снимка."
                    previewClassName="h-28"
                    required={false}
                  />

                  {editing !== 'new' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                          Preview Card
                        </p>
                        <a
                          href={`/share/article/${editing}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-sans font-semibold text-zn-purple hover:underline"
                        >
                          Отвори share линк
                        </a>
                      </div>
                      <img
                        src={`/api/articles/${editing}/share.png`}
                        alt=""
                        className="w-full h-auto border border-gray-200"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  )}
                </div>
              </details>
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
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Търси по заглавие..."
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCat('all')}
            className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${filterCat === 'all' ? 'bg-zn-hot text-white border-zn-hot' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'}`}
          >
            Всички ({articles.length})
          </button>
          {categories.filter(c => c.id !== 'all').map(c => {
            const count = articles.filter(a => a.category === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setFilterCat(c.id)}
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
          <button onClick={handleBulkDelete} className="px-3 py-1 text-xs font-sans font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">Изтрий</button>
          <button onClick={() => setSelectedIds([])} className="ml-auto text-xs font-sans text-gray-500 hover:text-gray-700 transition-colors">Отмени</button>
        </div>
      )}

      {/* Articles list */}
      <div className="space-y-2">
        {/* Select all row */}
        {paginatedArticles.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-1.5">
            <button onClick={selectAllOnPage} className="text-gray-400 hover:text-zn-purple transition-colors">
              {paginatedArticles.every(a => selectedIds.includes(a.id)) ? <CheckSquare className="w-4 h-4 text-zn-purple" /> : <Square className="w-4 h-4" />}
            </button>
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400">Избери всички на страницата</span>
          </div>
        )}
        {paginatedArticles.map(article => {
          const publishAtDate = article.publishAt ? new Date(article.publishAt) : null;
          const isScheduled = article.status === 'published' && publishAtDate && publishAtDate > new Date();
          const publishAtLabel = publishAtDate && !Number.isNaN(publishAtDate.getTime())
            ? publishAtDate.toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })
            : null;
          const isSelected = selectedIds.includes(article.id);

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
                  {publishAtLabel ? ` · publishAt: ${publishAtLabel}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleQuickStatusToggle(article)} className="p-1.5 text-gray-400 hover:text-zn-purple transition-colors" title={article.status === 'draft' ? 'Публикувай' : 'Върни в чернова'}>
                  {article.status === 'draft' ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4 text-green-500" />}
                </button>
                <button onClick={() => handleDuplicate(article)} className="p-1.5 text-gray-400 hover:text-zn-purple transition-colors" title="Дублирай">
                  <Copy className="w-4 h-4" />
                </button>
                <a href={`/article/${article.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors">
                  <Eye className="w-4 h-4" />
                </a>
                <button onClick={() => startEdit(article)} className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(article.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-sm font-sans text-gray-400">Няма статии {searchQuery ? 'със съвпадащо заглавие' : 'в тази категория'}</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-sans text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-2 text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-xs font-sans text-gray-400 ml-2">({sorted.length} статии)</span>
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
    </div>
  );
}
