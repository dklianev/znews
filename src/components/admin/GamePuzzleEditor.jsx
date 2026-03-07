import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { getGamePlaceholderWarnings } from '../../../shared/gamePlaceholderWarnings.js';

function joinMultiValue(values) {
  return Array.isArray(values) ? values.join('\n') : '';
}

function splitMultiValue(rawValue) {
  return String(rawValue || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject(rawValue) {
  const parsed = JSON.parse(String(rawValue || '{}'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON must be an object.');
  }
  return parsed;
}

function renderWordEditor(editForm, actions, fieldClass) {
  const payload = editForm?.payload || {};
  const solution = editForm?.solution || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Отговор</label>
          <input type="text" value={solution.answer || ''} onChange={(e) => actions.setSolutionField('answer', e.target.value.toUpperCase())} className={fieldClass('solution.answer', 'font-mono text-lg uppercase')} maxLength={payload.wordLength || 5} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Дължина</label>
          <input type="number" min="3" max="12" value={payload.wordLength || 5} onChange={(e) => actions.setPayloadField('wordLength', Number.parseInt(e.target.value, 10) || 5)} className={fieldClass('payload.wordLength')} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Макс. опити</label>
          <input type="number" min="1" max="12" value={payload.maxAttempts || 6} onChange={(e) => actions.setPayloadField('maxAttempts', Number.parseInt(e.target.value, 10) || 6)} className={fieldClass('payload.maxAttempts')} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Допустими guesses</label>
        <textarea value={joinMultiValue(solution.allowedWords)} onChange={(e) => actions.setSolutionField('allowedWords', splitMultiValue(e.target.value))} className={fieldClass('solution.allowedWords', 'h-40 font-mono text-sm')} placeholder="По един guess на ред" />
      </div>
    </div>
  );
}

function renderHangmanEditor(editForm, actions, fieldClass) {
  const payload = editForm?.payload || {};
  const solution = editForm?.solution || {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Скрита дума</label>
          <input type="text" value={solution.answer || ''} onChange={(e) => actions.setSolutionField('answer', e.target.value.toUpperCase().replace(/\s+/g, ''))} className={fieldClass('solution.answer', 'font-mono text-lg uppercase')} maxLength={18} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Категория</label>
          <input type="text" value={payload.category || ''} onChange={(e) => actions.setPayloadField('category', e.target.value)} className={fieldClass('payload.category')} placeholder="Напр. Спорт, Град, Криминале" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Подсказка</label>
          <input type="text" value={payload.hint || ''} onChange={(e) => actions.setPayloadField('hint', e.target.value)} className={fieldClass('payload.hint')} placeholder="Кратка улика без директно издаване" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Грешки</label>
          <input type="number" min="4" max="10" value={payload.maxMistakes || 7} onChange={(e) => actions.setPayloadField('maxMistakes', Number.parseInt(e.target.value, 10) || 7)} className={fieldClass('payload.maxMistakes')} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Клавиатура</label>
          <select value={payload.keyboardLayout || 'bg'} onChange={(e) => actions.setPayloadField('keyboardLayout', e.target.value)} className={fieldClass('payload.keyboardLayout')}>
            <option value="bg">Българска</option>
            <option value="latin">Латиница</option>
          </select>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-4 text-sm text-orange-900">
          <p className="font-bold uppercase tracking-wide text-[11px]">Публичен preview</p>
          <p className="mt-2 text-base font-semibold">{payload.category || 'Категория'}</p>
          <p className="mt-1 text-orange-800/80">{payload.hint || 'Подсказката ще се вижда под дъската.'}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-orange-700">{solution.answer ? `${String(solution.answer).length} букви` : 'Без дума'}</p>
        </div>
      </div>
    </div>
  );
}

function renderConnectionsEditor(editForm, actions, fieldClass) {
  const payloadItems = Array.isArray(editForm?.payload?.items) ? editForm.payload.items : Array.from({ length: 16 }, () => '');
  const groups = Array.isArray(editForm?.solution?.groups) ? editForm.solution.groups : [];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-4">16 елемента</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {payloadItems.map((item, index) => (
            <input key={`board-item-${index}`} type="text" value={item} onChange={(e) => actions.setConnectionsItem(index, e.target.value)} className={fieldClass(`payload.items.${index}`, 'font-semibold')} placeholder={`Елемент ${index + 1}`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {groups.map((group, groupIndex) => (
          <div key={`group-${groupIndex}`} className="border border-gray-200 rounded-2xl p-5 bg-gray-50/70">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input type="text" value={group.label || ''} onChange={(e) => actions.setConnectionsGroupField(groupIndex, 'label', e.target.value)} className={fieldClass(`solution.groups.${groupIndex}.label`)} placeholder="Име на групата" />
              <input type="text" value={group.difficulty || ''} onChange={(e) => actions.setConnectionsGroupField(groupIndex, 'difficulty', e.target.value)} className={fieldClass(`solution.groups.${groupIndex}.difficulty`)} placeholder="Трудност" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(Array.isArray(group.items) ? group.items : ['', '', '', '']).map((item, itemIndex) => (
                <input key={`group-${groupIndex}-item-${itemIndex}`} type="text" value={item} onChange={(e) => actions.setConnectionsGroupItem(groupIndex, itemIndex, e.target.value)} className={fieldClass(`solution.groups.${groupIndex}.items.${itemIndex}`)} placeholder={`Дума ${itemIndex + 1}`} />
              ))}
            </div>
            <textarea value={group.explanation || ''} onChange={(e) => actions.setConnectionsGroupField(groupIndex, 'explanation', e.target.value)} className={fieldClass(`solution.groups.${groupIndex}.explanation`, 'h-24 text-sm')} placeholder="Кратко обяснение" />
          </div>
        ))}
      </div>
    </div>
  );
}

function renderCrosswordEditor(editForm, actions, fieldClass) {
  const payload = editForm?.payload || {};
  const solution = editForm?.solution || {};
  const layout = Array.isArray(payload.layout) ? payload.layout : [];
  const solutionGrid = Array.isArray(solution.grid) ? solution.grid : [];
  const clues = payload.clues || { across: [], down: [] };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Заглавие</label>
            <input type="text" value={payload.title || ''} onChange={(e) => actions.setPayloadField('title', e.target.value)} className={fieldClass('payload.title')} placeholder="Мини кръстословица" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Deck</label>
            <textarea value={payload.deck || ''} onChange={(e) => actions.setPayloadField('deck', e.target.value)} className={fieldClass('payload.deck', 'h-24 text-sm')} placeholder="Кратък контекст за играта" />
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-700">Размер</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-bold uppercase text-gray-500 mb-2">Ширина</span>
              <input type="number" min="3" max="12" value={payload.width || 5} onChange={(e) => actions.setCrosswordDimensions(Number.parseInt(e.target.value, 10) || 5, payload.height || 5)} className={fieldClass('payload.width')} />
            </label>
            <label className="block">
              <span className="block text-xs font-bold uppercase text-gray-500 mb-2">Височина</span>
              <input type="number" min="3" max="12" value={payload.height || 5} onChange={(e) => actions.setCrosswordDimensions(payload.width || 5, Number.parseInt(e.target.value, 10) || 5)} className={fieldClass('payload.height')} />
            </label>
          </div>
          <p className="mt-4 text-sm text-indigo-900">Клик върху клетка в мрежата, за да я блокираш или отключиш. В решението използвай <span className="font-mono">?</span> за непопълнена буква.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Мрежа</h3>
              <p className="text-xs text-gray-500 mt-1">Блокирани клетки = тъмни квадратчета.</p>
            </div>
          </div>
          <div className="inline-grid gap-2" style={{ gridTemplateColumns: `repeat(${payload.width || 5}, minmax(0, 44px))` }}>
            {layout.map((row, rowIndex) => Array.from(String(row || '')).map((cell, colIndex) => {
              const blocked = cell === '#';
              return (
                <button
                  key={`layout-${rowIndex}-${colIndex}`}
                  type="button"
                  onClick={() => actions.toggleCrosswordLayoutCell(rowIndex, colIndex)}
                  className={`h-11 rounded-xl border text-xs font-black transition-colors ${blocked ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:text-indigo-700'}`}
                  title={blocked ? 'Отключи клетката' : 'Блокирай клетката'}
                >
                  {blocked ? '#' : `${rowIndex + 1}:${colIndex + 1}`}
                </button>
              );
            }))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Решение</h3>
              <p className="text-xs text-gray-500 mt-1">Попълни финалните букви за всяка активна клетка.</p>
            </div>
          </div>
          <div className="inline-grid gap-2" style={{ gridTemplateColumns: `repeat(${payload.width || 5}, minmax(0, 44px))` }}>
            {layout.map((row, rowIndex) => Array.from(String(row || '')).map((cell, colIndex) => {
              if (cell === '#') {
                return <div key={`solution-${rowIndex}-${colIndex}`} className="h-11 rounded-xl bg-slate-900 border border-slate-900" />;
              }
              const currentValue = Array.from(String(solutionGrid[rowIndex] || ''))[colIndex] || '?';
              return (
                <input
                  key={`solution-${rowIndex}-${colIndex}`}
                  type="text"
                  inputMode="text"
                  maxLength={1}
                  value={currentValue}
                  onChange={(e) => actions.setCrosswordSolutionCell(rowIndex, colIndex, e.target.value)}
                  className={fieldClass('solution.grid', 'h-11 rounded-xl text-center font-mono text-lg uppercase font-bold')}
                />
              );
            }))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {['across', 'down'].map((direction) => (
          <div key={direction} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">{direction === 'across' ? 'Хоризонтални' : 'Вертикални'} улики</h3>
                <p className="text-xs text-gray-500 mt-1">Автоматично се синхронизират с мрежата.</p>
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">{(Array.isArray(clues[direction]) ? clues[direction].length : 0).toString().padStart(2, '0')}</span>
            </div>
            <div className="space-y-3">
              {(Array.isArray(clues[direction]) ? clues[direction] : []).map((entry, index) => (
                <div key={`${direction}-${entry.row}-${entry.col}`} className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <span>#{entry.number}</span>
                    <span>{entry.length} букви</span>
                    <span>{entry.row + 1}:{entry.col + 1}</span>
                  </div>
                  <textarea
                    value={entry.clue || ''}
                    onChange={(e) => actions.setCrosswordClue(direction, entry.row, entry.col, e.target.value)}
                    className={fieldClass(`payload.clues.${direction}.${index}.clue`, 'h-24 text-sm')}
                    placeholder={direction === 'across' ? 'Подсказка за хоризонталната дума' : 'Подсказка за вертикалната дума'}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderQuizEditor(editForm, actions, fieldClass) {
  const questions = Array.isArray(editForm?.payload?.questions) ? editForm.payload.questions : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Въпроси</h3>
          <p className="text-xs text-gray-500 mt-1">Препоръчително: 5 въпроса.</p>
        </div>
        <button type="button" onClick={actions.addQuizQuestion} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-bold uppercase tracking-wider hover:bg-gray-800">
          <Plus className="w-4 h-4" />
          Нов въпрос
        </button>
      </div>
      <div className="space-y-5">
        {questions.map((question, questionIndex) => (
          <div key={`quiz-question-${questionIndex}`} className="border border-gray-200 rounded-2xl p-5 bg-gray-50/70">
            <div className="flex items-start justify-between gap-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Въпрос {questionIndex + 1}</p>
              {questions.length > 1 && (
                <button type="button" onClick={() => actions.removeQuizQuestion(questionIndex)} className="text-red-600 hover:text-red-800 p-2" title="Премахни въпроса">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="space-y-4">
              <input type="text" value={question.question || ''} onChange={(e) => actions.setQuizQuestionField(questionIndex, 'question', e.target.value)} className={fieldClass(`payload.questions.${questionIndex}.question`)} placeholder="Текст на въпроса" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(Array.isArray(question.options) ? question.options : ['', '', '', '']).map((option, optionIndex) => (
                  <input key={`question-${questionIndex}-option-${optionIndex}`} type="text" value={option} onChange={(e) => actions.setQuizOption(questionIndex, optionIndex, e.target.value)} className={fieldClass(`payload.questions.${questionIndex}.options.${optionIndex}`)} placeholder={`Отговор ${optionIndex + 1}`} />
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select value={question.correctIndex ?? 0} onChange={(e) => actions.setQuizQuestionField(questionIndex, 'correctIndex', Number.parseInt(e.target.value, 10) || 0)} className={fieldClass(`payload.questions.${questionIndex}.correctIndex`)}>
                  <option value={0}>Верен: отговор 1</option>
                  <option value={1}>Верен: отговор 2</option>
                  <option value={2}>Верен: отговор 3</option>
                  <option value={3}>Верен: отговор 4</option>
                </select>
                <input type="text" value={question.articleId ?? ''} onChange={(e) => actions.setQuizQuestionField(questionIndex, 'articleId', e.target.value)} className={fieldClass(`payload.questions.${questionIndex}.articleId`)} placeholder="Article ID (по избор)" />
              </div>
              <textarea value={question.explanation || ''} onChange={(e) => actions.setQuizQuestionField(questionIndex, 'explanation', e.target.value)} className={fieldClass(`payload.questions.${questionIndex}.explanation`, 'h-24 text-sm')} placeholder="Кратко обяснение" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GamePuzzleEditor({ gameSlug, editForm, guide, saving, onCancel, onSave, actions }) {
  const isPublished = editForm?.status === 'published';
  const placeholderWarnings = getGamePlaceholderWarnings(gameSlug, editForm);
  const warningKeys = new Set(placeholderWarnings.map((warning) => warning.key));

  const payloadJsonPreview = useMemo(() => JSON.stringify(editForm?.payload || {}, null, 2), [editForm?.payload]);
  const solutionJsonPreview = useMemo(() => JSON.stringify(editForm?.solution || {}, null, 2), [editForm?.solution]);
  const [payloadJsonDraft, setPayloadJsonDraft] = useState(payloadJsonPreview);
  const [solutionJsonDraft, setSolutionJsonDraft] = useState(solutionJsonPreview);
  const [payloadJsonError, setPayloadJsonError] = useState('');
  const [solutionJsonError, setSolutionJsonError] = useState('');
  const [payloadJsonFocused, setPayloadJsonFocused] = useState(false);
  const [solutionJsonFocused, setSolutionJsonFocused] = useState(false);

  useEffect(() => {
    if (!payloadJsonFocused) {
      setPayloadJsonDraft(payloadJsonPreview);
      setPayloadJsonError('');
    }
  }, [payloadJsonFocused, payloadJsonPreview]);

  useEffect(() => {
    if (!solutionJsonFocused) {
      setSolutionJsonDraft(solutionJsonPreview);
      setSolutionJsonError('');
    }
  }, [solutionJsonFocused, solutionJsonPreview]);

  const fieldClass = (key, extra = '') => [
    'w-full rounded-lg px-3 py-2 border transition-colors',
    warningKeys.has(key)
      ? 'border-amber-400 bg-amber-50 text-amber-950 placeholder-amber-500 focus:border-amber-500'
      : 'border-gray-300 bg-white text-gray-900 focus:border-gray-400',
    extra,
  ].join(' ');

  const applyPayloadJsonDraft = (rawValue = payloadJsonDraft) => {
    try {
      const parsed = parseJsonObject(rawValue);
      actions?.replacePayload?.(parsed);
      setPayloadJsonError('');
      return parsed;
    } catch (error) {
      setPayloadJsonError(error?.message || 'Invalid JSON.');
      return null;
    }
  };

  const applySolutionJsonDraft = (rawValue = solutionJsonDraft) => {
    try {
      const parsed = parseJsonObject(rawValue);
      actions?.replaceSolution?.(parsed);
      setSolutionJsonError('');
      return parsed;
    } catch (error) {
      setSolutionJsonError(error?.message || 'Invalid JSON.');
      return null;
    }
  };

  const onPayloadJsonChange = (event) => {
    const nextValue = event.target.value;
    setPayloadJsonDraft(nextValue);
    applyPayloadJsonDraft(nextValue);
  };

  const onSolutionJsonChange = (event) => {
    const nextValue = event.target.value;
    setSolutionJsonDraft(nextValue);
    applySolutionJsonDraft(nextValue);
  };

  const handleSaveClick = () => {
    const parsedPayload = applyPayloadJsonDraft();
    const parsedSolution = applySolutionJsonDraft();
    if (!parsedPayload || !parsedSolution) return;
    onSave({
      ...editForm,
      payload: parsedPayload,
      solution: parsedSolution,
    });
  };

  const editor = gameSlug === 'word'
    ? renderWordEditor(editForm, actions, fieldClass)
    : gameSlug === 'hangman'
      ? renderHangmanEditor(editForm, actions, fieldClass)
      : gameSlug === 'connections'
        ? renderConnectionsEditor(editForm, actions, fieldClass)
        : gameSlug === 'crossword'
          ? renderCrosswordEditor(editForm, actions, fieldClass)
          : renderQuizEditor(editForm, actions, fieldClass);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-zn-purple/10 text-zn-purple flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-xl uppercase font-condensed">{guide?.title || 'Редактор на игра'}</h2>
          <p className="text-sm text-gray-500 mt-1">{guide?.summary || 'Подготви съдържанието и настройките.'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-5 py-4">
        <p className="text-sm font-bold text-blue-900">Публикувай само след ръчна проверка.</p>
        <p className="text-sm text-blue-800 mt-1">
          Draft-овете могат да съдържат placeholder текст, но publish е блокиран, докато всичко не е финално.
        </p>
      </div>

      {Array.isArray(guide?.workflow) && guide.workflow.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Стъпки</p>
          <div className="space-y-2 text-sm text-gray-700">
            {guide.workflow.map((item) => <p key={item}>{item}</p>)}
          </div>
        </div>
      )}

      {placeholderWarnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-bold text-amber-950">Има полета, които още не са финални</p>
          <div className="mt-3 space-y-2 text-sm text-amber-900">
            {placeholderWarnings.map((warning) => <p key={warning.key}>• {warning.label}</p>)}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          Няма placeholder съдържание. Пъзелът е готов за финален преглед преди publish.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <label className="block">
          <span className="block text-xs font-bold uppercase text-gray-500 mb-2">Дата на пъзела</span>
          <input type="date" value={editForm?.puzzleDate || ''} onChange={(e) => actions.setTopLevelField('puzzleDate', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
        </label>
        <label className="block">
          <span className="block text-xs font-bold uppercase text-gray-500 mb-2">Трудност</span>
          <select value={editForm?.difficulty || 'medium'} onChange={(e) => actions.setTopLevelField('difficulty', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
            <option value="easy">Лесна</option>
            <option value="medium">Средна</option>
            <option value="hard">Трудна</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-bold uppercase text-gray-500 mb-2">Статус</span>
          {isPublished ? (
            <div className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              Публикувано. Промени статуса само чрез нова редакция на пъзела.
            </div>
          ) : (
            <select value={editForm?.status === 'archived' ? 'archived' : 'draft'} onChange={(e) => actions.setTopLevelField('status', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
              <option value="draft">Draft</option>
              <option value="archived">Архив</option>
            </select>
          )}
        </label>
        <label className="block">
          <span className="block text-xs font-bold uppercase text-gray-500 mb-2">Бележка за редактора</span>
          <input type="text" value={editForm?.editorNotes || ''} onChange={(e) => actions.setTopLevelField('editorNotes', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Вътрешна бележка" />
        </label>
      </div>

      {editor}

      <details className="border border-gray-200 rounded-2xl bg-gray-50/80">
        <summary className="cursor-pointer px-5 py-4 text-sm font-bold uppercase tracking-wider text-gray-700">Advanced JSON preview</summary>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 px-5 pb-5">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Payload JSON</p>
            <textarea
              value={payloadJsonDraft}
              onChange={onPayloadJsonChange}
              onFocus={() => setPayloadJsonFocused(true)}
              onBlur={() => setPayloadJsonFocused(false)}
              className="w-full min-h-[280px] font-mono text-xs bg-white border border-gray-200 rounded-xl p-4 resize-y"
              spellCheck={false}
            />
            {payloadJsonError && (
              <p className="text-xs font-semibold text-red-600">{payloadJsonError}</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Solution JSON</p>
            <textarea
              value={solutionJsonDraft}
              onChange={onSolutionJsonChange}
              onFocus={() => setSolutionJsonFocused(true)}
              onBlur={() => setSolutionJsonFocused(false)}
              className="w-full min-h-[280px] font-mono text-xs bg-white border border-gray-200 rounded-xl p-4 resize-y"
              spellCheck={false}
            />
            {solutionJsonError && (
              <p className="text-xs font-semibold text-red-600">{solutionJsonError}</p>
            )}
          </div>
        </div>
      </details>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold uppercase text-sm tracking-wider rounded-lg">Отказ</button>
        <button type="button" onClick={handleSaveClick} disabled={saving} className="px-6 py-2 bg-black text-white font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-gray-800 rounded-lg disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Запази
        </button>
      </div>
    </div>
  );
}
