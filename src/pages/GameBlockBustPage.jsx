import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Palette, RotateCcw, Settings2, Share2, Undo2 } from 'lucide-react';
import BlockBustBoard from '../components/games/blockbust/BlockBustBoard';
import BlockBustTray, { PieceMiniBoard } from '../components/games/blockbust/BlockBustTray';
import BlockBustSettings from '../components/games/blockbust/BlockBustSettings';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import { copyToClipboard } from '../utils/copyToClipboard';
import { getTodayStr } from '../utils/gameDate';
import { loadScopedGameProgress, saveGameProgress, saveScopedGameProgress } from '../utils/gameStorage';
import {
  BLOCK_BUST_DEFAULT_SETTINGS,
  BLOCK_BUST_META_SCOPE,
  BLOCK_BUST_RUN_SCOPE,
  BLOCK_BUST_SETTINGS_KEY,
  BLOCK_BUST_THEMES,
  canPlaceBlockBustPiece,
  createBlockBustInitialCursor,
  createBlockBustTray,
  createEmptyBlockBustBoard,
  getBlockBustBoardOccupancy,
  getBlockBustLevel,
  getBlockBustNextThemeId,
  getBlockBustTheme,
  getBlockBustValidPlacements,
  hydrateBlockBustRun,
  isBlockBustGameOver,
  placeBlockBustPiece,
  resolveBlockBustMove,
  serializeBlockBustRun,
} from '../utils/blockBust';

/* ── Constants ── */
const GAME_SLUG = 'blockbust';
const GAME_TITLE = 'ZBlast';
const LINES_PER_LEVEL = 8;

function fmt(n) { return String(Math.max(0, Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

/** Animated number that counts up/down over ~300ms */
function useAnimatedNumber(target) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef(null);
  const startRef = useRef({ from: target, to: target, t0: 0 });
  useEffect(() => {
    const from = startRef.current.to;
    if (from === target) return;
    startRef.current = { from, to: target, t0: performance.now() };
    function tick(now) {
      const { from: f, to: t, t0 } = startRef.current;
      const elapsed = now - t0;
      const progress = Math.min(1, elapsed / 300);
      const eased = 1 - (1 - progress) * (1 - progress); // easeOutQuad
      setDisplay(Math.round(f + (t - f) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target]);
  return display;
}

function createFreshRun(bestScore = 0, themeId = BLOCK_BUST_THEMES[0].id) {
  const board = createEmptyBlockBustBoard();
  return { board, tray: createBlockBustTray(board, 1), score: 0, totalLines: 0, combo: 0, fullWipes: 0, moveCount: 0, selectedSlotIndex: null, themeId, status: 'playing', bestScore };
}

function loadSettings() {
  if (typeof window === 'undefined') return { ...BLOCK_BUST_DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(BLOCK_BUST_SETTINGS_KEY);
    return raw ? { ...BLOCK_BUST_DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...BLOCK_BUST_DEFAULT_SETTINGS };
  } catch { return { ...BLOCK_BUST_DEFAULT_SETTINGS }; }
}

function computeStreak(meta) {
  if (!meta?.lastPlayDate) return 0;
  const today = getTodayStr();
  if (meta.lastPlayDate === today) return Math.max(1, Number(meta.streak) || 1);
  const d = new Date(); d.setDate(d.getDate() - 1);
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return meta.lastPlayDate === yesterday ? Math.max(1, Number(meta.streak) || 0) : 0;
}

function loadRunState() {
  const meta = loadScopedGameProgress(GAME_SLUG, BLOCK_BUST_META_SCOPE);
  const hydrated = hydrateBlockBustRun(loadScopedGameProgress(GAME_SLUG, BLOCK_BUST_RUN_SCOPE));
  const bestScore = Math.max(0, Number(meta?.bestScore) || Number(hydrated?.bestScore) || 0);
  const streak = computeStreak(meta);
  const today = getTodayStr();
  const dailyBest = meta?.dailyBestDate === today ? Math.max(0, Number(meta?.dailyBest) || 0) : 0;
  return hydrated
    ? { run: { ...hydrated, bestScore }, bestScore, streak, dailyBest, resumed: true }
    : { run: createFreshRun(bestScore), bestScore, streak, dailyBest, resumed: false };
}

function buildShareText(run, level) {
  return [`zNews ${GAME_TITLE}`, `Точки: ${fmt(run.score)}`, `Ниво: ${level}`, `Ходове: ${run.moveCount}`].join('\n');
}

/* ── Component ── */
export default function GameBlockBustPage() {
  useDocumentTitle(makeTitle(GAME_TITLE));

  const initial = useMemo(() => loadRunState(), []);
  const [settings, setSettings] = useState(loadSettings);
  const [run, setRun] = useState(initial.run);
  const [bestScore, setBestScore] = useState(initial.bestScore);
  const [showSettings, setShowSettings] = useState(false);
  const [focusCell, setFocusCell] = useState(createBlockBustInitialCursor);
  const [anchorCell, setAnchorCell] = useState(null);
  const [banner, setBanner] = useState(null);
  const [shareNotice, setShareNotice] = useState(null);
  const boardRef = useRef(null);
  const dragStateRef = useRef({ active: false });
  const [isDragging, setIsDragging] = useState(false);
  const audioCtxRef = useRef(null);
  const dragGhostRef = useRef(null);
  const [floatingScores, setFloatingScores] = useState([]);
  const [clearFlash, setClearFlash] = useState(null);
  const clearFlashRef = useRef(null);
  const [prevRunForUndo, setPrevRunForUndo] = useState(null);
  const [streak, setStreak] = useState(initial.streak);
  const [dailyBest, setDailyBest] = useState(initial.dailyBest);
  const boardWrapRef = useRef(null);
  const [boardScale, setBoardScale] = useState(1);

  const animatedScore = useAnimatedNumber(run.score);
  const animatedBest = useAnimatedNumber(bestScore);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [scoreFlash, setScoreFlash] = useState(false);
  const prevScoreRef = useRef(run.score);
  useEffect(() => {
    if (run.score > prevScoreRef.current) { setScoreFlash(true); const t = setTimeout(() => setScoreFlash(false), 400); prevScoreRef.current = run.score; return () => clearTimeout(t); }
    prevScoreRef.current = run.score;
  }, [run.score]);

  const selectedPiece = useMemo(() => typeof run.selectedSlotIndex === 'number' ? (run.tray[run.selectedSlotIndex] || null) : null, [run.selectedSlotIndex, run.tray]);
  const level = useMemo(() => getBlockBustLevel(run.totalLines), [run.totalLines]);
  const occupancy = useMemo(() => getBlockBustBoardOccupancy(run.board), [run.board]);
  const activeTheme = useMemo(() => getBlockBustTheme(run.themeId), [run.themeId]);
  const levelProgress = useMemo(() => run.totalLines % LINES_PER_LEVEL, [run.totalLines]);

  const previewState = useMemo(() => {
    if (!selectedPiece || !anchorCell) return { cells: [], valid: false };
    const valid = canPlaceBlockBustPiece(run.board, selectedPiece, anchorCell.row, anchorCell.col);
    if (!valid && isDragging) return { cells: [], valid: false };
    if (anchorCell.row < 0 || anchorCell.col < 0) return { cells: [], valid: false };
    const cells = selectedPiece.cells
      .map(([r, c]) => ({ row: anchorCell.row + r, col: anchorCell.col + c }))
      .filter(({ row, col }) => row >= 0 && col >= 0 && row < 8 && col < 8);
    return { cells, valid };
  }, [anchorCell, isDragging, run.board, selectedPiece]);

  /* ── Persistence ── */
  useEffect(() => { try { window.localStorage.setItem(BLOCK_BUST_SETTINGS_KEY, JSON.stringify(settings)); } catch {} }, [settings]);
  useEffect(() => { saveScopedGameProgress(GAME_SLUG, BLOCK_BUST_META_SCOPE, { bestScore }); }, [bestScore]);
  useEffect(() => { const s = serializeBlockBustRun({ ...run, bestScore }); if (s) saveScopedGameProgress(GAME_SLUG, BLOCK_BUST_RUN_SCOPE, s); }, [bestScore, run]);

  /* ── Auto-snap on piece selection ── */
  const prevPieceRef = useRef(null);
  useEffect(() => {
    if (isDragging) return;
    if (selectedPiece === prevPieceRef.current) return;
    prevPieceRef.current = selectedPiece;
    if (!selectedPiece) return;
    if (canPlaceBlockBustPiece(run.board, selectedPiece, focusCell.row, focusCell.col)) return;
    const first = getBlockBustValidPlacements(run.board, selectedPiece)[0];
    if (first) { setFocusCell(first); setAnchorCell(first); }
  }, [focusCell, isDragging, run.board, selectedPiece]);

  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), settings.animationLevel === 'reduced' ? 1200 : 1800); return () => clearTimeout(t); }, [banner, settings.animationLevel]);
  useEffect(() => { if (!shareNotice) return; const t = setTimeout(() => setShareNotice(null), 2200); return () => clearTimeout(t); }, [shareNotice]);

  /* ── Board responsive scaling ── */
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const MIN = 260;
    function measure() { const w = el.clientWidth; setBoardScale(w >= MIN ? 1 : w / MIN); }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /* ── Sound ── */
  const playTone = useEffectEvent((type) => {
    if (!settings.soundEnabled) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const t = { select: [320, 0.06, 0.03, 'triangle'], place: [220, 0.08, 0.05, 'square'], clear: [470, 0.11, 0.04, 'triangle'], perfect: [720, 0.18, 0.05, 'sine'], over: [145, 0.2, 0.045, 'sawtooth'], levelup: [660, 0.16, 0.045, 'sine'], undo: [180, 0.07, 0.03, 'triangle'], combo: [540, 0.09, 0.035, 'triangle'] }[type] || [240, 0.05, 0.02, 'triangle'];
      osc.type = t[3]; osc.frequency.setValueAtTime(t[0], now);
      gain.gain.setValueAtTime(t[2], now); gain.gain.exponentialRampToValueAtTime(0.0001, now + t[1]);
      osc.start(now); osc.stop(now + t[1]);
    } catch {}
  });

  /* ── Daily persistence ── */
  const persistDaily = useEffectEvent((nextRun, status = 'played') => {
    const today = getTodayStr();
    const meta = loadScopedGameProgress(GAME_SLUG, BLOCK_BUST_META_SCOPE) || {};
    const lastPlay = meta.lastPlayDate;
    let newStreak;
    if (lastPlay === today) { newStreak = Math.max(1, Number(meta.streak) || 1); }
    else {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      newStreak = lastPlay === y ? (Number(meta.streak) || 0) + 1 : 1;
    }
    const newDailyBest = meta.dailyBestDate === today ? Math.max(Number(meta.dailyBest) || 0, nextRun.score) : nextRun.score;
    saveScopedGameProgress(GAME_SLUG, BLOCK_BUST_META_SCOPE, { bestScore: Math.max(bestScore, nextRun.score), streak: newStreak, lastPlayDate: today, dailyBest: newDailyBest, dailyBestDate: today });
    setStreak(newStreak); setDailyBest(newDailyBest);
    saveGameProgress(GAME_SLUG, today, { score: nextRun.score, lines: nextRun.totalLines, fullWipes: nextRun.fullWipes, level: getBlockBustLevel(nextRun.totalLines), themeId: nextRun.themeId, gameStatus: status });
  });

  /* ── Actions ── */
  const resetRun = useEffectEvent((force = false) => {
    if (!force && settings.confirmRestart && !window.confirm('Сигурен ли си, че искаш нов рън?')) return;
    const tid = BLOCK_BUST_THEMES[Math.floor(Math.random() * BLOCK_BUST_THEMES.length)].id;
    setRun(createFreshRun(bestScore, tid));
    setFocusCell(createBlockBustInitialCursor());
    setAnchorCell(null);
    setPrevRunForUndo(null);
    setBanner({ eyebrow: 'Нов рън', title: 'Полето е чисто!', accent: getBlockBustTheme(tid).accent });
  });

  const placeSelectedPiece = useEffectEvent((row, col, overridePiece, overrideIndex) => {
    if (clearFlashRef.current) return false;
    const pieceIndex = overrideIndex !== undefined ? overrideIndex : run.selectedSlotIndex;
    const piece = overridePiece || (typeof pieceIndex === 'number' ? run.tray[pieceIndex] : null);
    if (!piece || run.status === 'over') return false;
    const result = resolveBlockBustMove(run.board, piece, row, col, run.combo);
    if (!result) return false;

    setPrevRunForUndo({ ...run });
    const prevLevel = level;
    const nextLevel = getBlockBustLevel(run.totalLines + result.linesCleared);
    const remaining = [...run.tray];
    if (typeof pieceIndex === 'number') remaining[pieceIndex] = null;
    const nextTray = remaining.every(p => !p) ? createBlockBustTray(result.board, nextLevel) : remaining;
    const nextThemeId = result.perfectClear ? getBlockBustNextThemeId(run.themeId) : run.themeId;
    const nextRun = { ...run, board: result.board, tray: nextTray, score: run.score + result.score, totalLines: run.totalLines + result.linesCleared, combo: result.nextCombo, fullWipes: run.fullWipes + (result.perfectClear ? 1 : 0), moveCount: run.moveCount + 1, selectedSlotIndex: null, themeId: nextThemeId, status: isBlockBustGameOver(result.board, nextTray) ? 'over' : 'playing' };

    // Clear flash
    if (result.hadClear) {
      const placed = placeBlockBustPiece(run.board, piece, row, col);
      setRun({ ...nextRun, board: placed });
      setClearFlash({ rows: result.clearedRows, cols: result.clearedCols });
      clearFlashRef.current = true;
      setTimeout(() => {
        setRun(prev => ({ ...prev, board: result.board }));
        setClearFlash(null);
        clearFlashRef.current = null;
      }, 300);
    } else {
      setRun(nextRun);
    }

    setAnchorCell(null);
    if (nextRun.score > bestScore) setBestScore(nextRun.score);
    persistDaily(nextRun, nextRun.status === 'over' ? 'over' : 'played');

    // Floating score
    if (result.score > 0) {
      const el = boardRef.current;
      let fx = 0, fy = 0;
      if (el && piece) {
        const rect = el.getBoundingClientRect();
        fx = rect.left + ((col + piece.width / 2) * (rect.width / 8));
        fy = rect.top + ((row + piece.height / 2) * (rect.height / 8));
      }
      const s = { id: Date.now() + Math.random(), score: result.score, x: fx, y: fy };
      setFloatingScores(prev => [...prev.slice(-3), s]);
      setTimeout(() => setFloatingScores(prev => prev.filter(f => f.id !== s.id)), 1200);
    }

    // Banners & sounds
    if (nextLevel > prevLevel && !result.perfectClear && nextRun.status !== 'over') {
      playTone('levelup');
      setBanner({ eyebrow: `Ниво ${nextLevel}`, title: 'Level Up!', accent: activeTheme.accent });
    } else if (result.perfectClear) {
      playTone('perfect');
      setBanner({ eyebrow: 'Пълно изчистване', title: 'Perfect Clear!', accent: getBlockBustTheme(nextThemeId).accent });
    } else if (result.hadClear) {
      playTone(result.nextCombo >= 3 ? 'combo' : 'clear');
      setBanner({ eyebrow: result.nextCombo > 1 ? `Combo x${result.nextCombo}` : 'Clear', title: `${result.linesCleared > 1 ? `${result.linesCleared} линии` : '1 линия'}`, accent: activeTheme.accent });
    } else {
      playTone('place');
    }
    if (nextRun.status === 'over') { playTone('over'); setBanner({ type: 'over', eyebrow: 'Game Over', title: fmt(nextRun.score) + ' точки', accent: '#cc0a1a' }); }
    if (dragGhostRef.current) dragGhostRef.current.style.display = 'none';
    return true;
  });

  const handleSelectPiece = useEffectEvent((index) => {
    setRun(c => ({ ...c, selectedSlotIndex: c.selectedSlotIndex === index ? null : index }));
    playTone('select');
  });

  const handleUndo = useEffectEvent(() => {
    if (!prevRunForUndo || clearFlashRef.current) return;
    setRun(prevRunForUndo);
    setPrevRunForUndo(null);
    setAnchorCell(null);
    playTone('undo');
    setBanner({ eyebrow: 'Undo', title: 'Върнат ход', accent: activeTheme.accent });
  });

  /* ── Drag system ── */
  const handleStartDrag = useEffectEvent((event, index) => {
    if (settings.controlMode !== 'drag-tap') return;
    dragStateRef.current = { active: true, pieceIndex: index, moved: false };
    setIsDragging(true);
    setRun(c => ({ ...c, selectedSlotIndex: index }));
    playTone('select');
    if (dragGhostRef.current) {
      dragGhostRef.current.style.display = 'block';
      dragGhostRef.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -130%) scale(1.4)`;
    }
  });

  const updateAnchor = useEffectEvent((cx, cy) => {
    const grid = document.getElementById('blockbust-grid');
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const mx = rect.width * 0.4;
    const mt = rect.height * 0.25;
    const mb = rect.height * 0.7;
    if (cx < rect.left - mx || cx > rect.right + mx || cy < rect.top - mt || cy > rect.bottom + mb) {
      setAnchorCell(null);
      dragStateRef.current.anchorCell = null;
      return;
    }
    let rr = Math.floor((cy - rect.top) / (rect.height / 8));
    let rc = Math.floor((cx - rect.left) / (rect.width / 8));
    let piece = selectedPiece;
    if (dragStateRef.current.active && typeof dragStateRef.current.pieceIndex === 'number') {
      piece = run.tray[dragStateRef.current.pieceIndex] || piece;
    }
    if (dragStateRef.current.active && piece) {
      rc -= Math.floor(piece.width / 2);
      rr -= Math.floor(piece.height);
    } else {
      rr = Math.max(0, Math.min(7, rr));
      rc = Math.max(0, Math.min(7, rc));
    }
    setAnchorCell(p => (p && p.row === rr && p.col === rc) ? p : { row: rr, col: rc });
    setFocusCell(p => (p && p.row === rr && p.col === rc) ? p : { row: rr, col: rc });
    dragStateRef.current.anchorCell = { row: rr, col: rc };
  });

  const handlePointerUp = useEffectEvent(() => {
    const st = dragStateRef.current;
    if (!st.active) return;
    dragStateRef.current = { active: false };
    setIsDragging(false);
    if (dragGhostRef.current) dragGhostRef.current.style.display = 'none';
    if (typeof st.pieceIndex === 'number') {
      const p = run.tray[st.pieceIndex];
      if (p && st.anchorCell) {
        const placed = placeSelectedPiece(st.anchorCell.row, st.anchorCell.col, p, st.pieceIndex);
        if (!placed && st.moved) {
          setRun(c => ({ ...c, selectedSlotIndex: null }));
          setAnchorCell(null);
        }
      } else if (st.moved) {
        setRun(c => ({ ...c, selectedSlotIndex: null }));
        setAnchorCell(null);
      }
    }
  });

  useEffect(() => {
    function up() { handlePointerUp(); }
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [handlePointerUp]);

  const handlePointerMove = useEffectEvent((e) => {
    if (!dragStateRef.current.active || !dragGhostRef.current) return;
    dragStateRef.current.moved = true;
    dragGhostRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -130%) scale(1.4)`;
    updateAnchor(e.clientX, e.clientY);
  });

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [handlePointerMove]);

  const handleBoardPointerMove = useEffectEvent((e) => {
    if (settings.controlMode !== 'drag-tap' && !selectedPiece) return;
    if (!dragStateRef.current.active && settings.controlMode === 'drag-tap') return;
    updateAnchor(e.clientX, e.clientY);
  });

  const handleShare = useEffectEvent(async () => {
    const ok = await copyToClipboard(buildShareText(run, level));
    setShareNotice({ message: ok ? 'Копирано!' : 'Грешка при копиране.' });
  });

  /* ── Keyboard ── */
  const handleKeyDown = useEffectEvent((e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Escape') { if (showSettings) setShowSettings(false); else if (typeof run.selectedSlotIndex === 'number') setRun(c => ({ ...c, selectedSlotIndex: null })); return; }
    if (e.code === 'KeyZ') { e.preventDefault(); handleUndo(); return; }
    if (e.code === 'KeyR') { e.preventDefault(); resetRun(); return; }
    if (e.code === 'KeyO') { e.preventDefault(); setShowSettings(c => !c); return; }
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') { e.preventDefault(); const i = Number.parseInt(e.code.replace('Digit', ''), 10) - 1; if (run.tray[i]) handleSelectPiece(i); return; }
    if (e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') { e.preventDefault(); const i = { KeyA: 0, KeyS: 1, KeyD: 2 }[e.code]; if (run.tray[i]) handleSelectPiece(i); return; }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      const n = e.code === 'ArrowUp' ? { row: Math.max(0, focusCell.row - 1), col: focusCell.col }
        : e.code === 'ArrowDown' ? { row: Math.min(7, focusCell.row + 1), col: focusCell.col }
        : e.code === 'ArrowLeft' ? { row: focusCell.row, col: Math.max(0, focusCell.col - 1) }
        : { row: focusCell.row, col: Math.min(7, focusCell.col + 1) };
      setFocusCell(n); setAnchorCell(n);
      return;
    }
    if ((e.code === 'Space' || e.code === 'Enter') && typeof run.selectedSlotIndex === 'number') { e.preventDefault(); placeSelectedPiece(focusCell.row, focusCell.col); }
  });
  useEffect(() => { window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [handleKeyDown]);

  /* ── Occupancy color ── */
  const occColor = occupancy >= 0.72 ? '#cc0a1a' : occupancy >= 0.55 ? '#e87420' : occupancy >= 0.35 ? '#e8b830' : '#00a0d2';

  /* ── Render ── */
  return (
    <div className="min-h-screen pb-20 transition-colors duration-500 dark:text-white" style={{ background: activeTheme.pageGradient }}>
      {/* Hero header — level-adaptive hue shift */}
      <div
        className="pt-6 pb-8 mb-6 border-b-4 border-[#1C1428] dark:border-zinc-700 relative overflow-hidden transition-all duration-700"
        style={{ background: `linear-gradient(135deg, ${activeTheme.ribbonFrom} 0%, ${activeTheme.ribbonTo} 100%)`, filter: `hue-rotate(${(level - 1) * 8}deg)` }}
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <Link to="/games" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-3 font-display text-sm uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Всички игри
          </Link>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-white font-display tracking-wider leading-none mb-1" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.3)' }}>
            {GAME_TITLE}
          </h1>
          <p className="text-white/60 text-sm font-semibold max-w-md">
            Подреждай фигури, чисти редове и колони, трупай комбо.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className={`flex flex-col md:flex-row gap-4 items-start justify-center ${settings.leftHanded ? 'md:flex-row-reverse' : ''}`}>

          {/* Left panel — stats */}
          <div className="hidden md:flex flex-col gap-3 w-32">
            <div className={`comic-panel p-3 text-center transition-colors duration-300 ${scoreFlash ? 'bg-zn-gold/10 dark:bg-zn-gold/20' : 'bg-white dark:bg-zinc-900'}`}>
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Точки</span>
              <p className={`text-xl font-black font-display tabular-nums transition-transform duration-200 ${scoreFlash ? 'scale-110 text-zn-gold' : 'scale-100 text-zn-text dark:text-white'}`}>{fmt(animatedScore)}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Рекорд</span>
              <p className="text-lg font-black font-display text-zn-hot tabular-nums">{fmt(animatedBest)}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Ниво</span>
              <p className="text-xl font-black font-display text-zn-purple dark:text-zn-purple-light">{level}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Линии</span>
              <p className="text-xl font-black font-display text-zn-text dark:text-white">{run.totalLines}</p>
            </div>
            {run.combo > 0 && (
              <div className="comic-panel bg-zn-hot/10 dark:bg-zn-hot/20 border-zn-hot/30 p-2 text-center">
                <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-hot">Combo</span>
                <p className="text-lg font-black font-display text-zn-hot">{run.combo}x</p>
              </div>
            )}

            {/* Occupancy meter */}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400 block text-center mb-2">Натиск</span>
              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.round(occupancy * 100)}%`, background: occColor }} />
              </div>
              <p className="text-center text-[10px] font-bold mt-1" style={{ color: occColor }}>{Math.round(occupancy * 100)}%</p>
            </div>

            {/* Level progress */}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400 block text-center mb-2">До ниво {level + 1}</span>
              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(levelProgress / LINES_PER_LEVEL) * 100}%`, background: activeTheme.accent }} />
              </div>
              <p className="text-center text-[10px] font-bold mt-1 text-zn-text/50 dark:text-zinc-400">{LINES_PER_LEVEL - levelProgress} линии</p>
            </div>

            {streak > 0 && (
              <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
                <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Серия</span>
                <p className="text-lg font-black font-display text-zn-text dark:text-white">{streak}d</p>
              </div>
            )}
          </div>

          {/* Center — board + tray */}
          <div className="flex flex-col items-center gap-3 w-full md:w-auto">
            {/* Mobile stats */}
            <div className="flex md:hidden gap-2 text-center flex-wrap justify-center">
              <div className={`comic-panel px-2.5 py-1.5 transition-colors duration-300 ${scoreFlash ? 'bg-zn-gold/10 dark:bg-zn-gold/20' : 'bg-white dark:bg-zinc-900'}`}>
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Точки</span>
                <span className={`text-sm font-black font-display tabular-nums ${scoreFlash ? 'text-zn-gold' : 'text-zn-text dark:text-white'}`}>{fmt(animatedScore)}</span>
              </div>
              <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Ниво</span>
                <span className="text-sm font-black font-display text-zn-purple dark:text-zn-purple-light">{level}</span>
              </div>
              <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Линии</span>
                <span className="text-sm font-black font-display text-zn-text dark:text-white">{run.totalLines}</span>
              </div>
              {run.combo > 0 && (
                <div className="comic-panel bg-zn-hot/10 dark:bg-zn-hot/20 px-2.5 py-1.5">
                  <span className="text-[8px] font-display uppercase tracking-widest text-zn-hot block">Combo</span>
                  <span className="text-sm font-black font-display text-zn-hot">{run.combo}x</span>
                </div>
              )}
            </div>

            {/* Board */}
            <div className="relative w-full max-w-[22rem] md:max-w-[26rem]" ref={boardWrapRef}>
              {/* Banner overlay */}
              <AnimatePresence>
                {banner && (
                  <motion.div
                    key={`${banner.eyebrow}-${banner.title}`}
                    initial={{ opacity: 0, scale: 0.6, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.1, y: -15 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                  >
                    <div
                      className={`rounded-xl border-[3px] border-[#1C1428] px-5 py-2.5 shadow-[4px_4px_0_#1c1428] ${
                        banner.type === 'over' ? 'bg-zn-hot' : 'bg-zn-purple'
                      }`}
                    >
                      <p className="font-display text-[10px] font-black uppercase tracking-[0.25em] text-white/85">
                        {banner.eyebrow}
                      </p>
                      <p className="mt-0.5 font-display text-xl font-black uppercase leading-none text-white" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                        {banner.title}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={boardScale < 1 ? { overflow: 'hidden' } : undefined}>
                <div style={boardScale < 1 ? { transform: `scale(${boardScale})`, transformOrigin: 'top left', width: `${100 / boardScale}%` } : undefined}>
                  <BlockBustBoard
                    ref={boardRef}
                    board={run.board}
                    theme={activeTheme}
                    previewCells={previewState.cells}
                    invalidPreview={!previewState.valid && Boolean(selectedPiece) && Boolean(anchorCell) && !isDragging}
                    focusCell={focusCell}
                    showPlacementPreview={settings.showPlacementPreview}
                    contrastMode={settings.gridContrast}
                    clearFlash={clearFlash}
                    comboLevel={run.combo >= 3 ? Math.min(run.combo - 1, 5) : run.combo >= 2 ? 1 : 0}
                    onCellEnter={(r, c) => { if (dragStateRef.current.active) return; setAnchorCell({ row: r, col: c }); setFocusCell({ row: r, col: c }); }}
                    onCellClick={(r, c) => placeSelectedPiece(r, c)}
                    onBoardPointerMove={handleBoardPointerMove}
                    onBoardPointerUp={handlePointerUp}
                    onBoardLeave={() => { if (!dragStateRef.current.active) setAnchorCell(null); }}
                  />
                </div>
              </div>
            </div>

            {/* Tray — below board like Block Blast */}
            <div className="w-full max-w-[22rem] md:max-w-[26rem]">
              <BlockBustTray
                pieces={run.tray}
                selectedSlotIndex={run.selectedSlotIndex}
                onSelectPiece={handleSelectPiece}
                onStartDragPiece={handleStartDrag}
                theme={activeTheme}
                controlMode={settings.controlMode}
              />
            </div>

            {/* Action buttons — compact row */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              <button type="button" onClick={handleUndo} disabled={!prevRunForUndo} className={`comic-panel px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${prevRunForUndo ? 'bg-white dark:bg-zinc-900 text-zn-text dark:text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zn-text/30 dark:text-zinc-600 cursor-not-allowed'}`}>
                <Undo2 className="w-3.5 h-3.5" />Undo (Z)
              </button>
              <button type="button" onClick={() => resetRun()} className="comic-panel bg-white dark:bg-zinc-900 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-widest text-zn-text dark:text-white flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />Нов (R)
              </button>
              <button type="button" onClick={() => setShowSettings(true)} className="comic-panel bg-white dark:bg-zinc-900 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-widest text-zn-text dark:text-white flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />Настройки
              </button>
              <button type="button" onClick={handleShare} className="comic-panel bg-white dark:bg-zinc-900 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-widest text-zn-text dark:text-white flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5" />Сподели
              </button>
            </div>
          </div>

          {/* Right panel */}
          <div className={`hidden md:flex flex-col gap-3 w-44`}>
            {/* Theme picker */}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <button
                type="button"
                onClick={() => setShowThemePicker(p => !p)}
                className="flex items-center gap-1.5 font-display text-[10px] font-black uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 w-full"
              >
                <Palette className="w-3.5 h-3.5" />
                Тема: {activeTheme.name}
              </button>
              {showThemePicker && (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {BLOCK_BUST_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setRun(c => ({ ...c, themeId: t.id })); setShowThemePicker(false); }}
                      className={`w-full aspect-square rounded-lg border-2 transition-all ${
                        t.id === activeTheme.id ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ background: `linear-gradient(135deg, ${t.fillFrom}, ${t.fillTo})` }}
                      title={t.name}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Daily best */}
            {dailyBest > 0 && (
              <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
                <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Дневен рекорд</span>
                <p className="text-lg font-black font-display text-zn-text dark:text-white tabular-nums">{fmt(dailyBest)}</p>
              </div>
            )}

            {/* Tips */}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <p className="font-display text-[10px] font-black uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 mb-2">Контроли</p>
              <ul className="space-y-1 text-[11px] text-zn-text/60 dark:text-zinc-500">
                <li><b className="text-zn-text dark:text-white">A/S/D</b> — избери фигура</li>
                <li><b className="text-zn-text dark:text-white">Стрелки</b> — мести фокус</li>
                <li><b className="text-zn-text dark:text-white">Space</b> — постави</li>
                <li><b className="text-zn-text dark:text-white">Z</b> — undo</li>
                <li><b className="text-zn-text dark:text-white">R</b> — нов рън</li>
              </ul>
            </div>

            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <p className="font-display text-[10px] font-black uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 mb-2">Правила</p>
              <ul className="space-y-1 text-[11px] text-zn-text/60 dark:text-zinc-500">
                <li>Чист ред или колона = бонус.</li>
                <li>Поредни изчиствания = combo.</li>
                <li>Изиграй 3-те фигури за нови.</li>
                <li>Полето пълно = край.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Floating scores */}
      <AnimatePresence>
        {floatingScores.map((s) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 0.6, y: s.y, x: s.x }}
            animate={{ opacity: 1, scale: 1, y: s.y - 60, x: s.x }}
            exit={{ opacity: 0, y: s.y - 100 }}
            transition={{ duration: 1, type: 'spring', bounce: 0.3 }}
            className="fixed z-[120] pointer-events-none"
            style={{ left: '-1.5rem', top: '-0.5rem' }}
          >
            <span className="font-display text-3xl font-black text-zn-gold" style={{ textShadow: '1px 1px 0 #1c1428, -1px -1px 0 #1c1428, 1px -1px 0 #1c1428, -1px 1px 0 #1c1428' }}>
              +{s.score}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Drag ghost */}
      <div
        ref={dragGhostRef}
        className="fixed left-0 top-0 z-[100] pointer-events-none hidden"
        style={{ transition: 'transform 60ms linear' }}
      >
        <div style={{ filter: 'drop-shadow(0 16px 28px rgba(0,0,0,0.5))' }}>
          {selectedPiece && <PieceMiniBoard piece={selectedPiece} selected={false} theme={activeTheme} cellOverride={20} />}
        </div>
      </div>

      {/* Share toast */}
      <AnimatePresence>
        {shareNotice && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 comic-panel bg-white dark:bg-zinc-900 px-5 py-2.5 font-display text-xs font-black uppercase tracking-widest text-zn-text dark:text-white"
          >
            {shareNotice.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over overlay */}
      <AnimatePresence>
        {run.status === 'over' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24, delay: 0.15 }}
              className="relative w-[320px] max-w-[90vw] rounded-2xl border-[3px] border-[#1c1428] p-6 text-center shadow-[6px_6px_0_#1c1428]"
              style={{ background: `linear-gradient(180deg, ${activeTheme.ribbonFrom}dd 0%, ${activeTheme.ribbonTo}dd 100%)` }}
            >
              <p className="font-display text-xs font-black uppercase tracking-[0.3em] text-white/70 mb-1">Game Over</p>
              <p className="font-display text-5xl font-black text-white mb-1 tabular-nums" style={{ textShadow: '0 3px 8px rgba(0,0,0,0.4)' }}>
                {fmt(run.score)}
              </p>
              <p className="text-white/60 text-sm font-semibold mb-5">точки</p>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div>
                  <p className="text-white/50 text-[9px] font-display uppercase tracking-widest">Ниво</p>
                  <p className="text-white text-lg font-black font-display">{level}</p>
                </div>
                <div>
                  <p className="text-white/50 text-[9px] font-display uppercase tracking-widest">Ходове</p>
                  <p className="text-white text-lg font-black font-display">{run.moveCount}</p>
                </div>
                <div>
                  <p className="text-white/50 text-[9px] font-display uppercase tracking-widest">Линии</p>
                  <p className="text-white text-lg font-black font-display">{run.totalLines}</p>
                </div>
              </div>

              {run.fullWipes > 0 && (
                <p className="text-yellow-300 text-xs font-bold mb-4">{run.fullWipes} Perfect Clear{run.fullWipes > 1 ? 's' : ''}!</p>
              )}
              {run.score >= bestScore && run.score > 0 && (
                <p className="text-yellow-300 text-sm font-black font-display uppercase tracking-widest mb-4">Нов рекорд!</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => resetRun(true)}
                  className="flex-1 rounded-xl border-[2px] border-white/30 bg-white px-4 py-2.5 font-display text-sm font-black uppercase tracking-widest text-[#1c1428] transition-transform active:scale-95"
                >
                  Играй пак
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="rounded-xl border-[2px] border-white/30 bg-white/10 px-3 py-2.5 text-white transition-transform active:scale-95"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSettings && <BlockBustSettings settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
