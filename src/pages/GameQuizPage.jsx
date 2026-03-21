import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { copyToClipboard } from '../utils/copyToClipboard';
import { loadGameProgress, saveGameProgress, recordGameWin } from '../utils/gameStorage';
import { getTodayStr } from '../utils/gameDate';
import QuizQuestionCard from '../components/games/quiz/QuizQuestionCard';
import { Loader2, ArrowLeft, Share2, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const GAME_SLUG = 'quiz';

export default function GameQuizPage() {
    const [puzzle, setPuzzle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState([]); // stores the index chosen
    const [gameStatus, setGameStatus] = useState('playing'); // playing, completed

    const [showHelp, setShowHelp] = useState(false);
    const [shareNotice, setShareNotice] = useState(null);
    const displayError = error === 'No puzzle for today'
        ? 'Днешният куиз още е в подготовка. Провери отново малко по-късно.'
        : error;

    // Load puzzle
    useEffect(() => {
        api.games.getToday(GAME_SLUG)
            .then(data => {
                setPuzzle(data);
                const todayStr = getTodayStr();
                const saved = loadGameProgress(GAME_SLUG, todayStr);

                if (saved && saved.puzzleId === data.id) {
                    setCurrentQ(saved.currentQ || 0);
                    setAnswers(saved.answers || []);
                    setGameStatus(saved.gameStatus || 'playing');
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Save progress automatically
    useEffect(() => {
        if (puzzle && answers.length > 0) {
            saveGameProgress(GAME_SLUG, getTodayStr(), {
                puzzleId: puzzle.id,
                currentQ,
                answers,
                gameStatus
            });
        }
    }, [currentQ, answers, gameStatus, puzzle]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 flex justify-center items-center">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            </div>
        );
    }

    if (error || !puzzle) {
        return (
            <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 text-center py-20 px-4">
                <div className="max-w-xl mx-auto rounded-[28px] border border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900 p-10 shadow-xl">
                    <h1 className="text-3xl text-slate-900 dark:text-white mb-4 font-black uppercase font-condensed">Няма наличен куиз</h1>
                    <p className="text-slate-500 dark:text-zinc-400 mb-8">{displayError || 'Моля, опитайте по-късно.'}</p>
                    <Link to="/games" className="text-orange-600 hover:text-orange-500 font-bold">← Обратно към всички игри</Link>
                </div>
            </div>
        );
    }

    const questions = puzzle.payload?.questions || [];
    const totalQ = questions.length;

    if (totalQ === 0) {
        return (
            <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 text-center py-20 px-4">
                <div className="max-w-xl mx-auto rounded-[28px] border border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900 p-10 shadow-xl">
                    <h1 className="text-3xl text-slate-900 dark:text-white mb-4 font-black uppercase font-condensed">Куизът още не е готов</h1>
                    <p className="text-slate-500 dark:text-zinc-400 mb-8">Липсват въпроси за днешната игра.</p>
                    <Link to="/games" className="text-orange-600 hover:text-orange-500 font-bold">← Обратно към всички игри</Link>
                </div>
            </div>
        );
    }

    const handleSelectOption = (index) => {
        if (gameStatus !== 'playing') return;
        const newAnswers = [...answers];
        newAnswers[currentQ] = index;
        setAnswers(newAnswers);
    };

    const handleNext = () => {
        if (currentQ < totalQ - 1) {
            setCurrentQ(prev => prev + 1);
        } else {
            setGameStatus('completed');
            // Quiz completion counts as the daily result even when the score is not perfect.
            recordGameWin(GAME_SLUG, getTodayStr());
        }
    };

    const getScore = () => {
        return answers.reduce((acc, ans, idx) => {
            return acc + (ans === questions[idx].correctIndex ? 1 : 0);
        }, 0);
    };

    const generateShareText = () => {
        let text = `zNews Куиз - ${getTodayStr()}\n`;
        const score = getScore();
        text += `Резултат: ${score}/${totalQ}\n\n`;

        // Emoji breakdown
        answers.forEach((ans, idx) => {
            text += ans === questions[idx].correctIndex ? '🟩' : '🟥';
        });
        return text;
    };

    const handleShare = async () => {
        const copied = await copyToClipboard(generateShareText());
        setShareNotice(copied
            ? { tone: 'success', message: 'Резултатът е копиран!' }
            : { tone: 'error', message: 'Не успях да копирам резултата.' });
    };

    return (
        <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 text-slate-900 dark:text-white flex flex-col items-center pb-20">
            <header className="w-full border-b border-stone-200 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur mb-8">
                <div className="w-full max-w-4xl mx-auto flex items-center justify-between p-4">
                    <Link to="/games" className="text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-xl font-black uppercase tracking-widest font-condensed">Новинарски Куиз</h1>
                    <button onClick={() => setShowHelp(true)} className="text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <HelpCircle className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <main className="flex-1 w-full max-w-4xl flex flex-col items-center px-4">
                <div className="mb-8 w-full rounded-[28px] border border-orange-100 dark:border-orange-900/30 bg-white/90 dark:bg-zinc-900 p-6 shadow-lg">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.35em] text-orange-700 dark:text-orange-400">Ежедневен куиз</p>
                            <h2 className="mt-3 text-3xl font-black font-condensed uppercase">Провери колко следиш новините</h2>
                            <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">Отговори на въпросите за деня и сподели резултата си.</p>
                        </div>
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">{getTodayStr()}</p>
                    </div>
                </div>
                {gameStatus === 'playing' ? (
                    <QuizQuestionCard
                        question={questions[currentQ]}
                        currentQ={currentQ}
                        totalQ={totalQ}
                        selectedOption={answers[currentQ] !== undefined ? answers[currentQ] : null}
                        onSelectOption={handleSelectOption}
                        onNext={handleNext}
                    />
                ) : (
                    <div className="w-full max-w-md mx-auto p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 text-center animate-in fade-in zoom-in h-auto shadow-lg">
                        <h2 className="text-4xl font-black mb-2 uppercase font-condensed">Завършен!</h2>
                        <div className="text-6xl font-black text-orange-500 my-8">
                            {getScore()}<span className="text-3xl text-slate-400 dark:text-zinc-500">/{totalQ}</span>
                        </div>
                        <p className="text-slate-500 dark:text-zinc-400 mb-8 text-lg font-medium">
                            {getScore() === totalQ
                                ? 'Перфектен резултат! Ти си истински познавач.'
                                : getScore() >= totalQ / 2
                                    ? 'Добър резултат. Следиш новините!'
                                    : 'Има какво да се желае. Чети повече zNews!'}
                        </p>
                        <button
                            onClick={handleShare}
                            className="flex items-center justify-center gap-2 w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black transition-colors uppercase tracking-widest"
                        >
                            <Share2 className="w-5 h-5" />
                            Сподели
                        </button>
                        {shareNotice && (
                            <p className={`mt-3 text-sm font-bold ${shareNotice.tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {shareNotice.message}
                            </p>
                        )}
                    </div>
                )}
            </main>

            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-black/80 px-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black mb-4 text-slate-900 dark:text-white uppercase font-condensed">Как се играе</h2>
                        <p className="text-slate-600 dark:text-zinc-300 mb-4 text-sm">Провери колко добре познаваш събитията около теб през последната седмица.</p>
                        <ul className="list-disc pl-5 text-sm text-slate-500 dark:text-zinc-400 space-y-2 mb-6">
                            <li>Отговори на въпросите от текущия ден.</li>
                            <li>Веднага след отговора ще видиш дали е правилен и кратко обяснение.</li>
                            <li>След края можеш да споделиш своя резултат с приятели.</li>
                        </ul>
                        <button onClick={() => setShowHelp(false)} className="mt-4 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors rounded-xl uppercase tracking-wider">Разбрах</button>
                    </div>
                </div>
            )}
        </div>
    );
}
