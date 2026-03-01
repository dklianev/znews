import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../../components/admin/Toast';
import { Puzzle, Loader2, Plus, Save, Trash2, Globe, FileText, CheckCircle2, Edit2 } from 'lucide-react';

export default function ManageGamePuzzles() {
    const [games, setGames] = useState([]);
    const [selectedGameSlug, setSelectedGameSlug] = useState('word');
    const [puzzles, setPuzzles] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [payloadText, setPayloadText] = useState('');
    const [solutionText, setSolutionText] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const g = await api.adminGames.getAll();
            setGames(g);
            if (g.length > 0 && !selectedGameSlug) {
                setSelectedGameSlug(g[0].slug);
            }
        } catch (e) {
            toast.error('Грешка: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadPuzzles = async (slug) => {
        setLoading(true);
        try {
            const p = await api.adminGames.getPuzzles(slug);
            setPuzzles(p);
        } catch (e) {
            toast.error('Грешка: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedGameSlug) {
            loadPuzzles(selectedGameSlug);
        }
    }, [selectedGameSlug]);

    const handleCreateNew = () => {
        setEditForm({
            puzzleDate: new Date().toISOString().split('T')[0],
            difficulty: 'medium',
            status: 'draft',
            editorNotes: ''
        });

        // Provide template based on slug
        if (selectedGameSlug === 'word') {
            setPayloadText(JSON.stringify({ wordLength: 5, maxAttempts: 6, keyboardLayout: 'bg' }, null, 2));
            setSolutionText(JSON.stringify({ answer: "ДУМА1" }, null, 2));
        } else if (selectedGameSlug === 'connections') {
            setPayloadText(JSON.stringify({
                items: ['А1', 'А2', 'А3', 'А4', 'Б1', 'Б2', 'Б3', 'Б4', 'В1', 'В2', 'В3', 'В4', 'Г1', 'Г2', 'Г3', 'Г4']
            }, null, 2));
            setSolutionText(JSON.stringify({
                groups: [
                    { label: 'ГРУПА А', difficulty: 1, items: ['А1', 'А2', 'А3', 'А4'], explanation: '' },
                    { label: 'ГРУПА Б', difficulty: 2, items: ['Б1', 'Б2', 'Б3', 'Б4'], explanation: '' },
                    { label: 'ГРУПА В', difficulty: 3, items: ['В1', 'В2', 'В3', 'В4'], explanation: '' },
                    { label: 'ГРУПА Г', difficulty: 4, items: ['Г1', 'Г2', 'Г3', 'Г4'], explanation: '' }
                ]
            }, null, 2));
        } else if (selectedGameSlug === 'quiz') {
            setPayloadText(JSON.stringify({
                questions: [
                    { question: "?", options: ["1", "2", "3", "4"], correctIndex: 0, explanation: "" }
                ]
            }, null, 2));
            setSolutionText("{}");
        }

        setIsEditing(true);
    };

    const handleEdit = (puzzle) => {
        setEditForm(puzzle);
        setPayloadText(JSON.stringify(puzzle.payload, null, 2));
        setSolutionText(JSON.stringify(puzzle.solution, null, 2));
        setIsEditing(true);
    };

    const handleSave = async () => {
        try {
            const payload = JSON.parse(payloadText);
            const solution = JSON.parse(solutionText);

            const dataToSave = {
                ...editForm,
                payload,
                solution
            };

            if (editForm.id) {
                await api.adminGames.updatePuzzle(selectedGameSlug, editForm.id, dataToSave);
                toast.success('Пъзелът е обновен!');
            } else {
                await api.adminGames.createPuzzle(selectedGameSlug, dataToSave);
                toast.success('Пъзелът е създаден!');
            }
            setIsEditing(false);
            loadPuzzles(selectedGameSlug);
        } catch (e) {
            toast.error('Грешка при запазване (невалиден JSON?): ' + e.message);
        }
    };

    const handlePublish = async (id) => {
        if (!window.confirm('Сигурни ли сте, че искате да публикувате този пъзел?')) return;
        try {
            await api.adminGames.publishPuzzle(selectedGameSlug, id);
            toast.success('Публикуван успешно!');
            loadPuzzles(selectedGameSlug);
        } catch (e) {
            toast.error('Грешка: ' + e.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Сигурни ли сте? Това действие е необратимо!')) return;
        try {
            await api.adminGames.deletePuzzle(selectedGameSlug, id);
            toast.success('Изтрит успешно!');
            loadPuzzles(selectedGameSlug);
        } catch (e) {
            toast.error('Грешка: ' + e.message);
        }
    };

    if (loading && games.length === 0) {
        return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 text-zn-purple animate-spin" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
                        <Puzzle className="w-6 h-6 text-zn-purple" />
                        Игрови Пъзели
                    </h1>
                    <p className="text-sm font-sans text-gray-500 mt-1">Добавяне и управление на ежедневните пъзели.</p>
                </div>

                <div className="flex gap-4">
                    <select
                        value={selectedGameSlug}
                        onChange={(e) => setSelectedGameSlug(e.target.value)}
                        className="border-gray-200 rounded p-2 text-sm font-sans font-bold uppercase tracking-wider text-gray-700 bg-white cursor-pointer"
                    >
                        {games.map(g => (
                            <option key={g.slug} value={g.slug}>{g.title}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-bold uppercase tracking-wider rounded hover:bg-zn-purple-dark transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Нов Пъзел
                    </button>
                </div>
            </div>

            {isEditing ? (
                <div className="bg-white border border-gray-200 p-6 flex flex-col gap-6 animate-in fade-in">
                    <h2 className="font-bold text-xl uppercase font-condensed">{editForm.id ? `Редакция пъзел #${editForm.id}` : 'Нов пъзел'}</h2>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Дата (YYYY-MM-DD)</label>
                            <input
                                type="text"
                                value={editForm.puzzleDate}
                                onChange={e => setEditForm({ ...editForm, puzzleDate: e.target.value })}
                                className="w-full border-gray-200 p-2 font-mono text-sm uppercase"
                                placeholder="2026-03-01"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Трудност</label>
                            <select
                                value={editForm.difficulty}
                                onChange={e => setEditForm({ ...editForm, difficulty: e.target.value })}
                                className="w-full border-gray-200 p-2 font-sans text-sm uppercase"
                            >
                                <option value="easy">Лесно</option>
                                <option value="medium">Средно</option>
                                <option value="hard">Трудно</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Payload (JSON)</label>
                            <textarea
                                value={payloadText}
                                onChange={e => setPayloadText(e.target.value)}
                                className="w-full border-gray-200 p-2 font-mono text-xs h-64 bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Solution (JSON)</label>
                            <textarea
                                value={solutionText}
                                onChange={e => setSolutionText(e.target.value)}
                                className="w-full border-gray-200 p-2 font-mono text-xs h-64 bg-gray-50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Бележки на редактора</label>
                        <input
                            type="text"
                            value={editForm.editorNotes || ''}
                            onChange={e => setEditForm({ ...editForm, editorNotes: e.target.value })}
                            className="w-full border-gray-200 p-2"
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-4 border-t pt-6">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold uppercase text-sm tracking-wider"
                        >
                            Отказ
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-black text-white font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-gray-800"
                        >
                            <Save className="w-4 h-4" /> Запази
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left font-sans text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs">Дата</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs">Статус</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs">Информация</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {puzzles.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">Още няма пъзели за тази игра.</td>
                                </tr>
                            ) : (
                                puzzles.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-mono font-bold">{p.puzzleDate}</td>
                                        <td className="px-6 py-4">
                                            {p.status === 'published' ? (
                                                <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded w-fit uppercase">
                                                    <Globe className="w-4 h-4" /> Публикуван
                                                </span>
                                            ) : p.status === 'archived' ? (
                                                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded w-fit uppercase">
                                                    <FileText className="w-4 h-4" /> Архив
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-xs font-bold text-yellow-700 bg-yellow-50 px-2 py-1 rounded w-fit uppercase">
                                                    <CheckCircle2 className="w-4 h-4" /> Чернова
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-xs">
                                            <p><span className="font-bold opacity-70">Diff:</span> {p.difficulty}</p>
                                            {p.editorNotes && <p className="italic mt-1 text-gray-400">"{p.editorNotes}"</p>}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            {p.status !== 'published' && (
                                                <button onClick={() => handlePublish(p.id)} className="text-green-600 hover:text-green-800 p-2" title="Публикувай">
                                                    <Globe className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button onClick={() => handleEdit(p)} className="text-gray-500 hover:text-blue-600 p-2" title="Редакция">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(p.id)} className="text-gray-500 hover:text-red-600 p-2" title="Изтрий">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
