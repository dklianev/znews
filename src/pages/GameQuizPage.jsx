import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { loadGameProgress, saveGameProgress, recordGameWin, recordGameLoss } from '../utils/gameStorage';
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
            <div className="min-h-screen bg-zinc-950 flex justify-center items-center">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
            </div>
        );
    }

    if (error || !puzzle) {
        return (
            <div className="min-h-screen bg-zinc-950 text-center py-20 px-4">
                <h1 className="text-3xl text-white mb-4">Няма наличен куиз!</h1>
                <p className="text-zinc-400 mb-8">{error || 'Моля, опитайте по-късно.'}</p>
                <Link to="/games" className="text-orange-500 hover:text-orange-400">← Обратно към всички игри</Link>
            </div>
        );
    }

    const questions = puzzle.payload?.questions || [];
    const totalQ = questions.length;

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

            const isPerfect = answers.every((a, i) => a === questions[i].correctIndex);
            if (isPerfect) recordGameWin(GAME_SLUG, getTodayStr());
            else recordGameLoss(GAME_SLUG, getTodayStr()); // Technically quiz is always "played", win = perfect score.
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

    const handleShare = () => {
        navigator.clipboard.writeText(generateShareText()).then(() => alert('Резултатът е копиран!'));
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center pb-20">
            <header className="w-full max-w-2xl flex items-center justify-between p-4 border-b border-zinc-900 mb-8">
                <Link to="/games" className="text-zinc-500 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-xl font-black uppercase tracking-widest text-white font-condensed">Новинарски Куиз</h1>
                <button onClick={() => setShowHelp(true)} className="text-zinc-500 hover:text-white transition-colors">
                    <HelpCircle className="w-6 h-6" />
                </button>
            </header>

            <main className="flex-1 w-full flex flex-col items-center px-4">
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
                    <div className="w-full max-w-md mx-auto p-8 bg-zinc-900 rounded-2xl border border-zinc-800 text-center animate-in fade-in zoom-in h-auto">
                        <h2 className="text-4xl font-black mb-2 uppercase text-white font-condensed">Завършен!</h2>
                        <div className="text-6xl font-black text-orange-500 my-8">
                            {getScore()}<span className="text-3xl text-zinc-500">/{totalQ}</span>
                        </div>
                        <p className="text-zinc-400 mb-8 text-lg font-medium">
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
                    </div>
                )}
            </main>

            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
                    <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black mb-4 text-white uppercase font-condensed">Как се играе</h2>
                        <p className="text-zinc-300 mb-4 text-sm">Провери колко добре познаваш събитията около теб през последната седмица.</p>
                        <ul className="list-disc pl-5 text-sm text-zinc-400 space-y-2 mb-6">
                            <li>Отговори на въпросите от текущия ден.</li>
                            <li>Веднага след отговора ще видиш дали е правилен и кратко обяснение.</li>
                            <li>След края можеш да споделиш своя резултат с приятели.</li>
                        </ul>
                        <button onClick={() => setShowHelp(false)} className="mt-4 w-full py-3 bg-white text-black font-bold hover:bg-zinc-200 transition-colors rounded-xl uppercase tracking-wider">Разбрах</button>
                    </div>
                </div>
            )}
        </div>
    );
}
