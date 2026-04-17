import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePublicSectionsData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readSearchParam } from '../../utils/adminSearchParams';

const JOB_TYPES = [
  { value: 'police', label: 'Полиция' },
  { value: 'ems', label: 'EMS' },
  { value: 'mechanic', label: 'Механици' },
  { value: 'lawyer', label: 'Адвокати' },
  { value: 'driver', label: 'Шофьори' },
  { value: 'government', label: 'Правителство' },
  { value: 'other', label: 'Друго' },
];

const emptyForm = {
  title: '',
  org: '',
  type: 'other',
  description: '',
  requirements: '',
  salary: '',
  contact: '',
  date: new Date().toISOString().slice(0, 10),
  active: true,
};

const EMPTY_FIELD_ERRORS = Object.freeze({
  title: '',
  org: '',
  type: '',
  date: '',
});

function normalizeFieldErrors(payload) {
  const source = payload?.fieldErrors && typeof payload.fieldErrors === 'object'
    ? payload.fieldErrors
    : null;

  if (!source) return EMPTY_FIELD_ERRORS;
  return {
    title: typeof source.title === 'string' ? source.title : '',
    org: typeof source.org === 'string' ? source.org : '',
    type: typeof source.type === 'string' ? source.type : '',
    date: typeof source.date === 'string' ? source.date : '',
  };
}

function validateJobForm(form) {
  const nextErrors = { ...EMPTY_FIELD_ERRORS };

  if (!String(form.title || '').trim()) nextErrors.title = 'Заглавието е задължително.';
  if (!String(form.org || '').trim()) nextErrors.org = 'Организацията е задължителна.';
  if (!String(form.type || '').trim()) nextErrors.type = 'Типът е задължителен.';
  if (!String(form.date || '').trim()) nextErrors.date = 'Датата е задължителна.';

  return nextErrors;
}

function getFirstErrorField(fieldErrors) {
  if (fieldErrors.title) return 'title';
  if (fieldErrors.org) return 'org';
  if (fieldErrors.type) return 'type';
  if (fieldErrors.date) return 'date';
  return '';
}

export default function ManageJobs() {
  const { jobs, addJob, updateJob, deleteJob } = usePublicSectionsData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);
  const toast = useToast();
  const confirm = useConfirm();
  const titleRef = useRef(null);
  const orgRef = useRef(null);
  const typeRef = useRef(null);
  const dateRef = useRef(null);
  const query = readSearchParam(searchParams, 'q', '');

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const focusField = (field) => {
    if (field === 'title') titleRef.current?.focus();
    if (field === 'org') orgRef.current?.focus();
    if (field === 'type') typeRef.current?.focus();
    if (field === 'date') dateRef.current?.focus();
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

  const openEdit = (job) => {
    setEditing(job.id);
    setForm({
      title: job.title || '',
      org: job.org || '',
      type: job.type || 'other',
      description: job.description || '',
      requirements: job.requirements || '',
      salary: job.salary || '',
      contact: job.contact || '',
      date: job.date || emptyForm.date,
      active: typeof job.active === 'boolean' ? job.active : true,
    });
    setError('');
    setFieldErrors(EMPTY_FIELD_ERRORS);
  };

  const handleSave = async () => {
    const nextFieldErrors = validateJobForm(form);
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
        org: form.org.trim(),
        description: form.description.trim(),
        requirements: form.requirements.trim(),
        salary: form.salary.trim(),
        contact: form.contact.trim(),
        date: form.date.trim(),
      };

      if (editing === 'new') await addJob(payload);
      else await updateJob(editing, payload);

      toast.success(editing === 'new' ? 'Обявата е добавена' : 'Обявата е обновена');
      resetEditor();
    } catch (e) {
      const payloadFieldErrors = normalizeFieldErrors(e?.payload);
      const message = payloadFieldErrors.title
        || payloadFieldErrors.org
        || payloadFieldErrors.type
        || payloadFieldErrors.date
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

  const toggleActive = async (job) => {
    setError('');
    try {
      await updateJob(job.id, { active: !job.active });
      toast.success(job.active ? 'Обявата е деактивирана' : 'Обявата е активирана');
    } catch (e) {
      setError(e?.message || 'Грешка при промяна на статуса.');
      toast.error('Грешка при промяна');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Изтриване на обява',
      message: 'Обявата за работа ще бъде изтрита безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;
    setError('');
    try {
      await deleteJob(id);
      toast.success('Обявата е изтрита');
    } catch (e) {
      setError(e?.message || 'Грешка при изтриване.');
      toast.error('Грешка при изтриване');
    }
  };

  const validationEntries = Object.entries(fieldErrors).filter(([, message]) => Boolean(message));
  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';
  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';
  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return jobs;
    return jobs.filter((job) => (
      (job.title || '').toLowerCase().includes(normalizedQuery) ||
      (job.org || '').toLowerCase().includes(normalizedQuery) ||
      (job.salary || '').toLowerCase().includes(normalizedQuery) ||
      (job.contact || '').toLowerCase().includes(normalizedQuery) ||
      (job.requirements || '').toLowerCase().includes(normalizedQuery)
    ));
  }, [jobs, query]);

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Обяви за работа"
        description="Управление на RP обявите за работа"
        actions={(
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
          <Plus className="w-4 h-4" /> Нова обява
          </button>
        )}
      />

      <AdminFilterBar className="mb-6">
        <AdminSearchField
          value={query}
          onChange={(event) => setListSearchParams({ q: event.target.value })}
          placeholder="Търси по заглавие, организация, заплащане или контакт..."
          ariaLabel="Търси обяви за работа"
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
            <div>
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
                aria-describedby={fieldErrors.title ? 'job-title-error' : undefined}
              />
              {fieldErrors.title ? <p id="job-title-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.title}</p> : null}
            </div>
            <div>
              <label className={labelCls}>Организация</label>
              <input
                ref={orgRef}
                className={`${inputCls} ${fieldErrors.org ? '!border-red-400 bg-red-50/30' : ''}`}
                value={form.org}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, org: e.target.value }));
                  clearFieldError('org');
                  if (error) setError('');
                }}
                aria-invalid={fieldErrors.org ? 'true' : 'false'}
                aria-describedby={fieldErrors.org ? 'job-org-error' : undefined}
              />
              {fieldErrors.org ? <p id="job-org-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.org}</p> : null}
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
                aria-describedby={fieldErrors.type ? 'job-type-error' : undefined}
              >
                {JOB_TYPES.map((jobType) => <option key={jobType.value} value={jobType.value}>{jobType.label}</option>)}
              </select>
              {fieldErrors.type ? <p id="job-type-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.type}</p> : null}
            </div>
            <div>
              <label className={labelCls}>Заплащане</label>
              <input className={inputCls} value={form.salary} onChange={(e) => setForm((prev) => ({ ...prev, salary: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Описание</label>
              <textarea className={`${inputCls} h-20 resize-none`} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Изисквания</label>
              <input className={inputCls} value={form.requirements} onChange={(e) => setForm((prev) => ({ ...prev, requirements: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Контакт</label>
              <input className={inputCls} value={form.contact} onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))} />
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
                aria-describedby={fieldErrors.date ? 'job-date-error' : undefined}
              />
              {fieldErrors.date ? <p id="job-date-error" className="mt-1 text-xs font-sans text-red-600">{fieldErrors.date}</p> : null}
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={resetEditor} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {filteredJobs.map((job) => (
          <div key={job.id} className="bg-white border border-gray-200 p-4 flex items-center gap-4 group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase bg-gray-100 text-gray-600">{JOB_TYPES.find((jobType) => jobType.value === job.type)?.label}</span>
                {!job.active ? <span className="text-[9px] font-sans text-red-500 font-bold">Скрита</span> : null}
              </div>
              <h3 className="text-sm font-sans font-semibold text-gray-900">{job.title}</h3>
              <p className="text-xs font-sans text-gray-500">{job.org} • {job.salary}</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleActive(job)} aria-label={job.active ? 'Скрий обявата' : 'Покажи обявата'} className="p-1.5 text-gray-400 hover:text-zn-hot" title={job.active ? 'Скрий' : 'Покажи'}>
                {job.active ? <ToggleRight className="w-5 h-5 text-zn-hot" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => openEdit(job)} aria-label="Редактирай обявата" className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(job.id)} aria-label="Изтрий обявата" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {filteredJobs.length === 0 ? (
          <AdminEmptyState
            title="Няма обяви за работа"
            description={query.trim()
              ? 'Няма обяви за работа, които да съвпадат с текущото търсене.'
              : 'Все още няма публикувани RP обяви за работа.'}
          />
        ) : null}
      </div>
    </div>
  );
}
