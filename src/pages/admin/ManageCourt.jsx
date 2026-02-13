import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, CalendarClock, CheckCircle2, Clock } from 'lucide-react';

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
  const { court, addCourtCase, updateCourtCase, deleteCourtCase } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const handleSave = async () => {
    if (!form.title) return;
    if (editing === 'new') await addCourtCase(form);
    else await updateCourtCase(editing, form);
    setEditing(null); setForm(emptyForm);
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
  const labelCls = "block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Съдебна хроника</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Дела, присъди и насрочени заседания</p>
        </div>
        <button onClick={() => { setEditing('new'); setForm(emptyForm); }} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
          <Plus className="w-4 h-4" /> Ново дело
        </button>
      </div>

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
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {court.map(item => {
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
                <button onClick={() => { setEditing(item.id); setForm(item); }} className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => { if (confirm('Изтрий?')) deleteCourtCase(item.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
