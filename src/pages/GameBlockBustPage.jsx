import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Palette, RotateCcw, Settings2, Share2, Sparkles, Trophy, Zap } from 'lucide-react';
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
  resolveBlockBustMove,
  serializeBlockBustRun,
} from '../utils/blockBust';

const GAME_SLUG = 'blockbust';
const GAME_TITLE = 'Grid Riot';
const LINES_PER_LEVEL = 8;

function formatScore(value) {
  return String(Math.max(0, Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function createFreshRun(bestScore = 0, themeId = BLOCK_BUST_THEMES[0].id) {
  const board = createEmptyBlockBustBoard();
  return {
    board,
    tray: createBlockBustTray(board, 1),
    score: 0,
    totalLines: 0,
    combo: 0,
    fullWipes: 0,
    moveCount: 0,
    selectedSlotIndex: null,
    themeId,
    status: 'playing',
    bestScore,
  };
}

function loadSettings() {
  if (typeof window === 'undefined') return { ...BLOCK_BUST_DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(BLOCK_BUST_SETTINGS_KEY);
    return raw ? { ...BLOCK_BUST_DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...BLOCK_BUST_DEFAULT_SETTINGS };
  } catch {
    return { ...BLOCK_BUST_DEFAULT_SETTINGS };
  }
}

function loadRunState() {
  const meta = loadScopedGameProgress(GAME_SLUG, BLOCK_BUST_META_SCOPE);
  const hydrated = hydrateBlockBustRun(loadScopedGameProgress(GAME_SLUG, BLOCK_BUST_RUN_SCOPE));
  const bestScore = Math.max(0, Number(meta?.bestScore) || Number(hydrated?.bestScore) || 0);
  return hydrated ? { run: { ...hydrated, bestScore }, bestScore, resumed: true } : { run: createFreshRun(bestScore), bestScore, resumed: false };
}

function getRiskLabel(occupancy) {
  if (occupancy >= 0.72) return 'Критичен риск';
  if (occupancy >= 0.55) return 'Напечено';
  if (occupancy >= 0.35) return 'Под контрол';
  return 'Спокойно поле';
}

function getRiskTone(occupancy) {
  if (occupancy >= 0.72) return '#cc0a1a';
  if (occupancy >= 0.55) return '#e87420';
  if (occupancy >= 0.35) return '#e8b830';
  return '#00a0d2';
}

function buildShareText(run, level, themeName) {
  return [`zNews ${GAME_TITLE}`, `Точки: ${formatScore(run.score)}`, `Ниво: ${level}`, `Пълни изчиствания: ${run.fullWipes}`, `Тема: ${themeName}`, `Ходове: ${run.moveCount}`].join('\n');
}

function StatsTile({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[1.2rem] border-[3px] border-white/18 bg-white/12 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-white/72">
        <Icon className="h-4 w-4" />
        <span className="font-display text-[10px] uppercase tracking-[0.24em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-xl font-black uppercase text-white">{value}</p>
    </div>
  );
}

function Meter({ label, value, helper, color, percent }) {
  return (
    <div className="rounded-[1.2rem] border-[3px] border-[#1c1428] bg-white px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-[#6a6477] dark:text-zinc-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-black uppercase text-[#1c1428] dark:text-white">{value}</p>
        </div>
        <span className="rounded-full px-3 py-1 font-display text-[10px] font-black uppercase tracking-[0.22em] text-white" style={{ background: color }}>{helper}</span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#ece5da] dark:bg-zinc-800">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(6, Math.min(100, percent))}%`, background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,0.92) 100%)` }} />
      </div>
    </div>
  );
}

export default function GameBlockBustPage() {
  useDocumentTitle(makeTitle(GAME_TITLE));

  const initial = useMemo(() => loadRunState(), []);
  const [settings, setSettings] = useState(loadSettings);
  const [run, setRun] = useState(initial.run);
  const [bestScore, setBestScore] = useState(initial.bestScore);
  const [resumed, setResumed] = useState(initial.resumed);
  const [showSettings, setShowSettings] = useState(false);
  const [focusCell, setFocusCell] = useState(createBlockBustInitialCursor);
  const [anchorCell, setAnchorCell] = useState(null);
  const [banner, setBanner] = useState(null);
  const [shareNotice, setShareNotice] = useState(null);
  const boardRef = useRef(null);
  const dragStateRef = useRef({ active: false });
  const audioContextRef = useRef(null);
  const dragGhostRef = useRef(null);
  const [shakeCount, setShakeCount] = useState(0);
  const [floatingScores, setFloatingScores] = useState([]);

  const selectedPiece = useMemo(() => typeof run.selectedSlotIndex === 'number' ? (run.tray[run.selectedSlotIndex] || null) : null, [run.selectedSlotIndex, run.tray]);
  const level = useMemo(() => getBlockBustLevel(run.totalLines), [run.totalLines]);
  const occupancy = useMemo(() => getBlockBustBoardOccupancy(run.board), [run.board]);
  const activeTheme = useMemo(() => getBlockBustTheme(settings.themeMode === 'manual' ? settings.manualThemeId : run.themeId), [run.themeId, settings.manualThemeId, settings.themeMode]);
  const levelProgress = useMemo(() => Math.max(0, run.totalLines % LINES_PER_LEVEL), [run.totalLines]);
  const previewState = useMemo(() => {
    if (!selectedPiece || !anchorCell) return { cells: [], valid: false };
    const cells = selectedPiece.cells.map(([row, col]) => ({ row: anchorCell.row + row, col: anchorCell.col + col })).filter(({ row, col }) => row >= 0 && col >= 0 && row < 8 && col < 8);
    return { cells, valid: canPlaceBlockBustPiece(run.board, selectedPiece, anchorCell.row, anchorCell.col) };
  }, [anchorCell, run.board, selectedPiece]);

  useEffect(() => { try { window.localStorage.setItem(BLOCK_BUST_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* noop */ } }, [settings]);
  useEffect(() => { saveScopedGameProgress(GAME_SLUG, BLOCK_BUST_META_SCOPE, { bestScore }); }, [bestScore]);
  useEffect(() => { const serialized = serializeBlockBustRun({ ...run, bestScore }); if (serialized) saveScopedGameProgress(GAME_SLUG, BLOCK_BUST_RUN_SCOPE, serialized); }, [bestScore, run]);
  useEffect(() => {
    if (!selectedPiece || canPlaceBlockBustPiece(run.board, selectedPiece, focusCell.row, focusCell.col)) return;
    const firstPlacement = getBlockBustValidPlacements(run.board, selectedPiece)[0];
    if (firstPlacement) { setFocusCell(firstPlacement); setAnchorCell(firstPlacement); }
  }, [focusCell, run.board, selectedPiece]);
  useEffect(() => { if (!banner) return undefined; const timeout = setTimeout(() => setBanner(null), settings.animationLevel === 'reduced' ? 1200 : 1800); return () => clearTimeout(timeout); }, [banner, settings.animationLevel]);
  useEffect(() => { if (!shareNotice) return undefined; const timeout = setTimeout(() => setShareNotice(null), 2200); return () => clearTimeout(timeout); }, [shareNotice]);

  const playTone = useEffectEvent((type) => {
    if (!settings.soundEnabled || typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      const tone = { select: [320, 0.06, 0.03, 'triangle'], place: [220, 0.08, 0.05, 'square'], clear: [470, 0.11, 0.04, 'triangle'], perfect: [720, 0.18, 0.05, 'sine'], over: [145, 0.2, 0.045, 'sawtooth'] }[type] || [240, 0.05, 0.02, 'triangle'];
      oscillator.type = tone[3];
      oscillator.frequency.setValueAtTime(tone[0], now);
      gain.gain.setValueAtTime(tone[2], now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone[1]);
      oscillator.start(now);
      oscillator.stop(now + tone[1]);
    } catch { /* noop */ }
  });

  const persistDailyProgress = useEffectEvent((nextRun, status = 'played') => {
    saveGameProgress(GAME_SLUG, getTodayStr(), { score: nextRun.score, lines: nextRun.totalLines, fullWipes: nextRun.fullWipes, level: getBlockBustLevel(nextRun.totalLines), themeId: nextRun.themeId, gameStatus: status });
  });

  const resetRun = useEffectEvent((force = false) => {
    if (!force && settings.confirmRestart && !window.confirm('Сигурен ли си, че искаш да прекъснеш този рън?')) return;
    const themeId = settings.themeMode === 'manual' ? settings.manualThemeId : BLOCK_BUST_THEMES[0].id;
    setRun(createFreshRun(bestScore, themeId));
    setFocusCell(createBlockBustInitialCursor());
    setAnchorCell(null);
    setResumed(false);
    setBanner({ eyebrow: 'Ново издание', title: 'Полето е занулено', accent: getBlockBustTheme(themeId).accent });
  });

  const placeSelectedPiece = useEffectEvent((row, col, overridePiece, overrideIndex) => {
    const pieceIndex = overrideIndex !== undefined ? overrideIndex : run.selectedSlotIndex;
    const piece = overridePiece || (typeof pieceIndex === 'number' ? run.tray[pieceIndex] : null);
    if (!piece || run.status === 'over') return false;
    const result = resolveBlockBustMove(run.board, piece, row, col, run.combo);
    if (!result) { 
      if (settings.controlMode !== 'drag-tap') setBanner({ eyebrow: 'Невалидно', title: 'Тук не пасва фигура', accent: '#ef4444' }); 
      return false; 
    }
    const nextLevel = getBlockBustLevel(run.totalLines + result.linesCleared);
    
    const remainingTray = [...run.tray];
    if (typeof pieceIndex === 'number') remainingTray[pieceIndex] = null;
    
    const nextTray = remainingTray.every(p => !p) ? createBlockBustTray(result.board, nextLevel) : remainingTray;
    const nextThemeId = result.perfectClear ? getBlockBustNextThemeId(run.themeId) : run.themeId;
    const nextRun = { ...run, board: result.board, tray: nextTray, score: run.score + result.score, totalLines: run.totalLines + result.linesCleared, combo: result.nextCombo, fullWipes: run.fullWipes + (result.perfectClear ? 1 : 0), moveCount: run.moveCount + 1, selectedSlotIndex: null, themeId: nextThemeId, status: isBlockBustGameOver(result.board, nextTray) ? 'over' : 'playing' };
    setRun(nextRun);
    setResumed(false);
    setAnchorCell(null);
    if (nextRun.score > bestScore) setBestScore(nextRun.score);
    persistDailyProgress(nextRun, nextRun.status === 'over' ? 'over' : 'played');

    let shakeAmount = 0;
    if (result.perfectClear) shakeAmount = 3;
    else if (result.linesCleared >= 4) shakeAmount = 2;
    else if (result.linesCleared > 0) shakeAmount = 1;
    if (shakeAmount > 0) setShakeCount((c) => c + shakeAmount);

    if (result.score > 0) {
      const element = boardRef.current;
      let fx = 0; let fy = 0;
      if (element && piece) {
        const rect = element.getBoundingClientRect();
        fx = rect.left + ((col + piece.width / 2) * (rect.width / 8));
        fy = rect.top + ((row + piece.height / 2) * (rect.height / 8));
      }
      const newScore = { id: Date.now() + Math.random(), score: result.score, x: fx, y: fy };
      setFloatingScores(prev => [...prev.slice(-4), newScore]);
      setTimeout(() => {
        setFloatingScores(prev => prev.filter(s => s.id !== newScore.id));
      }, 1500);
    }

    if (result.perfectClear) { playTone('perfect'); setBanner({ type: 'perfect', eyebrow: 'Пълно изчистване', title: `Нова тема: ${getBlockBustTheme(nextThemeId).name}`, accent: getBlockBustTheme(nextThemeId).accent }); }
    else if (result.hadClear) { playTone('clear'); setBanner({ type: 'clear', eyebrow: result.nextCombo > 1 ? `Комбо x${result.nextCombo}` : 'Чист удар', title: `${result.linesCleared > 1 ? `${result.linesCleared} линии` : '1 линия'} изчистени`, accent: activeTheme.accent }); }
    else playTone('place');
    if (nextRun.status === 'over') { playTone('over'); setBanner({ type: 'over', eyebrow: 'Край на изданието', title: 'Полето е пълно', accent: '#cc0a1a' }); }
    
    if (dragGhostRef.current) dragGhostRef.current.style.display = 'none';
    return true;
  });

  const handleSelectPiece = useEffectEvent((index) => { setRun((current) => ({ ...current, selectedSlotIndex: current.selectedSlotIndex === index ? null : index })); playTone('select'); });
  const handleStartDragPiece = useEffectEvent((event, index) => {
    if (settings.controlMode !== 'drag-tap') return;
    dragStateRef.current = { active: true, pieceIndex: index, moved: false };
    setRun((current) => ({ ...current, selectedSlotIndex: index }));
    playTone('select');
    if (dragGhostRef.current) {
      dragGhostRef.current.style.display = 'block';
      dragGhostRef.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -150%) scale(1.6) rotate(-4deg)`;
    }
  });
  const updateAnchorFromPoint = useEffectEvent((clientX, clientY) => {
    const gridEl = document.getElementById('blockbust-grid');
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    
    const marginX = rect.width * 0.4;
    const marginTop = rect.height * 0.25;
    const marginBottom = rect.height * 0.7; // Massive buffer for thumbs hanging below the screen
    if (clientX < rect.left - marginX || clientX > rect.right + marginX || clientY < rect.top - marginTop || clientY > rect.bottom + marginBottom) { 
      setAnchorCell(null); 
      dragStateRef.current.anchorCell = null;
      return; 
    }
    
    let rawRow = Math.floor((clientY - rect.top) / (rect.height / 8));
    let rawCol = Math.floor((clientX - rect.left) / (rect.width / 8));

    let piece = selectedPiece;
    if (dragStateRef.current.active && typeof dragStateRef.current.pieceIndex === 'number') {
      piece = run.tray[dragStateRef.current.pieceIndex] || piece;
    }

    if (dragStateRef.current.active && piece) {
      rawCol -= Math.floor(piece.width / 2);
      rawRow -= Math.floor(piece.height);
    } else {
      rawRow = Math.max(0, Math.min(7, rawRow));
      rawCol = Math.max(0, Math.min(7, rawCol));
    }
    
    setAnchorCell(prev => (prev && prev.row === rawRow && prev.col === rawCol) ? prev : { row: rawRow, col: rawCol });
    setFocusCell(prev => (prev && prev.row === rawRow && prev.col === rawCol) ? prev : { row: rawRow, col: rawCol });
    dragStateRef.current.anchorCell = { row: rawRow, col: rawCol };
  });
  const handleWindowPointerUp = useEffectEvent(() => {
    const state = dragStateRef.current;
    if (!state.active) return;
    dragStateRef.current = { active: false };
    if (dragGhostRef.current) dragGhostRef.current.style.display = 'none';

    if (typeof state.pieceIndex === 'number') {
      const pieceToPlace = run.tray[state.pieceIndex];
      if (pieceToPlace && state.anchorCell) {
        placeSelectedPiece(state.anchorCell.row, state.anchorCell.col, pieceToPlace, state.pieceIndex);
      } else if (state.moved) {
        setRun(current => ({ ...current, selectedSlotIndex: null }));
      }
    }
  });
  useEffect(() => { function onPointerUp() { handleWindowPointerUp(); } window.addEventListener('pointerup', onPointerUp); window.addEventListener('pointercancel', onPointerUp); return () => { window.removeEventListener('pointerup', onPointerUp); window.removeEventListener('pointercancel', onPointerUp); }; }, [handleWindowPointerUp]);

  const handleWindowPointerMove = useEffectEvent((event) => {
    if (dragStateRef.current.active && dragGhostRef.current) {
      dragStateRef.current.moved = true;
      dragGhostRef.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -150%) scale(1.6) rotate(-4deg)`;
      updateAnchorFromPoint(event.clientX, event.clientY);
    }
  });
  useEffect(() => { window.addEventListener('pointermove', handleWindowPointerMove); return () => window.removeEventListener('pointermove', handleWindowPointerMove); }, [handleWindowPointerMove]);

  const handleBoardPointerMove = useEffectEvent((event) => { if (settings.controlMode !== 'drag-tap' && !selectedPiece) return; if (!dragStateRef.current.active && settings.controlMode === 'drag-tap') return; updateAnchorFromPoint(event.clientX, event.clientY); });
  const handleShare = useEffectEvent(async () => { const copied = await copyToClipboard(buildShareText(run, level, activeTheme.name)); setShareNotice({ message: copied ? 'Резултатът е копиран.' : 'Не успях да копирам резултата.' }); });
  const handleKeyDown = useEffectEvent((event) => {
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.code === 'Escape') { if (showSettings) setShowSettings(false); else if (typeof run.selectedSlotIndex === 'number') setRun((current) => ({ ...current, selectedSlotIndex: null })); return; }
    if (event.code === 'KeyR') { event.preventDefault(); resetRun(); return; }
    if (event.code === 'KeyO') { event.preventDefault(); setShowSettings((current) => !current); return; }
    if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') { event.preventDefault(); const index = Number.parseInt(event.code.replace('Digit', ''), 10) - 1; const piece = run.tray[index]; if (piece) handleSelectPiece(index); return; }
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      setFocusCell((current) => event.code === 'ArrowUp' ? { row: Math.max(0, current.row - 1), col: current.col } : event.code === 'ArrowDown' ? { row: Math.min(7, current.row + 1), col: current.col } : event.code === 'ArrowLeft' ? { row: current.row, col: Math.max(0, current.col - 1) } : { row: current.row, col: Math.min(7, current.col + 1) });
      return;
    }
    if ((event.code === 'Space' || event.code === 'Enter') && typeof run.selectedSlotIndex === 'number') { event.preventDefault(); placeSelectedPiece(focusCell.row, focusCell.col); }
  });
  useEffect(() => { function onKeyDown(event) { handleKeyDown(event); } window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); }, [handleKeyDown]);

  return (
    <div className="min-h-screen pb-20 transition-colors duration-500 dark:text-white" style={{ backgroundImage: `${activeTheme.pageGradient}, radial-gradient(circle at top right, ${activeTheme.pageGlow} 0%, transparent 35%)` }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] opacity-80" style={{ background: `radial-gradient(circle at 15% 10%, ${activeTheme.accentSoft} 0%, transparent 28%), radial-gradient(circle at 88% 12%, ${activeTheme.pageGlow} 0%, transparent 24%)` }} />
      <div className="relative mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/games" className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#1c1428] bg-white/90 px-4 py-2 font-display text-xs font-black uppercase tracking-[0.24em] text-[#1c1428] shadow-[4px_4px_0_rgba(28,20,40,0.14)]"><ArrowLeft className="h-4 w-4" />Към игрите</Link>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowSettings(true)} className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#1c1428] bg-white/90 px-4 py-2 font-display text-xs font-black uppercase tracking-[0.24em] text-[#1c1428] shadow-[4px_4px_0_rgba(28,20,40,0.14)]"><Settings2 className="h-4 w-4" />Настройки</button>
            <button type="button" onClick={handleShare} className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#1c1428] bg-white/90 px-4 py-2 font-display text-xs font-black uppercase tracking-[0.24em] text-[#1c1428] shadow-[4px_4px_0_rgba(28,20,40,0.14)]"><Share2 className="h-4 w-4" />Сподели</button>
            <button type="button" onClick={() => resetRun()} className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#1c1428] bg-zn-hot px-4 py-2 font-display text-xs font-black uppercase tracking-[0.24em] text-white shadow-[4px_4px_0_rgba(28,20,40,0.14)]"><RotateCcw className="h-4 w-4" />Нов рън</button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2.5rem] border-[4px] border-[#1c1428] bg-white/90 shadow-[8px_8px_0_#1c1428] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none">
          <div className="border-b-[3px] border-[#1c1428] px-6 py-6 text-white dark:border-zinc-700" style={{ background: `linear-gradient(135deg, ${activeTheme.ribbonFrom} 0%, ${activeTheme.ribbonTo} 100%)` }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.34em] text-white/75">Редакционен аркаден рън</p>
                <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none sm:text-6xl">{GAME_TITLE}</h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold text-white/82 sm:text-base">Подреждай три фигури наведнъж, чисти редове и колони и отключвай нова тема с всяко пълно изчистване.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[25rem]">
                <StatsTile label="Точки" value={formatScore(run.score)} icon={Trophy} />
                <StatsTile label="Ниво" value={level} icon={Zap} />
                <StatsTile label="Тема" value={activeTheme.name} icon={Palette} />
                <StatsTile label="Комбо" value={run.combo > 0 ? `x${run.combo}` : '0'} icon={Sparkles} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-6 lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
            <div className={`grid gap-4 ${settings.leftHanded ? 'lg:order-3' : 'lg:order-1'}`}>
              <section className="rounded-[1.8rem] border-[3px] border-[#1c1428] bg-[#f8f3ea] p-4 shadow-[5px_5px_0_rgba(28,20,40,0.14)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none">
                <p className="font-display text-xs font-black uppercase tracking-[0.28em] text-[#cc0a1a]">Ритъм на полето</p>
                <div className="mt-4 space-y-4">
                  <Meter label="Натиск" value={getRiskLabel(occupancy)} helper={`${Math.round(occupancy * 100)}%`} color={getRiskTone(occupancy)} percent={occupancy * 100} />
                  <Meter label="До ново ниво" value={`${levelProgress === 0 ? LINES_PER_LEVEL : LINES_PER_LEVEL - levelProgress} линии`} helper={`Ниво ${level + 1}`} color={activeTheme.accent} percent={(levelProgress / LINES_PER_LEVEL) * 100} />
                </div>
              </section>
              {resumed && run.status !== 'over' ? <section className="rounded-[1.6rem] border-[3px] border-[#1c1428] bg-white px-4 py-4 shadow-[4px_4px_0_rgba(28,20,40,0.12)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none"><p className="font-display text-xs font-black uppercase tracking-[0.28em] text-[#0088aa]">Продължаваш</p><p className="mt-2 text-sm font-semibold text-[#504961] dark:text-zinc-400">Върнахме те в последния рън. Остават {run.tray.length} фигури в текущата серия.</p></section> : null}
            </div>

            <div className={`grid gap-5 lg:order-2 ${shakeCount > 0 ? 'animate-shake' : ''}`} onAnimationEnd={() => setShakeCount(0)}>
              <div className="absolute left-0 right-0 top-[-2rem] z-30 flex justify-center pointer-events-none">
                <AnimatePresence>
                  {banner ? (
                    <motion.div
                      key={`${banner.eyebrow}-${banner.title}`}
                      initial={{ opacity: 0, scale: 0.5, rotate: banner.type === 'over' ? -6 : 8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, rotate: banner.type === 'over' ? -3 : 4, y: 0 }}
                      exit={{ opacity: 0, scale: 1.1, y: -20 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className={`rounded-xl border-[4px] border-[#1C1428] px-6 py-3 shadow-[6px_6px_0_#1c1428] ${banner.type === 'perfect' ? 'bg-zn-gold' : banner.type === 'over' ? 'bg-zn-hot' : 'bg-zn-purple'}`}
                    >
                      <p className="font-display text-[11px] font-black uppercase tracking-[0.3em] text-white/90 drop-shadow-md">
                        {banner.eyebrow}
                      </p>
                      <p className="mt-1 font-display text-2xl font-black uppercase leading-none tracking-wide text-white drop-shadow-lg text-comic-stroke-black">
                        {banner.title}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
              <section className="mx-auto w-full max-w-[34rem] rounded-[1.8rem] border-[3px] border-[#1c1428] bg-white/72 px-4 py-4 shadow-[5px_5px_0_rgba(28,20,40,0.12)] backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/70 dark:shadow-none">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-display text-xs uppercase tracking-[0.28em] text-[#6a6477] dark:text-zinc-500">Поле 8x8</p><p className="mt-1 text-sm font-semibold text-[#504961] dark:text-zinc-400">{selectedPiece ? 'Избраната фигура следва курсора или фокуса. Пусни я върху валидна клетка.' : 'Докосни фигура отдолу, за да започнеш хода.'}</p></div>
                  <div className="rounded-full border-[3px] border-[#1c1428] bg-[#f8f3ea] px-3 py-2 font-display text-[10px] font-black uppercase tracking-[0.24em] text-[#1c1428] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white">{settings.controlMode === 'drag-tap' ? 'Влачи + докосни' : 'Само докосни'}</div>
                </div>
                <BlockBustBoard ref={boardRef} board={run.board} theme={activeTheme} previewCells={previewState.cells} invalidPreview={!previewState.valid && Boolean(selectedPiece) && Boolean(anchorCell)} focusCell={focusCell} showPlacementPreview={settings.showPlacementPreview} contrastMode={settings.gridContrast} patternAssist={settings.patternAssist} onCellEnter={(row, col) => { if (dragStateRef.current.active) return; setAnchorCell({ row, col }); setFocusCell({ row, col }); }} onCellClick={(row, col) => placeSelectedPiece(row, col)} onBoardPointerMove={handleBoardPointerMove} onBoardPointerUp={handleWindowPointerUp} onBoardLeave={() => { if (!dragStateRef.current.active) setAnchorCell(null); }} />
                <div className="mt-4 grid gap-3 rounded-[1.4rem] border-[3px] border-[#1c1428] bg-[#f8f3ea] px-4 py-4 shadow-[4px_4px_0_rgba(28,20,40,0.08)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="font-display text-xs uppercase tracking-[0.28em] text-[#6a6477] dark:text-zinc-500">Лента с фигури</p><p className="mt-1 text-sm font-semibold text-[#504961] dark:text-zinc-400">Изиграй и трите, за да получиш нова серия.</p></div>
                    <div className="rounded-full px-3 py-1 font-display text-[10px] font-black uppercase tracking-[0.24em] text-white" style={{ background: activeTheme.accent }}>{selectedPiece ? `Избрана: ${selectedPiece.size} клетки` : 'Няма избор'}</div>
                  </div>
                  <BlockBustTray pieces={run.tray} selectedSlotIndex={run.selectedSlotIndex} onSelectPiece={handleSelectPiece} onStartDragPiece={handleStartDragPiece} theme={activeTheme} patternAssist={settings.patternAssist} controlMode={settings.controlMode} />
                </div>
              </section>
            </div>

            <div className={`grid gap-4 ${settings.leftHanded ? 'lg:order-1' : 'lg:order-3'}`}>
              <section className="rounded-[1.8rem] border-[3px] border-[#1c1428] bg-[#f8f3ea] p-4 shadow-[5px_5px_0_rgba(28,20,40,0.14)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none">
                <p className="font-display text-xs font-black uppercase tracking-[0.3em] text-[#5b1a8c]">Архив на темите</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {BLOCK_BUST_THEMES.map((themeItem) => {
                    const isActive = themeItem.id === activeTheme.id;
                    return <div key={themeItem.id} className={`rounded-[1rem] border-[3px] px-3 py-3 transition-transform ${isActive ? 'translate-y-[-2px]' : ''}`} style={{ borderColor: isActive ? themeItem.accent : '#1c1428', background: isActive ? `linear-gradient(180deg, ${themeItem.accentSoft} 0%, rgba(255,255,255,0.96) 100%)` : 'rgba(255,255,255,0.88)', boxShadow: isActive ? `0 10px 24px ${themeItem.fillShadow}` : '4px 4px 0 rgba(28,20,40,0.1)' }}><p className="font-display text-[10px] uppercase tracking-[0.22em] text-[#6a6477]">{isActive ? 'Активна' : 'Тема'}</p><p className="mt-2 font-display text-sm font-black uppercase text-[#1c1428]">{themeItem.name}</p></div>;
                  })}
                </div>
                <div className="mt-4 rounded-[1.2rem] border-[3px] border-[#1c1428] bg-white px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="font-display text-xs uppercase tracking-[0.22em] text-[#6a6477] dark:text-zinc-500">Смяна на темата</p>
                  <p className="mt-2 font-display text-3xl font-black uppercase text-[#1c1428] dark:text-white">{activeTheme.name}</p>
                  <p className="mt-2 text-sm font-semibold text-[#5c5666] dark:text-zinc-400">{settings.themeMode === 'manual' ? 'Темата е заключена ръчно. Пълните изчиствания още носят бонус, но не сменят skin-а.' : `Следващото пълно изчистване ще те прехвърли към изцяло нова случайна тема.`}</p>
                </div>
              </section>
              <section className="rounded-[1.8rem] border-[3px] border-[#1c1428] bg-[#f8f3ea] p-4 shadow-[5px_5px_0_rgba(28,20,40,0.14)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none"><p className="font-display text-xs font-black uppercase tracking-[0.28em] text-[#cc0a1a]">Как се държи рънът</p><ul className="mt-4 space-y-3 text-sm font-semibold text-[#5c5666] dark:text-zinc-400"><li>Изчистеният ред или колона вдига комбото и темпото на ръна.</li><li>Пълното изчистване сменя темата и носи най-големия бонус.</li><li>Новата серия идва едва след като изиграеш и трите фигури.</li><li>Колкото по-плътно е полето, толкова по-важен става изборът на фигура.</li></ul></section>
              {run.status === 'over' ? <section className="rounded-[1.8rem] border-[3px] border-[#1c1428] bg-white p-5 shadow-[5px_5px_0_rgba(28,20,40,0.14)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none"><p className="font-display text-xs font-black uppercase tracking-[0.28em] text-[#cc0a1a]">Край на изданието</p><h2 className="mt-3 font-display text-3xl font-black uppercase text-[#1c1428] dark:text-white">Рънът приключи</h2><p className="mt-2 text-sm font-semibold text-[#5c5666] dark:text-zinc-400">Събра {formatScore(run.score)} точки, стигна до {activeTheme.name} и направи {run.fullWipes} пълни изчиствания.</p><div className="mt-5 grid gap-3"><button type="button" onClick={() => resetRun(true)} className="rounded-[1.1rem] border-[3px] border-[#1c1428] bg-zn-hot px-4 py-3 font-display text-sm font-black uppercase tracking-[0.22em] text-white shadow-[4px_4px_0_rgba(28,20,40,0.14)]">Играй пак</button><button type="button" onClick={handleShare} className="rounded-[1.1rem] border-[3px] border-[#1c1428] bg-white px-4 py-3 font-display text-sm font-black uppercase tracking-[0.22em] text-[#1c1428] shadow-[4px_4px_0_rgba(28,20,40,0.12)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:shadow-none">Сподели резултата</button></div></section> : null}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>{shareNotice ? <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border-[3px] border-[#1c1428] bg-white px-5 py-3 font-display text-xs font-black uppercase tracking-[0.24em] text-[#1c1428] shadow-[4px_4px_0_rgba(28,20,40,0.14)]">{shareNotice.message}</motion.div> : null}</AnimatePresence>
      <AnimatePresence>
        {floatingScores.map((s) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, scale: 0.5, y: s.y, x: s.x, rotate: (Math.random() - 0.5) * 20 }}
            animate={{ opacity: 1, scale: 1, y: s.y - 80, x: s.x }}
            exit={{ opacity: 0, scale: 1.2, y: s.y - 120 }}
            transition={{ duration: 1.2, type: 'spring', bounce: 0.4 }}
            className="fixed z-[120] pointer-events-none drop-shadow-md"
            style={{ left: '-2rem', top: '-1rem' }}
          >
            <span className="font-display text-4xl font-black text-zn-gold text-comic-stroke-black" style={{ filter: 'drop-shadow(2px 2px 0 rgba(28,20,40,1))' }}>
              +{s.score}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      <div 
        ref={dragGhostRef} 
        className="fixed left-0 top-0 z-[100] pointer-events-none hidden transition-transform duration-75 origin-center"
      >
        <div className="drop-shadow-[0_20px_35px_rgba(0,0,0,0.55)]">
           {selectedPiece && <PieceMiniBoard piece={selectedPiece} selected={false} theme={activeTheme} />}
        </div>
      </div>
      {showSettings ? <BlockBustSettings settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} /> : null}
    </div>
  );
}
