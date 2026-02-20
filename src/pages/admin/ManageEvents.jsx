import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';

const EVENT_TYPES = [
  { value: 'race', label: 'Рали / Състезание' },
  { value: 'party', label: 'Парти / Бал' },
  { value: 'tournament', label: 'Турнир' },
  { value: 'meeting', label: 'Събрание' },
  { value: 'concert', label: 'Концерт' },
  { value: 'other', label: 'Друго' },
];

const EVENT_ICONS = ['🏎️', '🎭', '🥊', '🏛️', '🎵', '📅', '🎮', '🏆', '🎪', '🍺'];

const emptyForm = { title: '', description: '', date: new Date().toISOString().slice(0, 10), time: '', location: '', organizer: '', type: 'other', image: '📅' };

export default function ManageEvents() {
  const { events, addEvent, updateEvent, deleteEvent } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') await addEvent(form);
      else await updateEvent(editing, form);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing === 'new' ? 'Събитието е добавено' : 'Събитието е обновено');
    } catch (e) {
      setError(e?.message || 'Грешка при запис');
      toast.error('Грешка при запис');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Изтрий?')) return;
    setError('');
    try {
      await deleteEvent(id);
      toast.success('Събитието е изтрито');
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване');
      toast.error('Грешка при изтриване');
    }
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
  const labelCls = "block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Събития</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление на събития и календар</p>
        </div>
        <button onClick={() => { setEditing('new'); setForm(emptyForm); }} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
          <Plus className="w-4 h-4" /> Ново събитие
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {editing && (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className={labelCls}>Заглавие</label><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Описание</label><textarea className={inputCls + ' h-20 resize-none'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><label className={labelCls}>Дата</label><input className={inputCls} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className={labelCls}>Час</label><input className={inputCls} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="20:00" /></div>
            <div><label className={labelCls}>Локация</label><input className={inputCls} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className={labelCls}>Организатор</label><input className={inputCls} value={form.organizer} onChange={e => setForm({ ...form, organizer: e.target.value })} /></div>
            <div><label className={labelCls}>Тип</label>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Икона</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_ICONS.map(i => (
                  <button key={i} onClick={() => setForm({ ...form, image: i })} className={`w-8 h-8 text-lg flex items-center justify-center border transition-colors ${form.image === i ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200'}`}>{i}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.id} className="bg-white border border-gray-200 p-4 flex items-center gap-4 group">
            <span className="text-2xl">{ev.image || '📅'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-zn-bg text-white">{EVENT_TYPES.find(t => t.value === ev.type)?.label}</span>
                <span className="text-xs font-sans text-gray-400">{ev.date} {ev.time}</span>
              </div>
              <h3 className="text-sm font-sans font-semibold text-gray-900">{ev.title}</h3>
              <p className="text-xs font-sans text-gray-500">{ev.location} · {ev.organizer}</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditing(ev.id); setForm(ev); }} className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(ev.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-center py-12 text-sm font-sans text-gray-400">
            Няма записи.
          </div>
        )}
      </div>
    </div>
  );
}
