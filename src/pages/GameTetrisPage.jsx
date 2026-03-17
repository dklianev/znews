import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw, Share2, Trophy, Zap } from 'lucide-react';
import {
  BOARD_COLS,
  BOARD_ROWS,
  calculateScore,
  clearLines,
  createBag,
  createEmptyBoard,
  createStats,
  detectTSpin,
  drawFromBag,
  getDropSpeed,
  getGhostPosition,
  getLevel,
  hardDrop,
  isValidPosition,
  isPerfectClear,
  lockPiece,
  pieceFromKey,
  POINTS,
  QUEUE_SIZE,
  tryRotate,
  updateStats,
} from '../utils/tetris';
import { loadScopedGameProgress, saveScopedGameProgress } from '../utils/gameStorage';
import TetrisBoard from '../components/games/tetris/TetrisBoard';
import TetrisPreview from '../components/games/tetris/TetrisPreview';

const GAME_SLUG = 'tetris';
const STORAGE_SCOPE = 'session';
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;
const START_LEVELS = [1, 5, 10, 15];

function formatScore(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function GameTetrisPage() {
  const [board, setBoard] = useState(createEmptyBoard);
  const [piece, setPiece] = useState(null);
  const [bag, setBag] = useState(() => createBag());
  const [queue, setQueue] = useState([]);
  const [holdKey, setHoldKey] = useState(null);
  const [holdUsed, setHoldUsed] = useState(false);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [combo, setCombo] = useState(-1);
  const [backToBack, setBackToBack] = useState(false);
  const [gameStatus, setGameStatus] = useState('idle');
  const [startLevel, setStartLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [stats, setStats] = useState(createStats);
  const [clearLabel, setClearLabel] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // Refs for accessing state in callbacks without stale closures
  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const bagRef = useRef(bag);
  const queueRef = useRef(queue);
  const holdKeyRef = useRef(holdKey);
  const holdUsedRef = useRef(holdUsed);
  const scoreRef = useRef(score);
  const linesRef = useRef(lines);
  const comboRef = useRef(combo);
  const backToBackRef = useRef(backToBack);
  const statusRef = useRef(gameStatus);
  const startLevelRef = useRef(startLevel);
  const statsRef = useRef(stats);
  const dropTimerRef = useRef(null);
  const lockTimerRef = useRef(null);
  const lockResetsRef = useRef(0);
  const clearLabelTimerRef = useRef(null);

  boardRef.current = board;
  pieceRef.current = piece;
  bagRef.current = bag;
  queueRef.current = queue;
  holdKeyRef.current = holdKey;
  holdUsedRef.current = holdUsed;
  scoreRef.current = score;
  linesRef.current = lines;
  comboRef.current = combo;
  backToBackRef.current = backToBack;
  statusRef.current = gameStatus;
  startLevelRef.current = startLevel;
  statsRef.current = stats;

  const level = useMemo(() => getLevel(lines, startLevel - 1), [lines, startLevel]);

  // Load high score on mount
  useEffect(() => {
    const saved = loadScopedGameProgress(GAME_SLUG, STORAGE_SCOPE);
    if (saved?.highScore) setHighScore(saved.highScore);
  }, []);

  const saveHighScore = useCallback((newScore) => {
    const saved = loadScopedGameProgress(GAME_SLUG, STORAGE_SCOPE) || {};
    const best = Math.max(newScore, saved.highScore || 0);
    saveScopedGameProgress(GAME_SLUG, STORAGE_SCOPE, { highScore: best });
    setHighScore(best);
  }, []);

  const showClearLabel = useCallback((label) => {
    if (clearLabelTimerRef.current) clearTimeout(clearLabelTimerRef.current);
    setClearLabel(label);
    clearLabelTimerRef.current = setTimeout(() => setClearLabel(null), 1500);
  }, []);

  const spawnPiece = useCallback(() => {
    const q = queueRef.current;
    const b = bagRef.current;

    const nextKey = q[0];
    const newQueue = q.slice(1);

    // Refill queue
    const needed = QUEUE_SIZE - newQueue.length;
    if (needed > 0) {
      const { keys, bag: remaining } = drawFromBag(b, needed);
      newQueue.push(...keys);
      setBag(remaining);
    }

    setQueue(newQueue);

    const newPiece = pieceFromKey(nextKey);
    if (!isValidPosition(boardRef.current, newPiece.shape, newPiece.row, newPiece.col)) {
      setGameStatus('over');
      saveHighScore(scoreRef.current);
      return;
    }

    setPiece(newPiece);
    setHoldUsed(false);
    lockResetsRef.current = 0;
  }, [saveHighScore]);

  const cancelLockTimer = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  const lockAndSpawn = useCallback(() => {
    cancelLockTimer();
    const p = pieceRef.current;
    const b = boardRef.current;
    if (!p) return;

    const tSpin = detectTSpin(b, p);
    const locked = lockPiece(b, p);
    const { board: cleared, linesCleared } = clearLines(locked);
    const perfect = linesCleared > 0 && isPerfectClear(cleared);

    const newCombo = linesCleared > 0 ? comboRef.current + 1 : -1;
    const { points, isSpecial, label } = calculateScore(
      linesCleared,
      getLevel(linesRef.current, startLevelRef.current - 1),
      tSpin,
      Math.max(0, newCombo),
      backToBackRef.current,
      perfect,
    );

    const newStats = updateStats(statsRef.current, linesCleared, tSpin, Math.max(0, newCombo), perfect);

    setBoard(cleared);
    setScore((s) => s + points);
    setLines((l) => l + linesCleared);
    setCombo(newCombo);
    setStats(newStats);
    if (linesCleared > 0) {
      setBackToBack(isSpecial);
      if (label) showClearLabel(newCombo > 0 ? `${label} (${newCombo}x COMBO)` : label);
    }

    setPiece(null);
    setTimeout(() => spawnPiece(), 50);
  }, [spawnPiece, showClearLabel, cancelLockTimer]);

  const startLockDelay = useCallback(() => {
    cancelLockTimer();
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      lockAndSpawn();
    }, LOCK_DELAY);
  }, [lockAndSpawn, cancelLockTimer]);

  const resetLockDelay = useCallback(() => {
    if (lockTimerRef.current && lockResetsRef.current < MAX_LOCK_RESETS) {
      lockResetsRef.current += 1;
      startLockDelay();
    }
  }, [startLockDelay]);

  const moveDown = useCallback(() => {
    const p = pieceRef.current;
    const b = boardRef.current;
    if (!p || statusRef.current !== 'playing') return;

    if (isValidPosition(b, p.shape, p.row + 1, p.col)) {
      setPiece({ ...p, row: p.row + 1, lastAction: 'move' });
      cancelLockTimer();
    } else if (!lockTimerRef.current) {
      startLockDelay();
    }
  }, [startLockDelay, cancelLockTimer]);

  // Hold piece
  const holdPiece = useCallback(() => {
    if (holdUsedRef.current || statusRef.current !== 'playing') return;
    const p = pieceRef.current;
    if (!p) return;

    cancelLockTimer();
    const prevHold = holdKeyRef.current;
    setHoldKey(p.type);
    setHoldUsed(true);

    if (prevHold) {
      const newPiece = pieceFromKey(prevHold);
      if (isValidPosition(boardRef.current, newPiece.shape, newPiece.row, newPiece.col)) {
        setPiece(newPiece);
      }
    } else {
      setPiece(null);
      setTimeout(() => spawnPiece(), 50);
    }
  }, [spawnPiece, cancelLockTimer]);

  // Gravity timer
  useEffect(() => {
    if (gameStatus !== 'playing' || !piece) {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current);
      return;
    }
    const speed = getDropSpeed(level);
    dropTimerRef.current = setInterval(moveDown, speed);
    return () => clearInterval(dropTimerRef.current);
  }, [gameStatus, piece, level, moveDown]);

  const startGame = useCallback(() => {
    const newBag = createBag();
    const { keys: initialQueue, bag: remaining } = drawFromBag(newBag, QUEUE_SIZE + 1);

    setBoard(createEmptyBoard());
    setScore(0);
    setLines(0);
    setCombo(-1);
    setBackToBack(false);
    setHoldKey(null);
    setHoldUsed(false);
    setStats(createStats());
    setClearLabel(null);
    setBag(remaining);
    setQueue(initialQueue.slice(1));
    setPiece(pieceFromKey(initialQueue[0]));
    setGameStatus('playing');
  }, []);

  const togglePause = useCallback(() => {
    setGameStatus((s) => (s === 'playing' ? 'paused' : s === 'paused' ? 'playing' : s));
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
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
      if (statusRef.current !== 'playing') return;

      const p = pieceRef.current;
      const b = boardRef.current;
      if (!p) return;

      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A':
          e.preventDefault();
          if (isValidPosition(b, p.shape, p.row, p.col - 1)) {
            setPiece({ ...p, col: p.col - 1, lastAction: 'move' });
            resetLockDelay();
          }
          break;
        case 'ArrowRight': case 'd': case 'D':
          e.preventDefault();
          if (isValidPosition(b, p.shape, p.row, p.col + 1)) {
            setPiece({ ...p, col: p.col + 1, lastAction: 'move' });
            resetLockDelay();
          }
          break;
        case 'ArrowDown': case 's': case 'S':
          e.preventDefault();
          if (isValidPosition(b, p.shape, p.row + 1, p.col)) {
            setPiece({ ...p, row: p.row + 1, lastAction: 'move' });
            setScore((s) => s + POINTS.SOFT_DROP);
            cancelLockTimer();
          }
          break;
        case 'ArrowUp': case 'w': case 'W': {
          e.preventDefault();
          const rotated = tryRotate(b, p, true);
          if (rotated) { setPiece(rotated); resetLockDelay(); }
          break;
        }
        case 'z': case 'Z': {
          e.preventDefault();
          const rotatedCCW = tryRotate(b, p, false);
          if (rotatedCCW) { setPiece(rotatedCCW); resetLockDelay(); }
          break;
        }
        case 'c': case 'C': case 'Shift':
          e.preventDefault();
          holdPiece();
          break;
        case ' ': {
          e.preventDefault();
          cancelLockTimer();
          const { piece: dropped, cellsDropped } = hardDrop(b, p);
          setScore((s) => s + cellsDropped * POINTS.HARD_DROP);

          const tSpin = detectTSpin(b, dropped);
          const locked = lockPiece(b, dropped);
          const { board: cleared, linesCleared } = clearLines(locked);
          const perfect = linesCleared > 0 && isPerfectClear(cleared);
          const newCombo = linesCleared > 0 ? comboRef.current + 1 : -1;
          const { points, isSpecial, label } = calculateScore(
            linesCleared,
            getLevel(linesRef.current, startLevelRef.current - 1),
            tSpin, Math.max(0, newCombo), backToBackRef.current, perfect,
          );
          const newStats = updateStats(statsRef.current, linesCleared, tSpin, Math.max(0, newCombo), perfect);

          setBoard(cleared);
          setScore((s) => s + points);
          setLines((l) => l + linesCleared);
          setCombo(newCombo);
          setStats(newStats);
          if (linesCleared > 0) {
            setBackToBack(isSpecial);
            if (label) showClearLabel(newCombo > 0 ? `${label} (${newCombo}x COMBO)` : label);
          }
          setPiece(null);
          setHoldUsed(false);
          lockResetsRef.current = 0;
          setTimeout(() => spawnPiece(), 50);
          break;
        }
        default: break;
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [startGame, togglePause, spawnPiece, holdPiece, resetLockDelay, cancelLockTimer, showClearLabel]);

  // Touch controls
  const touchStartRef = useRef(null);
  useEffect(() => {
    function handleTouchStart(e) {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }
    function handleTouchEnd(e) {
      if (!touchStartRef.current || statusRef.current !== 'playing') return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      const p = pieceRef.current;
      const b = boardRef.current;
      if (!p) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < 20 && absDy < 20 && dt < 300) {
        const rotated = tryRotate(b, p, true);
        if (rotated) { setPiece(rotated); resetLockDelay(); }
        return;
      }

      if (dy > 60 && absDy > absDx * 1.5) {
        cancelLockTimer();
        const { piece: dropped, cellsDropped } = hardDrop(b, p);
        setScore((s) => s + cellsDropped * POINTS.HARD_DROP);
        const tSpin = detectTSpin(b, dropped);
        const locked = lockPiece(b, dropped);
        const { board: cleared, linesCleared } = clearLines(locked);
        const perfect = linesCleared > 0 && isPerfectClear(cleared);
        const newCombo = linesCleared > 0 ? comboRef.current + 1 : -1;
        const { points, isSpecial, label } = calculateScore(
          linesCleared, getLevel(linesRef.current, startLevelRef.current - 1),
          tSpin, Math.max(0, newCombo), backToBackRef.current, perfect,
        );
        setBoard(cleared);
        setScore((s) => s + points);
        setLines((l) => l + linesCleared);
        setCombo(newCombo);
        if (linesCleared > 0) { setBackToBack(isSpecial); if (label) showClearLabel(label); }
        setPiece(null);
        setHoldUsed(false);
        setTimeout(() => spawnPiece(), 50);
        return;
      }

      if (absDx > 30 && absDx > absDy) {
        const dir = dx > 0 ? 1 : -1;
        if (isValidPosition(b, p.shape, p.row, p.col + dir)) {
          setPiece({ ...p, col: p.col + dir, lastAction: 'move' });
          resetLockDelay();
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [spawnPiece, resetLockDelay, cancelLockTimer, showClearLabel]);

  const ghostRow = piece ? getGhostPosition(board, piece) : 0;

  const handleShare = useCallback(() => {
    const text = `zNews Тетрис\n🏆 ${formatScore(score)} точки\n📊 Ниво ${level + 1} | ${lines} линии\n🎯 ${stats.tetrises} Tetris-а | ${stats.tSpins} T-Spin-а`;
    navigator.clipboard.writeText(text).then(() => alert('Резултатът е копиран!'));
  }, [score, level, lines, stats]);

  return (
    <div className="min-h-screen bg-zn-paper comic-dots dark:bg-zinc-950 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-b from-zn-purple-deep via-zn-purple to-zn-purple-light dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800 pt-6 pb-10 mb-8 border-b-4 border-[#1C1428] dark:border-zinc-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <Link to="/games" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 font-display text-sm uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Всички игри
          </Link>
          <p className="text-yellow-400 font-display text-xs uppercase tracking-[0.3em] mb-1">Безкраен режим</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-white font-display tracking-wider leading-none mb-2" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.3)' }}>
            Тетрис
          </h1>
          <p className="text-white/60 text-sm font-semibold max-w-md">
            Hold, T-Spin, Back-to-Back, Combo — пълната механика.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-4 items-start justify-center">
          {/* Left panel — hold + stats */}
          <div className="hidden md:flex flex-col gap-3 w-32">
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 flex flex-col items-center">
              <TetrisPreview pieceKey={holdKey} label="Hold (C)" />
              {holdUsed && <span className="text-[9px] text-zn-text/40 dark:text-zinc-500 mt-1 font-display uppercase">Използван</span>}
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Точки</span>
              <p className="text-xl font-black font-display text-zn-text dark:text-white">{formatScore(score)}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Ниво</span>
              <p className="text-xl font-black font-display text-zn-purple dark:text-zn-purple-light">{level + 1}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Линии</span>
              <p className="text-xl font-black font-display text-zn-text dark:text-white">{lines}</p>
            </div>
            {combo > 0 && (
              <div className="comic-panel bg-zn-hot/10 dark:bg-zn-hot/20 border-zn-hot/30 p-2 text-center">
                <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-hot">Combo</span>
                <p className="text-lg font-black font-display text-zn-hot">{combo}x</p>
              </div>
            )}
            {backToBack && (
              <div className="text-center">
                <span className="text-[9px] font-display uppercase tracking-widest text-yellow-500 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3" /> B2B
                </span>
              </div>
            )}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Рекорд</span>
              <p className="text-lg font-black font-display text-zn-hot">{formatScore(highScore)}</p>
            </div>
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
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Ниво</span>
                <span className="text-sm font-black font-display text-zn-purple dark:text-zn-purple-light">{level + 1}</span>
              </div>
              <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Линии</span>
                <span className="text-sm font-black font-display text-zn-text dark:text-white">{lines}</span>
              </div>
              {combo > 0 && (
                <div className="comic-panel bg-zn-hot/10 dark:bg-zn-hot/20 px-2.5 py-1.5">
                  <span className="text-[8px] font-display uppercase tracking-widest text-zn-hot block">Combo</span>
                  <span className="text-sm font-black font-display text-zn-hot">{combo}x</span>
                </div>
              )}
            </div>

            <div className="comic-panel bg-[#0d0d1a] p-2 relative">
              {/* Clear label overlay */}
              {clearLabel && gameStatus === 'playing' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                  <p className="text-yellow-400 font-display text-sm md:text-base uppercase tracking-widest font-black text-center whitespace-nowrap px-3 py-1 bg-black/70 border border-yellow-400/40" style={{ textShadow: '0 0 10px rgba(255,215,0,0.5)' }}>
                    {clearLabel}
                  </p>
                </div>
              )}

              {/* Paused overlay */}
              {gameStatus === 'paused' && (
                <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-white font-display text-3xl uppercase tracking-widest mb-4">Пауза</p>
                    <button type="button" onClick={togglePause} className="bg-zn-hot text-white font-display uppercase tracking-widest px-6 py-3 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform">
                      <Play className="w-5 h-5 inline mr-2" />Продължи
                    </button>
                  </div>
                </div>
              )}

              {/* Game over overlay */}
              {gameStatus === 'over' && (
                <div className="absolute inset-0 z-20 bg-black/85 flex items-center justify-center">
                  <div className="text-center px-4 max-h-full overflow-y-auto py-4">
                    <p className="text-zn-hot font-display text-3xl uppercase tracking-widest mb-2 font-black">Край!</p>
                    <p className="text-white font-display text-lg mb-1">{formatScore(score)} точки</p>
                    <p className="text-white/60 text-sm mb-2">Ниво {level + 1} • {lines} линии</p>
                    {score >= highScore && score > 0 && (
                      <p className="text-yellow-400 font-display uppercase tracking-widest text-sm mb-2 flex items-center justify-center gap-2">
                        <Trophy className="w-4 h-4" /> Нов рекорд!
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-white/50 mb-3 max-w-[200px] mx-auto">
                      <span>Фигури: {stats.piecesPlaced}</span>
                      <span>Tetris: {stats.tetrises}</span>
                      <span>T-Spin: {stats.tSpins}</span>
                      <span>Max Combo: {stats.maxCombo}</span>
                      {stats.perfectClears > 0 && <span className="col-span-2 text-yellow-400">Perfect Clears: {stats.perfectClears}</span>}
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button type="button" onClick={startGame} className="bg-zn-hot text-white font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <RotateCcw className="w-4 h-4 inline mr-1" />Пак
                      </button>
                      <button type="button" onClick={handleShare} className="bg-white text-zn-text font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <Share2 className="w-4 h-4 inline mr-1" />Сподели
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Start screen */}
              {gameStatus === 'idle' && (
                <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
                  <div className="text-center px-4">
                    <p className="text-white font-display text-4xl uppercase tracking-widest mb-4 font-black">Тетрис</p>
                    <div className="mb-4">
                      <p className="text-white/50 text-[10px] font-display uppercase tracking-widest mb-2">Начално ниво</p>
                      <div className="flex gap-2 justify-center">
                        {START_LEVELS.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setStartLevel(lvl)}
                            className={`w-10 h-10 font-display font-black text-lg border-2 transition-colors ${
                              startLevel === lvl
                                ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400'
                                : 'border-white/20 text-white/40 hover:border-white/40'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-white/40 text-[10px] mb-4 max-w-[240px] mx-auto leading-relaxed">
                      ← → движение • ↑ завъртане • Z обратно • Space хвърляне • C hold • P пауза
                    </p>
                    <button type="button" onClick={startGame} className="bg-zn-hot text-white font-display uppercase tracking-widest px-8 py-3 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform">
                      <Play className="w-5 h-5 inline mr-2" />Старт
                    </button>
                  </div>
                </div>
              )}

              <div style={{ position: 'relative', zIndex: 0 }}>
                <TetrisBoard board={board} piece={piece} ghostRow={ghostRow} />
              </div>
            </div>

            {/* Mobile hold + pause */}
            <div className="flex md:hidden gap-2">
              {gameStatus === 'playing' && (
                <>
                  <button type="button" onClick={holdPiece} className={`comic-panel px-3 py-2 font-display uppercase text-[10px] tracking-widest ${holdUsed ? 'bg-zinc-200 dark:bg-zinc-800 text-zn-text/30' : 'bg-white dark:bg-zinc-900'}`} disabled={holdUsed}>
                    Hold
                  </button>
                  <button type="button" onClick={togglePause} className="comic-panel bg-white dark:bg-zinc-900 px-4 py-2 font-display uppercase text-xs tracking-widest">
                    <Pause className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right panel — queue + controls */}
          <div className="hidden md:flex flex-col gap-3 w-32">
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 flex flex-col items-center gap-2">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Следващи</span>
              {queue.slice(0, QUEUE_SIZE).map((key, idx) => (
                <TetrisPreview key={`${key}-${idx}`} pieceKey={key} small={idx > 0} />
              ))}
            </div>
            {gameStatus === 'playing' && (
              <button type="button" onClick={togglePause} className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-xs tracking-widest text-zn-text dark:text-white hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
                <Pause className="w-4 h-4 mx-auto mb-1" />Пауза
              </button>
            )}
            {(gameStatus === 'idle' || gameStatus === 'over') && (
              <button type="button" onClick={startGame} className="comic-panel bg-zn-hot text-white p-3 text-center font-display uppercase text-xs tracking-widest hover:bg-zn-hot-dark transition-colors">
                <Play className="w-4 h-4 mx-auto mb-1" />{gameStatus === 'over' ? 'Нова игра' : 'Старт'}
              </button>
            )}
            <button type="button" onClick={() => setShowStats(!showStats)} className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-[10px] tracking-widest text-zn-text/60 dark:text-zinc-400 hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
              Статистика
            </button>
            <button type="button" onClick={() => setShowHelp(!showHelp)} className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-[10px] tracking-widest text-zn-text/60 dark:text-zinc-400 hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
              ?  Помощ
            </button>
          </div>
        </div>

        {/* Stats panel */}
        {showStats && (
          <div className="comic-panel bg-white dark:bg-zinc-900 p-5 max-w-md mx-auto mt-6">
            <h3 className="font-display text-lg uppercase tracking-widest text-zn-text dark:text-white mb-3">Статистика</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-zn-text/80 dark:text-zinc-300">
              <span>Фигури поставени</span><span className="font-black text-right">{stats.piecesPlaced}</span>
              <span>Singles</span><span className="font-black text-right">{stats.singles}</span>
              <span>Doubles</span><span className="font-black text-right">{stats.doubles}</span>
              <span>Triples</span><span className="font-black text-right">{stats.triples}</span>
              <span>Tetris-и</span><span className="font-black text-right text-zn-hot">{stats.tetrises}</span>
              <span>T-Spin-ове</span><span className="font-black text-right text-zn-purple">{stats.tSpins}</span>
              <span>Max Combo</span><span className="font-black text-right">{stats.maxCombo}</span>
              <span>Perfect Clears</span><span className="font-black text-right text-yellow-500">{stats.perfectClears}</span>
            </div>
          </div>
        )}

        {showHelp && (
          <div className="comic-panel bg-white dark:bg-zinc-900 p-5 max-w-md mx-auto mt-6">
            <h3 className="font-display text-lg uppercase tracking-widest text-zn-text dark:text-white mb-3">Управление</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-zn-text/80 dark:text-zinc-300">
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">← → / A D</span><span>Движение</span>
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">↑ / W</span><span>Завъртане по ч.с.</span>
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">Z</span><span>Завъртане обратно</span>
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">↓ / S</span><span>Бързо надолу</span>
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">Space</span><span>Хвърляне</span>
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">C / Shift</span><span>Hold фигура</span>
              <span className="font-mono bg-zn-paper dark:bg-zinc-800 px-2 py-1 text-center">P / Esc</span><span>Пауза</span>
            </div>
            <p className="text-xs text-zn-text/50 dark:text-zinc-500 mt-3">На телефон: tap = завъртане, swipe = движение, swipe надолу = хвърляне.</p>
            <div className="mt-3 pt-3 border-t border-zn-text/10 dark:border-zinc-700">
              <p className="text-[11px] text-zn-text/60 dark:text-zinc-400"><strong>T-Spin:</strong> Завъртете T-фигура в тясно пространство за бонус точки.</p>
              <p className="text-[11px] text-zn-text/60 dark:text-zinc-400"><strong>Back-to-Back:</strong> Поредни Tetris/T-Spin дават ×1.5 бонус.</p>
              <p className="text-[11px] text-zn-text/60 dark:text-zinc-400"><strong>Combo:</strong> Поредни линии увеличават множителя.</p>
              <p className="text-[11px] text-zn-text/60 dark:text-zinc-400"><strong>Perfect Clear:</strong> Изчистете цялото поле за 3000× бонус.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
