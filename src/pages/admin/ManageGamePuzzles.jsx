import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Edit2, FileText, Globe, Loader2, Plus, Puzzle, Sparkles, Trash2, Wand2 } from 'lucide-react';
import GamePuzzleEditor from '../../components/admin/GamePuzzleEditor';
import { useToast } from '../../components/admin/Toast';
import { api } from '../../utils/api';
import { getTodayStr } from '../../utils/gameDate';
import { createGamePuzzleTemplate, GAME_EDITOR_GUIDES } from '../../../shared/gamePuzzleTemplates.js';
import { hasGamePlaceholderContent } from '../../../shared/gamePlaceholderWarnings.js';
import { getCrosswordEntries } from '../../../shared/crossword.js';

const PUZZLE_MANAGED_GAME_SLUGS = new Set(['word', 'connections', 'quiz', 'hangman', 'crossword']);
const CROSSWORD_SIZE_MIN = 3;
const CROSSWORD_SIZE_MAX = 12;
const CROSSWORD_CHAR_PATTERN = /^[\p{L}\p{N}\?]$/u;

function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function addDays(dateStr, offsetDays) {
    const [year, month, day] = String(dateStr || getTodayStr()).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

function isValidPuzzleDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function getPuzzleDurationDays(startDate, endDate) {
    if (!isValidPuzzleDate(startDate)) return 1;
    const safeEndDate = isValidPuzzleDate(endDate) && endDate >= startDate ? endDate : startDate;
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = safeEndDate.split('-').map(Number);
    const diffMs = Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay);
    return Math.max(1, Math.round(diffMs / 86400000) + 1);
}

function normalizePuzzleActiveUntilDate(startDate, endDate) {
    const safeStartDate = isValidPuzzleDate(startDate) ? startDate : getTodayStr();
    if (!isValidPuzzleDate(endDate) || endDate < safeStartDate) return safeStartDate;
    return endDate;
}

function syncPuzzleScheduleState(draft) {
    if (!draft || typeof draft !== 'object') return draft;
    const puzzleDate = isValidPuzzleDate(draft.puzzleDate) ? draft.puzzleDate : getTodayStr();
    return {
        ...draft,
        puzzleDate,
        activeUntilDate: normalizePuzzleActiveUntilDate(puzzleDate, draft.activeUntilDate),
    };
}

function createQuestionTemplate(index) {
    return {
        question: `TODO: въпрос номер ${index + 1}`,
        options: ['TODO A', 'TODO B', 'TODO C', 'TODO D'],
        correctIndex: 0,
        explanation: '',
    };
}

function clampCrosswordSize(value) {
    return Math.max(CROSSWORD_SIZE_MIN, Math.min(CROSSWORD_SIZE_MAX, Number.parseInt(value, 10) || 5));
}

function syncCrosswordDraftState(draft) {
    if (!draft || draft.gameSlug !== 'crossword') return draft;

    const payload = draft.payload && typeof draft.payload === 'object' ? draft.payload : {};
    const solution = draft.solution && typeof draft.solution === 'object' ? draft.solution : {};
    const rawLayout = Array.isArray(payload.layout) ? payload.layout : [];
    const width = clampCrosswordSize(payload.width || rawLayout[0]?.length || 5);
    const height = clampCrosswordSize(payload.height || rawLayout.length || 5);

    const layout = Array.from({ length: height }, (_, rowIndex) => {
        const rowChars = Array.from(String(rawLayout[rowIndex] || '').toUpperCase());
        return Array.from({ length: width }, (_, colIndex) => (rowChars[colIndex] === '#' ? '#' : '.')).join('');
    });

    const rawGrid = Array.isArray(solution.grid) ? solution.grid : [];
    const normalizedGrid = layout.map((layoutRow, rowIndex) => {
        const rowChars = Array.from(String(rawGrid[rowIndex] || '').toUpperCase());
        return Array.from({ length: width }, (_, colIndex) => {
            if (layoutRow[colIndex] === '#') return '#';
            const value = rowChars[colIndex] || '?';
            return CROSSWORD_CHAR_PATTERN.test(value) ? value : '?';
        }).join('');
    });

    const clueSeedMap = {
        across: new Map(),
        down: new Map(),
    };

    ['across', 'down'].forEach((direction) => {
        (Array.isArray(payload?.clues?.[direction]) ? payload.clues[direction] : []).forEach((entry) => {
            if (!entry) return;
            clueSeedMap[direction].set(`${entry.row}:${entry.col}`, String(entry.clue || ''));
        });
    });

    const entries = getCrosswordEntries(layout);
    const clues = {
        across: entries.across.map((entry) => ({
            number: entry.number,
            row: entry.row,
            col: entry.col,
            length: entry.length,
            clue: clueSeedMap.across.get(`${entry.row}:${entry.col}`) || '',
        })),
        down: entries.down.map((entry) => ({
            number: entry.number,
            row: entry.row,
            col: entry.col,
            length: entry.length,
            clue: clueSeedMap.down.get(`${entry.row}:${entry.col}`) || '',
        })),
    };

    return {
        ...draft,
        payload: {
            ...payload,
            width,
            height,
            layout,
            clues,
        },
        solution: {
            ...solution,
            grid: normalizedGrid,
        },
    };
}

function normalizeDraftState(draft) {
    const normalizedDraft = syncPuzzleScheduleState(draft);
    if (!normalizedDraft || typeof normalizedDraft !== 'object') return normalizedDraft;
    if (normalizedDraft.gameSlug === 'crossword') return syncCrosswordDraftState(normalizedDraft);
    return normalizedDraft;
}

export default function ManageGamePuzzles() {
    const [games, setGames] = useState([]);
    const [selectedGameSlug, setSelectedGameSlug] = useState('word');
    const [puzzles, setPuzzles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bulkGenerating, setBulkGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [bulkConfig, setBulkConfig] = useState({
        startDate: addDays(getTodayStr(), 1),
        days: 30,
        allActiveGames: true,
        overwriteDrafts: false,
    });
    const toast = useToast();

    const selectedGame = useMemo(() => games.find((game) => game.slug === selectedGameSlug) || null, [games, selectedGameSlug]);
    const guide = GAME_EDITOR_GUIDES[selectedGameSlug];
    const activeGameSlugs = useMemo(() => games.filter((game) => game.active).map((game) => game.slug), [games]);
    const bulkTargetSlugs = bulkConfig.allActiveGames ? activeGameSlugs : (selectedGameSlug ? [selectedGameSlug] : []);

    const loadGames = async () => {
        const data = await api.adminGames.getAll();
        const items = (Array.isArray(data) ? data : [])
            .filter((game) => PUZZLE_MANAGED_GAME_SLUGS.has(String(game?.slug || '').toLowerCase()));
        setGames(items);
        if (items.length > 0 && !items.some((game) => game.slug === selectedGameSlug)) {
            setSelectedGameSlug(items[0].slug);
        } else if (items.length === 0) {
            setSelectedGameSlug('');
        }
        return items;
    };

    const loadPuzzles = async (slug) => {
        const data = await api.adminGames.getPuzzles(slug);
        setPuzzles(Array.isArray(data) ? data.map((item) => normalizeDraftState(item)) : []);
    };

    useEffect(() => {
        setLoading(true);
        loadGames()
            .then((items) => items[0]?.slug ? loadPuzzles(items[0].slug) : setPuzzles([]))
            .catch((e) => toast.error('Грешка при зареждане: ' + e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedGameSlug) return;
        setLoading(true);
        loadPuzzles(selectedGameSlug)
            .catch((e) => toast.error('Грешка: ' + e.message))
            .finally(() => setLoading(false));
    }, [selectedGameSlug]);

    const handleCreateNew = () => {
        setEditForm(normalizeDraftState({
            gameSlug: selectedGameSlug,
            ...cloneValue(createGamePuzzleTemplate(selectedGameSlug, addDays(getTodayStr(), 1))),
        }));
        setIsEditing(true);
    };

    const handleEdit = (puzzle) => {
        setEditForm(normalizeDraftState(cloneValue(puzzle)));
        setIsEditing(true);
    };

    const updateEditForm = (updater) => {
        setEditForm((current) => normalizeDraftState(typeof updater === 'function' ? updater(current) : updater));
    };

    const actions = {
        setTopLevelField: (field, value) => updateEditForm((current) => ({ ...current, [field]: value })),
        setPuzzleDate: (value) => updateEditForm((current) => {
            const nextPuzzleDate = isValidPuzzleDate(value) ? value : (current?.puzzleDate || getTodayStr());
            const currentStartDate = isValidPuzzleDate(current?.puzzleDate) ? current.puzzleDate : nextPuzzleDate;
            const currentEndDate = normalizePuzzleActiveUntilDate(currentStartDate, current?.activeUntilDate);
            const dayOffset = getPuzzleDurationDays(currentStartDate, currentEndDate) - 1;
            return {
                ...current,
                puzzleDate: nextPuzzleDate,
                activeUntilDate: addDays(nextPuzzleDate, dayOffset),
            };
        }),
        setActiveUntilDate: (value) => updateEditForm((current) => {
            const puzzleDate = isValidPuzzleDate(current?.puzzleDate) ? current.puzzleDate : getTodayStr();
            return {
                ...current,
                activeUntilDate: normalizePuzzleActiveUntilDate(puzzleDate, value),
            };
        }),
        applyPuzzleDuration: (days) => updateEditForm((current) => {
            const puzzleDate = isValidPuzzleDate(current?.puzzleDate) ? current.puzzleDate : getTodayStr();
            const safeDays = Math.max(1, Number.parseInt(days, 10) || 1);
            return {
                ...current,
                activeUntilDate: addDays(puzzleDate, safeDays - 1),
            };
        }),
        setPayloadField: (field, value) => updateEditForm((current) => ({ ...current, payload: { ...(current?.payload || {}), [field]: value } })),
        setSolutionField: (field, value) => updateEditForm((current) => ({ ...current, solution: { ...(current?.solution || {}), [field]: value } })),
        replacePayload: (payload) => updateEditForm((current) => ({ ...current, payload: cloneValue(payload || {}) })),
        replaceSolution: (solution) => updateEditForm((current) => ({ ...current, solution: cloneValue(solution || {}) })),
        setConnectionsItem: (index, value) => updateEditForm((current) => {
            const items = Array.isArray(current?.payload?.items) ? [...current.payload.items] : Array.from({ length: 16 }, () => '');
            items[index] = value;
            return { ...current, payload: { ...(current?.payload || {}), items } };
        }),
        setConnectionsGroupField: (groupIndex, field, value) => updateEditForm((current) => {
            const groups = Array.isArray(current?.solution?.groups) ? [...current.solution.groups] : [];
            const group = { ...(groups[groupIndex] || { items: ['', '', '', ''] }) };
            group[field] = value;
            groups[groupIndex] = group;
            return { ...current, solution: { ...(current?.solution || {}), groups } };
        }),
        setConnectionsGroupItem: (groupIndex, itemIndex, value) => updateEditForm((current) => {
            const groups = Array.isArray(current?.solution?.groups) ? [...current.solution.groups] : [];
            const group = { ...(groups[groupIndex] || { items: ['', '', '', ''] }) };
            const items = Array.isArray(group.items) ? [...group.items] : ['', '', '', ''];
            items[itemIndex] = value;
            group.items = items;
            groups[groupIndex] = group;
            return { ...current, solution: { ...(current?.solution || {}), groups } };
        }),
        setCrosswordDimensions: (width, height) => updateEditForm((current) => ({
            ...current,
            payload: {
                ...(current?.payload || {}),
                width: clampCrosswordSize(width),
                height: clampCrosswordSize(height),
            },
        })),
        toggleCrosswordLayoutCell: (rowIndex, colIndex) => updateEditForm((current) => {
            const payload = current?.payload || {};
            const layout = Array.isArray(payload.layout) ? payload.layout.map((row) => Array.from(String(row || ''))) : [];
            if (!layout[rowIndex]) return current;
            layout[rowIndex][colIndex] = layout[rowIndex][colIndex] === '#' ? '.' : '#';
            return {
                ...current,
                payload: {
                    ...payload,
                    layout: layout.map((row) => row.join('')),
                },
            };
        }),
        setCrosswordSolutionCell: (rowIndex, colIndex, value) => updateEditForm((current) => {
            const solutionGrid = Array.isArray(current?.solution?.grid) ? [...current.solution.grid] : [];
            const rowChars = Array.from(String(solutionGrid[rowIndex] || '').toUpperCase());
            const nextChar = Array.from(String(value || '').trim().toUpperCase())[0] || '?';
            rowChars[colIndex] = CROSSWORD_CHAR_PATTERN.test(nextChar) ? nextChar : '?';
            solutionGrid[rowIndex] = rowChars.join('');
            return {
                ...current,
                solution: {
                    ...(current?.solution || {}),
                    grid: solutionGrid,
                },
            };
        }),
        setCrosswordClue: (direction, row, col, clue) => updateEditForm((current) => {
            const payload = current?.payload || {};
            const nextClues = {
                ...(payload.clues || {}),
                [direction]: (Array.isArray(payload?.clues?.[direction]) ? payload.clues[direction] : []).map((entry) => (
                    entry.row === row && entry.col === col ? { ...entry, clue } : entry
                )),
            };
            return {
                ...current,
                payload: {
                    ...payload,
                    clues: nextClues,
                },
            };
        }),
        setQuizQuestionField: (questionIndex, field, value) => updateEditForm((current) => {
            const questions = Array.isArray(current?.payload?.questions) ? [...current.payload.questions] : [];
            const question = { ...(questions[questionIndex] || createQuestionTemplate(questionIndex)) };
            question[field] = value;
            questions[questionIndex] = question;
            return { ...current, payload: { ...(current?.payload || {}), questions } };
        }),
        setQuizOption: (questionIndex, optionIndex, value) => updateEditForm((current) => {
            const questions = Array.isArray(current?.payload?.questions) ? [...current.payload.questions] : [];
            const question = { ...(questions[questionIndex] || createQuestionTemplate(questionIndex)) };
            const options = Array.isArray(question.options) ? [...question.options] : ['', '', '', ''];
            options[optionIndex] = value;
            question.options = options;
            questions[questionIndex] = question;
            return { ...current, payload: { ...(current?.payload || {}), questions } };
        }),
        addQuizQuestion: () => updateEditForm((current) => {
            const questions = Array.isArray(current?.payload?.questions) ? [...current.payload.questions] : [];
            questions.push(createQuestionTemplate(questions.length));
            return { ...current, payload: { ...(current?.payload || {}), questions } };
        }),
        removeQuizQuestion: (questionIndex) => updateEditForm((current) => {
            const questions = Array.isArray(current?.payload?.questions) ? [...current.payload.questions] : [];
            if (questions.length <= 1) return current;
            questions.splice(questionIndex, 1);
            return { ...current, payload: { ...(current?.payload || {}), questions } };
        }),
    };

    const handleSave = async (formOverride) => {
        const draft = normalizeDraftState(formOverride ? cloneValue(formOverride) : editForm);
        if (!draft) return;
        const targetGameSlug = draft.gameSlug || selectedGameSlug;
        setSaving(true);
        try {
            if (draft.id) await api.adminGames.updatePuzzle(targetGameSlug, draft.id, draft);
            else await api.adminGames.createPuzzle(targetGameSlug, draft);
            toast.success(draft.id ? 'Пъзелът е обновен.' : 'Пъзелът е създаден.');
            setIsEditing(false);
            setEditForm(null);
            setSelectedGameSlug(targetGameSlug);
            await loadPuzzles(targetGameSlug);
        } catch (e) {
            toast.error('Грешка при запис: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleBulkGenerate = async () => {
        if (bulkTargetSlugs.length === 0) {
            toast.error('Няма избрани игри за генериране.');
            return;
        }
        setBulkGenerating(true);
        try {
            const result = await api.adminGames.bulkGenerate({
                startDate: bulkConfig.startDate,
                days: bulkConfig.days,
                overwriteDrafts: bulkConfig.overwriteDrafts,
                gameSlugs: bulkTargetSlugs,
            });
            toast.success(`Създадени: ${result.createdCount}, обновени: ${result.updatedCount}, пропуснати: ${result.skippedCount}.`);
            await loadPuzzles(selectedGameSlug);
        } catch (e) {
            toast.error('Грешка при генериране: ' + e.message);
        } finally {
            setBulkGenerating(false);
        }
    };

    const handlePublish = async (id) => {
        if (!window.confirm('Сигурни ли сте, че искате да публикувате този пъзел?')) return;
        try {
            await api.adminGames.publishPuzzle(selectedGameSlug, id);
            toast.success('Пъзелът е публикуван.');
            await loadPuzzles(selectedGameSlug);
        } catch (e) {
            toast.error('Грешка: ' + e.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Сигурни ли сте, че искате да изтриете този пъзел?')) return;
        try {
            await api.adminGames.deletePuzzle(selectedGameSlug, id);
            toast.success('Пъзелът е изтрит.');
            await loadPuzzles(selectedGameSlug);
        } catch (e) {
            toast.error('Грешка: ' + e.message);
        }
    };

    if (loading && games.length === 0) {
        return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 text-zn-purple animate-spin" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2"><Puzzle className="w-6 h-6 text-zn-purple" />Дневни пъзели</h1>
                        <p className="text-sm font-sans text-gray-500 mt-1">Daily game workflow за дума, бесеница, връзки, кръстословица и тест.</p>
                        <p className="text-xs font-sans text-gray-400 mt-1">Всички пъзели се съхраняват в `GamePuzzle` и минават през publish guard за placeholders.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select value={selectedGameSlug} disabled={isEditing} onChange={(e) => setSelectedGameSlug(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-sans font-bold uppercase tracking-wider text-gray-800 bg-white cursor-pointer min-w-[220px] shadow-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400">
                            {games.map((game) => <option key={game.slug} value={game.slug}>{game.title}</option>)}
                        </select>
                        <button onClick={handleCreateNew} disabled={!selectedGameSlug} className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-bold uppercase tracking-wider rounded hover:bg-zn-purple-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <Plus className="w-4 h-4" />Нов пъзел
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-zn-purple/10 text-zn-purple flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5" /></div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{guide?.title || selectedGame?.title || 'Избрана игра'}</h2>
                                <p className="text-sm text-gray-600 mt-1">{guide?.summary || selectedGame?.description}</p>
                            </div>
                        </div>
                        <ul className="mt-5 space-y-2 text-sm text-gray-600">
                            {(guide?.checklist || []).map((item) => <li key={item} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /><span>{item}</span></li>)}
                        </ul>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0"><Wand2 className="w-5 h-5" /></div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Масово генериране</h2>
                                <p className="text-sm text-gray-600 mt-1">Създава draft пъзели за следващи дни.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                                Генераторът използва template-и. След това всеки пъзел трябва да бъде довършен ръчно преди publish.
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Начална дата</span>
                                    <input type="date" value={bulkConfig.startDate} onChange={(e) => setBulkConfig((current) => ({ ...current, startDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                                </label>
                                <label className="block">
                                    <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Брой дни</span>
                                    <input type="number" min="1" max="62" value={bulkConfig.days} onChange={(e) => setBulkConfig((current) => ({ ...current, days: Number.parseInt(e.target.value, 10) || 30 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                                </label>
                            </div>
                            <label className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" checked={bulkConfig.allActiveGames} onChange={(e) => setBulkConfig((current) => ({ ...current, allActiveGames: e.target.checked }))} className="rounded border-gray-300" />Генерирай за всички активни игри</label>
                            <label className="flex items-center gap-3 text-sm text-gray-700"><input type="checkbox" checked={bulkConfig.overwriteDrafts} onChange={(e) => setBulkConfig((current) => ({ ...current, overwriteDrafts: e.target.checked }))} className="rounded border-gray-300" />Презапиши съществуващи draft пъзели</label>
                            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                                <p><span className="font-bold text-gray-900">Целеви игри:</span> {bulkTargetSlugs.length > 0 ? bulkTargetSlugs.join(', ') : 'Няма избрани игри'}</p>
                                <p className="mt-1">Непубликуваните placeholder-и остават блокирани за public режима.</p>
                            </div>
                            <button type="button" onClick={handleBulkGenerate} disabled={bulkGenerating || bulkTargetSlugs.length === 0} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-black text-white font-bold uppercase tracking-wider hover:bg-gray-800 disabled:opacity-50">
                                {bulkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}Генерирай draft-ове
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isEditing ? (
                <GamePuzzleEditor gameSlug={selectedGameSlug} editForm={editForm} guide={guide} saving={saving} onCancel={() => { setIsEditing(false); setEditForm(null); }} onSave={handleSave} actions={actions} />
            ) : (
                <div className="bg-white border border-gray-200 overflow-hidden shadow-sm rounded-2xl">
                    <table className="w-full text-left font-sans text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs">Дата</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs">Статус</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs">Детайли</th>
                                <th className="px-6 py-4 font-bold uppercase tracking-wider text-gray-500 text-xs text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="4" className="px-6 py-10 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />Зареждане...</td></tr>
                            ) : puzzles.length === 0 ? (
                                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">Още няма пъзели за тази игра. Създай нов или използвай масовото генериране.</td></tr>
                            ) : (
                                puzzles.map((puzzle) => {
                                    const hasPlaceholders = hasGamePlaceholderContent(selectedGameSlug, puzzle);
                                    const puzzleDurationDays = getPuzzleDurationDays(puzzle.puzzleDate, puzzle.activeUntilDate);
                                    return (
                                        <tr key={puzzle.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4">
                                                <p className="font-mono font-bold text-gray-900">{puzzle.puzzleDate}</p>
                                                <p className="text-xs text-gray-400 mt-1">{puzzle.activeUntilDate && puzzle.activeUntilDate !== puzzle.puzzleDate ? `до ${puzzle.activeUntilDate}` : 'еднодневен период'}</p>
                                                <p className="text-xs text-gray-400 mt-1">#{puzzle.id}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {puzzle.status === 'published'
                                                    ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full uppercase"><Globe className="w-4 h-4" />Публикуван</span>
                                                    : puzzle.status === 'archived'
                                                        ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full uppercase"><FileText className="w-4 h-4" />Архив</span>
                                                        : <span className="inline-flex items-center gap-1.5 text-xs font-bold text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full uppercase"><CheckCircle2 className="w-4 h-4" />Draft</span>}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-500">
                                                <p><span className="font-bold opacity-70">Трудност:</span> {puzzle.difficulty}</p>
                                                <p className="mt-2"><span className="font-bold opacity-70">Период:</span> {puzzleDurationDays} {puzzleDurationDays === 1 ? 'ден' : 'дни'}</p>
                                                {hasPlaceholders && <p className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-1 font-bold uppercase tracking-wide text-amber-700">Има TODO / placeholder</p>}
                                                {puzzle.editorNotes && <p className="italic mt-2 text-gray-400">“{puzzle.editorNotes}”</p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    {puzzle.status !== 'published' && <button onClick={() => handlePublish(puzzle.id)} disabled={hasPlaceholders} className="text-green-600 hover:text-green-800 p-2 disabled:text-gray-300 disabled:hover:text-gray-300" title={hasPlaceholders ? 'Премахни placeholder съдържанието преди publish' : 'Публикувай'}><Globe className="w-4 h-4" /></button>}
                                                    <button onClick={() => handleEdit(puzzle)} className="text-gray-500 hover:text-blue-600 p-2" title="Редактирай"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(puzzle.id)} className="text-gray-500 hover:text-red-600 p-2" title="Изтрий"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
