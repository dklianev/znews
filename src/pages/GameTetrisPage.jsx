import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RotateCcw, Share2, Trophy, Zap, Settings, Grid3X3 } from 'lucide-react';
import {
  BOARD_COLS,
  BOARD_ROWS,
  THEMES,
  addGarbageLine,
  calculateScore,
  clearLines,
  createBag,
  createEmptyBoard,
  createStats,
  detectTSpin,
  drawFromBag,
  getDropSpeed,
  getGarbageInterval,
  getGhostPosition,
  getLevel,
  hardDrop,
  isValidPosition,
  isPerfectClear,
  lockPiece,
  pieceFromKey,
  POINTS,
  tryRotate,
  tryRotate180,
  updateStats,
} from '../utils/tetris';
import { loadScopedGameProgress, saveScopedGameProgress } from '../utils/gameStorage';
import TetrisBoard from '../components/games/tetris/TetrisBoard';
import TetrisPreview from '../components/games/tetris/TetrisPreview';

/* ── Constants ── */

const GAME_SLUG = 'tetris';
const STORAGE_SCOPE = 'session';
const LOCK_DELAY = 500;
const MAX_LOCK_RESETS = 15;
const START_LEVELS = [1, 5, 10, 15];
const COUNTDOWN_STEPS = [3, 2, 1, 'GO'];

/* ── Handling defaults (tetr.io-style) ── */
const DEFAULT_HANDLING = {
  das: 133,   // Delayed Auto Shift (ms) — колко задържаш преди автоповторение
  arr: 0,     // Auto Repeat Rate (ms) — 0 = мигновен teleport до стената
  sdf: 41,    // Soft Drop Factor — множител на gravity; Infinity = мигновен
  dcd: 0,     // DAS Cut Delay (ms) — пауза на DAS след заключване на фигура
};

const HANDLING_LABELS = {
  das: { name: 'DAS', desc: 'Забавяне преди автоповторение', min: 0, max: 300, step: 1, unit: 'ms' },
  arr: { name: 'ARR', desc: 'Скорост на автоповторение (0 = мигновен)', min: 0, max: 100, step: 1, unit: 'ms' },
  sdf: { name: 'SDF', desc: 'Множител на soft drop (41 = мигновен)', min: 1, max: 41, step: 1, unit: 'x' },
  dcd: { name: 'DCD', desc: 'Пауза на DAS след заключване', min: 0, max: 50, step: 1, unit: 'ms' },
};

const MODES = {
  marathon: { name: 'Маратон', desc: 'Безкраен режим', icon: '∞' },
  sprint: { name: 'Спринт', desc: '40 линии', icon: '⚡' },
  ultra: { name: 'Ултра', desc: '2 минути', icon: '⏱️' },
  challenge: { name: 'Предизв.', desc: '+ garbage', icon: '💀' },
};

const DEFAULT_KEYS = {
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  softDrop: 'ArrowDown',
  hardDrop: ' ',
  rotateCW: 'ArrowUp',
  rotateCCW: 'z',
  rotate180: 'x',
  hold: 'c',
  pause: 'p',
};

const ACTION_LABELS = {
  moveLeft: 'Наляво',
  moveRight: 'Надясно',
  softDrop: 'Надолу',
  hardDrop: 'Хвърляне',
  rotateCW: 'Завъртане ↻',
  rotateCCW: 'Завъртане ↺',
  rotate180: '180°',
  hold: 'Hold',
  pause: 'Пауза',
};

const KEY_DISPLAY = {
  ' ': 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Escape: 'Esc', Shift: 'Shift', Control: 'Ctrl', Enter: 'Enter',
};

const SETTINGS_KEY = 'tetris_settings';

function formatScore(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${min}:${String(sec).padStart(2, '0')}.${tenths}`;
}

function keyLabel(key) {
  return KEY_DISPLAY[key] || key.toUpperCase();
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => alert('Резултатът е копиран!')).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); alert('Резултатът е копиран!'); } catch (_) { /* noop */ }
  document.body.removeChild(ta);
}

function loadSettings() {
  const defaults = { theme: 'classic', showGrid: false, queueSize: 3, keys: { ...DEFAULT_KEYS }, handling: { ...DEFAULT_HANDLING } };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed, keys: { ...DEFAULT_KEYS, ...parsed.keys }, handling: { ...DEFAULT_HANDLING, ...parsed.handling } };
    }
  } catch (_) { /* noop */ }
  return defaults;
}

/* ── Component ── */

export default function GameTetrisPage() {
  /* Settings */
  const [settings, setSettings] = useState(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* noop */ } }, [settings]);

  /* Game state */
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
  const [gameStatus, setGameStatus] = useState('idle'); // idle | countdown | playing | paused | over | won
  const [startLevel, setStartLevel] = useState(1);
  const [highScores, setHighScores] = useState({});
  const [stats, setStats] = useState(createStats);
  const [clearLabel, setClearLabel] = useState(null);
  const [scorePopup, setScorePopup] = useState(null);
  const [flashRows, setFlashRows] = useState(null);
  const [shake, setShake] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [mode, setMode] = useState('marathon');
  const [elapsed, setElapsed] = useState(0); // ms for sprint timer
  const [remaining, setRemaining] = useState(120000); // ms for ultra timer

  /* UI state */
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [rebindAction, setRebindAction] = useState(null);

  /* Refs */
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
  const modeRef = useRef(mode);

  const dropTimerRef = useRef(null);
  const lockTimerRef = useRef(null);
  const lockResetsRef = useRef(0);
  const clearLabelTimerRef = useRef(null);
  const scorePopupTimerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const shakeTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const modeTimerRef = useRef(null);
  const garbageCounterRef = useRef(0);

  // DAS/ARR refs
  const heldActionsRef = useRef(new Set());
  const dasTimersRef = useRef({});
  const arrTimersRef = useRef({});
  const dcdActiveRef = useRef(false);
  const dcdTimerRef = useRef(null);

  // IRS/IHS — track held keys for Initial Rotation/Hold on spawn
  const heldKeysRef = useRef(new Set());

  /* Sync refs */
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
  modeRef.current = mode;

  const level = useMemo(() => getLevel(lines, startLevel - 1), [lines, startLevel]);
  const themeColors = useMemo(() => (THEMES[settings.theme] || THEMES.classic).colors, [settings.theme]);

  /* Load high scores */
  useEffect(() => {
    const saved = loadScopedGameProgress(GAME_SLUG, STORAGE_SCOPE);
    if (saved?.highScores) setHighScores(saved.highScores);
    else if (saved?.highScore) setHighScores({ marathon: saved.highScore });
  }, []);

  const currentHighScore = highScores[mode] || 0;

  const saveHighScore = useCallback((newScore, gameMode) => {
    const saved = loadScopedGameProgress(GAME_SLUG, STORAGE_SCOPE) || {};
    const prev = saved.highScores || {};
    const best = Math.max(newScore, prev[gameMode] || 0);
    const updated = { ...prev, [gameMode]: best };
    saveScopedGameProgress(GAME_SLUG, STORAGE_SCOPE, { highScores: updated });
    setHighScores(updated);
  }, []);

  /* ── Visual feedback helpers ── */

  const showClearLabel = useCallback((label) => {
    if (clearLabelTimerRef.current) clearTimeout(clearLabelTimerRef.current);
    setClearLabel(label);
    clearLabelTimerRef.current = setTimeout(() => setClearLabel(null), 1500);
  }, []);

  const showScorePopup = useCallback((pts) => {
    if (scorePopupTimerRef.current) clearTimeout(scorePopupTimerRef.current);
    setScorePopup(pts);
    scorePopupTimerRef.current = setTimeout(() => setScorePopup(null), 800);
  }, []);

  const triggerFlash = useCallback((rows) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashRows(rows);
    flashTimerRef.current = setTimeout(() => setFlashRows(null), 300);
  }, []);

  const triggerShake = useCallback(() => {
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setShake(true);
    shakeTimerRef.current = setTimeout(() => setShake(false), 200);
  }, []);

  /* ── Core game logic ── */

  const spawnPiece = useCallback(() => {
    const q = queueRef.current;
    const b = bagRef.current;
    const nextKey = q[0];
    const queueSize = settingsRef.current.queueSize;
    const newQueue = q.slice(1);

    const needed = queueSize - newQueue.length;
    if (needed > 0) {
      const { keys, bag: rem } = drawFromBag(b, needed);
      newQueue.push(...keys);
      setBag(rem);
    }
    setQueue(newQueue);

    let newPiece = pieceFromKey(nextKey);

    // IHS — Initial Hold System: if hold key is held, swap immediately
    const held = heldKeysRef.current;
    const keys = settingsRef.current.keys;
    const holdKeyHeld = held.has(keys.hold) || held.has(keys.hold?.toLowerCase?.());
    if (holdKeyHeld && !holdUsedRef.current && holdKeyRef.current) {
      const fromHold = pieceFromKey(holdKeyRef.current);
      if (isValidPosition(boardRef.current, fromHold.shape, fromHold.row, fromHold.col)) {
        setHoldKey(newPiece.type);
        setHoldUsed(true);
        newPiece = fromHold;
      }
    }

    if (!isValidPosition(boardRef.current, newPiece.shape, newPiece.row, newPiece.col)) {
      setGameStatus('over');
      saveHighScore(scoreRef.current, modeRef.current);
      return;
    }

    // IRS — Initial Rotation System: if rotation key is held, pre-rotate
    const cwHeld = held.has(keys.rotateCW) || held.has(keys.rotateCW?.toLowerCase?.());
    const ccwHeld = held.has(keys.rotateCCW) || held.has(keys.rotateCCW?.toLowerCase?.());
    const r180Held = held.has(keys.rotate180) || held.has(keys.rotate180?.toLowerCase?.());
    if (cwHeld) {
      const rotated = tryRotate(boardRef.current, newPiece, true);
      if (rotated) newPiece = rotated;
    } else if (ccwHeld) {
      const rotated = tryRotate(boardRef.current, newPiece, false);
      if (rotated) newPiece = rotated;
    } else if (r180Held) {
      const rotated = tryRotate180(boardRef.current, newPiece);
      if (rotated) newPiece = rotated;
    }

    setPiece(newPiece);
    setHoldUsed(holdKeyHeld && !holdUsedRef.current && holdKeyRef.current ? true : false);
    lockResetsRef.current = 0;
  }, [saveHighScore]);

  const cancelLockTimer = useCallback(() => {
    if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
  }, []);

  const processLock = useCallback((p, b) => {
    const tSpin = detectTSpin(b, p);
    const locked = lockPiece(b, p);
    const { board: cleared, linesCleared, clearedIndices } = clearLines(locked);
    const perfect = linesCleared > 0 && isPerfectClear(cleared);

    const newCombo = linesCleared > 0 ? comboRef.current + 1 : -1;
    const lvl = getLevel(linesRef.current, startLevelRef.current - 1);
    const { points, isSpecial, label } = calculateScore(
      linesCleared, lvl, tSpin, Math.max(0, newCombo), backToBackRef.current, perfect,
    );
    const newStats = updateStats(statsRef.current, linesCleared, tSpin, Math.max(0, newCombo), perfect);

    // Visual feedback
    if (linesCleared > 0) {
      triggerFlash(clearedIndices);
      if (points > 0) showScorePopup(points);
      if (linesCleared >= 4 || tSpin !== 'none') triggerShake();
    }

    setBoard(cleared);
    setScore((s) => s + points);
    setLines((l) => l + linesCleared);
    setCombo(newCombo);
    setStats(newStats);

    if (linesCleared > 0) {
      setBackToBack(isSpecial);
      if (label) showClearLabel(newCombo > 0 ? `${label} (${newCombo}x COMBO)` : label);
    }

    // Challenge mode: garbage lines
    if (modeRef.current === 'challenge') {
      garbageCounterRef.current += 1;
      const interval = getGarbageInterval(lvl);
      if (garbageCounterRef.current >= interval) {
        garbageCounterRef.current = 0;
        setBoard((prev) => addGarbageLine(prev));
      }
    }

    // Sprint mode: check win condition
    const totalLines = linesRef.current + linesCleared;
    if (modeRef.current === 'sprint' && totalLines >= 40) {
      setGameStatus('won');
      saveHighScore(scoreRef.current, 'sprint');
      return;
    }

    // Zero ARE — spawn next piece immediately (tetr.io style)
    setPiece(null);

    // DCD — DAS Cut Delay: pause DAS briefly after lock to prevent unintended carry-over
    const dcd = settingsRef.current.handling?.dcd || 0;
    if (dcd > 0) {
      dcdActiveRef.current = true;
      if (dcdTimerRef.current) clearTimeout(dcdTimerRef.current);
      dcdTimerRef.current = setTimeout(() => { dcdActiveRef.current = false; }, dcd);
    }

    spawnPiece();
  }, [spawnPiece, showClearLabel, showScorePopup, triggerFlash, triggerShake, saveHighScore]);

  const lockAndSpawn = useCallback(() => {
    cancelLockTimer();
    const p = pieceRef.current;
    const b = boardRef.current;
    if (!p) return;
    processLock(p, b);
  }, [processLock, cancelLockTimer]);

  const startLockDelay = useCallback(() => {
    cancelLockTimer();
    lockTimerRef.current = setTimeout(() => { lockTimerRef.current = null; lockAndSpawn(); }, LOCK_DELAY);
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

  const holdPieceFn = useCallback(() => {
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
      spawnPiece();
    }
  }, [spawnPiece, cancelLockTimer]);

  /* ── Movement actions (for DAS/ARR) ── */

  /** Move piece one cell or teleport to wall (ARR=0) */
  const executeMovement = useCallback((action, teleport = false) => {
    const p = pieceRef.current;
    const b = boardRef.current;
    if (!p || statusRef.current !== 'playing') return;
    if (dcdActiveRef.current && (action === 'moveLeft' || action === 'moveRight')) return;

    if (action === 'moveLeft') {
      if (teleport) {
        // ARR=0: teleport to leftmost valid position
        let newCol = p.col;
        while (isValidPosition(b, p.shape, p.row, newCol - 1)) newCol -= 1;
        if (newCol !== p.col) {
          setPiece((prev) => prev ? { ...prev, col: newCol, lastAction: 'move' } : prev);
          resetLockDelay();
        }
      } else if (isValidPosition(b, p.shape, p.row, p.col - 1)) {
        setPiece((prev) => prev ? { ...prev, col: prev.col - 1, lastAction: 'move' } : prev);
        resetLockDelay();
      }
    } else if (action === 'moveRight') {
      if (teleport) {
        let newCol = p.col;
        while (isValidPosition(b, p.shape, p.row, newCol + 1)) newCol += 1;
        if (newCol !== p.col) {
          setPiece((prev) => prev ? { ...prev, col: newCol, lastAction: 'move' } : prev);
          resetLockDelay();
        }
      } else if (isValidPosition(b, p.shape, p.row, p.col + 1)) {
        setPiece((prev) => prev ? { ...prev, col: prev.col + 1, lastAction: 'move' } : prev);
        resetLockDelay();
      }
    } else if (action === 'softDrop') {
      const sdf = settingsRef.current.handling?.sdf ?? 41;
      if (sdf >= 41) {
        // SDF=Infinity: instant soft drop to bottom (without locking)
        let newRow = p.row;
        let dropped = 0;
        while (isValidPosition(b, p.shape, newRow + 1, p.col)) { newRow += 1; dropped += 1; }
        if (dropped > 0) {
          setPiece((prev) => prev ? { ...prev, row: newRow, lastAction: 'move' } : prev);
          setScore((s) => s + dropped * POINTS.SOFT_DROP);
          cancelLockTimer();
        }
      } else {
        // Regular soft drop: one cell
        if (isValidPosition(b, p.shape, p.row + 1, p.col)) {
          setPiece((prev) => prev ? { ...prev, row: prev.row + 1, lastAction: 'move' } : prev);
          setScore((s) => s + POINTS.SOFT_DROP);
          cancelLockTimer();
        }
      }
    }
  }, [resetLockDelay, cancelLockTimer]);

  const startDAS = useCallback((action) => {
    if (heldActionsRef.current.has(action)) return;
    heldActionsRef.current.add(action);

    const handling = settingsRef.current.handling || DEFAULT_HANDLING;
    const das = handling.das ?? 133;
    const arr = handling.arr ?? 0;
    const sdf = handling.sdf ?? 41;

    // Soft drop with SDF > 1: use faster repeat
    if (action === 'softDrop') {
      executeMovement(action);
      if (sdf >= 41) return; // Instant — no repeat needed
      const softInterval = Math.max(1, Math.round(getDropSpeed(getLevel(linesRef.current, startLevelRef.current - 1)) / sdf));
      arrTimersRef.current[action] = setInterval(() => executeMovement(action), softInterval);
      return;
    }

    // First press: immediate move
    executeMovement(action);

    // DAS delay, then ARR
    dasTimersRef.current[action] = setTimeout(() => {
      if (arr === 0) {
        // ARR=0: teleport to wall instantly after DAS
        executeMovement(action, true);
      } else {
        arrTimersRef.current[action] = setInterval(() => executeMovement(action), arr);
      }
    }, das);
  }, [executeMovement]);

  const stopDAS = useCallback((action) => {
    heldActionsRef.current.delete(action);
    clearTimeout(dasTimersRef.current[action]);
    clearInterval(arrTimersRef.current[action]);
    delete dasTimersRef.current[action];
    delete arrTimersRef.current[action];
  }, []);

  const stopAllDAS = useCallback(() => {
    for (const action of ['moveLeft', 'moveRight', 'softDrop']) stopDAS(action);
  }, [stopDAS]);

  /* ── Gravity timer ── */

  useEffect(() => {
    if (gameStatus !== 'playing' || !piece) {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current);
      return;
    }
    const speed = getDropSpeed(level);
    dropTimerRef.current = setInterval(moveDown, speed);
    return () => clearInterval(dropTimerRef.current);
  }, [gameStatus, piece, level, moveDown]);

  /* ── Mode timers (Sprint / Ultra) ── */

  useEffect(() => {
    if (gameStatus !== 'playing') {
      if (modeTimerRef.current) clearInterval(modeTimerRef.current);
      return;
    }

    if (mode === 'sprint') {
      const startTime = Date.now() - elapsed;
      modeTimerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 100);
    } else if (mode === 'ultra') {
      modeTimerRef.current = setInterval(() => {
        setRemaining((prev) => {
          const next = prev - 100;
          if (next <= 0) {
            setGameStatus('over');
            saveHighScore(scoreRef.current, 'ultra');
            return 0;
          }
          return next;
        });
      }, 100);
    }

    return () => { if (modeTimerRef.current) clearInterval(modeTimerRef.current); };
  }, [gameStatus, mode, elapsed, saveHighScore]);

  /* ── Countdown ── */

  const runCountdown = useCallback((onDone) => {
    setGameStatus('countdown');
    let step = 0;
    setCountdown(COUNTDOWN_STEPS[0]);

    countdownTimerRef.current = setInterval(() => {
      step += 1;
      if (step < COUNTDOWN_STEPS.length) {
        setCountdown(COUNTDOWN_STEPS[step]);
      } else {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
        onDone();
      }
    }, step < COUNTDOWN_STEPS.length - 1 ? 700 : 500);
  }, []);

  /* ── Start / Restart ── */

  const startGame = useCallback(() => {
    stopAllDAS();
    const qs = settingsRef.current.queueSize;
    const newBag = createBag();
    const { keys: initialQueue, bag: rem } = drawFromBag(newBag, qs + 1);

    setBoard(createEmptyBoard());
    setScore(0);
    setLines(0);
    setCombo(-1);
    setBackToBack(false);
    setHoldKey(null);
    setHoldUsed(false);
    setStats(createStats());
    setClearLabel(null);
    setScorePopup(null);
    setFlashRows(null);
    setShake(false);
    setBag(rem);
    setQueue(initialQueue.slice(1));
    setElapsed(0);
    setRemaining(120000);
    garbageCounterRef.current = 0;

    const firstPiece = pieceFromKey(initialQueue[0]);

    runCountdown(() => {
      setPiece(firstPiece);
      setGameStatus('playing');
    });
  }, [runCountdown, stopAllDAS]);

  const togglePause = useCallback(() => {
    setGameStatus((s) => {
      if (s === 'playing') { stopAllDAS(); return 'paused'; }
      if (s === 'paused') return 'playing';
      return s;
    });
  }, [stopAllDAS]);

  /* ── Key mapping helper ── */

  const getAction = useCallback((key, code) => {
    const keys = settingsRef.current.keys;
    const lk = key.toLowerCase();
    for (const [action, mapped] of Object.entries(keys)) {
      if (mapped === key || mapped.toLowerCase() === lk) return action;
    }
    // WASD/C fallback using e.code — works regardless of keyboard layout (Cyrillic, etc.)
    const mappedValues = new Set(Object.values(keys).map((v) => v.toLowerCase()));
    const codeMap = { KeyA: 'moveLeft', KeyD: 'moveRight', KeyS: 'softDrop', KeyW: 'rotateCW', KeyC: 'hold' };
    if (code && codeMap[code] && !mappedValues.has((code === 'KeyA' ? 'a' : code === 'KeyD' ? 'd' : code === 'KeyS' ? 's' : code === 'KeyW' ? 'w' : 'c'))) return codeMap[code];
    return null;
  }, []);

  /* ── Keyboard controls ── */

  useEffect(() => {
    function handleKeyDown(e) {
      // Track held keys for IRS/IHS
      heldKeysRef.current.add(e.key);

      // Key rebinding mode
      if (rebindAction) return; // handled in separate effect

      // Don't intercept when button/input focused
      const tag = e.target.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      const st = statusRef.current;

      if (st === 'over' || st === 'won' || st === 'idle') {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
        return;
      }

      if (st === 'countdown') { e.preventDefault(); return; }

      // Pause
      const action = getAction(e.key, e.code);
      if (action === 'pause' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }

      if (st !== 'playing') return;

      const p = pieceRef.current;
      const b = boardRef.current;
      if (!p) return;

      e.preventDefault();

      // DAS actions
      if (action === 'moveLeft' || action === 'moveRight' || action === 'softDrop') {
        startDAS(action);
        return;
      }

      switch (action) {
        case 'rotateCW': {
          const rotated = tryRotate(b, p, true);
          if (rotated) { setPiece(rotated); resetLockDelay(); }
          break;
        }
        case 'rotateCCW': {
          const rotated = tryRotate(b, p, false);
          if (rotated) { setPiece(rotated); resetLockDelay(); }
          break;
        }
        case 'rotate180': {
          const rotated = tryRotate180(b, p);
          if (rotated) { setPiece(rotated); resetLockDelay(); }
          break;
        }
        case 'hold':
          holdPieceFn();
          break;
        case 'hardDrop': {
          cancelLockTimer();
          stopAllDAS();
          const { piece: dropped, cellsDropped } = hardDrop(b, p);
          setScore((s) => s + cellsDropped * POINTS.HARD_DROP);
          processLock(dropped, b);
          break;
        }
        default: break;
      }
    }

    function handleKeyUp(e) {
      heldKeysRef.current.delete(e.key);
      const action = getAction(e.key, e.code);
      if (action === 'moveLeft' || action === 'moveRight' || action === 'softDrop') {
        stopDAS(action);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startGame, togglePause, holdPieceFn, resetLockDelay, cancelLockTimer, startDAS, stopDAS, stopAllDAS, processLock, showClearLabel, getAction, rebindAction]);

  /* ── Key rebinding listener ── */

  useEffect(() => {
    if (!rebindAction) return;
    function handleRebind(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRebindAction(null); return; }
      setSettings((prev) => ({ ...prev, keys: { ...prev.keys, [rebindAction]: e.key } }));
      setRebindAction(null);
    }
    window.addEventListener('keydown', handleRebind, true);
    return () => window.removeEventListener('keydown', handleRebind, true);
  }, [rebindAction]);

  /* ── Touch controls ── */

  const touchStartRef = useRef(null);
  useEffect(() => {
    function handleTouchStart(e) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
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

      // Tap = rotate CW
      if (absDx < 20 && absDy < 20 && dt < 300) {
        const rotated = tryRotate(b, p, true);
        if (rotated) { setPiece(rotated); resetLockDelay(); }
        return;
      }

      // Swipe up = hold
      if (dy < -60 && absDy > absDx * 1.5) {
        holdPieceFn();
        return;
      }

      // Swipe down = hard drop
      if (dy > 60 && absDy > absDx * 1.5) {
        cancelLockTimer();
        const { piece: dropped, cellsDropped } = hardDrop(b, p);
        setScore((s) => s + cellsDropped * POINTS.HARD_DROP);
        processLock(dropped, b);
        return;
      }

      // Swipe horizontal = move (proportional)
      if (absDx > 30 && absDx > absDy) {
        const cells = Math.min(Math.floor(absDx / 40), 5);
        const dir = dx > 0 ? 1 : -1;
        let newCol = p.col;
        for (let i = 0; i < cells; i += 1) {
          if (isValidPosition(b, p.shape, p.row, newCol + dir)) {
            newCol += dir;
          } else break;
        }
        if (newCol !== p.col) {
          setPiece({ ...p, col: newCol, lastAction: 'move' });
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
  }, [holdPieceFn, processLock, resetLockDelay, cancelLockTimer]);

  /* ── Derived ── */

  const ghostRow = piece ? getGhostPosition(board, piece) : 0;
  const isFinished = gameStatus === 'over' || gameStatus === 'won';

  const handleShare = useCallback(() => {
    const modeLabel = MODES[mode]?.name || mode;
    let text = `zNews Тетрис (${modeLabel})\n🏆 ${formatScore(score)} точки\n📊 Ниво ${level + 1} | ${lines} линии`;
    if (mode === 'sprint' && gameStatus === 'won') text += `\n⏱️ Време: ${formatTime(elapsed)}`;
    text += `\n🎯 ${stats.tetrises} Tetris-а | ${stats.tSpins} T-Spin-а`;
    copyToClipboard(text);
  }, [score, level, lines, stats, mode, gameStatus, elapsed]);

  /* ── Cleanup on unmount ── */

  useEffect(() => {
    return () => {
      stopAllDAS();
      clearInterval(dropTimerRef.current);
      clearTimeout(lockTimerRef.current);
      clearTimeout(clearLabelTimerRef.current);
      clearTimeout(scorePopupTimerRef.current);
      clearTimeout(flashTimerRef.current);
      clearTimeout(shakeTimerRef.current);
      clearInterval(countdownTimerRef.current);
      clearInterval(modeTimerRef.current);
      clearTimeout(dcdTimerRef.current);
    };
  }, [stopAllDAS]);

  /* ── Render ── */

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
          <p className="text-yellow-400 font-display text-xs uppercase tracking-[0.3em] mb-1">{MODES[mode]?.name || 'Безкраен режим'}</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-white font-display tracking-wider leading-none mb-2" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.3)' }}>
            Тетрис
          </h1>
          <p className="text-white/60 text-sm font-semibold max-w-md">
            DAS/ARR/SDF, IRS/IHS, T-Spin, B2B, Combo — tetr.io механика.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-4 items-start justify-center">
          {/* Left panel — hold + stats */}
          <div className="hidden md:flex flex-col gap-3 w-32">
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 flex flex-col items-center">
              <TetrisPreview pieceKey={holdKey} label="Hold (C)" themeName={settings.theme} />
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
              <p className="text-xl font-black font-display text-zn-text dark:text-white">
                {mode === 'sprint' ? `${Math.min(lines, 40)}/40` : lines}
              </p>
            </div>

            {/* Mode-specific timer */}
            {mode === 'sprint' && gameStatus === 'playing' && (
              <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
                <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Време</span>
                <p className="text-lg font-black font-display font-mono text-zn-text dark:text-white">{formatTime(elapsed)}</p>
              </div>
            )}
            {mode === 'ultra' && (
              <div className={`comic-panel p-3 text-center ${remaining < 15000 ? 'bg-zn-hot/10 dark:bg-zn-hot/20' : 'bg-white dark:bg-zinc-900'}`}>
                <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Остават</span>
                <p className={`text-lg font-black font-display font-mono ${remaining < 15000 ? 'text-zn-hot' : 'text-zn-text dark:text-white'}`}>{formatTime(remaining)}</p>
              </div>
            )}

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
              <p className="text-lg font-black font-display text-zn-hot">{formatScore(currentHighScore)}</p>
            </div>
          </div>

          {/* Center — board */}
          <div className="flex flex-col items-center gap-4">
            {/* Mobile stats bar */}
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
                <span className="text-sm font-black font-display text-zn-text dark:text-white">{mode === 'sprint' ? `${Math.min(lines, 40)}/40` : lines}</span>
              </div>
              {combo > 0 && (
                <div className="comic-panel bg-zn-hot/10 dark:bg-zn-hot/20 px-2.5 py-1.5">
                  <span className="text-[8px] font-display uppercase tracking-widest text-zn-hot block">Combo</span>
                  <span className="text-sm font-black font-display text-zn-hot">{combo}x</span>
                </div>
              )}
              {(mode === 'sprint' || mode === 'ultra') && gameStatus === 'playing' && (
                <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                  <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">{mode === 'sprint' ? 'Време' : 'Остават'}</span>
                  <span className="text-sm font-black font-display font-mono text-zn-text dark:text-white">{formatTime(mode === 'sprint' ? elapsed : remaining)}</span>
                </div>
              )}
            </div>

            <div className="comic-panel p-2 relative" style={{ backgroundColor: (THEMES[settings.theme] || THEMES.classic).boardBg }}>
              {/* Clear label overlay */}
              {clearLabel && gameStatus === 'playing' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                  <p className="text-yellow-400 font-display text-sm md:text-base uppercase tracking-widest font-black text-center whitespace-nowrap px-3 py-1 bg-black/70 border border-yellow-400/40" style={{ textShadow: '0 0 10px rgba(255,215,0,0.5)' }}>
                    {clearLabel}
                  </p>
                </div>
              )}

              {/* Score popup */}
              {scorePopup && gameStatus === 'playing' && (
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 pointer-events-none tetris-score-popup">
                  <span className="text-yellow-300 font-display text-2xl font-black" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                    +{formatScore(scorePopup)}
                  </span>
                </div>
              )}

              {/* Countdown overlay */}
              {gameStatus === 'countdown' && countdown !== null && (
                <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
                  <p key={countdown} className="text-white font-display text-7xl font-black uppercase tracking-widest tetris-countdown" style={{ textShadow: '0 0 30px rgba(255,255,255,0.3)' }}>
                    {countdown}
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

              {/* Game over / Won overlay */}
              {isFinished && (
                <div className="absolute inset-0 z-20 bg-black/85 flex items-center justify-center">
                  <div className="text-center px-4 max-h-full overflow-y-auto py-4">
                    <p className={`font-display text-3xl uppercase tracking-widest mb-2 font-black ${gameStatus === 'won' ? 'text-green-400' : 'text-zn-hot'}`}>
                      {gameStatus === 'won' ? 'Победа!' : 'Край!'}
                    </p>
                    <p className="text-white font-display text-lg mb-1">{formatScore(score)} точки</p>
                    <p className="text-white/60 text-sm mb-1">Ниво {level + 1} • {lines} линии</p>
                    {mode === 'sprint' && gameStatus === 'won' && (
                      <p className="text-green-300 font-display text-sm mb-1">⏱️ {formatTime(elapsed)}</p>
                    )}
                    {score >= currentHighScore && score > 0 && (
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
                  <div className="text-center px-4 max-h-full overflow-y-auto py-4">
                    <p className="text-white font-display text-4xl uppercase tracking-widest mb-5 font-black">Тетрис</p>

                    {/* Mode selector */}
                    <div className="mb-4">
                      <p className="text-white/50 text-[10px] font-display uppercase tracking-widest mb-2">Режим</p>
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        {Object.entries(MODES).map(([key, m]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setMode(key)}
                            className={`px-3 py-1.5 font-display text-[10px] uppercase tracking-widest border-2 transition-colors ${
                              mode === key
                                ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400'
                                : 'border-white/20 text-white/40 hover:border-white/40'
                            }`}
                          >
                            <span className="mr-1">{m.icon}</span>{m.name}
                          </button>
                        ))}
                      </div>
                      <p className="text-white/30 text-[9px] mt-1">{MODES[mode]?.desc}</p>
                    </div>

                    {/* Start level */}
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

                    {/* Theme selector */}
                    <div className="mb-4">
                      <p className="text-white/50 text-[10px] font-display uppercase tracking-widest mb-2">Тема</p>
                      <div className="flex gap-1.5 justify-center">
                        {Object.entries(THEMES).map(([key, t]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSettings((s) => ({ ...s, theme: key }))}
                            className={`px-3 py-1.5 font-display text-[10px] uppercase tracking-widest border-2 transition-colors ${
                              settings.theme === key
                                ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400'
                                : 'border-white/20 text-white/40 hover:border-white/40'
                            }`}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick settings row */}
                    <div className="flex gap-3 justify-center mb-4 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, showGrid: !s.showGrid }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 font-display text-[10px] uppercase tracking-widest border-2 transition-colors ${
                          settings.showGrid
                            ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400'
                            : 'border-white/20 text-white/40 hover:border-white/40'
                        }`}
                      >
                        <Grid3X3 className="w-3 h-3" /> Grid
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-white/40 text-[10px] font-display uppercase">Опашка:</span>
                        {[1, 3, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSettings((s) => ({ ...s, queueSize: n }))}
                            className={`w-7 h-7 font-display font-bold text-xs border-2 transition-colors ${
                              settings.queueSize === n
                                ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400'
                                : 'border-white/20 text-white/40 hover:border-white/40'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Controls hint */}
                    <p className="text-white/30 text-[9px] mb-4 max-w-[260px] mx-auto leading-relaxed">
                      {keyLabel(settings.keys.moveLeft)}/{keyLabel(settings.keys.moveRight)} движение •
                      {' '}{keyLabel(settings.keys.rotateCW)} ↻ •
                      {' '}{keyLabel(settings.keys.rotateCCW)} ↺ •
                      {' '}{keyLabel(settings.keys.rotate180)} 180° •
                      {' '}{keyLabel(settings.keys.hardDrop)} хвърляне •
                      {' '}{keyLabel(settings.keys.hold)} hold
                    </p>

                    <div className="flex gap-3 justify-center">
                      <button type="button" onClick={startGame} className="bg-zn-hot text-white font-display uppercase tracking-widest px-8 py-3 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform">
                        <Play className="w-5 h-5 inline mr-2" />Старт
                      </button>
                      <button type="button" onClick={() => setShowSettings(!showSettings)} className="bg-white/10 text-white font-display uppercase tracking-widest px-4 py-3 border-2 border-white/20 hover:border-white/40 transition-colors">
                        <Settings className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ position: 'relative', zIndex: 0 }}>
                <TetrisBoard
                  board={board}
                  piece={piece}
                  ghostRow={ghostRow}
                  themeName={settings.theme}
                  showGrid={settings.showGrid}
                  flashRows={flashRows}
                  shake={shake}
                />
              </div>
            </div>

            {/* Mobile hold + pause */}
            <div className="flex md:hidden gap-2">
              {gameStatus === 'playing' && (
                <>
                  <button type="button" onClick={holdPieceFn} className={`comic-panel px-3 py-2 font-display uppercase text-[10px] tracking-widest ${holdUsed ? 'bg-zinc-200 dark:bg-zinc-800 text-zn-text/30' : 'bg-white dark:bg-zinc-900'}`} disabled={holdUsed}>
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
              {queue.slice(0, settings.queueSize).map((key, idx) => (
                <TetrisPreview key={`${key}-${idx}`} pieceKey={key} small={idx > 0} themeName={settings.theme} />
              ))}
            </div>
            {gameStatus === 'playing' && (
              <button type="button" onClick={togglePause} className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-xs tracking-widest text-zn-text dark:text-white hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
                <Pause className="w-4 h-4 mx-auto mb-1" />Пауза
              </button>
            )}
            {(gameStatus === 'idle' || isFinished) && (
              <button type="button" onClick={startGame} className="comic-panel bg-zn-hot text-white p-3 text-center font-display uppercase text-xs tracking-widest hover:bg-zn-hot-dark transition-colors">
                <Play className="w-4 h-4 mx-auto mb-1" />{isFinished ? 'Нова игра' : 'Старт'}
              </button>
            )}
            <button type="button" onClick={() => setShowStats(!showStats)} className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-[10px] tracking-widest text-zn-text/60 dark:text-zinc-400 hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
              Статистика
            </button>
          </div>
        </div>

        {/* Settings panel (key rebinding) */}
        {showSettings && gameStatus === 'idle' && (
          <div className="comic-panel bg-white dark:bg-zinc-900 p-5 max-w-lg mx-auto mt-6">
            <h3 className="font-display text-lg uppercase tracking-widest text-zn-text dark:text-white mb-4">Управление</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ACTION_LABELS).map(([action, label]) => (
                <div key={action} className="flex items-center justify-between gap-2 py-1.5 px-2 bg-zn-paper dark:bg-zinc-800 rounded">
                  <span className="text-sm text-zn-text/80 dark:text-zinc-300">{label}</span>
                  <button
                    type="button"
                    onClick={() => setRebindAction(rebindAction === action ? null : action)}
                    className={`font-mono text-sm px-3 py-1 border-2 min-w-[60px] text-center transition-colors ${
                      rebindAction === action
                        ? 'border-zn-hot bg-zn-hot/10 text-zn-hot animate-pulse'
                        : 'border-zn-text/20 dark:border-zinc-600 text-zn-text dark:text-white hover:border-zn-purple'
                    }`}
                  >
                    {rebindAction === action ? '...' : keyLabel(settings.keys[action])}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zn-text/40 dark:text-zinc-500 mt-3">Натисни бутона, след което натисни нов клавиш. Esc за отказ.</p>

            {/* Handling settings */}
            <div className="mt-4 pt-4 border-t border-zn-text/10 dark:border-zinc-700">
              <h4 className="font-display text-sm uppercase tracking-widest text-zn-text dark:text-white mb-3">Handling (физика)</h4>
              <div className="space-y-3">
                {Object.entries(HANDLING_LABELS).map(([key, meta]) => {
                  const val = settings.handling?.[key] ?? DEFAULT_HANDLING[key];
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm text-zn-text/80 dark:text-zinc-300 font-display">{meta.name}</span>
                        <span className="font-mono text-sm text-zn-text dark:text-white font-bold min-w-[50px] text-right">
                          {key === 'sdf' && val >= 41 ? '∞' : val}{key !== 'sdf' || val < 41 ? meta.unit : ''}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={meta.min}
                        max={meta.max}
                        step={meta.step}
                        value={val}
                        onChange={(e) => setSettings((s) => ({
                          ...s,
                          handling: { ...s.handling, [key]: Number(e.target.value) },
                        }))}
                        className="w-full h-1.5 bg-zn-text/10 dark:bg-zinc-700 rounded appearance-none cursor-pointer accent-zn-purple"
                      />
                      <p className="text-[9px] text-zn-text/35 dark:text-zinc-500 mt-0.5">{meta.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zn-text/10 dark:border-zinc-700 flex gap-2">
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, keys: { ...DEFAULT_KEYS }, handling: { ...DEFAULT_HANDLING } }))}
                className="text-xs font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 hover:text-zn-hot transition-colors"
              >
                По подразбиране
              </button>
            </div>
          </div>
        )}

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
            {Object.keys(highScores).length > 0 && (
              <div className="mt-3 pt-3 border-t border-zn-text/10 dark:border-zinc-700">
                <p className="text-[10px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 mb-2">Рекорди</p>
                <div className="grid grid-cols-2 gap-1 text-sm text-zn-text/80 dark:text-zinc-300">
                  {Object.entries(highScores).map(([m, hs]) => (
                    <span key={m} className="contents">
                      <span>{MODES[m]?.name || m}</span>
                      <span className="font-black text-right text-zn-hot">{m === 'sprint' ? formatTime(hs) : formatScore(hs)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
