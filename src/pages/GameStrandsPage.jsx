import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, HelpCircle, Loader2, Share2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { api } from '../utils/api';
import { copyToClipboard } from '../utils/copyToClipboard';
import { loadGameProgress, recordGameWin, saveGameProgress } from '../utils/gameStorage';
import { STRANDS_TOTAL_CELLS, areCellsAdjacent, buildWordFromPath, getCellsAlongStraightPath } from '../../shared/strands.js';
import StrandsBoard from '../components/games/strands/StrandsBoard';
import StrandsHelpModal from '../components/games/strands/StrandsHelpModal';

const GAME_SLUG = 'strands';

function getFoundCoverageCount(foundAnswers) {
    const covered = new Set();
    (Array.isArray(foundAnswers) ? foundAnswers : []).forEach((answer) => {
        (Array.isArray(answer?.cells) ? answer.cells : []).forEach((cell) => covered.add(cell));
    });
    return covered.size;
}

export default function GameStrandsPage() {
    const [puzzle, setPuzzle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [foundAnswers, setFoundAnswers] = useState([]);
    const [currentPath, setCurrentPath] = useState([]);
    const [gameStatus, setGameStatus] = useState('playing');
    const [submitting, setSubmitting] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [statusNotice, setStatusNotice] = useState(null);
    const [shareNotice, setShareNotice] = useState(null);

    useEffect(() => {
        let cancelled = false;

        api.games.getToday(GAME_SLUG)
            .then((data) => {
                if (cancelled) return;
                setPuzzle(data);
                const scope = data?.puzzleDate || '';
                const saved = loadGameProgress(GAME_SLUG, scope);
                if (saved?.puzzleId === data?.id) {
                    const nextFoundAnswers = Array.isArray(saved.foundAnswers) ? saved.foundAnswers : [];
                    setFoundAnswers(nextFoundAnswers);
                    setGameStatus(saved.gameStatus === 'won' || getFoundCoverageCount(nextFoundAnswers) === STRANDS_TOTAL_CELLS ? 'won' : 'playing');
                }
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err?.message || 'Не успяхме да заредим днешните Нишки.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!puzzle) return;
        saveGameProgress(GAME_SLUG, puzzle.puzzleDate, {
            puzzleId: puzzle.id,
            foundAnswers,
            gameStatus,
        });
    }, [foundAnswers, gameStatus, puzzle]);

    const foundCellKinds = useMemo(() => {
        const nextMap = new Map();
        foundAnswers.forEach((answer) => {
            (Array.isArray(answer?.cells) ? answer.cells : []).forEach((cell) => {
                nextMap.set(cell, answer.kind);
            });
        });
        return nextMap;
    }, [foundAnswers]);

    const foundCoverageCount = useMemo(() => getFoundCoverageCount(foundAnswers), [foundAnswers]);
    const formingWord = useMemo(() => (
        puzzle?.payload?.grid && currentPath.length > 0
            ? buildWordFromPath(currentPath, puzzle.payload.grid)
            : ''
    ), [currentPath, puzzle?.payload?.grid]);

    useEffect(() => {
        if (!puzzle || gameStatus === 'won' || foundCoverageCount !== STRANDS_TOTAL_CELLS) return;
        setGameStatus('won');
        recordGameWin(GAME_SLUG, puzzle.puzzleDate);
        setStatusNotice({ tone: 'success', message: 'ДНЕШНИТЕ ИГРИ СА ПРИКЛЮЧЕНИ. Намери всички нишки!' });
    }, [foundCoverageCount, gameStatus, puzzle]);

    const startPath = (cellIndex) => {
        if (gameStatus !== 'playing' || submitting || foundCellKinds.has(cellIndex)) return;
        setStatusNotice(null);
        setCurrentPath([cellIndex]);
    };

    const extendPath = (cellIndex) => {
        if (gameStatus !== 'playing' || submitting || foundCellKinds.has(cellIndex)) return;
        setCurrentPath((previousPath) => {
            if (!Array.isArray(previousPath) || previousPath.length === 0) return previousPath;
            let nextPath = [...previousPath];
            const lastCell = nextPath[nextPath.length - 1];
            if (lastCell === cellIndex) return previousPath;

            const candidateCells = getCellsAlongStraightPath(lastCell, cellIndex);
            const cellsToApply = candidateCells.length > 0 ? candidateCells : [cellIndex];

            for (const nextCell of cellsToApply) {
                if (foundCellKinds.has(nextCell)) break;

                const currentLastCell = nextPath[nextPath.length - 1];
                if (currentLastCell === nextCell) continue;

                if (nextPath.length > 1 && nextPath[nextPath.length - 2] === nextCell) {
                    nextPath = nextPath.slice(0, -1);
                    continue;
                }

                if (nextPath.includes(nextCell) || !areCellsAdjacent(currentLastCell, nextCell)) {
                    break;
                }

                nextPath = [...nextPath, nextCell];
            }

            return nextPath;
        });
    };

    const finishPath = async () => {
        const path = Array.isArray(currentPath) ? currentPath : [];
        if (path.length < 3 || !puzzle || submitting || gameStatus !== 'playing') {
            setCurrentPath([]);
            return;
        }

        setSubmitting(true);
        try {
            const result = await api.games.validate(GAME_SLUG, puzzle.puzzleDate, { path });
            if (result?.accepted) {
                const answerKey = Array.isArray(result.cells) ? result.cells.join(',') : '';
                setFoundAnswers((previousAnswers) => {
                    if (previousAnswers.some((answer) => (Array.isArray(answer?.cells) ? answer.cells.join(',') : '') === answerKey)) {
                        return previousAnswers;
                    }
                    return [
                        ...previousAnswers,
                        {
                            kind: result.kind,
                            word: result.word,
                            cells: Array.isArray(result.cells) ? result.cells : [],
                        },
                    ];
                });
                setStatusNotice({
                    tone: result.kind === 'spangram' ? 'success' : 'info',
                    message: result.kind === 'spangram'
                        ? `Откри спанграмата: ${result.word}`
                        : `Намерена дума: ${result.word}`,
                });
            } else {
                setStatusNotice({
                    tone: 'error',
                    message: result?.word
                        ? `„${result.word}“ не е част от днешната тема.`
                        : 'Тази следа не влиза в днешните отговори.',
                });
            }
        } catch (err) {
            setStatusNotice({ tone: 'error', message: err?.message || 'Не успяхме да проверим следата.' });
        } finally {
            setCurrentPath([]);
            setSubmitting(false);
        }
    };

    const handleShare = async () => {
        if (!puzzle) return;
        const copied = await copyToClipboard([
            `zNews Нишки - ${puzzle.puzzleDate}`,
            puzzle.payload?.title || 'Дневна тема',
            `Открити клетки: ${foundCoverageCount}/${STRANDS_TOTAL_CELLS}`,
            gameStatus === 'won' ? 'Статус: Завършено' : 'Статус: В процес',
        ].join('\n'));

        setShareNotice(copied
            ? { tone: 'success', message: 'Резултатът е копиран.' }
            : { tone: 'error', message: 'Не успях да копирам резултата.' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-zn-purple" />
            </div>
        );
    }

    if (error || !puzzle) {
        return (
            <div className="min-h-screen bg-zn-paper px-4 py-20 text-center dark:bg-zinc-950">
                <div className="comic-panel mx-auto max-w-xl bg-white p-10 dark:bg-zinc-900">
                    <h1 className="text-3xl font-black uppercase font-display text-slate-900 dark:text-white">Нишките още се подреждат</h1>
                    <p className="mt-4 text-slate-600 dark:text-zinc-400">{error || 'Опитай отново след малко.'}</p>
                    <Link to="/games" className="btn-primary mt-8 inline-flex items-center justify-center px-5 py-3 text-sm font-black uppercase tracking-[0.24em]">
                        Обратно към игрите
                    </Link>
                </div>
            </div>
        );
    }

    const displayTitle = puzzle.payload?.title || 'Нишки';
    const displayDeck = puzzle.payload?.deck || 'Намери тематичните думи и открий нишката, която ги свързва.';
    const statusToneClass = statusNotice?.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200'
        : statusNotice?.tone === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-200'
            : 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-700/40 dark:bg-indigo-900/20 dark:text-indigo-200';

    return (
        <div className="min-h-screen bg-zn-paper pb-20 text-slate-900 dark:bg-zinc-950 dark:text-white">
            <header className="border-b border-stone-200 bg-white/80 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/80">
                <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
                    <Link to="/games" className="text-slate-500 transition-colors hover:text-slate-900 dark:text-zinc-500 dark:hover:text-white">
                        <ArrowLeft className="h-6 w-6" />
                    </Link>
                    <h1 className="text-xl font-black uppercase tracking-widest font-display">Нишки</h1>
                    <button type="button" onClick={() => setShowHelp(true)} className="text-slate-500 transition-colors hover:text-slate-900 dark:text-zinc-500 dark:hover:text-white">
                        <HelpCircle className="h-6 w-6" />
                    </button>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8">
                <section className="comic-panel comic-dots overflow-hidden bg-[linear-gradient(135deg,rgba(91,26,140,0.16),rgba(232,184,48,0.12),rgba(255,255,255,0.95))] p-6 dark:bg-[linear-gradient(135deg,rgba(91,26,140,0.28),rgba(232,184,48,0.18),rgba(24,24,27,0.96))]">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-zn-purple">Ежедневен борд</p>
                            <h2 className="mt-3 text-4xl font-black uppercase font-display leading-none text-slate-900 dark:text-white">{displayTitle}</h2>
                            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-700 dark:text-zinc-300">{displayDeck}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:min-w-[18rem]">
                            <div className="rounded-2xl border-2 border-[#1C1428] bg-white px-4 py-4 shadow-[4px_4px_0_#1C1428] dark:border-white/15 dark:bg-zinc-900 dark:shadow-none">
                                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">Прогрес</p>
                                <p className="mt-2 text-3xl font-black">{foundCoverageCount}/{STRANDS_TOTAL_CELLS}</p>
                            </div>
                            <div className="rounded-2xl border-2 border-[#1C1428] bg-white px-4 py-4 shadow-[4px_4px_0_#1C1428] dark:border-white/15 dark:bg-zinc-900 dark:shadow-none">
                                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">Статус</p>
                                <p className="mt-2 text-lg font-black uppercase">{gameStatus === 'won' ? 'Готово' : 'В игра'}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {statusNotice && (
                    <div className={`rounded-[22px] border px-5 py-4 text-sm font-bold ${statusToneClass}`}>
                        {statusNotice.message}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <section className="space-y-5">
                        <StrandsBoard
                            grid={puzzle.payload?.grid}
                            currentPath={currentPath}
                            foundCellKinds={foundCellKinds}
                            formingWord={formingWord}
                            disabled={submitting || gameStatus !== 'playing'}
                            onStartPath={startPath}
                            onExtendPath={extendPath}
                            onFinishPath={finishPath}
                        />

                        {gameStatus === 'won' && (
                            <div className="comic-panel comic-dots-red bg-white p-6 dark:bg-zinc-900">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        <CheckCircle2 className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-300">Финал</p>
                                        <h3 className="mt-2 text-3xl font-black uppercase font-display">ДНЕШНИТЕ ИГРИ СА ПРИКЛЮЧЕНИ</h3>
                                    </div>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-zinc-300">Намери всички тематични думи и спанграмата. Можеш да копираш резултата или да се върнеш към останалите игри.</p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <button type="button" onClick={handleShare} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-black uppercase tracking-[0.24em]">
                                        <Share2 className="h-4 w-4" />
                                        Копирай резултата
                                    </button>
                                    <Link to="/games" className="nav-pill inline-flex items-center px-5 py-3 text-sm font-black uppercase tracking-[0.24em]">
                                        Още игри
                                    </Link>
                                </div>
                                {shareNotice && (
                                    <p className={`mt-4 text-sm font-bold ${shareNotice.tone === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                                        {shareNotice.message}
                                    </p>
                                )}
                            </div>
                        )}
                    </section>

                    <aside className="space-y-5">
                        <div className="comic-panel bg-white p-5 dark:bg-zinc-900">
                            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-zn-purple">Открити думи</p>
                            <div className="mt-4 space-y-3">
                                {foundAnswers.length > 0 ? foundAnswers.map((answer) => (
                                    <div
                                        key={`${answer.kind}-${answer.word}`}
                                        className={`rounded-2xl border-2 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] ${answer.kind === 'spangram'
                                            ? 'border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-200'
                                            : 'border-indigo-300 bg-indigo-100 text-indigo-950 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-200'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span>{answer.word}</span>
                                            <span className="text-[10px] tracking-[0.22em] opacity-70">{answer.kind === 'spangram' ? 'СПАНГРАМА' : 'ТЕМА'}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm leading-6 text-slate-600 dark:text-zinc-400">Още няма намерени думи. Тръгни от която и да е буква и започни да свързваш следата.</p>
                                )}
                            </div>
                        </div>

                        <div className="comic-panel bg-white p-5 dark:bg-zinc-900">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zn-purple/10 text-zn-purple">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-zn-purple">Цел</p>
                                    <h3 className="mt-1 text-lg font-black uppercase font-display">Открий цялата тема</h3>
                                </div>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-zinc-300">Всичките 48 клетки участват точно веднъж. Когато бордът се запълни изцяло с намерени думи, дневният пъзел е решен.</p>
                        </div>
                    </aside>
                </div>
            </main>

            <StrandsHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
        </div>
    );
}
