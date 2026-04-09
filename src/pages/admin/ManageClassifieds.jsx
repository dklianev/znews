import { useEffect, useMemo, useOptimistic, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminData } from '../../context/DataContext';
import { RefreshCw, Trash2, CheckCircle, XCircle, Image as ImageIcon, Phone, User, DollarSign, Clock, Copy, Check, Star, ArrowUp, RotateCcw, Eye, Camera } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import { copyToClipboard } from '../../utils/copyToClipboard';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readEnumSearchParam, readSearchParam } from '../../utils/adminSearchParams';

const STATUS_CONFIG = {
  awaiting_payment: { label: 'Чака плащане', bg: 'bg-yellow-100 text-yellow-800', dotColor: 'bg-yellow-500' },
  active: { label: 'Активна', bg: 'bg-green-100 text-green-800', dotColor: 'bg-green-500' },
  rejected: { label: 'Отхвърлена', bg: 'bg-red-100 text-red-700', dotColor: 'bg-red-500' },
};

const CATEGORY_LABELS = {
  cars: 'Коли', properties: 'Имоти', services: 'Услуги',
  'looking-for': 'Търся', selling: 'Продавам', other: 'Разни',
};

const TIER_LABELS = { standard: 'Стандартна', highlighted: 'Удебелена', vip: 'VIP' };

function CopyInline({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const success = await copyToClipboard(text);
    if (!success) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={copy} aria-label={`Копирай кода ${text}`} className="inline-flex items-center gap-1 text-zn-purple hover:text-zn-hot transition-colors" title="Копирай">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function formatAdminAmount(amount, currency) {
  const normalizedCurrency = typeof currency === 'string' && currency.trim()
    ? currency.trim()
    : '$';
  const numericAmount = Number(amount);
  const formattedAmount = Number.isFinite(numericAmount)
    ? numericAmount.toLocaleString('bg-BG')
    : '0';
  return `${normalizedCurrency}${formattedAmount}`;
}

export default function ManageClassifieds() {
  const { classifieds, classifiedsReady, refreshClassifieds, ensureClassifiedsLoaded, approveClassified, rejectClassified, deleteClassified, bumpClassified, renewClassified } = useAdminData();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busyId, setBusyId] = useState(null);
  const [bulkActionLabel, setBulkActionLabel] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [paidByInputs, setPaidByInputs] = useState({});
  const query = readSearchParam(searchParams, 'q', '');
  const statusFilter = readEnumSearchParam(
    searchParams,
    'status',
    ['all', 'awaiting_payment', 'active', 'rejected', 'expired'],
    'all',
  );

  const isAuthError = (error) => {
    const status = Number(error?.status);
    if (status === 401 || status === 403) return true;
    return String(error?.message || '').toLowerCase().includes('authentication required');
  };

  const showClassifiedsError = (error, fallbackMessage = 'Неуспешна операция.') => {
    if (isAuthError(error)) return;
    toast.error(`Грешка: ${error?.message || fallbackMessage}`);
  };

  const refreshAfterFailure = async () => {
    try {
      await refreshClassifieds();
    } catch (refreshError) {
      if (!isAuthError(refreshError)) {
        console.error('Failed to refresh classifieds after action failure:', refreshError);
      }
    }
  };

  const [optimistic, applyUpdate] = useOptimistic(classifieds, (current, mutation) => {
    if (!Array.isArray(current)) return [];
    if (mutation.type === 'status') return current.map(c => c.id === mutation.id ? { ...c, status: mutation.status } : c);
    if (mutation.type === 'delete') return current.filter(c => c.id !== mutation.id);
    if (mutation.type === 'bump') return current.map(c => c.id === mutation.id ? { ...c, bumpedAt: new Date().toISOString() } : c);
    return current;
  });

  useEffect(() => {
    ensureClassifiedsLoaded().catch((error) => {
      showClassifiedsError(error, 'Не успяхме да заредим малките обяви.');
    });
  }, [ensureClassifiedsLoaded]);

  const handleRefresh = async () => {
    try {
      await refreshClassifieds();
    } catch (error) {
      showClassifiedsError(error, 'Не успяхме да обновим малките обяви.');
    }
  };

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return optimistic.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return (c.title || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.contactName || '').toLowerCase().includes(q) ||
        (c.paymentRef || '').toLowerCase().includes(q);
    });
  }, [optimistic, query, statusFilter]);
  const selectedIdSet = useMemo(
    () => new Set(selectedIds),
    [selectedIds],
  );
  const selectedItems = useMemo(
    () => filtered.filter((item) => selectedIdSet.has(Number(item.id))),
    [filtered, selectedIdSet],
  );
  const selectedAwaitingCount = useMemo(
    () => selectedItems.filter((item) => item.status === 'awaiting_payment').length,
    [selectedItems],
  );
  const selectedActiveCount = useMemo(
    () => selectedItems.filter((item) => item.status === 'active').length,
    [selectedItems],
  );
  const allVisibleSelected = useMemo(
    () => filtered.length > 0 && filtered.every((item) => selectedIdSet.has(Number(item.id))),
    [filtered, selectedIdSet],
  );
  const bulkBusy = Boolean(bulkActionLabel);

  const counts = useMemo(() => {
    const c = { all: 0, awaiting_payment: 0, active: 0, rejected: 0, expired: 0 };
    (Array.isArray(optimistic) ? optimistic : []).forEach(item => {
      c.all++;
      if (c[item.status] !== undefined) c[item.status]++;
    });
    return c;
  }, [optimistic]);

  useEffect(() => {
    const visibleIds = new Set(
      filtered
        .map((item) => Number.parseInt(String(item?.id), 10))
        .filter((id) => Number.isInteger(id)),
    );
    setSelectedIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [filtered]);

  const toggleSelection = (id) => {
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isInteger(numericId) || bulkBusy) return;
    setSelectedIds((prev) => (
      prev.includes(numericId)
        ? prev.filter((item) => item !== numericId)
        : [...prev, numericId]
    ));
  };

  const toggleSelectAllVisible = () => {
    if (bulkBusy || filtered.length === 0) return;
    const visibleIds = filtered
      .map((item) => Number.parseInt(String(item?.id), 10))
      .filter((id) => Number.isInteger(id));
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const handleApprove = async (id) => {
    if (bulkBusy) return;
    setBusyId(id);
    applyUpdate({ type: 'status', id, status: 'active' });
    try {
      await approveClassified(id, paidByInputs[id] || '');
      toast.success('Обявата е одобрена и публикувана');
    } catch (e) {
      await refreshAfterFailure();
      showClassifiedsError(e);
    } finally { setBusyId(null); }
  };

  const handleReject = async (id) => {
    if (bulkBusy) return;
    setBusyId(id);
    applyUpdate({ type: 'status', id, status: 'rejected' });
    try {
      await rejectClassified(id);
      toast.success('Обявата е отхвърлена');
    } catch (e) {
      await refreshAfterFailure();
      showClassifiedsError(e);
    } finally { setBusyId(null); }
  };

  const handleDelete = async (id) => {
    if (bulkBusy) return;
    const confirmed = await confirm({
      title: 'Изтриване на обява',
      message: 'Обявата ще бъде изтрита безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;
    setBusyId(id);
    applyUpdate({ type: 'delete', id });
    try {
      await deleteClassified(id);
      toast.success('Обявата е изтрита');
    } catch (e) {
      await refreshAfterFailure();
      showClassifiedsError(e);
    } finally { setBusyId(null); }
  };

  const handleBump = async (id) => {
    if (bulkBusy) return;
    setBusyId(id);
    applyUpdate({ type: 'bump', id });
    try {
      await bumpClassified(id);
      toast.success('Обявата е bump-ната (преместена отгоре)');
    } catch (e) {
      await refreshAfterFailure();
      showClassifiedsError(e);
    } finally { setBusyId(null); }
  };

  const handleRenew = async (id) => {
    if (bulkBusy) return;
    setBusyId(id);
    try {
      await renewClassified(id, '');
      toast.success('Обявата е подновена');
    } catch (e) {
      await refreshAfterFailure();
      showClassifiedsError(e);
    } finally { setBusyId(null); }
  };

  const STATUS_TABS = [
    { value: 'all', label: 'Всички' },
    { value: 'awaiting_payment', label: 'Чакащи' },
    { value: 'active', label: 'Активни' },
    { value: 'rejected', label: 'Отхвърлени' },
    { value: 'expired', label: 'Изтекли' },
  ];

  const runBulkAction = async ({
    label,
    items,
    emptyMessage,
    confirmConfig = null,
    optimisticMutation = null,
    action,
    successMessage,
  }) => {
    if (bulkBusy) return;
    if (items.length === 0) {
      toast.info(emptyMessage);
      return;
    }

    if (confirmConfig) {
      const confirmed = await confirm(confirmConfig);
      if (!confirmed) return;
    }

    setBulkActionLabel(label);
    const successfulIds = [];
    let failedCount = 0;

    try {
      for (const item of items) {
        if (typeof optimisticMutation === 'function') {
          const mutation = optimisticMutation(item);
          if (mutation) applyUpdate(mutation);
        }

        try {
          await action(item);
          successfulIds.push(Number(item.id));
        } catch (error) {
          failedCount += 1;
          showClassifiedsError(error);
        }
      }

      if (failedCount > 0) {
        await refreshAfterFailure();
        toast.warning(`Неуспешни действия: ${failedCount}`);
      }
      if (successfulIds.length > 0) {
        toast.success(`${successMessage}: ${successfulIds.length}`);
      }
      setSelectedIds((prev) => prev.filter((id) => !successfulIds.includes(id)));
    } finally {
      setBulkActionLabel('');
    }
  };

  const handleBulkApprove = async () => {
    await runBulkAction({
      label: 'Потвърждаване',
      items: selectedItems.filter((item) => item.status === 'awaiting_payment'),
      emptyMessage: 'Няма избрани чакащи обяви за потвърждение.',
      optimisticMutation: (item) => ({ type: 'status', id: item.id, status: 'active' }),
      action: (item) => approveClassified(item.id, paidByInputs[item.id] || ''),
      successMessage: 'Потвърдени обяви',
    });
  };

  const handleBulkReject = async () => {
    await runBulkAction({
      label: 'Отхвърляне',
      items: selectedItems.filter((item) => item.status === 'awaiting_payment' || item.status === 'active'),
      emptyMessage: 'Няма избрани активни или чакащи обяви за отхвърляне.',
      optimisticMutation: (item) => ({ type: 'status', id: item.id, status: 'rejected' }),
      action: (item) => rejectClassified(item.id),
      successMessage: 'Отхвърлени обяви',
    });
  };

  const handleBulkBump = async () => {
    await runBulkAction({
      label: 'Bump',
      items: selectedItems.filter((item) => item.status === 'active'),
      emptyMessage: 'Няма избрани активни обяви за bump.',
      optimisticMutation: (item) => ({ type: 'bump', id: item.id }),
      action: (item) => bumpClassified(item.id),
      successMessage: 'Bump-нати обяви',
    });
  };

  const handleBulkDelete = async () => {
    const items = selectedItems;
    await runBulkAction({
      label: 'Изтриване',
      items,
      emptyMessage: 'Няма избрани обяви за изтриване.',
      confirmConfig: {
        title: 'Изтриване на избрани обяви',
        message: `Ще изтриеш ${items.length} обяви безвъзвратно.`,
        confirmLabel: 'Изтрий',
        variant: 'danger',
      },
      optimisticMutation: (item) => ({ type: 'delete', id: item.id }),
      action: (item) => deleteClassified(item.id),
      successMessage: 'Изтрити обяви',
    });
  };

  return (
    <div className="p-8 min-h-full">
      <AdminPageHeader
        title="Малки обяви"
        description="Управление и потвърждаване на плащания"
        actions={(
          <button type="button" onClick={handleRefresh} aria-label="Обнови обявите" className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-sm font-sans text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" /> Обнови
          </button>
        )}
      />

      <AdminFilterBar className="mb-4">
        {STATUS_TABS.map(tab => (
          <button key={tab.value} type="button" onClick={() => setListSearchParams({ status: tab.value, q: query })} className={`px-3 py-1.5 text-xs font-sans font-bold rounded-full border transition-colors ${statusFilter === tab.value ? 'bg-zn-purple text-white border-zn-purple' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {tab.label} ({counts[tab.value] || 0})
          </button>
        ))}
      </AdminFilterBar>

      <AdminFilterBar className="mb-6">
        <AdminSearchField
          value={query}
          onChange={(event) => setListSearchParams({ status: statusFilter, q: event.target.value })}
          placeholder="Търси по заглавие, описание, име или код за плащане..."
          ariaLabel="Търси малки обяви"
        />
      </AdminFilterBar>

      <AdminFilterBar className="mb-6">
        <label className="inline-flex items-center gap-2 text-xs font-sans font-semibold text-gray-600">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={() => toggleSelectAllVisible()}
            disabled={bulkBusy || filtered.length === 0}
            aria-label="Избери всички видими обяви"
            className="h-4 w-4 rounded border-gray-300 text-zn-purple focus:ring-zn-purple"
          />
          Избрани: {selectedItems.length}
        </label>
        {bulkBusy ? (
          <span className="text-xs font-sans font-semibold text-gray-500">{bulkActionLabel}...</span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleBulkApprove()}
            disabled={bulkBusy || selectedAwaitingCount === 0}
            className="px-3 py-1.5 text-xs font-sans font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          >
            Потвърди избраните ({selectedAwaitingCount})
          </button>
          <button
            type="button"
            onClick={() => void handleBulkReject()}
            disabled={bulkBusy || (selectedAwaitingCount + selectedActiveCount) === 0}
            className="px-3 py-1.5 text-xs font-sans font-semibold text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            Отхвърли избраните ({selectedAwaitingCount + selectedActiveCount})
          </button>
          <button
            type="button"
            onClick={() => void handleBulkBump()}
            disabled={bulkBusy || selectedActiveCount === 0}
            className="px-3 py-1.5 text-xs font-sans font-semibold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            Bump избраните ({selectedActiveCount})
          </button>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={bulkBusy || selectedItems.length === 0}
            className="px-3 py-1.5 text-xs font-sans font-semibold text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            Изтрий избраните ({selectedItems.length})
          </button>
        </div>
      </AdminFilterBar>

      <div className="space-y-4">
        {classifiedsReady && filtered.length === 0 ? (
          <AdminEmptyState
            title="Няма обяви"
            description={query.trim() || statusFilter !== 'all'
              ? 'Няма обяви, които да съвпадат с текущите филтри.'
              : 'Все още няма подадени малки обяви за модерация.'}
          />
        ) : filtered.map(item => {
          const stCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.awaiting_payment;
          const isBusy = bulkBusy || busyId === item.id;
          const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
          const mainImage = item.images?.[0] || null;
          const imageCount = item.images?.length || 0;

          return (
            <div key={item.id} className="bg-white border border-gray-200 p-5 shadow-sm" aria-busy={isBusy}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(Number(item.id))}
                      onChange={() => toggleSelection(item.id)}
                      disabled={isBusy}
                      aria-label={`Избери обява #${item.id}`}
                      className="h-4 w-4 rounded border-gray-300 text-zn-purple focus:ring-zn-purple"
                    />
                  </label>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${stCfg.bg}`}>{stCfg.label}</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">{CATEGORY_LABELS[item.category] || item.category}</span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full">{TIER_LABELS[item.tier] || item.tier}</span>
                  {item.tier === 'vip' && <Star className="w-4 h-4 text-zn-purple" />}
                  {isExpired && item.status === 'active' && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-bold rounded-full">Изтекла</span>}
                </div>
                <span className="text-xs text-gray-400 font-mono whitespace-nowrap">#{item.id}</span>
              </div>

              {/* Content */}
              <div className="flex gap-4">
                {mainImage && (
                  <div className="w-20 h-20 bg-black flex-shrink-0 border-2 border-gray-200 overflow-hidden relative">
                    <img src={mainImage} className="w-full h-full object-cover" alt="" loading="lazy" />
                    {imageCount > 1 && (
                      <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] font-mono px-1 py-0.5 flex items-center gap-0.5">
                        <Camera className="w-2.5 h-2.5" />{imageCount}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm font-sans text-gray-600 line-clamp-2 mb-2">{item.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-gray-500">
                    {item.price && <span className="flex items-center gap-1 font-bold text-green-700"><DollarSign className="w-3 h-3" />{item.price}</span>}
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.contactName}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{item.phone}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.createdAt).toLocaleString('bg-BG')}</span>
                    {item.viewCount > 0 && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{item.viewCount} прегл.</span>}
                  </div>
                </div>
              </div>

              {/* Payment info */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-sm font-sans">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">Код:</span>
                  <span className="font-mono font-bold text-zn-purple">{item.paymentRef}</span>
                  <CopyInline text={item.paymentRef} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">Сума:</span>
                  <span className="font-mono font-bold text-green-700">{formatAdminAmount(item.amountDue, item.currency)}</span>
                </div>
                {item.paidBy && <div className="flex items-center gap-1.5"><span className="text-gray-400">Платено от:</span><span className="font-bold">{item.paidBy}</span></div>}
                {item.expiresAt && <div className="flex items-center gap-1.5"><span className="text-gray-400">Изтича:</span><span className="font-bold">{new Date(item.expiresAt).toLocaleString('bg-BG')}</span></div>}
                {item.bumpedAt && <div className="flex items-center gap-1.5"><span className="text-gray-400">Bump:</span><span className="font-bold">{new Date(item.bumpedAt).toLocaleString('bg-BG')}</span></div>}
              </div>

              {/* Actions */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
                {item.status === 'awaiting_payment' && (
                  <>
                    <input
                      type="text"
                      placeholder="Бележка за плащане (по желание)"
                      value={paidByInputs[item.id] || ''}
                      onChange={e => setPaidByInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="flex-1 min-w-[200px] px-3 py-1.5 text-sm font-sans border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400"
                    />
                    <button type="button" onClick={() => handleApprove(item.id)} disabled={isBusy} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white font-bold font-sans text-xs hover:bg-green-700 disabled:opacity-50 transition-colors">
                      <CheckCircle className="w-3.5 h-3.5" /> Потвърди плащане
                    </button>
                    <button type="button" onClick={() => handleReject(item.id)} disabled={isBusy} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 font-bold font-sans text-xs hover:bg-red-50 disabled:opacity-50 transition-colors">
                      <XCircle className="w-3.5 h-3.5" /> Отхвърли
                    </button>
                  </>
                )}
                {item.status === 'active' && (
                  <>
                    <button type="button" onClick={() => handleBump(item.id)} disabled={isBusy} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-bold font-sans text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      <ArrowUp className="w-3.5 h-3.5" /> Bump
                    </button>
                    {item.tier === 'vip' && (
                      <button type="button" onClick={() => handleRenew(item.id)} disabled={isBusy} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white font-bold font-sans text-xs hover:bg-purple-700 disabled:opacity-50 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Поднови
                      </button>
                    )}
                    <button type="button" onClick={() => handleReject(item.id)} disabled={isBusy} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 font-bold font-sans text-xs hover:bg-red-50 disabled:opacity-50 transition-colors">
                      <XCircle className="w-3.5 h-3.5" /> Деактивирай
                    </button>
                  </>
                )}
                <button type="button" onClick={() => handleDelete(item.id)} disabled={isBusy} aria-label="Изтрий обявата" className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors ml-auto">
                  {isBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
