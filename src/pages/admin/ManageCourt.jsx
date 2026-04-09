import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePublicData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, CalendarClock, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readSearchParam } from '../../utils/adminSearchParams';

const SEVERITIES = [
  { value: 'heavy', label: 'Тежко', color: 'bg-red-600 text-white' },
  { value: 'medium', label: 'Средно', color: 'bg-amber-500 text-white' },
  { value: 'light', label: 'Леко', color: 'bg-zn-hot text-white' },
];

const STATUSES = [
  { value: 'completed', label: 'Приключено', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'scheduled', label: 'Насрочено', icon: CalendarClock, color: 'text-blue-600' },
  { value: 'ongoing', label: 'В ход', icon: Clock, color: 'text-amber-600' },
];

const emptyForm = { title: '', defendant: '', charge: '', verdict: '', judge: '', date: new Date().toISOString().slice(0, 10), details: '', severity: 'medium', status: 'scheduled', nextHearing: '' };

export default function ManageCourt() {
  const { court, addCourtCase, updateCourtCase, deleteCourtCase } = usePublicData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const query = readSearchParam(searchParams, 'q', '');

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') await addCourtCase(form);
      else await updateCourtCase(editing, form);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing === 'new' ? 'Делото е добавено' : 'Делото е обновено');
    } catch (e) {
      setError(e?.message || 'Грешка при запис');
      toast.error('Грешка при запис');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Изтриване на дело',
      message: 'Записът ще бъде изтрит безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;
    setError('');
    try {
      await deleteCourtCase(id);
      toast.success('Делото е изтрито');
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване');
      toast.error('Грешка при изтриване');
    }
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
  const labelCls = "block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1";
  const filteredCourt = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return court;
    return court.filter((item) => (
      (item.title || '').toLowerCase().includes(normalizedQuery) ||
      (item.defendant || '').toLowerCase().includes(normalizedQuery) ||
      (item.charge || '').toLowerCase().includes(normalizedQuery) ||
      (item.judge || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [court, query]);

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Съдебна хроника"
        description="Дела, присъди и насрочени заседания"
        actions={(
          <button onClick={() => { setEditing('new'); setForm(emptyForm); }} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
            <Plus className="w-4 h-4" /> Ново дело
          </button>
        )}
      />

      <AdminFilterBar className="mb-6">
        <AdminSearchField
          value={query}
          onChange={(event) => setListSearchParams({ q: event.target.value })}
          placeholder="Търси по дело, подсъдим, обвинение или съдия..."
          ariaLabel="Търси съдебни дела"
        />
      </AdminFilterBar>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {editing && (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className={labelCls}>Заглавие на делото</label><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className={labelCls}>Подсъдим</label><input className={inputCls} value={form.defendant} onChange={e => setForm({ ...form, defendant: e.target.value })} /></div>
            <div><label className={labelCls}>Обвинение</label><input className={inputCls} value={form.charge} onChange={e => setForm({ ...form, charge: e.target.value })} /></div>
            <div><label className={labelCls}>Статус</label>
              <select className={inputCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Съдия</label><input className={inputCls} value={form.judge} onChange={e => setForm({ ...form, judge: e.target.value })} /></div>
            {form.status === 'completed' ? (
              <div><label className={labelCls}>Присъда</label><input className={inputCls} value={form.verdict} onChange={e => setForm({ ...form, verdict: e.target.value })} /></div>
            ) : (
              <div><label className={labelCls}>Следващо заседание</label><input className={inputCls} type="date" value={form.nextHearing} onChange={e => setForm({ ...form, nextHearing: e.target.value })} /></div>
            )}
            <div><label className={labelCls}>Дата на завеждане</label><input className={inputCls} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className={labelCls}>Тежест</label>
              <select className={inputCls} value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2"><label className={labelCls}>Детайли</label><textarea className={inputCls + ' h-24 resize-none'} value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredCourt.map(item => {
          const st = STATUSES.find(s => s.value === item.status) || STATUSES[0];
          const StatusIcon = st.icon;
          return (
            <div key={item.id} className={`bg-white border border-gray-200 border-l-4 ${item.severity === 'heavy' ? 'border-l-red-600' : item.severity === 'medium' ? 'border-l-amber-500' : 'border-l-zn-hot'} p-4 flex items-center gap-4 group`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase ${SEVERITIES.find(s => s.value === item.severity)?.color}`}>{SEVERITIES.find(s => s.value === item.severity)?.label}</span>
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-gray-100 ${st.color}`}>
                    <StatusIcon className="w-3 h-3" /> {st.label}
                  </span>
                  <span className="text-xs font-sans text-gray-400">{item.date}</span>
                  {item.nextHearing && item.status !== 'completed' && (
                    <span className="text-xs font-sans text-blue-600">📅 {item.nextHearing}</span>
                  )}
                </div>
                <h3 className="text-sm font-sans font-semibold text-gray-900">{item.title}</h3>
                <p className="text-xs font-sans text-gray-500">{item.defendant} · {item.status === 'completed' ? item.verdict : 'Очаква се'}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditing(item.id); setForm(item); }} aria-label="Редактирай делото" className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(item.id)} aria-label="Изтрий делото" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {filteredCourt.length === 0 && (
          <AdminEmptyState
            title="Няма съдебни записи"
            description={query.trim()
              ? 'Няма дела, които да съвпадат с текущото търсене.'
              : 'Все още няма добавени дела в съдебната хроника.'}
          />
        )}
      </div>
    </div>
  );
}
