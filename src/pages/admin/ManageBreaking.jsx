import { useState } from 'react';
import { usePublicData } from '../../context/DataContext';
import { Plus, Trash2, X, Save, AlertTriangle, Newspaper } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminEmptyState from '../../components/admin/AdminEmptyState';

export default function ManageBreaking() {
  const { breaking, saveBreaking } = usePublicData();
  const [items, setItems] = useState(breaking);
  const [newItem, setNewItem] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems([...items, newItem.trim()]);
    setNewItem('');
    setHasChanges(true);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateItem = (index, value) => {
    const updated = [...items];
    updated[index] = value;
    setItems(updated);
    setHasChanges(true);
  };

  const moveItem = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const updated = [...items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setItems(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await saveBreaking(items.filter(Boolean));
      setHasChanges(false);
      toast.success('Тикерът е запазен');
    } catch (e) {
      setError(e?.message || 'Грешка при запис на тикера');
      toast.error('Грешка при запис');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setError('');
    setItems(breaking);
    setHasChanges(false);
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
  const previewItems = items.filter(Boolean);

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Тикер / Извънредни новини"
        description="Управление на бягащия ред с новини"
        icon={Newspaper}
        actions={hasChanges ? (
          <>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors">
              <X className="w-4 h-4" /> Откажи
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" /> Запази промените
            </button>
          </>
        ) : null}
      />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Live preview */}
      <div className="mb-6 border border-gray-200 overflow-hidden">
        <div className="bg-zn-purple text-white px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-wider">
          Преглед на тикера
        </div>
        <div className="breaking-strip border-y border-black/20 comic-dots-red">
          <div className="px-3 py-1">
            <div className="ticker-wrap py-2">
              <div className="ticker-content text-white text-xs font-display font-bold uppercase tracking-wider">
                {previewItems.length > 0 ? (
                  <>
                    <span>{previewItems.join('  ★  ')}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
                    <span>{previewItems.join('  ★  ')}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
                  </>
                ) : (
                  <span>Добави поне една новина за preview</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input
          className={inputCls + ' flex-1'}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Нова извънредна новина..."
        />
        <button
          onClick={addItem}
          className="flex items-center gap-2 px-4 py-2 bg-zn-hot text-white text-sm font-sans font-semibold hover:bg-zn-hot transition-colors"
        >
          <Plus className="w-4 h-4" /> Добави
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 bg-white border border-gray-200 group">
            <div className="flex flex-col border-r border-gray-200">
              <button
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                aria-label="Премести новината нагоре"
                className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs"
              >
                ▲
              </button>
              <button
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Премести новината надолу"
                className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs"
              >
                ▼
              </button>
            </div>
            <span className="text-xs font-sans text-gray-400 font-mono w-6 text-center">{index + 1}</span>
            <input
              className="flex-1 px-2 py-2.5 text-sm font-sans text-gray-900 outline-none bg-transparent"
              value={item}
              aria-label={`Редактирай новина ${index + 1}`}
              onChange={e => updateItem(index, e.target.value)}
            />
            <button
              onClick={() => removeItem(index)}
              aria-label="Премахни новината"
              className="p-2 text-gray-400 hover:text-red-600 transition-colors mr-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <AdminEmptyState
            title="Няма извънредни новини"
            description="Добави поне една новина, за да се покаже в тикера на сайта."
          />
        )}
      </div>

      <p className="mt-4 text-xs font-sans text-gray-400">
        Общо: {items.length} новини в тикера. Новините се показват като бягащ текст в горната част на сайта.
      </p>
    </div>
  );
}
