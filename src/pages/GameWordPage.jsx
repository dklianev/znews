import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { loadGameProgress, saveGameProgress, recordGameWin, recordGameLoss } from '../utils/gameStorage';
import { getTodayStr } from '../utils/gameDate';
import WordGrid from '../components/games/word/WordGrid';
import WordKeyboard from '../components/games/word/WordKeyboard';
import { Loader2, ArrowLeft, Share2, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const GAME_SLUG = 'word';

export default function GameWordPage() {
    const [puzzle, setPuzzle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [guesses, setGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [gameStatus, setGameStatus] = useState('playing'); // playing, won, lost
    const [showHelp, setShowHelp] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Load puzzle
    useEffect(() => {
        api.games.getToday(GAME_SLUG)
            .then(data => {
                setPuzzle(data);
                const todayStr = getTodayStr();
                const saved = loadGameProgress(GAME_SLUG, todayStr);
                if (saved && saved.puzzleId === data.id) {
                    setGuesses(saved.guesses || []);
                    setGameStatus(saved.gameStatus || 'playing');
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Save progress automatically
    useEffect(() => {
        if (puzzle && guesses.length > 0) {
            const todayStr = getTodayStr();
            saveGameProgress(GAME_SLUG, todayStr, {
                puzzleId: puzzle.id,
                guesses,
                gameStatus
            });
        }
    }, [guesses, gameStatus, puzzle]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex justify-center items-center">
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (error || !puzzle) {
        return (
            <div className="min-h-screen bg-zinc-950 text-center py-20 px-4">
                <h1 className="text-3xl text-white mb-4">Няма наличен пъзел!</h1>
                <p className="text-zinc-400 mb-8">{error || 'Моля, опитайте по-късно.'}</p>
                <Link to="/games" className="text-emerald-500 hover:text-emerald-400">← Обратно към всички игри</Link>
            </div>
        );
    }

    const { payload } = puzzle;
    const wordLength = payload?.wordLength || 5;
    const maxAttempts = payload?.maxAttempts || 6;

    const onChar = (char) => {
        if (gameStatus !== 'playing' || isProcessing) return;
        if (currentGuess.length < wordLength) {
            setCurrentGuess(prev => prev + char);
        }
    };

    const onDelete = () => {
        if (gameStatus !== 'playing' || isProcessing) return;
        setCurrentGuess(prev => prev.slice(0, -1));
    };

    const onEnter = async () => {
        if (gameStatus !== 'playing' || isProcessing) return;
        if (currentGuess.length !== wordLength) return;

        setIsProcessing(true);
        try {
            const res = await api.games.validate(GAME_SLUG, getTodayStr(), { guess: currentGuess });

            const newGuessObj = res.evaluated; // Array of {letter, status}
            const newGuesses = [...guesses, newGuessObj];
            setGuesses(newGuesses);
            setCurrentGuess('');

            if (res.isWin) {
                setGameStatus('won');
                recordGameWin(GAME_SLUG, getTodayStr());
            } else if (newGuesses.length >= maxAttempts) {
                setGameStatus('lost');
                recordGameLoss(GAME_SLUG, getTodayStr());
            }
        } catch (e) {
            alert("Грешка при валидация: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const generateShareText = () => {
        let text = `zNews Дума на деня - ${getTodayStr()}\n`;
        text += `${gameStatus === 'won' ? guesses.length : 'X'}/${maxAttempts}\n\n`;
        guesses.forEach(row => {
            row.forEach(l => {
                if (l.status === 'correct') text += '🟩';
                else if (l.status === 'present') text += '🟨';
                else text += '⬛';
            });
            text += '\n';
        });
        return text;
    };

    const handleShare = () => {
        const text = generateShareText();
        navigator.clipboard.writeText(text).then(() => alert('Резултатът е копиран!'));
    };

    // Keyboard statuses
    const keyStatuses = {};
    guesses.flat().forEach(({ letter, status }) => {
        if (status === 'correct') keyStatuses[letter] = 'correct';
        if (status === 'present' && keyStatuses[letter] !== 'correct') keyStatuses[letter] = 'present';
        if (status === 'absent' && !keyStatuses[letter]) keyStatuses[letter] = 'absent';
    });

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center pb-[10vh]">
            <header className="w-full max-w-lg flex items-center justify-between p-4 border-b border-zinc-900 mb-8">
                <Link to="/games" className="text-zinc-500 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-xl font-black uppercase tracking-widest text-white font-condensed">Думата на деня</h1>
                <button onClick={() => setShowHelp(true)} className="text-zinc-500 hover:text-white transition-colors">
                    <HelpCircle className="w-6 h-6" />
                </button>
            </header>

            <main className="flex-1 w-full max-w-lg flex flex-col justify-center px-4">
                <WordGrid
                    guesses={guesses}
                    currentGuess={currentGuess}
                    wordLength={wordLength}
                    maxAttempts={maxAttempts}
                />

                {gameStatus !== 'playing' && (
                    <div className="w-full max-w-sm mx-auto mb-6 p-6 bg-zinc-900 rounded-2xl border border-zinc-800 text-center animate-in fade-in zoom-in">
                        <h2 className="text-3xl font-black mb-2 uppercase text-white font-condensed">
                            {gameStatus === 'won' ? 'Поздравления!' : 'Опитай пак утре!'}
                        </h2>
                        <p className="text-zinc-400 mb-6 font-medium">
                            {gameStatus === 'won'
                                ? `Успя от ${guesses.length} опит${guesses.length > 1 ? 'а' : ''}.`
                                : 'Не успя да познаеш думата днес.'}
                        </p>
                        <button
                            onClick={handleShare}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors uppercase tracking-widest"
                        >
                            <Share2 className="w-5 h-5" />
                            Сподели
                        </button>
                    </div>
                )}

            </main>

            <div className="w-full mt-auto">
                <WordKeyboard
                    onChar={onChar}
                    onDelete={onDelete}
                    onEnter={onEnter}
                    statuses={keyStatuses}
                />
            </div>

            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
                    <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black mb-4 text-white uppercase font-condensed">Как се играе</h2>
                        <p className="text-zinc-300 mb-6 text-sm">Познай думата на деня от 6 опита. След всеки опит цветът на плочките ще се промени, за да покаже колко си близо.</p>
                        <div className="space-y-4 text-sm font-medium">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-600 text-white font-black text-xl flex flex-center items-center justify-center rounded">З</div>
                                <p className="text-zinc-400">Буквата е в думата и на точното място.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-yellow-600 text-white font-black text-xl flex flex-center items-center justify-center rounded">О</div>
                                <p className="text-zinc-400">Буквата е в думата, но на грешно място.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-zinc-800 text-zinc-500 font-black text-xl flex flex-center items-center justify-center rounded">К</div>
                                <p className="text-zinc-400">Буквата не е в думата.</p>
                            </div>
                        </div>
                        <button onClick={() => setShowHelp(false)} className="mt-8 w-full py-3 bg-white text-black font-bold hover:bg-zinc-200 transition-colors rounded-xl uppercase tracking-wider">Разбрах</button>
                    </div>
                </div>
            )}
        </div>
    );
}
