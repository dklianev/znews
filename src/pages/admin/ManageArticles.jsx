import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, Eye, Star, RefreshCw, History, RotateCcw, Clock3 } from 'lucide-react';
import RichTextEditor from '../../components/admin/RichTextEditor';
import AdminImageField from '../../components/admin/AdminImageField';
import { estimateReadTimeFromHtml, normalizeRichTextHtml } from '../../utils/richText';
import { api } from '../../utils/api';

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

  const filtered = useMemo(
    () => (filterCat === 'all' ? articles : articles.filter(a => a.category === filterCat)),
    [articles, filterCat]
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filtered]
  );

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
    loadHistoryForScope('new');
    if (draft) {
      setForm(draft);
      setDraftSavedAt(draft._savedAt);
      return;
    }
    setForm(emptyForm);
    setDraftSavedAt(null);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.excerpt.trim()) return;
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
    } else {
      await updateArticle(editing, data);
      await loadArticleRevisions(editing);
    }

    setEditing(null);
    setForm(emptyForm);
    setContentMode('write');
    setDraftSavedAt(null);
    setAutosavedAt(null);
    setHistoryItems([]);
    setLoadingRevisions(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Изтрий статията?')) return;
    await deleteArticle(id);
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
    setForm({
      ...resolvedArticle,
      content: resolvedArticle.content || '<p></p>',
      tags: Array.isArray(resolvedArticle.tags) ? resolvedArticle.tags.join(', ') : resolvedArticle.tags || '',
      publishAt: dateTimeToLocalInput(resolvedArticle.publishAt),
      shareTitle: resolvedArticle.shareTitle || '',
      shareSubtitle: resolvedArticle.shareSubtitle || '',
      shareBadge: resolvedArticle.shareBadge || '',
      shareAccent: resolvedArticle.shareAccent || 'auto',
      shareImage: resolvedArticle.shareImage || '',
    });
    setLoadingRevisions(true);
    try {
      await loadArticleRevisions(article.id);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setForm(emptyForm);
    setContentMode('write');
    setHistoryItems([]);
    setAutosavedAt(null);
    setLoadingRevisions(false);
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

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
  const labelCls = "block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1";

  return (
    <div className="p-8">
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
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="font-sans font-semibold text-gray-900">
              {editing === 'new' ? 'Нова статия' : 'Редактирай статия'}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-gray-500">
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
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Заглавие</label>
              <input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Заглавие на статията" />
            </div>
            <div>
              <label className={labelCls}>Резюме</label>
              <textarea className={inputCls + ' h-20 resize-none'} value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} placeholder="Кратко описание..." />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Съдържание</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setContentMode('write')}
                    className={`px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-wider border ${contentMode === 'write' ? 'bg-zn-purple text-white border-zn-purple' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    Редактор
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentMode('preview')}
                    className={`px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-wider border ${contentMode === 'preview' ? 'bg-zn-purple text-white border-zn-purple' : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    Преглед
                  </button>
                </div>
              </div>

              {contentMode === 'write' ? (
                <RichTextEditor
                  value={form.content}
                  onChange={(nextHtml) => setForm(prev => ({ ...prev, content: nextHtml }))}
                  placeholder="Напиши текста на статията. Можеш да поставяш и текст от Word."
                />
              ) : (
                <div className="border border-gray-200 min-h-[320px] p-4 bg-white">
                  <div
                    className="article-body prose prose-lg max-w-none [&_p]:font-sans [&_p]:leading-relaxed [&_p]:mb-4 [&_h2]:font-display [&_h2]:font-black [&_h2]:uppercase [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-display [&_h3]:font-bold [&_h3]:uppercase [&_h3]:mt-5 [&_h3]:mb-2 [&_h4]:font-display [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:mt-4 [&_h4]:mb-2 [&_blockquote]:border-l-4 [&_blockquote]:border-zn-purple [&_blockquote]:pl-4 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-zn-hot [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: normalizedPreviewContent }}
                  />
                </div>
              )}
              <p className="mt-2 text-xs font-sans text-gray-500">
                Разрешени формати: bold, italic, underline, strike, H2/H3/H4, списъци, цитат и линк. Paste от Word се изчиства автоматично.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div>
                <label className={labelCls}>Дата</label>
                <input className={inputCls} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Време за четене (мин)</label>
                <div className="flex gap-2">
                  <input className={inputCls} type="number" min="1" value={form.readTime} onChange={e => setForm({ ...form, readTime: Number(e.target.value) || 1 })} placeholder="5" />
                  <button
                    type="button"
                    onClick={setAutoReadTime}
                    className="px-2.5 py-2 text-xs font-sans font-semibold text-zn-purple border border-zn-purple/30 hover:bg-zn-purple/5 transition-colors whitespace-nowrap"
                    title={`Автоматично: ${computedReadTime} мин`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                      Авто
                    </span>
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Статус</label>
                <select className={inputCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="published">Публикувана</option>
                  <option value="draft">Чернова</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-2">
                <label className={labelCls}>Планирано публикуване (publishAt)</label>
                <input
                  className={inputCls}
                  type="datetime-local"
                  value={form.publishAt || ''}
                  onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                />
              </div>
            </div>
            <AdminImageField
              label="Снимка"
              required
              value={form.image}
              onChange={(nextValue) => setForm({ ...form, image: nextValue })}
              helperText="Можеш да качиш нов файл или да избереш от Media Library."
              previewClassName="h-36"
            />
            <div className="border border-gray-200 bg-gray-50/60 p-3 space-y-3">
              <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                Share карта (.png) за социални мрежи
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Share заглавие (по избор)</label>
                  <input
                    className={inputCls}
                    value={form.shareTitle || ''}
                    onChange={e => setForm({ ...form, shareTitle: e.target.value })}
                    placeholder="Ако е празно, ползва заглавието на статията"
                  />
                </div>
                <div>
                  <label className={labelCls}>Share подзаглавие (по избор)</label>
                  <input
                    className={inputCls}
                    value={form.shareSubtitle || ''}
                    onChange={e => setForm({ ...form, shareSubtitle: e.target.value })}
                    placeholder="Ако е празно, ползва резюмето"
                  />
                </div>
                <div>
                  <label className={labelCls}>Badge текст</label>
                  <input
                    className={inputCls}
                    value={form.shareBadge || ''}
                    onChange={e => setForm({ ...form, shareBadge: e.target.value })}
                    placeholder="EXCLUSIVE / BREAKING / DOSIE..."
                  />
                </div>
                <div>
                  <label className={labelCls}>Акцент</label>
                  <select
                    className={inputCls}
                    value={form.shareAccent || 'auto'}
                    onChange={e => setForm({ ...form, shareAccent: e.target.value })}
                  >
                    <option value="auto">Автоматично</option>
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
                label="Share снимка (по избор)"
                value={form.shareImage || ''}
                onChange={(nextValue) => setForm({ ...form, shareImage: nextValue })}
                helperText="Ако е празно, ползва се основната снимка на статията."
                previewClassName="h-28"
                required={false}
              />

              {editing !== 'new' && (
                <div className="border border-gray-200 bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                      Preview (след запис)
                    </p>
                    <a
                      href={`/share/article/${editing}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-sans font-semibold text-zn-purple hover:text-zn-purple-dark"
                    >
                      Отвори share линк
                    </a>
                  </div>
                  <img
                    src={`/api/articles/${editing}/share.png`}
                    alt=""
                    className="w-full max-w-[420px] h-auto border border-gray-200"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Тагове (разделени с запетая)</label>
              <input className={inputCls} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="криминал, полиция, разследване" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} className="w-4 h-4 accent-zn-purple" />
                <span className="text-sm font-sans text-gray-700">Водеща статия</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.breaking} onChange={e => setForm({ ...form, breaking: e.target.checked })} className="w-4 h-4 accent-red-600" />
                <span className="text-sm font-sans text-gray-700">Breaking News</span>
              </label>
            </div>
            <p className="text-xs font-sans text-gray-500">
              Ако `publishAt` е бъдеща дата и статусът е „Публикувана“, статията ще излезе автоматично на сайта в зададения час.
            </p>
            <p className="text-xs font-sans text-gray-500">
              Hero статията и Hero текстовете се управляват от отделната страница <strong>Hero секция</strong>.
            </p>

            <div className={`grid gap-3 ${editing === 'new' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
              <div className="border border-gray-200 bg-gray-50/60 p-3">
                <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-2 inline-flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Autosave history (локално)
                </p>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {historyItems.slice(0, 12).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-2 border border-gray-200 bg-white px-2.5 py-1.5">
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
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-semibold text-zn-purple border border-zn-purple/30 hover:bg-zn-purple/5 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Върни
                      </button>
                    </div>
                  ))}
                  {historyItems.length === 0 && (
                    <p className="text-xs font-sans text-gray-400 py-2">Няма autosave snapshots за тази статия.</p>
                  )}
                </div>
              </div>

              {editing !== 'new' && (
                <div className="border border-gray-200 bg-gray-50/60 p-3">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-2 inline-flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Revisions (server)
                  </p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {loadingRevisions && <p className="text-xs font-sans text-gray-400 py-2">Зареждане на версии...</p>}
                    {!loadingRevisions && currentRevisionItems.slice(0, 20).map((revision) => (
                      <div key={revision.revisionId} className={`flex items-center justify-between gap-2 border px-2.5 py-1.5 ${selectedRevisionIds.includes(revision.revisionId) ? 'border-zn-purple/40 bg-zn-purple/5' : 'border-gray-200 bg-white'}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-sans font-semibold text-gray-700 truncate">
                            v{revision.version} · {revision.title || 'Без заглавие'}
                          </p>
                          <p className="text-[10px] font-sans text-gray-400">
                            {revision.source} · {new Date(revision.createdAt).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleRevisionCompareSelection(revision.revisionId)}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-semibold border transition-colors ${selectedRevisionIds.includes(revision.revisionId) ? 'text-zn-purple border-zn-purple/40 bg-zn-purple/10' : 'text-gray-500 border-gray-200 hover:text-gray-700'}`}
                          >
                            {loadingRevisionDetails[revision.revisionId] ? '...' : selectedRevisionIds.includes(revision.revisionId) ? 'Избрана' : 'Сравни'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRestoreServerRevision(revision.revisionId)}
                            disabled={restoringRevision === revision.revisionId}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-semibold text-zn-purple border border-zn-purple/30 hover:bg-zn-purple/5 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            {restoringRevision === revision.revisionId ? '...' : 'Restore'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {!loadingRevisions && currentRevisionItems.length === 0 && (
                      <p className="text-xs font-sans text-gray-400 py-2">Няма server revisions за тази статия.</p>
                    )}
                  </div>

                  {selectedRevisionIds.length > 0 && (
                    <div className="mt-3 border border-gray-200 bg-white p-2.5">
                      <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-2">
                        Compare revisions {selectedRevisionIds.length === 1 ? '(избрана версия срещу текуща форма)' : '(две версии)'}
                      </p>
                      {!revisionCompare && !compareLoadError && (
                        <p className="text-xs font-sans text-gray-400">Зареждам данните за сравнение...</p>
                      )}
                      {!revisionCompare && compareLoadError && (
                        <p className="text-xs font-sans text-red-500">Неуспешно зареждане на версия за сравнение. Избери друга.</p>
                      )}
                      {revisionCompare && (
                        <>
                          <p className="text-[11px] font-sans text-gray-500 mb-2">
                            {revisionCompare.leftLabel} ⇄ {revisionCompare.rightLabel}
                          </p>
                          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                            {revisionCompare.rows.map((row) => (
                              <div key={row.key} className="border border-gray-200 bg-gray-50/50 px-2 py-1.5">
                                <p className="text-[10px] font-sans font-bold uppercase tracking-wide text-gray-500 mb-1">{row.label}</p>
                                <p className="text-[11px] font-sans text-gray-800">
                                  <span className="font-semibold text-gray-500">{revisionCompare.leftLabel}:</span> {row.left}
                                </p>
                                <p className="text-[11px] font-sans text-gray-800 mt-0.5">
                                  <span className="font-semibold text-gray-500">{revisionCompare.rightLabel}:</span> {row.right}
                                </p>
                              </div>
                            ))}
                            {revisionCompare.rows.length === 0 && (
                              <p className="text-xs font-sans text-gray-400 py-1">Няма разлики между избраните версии.</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors">
              <Save className="w-4 h-4" /> Запази
            </button>
            <button onClick={handleCancel} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4" /> Откажи
            </button>
            {editing === 'new' && (
              <button
                onClick={() => { clearDraft(); setForm(emptyForm); setAutosavedAt(null); loadHistoryForScope('new'); }}
                className="flex items-center gap-2 px-5 py-2 border border-red-200 text-red-600 text-sm font-sans hover:bg-red-50 transition-colors"
              >
                <X className="w-4 h-4" /> Изчисти чернова
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${filterCat === 'all' ? 'bg-zn-hot text-white border-zn-hot' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
            }`}
        >
          Всички ({articles.length})
        </button>
        {categories.filter(c => c.id !== 'all').map(c => {
          const count = articles.filter(a => a.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${filterCat === c.id ? 'bg-zn-hot text-white border-zn-hot' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
                }`}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Articles list */}
      <div className="space-y-2">
        {sorted.map(article => {
          const publishAtDate = article.publishAt ? new Date(article.publishAt) : null;
          const isScheduled = article.status === 'published' && publishAtDate && publishAtDate > new Date();
          const publishAtLabel = publishAtDate && !Number.isNaN(publishAtDate.getTime())
            ? publishAtDate.toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })
            : null;

          return (
            <div key={article.id} className="bg-white border border-gray-200 p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors group">
              {article.image && (
                <img src={article.image} alt="" className="w-20 h-14 object-cover flex-shrink-0 border border-gray-100" loading="lazy" decoding="async" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                    {getCategoryLabel(article.category)}
                  </span>
                  {article.hero && <span className="text-[9px] font-sans font-bold uppercase text-orange-600 bg-orange-50 px-1 py-0.5">HERO</span>}
                  {article.featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
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
          <div className="text-center py-12 text-sm font-sans text-gray-400">Няма статии в тази категория</div>
        )}
      </div>
    </div>
  );
}
