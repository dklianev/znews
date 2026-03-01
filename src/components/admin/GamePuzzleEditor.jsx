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
                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Допълнителни guesses</label>
                <textarea value={joinMultiValue(solution.allowedWords)} onChange={(e) => actions.setSolutionField('allowedWords', splitMultiValue(e.target.value))} className={fieldClass('solution.allowedWords', 'h-40 font-mono text-sm')} placeholder="Една дума на ред" />
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
                            <input type="text" value={group.label || ''} onChange={(e) => actions.setConnectionsGroupField(groupIndex, 'label', e.target.value)} className={fieldClass(`solution.groups.${groupIndex}.label`)} placeholder="Име на група" />
                            <input type="text" value={group.difficulty || ''} onChange={(e) => actions.setConnectionsGroupField(groupIndex, 'difficulty', e.target.value)} className={fieldClass(`solution.groups.${groupIndex}.difficulty`)} placeholder="Трудност" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {(Array.isArray(group.items) ? group.items : ['', '', '', '']).map((item, itemIndex) => (
                                <input key={`group-${groupIndex}-item-${itemIndex}`} type="text" value={item} onChange={(e) => actions.setConnectionsGroupItem(groupIndex, itemIndex, e.target.value)} className={fieldClass(`solution.groups.${groupIndex}.items.${itemIndex}`)} placeholder={`Елемент ${itemIndex + 1}`} />
                            ))}
                        </div>
                        <textarea value={group.explanation || ''} onChange={(e) => actions.setConnectionsGroupField(groupIndex, 'explanation', e.target.value)} className={fieldClass(`solution.groups.${groupIndex}.explanation`, 'h-24 text-sm')} placeholder="Обяснение" />
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
                    Добави въпрос
                </button>
            </div>
            <div className="space-y-5">
                {questions.map((question, questionIndex) => (
                    <div key={`quiz-question-${questionIndex}`} className="border border-gray-200 rounded-2xl p-5 bg-gray-50/70">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Въпрос {questionIndex + 1}</p>
                            {questions.length > 1 && (
                                <button type="button" onClick={() => actions.removeQuizQuestion(questionIndex)} className="text-red-600 hover:text-red-800 p-2" title="Премахни въпрос">
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
                                    <option value={0}>Верен: Отговор 1</option>
                                    <option value={1}>Верен: Отговор 2</option>
                                    <option value={2}>Верен: Отговор 3</option>
                                    <option value={3}>Верен: Отговор 4</option>
                                </select>
                                <input type="text" value={question.articleId ?? ''} onChange={(e) => actions.setQuizQuestionField(questionIndex, 'articleId', e.target.value)} className={fieldClass(`payload.questions.${questionIndex}.articleId`)} placeholder="Article ID (по желание)" />
                            </div>
                            <textarea value={question.explanation || ''} onChange={(e) => actions.setQuizQuestionField(questionIndex, 'explanation', e.target.value)} className={fieldClass(`payload.questions.${questionIndex}.explanation`, 'h-24 text-sm')} placeholder="Обяснение" />
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
    const fieldClass = (key, extra = '') => [
        'w-full rounded-lg px-3 py-2 border transition-colors',
        warningKeys.has(key)
            ? 'border-amber-400 bg-amber-50 text-amber-950 placeholder-amber-500 focus:border-amber-500'
            : 'border-gray-300 bg-white text-gray-900 focus:border-gray-400',
        extra,
    ].join(' ');
    const editor = gameSlug === 'word'
        ? renderWordEditor(editForm, actions, fieldClass)
        : gameSlug === 'connections'
            ? renderConnectionsEditor(editForm, actions, fieldClass)
            : renderQuizEditor(editForm, actions, fieldClass);

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-zn-purple/10 text-zn-purple flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="font-bold text-xl uppercase font-condensed">{guide?.title || 'Редактор на пъзел'}</h2>
                    <p className="text-sm text-gray-500 mt-1">{guide?.summary || 'Попълни полетата и запази.'}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-5 py-4">
                <p className="text-sm font-bold text-blue-900">Редакторът е насочен към чернови.</p>
                <p className="text-sm text-blue-800 mt-1">
                    Новите пъзели се подготвят тук, а публикуването става от бутона „Публикувай“ в списъка.
                </p>
            </div>

            {Array.isArray(guide?.workflow) && guide.workflow.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 px-5 py-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Как да го попълниш</p>
                    <div className="space-y-2 text-sm text-gray-700">
                        {guide.workflow.map((item) => <p key={item}>{item}</p>)}
                    </div>
                </div>
            )}

            {placeholderWarnings.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                    <p className="text-sm font-bold text-amber-950">Още не може да се публикува</p>
                    <div className="mt-3 space-y-2 text-sm text-amber-900">
                        {placeholderWarnings.map((warning) => <p key={warning.key}>• {warning.label}</p>)}
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
                    Няма template стойности. Пъзелът е готов за финален преглед и publish.
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
                        <option value="easy">Лесно</option>
                        <option value="medium">Средно</option>
                        <option value="hard">Трудно</option>
                    </select>
                </label>
                <label className="block">
                    <span className="block text-xs font-bold uppercase text-gray-500 mb-2">Статус</span>
                    {isPublished ? (
                        <div className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                            Публикуван. Промените ще се отразят на живо веднага след запис.
                        </div>
                    ) : (
                        <select value={editForm?.status === 'archived' ? 'archived' : 'draft'} onChange={(e) => actions.setTopLevelField('status', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                            <option value="draft">Чернова</option>
                            <option value="archived">Архив</option>
                        </select>
                    )}
                </label>
                <label className="block">
                    <span className="block text-xs font-bold uppercase text-gray-500 mb-2">Бележки за редактора</span>
                    <input type="text" value={editForm?.editorNotes || ''} onChange={(e) => actions.setTopLevelField('editorNotes', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Какво остава да се провери" />
                </label>
            </div>

            {editor}

            <details className="border border-gray-200 rounded-2xl bg-gray-50/80">
                <summary className="cursor-pointer px-5 py-4 text-sm font-bold uppercase tracking-wider text-gray-700">Advanced JSON preview</summary>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 px-5 pb-5">
                    <pre className="bg-white border border-gray-200 rounded-xl p-4 text-xs overflow-auto">{JSON.stringify(editForm?.payload || {}, null, 2)}</pre>
                    <pre className="bg-white border border-gray-200 rounded-xl p-4 text-xs overflow-auto">{JSON.stringify(editForm?.solution || {}, null, 2)}</pre>
                </div>
            </details>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold uppercase text-sm tracking-wider rounded-lg">Отказ</button>
                <button type="button" onClick={onSave} disabled={saving} className="px-6 py-2 bg-black text-white font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-gray-800 rounded-lg disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Запази
                </button>
            </div>
        </div>
    );
}
