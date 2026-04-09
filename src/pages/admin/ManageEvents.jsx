import { useMemo, useRef, useState } from 'react';
import { usePublicData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';

const EVENT_TYPES = [
  { value: 'race', label: 'Race / Circuit' },
  { value: 'party', label: 'Party / Club' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'concert', label: 'Concert' },
  { value: 'other', label: 'Other' },
];

const EVENT_ICONS = ['🏁', '🎉', '🏆', '🤝', '🎤', '🎯', '🚨', '📍', '🌃', '📣'];

const emptyForm = {
  title: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  time: '',
  location: '',
  organizer: '',
  type: 'other',
  image: '📍',
};

const EMPTY_FIELD_ERRORS = Object.freeze({
  title: '',
  date: '',
  location: '',
  type: '',
});

function normalizeFieldErrors(payload) {
  const source = payload?.fieldErrors && typeof payload.fieldErrors === 'object'
    ? payload.fieldErrors
    : null;

  if (!source) return EMPTY_FIELD_ERRORS;
  return {
    title: typeof source.title === 'string' ? source.title : '',
    date: typeof source.date === 'string' ? source.date : '',
    location: typeof source.location === 'string' ? source.location : '',
    type: typeof source.type === 'string' ? source.type : '',
  };
}

function validateEventForm(form) {
  const nextErrors = { ...EMPTY_FIELD_ERRORS };

  if (!String(form.title || '').trim()) nextErrors.title = 'Заглавието е задължително.';
  if (!String(form.date || '').trim()) nextErrors.date = 'Датата е задължителна.';
  if (!String(form.location || '').trim()) nextErrors.location = 'Локацията е задължителна.';
  if (!String(form.type || '').trim()) nextErrors.type = 'Типът е задължителен.';

  return nextErrors;
}

function getFirstErrorField(fieldErrors) {
  if (fieldErrors.title) return 'title';
  if (fieldErrors.date) return 'date';
  if (fieldErrors.location) return 'location';
  if (fieldErrors.type) return 'type';
  return '';
}

export default function ManageEvents() {
  const { events, addEvent, updateEvent, deleteEvent } = usePublicData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);
  const toast = useToast();
  const confirm = useConfirm();
  const titleRef = useRef(null);
  const dateRef = useRef(null);
  const locationRef = useRef(null);
  const typeRef = useRef(null);

  const focusField = (field) => {
    if (field === 'title') titleRef.current?.focus();
    if (field === 'date') dateRef.current?.focus();
    if (field === 'location') locationRef.current?.focus();
    if (field === 'type') typeRef.current?.focus();
  };

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: '' };
    });
  };

  const resetEditor = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setFieldErrors(EMPTY_FIELD_ERRORS);
  };

  const openCreate = () => {
    setEditing('new');
    setForm(emptyForm);
    setError('');
    setFieldErrors(EMPTY_FIELD_ERRORS);
  };

  const openEdit = (eventItem) => {
    setEditing(eventItem.id);
    setForm({
      title: eventItem.title || '',
      description: eventItem.description || '',
      date: eventItem.date || emptyForm.date,
      time: eventItem.time || '',
      location: eventItem.location || '',
      organizer: eventItem.organizer || '',
      type: eventItem.type || 'other',
      image: eventItem.image || '📍',
    });
    setError('');
    setFieldErrors(EMPTY_FIELD_ERRORS);
  };

  const handleSave = async () => {
    const nextFieldErrors = validateEventForm(form);
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
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        date: form.date.trim(),
        time: form.time.trim(),
        location: form.location.trim(),
        organizer: form.organizer.trim(),
      };

      if (editing === 'new') await addEvent(payload);
      else await updateEvent(editing, payload);

      toast.success(editing === 'new' ? 'Събитието е добавено' : 'Събитието е обновено');
      resetEditor();
    } catch (e) {
      const payloadFieldErrors = normalizeFieldErrors(e?.payload);
      const message = payloadFieldErrors.title
        || payloadFieldErrors.date
        || payloadFieldErrors.location
        || payloadFieldErrors.type
        || e?.message
        || 'Грешка при запис.';
      setFieldErrors(payloadFieldErrors);
      setError(message);
      focusField(getFirstErrorField(payloadFieldErrors));
      toast.error('Грешка при запис');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Изтриване на събитие',
      message: 'Събитието ще бъде изтрито безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;
    setError('');
    try {
      await deleteEvent(id);
      toast.success('Събитието е изтрито');
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване.');
      toast.error('Грешка при изтриване');
    }
  };

  const validationEntries = Object.entries(fieldErrors).filter(([, message]) => Boolean(message));
  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';
  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';
  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return events;
    return events.filter((eventItem) => (
      (eventItem.title || '').toLowerCase().includes(normalizedQuery) ||
      (eventItem.location || '').toLowerCase().includes(normalizedQuery) ||
      (eventItem.organizer || '').toLowerCase().includes(normalizedQuery) ||
      (eventItem.description || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [events, query]);

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Събития"
        description="Управление на календара и публичните събития"
        actions={(
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
          <Plus className="w-4 h-4" /> Ново събитие
          </button>
        )}
      />

      <AdminFilterBar className="mb-6">
        <AdminSearchField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Търси по заглавие, локация, организатор или описание..."
          ariaLabel="Търси събития"
        />
      </AdminFilterBar>

      {(error || validationEntries.length > 0) ? (
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
      ) : null}

      {editing ? (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelCls}>Заглавие</label>
              <input
                ref={titleRef}
                className={`${inputCls} ${fieldErrors.title ? '!border-red-400 bg-red-50/30' : ''}`}
                value={form.title}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, title: e.target.value }));
                  clearFieldError('title');
                  if (error) setError('');
                }}
                aria-invalid={fieldErrors.title ? 'true' : 'false'}
                aria-describedby={fieldErrors.title ? 'event-title-error' : undefined}
              />
              {fieldErrors.title ? <p id="event-title-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.title}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Описание</label>
              <textarea className={`${inputCls} h-20 resize-none`} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Дата</label>
              <input
                ref={dateRef}
                className={`${inputCls} ${fieldErrors.date ? '!border-red-400 bg-red-50/30' : ''}`}
                type="date"
                value={form.date}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, date: e.target.value }));
                  clearFieldError('date');
                  if (error) setError('');
                }}
                aria-invalid={fieldErrors.date ? 'true' : 'false'}
                aria-describedby={fieldErrors.date ? 'event-date-error' : undefined}
              />
              {fieldErrors.date ? <p id="event-date-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.date}</p> : null}
            </div>
            <div>
              <label className={labelCls}>Час</label>
              <input className={inputCls} value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} placeholder="20:00" />
            </div>
            <div>
              <label className={labelCls}>Локация</label>
              <input
                ref={locationRef}
                className={`${inputCls} ${fieldErrors.location ? '!border-red-400 bg-red-50/30' : ''}`}
                value={form.location}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, location: e.target.value }));
                  clearFieldError('location');
                  if (error) setError('');
                }}
                aria-invalid={fieldErrors.location ? 'true' : 'false'}
                aria-describedby={fieldErrors.location ? 'event-location-error' : undefined}
              />
              {fieldErrors.location ? <p id="event-location-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.location}</p> : null}
            </div>
            <div>
              <label className={labelCls}>Организатор</label>
              <input className={inputCls} value={form.organizer} onChange={(e) => setForm((prev) => ({ ...prev, organizer: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Тип</label>
              <select
                ref={typeRef}
                className={`${inputCls} ${fieldErrors.type ? '!border-red-400 bg-red-50/30' : ''}`}
                value={form.type}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, type: e.target.value }));
                  clearFieldError('type');
                  if (error) setError('');
                }}
                aria-invalid={fieldErrors.type ? 'true' : 'false'}
                aria-describedby={fieldErrors.type ? 'event-type-error' : undefined}
              >
                {EVENT_TYPES.map((eventType) => <option key={eventType.value} value={eventType.value}>{eventType.label}</option>)}
              </select>
              {fieldErrors.type ? <p id="event-type-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.type}</p> : null}
            </div>
            <div>
              <label className={labelCls}>Икона</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, image: icon }))}
                    className={`w-8 h-8 text-lg flex items-center justify-center border transition-colors ${form.image === icon ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={resetEditor} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {filteredEvents.map((eventItem) => (
          <div key={eventItem.id} className="bg-white border border-gray-200 p-4 flex items-center gap-4 group">
            <span className="text-2xl">{eventItem.image || '📍'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-zn-bg text-white">{EVENT_TYPES.find((eventType) => eventType.value === eventItem.type)?.label}</span>
                <span className="text-xs font-sans text-gray-400">{eventItem.date} {eventItem.time}</span>
              </div>
              <h3 className="text-sm font-sans font-semibold text-gray-900">{eventItem.title}</h3>
              <p className="text-xs font-sans text-gray-500">{eventItem.location} • {eventItem.organizer}</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(eventItem)} aria-label="Редактирай събитието" className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(eventItem.id)} aria-label="Изтрий събитието" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {filteredEvents.length === 0 ? (
          <AdminEmptyState
            title="Няма събития"
            description={query.trim()
              ? 'Няма събития, които да съвпадат с текущото търсене.'
              : 'Все още няма добавени събития в календара.'}
          />
        ) : null}
      </div>
    </div>
  );
}
