import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Trash2, X, Save, ToggleLeft, ToggleRight, Pencil } from 'lucide-react';

export default function ManagePolls() {
  const { polls, addPoll, updatePoll, deletePoll } = useData();
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [editingPollId, setEditingPollId] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState(['', '']);

  const handleCreate = async () => {
    if (!question || options.filter(Boolean).length < 2) return;
    await addPoll({
      question,
      options: options.filter(Boolean).map(text => ({ text, votes: 0 })),
      active: false,
    });
    setCreating(false);
    setQuestion('');
    setOptions(['', '']);
  };

  const toggleActive = async (poll) => {
    // Only one poll can be active — deactivate others
    for (const p of polls) {
      if (p.id !== poll.id && p.active) await updatePoll(p.id, { active: false });
    }
    await updatePoll(poll.id, { active: !poll.active });
  };

  const startEdit = (poll) => {
    const nextOptions = (poll.options || []).map(o => o.text).filter(Boolean);
    while (nextOptions.length < 2) nextOptions.push('');
    setEditingPollId(poll.id);
    setEditQuestion(poll.question || '');
    setEditOptions(nextOptions);
  };

  const cancelEdit = () => {
    setEditingPollId(null);
    setEditQuestion('');
    setEditOptions(['', '']);
  };

  const handleUpdate = async () => {
    if (!editingPollId || !editQuestion || editOptions.filter(Boolean).length < 2) return;
    const target = polls.find(p => p.id === editingPollId);
    if (!target) return;

    await updatePoll(editingPollId, {
      question: editQuestion,
      options: editOptions.filter(Boolean).map((text, idx) => ({
        text,
        votes: target.options?.[idx]?.votes || 0,
      })),
    });

    cancelEdit();
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple";
  const labelCls = "block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Анкети</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Гласувания и обществено мнение</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold">
          <Plus className="w-4 h-4" /> Нова анкета
        </button>
      </div>

      {creating && (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Въпрос</label>
              <input className={inputCls} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Чувствате ли се сигурни в Los Santos?" />
            </div>
            <div>
              <label className={labelCls}>Варианти за отговор</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={inputCls} value={opt} onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={`Вариант ${i + 1}`} />
                    {options.length > 2 && (
                      <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 6 && (
                <button onClick={() => setOptions([...options, ''])} className="mt-2 text-xs font-sans text-zn-hot hover:underline">+ Добави вариант</button>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleCreate} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold"><Save className="w-4 h-4" /> Създай</button>
            <button onClick={() => setCreating(false)} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      )}

      {editingPollId !== null && (
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <h3 className="font-sans font-semibold text-gray-900 mb-4">Редакция на анкета</h3>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Въпрос</label>
              <input className={inputCls} value={editQuestion} onChange={e => setEditQuestion(e.target.value)} placeholder="Редакция на въпроса..." />
            </div>
            <div>
              <label className={labelCls}>Варианти за отговор</label>
              <div className="space-y-2">
                {editOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={inputCls} value={opt} onChange={e => { const n = [...editOptions]; n[i] = e.target.value; setEditOptions(n); }} placeholder={`Вариант ${i + 1}`} />
                    {editOptions.length > 2 && (
                      <button onClick={() => setEditOptions(editOptions.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
              {editOptions.length < 6 && (
                <button onClick={() => setEditOptions([...editOptions, ''])} className="mt-2 text-xs font-sans text-zn-hot hover:underline">+ Добави вариант</button>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleUpdate} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold"><Save className="w-4 h-4" /> Запази промени</button>
            <button onClick={cancelEdit} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans"><X className="w-4 h-4" /> Откажи</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {polls.map(poll => {
          const total = poll.options.reduce((s, o) => s + o.votes, 0);
          return (
            <div key={poll.id} className={`bg-white border border-gray-200 p-5 ${poll.active ? 'ring-2 ring-zn-purple' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {poll.active && <span className="px-2 py-0.5 text-[9px] font-sans font-bold uppercase bg-zn-purple text-white">АКТИВНА</span>}
                  <span className="text-xs font-sans text-gray-400">{poll.createdAt} · {total} гласа</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(poll)} className="p-1.5 text-gray-400 hover:text-zn-hot" title="Редактирай">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleActive(poll)} className="p-1.5 text-gray-400 hover:text-zn-hot" title={poll.active ? 'Деактивирай' : 'Активирай'}>
                    {poll.active ? <ToggleRight className="w-5 h-5 text-zn-hot" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => { if (confirm('Изтрий?')) deletePoll(poll.id); }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="font-sans font-semibold text-gray-900 mb-3">{poll.question}</h3>
              <div className="space-y-1.5">
                {poll.options.map((opt, i) => {
                  const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                  return (
                    <div key={i} className="relative border border-gray-100 overflow-hidden">
                      <div className="absolute inset-0 bg-zn-purple/10" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between px-3 py-1.5">
                        <span className="text-sm font-sans text-gray-700">{opt.text}</span>
                        <span className="text-xs font-sans font-bold text-gray-500">{opt.votes} ({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
