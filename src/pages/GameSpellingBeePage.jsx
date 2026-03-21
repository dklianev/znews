import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crown, Delete, HelpCircle, Loader2, RefreshCcw, Send, Share2, Sparkles } from 'lucide-react';
import { api } from '../utils/api';
import { getTodayStr } from '../utils/gameDate';
import { loadGameProgress, recordGameWin, saveGameProgress } from '../utils/gameStorage';
import SpellingBeeHive from '../components/games/spellingbee/SpellingBeeHive';
import {
  SPELLING_BEE_RANKS,
  getSpellingBeeRank,
  getSpellingBeeWordScore,
  isSpellingBeePangram,
  normalizeSpellingBeeKeyboardInput,
  normalizeSpellingBeeLetter,
  normalizeSpellingBeeOuterLetters,
  normalizeSpellingBeeWord,
} from '../../shared/spellingBee.js';

const GAME_SLUG = 'spellingbee';
const NOTICE_TONE_CLASSNAMES = {
  info: 'border-sky-200 bg-sky-50/90 text-sky-950 shadow-[0_16px_36px_rgba(14,165,233,0.08)] dark:border-sky-950 dark:bg-sky-950/30 dark:text-sky-100 dark:shadow-none',
  success: 'border-emerald-200 bg-emerald-50/90 text-emerald-950 shadow-[0_16px_36px_rgba(16,185,129,0.08)] dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100 dark:shadow-none',
  warning: 'border-amber-200 bg-amber-50/95 text-amber-950 shadow-[0_16px_36px_rgba(245,158,11,0.08)] dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-100 dark:shadow-none',
  error: 'border-rose-200 bg-rose-50/95 text-rose-950 shadow-[0_16px_36px_rgba(244,63,94,0.08)] dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-100 dark:shadow-none',
};
const PRIMARY_ACTION_CLASS = 'inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400';
const SECONDARY_ACTION_CLASS = 'inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#151619] dark:text-zinc-100 dark:hover:bg-zinc-900';

function buildBeeNotice(reason, minWordLength) {
  if (reason === 'too-short') {
    return { type: 'warning', message: `Думите в Spelling Bee са поне ${minWordLength} букви.` };
  }
  if (reason === 'missing-center') {
    return { type: 'warning', message: 'Всяка дума трябва да съдържа централната буква.' };
  }
  if (reason === 'invalid-letter') {
    return { type: 'warning', message: 'Използвай само буквите от кошера.' };
  }
  if (reason === 'not-in-list') {
    return { type: 'info', message: 'Тази дума не е сред валидните решения за днешния кошер.' };
  }
  if (reason === 'duplicate') {
    return { type: 'info', message: 'Тази дума вече е открита.' };
  }
  return { type: 'error', message: 'Неуспешен опит. Провери думата и опитай пак.' };
}

function shuffleLetters(values) {
  const next = [...(Array.isArray(values) ? values : [])];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export default function GameSpellingBeePage() {
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentWord, setCurrentWord] = useState('');
  const [foundWords, setFoundWords] = useState([]);
  const [displayOuterLetters, setDisplayOuterLetters] = useState([]);
  const [notice, setNotice] = useState(null);
  const [gameStatus, setGameStatus] = useState('playing');
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLockRef = useRef(false);
  const puzzleRef = useRef(null);
  const currentWordRef = useRef('');
  const foundWordsRef = useRef([]);
  const gameStatusRef = useRef('playing');
  const centerLetterRef = useRef('');
  const outerLettersRef = useRef([]);
  const minWordLengthRef = useRef(4);
  const totalWordsRef = useRef(0);
  const maxScoreRef = useRef(0);

  const todayStr = getTodayStr();
  const displayError = error === 'No puzzle for today'
    ? 'Днешният кошер още не е публикуван. Провери пак по-късно.'
    : error;

  useEffect(() => {
    api.games.getToday(GAME_SLUG)
      .then((data) => {
        setPuzzle(data);
        const payload = data?.payload || {};
        setDisplayOuterLetters(normalizeSpellingBeeOuterLetters(payload.outerLetters));

        const saved = loadGameProgress(GAME_SLUG, todayStr);
        if (saved && saved.puzzleId === data.id) {
          setFoundWords(Array.isArray(saved.foundWords) ? saved.foundWords.map((word) => normalizeSpellingBeeWord(word)).filter(Boolean) : []);
          setCurrentWord(normalizeSpellingBeeWord(saved.currentWord || ''));
          setGameStatus(saved.gameStatus === 'won' ? 'won' : 'playing');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [todayStr]);

  const payload = puzzle?.payload || {};
  const centerLetter = normalizeSpellingBeeLetter(payload.centerLetter);
  const canonicalOuterLetters = useMemo(() => normalizeSpellingBeeOuterLetters(payload.outerLetters), [payload.outerLetters]);
  const outerLetters = displayOuterLetters.length === canonicalOuterLetters.length && displayOuterLetters.every(Boolean)
    ? displayOuterLetters
    : canonicalOuterLetters;
  const minWordLength = Math.max(4, Number.parseInt(payload.minWordLength, 10) || 4);
  const totalWords = Math.max(0, Number.parseInt(payload.totalWords, 10) || 0);
  const maxScore = Math.max(0, Number.parseInt(payload.maxScore, 10) || 0);
  const totalPangrams = Math.max(0, Number.parseInt(payload.pangramCount, 10) || 0);
  const foundWordSet = useMemo(() => new Set(foundWords), [foundWords]);
  const foundPangrams = useMemo(() => foundWords.filter((word) => isSpellingBeePangram(word, { centerLetter, outerLetters, minWordLength })), [centerLetter, foundWords, minWordLength, outerLetters]);
  const currentScore = useMemo(() => foundWords.reduce((sum, word) => sum + getSpellingBeeWordScore(word, { centerLetter, outerLetters, minWordLength }), 0), [centerLetter, foundWords, minWordLength, outerLetters]);
  const scoreRank = useMemo(() => getSpellingBeeRank(currentScore, maxScore), [currentScore, maxScore]);
  const nextRank = useMemo(() => SPELLING_BEE_RANKS.find((rank) => rank.threshold > scoreRank.threshold) || null, [scoreRank.threshold]);
  const foundPercent = totalWords > 0 ? Math.min(100, Math.round((foundWords.length / totalWords) * 100)) : 0;
  const scorePercent = maxScore > 0 ? Math.min(100, Math.round((currentScore / maxScore) * 100)) : 0;
  const sortedFoundWords = useMemo(() => [...foundWords].sort((left, right) => {
    const leftPangram = isSpellingBeePangram(left, { centerLetter, outerLetters, minWordLength });
    const rightPangram = isSpellingBeePangram(right, { centerLetter, outerLetters, minWordLength });
    if (leftPangram !== rightPangram) return leftPangram ? -1 : 1;
    const lengthDelta = Array.from(right).length - Array.from(left).length;
    if (lengthDelta !== 0) return lengthDelta;
    return left.localeCompare(right, 'bg');
  }), [centerLetter, foundWords, minWordLength, outerLetters]);

  puzzleRef.current = puzzle;
  currentWordRef.current = currentWord;
  foundWordsRef.current = foundWords;
  gameStatusRef.current = gameStatus;
  centerLetterRef.current = centerLetter;
  outerLettersRef.current = canonicalOuterLetters;
  minWordLengthRef.current = minWordLength;
  totalWordsRef.current = totalWords;
  maxScoreRef.current = maxScore;

  useEffect(() => {
    if (!puzzle) return;
    if (foundWords.length === 0 && !currentWord && gameStatus === 'playing') return;
    saveGameProgress(GAME_SLUG, todayStr, {
      puzzleId: puzzle.id,
      foundWords,
      currentWord,
      gameStatus,
    });
  }, [currentWord, foundWords, gameStatus, puzzle, todayStr]);

  const appendLetter = useCallback((rawLetter) => {
    const letter = normalizeSpellingBeeLetter(rawLetter);
    if (!letter || gameStatusRef.current !== 'playing' || submitLockRef.current) return;
    const allowedLetters = new Set([centerLetterRef.current, ...outerLettersRef.current]);
    if (!allowedLetters.has(letter)) return;
    setCurrentWord((current) => {
      const nextValue = current + letter;
      return Array.from(nextValue).length > 24 ? current : nextValue;
    });
    setNotice(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (gameStatusRef.current !== 'playing' || submitLockRef.current) return;
    setCurrentWord((current) => Array.from(current).slice(0, -1).join(''));
  }, []);

  const handleShuffle = useCallback(() => {
    setDisplayOuterLetters((current) => shuffleLetters(current.length > 0 ? current : canonicalOuterLetters));
  }, [canonicalOuterLetters]);

  const handleSubmit = useCallback(async () => {
    const guess = normalizeSpellingBeeWord(currentWordRef.current);
    const activePuzzle = puzzleRef.current;
    if (!guess || !activePuzzle || gameStatusRef.current !== 'playing' || submitLockRef.current) return;

    if (Array.from(guess).length < minWordLengthRef.current) {
      setNotice(buildBeeNotice('too-short', minWordLengthRef.current));
      return;
    }

    if (foundWordsRef.current.includes(guess)) {
      setNotice(buildBeeNotice('duplicate', minWordLengthRef.current));
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await api.games.validate(GAME_SLUG, todayStr, { guess });
      if (!response?.accepted) {
        setNotice(buildBeeNotice(response?.reason, minWordLengthRef.current));
        return;
      }

      const nextFoundWords = [...foundWordsRef.current, response.word];
      const nextScore = nextFoundWords.reduce((sum, word) => sum + getSpellingBeeWordScore(word, {
        centerLetter: centerLetterRef.current,
        outerLetters: outerLettersRef.current,
        minWordLength: minWordLengthRef.current,
      }), 0);

      foundWordsRef.current = nextFoundWords;
      setFoundWords(nextFoundWords);
      currentWordRef.current = '';
      setCurrentWord('');

      const solvedByWords = totalWordsRef.current > 0 && nextFoundWords.length >= totalWordsRef.current;
      const solvedByScore = maxScoreRef.current > 0 && nextScore >= maxScoreRef.current;
      if (solvedByWords || solvedByScore) {
        gameStatusRef.current = 'won';
        setGameStatus('won');
        recordGameWin(GAME_SLUG, todayStr);
        setNotice({
          type: 'success',
          message: response.isPangram
            ? 'Панграма и пълен кошер. Позна всички думи.'
            : 'Кошерът е изчистен. Намери всички думи.',
        });
        return;
      }

      setNotice({
        type: 'success',
        message: response.isPangram
          ? `Панграма: ${response.word}. +${response.score} точки.`
          : `${response.word} е приета. +${response.score} точки.`,
      });
    } catch (err) {
      setNotice({
        type: 'error',
        message: 'Проблем при проверката: ' + err.message,
      });
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [todayStr]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (showHelp) return undefined;

    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        handleDelete();
        return;
      }
      const letter = normalizeSpellingBeeKeyboardInput(
        event.key,
        event.code,
        [centerLetterRef.current, ...outerLettersRef.current]
      );
      if (!letter) return;
      event.preventDefault();
      appendLetter(letter);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appendLetter, handleDelete, handleSubmit, showHelp]);

  const shareText = useMemo(() => {
    const pangramBadge = foundPangrams.length > 0 ? `Панграми: ${foundPangrams.length}/${totalPangrams}` : 'Панграми: 0';
    return `zNews Spelling Bee - ${todayStr}\n${currentScore}/${maxScore || '?'} точки\n${foundWords.length}/${totalWords || '?'} думи\n${pangramBadge}`;
  }, [currentScore, foundPangrams.length, foundWords.length, maxScore, todayStr, totalPangrams, totalWords]);

  const handleShare = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setNotice({ type: 'error', message: 'Споделянето не е достъпно на това устройство.' });
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setNotice({ type: 'success', message: 'Резултатът е копиран в клипборда.' });
    } catch {
      setNotice({ type: 'error', message: 'Не успях да копирам резултата.' });
    }
  }, [shareText]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 dark:bg-[#101113]">
        <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen bg-stone-100 px-4 py-20 text-center dark:bg-[#101113]">
        <div className="mx-auto max-w-xl rounded-[28px] border border-stone-300 bg-white/95 p-10 shadow-xl dark:border-zinc-800 dark:bg-[#151619]">
          <h1 className="mb-4 text-3xl font-black uppercase text-slate-900 dark:text-white">Spelling Bee не е достъпна</h1>
          <p className="mb-8 text-stone-500 dark:text-zinc-400">{displayError || 'Опитай отново след малко.'}</p>
          <Link to="/games" className="font-bold text-slate-900 hover:text-stone-700 dark:text-white dark:hover:text-zinc-300">Назад към игрите</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(252,211,77,0.16),transparent_30%),linear-gradient(180deg,#f5f5f4,#ede7db)] pb-20 text-stone-950 dark:bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_26%),linear-gradient(180deg,#111214,#09090b)] dark:text-stone-100">
      <header className="mb-8 border-b border-stone-300 bg-white/80 backdrop-blur dark:border-zinc-900 dark:bg-[#101113]/90">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between p-4">
          <Link to="/games" className="text-stone-500 transition-colors hover:text-stone-950 dark:text-zinc-500 dark:hover:text-white">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-sm font-black uppercase tracking-[0.42em] text-stone-700 dark:text-zinc-200">Spelling Bee</h1>
          <button onClick={() => setShowHelp(true)} className="text-stone-500 transition-colors hover:text-stone-950 dark:text-zinc-500 dark:hover:text-white">
            <HelpCircle className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4">
        <section className="overflow-hidden rounded-[34px] border border-amber-200/70 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.34),transparent_36%),linear-gradient(180deg,rgba(255,253,247,0.98),rgba(252,245,229,0.95))] shadow-[0_28px_60px_rgba(180,83,9,0.12)] dark:border-amber-950/50 dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(10,10,11,0.98))] dark:shadow-none">
          <div className="border-b border-amber-200/60 px-6 py-5 dark:border-amber-950/30">
            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-700 dark:text-amber-300">zNews Games</p>
            <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-stone-500 dark:text-zinc-400">{todayStr}</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-stone-950 [font-family:Georgia,'Times_New_Roman',serif] dark:text-white sm:text-5xl">
                  {payload.title || 'Днешният меден кошер'}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 dark:text-zinc-300">
                  {payload.deck || 'Построй възможно най-много думи от седем букви. Централната буква е задължителна, а повторенията са позволени.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <div className="rounded-[22px] border border-stone-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-[#151619]">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">Ранг</p>
                  <p className="mt-2 text-lg font-black text-stone-950 dark:text-white">{scoreRank.label}</p>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-[#151619]">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">Точки</p>
                  <p className="mt-2 text-lg font-black text-stone-950 dark:text-white">{currentScore}/{maxScore || '?'}</p>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-[#151619]">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">Думи</p>
                  <p className="mt-2 text-lg font-black text-stone-950 dark:text-white">{foundWords.length}/{totalWords || '?'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_380px]">
          <div className="space-y-6">
            <div className="rounded-[34px] border border-stone-200 bg-white/90 px-5 py-6 shadow-[0_24px_55px_rgba(28,25,23,0.08)] dark:border-zinc-800 dark:bg-[#151619] dark:shadow-none">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-stone-500 dark:text-zinc-500">Кошер</p>
                  <h3 className="mt-2 text-2xl font-black uppercase tracking-[0.08em] text-stone-950 dark:text-white">Централната буква е {centerLetter || '?'}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-zinc-300">Думите са поне {minWordLength} букви. Намери всички възможни комбинации и стигни ранга „Гений“.</p>
                </div>
                <button type="button" onClick={handleShuffle} className={SECONDARY_ACTION_CLASS}>
                  <RefreshCcw className="h-4 w-4" />
                  Разбъркай
                </button>
              </div>

              <div className="mt-6">
                <SpellingBeeHive
                  centerLetter={centerLetter}
                  outerLetters={outerLetters}
                  activeLetters={Array.from(currentWord)}
                  onSelectLetter={appendLetter}
                  disabled={gameStatus !== 'playing' || isSubmitting}
                />
              </div>
            </div>

            <div className="rounded-[34px] border border-stone-200 bg-white/90 p-6 shadow-[0_24px_55px_rgba(28,25,23,0.08)] dark:border-zinc-800 dark:bg-[#151619] dark:shadow-none">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.32em] text-stone-500 dark:text-zinc-500">Текуща дума</p>
                  <div className="mt-3 min-h-[72px] rounded-[26px] border border-stone-200 bg-stone-50/80 px-5 py-4 text-center text-3xl font-black uppercase tracking-[0.42em] text-stone-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white sm:text-4xl">
                    {currentWord ? Array.from(currentWord).join(' ') : '•'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={handleDelete} disabled={!currentWord || isSubmitting || gameStatus !== 'playing'} className={SECONDARY_ACTION_CLASS}>
                    <Delete className="h-4 w-4" />
                    Изтрий
                  </button>
                  <button type="button" onClick={handleSubmit} disabled={!currentWord || isSubmitting || gameStatus !== 'playing'} className={PRIMARY_ACTION_CLASS}>
                    <Send className="h-4 w-4" />
                    Провери
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-stone-400 dark:text-zinc-500">Напредък</p>
                  <p className="mt-2 text-2xl font-black text-stone-950 dark:text-white">{foundPercent}%</p>
                </div>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-stone-400 dark:text-zinc-500">Панграми</p>
                  <p className="mt-2 text-2xl font-black text-stone-950 dark:text-white">{foundPangrams.length}/{totalPangrams || '?'}</p>
                </div>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-stone-400 dark:text-zinc-500">Следващ ранг</p>
                  <p className="mt-2 text-lg font-black text-stone-950 dark:text-white">{nextRank ? nextRank.label : 'Финал'}</p>
                </div>
              </div>

              {notice?.message && (
                <div aria-live="polite" className={`mt-5 rounded-[26px] border px-5 py-4 text-sm ${NOTICE_TONE_CLASSNAMES[notice.type] || NOTICE_TONE_CLASSNAMES.info}`}>
                  {notice.message}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[34px] border border-stone-200 bg-white/90 p-6 shadow-[0_24px_55px_rgba(28,25,23,0.08)] dark:border-zinc-800 dark:bg-[#151619] dark:shadow-none">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.32em] text-stone-500 dark:text-zinc-500">Скорборд</p>
                  <h3 className="mt-2 text-2xl font-black uppercase tracking-[0.08em] text-stone-950 dark:text-white">{scoreRank.label}</h3>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <Crown className="h-4 w-4" />
                  {currentScore}/{maxScore || '?'}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.24em] text-stone-500 dark:text-zinc-500">
                    <span>Точки</span>
                    <span>{scorePercent}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-stone-200 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#facc15)] transition-[width] duration-300" style={{ width: `${scorePercent}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.24em] text-stone-500 dark:text-zinc-500">
                    <span>Думи</span>
                    <span>{foundPercent}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-stone-200 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#22c55e)] transition-[width] duration-300" style={{ width: `${foundPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] border border-stone-200 bg-white/90 p-6 shadow-[0_24px_55px_rgba(28,25,23,0.08)] dark:border-zinc-800 dark:bg-[#151619] dark:shadow-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.32em] text-stone-500 dark:text-zinc-500">Открити думи</p>
                  <h3 className="mt-2 text-2xl font-black uppercase tracking-[0.08em] text-stone-950 dark:text-white">{foundWords.length}</h3>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-stone-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  {foundPangrams.length} панграми
                </span>
              </div>

              <div className="mt-5 max-h-[420px] overflow-y-auto pr-1">
                {sortedFoundWords.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50/80 px-4 py-6 text-sm text-stone-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    Все още няма открити думи. Започни с кратка 4-буквена комбинация.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {sortedFoundWords.map((word) => {
                      const pangram = isSpellingBeePangram(word, { centerLetter, outerLetters: canonicalOuterLetters, minWordLength });
                      return (
                        <div key={word} className={`flex items-center justify-between rounded-[20px] border px-4 py-3 text-sm font-black uppercase tracking-[0.16em] ${pangram
                          ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                          : 'border-stone-200 bg-stone-50/80 text-stone-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'}`}>
                          <span>{word}</span>
                          <span className="text-[11px] tracking-[0.2em] opacity-70">+{getSpellingBeeWordScore(word, { centerLetter, outerLetters: canonicalOuterLetters, minWordLength })}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {gameStatus === 'won' && (
              <div className="rounded-[34px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(209,250,229,0.92))] p-6 shadow-[0_24px_55px_rgba(16,185,129,0.12)] dark:border-emerald-950 dark:bg-[linear-gradient(180deg,rgba(6,78,59,0.42),rgba(4,47,46,0.42))] dark:shadow-none">
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-emerald-700 dark:text-emerald-300">Финал</p>
                <h3 className="mt-2 text-3xl font-black uppercase text-emerald-950 dark:text-emerald-100">Кошерът е решен</h3>
                <p className="mt-3 text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/80">Намери всички възможни думи и стигна до ранга „Гений“. Сподели резултата си.</p>
                <button type="button" onClick={handleShare} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-white transition-colors hover:bg-emerald-600 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400">
                  <Share2 className="h-4 w-4" />
                  Сподели
                </button>
              </div>
            )}
          </aside>
        </section>
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-xl rounded-[30px] border border-stone-300 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#151619]" onClick={(event) => event.stopPropagation()}>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-amber-700 dark:text-amber-300">Как се играе</p>
            <h2 className="mt-3 text-3xl font-black uppercase text-stone-950 dark:text-white">Spelling Bee правила</h2>
            <div className="mt-5 space-y-3 text-sm leading-6 text-stone-600 dark:text-zinc-300">
              <p>1. Всяка дума използва само седемте букви от кошера.</p>
              <p>2. Централната буква е задължителна във всяка дума.</p>
              <p>3. Думите са поне {minWordLength} букви, а повторенията на букви са позволени.</p>
              <p>4. Панграма е дума, която използва и седемте букви поне веднъж.</p>
            </div>
            <button type="button" onClick={() => setShowHelp(false)} className="mt-8 inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-white transition-colors hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
              Затвори
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
