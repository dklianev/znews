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
  Users,
  PhoneCall,
  Shield,
  Wallet,
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

const PHONE_HINT_CONFIDENT = [
  'Почти сигурен съм, че правилният е',
  'Бих заложил на',
  'Според мен това е',
];

const PHONE_HINT_UNCERTAIN = [
  'Не съм напълно сигурен, но бих пробвал',
  'Колебая се, но май е',
  'Ако трябва да рискувам, бих избрал',
];

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
  return `${amount.toLocaleString('bg-BG')} лв.`;
}

// ÄÄÄ Lifeline helpers ÄÄÄ
function generateFiftyFifty(question) {
  const correct = question.correctIndex;
  const wrong = question.options
    .map((_, i) => i)
    .filter(i => i !== correct);
  const keep = wrong[Math.floor(Math.random() * wrong.length)];
  const eliminated = wrong.filter(i => i !== keep);
  return new Set(eliminated);
}

function generateAudienceVotes(question, eliminated) {
  const correct = question.correctIndex;
  const active = question.options.map((_, i) => i).filter(i => !eliminated.has(i));
  const votes = new Array(question.options.length).fill(0);

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
  const isRight = Math.random() < 0.7;
  const wrongOptions = question.options.map((_, i) => i).filter(i => i !== question.correctIndex);
  const suggestedIdx = isRight
    ? question.correctIndex
    : wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
  const confidence = isRight
    ? PHONE_HINT_CONFIDENT[Math.floor(Math.random() * PHONE_HINT_CONFIDENT.length)]
    : PHONE_HINT_UNCERTAIN[Math.floor(Math.random() * PHONE_HINT_UNCERTAIN.length)];
  const letter = String.fromCharCode(65 + suggestedIdx);
  return `${confidence} ${letter}.`;
}
function LifelineButton({ icon: Icon, label, hint, active, onClick, accent = 'yellow' }) {
  const activeClasses = accent === 'emerald'
    ? 'border-emerald-400/45 bg-emerald-400/10 text-emerald-100 shadow-[0_18px_30px_rgba(16,185,129,0.14)]'
    : 'border-yellow-400/45 bg-yellow-400/10 text-yellow-100 shadow-[0_18px_30px_rgba(250,204,21,0.14)]';
  const iconClasses = accent === 'emerald' ? 'text-emerald-300' : 'text-yellow-300';

  return (
    <button
      onClick={onClick}
      disabled={!active}
      className={`group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-300 ${
        active
          ? `bg-indigo-950/78 hover:-translate-y-0.5 hover:bg-indigo-900/88 ${activeClasses}`
          : 'border-indigo-800/40 bg-indigo-950/45 opacity-50'
      }`}
      title={label}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 ${active ? 'bg-white/6' : 'bg-indigo-900/40'}`}>
        <Icon className={`h-5 w-5 ${active ? iconClasses : 'text-indigo-500'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-black uppercase tracking-[0.24em] text-white">{label}</span>
        <span className="mt-1 block text-xs text-indigo-300">{active ? hint : 'Използвана'}</span>
      </span>
    </button>
  );
}

function AudiencePanel({ votes, eliminated }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mb-5 overflow-hidden rounded-[1.6rem] border border-indigo-700/40 bg-indigo-950/72 p-4 shadow-[0_18px_44px_rgba(8,8,36,0.34)]"
    >
      <p className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.32em] text-indigo-300">
        <Users className="h-4 w-4 text-yellow-300" />
        Глас на публиката
      </p>
      <div className="grid grid-cols-4 gap-3">
        {votes.map((pct, i) => {
          const letter = String.fromCharCode(65 + i);
          const hidden = eliminated.has(i);
          return (
            <div key={letter} className={`rounded-2xl border border-indigo-800/40 bg-indigo-900/40 p-3 text-center ${hidden ? 'opacity-25' : ''}`}>
              <div className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-indigo-400">{letter}</div>
              <div className="mx-auto mb-2 flex h-24 w-full max-w-[60px] items-end rounded-2xl bg-indigo-950/70 p-1">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="w-full rounded-xl bg-[linear-gradient(180deg,#fcd34d,#f59e0b)] shadow-[0_8px_18px_rgba(245,158,11,0.25)]"
                />
              </div>
              <div className="text-sm font-black text-yellow-300">{pct}%</div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function PhoneHintPanel({ hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mb-5 overflow-hidden rounded-[1.6rem] border border-indigo-700/40 bg-[linear-gradient(180deg,rgba(30,41,59,0.92),rgba(15,23,42,0.96))] p-4 shadow-[0_18px_44px_rgba(8,8,36,0.34)]"
    >
      <p className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.32em] text-indigo-300">
        <PhoneCall className="h-4 w-4 text-emerald-300" />
        Обади се на приятел
      </p>
      <div className="relative rounded-[1.35rem] border border-emerald-400/25 bg-emerald-400/10 px-4 py-4 text-left shadow-[0_10px_24px_rgba(16,185,129,0.12)]">
        <div className="absolute left-6 top-full h-4 w-4 -translate-y-2 rotate-45 border-b border-r border-emerald-400/25 bg-emerald-400/10" />
        <p className="text-sm font-semibold leading-relaxed text-emerald-50">{hint}</p>
      </div>
    </motion.div>
  );
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
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3 p-3 md:p-4">
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
              onClick={() => setShowLadder(true)}
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
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-5 lg:gap-8 p-4 md:p-6">

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
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                  <LifelineButton
                    icon={Shield}
                    label="50:50"
                    hint="Премахва два грешни отговора"
                    active={lifelines.fiftyFifty && gameStatus === 'playing'}
                    onClick={useFiftyFifty}
                  />
                  <LifelineButton
                    icon={Users}
                    label="Публиката"
                    hint="Показва ориентировъчни гласове"
                    active={lifelines.audience && gameStatus === 'playing'}
                    onClick={useAudience}
                  />
                  <LifelineButton
                    icon={PhoneCall}
                    label="Приятел"
                    hint="Чуй бърз съвет по телефона"
                    active={lifelines.phone && gameStatus === 'playing'}
                    onClick={usePhone}
                    accent="emerald"
                  />
                </div>

                {currentQ > 0 && gameStatus === 'playing' && (
                  <div className="mb-5 flex justify-center">
                    <button
                      onClick={walkAway}
                      className="flex items-center gap-3 rounded-2xl border border-indigo-700/55 bg-indigo-900/58 px-5 py-3 text-left transition-all hover:border-yellow-400/40 hover:bg-indigo-900/82"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/12 text-yellow-300">
                        <Wallet className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-[11px] font-black uppercase tracking-[0.24em] text-indigo-400">Прибери точките</span>
                        <span className="mt-1 block text-sm font-black text-white">{formatPoints(currentPoints)}</span>
                      </span>
                    </button>
                  </div>
                )}
                {/* Audience votes overlay */}
                <AnimatePresence>
                  {audienceVotes && gameStatus === 'playing' && (
                    <AudiencePanel votes={audienceVotes} eliminated={eliminated} />
                  )}
                </AnimatePresence>
                {/* Phone hint */}
                <AnimatePresence>
                  {phoneHint && gameStatus === 'playing' && (
                    <PhoneHintPanel hint={phoneHint} />
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
        <div className="hidden w-72 shrink-0 lg:block">
          <PointsLadder
            ladder={pointsLadder}
            currentQ={currentQ}
            safetyNets={safetyNets}
            gameStatus={gameStatus}
            onClose={() => setShowLadder(false)}
          />
        </div>
      </main>

      <AnimatePresence>
        {showLadder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end bg-black/70 px-4 pb-4 pt-20 backdrop-blur-sm lg:hidden"
            onClick={() => setShowLadder(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full"
              onClick={e => e.stopPropagation()}
            >
              <PointsLadder
                variant="sheet"
                ladder={pointsLadder}
                currentQ={currentQ}
                safetyNets={safetyNets}
                gameStatus={gameStatus}
                onClose={() => setShowLadder(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
function PointsLadder({ ladder, currentQ, safetyNets, gameStatus, onClose, variant = 'sidebar' }) {
  const isPlaying = gameStatus === 'playing' || gameStatus === 'answering' || gameStatus === 'revealed';
  const safetySet = useMemo(() => new Set(safetyNets), [safetyNets]);
  const isSheet = variant === 'sheet';

  return (
    <div className={`overflow-hidden rounded-[1.75rem] border border-indigo-700/50 bg-[linear-gradient(180deg,rgba(30,27,75,0.96),rgba(15,23,42,0.96))] backdrop-blur-sm shadow-[0_24px_70px_rgba(10,10,46,0.45)] ${isSheet ? 'p-5' : 'p-4'}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.32em] text-indigo-300">Награди</h3>
          <p className="mt-1 text-xs text-indigo-400">Качваш се нагоре с всеки верен отговор.</p>
        </div>
        <button onClick={onClose} className={`${isSheet ? 'flex' : 'lg:hidden flex'} h-10 w-10 items-center justify-center rounded-full border border-indigo-700/50 bg-indigo-900/50 text-indigo-300`}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        {[...ladder].reverse().map((prize, reverseIdx) => {
          const idx = ladder.length - 1 - reverseIdx;
          const isCurrent = isPlaying && idx === currentQ;
          const isPassed = idx < currentQ;
          const isSafety = safetySet.has(idx);

          return (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all ${
                isCurrent
                  ? 'border-yellow-400/55 bg-yellow-400/12 shadow-[0_12px_26px_rgba(250,204,21,0.14)]'
                  : isPassed
                    ? 'border-emerald-400/25 bg-emerald-400/8'
                    : 'border-indigo-800/40 bg-indigo-950/30'
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${
                isCurrent
                  ? 'border-yellow-300/50 bg-yellow-400/18 text-yellow-200'
                  : isPassed
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                    : 'border-indigo-800/40 bg-indigo-900/60 text-indigo-400'
              }`}>
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-black ${isCurrent ? 'text-white' : isPassed ? 'text-emerald-100' : 'text-indigo-200'}`}>
                  {formatPoints(prize)}
                </div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-indigo-400">
                  {isSafety ? 'Гарантирана сума' : isCurrent ? 'Текущ въпрос' : isPassed ? 'Преминато' : 'Следващо ниво'}
                </div>
              </div>
              {isSafety && (
                <div className="rounded-full border border-yellow-400/35 bg-yellow-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-yellow-200">
                  Сейф
                </div>
              )}
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
  const title = isWin ? 'Ерудит!' : isWalkaway ? 'Прибра точките!' : 'Край на играта';
  const subtitle = isWin
    ? 'Мина през всички въпроси и взе голямата награда.'
    : isWalkaway
      ? 'Спря навреме и запази спечеленото.'
      : guaranteedPoints > 0
        ? `Отпадна на въпрос ${currentQ + 1}, но си тръгваш с гарантираните ${formatPoints(guaranteedPoints)}.`
        : `Отпадна на въпрос ${currentQ + 1} и не стигна до защитна сума.`;
  const accent = isWin ? 'yellow' : isWalkaway ? 'emerald' : 'red';

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-indigo-700/50 bg-indigo-950/86 p-8 shadow-[0_32px_90px_rgba(10,10,46,0.5)] backdrop-blur-sm">
      <div className={`pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b ${accent === 'yellow' ? 'from-yellow-500/20 via-amber-500/10 to-transparent' : accent === 'emerald' ? 'from-emerald-500/20 via-emerald-400/10 to-transparent' : 'from-red-500/20 via-red-400/10 to-transparent'}`} />
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      <div className="relative">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-700/50 bg-indigo-900/60 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.35em] text-indigo-300">
          <CircleDollarSign className="h-3.5 w-3.5 text-amber-300" />
          Финал
        </div>

        <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${accent === 'yellow' ? 'from-yellow-400 to-amber-600' : accent === 'emerald' ? 'from-emerald-400 to-emerald-600' : 'from-red-400 to-red-600'} shadow-lg`}>
          {isWin ? <Trophy className="h-10 w-10 text-indigo-950" /> : <CircleDollarSign className="h-10 w-10 text-indigo-950" />}
        </div>

        <h2 className="mb-2 text-3xl font-black uppercase font-display md:text-4xl">{title}</h2>
        <p className="mb-7 leading-relaxed text-indigo-200">{subtitle}</p>

        <div className={`mb-3 text-5xl font-black md:text-6xl ${accent === 'yellow' ? 'text-yellow-300' : accent === 'emerald' ? 'text-emerald-300' : 'text-red-300'}`}>
          {formatPoints(finalPoints)}
        </div>
        <p className="mb-7 text-sm text-indigo-400">Верни отговори: {score}/{totalQ}</p>

        <div className="mb-8 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-indigo-800/45 bg-indigo-900/45 p-4 text-left">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-400">Спря на</div>
            <div className="mt-2 text-xl font-black text-white">Въпрос {Math.min(currentQ + 1, totalQ)}</div>
          </div>
          <div className="rounded-2xl border border-indigo-800/45 bg-indigo-900/45 p-4 text-left">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-400">Гарантирани</div>
            <div className="mt-2 text-xl font-black text-white">{formatPoints(guaranteedPoints)}</div>
          </div>
          <div className="rounded-2xl border border-indigo-800/45 bg-indigo-900/45 p-4 text-left">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-400">Резултат</div>
            <div className="mt-2 text-xl font-black text-white">{score}/{totalQ}</div>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {answers.map((ans, idx) => {
            const correct = idx < questions.length && ans === questions[idx].correctIndex;
            return (
              <div
                key={idx}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-black ${
                  correct
                    ? 'border-emerald-400/35 bg-emerald-400/14 text-emerald-200'
                    : 'border-red-400/30 bg-red-400/14 text-red-200'
                }`}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <button
            onClick={onShare}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 py-4 font-black uppercase tracking-widest text-indigo-950 transition-all hover:from-yellow-400 hover:to-amber-500"
          >
            <Share2 className="h-5 w-5" />
            Сподели
          </button>
          {shareNotice && (
            <p className={`text-sm font-bold ${shareNotice.tone === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {shareNotice.message}
            </p>
          )}
          <Link
            to="/games"
            className="block w-full rounded-xl border border-indigo-700/50 py-3 text-center font-bold text-indigo-300 transition-colors hover:bg-indigo-900/50"
          >
            Обратно към игрите
          </Link>
        </div>
      </div>
    </div>
  );
}

