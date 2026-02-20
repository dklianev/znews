import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Image, Plus, Trash2, Edit3, Star, StarOff, X, AlertTriangle } from 'lucide-react';
import AdminImageField from '../../components/admin/AdminImageField';
import { useToast } from '../../components/admin/Toast';

const emptyItem = { title: '', description: '', image: '', category: '', featured: false };

function parseGalleryDate(value) {
  if (typeof value !== 'string') return 0;
  const raw = value.trim();
  if (!raw) return 0;

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return parsed;

  // Legacy format: "14.02.2026 г." from toLocaleDateString('bg-BG')
  const match = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, Math.max(0, month - 1), day);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default function ManageGallery() {
  const { gallery, addGalleryItem, updateGalleryItem, deleteGalleryItem } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const categories = [...new Set(gallery.map(g => g.category))];

  const openNew = () => { setError(''); setForm(emptyItem); setEditing('new'); };
  const openEdit = (item) => { setError(''); setForm({ title: item.title, description: item.description, image: item.image, category: item.category, featured: item.featured }); setEditing(item.id); };
  const close = () => { setError(''); setForm(emptyItem); setEditing(null); };

  const handleSave = async () => {
    if (!form.title || !form.image || !form.category) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        await addGalleryItem({ ...form, date: new Date().toISOString().slice(0, 10) });
      } else {
        await updateGalleryItem(editing, form);
      }
      close();
      toast.success(editing === 'new' ? 'Снимката е добавена' : 'Снимката е обновена');
    } catch (e) {
      setError(e?.message || 'Грешка при запис');
      toast.error('Грешка при запис');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Изтрий снимката?')) return;
    setError('');
    try {
      await deleteGalleryItem(id);
      toast.success('Снимката е изтрита');
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване');
      toast.error('Грешка при изтриване');
    }
  };

  const toggleFeatured = async (item) => {
    setError('');
    try {
      await updateGalleryItem(item.id, { featured: !item.featured });
      toast.success(item.featured ? 'Премахната от избрани' : 'Маркирана като избрана');
    } catch (e) {
      setError(e?.message || 'Грешка при запис');
      toast.error('Грешка при промяна');
    }
  };

  const sorted = [...gallery].sort((a, b) => parseGalleryDate(b.date) - parseGalleryDate(a.date));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Галерия</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">{gallery.length} снимки</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans hover:bg-zn-hot/90 transition-colors">
          <Plus className="w-4 h-4" /> Добави снимка
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Modal */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={close}>
          <div className="bg-white max-w-lg w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg text-gray-900">{editing === 'new' ? 'Нова снимка' : 'Редактирай'}</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-sans font-semibold text-gray-600 mb-1">Заглавие *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:ring-1 focus:ring-zn-purple outline-none" />
              </div>
              <div>
                <label className="block text-xs font-sans font-semibold text-gray-600 mb-1">Описание</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:ring-1 focus:ring-zn-purple outline-none" />
              </div>
              <div>
                <AdminImageField
                  label="Изображение"
                  required
                  value={form.image}
                  onChange={(nextValue) => setForm({ ...form, image: nextValue })}
                  helperText="Използвай Media Library или ръчно URL поле."
                  previewClassName="h-36"
                />
              </div>
              <div>
                <label className="block text-xs font-sans font-semibold text-gray-600 mb-1">Категория *</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} list="gallery-categories" className="w-full border border-gray-200 px-3 py-2 text-sm font-sans focus:ring-1 focus:ring-zn-purple outline-none" />
                <datalist id="gallery-categories">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} className="accent-zn-purple" />
                <span className="text-sm font-sans text-gray-700">Избрана (Featured)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={close} className="px-4 py-2 text-sm font-sans text-gray-500 hover:text-gray-700">Откажи</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-zn-hot text-white text-sm font-sans hover:bg-zn-hot/90 transition-colors disabled:opacity-50">Запази</button>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sorted.map(item => (
          <div key={item.id} className="group relative border border-gray-200 bg-white overflow-hidden">
            <img src={item.image} alt={item.title} className="w-full h-36 object-cover" onError={e => { e.target.src = 'https://placehold.co/400x300/f3f4f6/9ca3af?text=No+Image'; }} />
            <div className="p-2.5">
              <h3 className="text-sm font-sans font-semibold text-gray-900 line-clamp-1">{item.title}</h3>
              <div className="flex items-center gap-2 text-[10px] font-sans text-gray-400 mt-0.5">
                <span>{item.category}</span>
                <span>•</span>
                <span>{item.date}</span>
              </div>
            </div>
            {item.featured && (
              <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[8px] font-sans font-bold uppercase bg-amber-500 text-white">Featured</span>
            )}
            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleFeatured(item)} className="p-1 bg-white/90 text-gray-500 hover:text-amber-500" title={item.featured ? 'Премахни от избрани' : 'Маркирай като избрана'}>
                {item.featured ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => openEdit(item)} className="p-1 bg-white/90 text-gray-500 hover:text-zn-hot" title="Редактирай">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(item.id)} className="p-1 bg-white/90 text-gray-500 hover:text-red-500" title="Изтрий">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {gallery.length === 0 && (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-sans text-gray-400">Няма снимки. Добавете първата!</p>
        </div>
      )}
    </div>
  );
}
