import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, ExternalLink, ImageIcon, AlertTriangle } from 'lucide-react';
import AdminImageField from '../../components/admin/AdminImageField';

const AD_TYPES = [
  { value: 'horizontal', label: 'Хоризонтален банер' },
  { value: 'side', label: 'Страничен банер' },
  { value: 'inline', label: 'В текста' },
];

const AD_ICONS = ['🏪', '🎰', '🏎️', '💰', '🍔', '🏠', '🔧', '💊', '🎮', '📱', '🛡️', '⚖️', '🎵', '🍺', '✈️', '🏦'];

const emptyForm = {
  title: '',
  subtitle: '',
  cta: 'Научи повече',
  type: 'horizontal',
  icon: '🏪',
  link: '#',
  color: '#990F3D',
  image: '',
};

export default function ManageAds() {
  const { ads, addAd, updateAd, deleteAd } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        await addAd(form);
      } else {
        await updateAd(editing, form);
      }
      setEditing(null);
      setForm(emptyForm);
    } catch (e) {
      setError(e?.message || 'Грешка при запис');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Изтрий рекламата?')) return;
    setError('');
    try {
      await deleteAd(id);
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
          <h1 className="text-2xl font-display font-bold text-gray-900">Реклами</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление на рекламни банери</p>
        </div>
        <button
          onClick={() => { setError(''); setEditing('new'); setForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Нова реклама
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <h3 className="font-sans font-semibold text-gray-900 mb-4">
            {editing === 'new' ? 'Нова реклама' : 'Редактирай реклама'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Заглавие</label>
              <input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Име на бизнеса" />
            </div>
            <div>
              <label className={labelCls}>Подзаглавие</label>
              <input className={inputCls} value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Кратко описание" />
            </div>
            <div>
              <label className={labelCls}>CTA бутон текст</label>
              <input className={inputCls} value={form.cta} onChange={e => setForm({ ...form, cta: e.target.value })} placeholder="Научи повече" />
            </div>
            <div>
              <label className={labelCls}>Тип</label>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {AD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Линк (URL)</label>
              <input className={inputCls} value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <label className={labelCls}>Цвят</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-10 border border-gray-200 cursor-pointer" />
                <input className={inputCls + ' flex-1'} value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>

            <div className="md:col-span-2">
              <AdminImageField
                label="Снимка на банера"
                value={form.image}
                onChange={(nextValue) => setForm(prev => ({ ...prev, image: nextValue }))}
                helperText="Качи изображение или избери налично от Media Library."
                previewClassName="h-36"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Икона</label>
              <div className="flex flex-wrap gap-1.5">
                {AD_ICONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setForm({ ...form, icon })}
                    className={`w-10 h-10 text-xl flex items-center justify-center border transition-colors ${form.icon === icon ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200 hover:border-gray-400'
                      }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-5 p-4 rounded border border-dashed border-gray-300 bg-gray-50">
            <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 mb-2">Преглед</p>
            <div
              className="p-4 text-white flex items-center justify-between relative overflow-hidden"
              style={{ backgroundColor: form.color || '#990F3D' }}
            >
              {form.image && (
                <img
                  src={form.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="flex items-center gap-3 relative z-10">
                <span className="text-2xl">{form.icon}</span>
                <div>
                  <p className="font-sans font-bold text-sm">{form.title || 'Заглавие'}</p>
                  <p className="text-xs opacity-80">{form.subtitle || 'Подзаглавие'}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-white/20 text-xs font-sans font-semibold relative z-10">{form.cta}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" /> Запази
            </button>
            <button onClick={() => { setEditing(null); setError(''); }} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4" /> Откажи
            </button>
          </div>
        </div>
      )}

      {/* Ads grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ads.map(ad => (
          <div key={ad.id} className="bg-white border border-gray-200 overflow-hidden group">
            {/* Ad preview */}
            <div className="p-4 text-white relative overflow-hidden" style={{ backgroundColor: ad.color || '#990F3D' }}>
              {ad.image && (
                <img
                  src={ad.image}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <span className="text-xl">{ad.icon}</span>
                <div>
                  <p className="font-sans font-bold text-sm">{ad.title}</p>
                  <p className="text-xs opacity-80">{ad.subtitle}</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-white/20 text-xs font-sans font-semibold relative z-10">{ad.cta}</span>
            </div>
            {/* Info + actions */}
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                  {AD_TYPES.find(t => t.value === ad.type)?.label || ad.type}
                </span>
                {ad.image && (
                  <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider bg-green-100 text-green-700">
                    <ImageIcon className="w-3 h-3 inline mr-0.5" />Снимка
                  </span>
                )}
                {ad.link && ad.link !== '#' && (
                  <a href={ad.link} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-zn-hot">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setError(''); setEditing(ad.id); setForm(ad); }}
                  className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(ad.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {ads.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm font-sans text-gray-400">Няма реклами</div>
        )}
      </div>
    </div>
  );
}
