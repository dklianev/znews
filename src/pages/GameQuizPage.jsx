import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../utils/api';
import { copyToClipboard } from '../utils/copyToClipboard';
import { loadGameProgress, saveGameProgress, recordGameWin } from '../utils/gameStorage';
import { getTodayStr } from '../utils/gameDate';
import QuizQuestionCard from '../components/games/quiz/QuizQuestionCard';
import {
  Loader2,
  ArrowLeft,
  Share2,
  HelpCircle,
  Trophy,
  X,
  Sparkles,
  CircleDollarSign,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

const GAME_SLUG = 'quiz';

// ─── Points ladder (scales to question count) ───
const POINTS_PRESETS = {
  5: [10, 25, 50, 100, 250],
  10: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  15: [5, 10, 15, 25, 50, 100, 150, 250, 500, 1000, 1500, 2500, 4000, 7500, 10000],
};

function buildPointsLadder(count) {
  if (POINTS_PRESETS[count]) return POINTS_PRESETS[count];
  const ladder = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    ladder.push(Math.round((5 + t * t * 9995) / 5) * 5);
  }
  return ladder;
}

// Safety net indices (0-based): the points you keep if you fail after passing them
function getSafetyNets(count) {
  if (count <= 5) return [];
  if (count <= 10) return [4];
  return [4, 9];
}

function formatPoints(amount) {
  return amount.toLocaleString('bg-BG') + ' т.';
}

// ─── Lifeline helpers ───
function generateFiftyFifty(question) {
  const correct = question.correctIndex;
  const wrong = question.options
    .map((_, i) => i)
    .filter(i => i !== correct);
  // Keep one random wrong answer
  const keep = wrong[Math.floor(Math.random() * wrong.length)];
  const eliminated = wrong.filter(i => i !== keep);
  return new Set(eliminated);
}

function generateAudienceVotes(question, eliminated) {
  const correct = question.correctIndex;
  const active = question.options.map((_, i) => i).filter(i => !eliminated.has(i));
  const votes = new Array(question.options.length).fill(0);

  // Give correct answer 45-75% of remaining votes
  const correctWeight = 45 + Math.floor(Math.random() * 30);
  votes[correct] = correctWeight;
  let remaining = 100 - correctWeight;

  const others = active.filter(i => i !== correct);
  others.forEach((idx, i) => {
    if (i === others.length - 1) {
      votes[idx] = remaining;
    } else {
      const share = Math.floor(Math.random() * (remaining * 0.7));
      votes[idx] = share;
      remaining -= share;
    }
  });
  return votes;
}

function generatePhoneHint(question) {
  // "Friend" is 70% likely to suggest the correct answer
  const isRight = Math.random() < 0.7;
  const wrongOptions = question.options.map((_, i) => i).filter(i => i !== question.correctIndex);
  const suggestedIdx = isRight
    ? question.correctIndex
    : wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
  const confidence = isRight
    ? ['Доста съм сигурен', 'Мисля, че знам', 'Почти съм убеден'][Math.floor(Math.random() * 3)]
    : ['Не съм сигурен, но мисля', 'Хммм, може би', 'Опитай с'][Math.floor(Math.random() * 3)];
  const letter = String.fromCharCode(65 + suggestedIdx);
  return `"${confidence}, че отговорът е ${letter}."`;
}

export default function GameQuizPage() {
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Game state
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | answering | revealed | gameover | won | walkaway
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [revealPhase, setRevealPhase] = useState(null); // null | 'locked' | 'revealed'

  // Lifelines
  const [lifelines, setLifelines] = useState({ fiftyFifty: true, audience: true, phone: true });
  const [eliminated, setEliminated] = useState(new Set());
  const [audienceVotes, setAudienceVotes] = useState(null);
  const [phoneHint, setPhoneHint] = useState(null);

  // UI
  const [showHelp, setShowHelp] = useState(false);
  const [showLadder, setShowLadder] = useState(false);
  const [shareNotice, setShareNotice] = useState(null);
  const revealTimerRef = useRef(null);

  const displayError = error === 'No puzzle for today'
    ? 'Днешният куиз още е в подготовка. Провери отново малко по-късно.'
    : error;

  const questions = useMemo(() => puzzle?.payload?.questions || [], [puzzle]);
  const totalQ = questions.length;
  const pointsLadder = useMemo(() => buildPointsLadder(totalQ), [totalQ]);
  const safetyNets = useMemo(() => getSafetyNets(totalQ), [totalQ]);

  const currentPoints = currentQ > 0 ? pointsLadder[currentQ - 1] : 0;
  const guaranteedPoints = useMemo(() => {
    if (currentQ === 0) return 0;
    let guaranteed = 0;
    for (const net of safetyNets) {
      if (currentQ > net) guaranteed = pointsLadder[net];
    }
    return guaranteed;
  }, [currentQ, safetyNets, pointsLadder]);

  // ─── Load puzzle ───
  useEffect(() => {
    api.games.getToday(GAME_SLUG)
      .then(data => {
        setPuzzle(data);
        const todayStr = getTodayStr();
        const saved = loadGameProgress(GAME_SLUG, todayStr);

        if (saved && saved.puzzleId === data.id && saved.version === 2) {
          setCurrentQ(saved.currentQ || 0);
          setAnswers(saved.answers || []);
          setGameStatus(saved.gameStatus || 'idle');
          setLifelines(saved.lifelines || { fiftyFifty: true, audience: true, phone: true });
          if (Array.isArray(saved.eliminatedArr)) setEliminated(new Set(saved.eliminatedArr));
          if (Array.isArray(saved.audienceVotes)) setAudienceVotes(saved.audienceVotes);
          if (saved.phoneHint) setPhoneHint(saved.phoneHint);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ─── Auto-save ───
  useEffect(() => {
    if (!puzzle) return;
    if (gameStatus === 'idle' && answers.length === 0) return;
    saveGameProgress(GAME_SLUG, getTodayStr(), {
      version: 2,
      puzzleId: puzzle.id,
      currentQ,
      answers,
      gameStatus: (gameStatus === 'answering' || gameStatus === 'revealed') ? 'playing' : gameStatus,
      lifelines,
      eliminatedArr: [...eliminated],
      audienceVotes,
      phoneHint,
    });
  }, [currentQ, answers, gameStatus, puzzle, lifelines, eliminated, audienceVotes, phoneHint]);

  // ─── Cleanup timers ───
  useEffect(() => {
    return () => { if (revealTimerRef.current) clearTimeout(revealTimerRef.current); };
  }, []);

  // ─── Actions ───
  const startGame = useCallback(() => {
    setCurrentQ(0);
    setAnswers([]);
    setLifelines({ fiftyFifty: true, audience: true, phone: true });
    setEliminated(new Set());
    setAudienceVotes(null);
    setPhoneHint(null);
    setSelectedAnswer(null);
    setRevealPhase(null);
    setShareNotice(null);
    setShowLadder(false);
    setGameStatus('playing');
  }, []);

  const selectAnswer = useCallback((idx) => {
    if (gameStatus !== 'playing' || eliminated.has(idx)) return;
    setShowLadder(false);
    setSelectedAnswer(idx);
    setRevealPhase('locked');
    setGameStatus('answering');

    // Dramatic delay before reveal
    revealTimerRef.current = setTimeout(() => {
      setRevealPhase('revealed');
      const correct = questions[currentQ].correctIndex;
      const isRight = idx === correct;

      const newAnswers = [...answers];
      newAnswers[currentQ] = idx;
      setAnswers(newAnswers);

      if (isRight) {
        // Check if won the whole game
        if (currentQ === totalQ - 1) {
          setTimeout(() => {
            setGameStatus('won');
            recordGameWin(GAME_SLUG, getTodayStr());
          }, 1500);
        } else {
          setTimeout(() => {
            setCurrentQ(prev => prev + 1);
            setSelectedAnswer(null);
            setRevealPhase(null);
            setEliminated(new Set());
            setAudienceVotes(null);
            setPhoneHint(null);
            setGameStatus('playing');
          }, 1800);
        }
      } else {
        setTimeout(() => {
          setGameStatus('gameover');
        }, 2000);
      }
    }, 1600);
  }, [gameStatus, eliminated, questions, currentQ, answers, totalQ]);

  const walkAway = useCallback(() => {
    if (gameStatus !== 'playing') return;
    setGameStatus('walkaway');
    recordGameWin(GAME_SLUG, getTodayStr());
  }, [gameStatus]);

  const useFiftyFifty = useCallback(() => {
    if (!lifelines.fiftyFifty || gameStatus !== 'playing') return;
    const elim = generateFiftyFifty(questions[currentQ]);
    setEliminated(elim);
    setLifelines(prev => ({ ...prev, fiftyFifty: false }));
  }, [lifelines.fiftyFifty, gameStatus, questions, currentQ]);

  const useAudience = useCallback(() => {
    if (!lifelines.audience || gameStatus !== 'playing') return;
    const votes = generateAudienceVotes(questions[currentQ], eliminated);
    setAudienceVotes(votes);
    setLifelines(prev => ({ ...prev, audience: false }));
  }, [lifelines.audience, gameStatus, questions, currentQ, eliminated]);

  const usePhone = useCallback(() => {
    if (!lifelines.phone || gameStatus !== 'playing') return;
    const hint = generatePhoneHint(questions[currentQ]);
    setPhoneHint(hint);
    setLifelines(prev => ({ ...prev, phone: false }));
  }, [lifelines.phone, gameStatus, questions, currentQ]);

  // ─── Share ───
  const getScore = useCallback(() => {
    return answers.reduce((acc, ans, idx) => {
      return acc + ((idx < questions.length && ans === questions[idx].correctIndex) ? 1 : 0);
    }, 0);
  }, [answers, questions]);

  const getFinalPoints = useCallback(() => {
    if (gameStatus === 'won') return pointsLadder[totalQ - 1];
    if (gameStatus === 'walkaway') return currentPoints;
    // Game over — return guaranteed prize
    return guaranteedPoints;
  }, [gameStatus, pointsLadder, totalQ, currentPoints, guaranteedPoints]);

  const generateShareText = useCallback(() => {
    const pts = getFinalPoints();
    let text = `🏆 zNews Ерудит — ${getTodayStr()}\n`;
    text += `Точки: ${formatPoints(pts)}\n`;
    text += `Верни: ${getScore()}/${totalQ}\n\n`;
    answers.forEach((ans, idx) => {
      text += (idx < questions.length && ans === questions[idx].correctIndex) ? '🟩' : '🟥';
    });
    text += '\n\nhttps://znews.live/games/quiz';
    return text;
  }, [getFinalPoints, getScore, totalQ, answers, questions]);

  const handleShare = useCallback(async () => {
    const copied = await copyToClipboard(generateShareText());
    setShareNotice(copied
      ? { tone: 'success', message: 'Резултатът е копиран!' }
      : { tone: 'error', message: 'Не успях да копирам.' });
  }, [generateShareText]);

  // ─── Render: Loading / Error ───
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a2e] flex justify-center items-center">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen bg-[#0a0a2e] text-center py-20 px-4">
        <div className="max-w-xl mx-auto rounded-2xl border border-indigo-800/50 bg-indigo-950/80 p-10 shadow-xl">
          <h1 className="text-3xl text-white mb-4 font-black uppercase font-display">Няма наличен куиз</h1>
          <p className="text-indigo-300 mb-8">{displayError || 'Моля, опитайте по-късно.'}</p>
          <Link to="/games" className="text-yellow-400 hover:text-yellow-300 font-bold">← Обратно към игрите</Link>
        </div>
      </div>
    );
  }

  if (totalQ === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a2e] text-center py-20 px-4">
        <div className="max-w-xl mx-auto rounded-2xl border border-indigo-800/50 bg-indigo-950/80 p-10 shadow-xl">
          <h1 className="text-3xl text-white mb-4 font-black uppercase font-display">Куизът още не е готов</h1>
          <p className="text-indigo-300 mb-8">Липсват въпроси за днешната игра.</p>
          <Link to="/games" className="text-yellow-400 hover:text-yellow-300 font-bold">← Обратно към игрите</Link>
        </div>
      </div>
    );
  }

  const isEndState = gameStatus === 'gameover' || gameStatus === 'won' || gameStatus === 'walkaway';

  // ─── Render: Main ───
  return (
    <div className="min-h-screen bg-[#07071f] text-white flex flex-col overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vmax] h-[120vmax] rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, #312e81 0%, transparent 58%)' }}
        />
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-[70vmax] h-[35vmax] opacity-[0.14]"
          style={{ background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.35) 0%, transparent 62%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-full h-full opacity-[0.035]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)' }}
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-400/8 via-amber-300/3 to-transparent" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full border-b border-indigo-800/40 bg-indigo-950/55 backdrop-blur-sm">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3 p-3 md:p-4">
          <Link to="/games" className="text-indigo-400 hover:text-white transition-colors shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.45em] text-indigo-400">Дневна игра</p>
            <h1 className="text-lg md:text-2xl font-black uppercase tracking-[0.18em] font-display text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500">
            Ерудит
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowLadder((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-700/60 bg-indigo-900/50 text-indigo-300 transition-colors hover:border-yellow-400/60 hover:text-yellow-300 md:hidden"
              aria-label="Покажи стълбата"
            >
              <Trophy className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-700/60 bg-indigo-900/50 text-indigo-300 transition-colors hover:border-white/60 hover:text-white"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-5 lg:gap-8 p-4 md:p-6">

        {/* Left: Game area */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <AnimatePresence mode="wait">

            {/* ── Idle: Start screen ── */}
            {gameStatus === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg text-center"
              >
                <div className="mb-8">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                    <Trophy className="w-12 h-12 text-indigo-950" />
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black font-display uppercase mb-3 text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500">
                    Ерудит
                  </h2>
                  <p className="text-indigo-300 text-lg max-w-sm mx-auto">
                    {totalQ} въпроса. 3 помощи. Един грешен отговор и играта свършва.
                  </p>
                </div>

                <div className="space-y-3 mb-8 text-left max-w-xs mx-auto">
                  <div className="flex items-center gap-3 text-indigo-300 text-sm">
                    <span className="w-8 h-8 rounded-full bg-indigo-800/60 flex items-center justify-center text-yellow-400 font-bold text-xs shrink-0">50</span>
                    <span>50:50 — премахва 2 грешни отговора</span>
                  </div>
                  <div className="flex items-center gap-3 text-indigo-300 text-sm">
                    <span className="w-8 h-8 rounded-full bg-indigo-800/60 flex items-center justify-center text-xs shrink-0">👥</span>
                    <span>Публика — показва гласовете на аудиторията</span>
                  </div>
                  <div className="flex items-center gap-3 text-indigo-300 text-sm">
                    <span className="w-8 h-8 rounded-full bg-indigo-800/60 flex items-center justify-center text-xs shrink-0">📞</span>
                    <span>Обаждане — съвет от приятел</span>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="w-full max-w-xs mx-auto py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-indigo-950 font-black uppercase tracking-widest rounded-xl text-lg hover:from-yellow-400 hover:to-amber-500 transition-all shadow-lg shadow-yellow-500/25 active:scale-[0.98]"
                >
                  Играй
                </button>
              </motion.div>
            )}

            {/* ── Playing / Answering / Revealed ── */}
            {(gameStatus === 'playing' || gameStatus === 'answering' || gameStatus === 'revealed') && (
              <motion.div
                key="playing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-3xl flex flex-col"
              >
                {/* Points info bar */}
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="text-sm text-indigo-400">
                    Въпрос <span className="text-white font-bold">{currentQ + 1}</span>/{totalQ}
                  </div>
                  <div className="text-sm font-bold">
                    За <span className="text-yellow-400">{formatPoints(pointsLadder[currentQ])}</span>
                  </div>
                </div>

                {/* Lifelines */}
                <div className="flex items-center justify-center gap-3 mb-5">
                  <button
                    onClick={useFiftyFifty}
                    disabled={!lifelines.fiftyFifty || gameStatus !== 'playing'}
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-sm transition-all
                      ${lifelines.fiftyFifty
                        ? 'border-yellow-400/60 bg-indigo-900/80 text-yellow-400 hover:bg-indigo-800 hover:border-yellow-400'
                        : 'border-indigo-800/40 bg-indigo-950/50 text-indigo-700 line-through'}`}
                    title="50:50"
                  >
                    50
                  </button>
                  <button
                    onClick={useAudience}
                    disabled={!lifelines.audience || gameStatus !== 'playing'}
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg transition-all
                      ${lifelines.audience
                        ? 'border-yellow-400/60 bg-indigo-900/80 hover:bg-indigo-800 hover:border-yellow-400'
                        : 'border-indigo-800/40 bg-indigo-950/50 opacity-40'}`}
                    title="Попитай публиката"
                  >
                    👥
                  </button>
                  <button
                    onClick={usePhone}
                    disabled={!lifelines.phone || gameStatus !== 'playing'}
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg transition-all
                      ${lifelines.phone
                        ? 'border-yellow-400/60 bg-indigo-900/80 hover:bg-indigo-800 hover:border-yellow-400'
                        : 'border-indigo-800/40 bg-indigo-950/50 opacity-40'}`}
                    title="Обади се на приятел"
                  >
                    📞
                  </button>

                  {/* Walk away */}
                  {currentQ > 0 && gameStatus === 'playing' && (
                    <button
                      onClick={walkAway}
                      className="ml-4 px-4 py-2 rounded-lg border border-indigo-700/60 bg-indigo-900/50 text-indigo-300 text-sm font-bold hover:bg-indigo-800/70 hover:text-white transition-all"
                    >
                      Запази {formatPoints(currentPoints)}
                    </button>
                  )}
                </div>

                {/* Audience votes overlay */}
                <AnimatePresence>
                  {audienceVotes && gameStatus === 'playing' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mb-4 p-4 rounded-xl bg-indigo-900/60 border border-indigo-700/40"
                    >
                      <p className="text-xs uppercase tracking-widest text-indigo-400 mb-3 font-bold">Публиката казва:</p>
                      <div className="flex items-end gap-3 h-20">
                        {audienceVotes.map((pct, i) => (
                          <div key={i} className={`flex-1 flex flex-col items-center ${eliminated.has(i) ? 'opacity-20' : ''}`}>
                            <span className="text-xs font-bold text-yellow-400 mb-1">{pct}%</span>
                            <div className="w-full bg-indigo-800/60 rounded-t overflow-hidden" style={{ height: '48px' }}>
                              <div
                                className="w-full bg-gradient-to-t from-yellow-500 to-amber-400 rounded-t transition-all duration-700"
                                style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-indigo-300 mt-1">{String.fromCharCode(65 + i)}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Phone hint */}
                <AnimatePresence>
                  {phoneHint && gameStatus === 'playing' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mb-4 p-4 rounded-xl bg-indigo-900/60 border border-indigo-700/40"
                    >
                      <p className="text-xs uppercase tracking-widest text-indigo-400 mb-2 font-bold">📞 Приятелят ти казва:</p>
                      <p className="text-yellow-300 italic">{phoneHint}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Question card */}
                <QuizQuestionCard
                  question={questions[currentQ]}
                  currentQ={currentQ}
                  totalQ={totalQ}
                  selectedAnswer={selectedAnswer}
                  revealPhase={revealPhase}
                  eliminated={eliminated}
                  onSelectAnswer={selectAnswer}
                  points={formatPoints(pointsLadder[currentQ])}
                />
              </motion.div>
            )}

            {/* ── End states ── */}
            {isEndState && (
              <motion.div
                key="end"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-2xl text-center"
              >
                <EndScreen
                  gameStatus={gameStatus}
                  finalPoints={getFinalPoints()}
                  score={getScore()}
                  totalQ={totalQ}
                  currentQ={currentQ}
                  questions={questions}
                  answers={answers}
                  guaranteedPoints={guaranteedPoints}
                  onShare={handleShare}
                  shareNotice={shareNotice}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Prize ladder (desktop always visible, mobile toggle) */}
        <div className={`lg:w-64 shrink-0 ${showLadder ? 'block' : 'hidden'} lg:block`}>
          <PointsLadder
            ladder={pointsLadder}
            currentQ={currentQ}
            safetyNets={safetyNets}
            gameStatus={gameStatus}
            onClose={() => setShowLadder(false)}
          />
        </div>
      </main>

      {/* Help modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-indigo-950 border border-indigo-700/50 p-6 rounded-2xl max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-black mb-4 text-yellow-400 uppercase font-display">Как се играе</h2>
              <ul className="text-sm text-indigo-200 space-y-3 mb-6">
                <li>🎯 Отговаряй на въпроси и изкачвай стълбата с награди.</li>
                <li>❌ Един грешен отговор — играта свършва.</li>
                <li>🛡️ На нива {safetyNets.map(n => n + 1).join(' и ') || '(няма)'} има гарантирани точки.</li>
                <li>💰 Можеш да запазиш точките и да спреш по всяко време.</li>
                <li>🆘 Имаш 3 помощи: 50:50, Публика, Обаждане.</li>
              </ul>
              <button onClick={() => setShowHelp(false)} className="w-full py-3 bg-yellow-500 text-indigo-950 font-black rounded-xl uppercase tracking-wider hover:bg-yellow-400 transition-colors">
                Разбрах
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Prize Ladder component ───
function PointsLadder({ ladder, currentQ, safetyNets, gameStatus, onClose }) {
  const isPlaying = gameStatus === 'playing' || gameStatus === 'answering' || gameStatus === 'revealed';
  const safetySet = useMemo(() => new Set(safetyNets), [safetyNets]);

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-indigo-700/50 bg-[linear-gradient(180deg,rgba(30,27,75,0.96),rgba(15,23,42,0.96))] p-4 backdrop-blur-sm shadow-[0_24px_70px_rgba(10,10,46,0.45)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Награди</h3>
        <button onClick={onClose} className="lg:hidden text-indigo-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-0.5">
        {[...ladder].reverse().map((prize, reverseIdx) => {
          const idx = ladder.length - 1 - reverseIdx;
          const isCurrent = isPlaying && idx === currentQ;
          const isPassed = idx < currentQ;
          const isSafety = safetySet.has(idx);

          let rowClass = 'text-indigo-600';
          if (isCurrent) rowClass = 'text-white bg-yellow-500/20 border-yellow-500/50';
          else if (isPassed) rowClass = 'text-indigo-400';

          return (
            <div
              key={idx}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm font-bold transition-all border border-transparent ${rowClass}`}
            >
              <span className={`w-5 text-right mr-3 ${isSafety ? 'text-yellow-400' : ''}`}>
                {idx + 1}
              </span>
              <span className={`flex-1 text-right ${isCurrent ? 'text-yellow-400' : ''} ${isSafety && !isCurrent ? 'text-yellow-500/70' : ''}`}>
                {formatPoints(prize)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── End Screen component ───
function EndScreen({ gameStatus, finalPoints, score, totalQ, currentQ, questions, answers, guaranteedPoints, onShare, shareNotice }) {
  const isWin = gameStatus === 'won';
  const isWalkaway = gameStatus === 'walkaway';

  const title = isWin ? 'ЕРУДИТ!' : isWalkaway ? 'Запази точките!' : 'Край на играта';
  const subtitle = isWin
    ? 'Невероятно! Отговори правилно на всички въпроси!'
    : isWalkaway
      ? 'Умен избор — запази точките навреме.'
      : guaranteedPoints > 0
        ? `Грешка на въпрос ${currentQ + 1}. Запазваш гарантираните ${formatPoints(guaranteedPoints)}.`
        : `Грешка на въпрос ${currentQ + 1}. За жалост не печелиш точки.`;

  const bgGradient = isWin
    ? 'from-yellow-500/20 via-amber-500/10 to-transparent'
    : isWalkaway
      ? 'from-emerald-500/15 via-emerald-500/5 to-transparent'
      : 'from-red-500/15 via-red-500/5 to-transparent';

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-indigo-700/50 bg-indigo-950/80 p-8 shadow-[0_32px_90px_rgba(10,10,46,0.5)] backdrop-blur-sm">
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-b ${bgGradient} pointer-events-none`} />
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      <div className="absolute -left-10 top-12 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="absolute -right-6 bottom-12 h-24 w-24 rounded-full bg-indigo-400/12 blur-3xl" />
      <div className="relative">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-700/50 bg-indigo-900/60 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-300">
          <CircleDollarSign className="h-3.5 w-3.5 text-amber-300" />
          Резултат
        </div>

        {/* Trophy / icon */}
        <div className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center shadow-lg
          ${isWin ? 'bg-gradient-to-br from-yellow-400 to-amber-600 shadow-yellow-500/30' : isWalkaway ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20' : 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/20'}`}
        >
          {isWin ? <Trophy className="w-10 h-10 text-indigo-950" /> : isWalkaway ? <span className="text-3xl">💰</span> : <span className="text-3xl">💔</span>}
        </div>

        <h2 className={`text-3xl md:text-4xl font-black font-display uppercase mb-2
          ${isWin ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500' : 'text-white'}`}>
          {title}
        </h2>
        <p className="text-indigo-200 mb-6 leading-relaxed">{subtitle}</p>

        {/* Prize display */}
        <div className={`text-5xl md:text-6xl font-black mb-2
          ${isWin ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-500' : isWalkaway ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatPoints(finalPoints)}
        </div>
        <p className="text-indigo-500 text-sm mb-8">Верни отговора: {score}/{totalQ}</p>

        {/* Answer breakdown */}
        <div className="flex justify-center gap-1.5 mb-8">
          {answers.map((ans, idx) => {
            const correct = idx < questions.length && ans === questions[idx].correctIndex;
            return (
              <div
                key={idx}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black
                  ${correct ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onShare}
            className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-indigo-950 rounded-xl font-black uppercase tracking-widest hover:from-yellow-400 hover:to-amber-500 transition-all"
          >
            <Share2 className="w-5 h-5" />
            Сподели
          </button>
          {shareNotice && (
            <p className={`text-sm font-bold ${shareNotice.tone === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {shareNotice.message}
            </p>
          )}
          <Link
            to="/games"
            className="block w-full py-3 text-center border border-indigo-700/50 rounded-xl text-indigo-300 font-bold hover:bg-indigo-900/50 transition-colors"
          >
            Обратно към игрите
          </Link>
        </div>
      </div>
    </div>
  );
}

