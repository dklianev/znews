import { useState, useCallback, useEffect } from 'react';
import { usePublicData } from '../../context/DataContext';
import { Plus, Trash2, X, Save, AlertTriangle, Newspaper, FileText, Check, Loader2 } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { api } from '../../utils/api';

const SUGGEST_LIMIT = 7;

function toTickerItems(items) {
  return Array.isArray(items)
    ? items
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    : [];
}

function normalizeArticleSuggestions(payload) {
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
  const seenTitles = new Set();

  return rawItems
    .filter((article) => article?.title)
    .map((article) => ({
      id: article.id,
      title: String(article.title).trim(),
      breaking: Boolean(article.breaking),
    }))
    .filter((article) => {
      if (!article.title || seenTitles.has(article.title)) return false;
      seenTitles.add(article.title);
      return true;
    });
}

export default function ManageBreaking() {
  const { breaking, saveBreaking } = usePublicData();
  const [items, setItems] = useState(() => toTickerItems(breaking));
  const [newItem, setNewItem] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!hasChanges) {
      setItems(toTickerItems(breaking));
    }
  }, [breaking, hasChanges]);

  const addItem = () => {
    const nextItem = newItem.trim();
    if (!nextItem) return;
    setItems((prev) => [...prev, nextItem]);
    setNewItem('');
    setHasChanges(true);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateItem = (index, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
    setHasChanges(true);
  };

  const moveItem = (index, direction) => {
    setItems((prev) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const nextItems = toTickerItems(items);
      await saveBreaking(nextItems);
      setItems(nextItems);
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
    setItems(toTickerItems(breaking));
    setHasChanges(false);
  };

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const articles = await api.articles.getAll({
        fields: 'id,title,breaking',
        limit: SUGGEST_LIMIT,
        page: 1,
      });
      const list = normalizeArticleSuggestions(articles);
      setSuggestions(list);
      setSelected(new Set());
    } catch {
      toast.error('Грешка при зареждане на статиите');
    } finally {
      setLoadingSuggestions(false);
    }
  }, [toast]);

  const toggleSuggestion = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    if (!suggestions || selected.size === 0) return;
    const titlesToAdd = suggestions
      .filter((s) => selected.has(s.id))
      .map((s) => s.title)
      .filter((title) => !items.includes(title));
    if (titlesToAdd.length === 0) {
      toast.info('Избраните заглавия вече са в тикера');
      return;
    }
    setItems((prev) => [...prev, ...titlesToAdd]);
    setHasChanges(true);
    setSuggestions(null);
    setSelected(new Set());
    toast.success(`${titlesToAdd.length} заглавия добавени`);
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
      <div className="flex gap-2 mb-4">
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

      {/* Suggest from articles */}
      <div className="mb-6">
        {suggestions === null ? (
          <button
            onClick={loadSuggestions}
            disabled={loadingSuggestions}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loadingSuggestions
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileText className="w-4 h-4" />}
            Зареди от последните статии
          </button>
        ) : (
          <div className="border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
              <span className="text-xs font-sans font-semibold text-gray-600 uppercase tracking-wider">
                Последни {suggestions.length} статии — избери и добави
              </span>
              <button
                onClick={() => { setSuggestions(null); setSelected(new Set()); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Затвори предложенията"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {suggestions.map((s) => {
                const isSelected = selected.has(s.id);
                const alreadyInTicker = items.includes(s.title);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => !alreadyInTicker && toggleSuggestion(s.id)}
                    disabled={alreadyInTicker}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-sans transition-colors ${
                      alreadyInTicker
                        ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                        : isSelected
                          ? 'bg-zn-purple/10 text-gray-900'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                      alreadyInTicker
                        ? 'border-gray-300 bg-gray-200'
                        : isSelected
                          ? 'border-zn-purple bg-zn-purple'
                          : 'border-gray-300 bg-white'
                    }`}>
                      {(isSelected || alreadyInTicker) && <Check className={`w-3 h-3 ${alreadyInTicker ? 'text-gray-400' : 'text-white'}`} />}
                    </div>
                    <span className="flex-1 truncate">{s.title}</span>
                    {s.breaking && (
                      <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                        Извънредно
                      </span>
                    )}
                    {alreadyInTicker && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Вече в тикера
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selected.size > 0 && (
              <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-200 bg-white">
                <span className="text-xs font-sans text-gray-500">{selected.size} избрани</span>
                <button
                  onClick={addSelected}
                  className="flex items-center gap-2 px-4 py-1.5 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors"
                >
                  <Plus className="w-4 h-4" /> Добави избраните
                </button>
              </div>
            )}
          </div>
        )}
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
