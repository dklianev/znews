import { useEffect, useMemo, useState } from 'react';
import { Mail, AlertTriangle, Trash2, CheckCircle2, Archive, RefreshCw, Inbox } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../utils/api';
import { useAdminData, useSessionData } from '../../context/DataContext';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readEnumSearchParam, readSearchParam } from '../../utils/adminSearchParams';

const STATUS_LABELS = Object.freeze({
  new: 'Ново',
  read: 'Прочетено',
  archived: 'Архив',
});

const STATUS_STYLES = Object.freeze({
  new: 'bg-amber-100 text-amber-800 border-amber-200',
  read: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200',
});

const CONTACT_FILTERS = ['all', 'new', 'read', 'archived'];

export default function ManageContactMessages() {
  const { session } = useSessionData();
  const { hasPermission } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [bulkActionLabel, setBulkActionLabel] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();
  const filter = readEnumSearchParam(searchParams, 'status', CONTACT_FILTERS, 'all');
  const query = readSearchParam(searchParams, 'q', '');

  const canView = Boolean(session?.token && hasPermission('contact'));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.contactMessages.getAll({ limit: 200 });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(e?.message || 'Грешка при зареждане на съобщенията');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) {
      setItems([]);
      setLoading(false);
      return;
    }

    void load();
  }, [canView]);

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let result = filter === 'all'
      ? items
      : items.filter((item) => item?.status === filter);

    if (normalizedQuery) {
      result = result.filter((item) => (
        (item?.name || '').toLowerCase().includes(normalizedQuery) ||
        (item?.phone || '').toLowerCase().includes(normalizedQuery) ||
        (item?.email || '').toLowerCase().includes(normalizedQuery) ||
        (item?.message || '').toLowerCase().includes(normalizedQuery)
      ));
    }

    return result;
  }, [filter, items, query]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedIdSet.has(item.id)),
    [filteredItems, selectedIdSet],
  );
  const selectedUnreadCount = useMemo(
    () => selectedItems.filter((item) => item.status !== 'read').length,
    [selectedItems],
  );
  const selectedUnarchivedCount = useMemo(
    () => selectedItems.filter((item) => item.status !== 'archived').length,
    [selectedItems],
  );
  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIdSet.has(item.id));
  const bulkBusy = Boolean(bulkActionLabel);

  const counts = useMemo(() => ({
    all: items.length,
    new: items.filter((item) => item?.status === 'new').length,
    read: items.filter((item) => item?.status === 'read').length,
    archived: items.filter((item) => item?.status === 'archived').length,
  }), [items]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filteredItems.some((item) => item.id === id)));
  }, [filteredItems]);

  const toggleSelection = (id) => {
    if (bulkBusy) return;
    setSelectedIds((prev) => (
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    ));
  };

  const toggleSelectAllVisible = () => {
    if (bulkBusy) return;
    setSelectedIds(allVisibleSelected ? [] : filteredItems.map((item) => item.id));
  };

  const runOptimisticStatusUpdate = async (id, status) => {
    if (bulkBusy) return;
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isInteger(numericId)) return;

    const previousItems = items;
    setBusyId(numericId);
    setError('');
    setItems((prev) => prev.map((item) => (
      item.id === numericId ? { ...item, status } : item
    )));

    try {
      const updated = await api.contactMessages.update(numericId, { status });
      setItems((prev) => prev.map((item) => (item.id === numericId ? updated : item)));
      toast.success(status === 'read' ? 'Съобщението е отбелязано като прочетено' : 'Съобщението е архивирано');
    } catch (e) {
      setItems(previousItems);
      setError(e?.message || 'Грешка при промяна на статуса');
      toast.error('Грешка при промяна на статуса');
    } finally {
      setBusyId(null);
    }
  };

  const runOptimisticDelete = async (id) => {
    if (bulkBusy) return;
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isInteger(numericId)) return;
    const confirmed = await confirm({
      title: 'Изтриване на съобщение',
      message: 'Съобщението ще бъде изтрито безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;

    const previousItems = items;
    const previousExpandedId = expandedId;
    setBusyId(numericId);
    setError('');
    setItems((prev) => prev.filter((item) => item.id !== numericId));
    if (expandedId === numericId) setExpandedId(null);

    try {
      await api.contactMessages.delete(numericId);
      toast.success('Съобщението е изтрито');
    } catch (e) {
      setItems(previousItems);
      setExpandedId(previousExpandedId);
      setError(e?.message || 'Грешка при изтриване');
      toast.error('Грешка при изтриване');
    } finally {
      setBusyId(null);
    }
  };

  const runBulkStatusUpdate = async ({ status, label, emptyMessage, successMessage, predicate }) => {
    if (bulkBusy) return;
    const targetItems = selectedItems.filter(predicate);
    if (targetItems.length === 0) {
      toast.info(emptyMessage);
      return;
    }

    const previousItems = items;
    setBulkActionLabel(label);
    setError('');
    setItems((prev) => prev.map((item) => (
      targetItems.some((selected) => selected.id === item.id)
        ? { ...item, status }
        : item
    )));

    try {
      const updatedItems = await Promise.all(
        targetItems.map((item) => api.contactMessages.update(item.id, { status })),
      );
      const updatesById = new Map(updatedItems.map((item) => [item.id, item]));
      setItems((prev) => prev.map((item) => updatesById.get(item.id) || item));
      setSelectedIds([]);
      toast.success(`${successMessage}: ${targetItems.length}`);
    } catch (e) {
      setItems(previousItems);
      setError(e?.message || 'Грешка при масова промяна на статуса');
      toast.error('Грешка при масова промяна на статуса');
    } finally {
      setBulkActionLabel('');
    }
  };

  const runBulkDelete = async () => {
    if (bulkBusy) return;
    if (selectedItems.length === 0) {
      toast.info('Няма избрани съобщения.');
      return;
    }

    const confirmed = await confirm({
      title: 'Изтриване на съобщения',
      message: `Ще изтриеш ${selectedItems.length} съобщения безвъзвратно.`,
      confirmLabel: 'Изтрий избраните',
      cancelLabel: 'Отказ',
      variant: 'danger',
    });
    if (!confirmed) return;

    const previousItems = items;
    const previousExpandedId = expandedId;
    const targetIds = selectedItems.map((item) => item.id);
    setBulkActionLabel('Изтриване');
    setError('');
    setItems((prev) => prev.filter((item) => !targetIds.includes(item.id)));
    if (expandedId && targetIds.includes(expandedId)) setExpandedId(null);

    try {
      await Promise.all(targetIds.map((id) => api.contactMessages.delete(id)));
      setSelectedIds([]);
      toast.success(`Изтрити съобщения: ${targetIds.length}`);
    } catch (e) {
      setItems(previousItems);
      setExpandedId(previousExpandedId);
      setError(e?.message || 'Грешка при изтриване');
      toast.error('Грешка при изтриване');
    } finally {
      setBulkActionLabel('');
    }
  };

  const filterBtn = (value, label) => (
      <button
        type="button"
        onClick={() => setListSearchParams({ status: value, q: query })}
        className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${filter === value
        ? 'bg-zn-hot text-white border-zn-hot'
        : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
        }`}
    >
      {label}
    </button>
  );

  if (!canView) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 p-6 text-center">
          <Mail className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-sans text-red-700 font-semibold">Нямате права за този раздел</p>
          <p className="font-sans text-red-500 text-sm mt-1">Нужно е право: contact</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Контактни съобщения"
        description={`${counts.all} съобщения • ${counts.new} нови`}
        icon={Mail}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/admin/intake?source=contact"
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans font-medium hover:bg-gray-50 transition-colors"
            >
              <Inbox className="w-4 h-4" />
              Входяща опашка
            </a>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Обнови контактните съобщения"
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Обнови
            </button>
          </div>
        )}
      />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <AdminFilterBar>
        {filterBtn('all', `Всички (${counts.all})`)}
        {filterBtn('new', `Нови (${counts.new})`)}
        {filterBtn('read', `Прочетени (${counts.read})`)}
        {filterBtn('archived', `Архив (${counts.archived})`)}
        <AdminSearchField
          value={query}
          onChange={(event) => setListSearchParams({ status: filter, q: event.target.value })}
          placeholder="Търси по име, телефон, имейл или текст..."
          ariaLabel="Търси контактни съобщения"
          className="ml-auto min-w-[280px]"
        />
      </AdminFilterBar>

      <div className="mb-4 flex flex-wrap items-center gap-2 border border-gray-200 bg-white px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm font-sans text-gray-700">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            disabled={bulkBusy || filteredItems.length === 0}
            aria-label="Избери всички видими съобщения"
          />
          Избери всички видими съобщения
        </label>
        <span className="text-xs font-sans text-gray-500">
          {selectedItems.length > 0 ? `Избрани: ${selectedItems.length}` : 'Няма избрани съобщения'}
        </span>
        <button
          type="button"
          onClick={() => void runBulkStatusUpdate({
            status: 'read',
            label: 'Маркиране',
            emptyMessage: 'Няма избрани непрочетени съобщения.',
            successMessage: 'Маркирани съобщения',
            predicate: (item) => item.status !== 'read',
          })}
          disabled={bulkBusy || selectedUnreadCount === 0}
          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-sans font-semibold disabled:opacity-50"
        >
          {bulkActionLabel === 'Маркиране' ? '...' : `Маркирай прочетени (${selectedUnreadCount})`}
        </button>
        <button
          type="button"
          onClick={() => void runBulkStatusUpdate({
            status: 'archived',
            label: 'Архивиране',
            emptyMessage: 'Няма избрани съобщения за архивиране.',
            successMessage: 'Архивирани съобщения',
            predicate: (item) => item.status !== 'archived',
          })}
          disabled={bulkBusy || selectedUnarchivedCount === 0}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-sans font-semibold disabled:opacity-50"
        >
          {bulkActionLabel === 'Архивиране' ? '...' : `Архивирай избраните (${selectedUnarchivedCount})`}
        </button>
        <button
          type="button"
          onClick={() => void runBulkDelete()}
          disabled={bulkBusy || selectedItems.length === 0}
          className="px-3 py-1.5 bg-red-600 text-white text-xs font-sans font-semibold disabled:opacity-50"
        >
          {bulkActionLabel === 'Изтриване' ? '...' : `Изтрий избраните (${selectedItems.length})`}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Зареждане...</div>
      ) : filteredItems.length === 0 ? (
        <AdminEmptyState
          title="Няма съобщения"
          description={query.trim()
            ? 'Няма контактни съобщения, които да съвпадат с текущото търсене.'
            : filter === 'all'
              ? 'Все още няма изпратени контактни съобщения.'
              : `Няма съобщения в статуса „${STATUS_LABELS[filter] || filter}“.`}
        />
      ) : (
        <div className="space-y-2">
          {filteredItems.map((message) => {
            const createdLabel = message?.createdAt ? new Date(message.createdAt).toLocaleString('bg-BG') : '';
            const status = message?.status || 'new';
            const isExpanded = expandedId === message.id;
            const isBusy = bulkBusy || busyId === message.id;

            return (
              <div key={message.id} className="bg-white border border-gray-200 p-4" aria-busy={isBusy}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="mb-2 inline-flex items-center gap-2 text-xs font-sans text-gray-500">
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(message.id)}
                        onChange={() => toggleSelection(message.id)}
                        disabled={bulkBusy}
                        aria-label={`Избери съобщение #${message.id}`}
                      />
                      Избери
                    </label>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : message.id)}
                      className="text-left w-full"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border ${STATUS_STYLES[status] || STATUS_STYLES.new}`}>
                        {STATUS_LABELS[status] || status}
                      </span>
                      <span className="text-sm font-sans font-semibold text-gray-900 truncate">{message.name || '-'}</span>
                      <span className="text-xs font-sans text-gray-400 truncate">{message.phone || message.email || ''}</span>
                      <span className="text-xs font-sans text-gray-400">{createdLabel}</span>
                    </div>
                      {!isExpanded && (
                        <p className="mt-2 text-sm font-sans text-gray-700 line-clamp-2 whitespace-pre-wrap">
                          {message.message || ''}
                        </p>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {status !== 'read' && (
                      <button
                        type="button"
                        onClick={() => void runOptimisticStatusUpdate(message.id, 'read')}
                        disabled={isBusy}
                        aria-label="Маркирай съобщението като прочетено"
                        className="p-2 text-gray-400 hover:text-emerald-700 disabled:opacity-50"
                        title="Маркирай като прочетено"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => void runOptimisticStatusUpdate(message.id, 'archived')}
                        disabled={isBusy}
                        aria-label="Архивирай съобщението"
                        className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-50"
                        title="Архивирай"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void runOptimisticDelete(message.id)}
                      disabled={isBusy}
                      aria-label="Изтрий съобщение"
                      className="p-2 text-gray-400 hover:text-red-700 disabled:opacity-50"
                      title="Изтрий"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="mb-2 text-xs font-sans text-gray-500">
                      {message.phone ? `Телефон: ${message.phone}` : message.email ? `Имейл: ${message.email}` : ''}
                    </p>
                    <p className="text-sm font-sans text-gray-700 whitespace-pre-wrap">
                      {message.message || ''}
                    </p>
                    <div className="mt-3 text-xs font-sans text-gray-400">
                      ID: {message.id}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
