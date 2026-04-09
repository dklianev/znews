import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePublicData } from '../../context/DataContext';
import { Clock3, FilePenLine, Send, CalendarClock, CirclePause, Loader2, ClipboardList } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readEnumSearchParam, readSearchParam } from '../../utils/adminSearchParams';

function isScheduledArticle(article) {
  if (article?.status !== 'published') return false;
  if (!article?.publishAt) return false;
  const publishDate = new Date(article.publishAt);
  if (Number.isNaN(publishDate.getTime())) return false;
  return publishDate > new Date();
}

function toLocalDateLabel(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });
}

export default function EditorialQueue() {
  const { articles, categories, authors, updateArticle } = usePublicData();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readEnumSearchParam(searchParams, 'tab', ['drafts', 'scheduled', 'today'], 'drafts');
  const query = readSearchParam(searchParams, 'q', '');
  const category = readSearchParam(searchParams, 'category', 'all');
  const [workingId, setWorkingId] = useState(null);
  const toast = useToast();

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const byStatus = useMemo(() => {
    const drafts = articles.filter(article => article.status === 'draft');
    const scheduled = articles.filter(isScheduledArticle);
    const publishedToday = articles.filter((article) => {
      if (article.status !== 'published') return false;
      if (isScheduledArticle(article)) return false;
      const publishDate = article.publishAt ? new Date(article.publishAt) : null;
      if (publishDate && !Number.isNaN(publishDate.getTime())) {
        return publishDate.toISOString().slice(0, 10) === todayIso;
      }
      return article.date === todayIso;
    });
    return { drafts, scheduled, publishedToday };
  }, [articles, todayIso]);

  const activeItems = useMemo(() => {
    const source = tab === 'scheduled'
      ? byStatus.scheduled
      : tab === 'today'
        ? byStatus.publishedToday
        : byStatus.drafts;

    const q = query.trim().toLowerCase();
    return source
      .filter((article) => category === 'all' || article.category === category)
      .filter((article) => {
        if (!q) return true;
        return (article.title || '').toLowerCase().includes(q)
          || (article.excerpt || '').toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [byStatus.drafts, byStatus.publishedToday, byStatus.scheduled, category, query, tab]);

  const categoryNameById = useMemo(
    () => new Map(categories.map(item => [item.id, item.name])),
    [categories],
  );
  const authorNameById = useMemo(
    () => new Map(authors.map(item => [item.id, item.name])),
    [authors],
  );

  const runQuickAction = async (articleId, payload, successMsg) => {
    setWorkingId(articleId);
    try {
      await updateArticle(articleId, payload);
      if (successMsg) toast.success(successMsg);
    } catch (e) {
      toast.error(e?.message || 'Грешка при действието');
    } finally {
      setWorkingId(null);
    }
  };

  const tabButton = (key, label, count) => (
    <button
      type="button"
      onClick={() => setListSearchParams({ tab: key, q: query, category })}
      className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${tab === key ? 'bg-zn-hot text-white border-zn-hot' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'}`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Editorial Queue"
        description="Чернови, планирани и публикувани днес с бързи действия"
        icon={ClipboardList}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {tabButton('drafts', 'Чернови', byStatus.drafts.length)}
        {tabButton('scheduled', 'Планирани', byStatus.scheduled.length)}
        {tabButton('today', 'Публикувани днес', byStatus.publishedToday.length)}
      </div>

      <AdminFilterBar className="mb-4 rounded border border-gray-200 bg-white p-4">
        <AdminSearchField
          value={query}
          onChange={(event) => setListSearchParams({ tab, q: event.target.value, category })}
          placeholder="Търси по заглавие или резюме"
          ariaLabel="Търси по заглавие или резюме"
          className="md:col-span-2"
        />
        <select
          value={category}
          onChange={(event) => setListSearchParams({ tab, q: query, category: event.target.value })}
          className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
        >
          <option value="all">Всички категории</option>
          {categories.filter(item => item.id !== 'all').map(item => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </AdminFilterBar>

      <div className="space-y-2">
        {activeItems.map((article) => {
          const scheduled = isScheduledArticle(article);
          const isWorking = workingId === article.id;

          return (
            <div key={article.id} className="bg-white border border-gray-200 p-4 flex items-start gap-4">
              {article.image && (
                <img src={article.image} alt="" className="w-24 h-16 object-cover border border-gray-100" loading="lazy" decoding="async" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                    {categoryNameById.get(article.category) || article.category}
                  </span>
                  {article.status === 'draft' && (
                    <span className="text-[9px] font-sans font-bold uppercase text-gray-500 bg-gray-200 px-1 py-0.5 rounded">ЧЕРНОВА</span>
                  )}
                  {scheduled && (
                    <span className="text-[9px] font-sans font-bold uppercase text-blue-700 bg-blue-50 px-1 py-0.5 rounded">ПЛАНИРАНА</span>
                  )}
                  {!scheduled && article.status === 'published' && (
                    <span className="text-[9px] font-sans font-bold uppercase text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">ПУБЛИКУВАНА</span>
                  )}
                </div>
                <h3 className="text-sm font-sans font-bold text-gray-900">{article.title}</h3>
                <p className="text-xs font-sans text-gray-500 mt-0.5">
                  {authorNameById.get(article.authorId) || 'Неизвестен'} · {article.date}
                  {article.publishAt ? ` · publishAt: ${toLocalDateLabel(article.publishAt)}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-[220px]">
                {article.status === 'draft' && (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => runQuickAction(article.id, { status: 'published', publishAt: null, date: new Date().toISOString().slice(0, 10) }, 'Статията е публикувана')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-sans font-semibold uppercase tracking-wider bg-zn-hot text-white border border-zn-hot hover:bg-red-700 transition-colors disabled:opacity-60"
                  >
                    {isWorking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Публикувай
                  </button>
                )}

                {article.status === 'published' && (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => runQuickAction(article.id, { status: 'draft' }, 'Статията е в чернова')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-sans font-semibold uppercase tracking-wider text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60"
                  >
                    {isWorking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CirclePause className="w-3 h-3" />}
                    Към чернова
                  </button>
                )}

                {scheduled ? (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => runQuickAction(article.id, { publishAt: null }, 'Планирането е премахнато')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-sans font-semibold uppercase tracking-wider text-blue-700 border border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-60"
                  >
                    {isWorking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock3 className="w-3 h-3" />}
                    Премахни час
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={() => {
                      const inHour = new Date(Date.now() + (60 * 60 * 1000));
                      runQuickAction(article.id, { status: 'published', publishAt: inHour.toISOString() }, 'Планирано за след 1 час');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-sans font-semibold uppercase tracking-wider text-blue-700 border border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-60"
                  >
                    {isWorking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarClock className="w-3 h-3" />}
                    +1ч
                  </button>
                )}

                <a
                  href={`/admin/articles`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-sans font-semibold uppercase tracking-wider text-zn-purple border border-zn-purple/40 hover:bg-zn-purple/5 transition-colors"
                >
                  <FilePenLine className="w-3 h-3" />
                  Редакция
                </a>
              </div>
            </div>
          );
        })}

        {activeItems.length === 0 && (
          <AdminEmptyState
            title="Няма публикации"
            description="Промени филтрите или избери друг таб, за да видиш публикации в editorial queue."
          />
        )}
      </div>
    </div>
  );
}
