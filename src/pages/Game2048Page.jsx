import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Share2, Trophy, Undo2 } from 'lucide-react';
import {
  addRandomTile,
  canMove,
  getMaxTile,
  getTileColor,
  GRID,
  hasWon,
  initBoard,
  move,
} from '../utils/game2048';
import { loadScopedGameProgress, saveScopedGameProgress } from '../utils/gameStorage';

const GAME_SLUG = '2048';
const STORAGE_SCOPE = 'session';
const CELL_SIZE = 72;
const GAP = 8;
const BOARD_PAD = 8;
const BOARD_SIZE = GRID * CELL_SIZE + (GRID + 1) * GAP + BOARD_PAD * 2;

function formatScore(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function Game2048Page() {
  const [board, setBoard] = useState(initBoard);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameStatus, setGameStatus] = useState('playing'); // playing | won | over
  const [wonContinuing, setWonContinuing] = useState(false);
  const [mergedCells, setMergedCells] = useState([]);
  const [newTile, setNewTile] = useState(null);
  const [prevBoard, setPrevBoard] = useState(null);
  const [prevScore, setPrevScore] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [undoUsed, setUndoUsed] = useState(false);

  const boardRef = useRef(board);
  const scoreRef = useRef(score);
  const statusRef = useRef(gameStatus);
  const wonContRef = useRef(wonContinuing);
  boardRef.current = board;
  scoreRef.current = score;
  statusRef.current = gameStatus;
  wonContRef.current = wonContinuing;

  // Load best score
  useEffect(() => {
    const saved = loadScopedGameProgress(GAME_SLUG, STORAGE_SCOPE);
    if (saved?.bestScore) setBestScore(saved.bestScore);
  }, []);

  // Save best score
  const saveBest = useCallback((newScore) => {
    setBestScore((prev) => {
      const best = Math.max(prev, newScore);
      saveScopedGameProgress(GAME_SLUG, STORAGE_SCOPE, { bestScore: best });
      return best;
    });
  }, []);

  const doMove = useCallback((direction) => {
    if (statusRef.current === 'over') return;
    if (statusRef.current === 'won' && !wonContRef.current) return;

    const result = move(boardRef.current, direction);
    if (!result) return;

    // Save for undo
    setPrevBoard(boardRef.current);
    setPrevScore(scoreRef.current);
    setUndoUsed(false);

    const withTile = addRandomTile(result.board);
    const finalBoard = withTile || result.board;

    // Find the new tile position
    if (withTile) {
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if (withTile[r][c] !== result.board[r][c]) {
            setNewTile({ r, c });
            break;
          }
        }
      }
    }

    setBoard(finalBoard);
    setMergedCells(result.mergedCells);
    setScore((prev) => prev + result.score);
    setMoveCount((prev) => prev + 1);

    const newTotalScore = scoreRef.current + result.score;
    saveBest(newTotalScore);

    // Clear animation flags after animation
    setTimeout(() => {
      setMergedCells([]);
      setNewTile(null);
    }, 200);

    // Check win/loss
    if (!wonContRef.current && hasWon(finalBoard)) {
      setGameStatus('won');
    } else if (!canMove(finalBoard)) {
      setGameStatus('over');
    }
  }, [saveBest]);

  const handleUndo = useCallback(() => {
    if (!prevBoard || undoUsed) return;
    setBoard(prevBoard);
    setScore(prevScore);
    setUndoUsed(true);
    setGameStatus('playing');
    setMergedCells([]);
    setNewTile(null);
  }, [prevBoard, prevScore, undoUsed]);

  const startNewGame = useCallback(() => {
    setBoard(initBoard());
    setScore(0);
    setGameStatus('playing');
    setWonContinuing(false);
    setMergedCells([]);
    setNewTile(null);
    setPrevBoard(null);
    setPrevScore(null);
    setUndoUsed(false);
    setMoveCount(0);
  }, []);

  const continueAfterWin = useCallback(() => {
    setWonContinuing(true);
    setGameStatus('playing');
  }, []);

  // Keyboard controls
  useEffect(() => {
    function handleKey(e) {
      const tag = e.target.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;

      let dir = null;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': dir = 'up'; break;
        case 'ArrowDown': case 's': case 'S': dir = 'down'; break;
        case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break;
        case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
        case 'z': case 'Z': handleUndo(); return;
        default: return;
      }
      e.preventDefault();
      doMove(dir);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [doMove, handleUndo]);

  // Touch/swipe controls
  const touchStartRef = useRef(null);
  useEffect(() => {
    function handleTouchStart(e) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    function handleTouchEnd(e) {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        doMove(dx > 0 ? 'right' : 'left');
      } else {
        doMove(dy > 0 ? 'down' : 'up');
      }
    }
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [doMove]);

  const handleShare = useCallback(() => {
    const maxTile = getMaxTile(board);
    const text = `zNews 2048\n🏆 ${formatScore(score)} точки\n🔢 Макс плочка: ${maxTile}\n📊 Ходове: ${moveCount}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => alert('Резултатът е копиран!'));
    } else {
      // CEF 103 fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Резултатът е копиран!');
    }
  }, [board, score, moveCount]);

  const isMerged = useCallback((r, c) => mergedCells.some((m) => m.r === r && m.c === c), [mergedCells]);
  const isNew = useCallback((r, c) => newTile && newTile.r === r && newTile.c === c, [newTile]);

  return (
    <div className="min-h-screen bg-zn-paper comic-dots dark:bg-zinc-950 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-b from-amber-900 via-amber-800 to-amber-700 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800 pt-6 pb-10 mb-8 border-b-4 border-[#1C1428] dark:border-zinc-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <Link to="/games" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 font-display text-sm uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Всички игри
          </Link>
          <p className="text-yellow-400 font-display text-xs uppercase tracking-[0.3em] mb-1">Пъзел</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-white font-display tracking-wider leading-none mb-2" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.3)' }}>
            2048
          </h1>
          <p className="text-white/60 text-sm font-semibold max-w-md">
            Плъзгай плочки, сливай числа, достигни 2048!
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
          {/* Left panel — desktop */}
          <div className="hidden md:flex flex-col gap-3 w-36">
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Точки</span>
              <p className="text-xl font-black font-display text-zn-text dark:text-white">{formatScore(score)}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Рекорд</span>
              <p className="text-lg font-black font-display text-zn-hot">{formatScore(bestScore)}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Ходове</span>
              <p className="text-lg font-black font-display text-amber-600 dark:text-amber-400">{moveCount}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Макс плочка</span>
              <p className="text-lg font-black font-display text-amber-700 dark:text-amber-300">{getMaxTile(board)}</p>
            </div>

            <button type="button" onClick={handleUndo} disabled={!prevBoard || undoUsed}
              className={`comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-xs tracking-widest transition-colors ${!prevBoard || undoUsed ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zn-paper dark:hover:bg-zinc-800'}`}>
              <Undo2 className="w-4 h-4 mx-auto mb-1" />Върни (Z)
            </button>
            <button type="button" onClick={startNewGame}
              className="comic-panel bg-amber-600 text-white p-3 text-center font-display uppercase text-xs tracking-widest hover:bg-amber-700 transition-colors">
              <RotateCcw className="w-4 h-4 mx-auto mb-1" />Нова игра
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
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Рекорд</span>
                <span className="text-sm font-black font-display text-zn-hot">{formatScore(bestScore)}</span>
              </div>
              <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Макс</span>
                <span className="text-sm font-black font-display text-amber-600 dark:text-amber-400">{getMaxTile(board)}</span>
              </div>
            </div>

            {/* Mobile buttons */}
            <div className="flex md:hidden gap-2 flex-wrap justify-center">
              <button type="button" onClick={handleUndo} disabled={!prevBoard || undoUsed}
                className={`px-3 py-1 text-xs font-display uppercase tracking-widest border-2 border-[#1C1428]/20 dark:border-zinc-700 transition-colors ${!prevBoard || undoUsed ? 'opacity-40 cursor-not-allowed' : 'text-zn-text/60 dark:text-zinc-400'}`}>
                <Undo2 className="w-3 h-3 inline mr-1" />Върни
              </button>
              <button type="button" onClick={startNewGame}
                className="px-3 py-1 text-xs font-display uppercase tracking-widest border-2 border-amber-600 bg-amber-600/20 text-amber-700 dark:text-amber-400">
                <RotateCcw className="w-3 h-3 inline mr-1" />Нова
              </button>
            </div>

            <div className="comic-panel p-2 relative" style={{ backgroundColor: '#bbada0' }}>
              {/* Game over overlay */}
              {gameStatus === 'over' && (
                <div className="absolute inset-0 z-20 bg-black/75 flex items-center justify-center rounded">
                  <div className="text-center px-4">
                    <p className="text-zn-hot font-display text-3xl uppercase tracking-widest mb-1 font-black">Край!</p>
                    <p className="text-white font-display text-lg mb-1">{formatScore(score)} точки</p>
                    <p className="text-white/60 text-sm mb-1">Макс плочка: {getMaxTile(board)}</p>
                    <p className="text-white/40 text-xs mb-3">{moveCount} хода</p>
                    {score >= bestScore && score > 0 && (
                      <p className="text-yellow-400 font-display uppercase tracking-widest text-sm mb-3 flex items-center justify-center gap-2">
                        <Trophy className="w-4 h-4" /> Нов рекорд!
                      </p>
                    )}
                    <div className="flex gap-3 justify-center">
                      <button type="button" onClick={startNewGame} className="bg-amber-600 text-white font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <RotateCcw className="w-4 h-4 inline mr-1" />Пак
                      </button>
                      <button type="button" onClick={handleShare} className="bg-white text-zn-text font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <Share2 className="w-4 h-4 inline mr-1" />Сподели
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Won overlay */}
              {gameStatus === 'won' && (
                <div className="absolute inset-0 z-20 bg-black/75 flex items-center justify-center rounded">
                  <div className="text-center px-4">
                    <p className="text-yellow-400 font-display text-3xl uppercase tracking-widest mb-1 font-black">2048!</p>
                    <p className="text-white font-display text-lg mb-2">{formatScore(score)} точки за {moveCount} хода</p>
                    <div className="flex gap-3 justify-center">
                      <button type="button" onClick={continueAfterWin} className="bg-amber-600 text-white font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        Продължи
                      </button>
                      <button type="button" onClick={startNewGame} className="bg-white text-zn-text font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <RotateCcw className="w-4 h-4 inline mr-1" />Нова
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid */}
              <div
                className="relative"
                style={{
                  width: GRID * CELL_SIZE + (GRID + 1) * GAP,
                  height: GRID * CELL_SIZE + (GRID + 1) * GAP,
                  borderRadius: 6,
                }}
              >
                {/* Empty cell backgrounds */}
                {Array.from({ length: GRID * GRID }).map((_, idx) => {
                  const r = Math.floor(idx / GRID);
                  const c = idx % GRID;
                  return (
                    <div
                      key={`bg-${r}-${c}`}
                      className="absolute rounded"
                      style={{
                        left: GAP + c * (CELL_SIZE + GAP),
                        top: GAP + r * (CELL_SIZE + GAP),
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        backgroundColor: 'rgba(238,228,218,0.35)',
                      }}
                    />
                  );
                })}

                {/* Tiles */}
                {board.map((row, r) =>
                  row.map((value, c) => {
                    if (value === 0) return null;
                    const colors = getTileColor(value);
                    const merged = isMerged(r, c);
                    const fresh = isNew(r, c);
                    const fontSize = value >= 1024 ? 22 : value >= 128 ? 28 : 34;

                    return (
                      <div
                        key={`tile-${r}-${c}`}
                        className="absolute rounded flex items-center justify-center"
                        style={{
                          left: GAP + c * (CELL_SIZE + GAP),
                          top: GAP + r * (CELL_SIZE + GAP),
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          backgroundColor: colors.bg,
                          color: colors.text,
                          fontSize,
                          fontFamily: '"Oswald", sans-serif',
                          fontWeight: 800,
                          transition: 'left 0.12s ease, top 0.12s ease',
                          transform: merged ? 'scale(1.15)' : fresh ? 'scale(0)' : 'scale(1)',
                          animation: fresh ? 'tileAppear 0.2s ease forwards' : merged ? 'tilePop 0.2s ease' : undefined,
                          zIndex: value,
                          boxShadow: value >= 2048 ? '0 0 20px rgba(237,194,46,0.5)' : undefined,
                        }}
                      >
                        {value}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Help text */}
            <p className="text-[11px] text-zn-text/40 dark:text-zinc-500 text-center max-w-xs">
              Стрелки / WASD — мести плочките. Z — връща последния ход.
            </p>
          </div>

          {/* Right panel — desktop */}
          <div className="hidden md:flex flex-col gap-3 w-36">
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400 block mb-2 text-center">Как се играе</span>
              <div className="text-[10px] text-zn-text/60 dark:text-zinc-400 space-y-1.5">
                <p>Плъзни плочки с <strong>← → ↑ ↓</strong> или <strong>WASD</strong>.</p>
                <p>Еднакви числа се <strong>сливат</strong>.</p>
                <p>Цел: създай плочка <strong>2048</strong>.</p>
                <p><strong>Z</strong> — връща един ход назад.</p>
              </div>
            </div>
            <button type="button" onClick={handleShare}
              className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-[10px] tracking-widest text-zn-text/60 dark:text-zinc-400 hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
              <Share2 className="w-4 h-4 mx-auto mb-1" />Сподели
            </button>
          </div>
        </div>
      </div>

      {/* CSS animations for tiles — CEF 103 safe */}
      <style>{`
        @keyframes tileAppear {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes tilePop {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
