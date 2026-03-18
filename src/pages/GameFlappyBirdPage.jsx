import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, RotateCcw, Share2, Trophy } from 'lucide-react';
import {
  CANVAS_H,
  CANVAS_W,
  checkCollision,
  checkScore,
  createBird,
  createPipe,
  drawBackground,
  drawBird,
  drawGround,
  drawPipe,
  drawScore,
  flapBird,
  PIPE_SPAWN_INTERVAL,
  PIPE_SPEED,
  updateBird,
  updatePipes,
} from '../utils/flappyBird';
import { loadScopedGameProgress, saveScopedGameProgress } from '../utils/gameStorage';

const GAME_SLUG = 'flappybird';
const STORAGE_SCOPE = 'session';

function formatScore(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function GameFlappyBirdPage() {
  const canvasRef = useRef(null);
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | over
  const [displayScore, setDisplayScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  // Mutable game state in refs for the animation loop
  const birdRef = useRef(createBird());
  const pipesRef = useRef([]);
  const scoreRef = useRef(0);
  const frameRef = useRef(0);
  const statusRef = useRef('idle');
  const groundOffsetRef = useRef(0);
  const animFrameRef = useRef(null);
  const bestScoreRef = useRef(0);
  const flashRef = useRef(0); // screen flash on death

  statusRef.current = gameStatus;

  // Load best score
  useEffect(() => {
    const saved = loadScopedGameProgress(GAME_SLUG, STORAGE_SCOPE);
    if (saved?.bestScore) {
      setBestScore(saved.bestScore);
      bestScoreRef.current = saved.bestScore;
    }
  }, []);

  const saveBest = useCallback((newScore) => {
    if (newScore > bestScoreRef.current) {
      bestScoreRef.current = newScore;
      setBestScore(newScore);
      saveScopedGameProgress(GAME_SLUG, STORAGE_SCOPE, { bestScore: newScore });
    }
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const status = statusRef.current;

    if (status === 'playing') {
      // Update bird
      birdRef.current = updateBird(birdRef.current);

      // Update pipes
      pipesRef.current = updatePipes(pipesRef.current);

      // Spawn new pipes
      frameRef.current += 1;
      if (frameRef.current % PIPE_SPAWN_INTERVAL === 0) {
        pipesRef.current.push(createPipe(frameRef.current));
      }

      // Check score
      const scoreResult = checkScore(birdRef.current, pipesRef.current);
      pipesRef.current = scoreResult.pipes;
      if (scoreResult.scored > 0) {
        scoreRef.current += scoreResult.scored;
        setDisplayScore(scoreRef.current);
      }

      // Check collision
      if (checkCollision(birdRef.current, pipesRef.current)) {
        statusRef.current = 'over';
        setGameStatus('over');
        saveBest(scoreRef.current);
        flashRef.current = 8;
      }

      // Ground scroll
      groundOffsetRef.current += PIPE_SPEED;
    }

    // --- Draw ---
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background
    drawBackground(ctx, groundOffsetRef.current);

    // Pipes
    for (const pipe of pipesRef.current) {
      drawPipe(ctx, pipe);
    }

    // Ground
    drawGround(ctx, groundOffsetRef.current);

    // Bird
    drawBird(ctx, birdRef.current);

    // Score (in-game)
    if (status === 'playing') {
      drawScore(ctx, scoreRef.current);
    }

    // Death flash
    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashRef.current / 10})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      flashRef.current -= 1;
    }

    // Idle — bob the bird up and down
    if (status === 'idle') {
      const bobY = Math.sin(frameRef.current * 0.05) * 8;
      birdRef.current = { ...birdRef.current, y: (PLAYABLE_H / 2 - 20) + bobY, wingPhase: (birdRef.current.wingPhase || 0) + 0.15, rotation: 0 };
      frameRef.current += 1;
      groundOffsetRef.current += PIPE_SPEED * 0.5; // slow ground scroll on idle

      drawScore(ctx, 0);
      ctx.save();
      ctx.font = 'bold 16px "Oswald", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1C1428';
      ctx.lineWidth = 3;
      ctx.strokeText('Натисни SPACE или кликни', CANVAS_W / 2, CANVAS_H / 2 + 60);
      ctx.fillText('Натисни SPACE или кликни', CANVAS_W / 2, CANVAS_H / 2 + 60);
      ctx.restore();
    }

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [saveBest]);

  // Start/stop animation loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawFrame]);

  const flap = useCallback(() => {
    if (statusRef.current === 'playing') {
      birdRef.current = flapBird(birdRef.current);
    }
  }, []);

  const startGame = useCallback(() => {
    birdRef.current = createBird();
    pipesRef.current = [];
    scoreRef.current = 0;
    frameRef.current = 0;
    groundOffsetRef.current = 0;
    flashRef.current = 0;
    setDisplayScore(0);
    setGameStatus('playing');
    statusRef.current = 'playing';
    // First flap
    birdRef.current = flapBird(birdRef.current);
  }, []);

  // Keyboard — SPACE, ↑, W, Enter, click all work
  useEffect(() => {
    function handleKey(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      const flapKeys = [' ', 'ArrowUp', 'w', 'W'];
      const startKeys = [' ', 'ArrowUp', 'w', 'W', 'Enter'];

      if (flapKeys.includes(e.key) || e.key === 'Enter') {
        e.preventDefault();
        // Blur focused button so subsequent keys work
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
          document.activeElement.blur();
        }
        if (statusRef.current === 'idle' || statusRef.current === 'over') {
          if (startKeys.includes(e.key)) startGame();
        } else {
          if (flapKeys.includes(e.key)) flap();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [startGame, flap]);

  // Canvas click/touch
  const handleCanvasInteract = useCallback(() => {
    if (statusRef.current === 'idle' || statusRef.current === 'over') {
      startGame();
    } else {
      flap();
    }
  }, [startGame, flap]);

  const handleShare = useCallback(() => {
    const text = `zNews Flappy Bird\n🏆 ${formatScore(displayScore)} точки\n🥇 Рекорд: ${formatScore(bestScore)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => alert('Резултатът е копиран!'));
    } else {
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
  }, [displayScore, bestScore]);

  return (
    <div className="min-h-screen bg-zn-paper comic-dots dark:bg-zinc-950 pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-b from-sky-800 via-sky-700 to-sky-600 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800 pt-6 pb-10 mb-8 border-b-4 border-[#1C1428] dark:border-zinc-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:20px_20px]" />
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <Link to="/games" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 font-display text-sm uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Всички игри
          </Link>
          <p className="text-yellow-400 font-display text-xs uppercase tracking-[0.3em] mb-1">Аркада</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-white font-display tracking-wider leading-none mb-2" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.3)' }}>
            Flappy Bird
          </h1>
          <p className="text-white/60 text-sm font-semibold max-w-md">
            Кликни или натисни SPACE, за да летиш. Не удряй тръбите!
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
          {/* Left panel — desktop */}
          <div className="hidden md:flex flex-col gap-3 w-36">
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Точки</span>
              <p className="text-xl font-black font-display text-zn-text dark:text-white">{formatScore(displayScore)}</p>
            </div>
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400">Рекорд</span>
              <p className="text-lg font-black font-display text-zn-hot">{formatScore(bestScore)}</p>
            </div>

            {gameStatus === 'over' && (
              <>
                <button type="button" onClick={startGame}
                  className="comic-panel bg-sky-600 text-white p-3 text-center font-display uppercase text-xs tracking-widest hover:bg-sky-700 transition-colors">
                  <RotateCcw className="w-4 h-4 mx-auto mb-1" />Пак
                </button>
                <button type="button" onClick={handleShare}
                  className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center font-display uppercase text-[10px] tracking-widest text-zn-text/60 dark:text-zinc-400 hover:bg-zn-paper dark:hover:bg-zinc-800 transition-colors">
                  <Share2 className="w-4 h-4 mx-auto mb-1" />Сподели
                </button>
              </>
            )}

            {gameStatus === 'idle' && (
              <button type="button" onClick={startGame}
                className="comic-panel bg-sky-600 text-white p-3 text-center font-display uppercase text-xs tracking-widest hover:bg-sky-700 transition-colors">
                <Play className="w-4 h-4 mx-auto mb-1" />Старт
              </button>
            )}
          </div>

          {/* Center — canvas */}
          <div className="flex flex-col items-center gap-4">
            {/* Mobile stats */}
            <div className="flex md:hidden gap-2 text-center flex-wrap justify-center">
              <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Точки</span>
                <span className="text-sm font-black font-display text-zn-text dark:text-white">{formatScore(displayScore)}</span>
              </div>
              <div className="comic-panel bg-white dark:bg-zinc-900 px-2.5 py-1.5">
                <span className="text-[8px] font-display uppercase tracking-widest text-zn-text/50 dark:text-zinc-400 block">Рекорд</span>
                <span className="text-sm font-black font-display text-zn-hot">{formatScore(bestScore)}</span>
              </div>
            </div>

            <div className="comic-panel bg-[#0d0d1a] p-2 relative">
              {/* Game over overlay on canvas */}
              {gameStatus === 'over' && (
                <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center" style={{ margin: 8 }}>
                  <div className="text-center px-4">
                    <p className="text-zn-hot font-display text-3xl uppercase tracking-widest mb-1 font-black">Край!</p>
                    <p className="text-white font-display text-lg mb-1">{formatScore(displayScore)} точки</p>
                    {displayScore >= bestScore && displayScore > 0 && (
                      <p className="text-yellow-400 font-display uppercase tracking-widest text-sm mb-3 flex items-center justify-center gap-2">
                        <Trophy className="w-4 h-4" /> Нов рекорд!
                      </p>
                    )}
                    <div className="flex gap-3 justify-center">
                      <button type="button" onClick={startGame} className="bg-sky-600 text-white font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <RotateCcw className="w-4 h-4 inline mr-1" />Пак
                      </button>
                      <button type="button" onClick={handleShare} className="bg-white text-zn-text font-display uppercase tracking-widest px-5 py-2.5 border-3 border-[#1C1428] shadow-comic hover:-translate-y-0.5 transition-transform text-sm">
                        <Share2 className="w-4 h-4 inline mr-1" />Сподели
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                onClick={handleCanvasInteract}
                onTouchStart={(e) => { e.preventDefault(); handleCanvasInteract(); }}
                className="block cursor-pointer"
                style={{ width: CANVAS_W, height: CANVAS_H, imageRendering: 'auto' }}
              />
            </div>

            {/* Mobile buttons */}
            <div className="flex md:hidden gap-2 flex-wrap justify-center">
              {gameStatus === 'over' && (
                <>
                  <button type="button" onClick={startGame}
                    className="px-3 py-1 text-xs font-display uppercase tracking-widest border-2 border-sky-600 bg-sky-600/20 text-sky-700 dark:text-sky-400">
                    <RotateCcw className="w-3 h-3 inline mr-1" />Пак
                  </button>
                  <button type="button" onClick={handleShare}
                    className="px-3 py-1 text-xs font-display uppercase tracking-widest border-2 border-[#1C1428]/20 dark:border-zinc-700 text-zn-text/60 dark:text-zinc-400">
                    <Share2 className="w-3 h-3 inline mr-1" />Сподели
                  </button>
                </>
              )}
              {gameStatus === 'idle' && (
                <button type="button" onClick={startGame}
                  className="px-3 py-1 text-xs font-display uppercase tracking-widest border-2 border-sky-600 bg-sky-600/20 text-sky-700 dark:text-sky-400">
                  <Play className="w-3 h-3 inline mr-1" />Старт
                </button>
              )}
            </div>

            <p className="text-[11px] text-zn-text/40 dark:text-zinc-500 text-center max-w-xs">
              SPACE / ↑ / W / клик — маха крилца. Не удряй тръбите и земята!
            </p>
          </div>

          {/* Right panel — desktop */}
          <div className="hidden md:flex flex-col gap-3 w-36">
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3">
              <span className="text-[10px] font-display uppercase tracking-[0.15em] text-zn-text/50 dark:text-zinc-400 block mb-2 text-center">Как се играе</span>
              <div className="text-[10px] text-zn-text/60 dark:text-zinc-400 space-y-1.5">
                <p>Натисни <strong>SPACE</strong>, <strong>↑</strong>, <strong>W</strong> или <strong>кликни</strong>.</p>
                <p>Птичката <strong>маха крилца</strong> и се издига.</p>
                <p>Прелети между <strong>тръбите</strong>.</p>
                <p>Всяка тръба = <strong>+1 точка</strong>.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
