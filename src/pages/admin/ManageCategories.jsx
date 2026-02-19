import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';

const ICONS = ['📰', '🔫', '🏛️', '💰', '🏆', '👥', '🌑', '🚓', '🎥', '🚨', '⚖️', '💼', '📅', '🗳️', '🎮', '🏎️', '🎵', '🍔'];

export default function ManageCategories() {
  const { categories, addCategory, updateCategory, deleteCategory } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ id: '', name: '', icon: '📰' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleSave = async () => {
    if (!form.id || !form.name) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        await addCategory({ id: form.id.toLowerCase().replace(/\s+/g, '-'), name: form.name, icon: form.icon });
        toast.success('Категорията е добавена');
      } else {
        await updateCategory(editing, { name: form.name, icon: form.icon });
        toast.success('Категорията е актуализирана');
      }
      setEditing(null);
      setForm({ id: '', name: '', icon: '📰' });
    } catch (e) {
      setError(e?.message || 'Грешка при запис на категория');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (id === 'all') return;
    if (!confirm('Изтрий категорията?')) return;
    setError('');
    try {
      await deleteCategory(id);
      toast.success('Категорията е изтрита');
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
          <h1 className="text-2xl font-display font-bold text-gray-900">Категории</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление на категории за статиите</p>
        </div>
        <button onClick={() => { setError(''); setEditing('new'); setForm({ id: '', name: '', icon: '📰' }); }} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors">
          <Plus className="w-4 h-4" /> Нова категория
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
          <h3 className="font-sans font-semibold text-gray-900 mb-4">{editing === 'new' ? 'Нова категория' : 'Редакция'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Slug (ID)</label>
              <input className={inputCls} value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} placeholder="crime" disabled={editing !== 'new'} />
            </div>
            <div>
              <label className={labelCls}>Име</label>
              <input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Криминални" />
            </div>
            <div>
              <label className={labelCls}>Икона</label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map(i => (
                  <button key={i} onClick={() => setForm({ ...form, icon: i })} className={`w-8 h-8 text-lg flex items-center justify-center border transition-colors ${form.icon === i ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200 hover:border-gray-400'}`}>{i}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={() => { setEditing(null); setError(''); }} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Икона</th>
              <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Slug</th>
              <th className="text-left px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Име</th>
              <th className="text-right px-4 py-3 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Действия</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-lg">{cat.icon}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500">{cat.id}</td>
                <td className="px-4 py-3 text-sm font-sans font-medium text-gray-900">{cat.name}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setError(''); setEditing(cat.id); setForm(cat); }} className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
                    {cat.id !== 'all' && <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
