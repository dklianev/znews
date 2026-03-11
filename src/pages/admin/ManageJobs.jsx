import { useState } from 'react';
import { usePublicData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';

const JOB_TYPES = [
  { value: 'police', label: 'Полиция' },
  { value: 'ems', label: 'EMS' },
  { value: 'mechanic', label: 'Механик' },
  { value: 'lawyer', label: 'Адвокат' },
  { value: 'driver', label: 'Шофьор' },
  { value: 'government', label: 'Държавна' },
  { value: 'other', label: 'Друго' },
];

const emptyForm = { title: '', org: '', type: 'other', description: '', requirements: '', salary: '', contact: '', date: new Date().toISOString().slice(0, 10), active: true };

export default function ManageJobs() {
  const { jobs, addJob, updateJob, deleteJob } = usePublicData();
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
      if (editing === 'new') await addJob(form);
      else await updateJob(editing, form);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing === 'new' ? 'Обявата е добавена' : 'Обявата е обновена');
    } catch (e) {
      setError(e?.message || 'Грешка при запис на обявата');
      toast.error('Грешка при запис');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (job) => {
    setError('');
    try {
      await updateJob(job.id, { active: !job.active });
      toast.success(job.active ? 'Обявата е деактивирана' : 'Обявата е активирана');
    } catch (e) {
      setError(e?.message || 'Грешка при промяна на статуса');
      toast.error('Грешка при промяна');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Изтрий?')) return;
    setError('');
    try {
      await deleteJob(id);
      toast.success('Обявата е изтрита');
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
          <h1 className="text-2xl font-display font-bold text-gray-900">Обяви за работа</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">RP позиции и обяви за наемане</p>
        </div>
        <button onClick={() => { setEditing('new'); setForm(emptyForm); }} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
          <Plus className="w-4 h-4" /> Нова обява
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
            <div><label className={labelCls}>Заглавие</label><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className={labelCls}>Организация</label><input className={inputCls} value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} /></div>
            <div><label className={labelCls}>Тип</label>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Заплата</label><input className={inputCls} value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Описание</label><textarea className={inputCls + ' h-20 resize-none'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><label className={labelCls}>Изисквания</label><input className={inputCls} value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} /></div>
            <div><label className={labelCls}>Контакт / Адрес</label><input className={inputCls} value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
            <div><label className={labelCls}>Дата</label><input className={inputCls} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {jobs.map(job => (
          <div key={job.id} className="bg-white border border-gray-200 p-4 flex items-center gap-4 group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-gray-100 text-gray-600">{JOB_TYPES.find(t => t.value === job.type)?.label}</span>
                {!job.active && <span className="text-[9px] font-sans text-red-500 font-bold">НЕАКТИВНА</span>}
              </div>
              <h3 className="text-sm font-sans font-semibold text-gray-900">{job.title}</h3>
              <p className="text-xs font-sans text-gray-500">{job.org} · {job.salary}</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleActive(job)} className="p-1.5 text-gray-400 hover:text-zn-hot" title={job.active ? 'Деактивирай' : 'Активирай'}>
                {job.active ? <ToggleRight className="w-5 h-5 text-zn-hot" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => { setEditing(job.id); setForm(job); }} className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(job.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-12 text-sm font-sans text-gray-400">
            Няма обяви за работа.
          </div>
        )}
      </div>
    </div>
  );
}
