import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw, Share2, Shield, Trophy, Zap } from 'lucide-react';
import {
  calculateFoodScore,
  checkCollision,
  createGameState,
  createInitialSnake,
  DIRECTIONS,
  FOOD_TYPES,
  generateFood,
  generateObstacles,
  getDynamicSpeed,
  GRID_SIZE,
  growSnake,
  moveSnake,
  OPPOSITE,
  SPEED_BY_DIFFICULTY,
} from '../utils/snake';
import { copyToClipboard } from '../utils/copyToClipboard';
import { loadScopedGameProgress, saveScopedGameProgress } from '../utils/gameStorage';
import SnakeBoard from '../components/games/snake/SnakeBoard';
import { getSwipeDirection } from '../utils/touchSwipe';

const GAME_SLUG = 'snake';
const STORAGE_SCOPE = 'session';
const SPEED_BOOST_DURATION = 5000;
const COMBO_TIMEOUT = 5000;
const COMBO_TIMEOUT_SECONDS = Math.round(COMBO_TIMEOUT / 1000);

const DIFFICULTY_LABELS = { easy: 'Лесно', medium: 'Средно', hard: 'Трудно' };
const DEATH_LABELS = { wall: 'Удари стената!', self: 'Ухапа се!', obstacle: 'Удари препятствие!' };

function formatScore(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function GameSnakePage() {
  const [snake, setSnake] = useState(createInitialSnake);
  const [food, setFood] = useState(null);
  const [obstacles, setObstacles] = useState([]);
  const [direction, setDirection] = useState('RIGHT');
  const [gameStatus, setGameStatus] = useState('idle');
  const [difficulty, setDifficulty] = useState('medium');
  const [wrapMode, setWrapMode] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highScores, setHighScores] = useState({});
  const [deathReason, setDeathReason] = useState(null);
  const [floatingLabel, setFloatingLabel] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [gameState, setGameState] = useState(() => createGameState('medium', false));
  const [shareNotice, setShareNotice] = useState(null);

  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const obstaclesRef = useRef(obstacles);
  const dirRef = useRef(direction);
  const nextDirRef = useRef(direction);
  const statusRef = useRef(gameStatus);
  const scoreRef = useRef(score);
  const comboRef = useRef(combo);
  const gameStateRef = useRef(gameState);
  const tickRef = useRef(null);
  const comboTimerRef = useRef(null);
  const floatTimerRef = useRef(null);
  const shareNoticeTimerRef = useRef(null);

  snakeRef.current = snake;
  foodRef.current = food;
  obstaclesRef.current = obstacles;
  dirRef.current = direction;
  statusRef.current = gameStatus;
  scoreRef.current = score;
  comboRef.current = combo;
  gameStateRef.current = gameState;

  const diffKey = `${difficulty}${wrapMode ? '_wrap' : ''}`;
  const currentHighScore = highScores[diffKey] || 0;

  useEffect(() => {
    const saved = loadScopedGameProgress(GAME_SLUG, STORAGE_SCOPE);
    if (saved?.highScores) setHighScores(saved.highScores);
  }, []);

  const saveHighScore = useCallback((key, newScore) => {
    setHighScores((prev) => {
      const updated = { ...prev, [key]: Math.max(newScore, prev[key] || 0) };
      saveScopedGameProgress(GAME_SLUG, STORAGE_SCOPE, { highScores: updated });
      return updated;
    });
  }, []);

  const showFloat = useCallback((label) => {
    if (floatTimerRef.current) clearTimeout(floatTimerRef.current);
    setFloatingLabel(label);
    floatTimerRef.current = setTimeout(() => setFloatingLabel(null), 800);
  }, []);

  const resetComboTimer = useCallback(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setCombo(0), COMBO_TIMEOUT);
  }, []);

  const flashShareNotice = useCallback((message, tone) => {
    if (shareNoticeTimerRef.current) clearTimeout(shareNoticeTimerRef.current);
    setShareNotice({ message, tone });
    shareNoticeTimerRef.current = setTimeout(() => setShareNotice(null), 2200);
  }, []);

  const startGame = useCallback(() => {
    const newSnake = createInitialSnake();
    const newFood = generateFood(newSnake, []);
    setSnake(newSnake);
    setFood(newFood);
    setObstacles([]);
    setDirection('RIGHT');
    nextDirRef.current = 'RIGHT';
    setScore(0);
    setCombo(0);
    setDeathReason(null);
    setFloatingLabel(null);
    setGameState(createGameState(difficulty, wrapMode));
    setGameStatus('playing');
  }, [difficulty, wrapMode]);

  const togglePause = useCallback(() => {
    setGameStatus((s) => (s === 'playing' ? 'paused' : s === 'paused' ? 'playing' : s));
  }, []);

  const tick = useCallback(() => {
    if (statusRef.current !== 'playing') return;

    const dir = nextDirRef.current;
    setDirection(dir);
    const s = snakeRef.current;
    const f = foodRef.current;
    const obs = obstaclesRef.current;
    const gs = gameStateRef.current;
    const dirVec = DIRECTIONS[dir];

    const nextHead = {
      x: s[0].x + dirVec.x,
      y: s[0].y + dirVec.y,
    };

    if (gs.wrapMode) {
      nextHead.x = ((nextHead.x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
      nextHead.y = ((nextHead.y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
    }

    const eating = f && nextHead.x === f.x && nextHead.y === f.y;

    let newSnake;
    if (eating) {
      const foodDef = FOOD_TYPES[f.type] || FOOD_TYPES.normal;
      newSnake = growSnake(s, dirVec, foodDef.grow, gs.wrapMode);

      const newCombo = comboRef.current + 1;
      const foodPoints = calculateFoodScore(f.type, newCombo);
      setScore((prev) => prev + foodPoints);
      setCombo(newCombo);
      resetComboTimer();

      if (foodDef.label) showFloat(foodDef.label);

      const newScore = scoreRef.current + foodPoints;
      const newState = { ...gs, foodEaten: gs.foodEaten + 1, maxLength: Math.max(gs.maxLength, newSnake.length) };

      // Speed boost for speed food
      if (f.type === 'speed') {
        newState.speedBoostUntil = Date.now() + SPEED_BOOST_DURATION;
      }

      setGameState(newState);

      // Generate new obstacles on hard mode
      let newObs = obs;
      if (gs.obstaclesEnabled) {
        newObs = generateObstacles(newScore, newSnake, obs);
        setObstacles(newObs);
      }

      const newFood = generateFood(newSnake, newObs);
      setFood(newFood);
    } else {
      newSnake = moveSnake(s, dirVec, gs.wrapMode);
    }

    const collision = checkCollision(newSnake, obs, gs.wrapMode);
    if (collision) {
      setGameStatus('over');
      setDeathReason(collision);
      const finalScore = scoreRef.current;
      const key = `${gs.difficulty}${gs.wrapMode ? '_wrap' : ''}`;
      saveHighScore(key, finalScore);
      return;
    }

    setSnake(newSnake);
  }, [saveHighScore, resetComboTimer, showFloat]);

  // Game loop with dynamic speed
  useEffect(() => {
    if (gameStatus !== 'playing') {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    const baseSpeed = SPEED_BY_DIFFICULTY[difficulty];
    const isBoosted = gameState.speedBoostUntil > Date.now();
    const dynamicSpeed = getDynamicSpeed(isBoosted ? Math.max(40, baseSpeed - 30) : baseSpeed, snake.length);
    tickRef.current = setInterval(tick, dynamicSpeed);
    return () => clearInterval(tickRef.current);
  }, [gameStatus, difficulty, tick, snake.length, gameState.speedBoostUntil]);

  // Save high score on game over
  useEffect(() => {
    if (gameStatus === 'over') {
      const key = `${difficulty}${wrapMode ? '_wrap' : ''}`;
      saveHighScore(key, score);
    }
  }, [gameStatus, difficulty, wrapMode, score, saveHighScore]);

  useEffect(() => () => {
    if (shareNoticeTimerRef.current) clearTimeout(shareNoticeTimerRef.current);
  }, []);

  // Keyboard controls
  useEffect(() => {
    function handleKey(e) {
      // Don't intercept keys when a button/input is focused
      const tag = e.target.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;

      if (statusRef.current === 'over' || statusRef.current === 'idle') {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.code === 'KeyP' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
      if (statusRef.current !== 'playing') return;

      // Use e.code for WASD so it works regardless of keyboard layout (Cyrillic, etc.)
      let newDir = null;
      if (e.key === 'ArrowUp' || e.code === 'KeyW') newDir = 'UP';
      else if (e.key === 'ArrowDown' || e.code === 'KeyS') newDir = 'DOWN';
      else if (e.key === 'ArrowLeft' || e.code === 'KeyA') newDir = 'LEFT';
      else if (e.key === 'ArrowRight' || e.code === 'KeyD') newDir = 'RIGHT';
      else return;
      e.preventDefault();
      if (OPPOSITE[newDir] !== dirRef.current) { nextDirRef.current = newDir; }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [startGame, togglePause]);

  // Touch controls
  const touchStartRef = useRef(null);
  const handleBoardTouchStart = useCallback((event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleBoardTouchEnd = useCallback((event) => {
    if (statusRef.current !== 'playing') return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const direction = getSwipeDirection(touchStartRef.current, { x: touch.clientX, y: touch.clientY }, 15);
    touchStartRef.current = null;
    if (!direction) return;
    const nextDirection = direction.toUpperCase();
    if (OPPOSITE[nextDirection] !== dirRef.current) {
      nextDirRef.current = nextDirection;
    }
  }, []);

  const handleShare = useCallback(async () => {
    const text = `zNews Змия\n🏆 ${formatScore(score)} точки\n📏 Дължина: ${snake.length} | ${DIFFICULTY_LABELS[difficulty]}${wrapMode ? ' (wrap)' : ''}\n🍎 ${gameState.foodEaten} храни изядени`;
    const copied = await copyToClipboard(text);
    flashShareNotice(copied ? 'Резултатът е копиран!' : 'Не успях да копирам резултата.', copied ? 'success' : 'error');
  }, [difficulty, flashShareNotice, gameState.foodEaten, score, snake.length, wrapMode]);

  const isBoosted = gameState.speedBoostUntil > Date.now();

  return (
    <div className="min-h-screen bg-zn-paper comic-dots dark:bg-zinc-950 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-b from-emerald-900 via-emerald-800 to-emerald-700 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800 pt-6 pb-10 mb-8 border-b-4 border-[#1C1428] dark:border-zinc-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <Link to="/games" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 font-display text-sm uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Всички игри
          </Link>
          <p className="text-yellow-400 font-display text-xs uppercase tracking-[0.3em] mb-1">Безкраен режим</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-white font-display tracking-wider leading-none mb-2" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.3)' }}>
            Змия
          </h1>
          <p className="text-white/60 text-sm font-semibold max-w-md">
            Специални храни, препятствия, wrap режим. Яж умно!
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
          {/* Left panel */}
          <div className="hidden md:flex flex-col gap-3 w-36">
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Точки</span>
              <p className="text-xl font-black font-display text-zn-text dark:text-white">{formatScore(score)}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Дължина</span>
              <p className="text-xl font-black font-display text-emerald-600 dark:text-emerald-400">{snake.length}</p>
            </div>
            {combo > 1 && (
              <div className="comic-panel bg-zn-hot/10 dark:bg-zn-hot/20 border-zn-hot/30 p-2 text-center">
                <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-hot">Combo</span>
                <p className="text-lg font-black font-display text-zn-hot">{combo}x</p>
              </div>
            )}
            {isBoosted && (
              <div className="text-center">
                <span className="text-[9px] font-display uppercase tracking-widest text-blue-400 flex items-center justify-center gap-1 animate-pulse">
                  <Zap className="w-3 h-3" /> BOOST
                </span>
              </div>
            )}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Рекорд</span>
              <p className="text-lg font-black font-display text-zn-hot">{formatScore(currentHighScore)}</p>
            </div>

            {/* Settings */}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400 block mb-2 text-center">Трудност</span>
              <div className="flex flex-col gap-1">
                {Object.keys(SPEED_BY_DIFFICULTY).map((diff) => (
                  <button key={diff} type="button" disabled={gameStatus === 'playing'} onClick={() => setDifficulty(diff)}
                    className={`px-2 py-1.5 text-xs font-display uppercase tracking-widest border-2 transition-colors ${difficulty === diff ? 'border-[#1C1428] dark:border-zinc-500 bg-zn-hot text-white' : 'border-transparent text-zn-text/60 dark:text-zinc-400 hover:bg-zn-paper dark:hover:bg-zinc-800'} ${gameStatus === 'playing' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {DIFFICULTY_LABELS[diff]}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" disabled={gameStatus === 'playing'} onClick={() => setWrapMode(!wrapMode)}
              className={`comic-panel p-2 text-center font-display uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-1 ${wrapMode ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-zinc-900 text-zn-text/50 dark:text-zinc-400'} ${gameStatus === 'playing' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Shield className="w-3 h-3" /> Wrap {wrapMode ? 'ВКЛ' : 'ИЗКЛ'}
            </button>
          </div>

          {/* Center — board */}
          <div className="flex flex-col items-center gap-4">
            {/* Mobile stats */}
            <div className="flex md:hidden gap-2 text-center flex-wrap justify-center">
              <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Точки</span>
                <span className="text-sm font-black font-display text-zn-text dark:text-white">{formatScore(score)}</span>
              </div>
              <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Дължина</span>
                <span className="text-sm font-black font-display text-emerald-600 dark:text-emerald-400">{snake.length}</span>
              </div>
              {combo > 1 && (
                <div className="comic-panel bg-zn-hot/10 dark:bg-zn-hot/20 px-2.5 py-1.5">
                  <span className="text-[8px] font-display uppercase tracking-widest text-zn-hot block">Combo</span>
                  <span className="text-sm font-black font-display text-zn-hot">{combo}x</span>
                </div>
              )}
            </div>

            {/* Mobile settings */}
            <div className="flex md:hidden gap-2 flex-wrap justify-center">
              {Object.keys(SPEED_BY_DIFFICULTY).map((diff) => (
                <button key={diff} type="button" disabled={gameStatus === 'playing'} onClick={() => setDifficulty(diff)}
                  className={`px-3 py-1 text-xs font-display uppercase tracking-widest border-2 transition-colors ${difficulty === diff ? 'border-[#1C1428] dark:border-zinc-500 bg-zn-hot text-white' : 'border-[#1C1428]/20 dark:border-zinc-700 text-zn-text/60 dark:text-zinc-400'} ${gameStatus === 'playing' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {DIFFICULTY_LABELS[diff]}
                </button>
              ))}
              <button type="button" disabled={gameStatus === 'playing'} onClick={() => setWrapMode(!wrapMode)}
                className={`px-3 py-1 text-xs font-display uppercase tracking-widest border-2 transition-colors ${wrapMode ? 'border-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'border-[#1C1428]/20 dark:border-zinc-700 text-zn-text/60 dark:text-zinc-400'} ${gameStatus === 'playing' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                Wrap
              </button>
            </div>

            <div className="comic-panel bg-[#0d0d1a] p-2 relative">
              {gameStatus === 'paused' && (
                <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-white font-display text-3xl uppercase tracking-widest mb-4">Пауза</p>
                    <button type="button" onClick={togglePause} className="bg-emerald-600 text-white font-display uppercase tracking-widest px-6 py-3 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform">
                      <Play className="w-5 h-5 inline mr-2" />Продължи
                    </button>
                  </div>
                </div>
              )}

              {gameStatus === 'over' && (
                <div className="absolute inset-0 z-20 bg-black/85 flex items-center justify-center">
                  <div className="text-center px-4">
                    <p className="text-zn-hot font-display text-3xl uppercase tracking-widest mb-1 font-black">Край!</p>
                    {deathReason && <p className="text-white/50 text-xs mb-2">{DEATH_LABELS[deathReason] || deathReason}</p>}
                    <p className="text-white font-display text-lg mb-1">{formatScore(score)} точки</p>
                    <p className="text-white/60 text-sm mb-1">Дължина: {snake.length} • {DIFFICULTY_LABELS[difficulty]}{wrapMode ? ' (wrap)' : ''}</p>
                    <p className="text-white/40 text-xs mb-3">{gameState.foodEaten} храни • max дължина {gameState.maxLength}</p>
                    {score >= currentHighScore && score > 0 && (
                      <p className="text-yellow-400 font-display uppercase tracking-widest text-sm mb-3 flex items-center justify-center gap-2">
                        <Trophy className="w-4 h-4" /> Нов рекорд!
                      </p>
                    )}
                    <div className="flex gap-3 justify-center">
                      <button type="button" onClick={startGame} className="bg-emerald-600 text-white font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <RotateCcw className="w-4 h-4 inline mr-1" />Пак
                      </button>
                      <button type="button" onClick={handleShare} className="bg-white text-zn-text font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <Share2 className="w-4 h-4 inline mr-1" />Сподели
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {gameStatus === 'idle' && (
                <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
                  <div className="text-center px-4">
                    <p className="text-white font-display text-4xl uppercase tracking-widest mb-3 font-black">Змия</p>
                    <div className="flex gap-4 justify-center mb-4 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F44336' }} />
                        <span className="text-white/60">+10</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFD700' }} />
                        <span className="text-white/60">+30</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2196F3' }} />
                        <span className="text-white/60">Boost</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E040FB' }} />
                        <span className="text-white/60">-2</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#FF9800' }} />
                        <span className="text-white/60">+50</span>
                      </div>
                    </div>
                    <p className="text-white/40 text-[10px] mb-5 max-w-[250px] mx-auto">Стрелки/WASD. На Hard — появяват се препятствия. Wrap — змията излиза от другата страна.</p>
                    <button type="button" onClick={startGame} className="bg-emerald-600 text-white font-display uppercase tracking-widest px-8 py-3 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform">
                      <Play className="w-5 h-5 inline mr-2" />Старт
                    </button>
                  </div>
                </div>
              )}

              <div
                style={{ position: 'relative', zIndex: 0, touchAction: 'none' }}
                onTouchStart={handleBoardTouchStart}
                onTouchEnd={handleBoardTouchEnd}
              >
                <SnakeBoard snake={snake} food={food} obstacles={obstacles} wrapMode={wrapMode} floatingLabel={floatingLabel} />
              </div>

              {shareNotice && gameStatus === 'over' && (
                <p className={`mt-3 text-center text-xs font-display uppercase tracking-widest ${shareNotice.tone === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {shareNotice.message}
                </p>
              )}
            </div>

            <div className="flex md:hidden gap-2">
              {gameStatus === 'playing' && (
                <button type="button" onClick={togglePause} className="comic-panel bg-white dark:bg-zinc-900 px-4 py-2 font-display uppercase text-xs tracking-widest">
                  <Pause className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="hidden md:flex flex-col gap-3 w-36">
            {/* Food legend */}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400 block mb-2 text-center">Храни</span>
              <div className="space-y-1.5">
                {Object.entries(FOOD_TYPES).map(([key, def]) => (
                  <div key={key} className="flex items-center gap-2 text-[10px]">
                    <span className="w-3.5 h-3.5 shrink-0" style={{ backgroundColor: def.color, borderRadius: key === 'mega' ? 3 : '50%', border: `1px solid ${def.border}` }} />
                    <span className="text-zn-text/70 dark:text-zinc-400">
                      {key === 'normal' ? 'Обикновена' : key === 'golden' ? 'Златна' : key === 'speed' ? 'Ускорение' : key === 'shrink' ? 'Свиване' : 'Мега'}
                    </span>
                    <span className="ml-auto font-black text-zn-text/80 dark:text-zinc-300">+{def.points}</span>
                  </div>
                ))}
              </div>
            </div>

            {gameStatus === 'playing' && (
              <button type="button" onClick={togglePause} className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-xs tracking-widest text-zn-text dark:text-white hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
                <Pause className="w-4 h-4 mx-auto mb-1" />Пауза
              </button>
            )}
            {(gameStatus === 'idle' || gameStatus === 'over') && (
              <button type="button" onClick={startGame} className="comic-panel bg-emerald-600 text-white p-3 text-center font-display uppercase text-xs tracking-widest hover:bg-emerald-700 transition-colors">
                <Play className="w-4 h-4 mx-auto mb-1" />{gameStatus === 'over' ? 'Нова игра' : 'Старт'}
              </button>
            )}
            <button type="button" onClick={() => setShowHelp(!showHelp)} className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-[10px] tracking-widest text-zn-text/60 dark:text-zinc-400 hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
              ?  Помощ
            </button>
          </div>
        </div>

        {showHelp && (
          <div className="comic-panel bg-white dark:bg-zinc-900 p-5 max-w-md mx-auto mt-6">
            <h3 className="font-display text-lg uppercase tracking-widest text-zn-text dark:text-white mb-3">Управление</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-zn-text/80 dark:text-zinc-300">
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">← → ↑ ↓ / WASD</span><span>Посока</span>
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">P / Esc</span><span>Пауза</span>
            </div>
            <div className="mt-3 pt-3 border-t border-zn-text/10 dark:border-zinc-700 text-[11px] text-zn-text/60 dark:text-zinc-400 space-y-1">
              <p><strong>Combo:</strong> Яж бързо — всяка поредна храна в рамките на {COMBO_TIMEOUT_SECONDS} секунди увеличава множителя.</p>
              <p><strong>Hard mode:</strong> На всеки 100 точки се появяват сиви препятствия.</p>
              <p><strong>Wrap:</strong> Стените стават портали — излизаш от другата страна.</p>
              <p><strong>Скоростта расте</strong> с всеки 5 сегмента — дългата змия е бърза змия!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
