import { useRef, useState } from 'react';
import { usePublicData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';

const ICONS = ['📰', '🚨', '🏛️', '💰', '🎭', '🏎️', '🎯', '⚖️', '🏥', '🔥', '🌆', '🎤', '🎬', '🕵️', '📡', '🌃', '📸', '🧨'];
const EMPTY_FIELD_ERRORS = Object.freeze({ id: '', name: '' });

function normalizeFieldErrors(payload) {
  const source = payload?.fieldErrors && typeof payload.fieldErrors === 'object'
    ? payload.fieldErrors
    : null;

  if (!source) return EMPTY_FIELD_ERRORS;
  return {
    id: typeof source.id === 'string' ? source.id : '',
    name: typeof source.name === 'string' ? source.name : '',
  };
}

function validateCategoryForm(form, editing) {
  const nextErrors = { ...EMPTY_FIELD_ERRORS };
  const normalizedId = String(form.id || '').trim().toLowerCase();
  const normalizedName = String(form.name || '').trim();

  if (editing === 'new') {
    if (!normalizedId) {
      nextErrors.id = 'Slug е задължителен.';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedId)) {
      nextErrors.id = 'Slug-ът може да съдържа само малки латински букви, цифри и тирета.';
    }
  }

  if (!normalizedName) {
    nextErrors.name = 'Името е задължително.';
  }

  return nextErrors;
}

function getFirstErrorField(fieldErrors) {
  if (fieldErrors.id) return 'id';
  if (fieldErrors.name) return 'name';
  return '';
}

export default function ManageCategories() {
  const { categories, addCategory, updateCategory, deleteCategory } = usePublicData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ id: '', name: '', icon: '📰' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);
  const slugInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const toast = useToast();

  const focusField = (field) => {
    if (field === 'id') slugInputRef.current?.focus();
    if (field === 'name') nameInputRef.current?.focus();
  };

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: '' };
    });
  };

  const resetEditor = () => {
    setEditing(null);
    setForm({ id: '', name: '', icon: '📰' });
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setError('');
  };

  const openCreate = () => {
    setEditing('new');
    setForm({ id: '', name: '', icon: '📰' });
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setError('');
  };

  const openEdit = (category) => {
    setEditing(category.id);
    setForm({ id: category.id, name: category.name, icon: category.icon || '📰' });
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setError('');
  };

  const handleSave = async () => {
    const nextFieldErrors = validateCategoryForm(form, editing);
    const firstField = getFirstErrorField(nextFieldErrors);

    if (firstField) {
      setFieldErrors(nextFieldErrors);
      setError('Поправи маркираните полета преди запис.');
      focusField(firstField);
      return;
    }

    setSaving(true);
    setError('');
    setFieldErrors(EMPTY_FIELD_ERRORS);

    try {
      if (editing === 'new') {
        await addCategory({
          id: form.id.trim().toLowerCase().replace(/\s+/g, '-'),
          name: form.name.trim(),
          icon: form.icon,
        });
        toast.success('Категорията е добавена');
      } else {
        await updateCategory(editing, {
          name: form.name.trim(),
          icon: form.icon,
        });
        toast.success('Категорията е обновена');
      }
      resetEditor();
    } catch (e) {
      const payloadFieldErrors = normalizeFieldErrors(e?.payload);
      const fallbackMessage = e?.message || 'Грешка при запис на категорията';
      const nextMessage = payloadFieldErrors.id || payloadFieldErrors.name || fallbackMessage;
      setFieldErrors(payloadFieldErrors);
      setError(nextMessage);
      focusField(getFirstErrorField(payloadFieldErrors));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (id === 'all') return;
    if (!confirm('Сигурен ли си?')) return;
    setError('');
    try {
      await deleteCategory(id);
      toast.success('Категорията е изтрита');
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване');
    }
  };

  const validationEntries = Object.entries(fieldErrors).filter(([, message]) => Boolean(message));
  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';
  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Категории</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление на категориите на новините</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors">
          <Plus className="w-4 h-4" /> Нова категория
        </button>
      </div>

      {(error || validationEntries.length > 0) && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            {error ? <p className="break-words">{error}</p> : null}
            {validationEntries.length > 0 ? (
              <ul className="list-disc pl-4">
                {validationEntries.map(([field, message]) => (
                  <li key={field}>
                    <button type="button" className="text-left underline decoration-dotted underline-offset-2" onClick={() => focusField(field)}>
                      {message}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}

      {editing ? (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <h3 className="font-sans font-semibold text-gray-900 mb-4">{editing === 'new' ? 'Нова категория' : 'Редакция'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Slug (ID)</label>
              <input
                ref={slugInputRef}
                className={`${inputCls} ${fieldErrors.id ? '!border-red-400 bg-red-50/30' : ''}`}
                value={form.id}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, id: e.target.value }));
                  clearFieldError('id');
                  if (error) setError('');
                }}
                placeholder="crime"
                disabled={editing !== 'new'}
                aria-invalid={fieldErrors.id ? 'true' : 'false'}
                aria-describedby={fieldErrors.id ? 'category-id-error' : undefined}
              />
              {fieldErrors.id ? <p id="category-id-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.id}</p> : null}
            </div>
            <div>
              <label className={labelCls}>Име</label>
              <input
                ref={nameInputRef}
                className={`${inputCls} ${fieldErrors.name ? '!border-red-400 bg-red-50/30' : ''}`}
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  clearFieldError('name');
                  if (error) setError('');
                }}
                placeholder="Криминале"
                aria-invalid={fieldErrors.name ? 'true' : 'false'}
                aria-describedby={fieldErrors.name ? 'category-name-error' : undefined}
              />
              {fieldErrors.name ? <p id="category-name-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.name}</p> : null}
            </div>
            <div>
              <label className={labelCls}>Икона</label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, icon }))}
                    className={`w-8 h-8 text-lg flex items-center justify-center border transition-colors ${form.icon === icon ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50">
              <Save className="w-4 h-4" /> Запази
            </button>
            <button onClick={resetEditor} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans">
              <X className="w-4 h-4" /> Отказ
            </button>
          </div>
        </div>
      ) : null}

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
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-lg">{category.icon}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500">{category.id}</td>
                <td className="px-4 py-3 text-sm font-sans font-medium text-gray-900">{category.name}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(category)} className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
                    {category.id !== 'all' ? <button onClick={() => handleDelete(category.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button> : null}
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
