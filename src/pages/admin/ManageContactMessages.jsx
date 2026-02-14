import { useEffect, useMemo, useState } from 'react';
import { Mail, AlertTriangle, Trash2, CheckCircle2, Archive, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useData } from '../../context/DataContext';

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

export default function ManageContactMessages() {
  const { session, hasPermission } = useData();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | new | read | archived
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((m) => m?.status === filter);
  }, [filter, items]);

  const counts = useMemo(() => ({
    all: items.length,
    new: items.filter((m) => m?.status === 'new').length,
    read: items.filter((m) => m?.status === 'read').length,
    archived: items.filter((m) => m?.status === 'archived').length,
  }), [items]);

  const setStatus = async (id, status) => {
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isInteger(numericId)) return;
    setBusyId(numericId);
    setError('');
    try {
      const updated = await api.contactMessages.update(numericId, { status });
      setItems((prev) => prev.map((m) => m.id === numericId ? updated : m));
    } catch (e) {
      setError(e?.message || 'Грешка при запис');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    const numericId = Number.parseInt(String(id), 10);
    if (!Number.isInteger(numericId)) return;
    if (!confirm('Изтрий съобщението?')) return;
    setBusyId(numericId);
    setError('');
    try {
      await api.contactMessages.delete(numericId);
      setItems((prev) => prev.filter((m) => m.id !== numericId));
      if (expandedId === numericId) setExpandedId(null);
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване');
    } finally {
      setBusyId(null);
    }
  };

  const filterBtn = (value, label) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${
        filter === value ? 'bg-zn-hot text-white border-zn-hot' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
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
          <p className="font-sans text-red-700 font-semibold">Нямате достъп до тази страница</p>
          <p className="font-sans text-red-500 text-sm mt-1">Нужни са права за: contact</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-zn-purple" />
            Запитвания
          </h1>
          <p className="text-sm font-sans text-gray-500 mt-1">
            {counts.all} съобщения • {counts.new} нови
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Обнови
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {filterBtn('all', `Всички (${counts.all})`)}
        {filterBtn('new', `Нови (${counts.new})`)}
        {filterBtn('read', `Прочетени (${counts.read})`)}
        {filterBtn('archived', `Архив (${counts.archived})`)}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Зареждане...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Няма съобщения</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg) => {
            const createdLabel = msg?.createdAt ? new Date(msg.createdAt).toLocaleString('bg-BG') : '';
            const status = msg?.status || 'new';
            const isExpanded = expandedId === msg.id;
            return (
              <div key={msg.id} className="bg-white border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                    className="text-left flex-1 min-w-0"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border ${STATUS_STYLES[status] || STATUS_STYLES.new}`}>
                        {STATUS_LABELS[status] || status}
                      </span>
                      <span className="text-sm font-sans font-semibold text-gray-900 truncate">{msg.name || '—'}</span>
                      <span className="text-xs font-sans text-gray-400 truncate">{msg.email || ''}</span>
                      <span className="text-xs font-sans text-gray-400">{createdLabel}</span>
                    </div>
                    {!isExpanded && (
                      <p className="mt-2 text-sm font-sans text-gray-700 line-clamp-2 whitespace-pre-wrap">
                        {msg.message || ''}
                      </p>
                    )}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {status !== 'read' && (
                      <button
                        type="button"
                        onClick={() => setStatus(msg.id, 'read')}
                        disabled={busyId === msg.id}
                        className="p-2 text-gray-400 hover:text-emerald-700 disabled:opacity-50"
                        title="Маркирай като прочетено"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => setStatus(msg.id, 'archived')}
                        disabled={busyId === msg.id}
                        className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-50"
                        title="Архивирай"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      disabled={busyId === msg.id}
                      className="p-2 text-gray-400 hover:text-red-700 disabled:opacity-50"
                      title="Изтрий"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-sm font-sans text-gray-700 whitespace-pre-wrap">
                      {msg.message || ''}
                    </p>
                    <div className="mt-3 text-xs font-sans text-gray-400">
                      ID: {msg.id}
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
