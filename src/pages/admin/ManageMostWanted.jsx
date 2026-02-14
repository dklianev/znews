import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react';

const DANGERS = [
  { value: 'high', label: 'Висока опасност', color: 'bg-red-600 text-white' },
  { value: 'medium', label: 'Средна опасност', color: 'bg-amber-500 text-white' },
  { value: 'low', label: 'Ниска опасност', color: 'bg-gray-400 text-white' },
];

const emptyForm = { name: '', bounty: '', charge: '', danger: 'high' };

export default function ManageMostWanted() {
  const { wanted, addWanted, updateWanted, deleteWanted } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') await addWanted(form);
      else await updateWanted(editing, form);
      setEditing(null);
      setForm(emptyForm);
    } catch (e) {
      setError(e?.message || 'Грешка при запис');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Изтрий?')) return;
    setError('');
    try {
      await deleteWanted(id);
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване');
    }
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
  const labelCls = "block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Най-издирвани</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление на списъка с издирвани лица</p>
        </div>
        <button onClick={() => { setEditing('new'); setForm(emptyForm); }} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
          <Plus className="w-4 h-4" /> Добави лице
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
            <div><label className={labelCls}>Име / Прякор</label><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='Иван "Ковача" Петков' /></div>
            <div><label className={labelCls}>Обвинение</label><input className={inputCls} value={form.charge} onChange={e => setForm({ ...form, charge: e.target.value })} placeholder="Въоръжен грабеж" /></div>
            <div><label className={labelCls}>Награда</label><input className={inputCls} value={form.bounty} onChange={e => setForm({ ...form, bounty: e.target.value })} placeholder="$50,000" /></div>
            <div>
              <label className={labelCls}>Степен на опасност</label>
              <select className={inputCls} value={form.danger} onChange={e => setForm({ ...form, danger: e.target.value })}>
                {DANGERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {wanted.map((person, index) => (
          <div key={person.id} className="bg-white border border-gray-200 p-4 flex items-center gap-4 group">
            <span className="text-lg font-display font-bold text-gray-300 w-6 text-center">{index + 1}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-sans font-semibold text-gray-900">{person.name}</h3>
              <p className="text-xs font-sans text-gray-500">{person.charge}</p>
            </div>
            <span className="text-sm font-sans font-bold text-zn-hot">{person.bounty}</span>
            <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase ${DANGERS.find(d => d.value === person.danger)?.color || 'bg-gray-200'}`}>
              {DANGERS.find(d => d.value === person.danger)?.label || person.danger}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditing(person.id); setForm(person); }} className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(person.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {wanted.length === 0 && (
          <div className="text-center py-12 text-sm font-sans text-gray-400">
            Няма записи.
          </div>
        )}
      </div>
    </div>
  );
}
