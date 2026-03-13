import { useRef, useState } from 'react';
import { usePublicData } from '../../context/DataContext';
import { Plus, Trash2, X, Save, ToggleLeft, ToggleRight, Pencil, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';

function createOption(text = '', votes = 0) {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    text,
    votes: Number.isFinite(Number(votes)) ? Number(votes) : 0,
  };
}

const EMPTY_POLL_ERRORS = Object.freeze({ question: '', options: '' });

function normalizePollFieldErrors(payload) {
  const source = payload?.fieldErrors && typeof payload.fieldErrors === 'object'
    ? payload.fieldErrors
    : null;

  if (!source) return EMPTY_POLL_ERRORS;

  const optionMessage = Object.entries(source).find(([key, value]) => (
    (key === 'options' || key.startsWith('options.')) && typeof value === 'string' && value.trim()
  ))?.[1] || '';

  return {
    question: typeof source.question === 'string' ? source.question : '',
    options: optionMessage,
  };
}

function validatePollDraft(question, options) {
  const nextErrors = { ...EMPTY_POLL_ERRORS };
  const normalizedQuestion = String(question || '').trim();
  const normalizedOptions = (Array.isArray(options) ? options : [])
    .map((option) => ({
      text: String(typeof option === 'string' ? option : option?.text || '').trim(),
      votes: Number.isFinite(Number(option?.votes)) ? Number(option.votes) : 0,
    }))
    .filter((option) => option.text);

  if (!normalizedQuestion) {
    nextErrors.question = 'Въпросът е задължителен.';
  } else if (normalizedQuestion.length > 240) {
    nextErrors.question = 'Въпросът трябва да е до 240 символа.';
  }

  if (normalizedOptions.length < 2) {
    nextErrors.options = 'Добави поне две опции.';
  } else if (normalizedOptions.length > 6) {
    nextErrors.options = 'Позволени са най-много шест опции.';
  }

  return { nextErrors, normalizedQuestion, normalizedOptions };
}

function getFirstPollErrorField(fieldErrors) {
  if (fieldErrors.question) return 'question';
  if (fieldErrors.options) return 'options';
  return '';
}

export default function ManagePolls() {
  const { polls, addPoll, updatePoll, deletePoll } = usePublicData();
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [creatingErrors, setCreatingErrors] = useState(EMPTY_POLL_ERRORS);
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [editingPollId, setEditingPollId] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState([createOption(), createOption()]);
  const [editErrors, setEditErrors] = useState(EMPTY_POLL_ERRORS);
  const [editingBusy, setEditingBusy] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const createQuestionRef = useRef(null);
  const createOptionsRef = useRef(null);
  const editQuestionRef = useRef(null);
  const editOptionsRef = useRef(null);
  const toast = useToast();

  const focusCreateField = (field) => {
    if (field === 'question') createQuestionRef.current?.focus();
    if (field === 'options') createOptionsRef.current?.querySelector('input')?.focus();
  };

  const focusEditField = (field) => {
    if (field === 'question') editQuestionRef.current?.focus();
    if (field === 'options') editOptionsRef.current?.querySelector('input')?.focus();
  };

  const clearCreateError = (field) => {
    setCreatingErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: '' };
    });
  };

  const clearEditError = (field) => {
    setEditErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: '' };
    });
  };

  const resetCreateForm = () => {
    setCreating(false);
    setQuestion('');
    setOptions(['', '']);
    setCreatingErrors(EMPTY_POLL_ERRORS);
  };

  const cancelEdit = () => {
    setEditingPollId(null);
    setEditQuestion('');
    setEditOptions([createOption(), createOption()]);
    setEditErrors(EMPTY_POLL_ERRORS);
  };

  const handleCreate = async () => {
    const { nextErrors, normalizedQuestion, normalizedOptions } = validatePollDraft(question, options);
    const firstField = getFirstPollErrorField(nextErrors);

    if (firstField) {
      setCreatingErrors(nextErrors);
      setError('Поправи маркираните полета преди запис.');
      focusCreateField(firstField);
      return;
    }

    setCreatingBusy(true);
    setError('');
    setCreatingErrors(EMPTY_POLL_ERRORS);

    try {
      await addPoll({
        question: normalizedQuestion,
        createdAt: new Date().toISOString().slice(0, 10),
        options: normalizedOptions.map((option) => ({ text: option.text, votes: 0 })),
        active: false,
      });
      resetCreateForm();
      toast.success('Анкетата е добавена');
    } catch (e) {
      const payloadFieldErrors = normalizePollFieldErrors(e?.payload);
      setCreatingErrors(payloadFieldErrors);
      setError(payloadFieldErrors.question || payloadFieldErrors.options || e?.message || 'Грешка при създаване на анкетата');
      focusCreateField(getFirstPollErrorField(payloadFieldErrors));
      toast.error('Грешка при създаване');
    } finally {
      setCreatingBusy(false);
    }
  };

  const toggleActive = async (poll) => {
    setError('');
    setTogglingId(poll.id);
    try {
      if (poll.active) {
        await updatePoll(poll.id, { active: false });
        toast.success('Анкетата е деактивирана');
        return;
      }

      await updatePoll(poll.id, { active: true });
      toast.success('Анкетата е активирана');
      const otherActives = polls.filter((item) => item.id !== poll.id && item.active);
      if (otherActives.length === 0) return;
      const results = await Promise.allSettled(
        otherActives.map((item) => updatePoll(item.id, { active: false })),
      );
      const failed = results.some((result) => result.status === 'rejected');
      if (failed) {
        setError('Не всички стари активни анкети бяха изключени. Провери списъка.');
      }
    } catch (e) {
      setError(e?.message || 'Грешка при смяна на статуса');
    } finally {
      setTogglingId(null);
    }
  };

  const startEdit = (poll) => {
    const nextOptions = (poll.options || [])
      .map((option) => createOption(option?.text || '', option?.votes || 0))
      .filter((option) => option.text || option.votes > 0);
    while (nextOptions.length < 2) nextOptions.push(createOption());
    setEditingPollId(poll.id);
    setEditQuestion(poll.question || '');
    setEditOptions(nextOptions);
    setEditErrors(EMPTY_POLL_ERRORS);
    setError('');
  };

  const handleUpdate = async () => {
    if (!editingPollId) return;

    const { nextErrors, normalizedQuestion, normalizedOptions } = validatePollDraft(editQuestion, editOptions);
    const firstField = getFirstPollErrorField(nextErrors);

    if (firstField) {
      setEditErrors(nextErrors);
      setError('Поправи маркираните полета преди запис.');
      focusEditField(firstField);
      return;
    }

    setEditingBusy(true);
    setError('');
    setEditErrors(EMPTY_POLL_ERRORS);

    try {
      await updatePoll(editingPollId, {
        question: normalizedQuestion,
        options: normalizedOptions,
      });
      cancelEdit();
      toast.success('Анкетата е обновена');
    } catch (e) {
      const payloadFieldErrors = normalizePollFieldErrors(e?.payload);
      setEditErrors(payloadFieldErrors);
      setError(payloadFieldErrors.question || payloadFieldErrors.options || e?.message || 'Грешка при обновяване на анкетата');
      focusEditField(getFirstPollErrorField(payloadFieldErrors));
      toast.error('Грешка при обновяване');
    } finally {
      setEditingBusy(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';
  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';
  const activeFieldErrors = editingPollId !== null ? editErrors : creating ? creatingErrors : EMPTY_POLL_ERRORS;
  const validationEntries = Object.entries(activeFieldErrors).filter(([, message]) => Boolean(message));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Анкети</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управление и редакция на анкети</p>
        </div>
        <button onClick={() => { setCreating(true); setError(''); setCreatingErrors(EMPTY_POLL_ERRORS); }} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
          <Plus className="w-4 h-4" /> Нова анкета
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
                    <button
                      type="button"
                      className="text-left underline decoration-dotted underline-offset-2"
                      onClick={() => (editingPollId !== null ? focusEditField(field) : focusCreateField(field))}
                    >
                      {message}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}

      {creating ? (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Въпрос</label>
              <input
                ref={createQuestionRef}
                className={`${inputCls} ${creatingErrors.question ? '!border-red-400 bg-red-50/30' : ''}`}
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  clearCreateError('question');
                  if (error) setError('');
                }}
                placeholder="Какво мислиш за новия център?"
                aria-invalid={creatingErrors.question ? 'true' : 'false'}
                aria-describedby={creatingErrors.question ? 'poll-create-question-error' : undefined}
              />
              {creatingErrors.question ? <p id="poll-create-question-error" className="mt-1 text-xs font-sans text-red-600">{creatingErrors.question}</p> : null}
            </div>
            <div ref={createOptionsRef}>
              <label className={labelCls}>Опции за гласуване</label>
              <div className={`space-y-2 ${creatingErrors.options ? 'rounded border border-red-200 bg-red-50/30 p-3' : ''}`}>
                {options.map((option, index) => (
                  <div key={`${index}_${option}`} className="flex gap-2">
                    <input
                      className={inputCls}
                      value={option}
                      onChange={(e) => {
                        const next = [...options];
                        next[index] = e.target.value;
                        setOptions(next);
                        clearCreateError('options');
                        if (error) setError('');
                      }}
                      placeholder={`Опция ${index + 1}`}
                      aria-invalid={creatingErrors.options ? 'true' : 'false'}
                      aria-describedby={creatingErrors.options ? 'poll-create-options-error' : undefined}
                    />
                    {options.length > 2 ? (
                      <button type="button" onClick={() => { setOptions(options.filter((_, optionIndex) => optionIndex !== index)); clearCreateError('options'); }} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    ) : null}
                  </div>
                ))}
              </div>
              {creatingErrors.options ? <p id="poll-create-options-error" className="mt-1 text-xs font-sans text-red-600">{creatingErrors.options}</p> : null}
              {options.length < 6 ? (
                <button type="button" onClick={() => { setOptions([...options, '']); clearCreateError('options'); }} className="mt-2 text-xs font-sans text-zn-hot hover:underline">+ Добави опция</button>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleCreate} disabled={creatingBusy} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази</button>
            <button onClick={resetCreateForm} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Отказ</button>
          </div>
        </div>
      ) : null}

      {editingPollId !== null ? (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <h3 className="font-sans font-semibold text-gray-900 mb-4">Редакция на анкета</h3>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Въпрос</label>
              <input
                ref={editQuestionRef}
                className={`${inputCls} ${editErrors.question ? '!border-red-400 bg-red-50/30' : ''}`}
                value={editQuestion}
                onChange={(e) => {
                  setEditQuestion(e.target.value);
                  clearEditError('question');
                  if (error) setError('');
                }}
                placeholder="Въпрос на анкетата"
                aria-invalid={editErrors.question ? 'true' : 'false'}
                aria-describedby={editErrors.question ? 'poll-edit-question-error' : undefined}
              />
              {editErrors.question ? <p id="poll-edit-question-error" className="mt-1 text-xs font-sans text-red-600">{editErrors.question}</p> : null}
            </div>
            <div ref={editOptionsRef}>
              <label className={labelCls}>Опции за гласуване</label>
              <div className={`space-y-2 ${editErrors.options ? 'rounded border border-red-200 bg-red-50/30 p-3' : ''}`}>
                {editOptions.map((option, index) => (
                  <div key={option.id} className="flex gap-2">
                    <input
                      className={inputCls}
                      value={option.text}
                      onChange={(e) => {
                        setEditOptions((prev) => prev.map((item) => item.id === option.id ? { ...item, text: e.target.value } : item));
                        clearEditError('options');
                        if (error) setError('');
                      }}
                      placeholder={`Опция ${index + 1}`}
                      aria-invalid={editErrors.options ? 'true' : 'false'}
                      aria-describedby={editErrors.options ? 'poll-edit-options-error' : undefined}
                    />
                    {editOptions.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditOptions((prev) => prev.filter((item) => item.id !== option.id));
                          clearEditError('options');
                        }}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              {editErrors.options ? <p id="poll-edit-options-error" className="mt-1 text-xs font-sans text-red-600">{editErrors.options}</p> : null}
              {editOptions.length < 6 ? (
                <button type="button" onClick={() => { setEditOptions((prev) => [...prev, createOption()]); clearEditError('options'); }} className="mt-2 text-xs font-sans text-zn-hot hover:underline">+ Добави опция</button>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleUpdate} disabled={editingBusy} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Запази промените</button>
            <button onClick={cancelEdit} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Отказ</button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {polls.map((poll) => {
          const safeOptions = Array.isArray(poll.options) ? poll.options : [];
          const total = safeOptions.reduce((sum, option) => sum + (option?.votes || 0), 0);
          return (
            <div key={poll.id} className={`bg-white border border-gray-200 p-5 ${poll.active ? 'ring-2 ring-zn-purple' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {poll.active ? <span className="px-2 py-0.5 text-[9px] font-sans font-bold uppercase bg-zn-purple text-white">Активна</span> : null}
                  <span className="text-xs font-sans text-gray-400">{poll.createdAt} • {total} гласа</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(poll)} className="p-1.5 text-gray-400 hover:text-zn-hot" title="Редактирай">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleActive(poll)} disabled={togglingId === poll.id} className="p-1.5 text-gray-400 hover:text-zn-hot disabled:opacity-50" title={poll.active ? 'Деактивирай' : 'Активирай'}>
                    {poll.active ? <ToggleRight className="w-5 h-5 text-zn-hot" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => { if (confirm('Сигурен ли си?')) deletePoll(poll.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="font-sans font-semibold text-gray-900 mb-3">{poll.question}</h3>
              <div className="space-y-1.5">
                {safeOptions.map((option, index) => {
                  const pct = total > 0 ? Math.round((option.votes / total) * 100) : 0;
                  return (
                    <div key={index} className="relative border border-gray-100 overflow-hidden">
                      <div className="absolute inset-0 bg-zn-purple/10" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between px-3 py-1.5">
                        <span className="text-sm font-sans text-gray-700">{option.text}</span>
                        <span className="text-xs font-sans font-bold text-gray-500">{option.votes} ({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {polls.length === 0 ? (
        <div className="text-center py-12 text-sm font-sans text-gray-400">
          Няма анкети.
        </div>
      ) : null}
    </div>
  );
}
