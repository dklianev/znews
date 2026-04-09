import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ClipboardList, Clock, Filter, Pencil, Plus, Search, ShieldAlert, Trash2, AlertTriangle } from 'lucide-react';
import { useAdminData, useSessionData } from '../../context/DataContext';
import { api } from '../../utils/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import { buildAdminSearchParams, readEnumSearchParam, readSearchParam } from '../../utils/adminSearchParams';

const ACTION_ICONS = { create: Plus, update: Pencil, delete: Trash2 };
const ACTION_COLORS = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
};
const ACTION_LABELS = { create: 'Създаване', update: 'Редакция', delete: 'Изтриване' };
const ACTION_OPTIONS = Object.freeze([
  { value: 'all', label: 'Всички действия' },
  { value: 'create', label: 'Създаване' },
  { value: 'update', label: 'Редакции' },
  { value: 'delete', label: 'Изтривания' },
]);
const RESOURCE_LABELS = Object.freeze({
  articles: 'Статии',
  authors: 'Автори',
  ads: 'Реклами',
  users: 'Потребители',
  wanted: 'Издирвани',
  jobs: 'Работа',
  court: 'Съд',
  events: 'Събития',
  polls: 'Анкети',
  comments: 'Коментари',
  gallery: 'Галерия',
  tips: 'Сигнали',
  'contact-messages': 'Запитвания',
  'hero-settings': 'Hero настройки',
  'site-settings': 'Настройки на сайта',
  unknown: 'Друго',
});
const RESOURCE_OPTIONS = Object.freeze([
  { value: 'all', label: 'Всички ресурси' },
  { value: 'articles', label: 'Статии' },
  { value: 'comments', label: 'Коментари' },
  { value: 'tips', label: 'Сигнали' },
  { value: 'contact-messages', label: 'Запитвания' },
  { value: 'site-settings', label: 'Настройки на сайта' },
  { value: 'hero-settings', label: 'Hero настройки' },
  { value: 'users', label: 'Потребители' },
]);

function getAuditResourceHref(log) {
  const resourceId = Number.parseInt(String(log?.resourceId || ''), 10);
  switch (log?.resource) {
    case 'articles':
      return `/admin/articles${Number.isInteger(resourceId) ? `?q=${encodeURIComponent(String(resourceId))}` : ''}`;
    case 'comments':
      return '/admin/comments';
    case 'tips':
      return `/admin/intake?source=tip${Number.isInteger(resourceId) ? `&q=${encodeURIComponent(String(resourceId))}` : ''}`;
    case 'contact-messages':
      return `/admin/intake?source=contact${Number.isInteger(resourceId) ? `&q=${encodeURIComponent(String(resourceId))}` : ''}`;
    case 'site-settings':
      return '/admin/site-settings';
    case 'hero-settings':
      return '/admin/hero';
    case 'users':
      return '/admin/profiles';
    case 'ads':
      return '/admin/ads';
    case 'jobs':
      return '/admin/jobs';
    case 'court':
      return '/admin/court';
    case 'events':
      return '/admin/events';
    case 'polls':
      return '/admin/polls';
    case 'wanted':
      return '/admin/wanted';
    case 'gallery':
      return '/admin/gallery';
    default:
      return '';
  }
}

export default function ManageAuditLog() {
  const { session } = useSessionData();
  const { hasPermission } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState('');

  const filterResource = readEnumSearchParam(
    searchParams,
    'resource',
    RESOURCE_OPTIONS.map((option) => option.value),
    'all',
  );
  const filterAction = readEnumSearchParam(
    searchParams,
    'action',
    ACTION_OPTIONS.map((option) => option.value),
    'all',
  );
  const query = readSearchParam(searchParams, 'q', '');
  const resourceId = readSearchParam(searchParams, 'resourceId', '');
  const normalizedResourceId = Number.parseInt(resourceId, 10);

  const requestParams = useMemo(() => ({
    limit: 200,
    ...(filterResource !== 'all' ? { resource: filterResource } : {}),
    ...(filterAction !== 'all' ? { action: filterAction } : {}),
    ...(Number.isInteger(normalizedResourceId) && normalizedResourceId > 0 ? { resourceId: normalizedResourceId } : {}),
    ...(query ? { q: query } : {}),
  }), [filterAction, filterResource, normalizedResourceId, query]);

  useEffect(() => {
    if (!session?.token) {
      setLogs([]);
      setNextCursor(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const page = await api.auditLog.getPage(requestParams);
        const items = Array.isArray(page?.items) ? page.items : [];
        if (!cancelled) {
          setLogs(items);
          setNextCursor(page?.nextCursor || null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setLogs([]);
          setNextCursor(null);
          setError(fetchError?.message || 'Грешка при зареждане на журнала');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestParams, session?.token]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await api.auditLog.getPage({ ...requestParams, cursor: nextCursor });
      const items = Array.isArray(page?.items) ? page.items : [];
      setLogs((currentLogs) => [...currentLogs, ...items]);
      setNextCursor(page?.nextCursor || null);
    } catch (fetchError) {
      setError(fetchError?.message || 'Грешка при зареждане на журнала');
    } finally {
      setLoadingMore(false);
    }
  };

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const activeSavedViews = useMemo(() => ([
    { key: 'articles', label: 'Статии', updates: { resource: 'articles', action: 'all', resourceId: '', q: '' } },
    { key: 'intake', label: 'Входящи', updates: { resource: 'tips', action: 'all', resourceId: '', q: '' } },
    { key: 'contact', label: 'Запитвания', updates: { resource: 'contact-messages', action: 'all', resourceId: '', q: '' } },
    { key: 'settings', label: 'Настройки', updates: { resource: 'site-settings', action: 'all', resourceId: '', q: '' } },
    { key: 'destructive', label: 'Изтривания', updates: { resource: 'all', action: 'delete', resourceId: '', q: '' } },
  ]), []);

  const isSavedViewActive = (view) => (
    filterResource === view.updates.resource
    && filterAction === view.updates.action
    && resourceId === view.updates.resourceId
    && query === view.updates.q
  );

  const emptyDescription = filterResource === 'all' && filterAction === 'all' && !query && !resourceId
    ? 'Все още няма действия в журнала.'
    : 'Няма записи за избраните филтри.';

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Журнал на действията"
        description="Проследявай редакции, изтривания и оперативни промени с филтри, търсене и бързи връзки."
        icon={ClipboardList}
      />

      {!hasPermission('permissions') ? (
        <div className="bg-red-50 border border-red-200 p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-sans text-red-700 font-semibold">Нямате достъп до тази страница</p>
          <p className="font-sans text-red-500 text-sm mt-1">Нужни са права за управление на permissions</p>
        </div>
      ) : (
        <>
          {error ? (
            <div className="mb-4 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            {activeSavedViews.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => setListSearchParams(view.updates)}
                className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${isSavedViewActive(view)
                  ? 'bg-zn-comic-black text-white border-zn-comic-black'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
                  }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          <AdminFilterBar className="mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterResource}
                onChange={(event) => setListSearchParams({ resource: event.target.value })}
                aria-label="Филтрирай журнала по ресурс"
                className="px-3 py-2 border border-gray-200 bg-white text-sm font-sans text-gray-700 outline-none focus:border-zn-purple"
              >
                {RESOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterAction}
                onChange={(event) => setListSearchParams({ action: event.target.value })}
                aria-label="Филтрирай журнала по действие"
                className="px-3 py-2 border border-gray-200 bg-white text-sm font-sans text-gray-700 outline-none focus:border-zn-purple"
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                value={resourceId}
                onChange={(event) => setListSearchParams({ resourceId: event.target.value })}
                placeholder="Точен ID"
                aria-label="Филтрирай журнала по точен ID"
                className="w-28 px-3 py-2 border border-gray-200 bg-white text-sm font-sans text-gray-700 outline-none focus:border-zn-purple"
              />
            </div>
            <AdminSearchField
              value={query}
              onChange={(event) => setListSearchParams({ q: event.target.value })}
              placeholder="Търси по потребител, ресурс или детайли"
              ariaLabel="Търси в журнала по потребител, ресурс или детайли"
            />
          </AdminFilterBar>

          {Number.isInteger(normalizedResourceId) && normalizedResourceId > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 border border-zn-purple/20 bg-zn-purple/10 px-3 py-1.5 text-xs font-sans font-semibold text-zn-purple">
                Точен запис #{normalizedResourceId}
              </span>
            </div>
          ) : null}

          {loading ? (
            <div className="text-center py-12 text-gray-400">Зареждане...</div>
          ) : logs.length === 0 ? (
            <AdminEmptyState
              title="Няма записи"
              description={emptyDescription}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-left">
                    <th className="px-4 py-3 font-semibold">Действие</th>
                    <th className="px-4 py-3 font-semibold">Потребител</th>
                    <th className="px-4 py-3 font-semibold">Ресурс</th>
                    <th className="px-4 py-3 font-semibold">Детайли</th>
                    <th className="px-4 py-3 font-semibold">Дата</th>
                    <th className="px-4 py-3 font-semibold">Връзка</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => {
                    const Icon = ACTION_ICONS[log.action] || ClipboardList;
                    const colorClass = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700';
                    const href = getAuditResourceHref(log);
                    return (
                      <motion.tr
                        key={`${log.timestamp}-${log.resource}-${log.resourceId}-${index}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-t border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{log.user}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {RESOURCE_LABELS[log.resource] || log.resource}
                          <span className="text-gray-400 ml-1">#{log.resourceId}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[260px] break-words">{log.details || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(log.timestamp).toLocaleString('bg-BG')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {href ? (
                            <a
                              href={href}
                              className="inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-zn-purple hover:underline"
                            >
                              <Search className="w-3.5 h-3.5" />
                              Отвори
                            </a>
                          ) : (
                            <span className="text-xs font-sans text-gray-400">—</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {nextCursor && !loading ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Зареждане...' : 'Още'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
