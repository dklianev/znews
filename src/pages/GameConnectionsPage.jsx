import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { loadGameProgress, saveGameProgress, recordGameWin, recordGameLoss } from '../utils/gameStorage';
import { getTodayStr } from '../utils/gameDate';
import ConnectionsBoard from '../components/games/connections/ConnectionsBoard';
import { Loader2, ArrowLeft, Share2, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const GAME_SLUG = 'connections';
const MAX_MISTAKES = 4;

export default function GameConnectionsPage() {
    const [puzzle, setPuzzle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [items, setItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [solvedGroups, setSolvedGroups] = useState([]);
    const [mistakesRemaining, setMistakesRemaining] = useState(MAX_MISTAKES);
    const [gameStatus, setGameStatus] = useState('playing'); // playing, won, lost

    const [showHelp, setShowHelp] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [oneAwayAlert, setOneAwayAlert] = useState(false);
    const [shakeTiles, setShakeTiles] = useState(false);

    // Load puzzle
    useEffect(() => {
        api.games.getToday(GAME_SLUG)
            .then(data => {
                setPuzzle(data);
                const todayStr = getTodayStr();
                const saved = loadGameProgress(GAME_SLUG, todayStr);

                let initialItems = data.payload?.items || [];
                // Shuffle initially if not saved
                if (!saved || saved.puzzleId !== data.id) {
                    initialItems = [...initialItems].sort(() => Math.random() - 0.5);
                }

                if (saved && saved.puzzleId === data.id) {
                    setItems(saved.items || initialItems);
                    setSolvedGroups(saved.solvedGroups || []);
                    setMistakesRemaining(saved.mistakesRemaining ?? MAX_MISTAKES);
                    setGameStatus(saved.gameStatus || 'playing');
                } else {
                    setItems(initialItems);
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Save progress automatically
    useEffect(() => {
        if (puzzle && (solvedGroups.length > 0 || mistakesRemaining < MAX_MISTAKES)) {
            saveGameProgress(GAME_SLUG, getTodayStr(), {
                puzzleId: puzzle.id,
                items,
                solvedGroups,
                mistakesRemaining,
                gameStatus
            });
        }
    }, [items, solvedGroups, mistakesRemaining, gameStatus, puzzle]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex justify-center items-center">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (error || !puzzle) {
        return (
            <div className="min-h-screen bg-zinc-950 text-center py-20 px-4">
                <h1 className="text-3xl text-white mb-4">Няма наличен пъзел!</h1>
                <p className="text-zinc-400 mb-8">{error || 'Моля, опитайте по-късно.'}</p>
                <Link to="/games" className="text-indigo-500 hover:text-indigo-400">← Обратно към всички игри</Link>
            </div>
        );
    }

    const toggleSelection = (item) => {
        if (gameStatus !== 'playing' || isProcessing) return;

        if (selectedItems.includes(item)) {
            setSelectedItems(prev => prev.filter(i => i !== item));
        } else if (selectedItems.length < 4) {
            setSelectedItems(prev => [...prev, item]);
        }
    };

    const shuffleItems = () => {
        setItems(prev => [...prev].sort(() => Math.random() - 0.5));
    };

    const deselectAll = () => {
        setSelectedItems([]);
    };

    const handleSubmit = async () => {
        if (selectedItems.length !== 4 || gameStatus !== 'playing' || isProcessing) return;

        setIsProcessing(true);
        setOneAwayAlert(false);

        try {
            const res = await api.games.validate(GAME_SLUG, getTodayStr(), { selection: selectedItems });

            if (res.correct) {
                // Win this group
                const newSolvedGroups = [...solvedGroups, res.group];
                setSolvedGroups(newSolvedGroups);

                // Remove items from board
                setItems(prev => prev.filter(i => !selectedItems.includes(i)));
                setSelectedItems([]);

                // Check overall win (4 groups)
                if (newSolvedGroups.length === 4) {
                    setGameStatus('won');
                    recordGameWin(GAME_SLUG, getTodayStr());
                }
            } else {
                // Wrong
                if (res.isOneAway) {
                    setOneAwayAlert(true);
                    setTimeout(() => setOneAwayAlert(false), 2000);
                }

                // Trigger shake
                setShakeTiles(true);
                setTimeout(() => setShakeTiles(false), 500);

                const newMistakes = mistakesRemaining - 1;
                setMistakesRemaining(newMistakes);

                if (newMistakes <= 0) {
                    setGameStatus('lost');
                    recordGameLoss(GAME_SLUG, getTodayStr());
                    // Ideally fetch solution to show the rest, but MVP: just show game over.
                }
            }
        } catch (e) {
            alert("Грешка при валидация: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const generateShareText = () => {
        let text = `zNews Връзки - ${getTodayStr()}\n`;
        text += `Останали опити: ${mistakesRemaining}\n\n`;
        // We could add emoji squares based on difficulty, but we don't track history of guesses MVP.
        // For MVP, just share a basic string.
        text += `Познати групи: ${solvedGroups.length}/4\n`;
        return text;
    };

    const handleShare = () => {
        navigator.clipboard.writeText(generateShareText()).then(() => alert('Резултатът е копиран!'));
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center pb-20">
            <header className="w-full max-w-2xl flex items-center justify-between p-4 border-b border-zinc-900 mb-8">
                <Link to="/games" className="text-zinc-500 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-xl font-black uppercase tracking-widest text-white font-condensed">Връзки</h1>
                <button onClick={() => setShowHelp(true)} className="text-zinc-500 hover:text-white transition-colors">
                    <HelpCircle className="w-6 h-6" />
                </button>
            </header>

            <main className="flex-1 w-full max-w-2xl flex flex-col px-4 relative">
                <p className="text-center text-zinc-400 mb-6 uppercase tracking-widest text-sm font-bold">
                    Създайте 4 групи по 4 думи
                </p>

                {oneAwayAlert && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 bg-zinc-800 text-white px-4 py-2 rounded-full font-bold text-sm shadow-xl z-20 animate-in fade-in slide-in-from-top-4">
                        На една дума от истината!
                    </div>
                )}

                <ConnectionsBoard
                    items={items}
                    selectedItems={selectedItems}
                    solvedGroups={solvedGroups}
                    onToggle={toggleSelection}
                    shakeTiles={shakeTiles}
                />

                {gameStatus === 'playing' ? (
                    <div className="mt-8 flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-zinc-500 text-sm uppercase tracking-wider font-bold">Останали опити:</span>
                            <div className="flex gap-1">
                                {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
                                    <div key={i} className={`w-3 h-3 rounded-full ${i < mistakesRemaining ? 'bg-indigo-500' : 'bg-zinc-800'}`} />
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={shuffleItems}
                                className="px-6 py-3 rounded-xl border border-zinc-700 text-white uppercase tracking-widest font-bold hover:bg-zinc-800 transition-colors"
                            >
                                Разбъркай
                            </button>
                            <button
                                onClick={deselectAll}
                                disabled={selectedItems.length === 0}
                                className="px-6 py-3 rounded-xl border border-zinc-700 text-white uppercase tracking-widest font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                            >
                                Изчисти
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={selectedItems.length !== 4 || isProcessing}
                                className={`px-8 py-3 rounded-xl font-bold uppercase tracking-widest transition-all ${selectedItems.length === 4 && !isProcessing
                                        ? 'bg-white text-black hover:bg-zinc-200'
                                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                                    }`}
                            >
                                Провери
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-sm mx-auto mt-8 p-6 bg-zinc-900 rounded-2xl border border-zinc-800 text-center animate-in fade-in zoom-in">
                        <h2 className="text-3xl font-black mb-2 uppercase text-white font-condensed">
                            {gameStatus === 'won' ? 'Гениално!' : 'Опитай пак утре!'}
                        </h2>
                        <button
                            onClick={handleShare}
                            className="flex items-center justify-center gap-2 w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors uppercase tracking-widest"
                        >
                            <Share2 className="w-5 h-5" />
                            Сподели
                        </button>
                    </div>
                )}
            </main>

            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
                    <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black mb-4 text-white uppercase font-condensed">Как се играе</h2>
                        <p className="text-zinc-300 mb-4 text-sm">Намери групите от 4 елемента, които имат нещо общо.</p>
                        <ul className="list-disc pl-5 text-sm text-zinc-400 space-y-2 mb-6">
                            <li>Избери 4 думи и натисни "Провери".</li>
                            <li>Общите черти са специфични (напр. "Риби", а не просто "Животни").</li>
                            <li>Имаш право на 4 грешки общо.</li>
                        </ul>
                        <button onClick={() => setShowHelp(false)} className="mt-4 w-full py-3 bg-white text-black font-bold hover:bg-zinc-200 transition-colors rounded-xl uppercase tracking-wider">Разбрах</button>
                    </div>
                </div>
            )}
        </div>
    );
}
