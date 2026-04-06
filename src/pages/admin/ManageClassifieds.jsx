import { useEffect, useMemo, useOptimistic, useState } from 'react';
import { useAdminData } from '../../context/DataContext';
import { RefreshCw, Trash2, CheckCircle, XCircle, Search, Image as ImageIcon, Phone, User, DollarSign, Clock, Copy, Check, Tag, Star, ArrowUp, RotateCcw, Eye, Camera } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';

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
    try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-zn-purple hover:text-zn-hot transition-colors" title="Копирай">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ManageClassifieds() {
  const { classifieds, classifiedsReady, refreshClassifieds, ensureClassifiedsLoaded, approveClassified, rejectClassified, deleteClassified, bumpClassified, renewClassified } = useAdminData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [paidByInputs, setPaidByInputs] = useState({});

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

  const counts = useMemo(() => {
    const c = { all: 0, awaiting_payment: 0, active: 0, rejected: 0, expired: 0 };
    (Array.isArray(optimistic) ? optimistic : []).forEach(item => {
      c.all++;
      if (c[item.status] !== undefined) c[item.status]++;
    });
    return c;
  }, [optimistic]);

  const handleApprove = async (id) => {
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
    if (!confirm('Сигурни ли сте, че искате да изтриете тази обява?')) return;
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

  return (
    <div className="p-8 min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Малки обяви</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление и потвърждаване на плащания</p>
        </div>
        <button type="button" onClick={handleRefresh} aria-label="Обнови обявите" className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-sm font-sans text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" /> Обнови
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map(tab => (
          <button key={tab.value} type="button" onClick={() => setStatusFilter(tab.value)} className={`px-3 py-1.5 text-xs font-sans font-bold rounded-full border transition-colors ${statusFilter === tab.value ? 'bg-zn-purple text-white border-zn-purple' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {tab.label} ({counts[tab.value] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="w-5 h-5 text-gray-400" /></div>
        <input type="text" className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-zn-purple/20 focus:border-zn-purple font-sans" placeholder="Търси по заглавие, описание, име или код за плащане..." value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {/* List */}
      <div className="space-y-4">
        {classifiedsReady && filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 font-sans border border-gray-200 border-dashed bg-gray-50">Няма намерени обяви.</div>
        ) : filtered.map(item => {
          const stCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.awaiting_payment;
          const isBusy = busyId === item.id;
          const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
          const mainImage = item.images?.[0] || null;
          const imageCount = item.images?.length || 0;

          return (
            <div key={item.id} className="bg-white border border-gray-200 p-5 shadow-sm" aria-busy={isBusy}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
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
                  <span className="font-mono font-bold text-green-700">${item.amountDue?.toLocaleString('bg-BG')}</span>
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
                <button type="button" onClick={() => handleDelete(item.id)} disabled={isBusy} className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors ml-auto">
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
