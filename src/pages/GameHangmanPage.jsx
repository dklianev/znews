import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Loader2, Share2, Sparkles, Target } from 'lucide-react';
import { api } from '../utils/api';
import { getTodayStr } from '../utils/gameDate';
import { loadGameProgress, recordGameLoss, recordGameWin, saveGameProgress } from '../utils/gameStorage';
import HangmanFigure from '../components/games/hangman/HangmanFigure';
import HangmanKeyboard from '../components/games/hangman/HangmanKeyboard';
import { applyHangmanReveal, createHangmanSlots, getHangmanKeyboardRows, isHangmanSolved, normalizeHangmanLetter } from '../utils/hangman';

const GAME_SLUG = 'hangman';

function buildLetterStatusMap(statuses) {
  return statuses && typeof statuses === 'object' ? statuses : {};
}

export default function GameHangmanPage() {
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [revealedSlots, setRevealedSlots] = useState([]);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [letterStatuses, setLetterStatuses] = useState({});
  const [gameStatus, setGameStatus] = useState('playing');
  const [revealAnswer, setRevealAnswer] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const displayError = error === 'No puzzle for today'
    ? 'Няма бесеница за днес. Провери пак по-късно.'
    : error;

  useEffect(() => {
    api.games.getToday(GAME_SLUG)
      .then((data) => {
        setPuzzle(data);
        const todayStr = getTodayStr();
        const saved = loadGameProgress(GAME_SLUG, todayStr);
        const initialSlots = createHangmanSlots(data?.payload?.answerLength || 0);

        if (saved && saved.puzzleId === data.id) {
          setGuessedLetters(Array.isArray(saved.guessedLetters) ? saved.guessedLetters : []);
          setRevealedSlots(Array.isArray(saved.revealedSlots) ? saved.revealedSlots : initialSlots);
          setWrongGuesses(Number.parseInt(saved.wrongGuesses, 10) || 0);
          setLetterStatuses(buildLetterStatusMap(saved.letterStatuses));
          setGameStatus(saved.gameStatus || 'playing');
          setRevealAnswer(String(saved.revealAnswer || ''));
        } else {
          setRevealedSlots(initialSlots);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!puzzle) return;
    if (guessedLetters.length === 0 && gameStatus === 'playing') return;
    saveGameProgress(GAME_SLUG, getTodayStr(), {
      puzzleId: puzzle.id,
      guessedLetters,
      revealedSlots,
      wrongGuesses,
      letterStatuses,
      gameStatus,
      revealAnswer,
    });
  }, [gameStatus, guessedLetters, letterStatuses, puzzle, revealAnswer, revealedSlots, wrongGuesses]);

  const payload = puzzle?.payload || {};
  const maxMistakes = payload.maxMistakes || 7;
  const answerLength = payload.answerLength || revealedSlots.length || 0;
  const keyboardRows = useMemo(() => getHangmanKeyboardRows(payload.keyboardLayout), [payload.keyboardLayout]);
  const mistakesRemaining = Math.max(0, maxMistakes - wrongGuesses);

  const handleGuess = async (rawValue) => {
    const letter = normalizeHangmanLetter(rawValue);
    if (!letter || !puzzle || gameStatus !== 'playing' || isProcessing) return;
    if (guessedLetters.includes(letter)) return;

    const nextGuessedLetters = [...guessedLetters, letter];
    setIsProcessing(true);
    try {
      const response = await api.games.validate(GAME_SLUG, getTodayStr(), {
        letter,
        guessedLetters: nextGuessedLetters,
      });

      const nextStatuses = {
        ...letterStatuses,
        [letter]: response.isCorrect ? 'correct' : 'miss',
      };
      const nextRevealedSlots = response.isCorrect
        ? applyHangmanReveal(revealedSlots, letter, response.positions)
        : revealedSlots;
      const nextWrongGuesses = response.isCorrect ? wrongGuesses : wrongGuesses + 1;

      setGuessedLetters(nextGuessedLetters);
      setLetterStatuses(nextStatuses);
      setRevealedSlots(nextRevealedSlots);
      setWrongGuesses(nextWrongGuesses);

      if (response.isWin || isHangmanSolved(nextRevealedSlots)) {
        setGameStatus('won');
        recordGameWin(GAME_SLUG, getTodayStr());
        return;
      }

      if (!response.isCorrect && nextWrongGuesses >= maxMistakes) {
        setGameStatus('lost');
        recordGameLoss(GAME_SLUG, getTodayStr());
        const reveal = await api.games.validate(GAME_SLUG, getTodayStr(), { action: 'reveal-answer' });
        setRevealAnswer(String(reveal?.answer || ''));
      }
    } catch (e) {
      alert('Грешка при проверка: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (gameStatus !== 'playing' || showHelp) return undefined;

    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const letter = normalizeHangmanLetter(event.key);
      if (!letter) return;
      event.preventDefault();
      handleGuess(letter);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameStatus, guessedLetters, handleGuess, isProcessing, showHelp]);

  const shareText = useMemo(() => {
    const emojiTrail = guessedLetters.map((letter) => (letterStatuses[letter] === 'correct' ? '🟧' : '⬛')).join('');
    return `zNews Бесеница - ${getTodayStr()}\n${gameStatus === 'won' ? `${wrongGuesses}/${maxMistakes}` : `X/${maxMistakes}`}\n${emojiTrail}`;
  }, [gameStatus, guessedLetters, letterStatuses, maxMistakes, wrongGuesses]);

  const handleShare = () => {
    navigator.clipboard.writeText(shareText).then(() => alert('Резултатът е копиран.'));
  };

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
          <h1 className="text-3xl text-slate-900 dark:text-white mb-4 font-black uppercase font-condensed">Няма активна игра</h1>
          <p className="text-slate-500 dark:text-zinc-400 mb-8">{displayError || 'Възникна неочаквана грешка.'}</p>
          <Link to="/games" className="text-orange-600 hover:text-orange-500 font-bold">Към всички игри</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 text-slate-900 dark:text-white pb-20">
      <header className="w-full border-b border-stone-200 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur mb-8">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between p-4">
          <Link to="/games" className="text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-black uppercase tracking-widest font-condensed">Бесеница</h1>
          <button onClick={() => setShowHelp(true)} className="text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <HelpCircle className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-8">
        <section className="rounded-[36px] border border-orange-100/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.28),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(255,247,237,0.92))] p-6 shadow-[0_40px_90px_rgba(251,146,60,0.14)] dark:border-orange-950/40 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_36%),linear-gradient(135deg,_rgba(24,24,27,0.98),_rgba(9,9,11,0.98))] dark:shadow-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-orange-700 dark:text-orange-300">Дневна загадка</p>
              <h2 className="mt-3 text-4xl font-black uppercase font-condensed">Уцели думата, преди да изгориш всички шансове</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
                {payload.hint || 'След всяка грешна буква фигурката се приближава към финала. Ползвай подсказката и мисли стратегически.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-orange-700 dark:border-orange-900 dark:bg-zinc-900 dark:text-orange-300">{payload.category || 'Категория'}</span>
              <span className="rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">{getTodayStr()}</span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-4">
            <HangmanFigure mistakes={wrongGuesses} maxMistakes={maxMistakes} />
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[28px] border border-stone-200 bg-white/90 p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-400 dark:text-zinc-500">Остават</p>
                <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{mistakesRemaining}</p>
              </div>
              <div className="rounded-[28px] border border-stone-200 bg-white/90 p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-400 dark:text-zinc-500">Опитани</p>
                <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{guessedLetters.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[36px] border border-stone-200 bg-white/90 p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
            <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-[0.32em] text-slate-400 dark:text-zinc-500">
              <span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-orange-500" /> {answerLength} букви</span>
              <span className="inline-flex items-center gap-2"><Target className="w-4 h-4 text-emerald-500" /> {maxMistakes} шанса</span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {revealedSlots.map((letter, index) => (
                <div key={`slot-${index}`} className="flex h-16 w-14 items-center justify-center rounded-[22px] border border-stone-200 bg-stone-50 text-2xl font-black uppercase shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
                  {letter || ''}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[28px] border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm text-orange-950 dark:border-orange-950/40 dark:bg-orange-950/20 dark:text-orange-100">
              <p className="font-black uppercase tracking-[0.25em] text-[11px]">Подсказка</p>
              <p className="mt-2 leading-6">{payload.hint || 'Няма допълнителна подсказка за тази игра.'}</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {guessedLetters.length === 0 ? (
                <span className="text-sm text-slate-500 dark:text-zinc-400">Още няма избрани букви.</span>
              ) : guessedLetters.map((letter) => (
                <span key={letter} className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.25em] ${letterStatuses[letter] === 'correct' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200'}`}>
                  {letter}
                </span>
              ))}
            </div>

            {gameStatus !== 'playing' && (
              <div className="mt-8 rounded-[32px] border border-stone-200 bg-stone-50/80 p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-3xl font-black uppercase font-condensed">{gameStatus === 'won' ? 'Поздравления!' : 'Кръгът приключи'}</h3>
                <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
                  {gameStatus === 'won'
                    ? `Реши бесеницата с ${wrongGuesses} грешки.`
                    : `Думата беше ${revealAnswer || 'скрита'} .`}
                </p>
                <button onClick={handleShare} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-orange-500">
                  <Share2 className="w-4 h-4" /> Сподели
                </button>
              </div>
            )}
          </div>
        </section>

        <HangmanKeyboard rows={keyboardRows} statuses={letterStatuses} disabled={gameStatus !== 'playing' || isProcessing} onGuess={handleGuess} />
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-black/80 px-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 p-6 rounded-2xl max-w-sm w-full shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-2xl font-black mb-4 text-slate-900 dark:text-white uppercase font-condensed">Как се играе</h2>
            <p className="text-slate-600 dark:text-zinc-300 mb-4 text-sm">Избираш букви една по една. Всяка грешка добавя още един сегмент към фигурата.</p>
            <ul className="list-disc pl-5 text-sm text-slate-500 dark:text-zinc-400 space-y-2 mb-6">
              <li>Търси модели в категорията и подсказката.</li>
              <li>Можеш да използваш и физическата клавиатура.</li>
              <li>Играта приключва при пълна дума или когато изчерпиш шансовете.</li>
            </ul>
            <button onClick={() => setShowHelp(false)} className="mt-4 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors rounded-xl uppercase tracking-wider">Затвори</button>
          </div>
        </div>
      )}
    </div>
  );
}
