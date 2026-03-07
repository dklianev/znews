import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eraser, HelpCircle, Loader2, Send, Share2 } from 'lucide-react';
import { api } from '../utils/api';
import { getTodayStr } from '../utils/gameDate';
import { loadGameProgress, recordGameWin, saveGameProgress } from '../utils/gameStorage';
import CrosswordBoard from '../components/games/crossword/CrosswordBoard';
import CrosswordCluePanel from '../components/games/crossword/CrosswordCluePanel';
import {
  createEmptyCrosswordFillGrid,
  getCrosswordCellKey,
  getCrosswordCellNumberMap,
  getCrosswordEntryCells,
  serializeCrosswordPlayerGrid,
} from '../../shared/crossword.js';

const GAME_SLUG = 'crossword';
const INPUT_PATTERN = /^[\p{L}\p{N}]$/u;
const FEEDBACK_TONE_CLASSNAMES = {
  info: 'border-slate-200 bg-white/90 text-slate-700 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-none',
  success: 'border-emerald-200 bg-emerald-50/90 text-emerald-950 shadow-lg dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100 dark:shadow-none',
  warning: 'border-amber-200 bg-amber-50/90 text-amber-950 shadow-lg dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-100 dark:shadow-none',
  error: 'border-rose-200 bg-rose-50/90 text-rose-950 shadow-lg dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-100 dark:shadow-none',
};

function findFirstFillableCell(layoutRows) {
  for (let row = 0; row < layoutRows.length; row += 1) {
    const chars = Array.from(String(layoutRows[row] || ''));
    for (let col = 0; col < chars.length; col += 1) {
      if (chars[col] !== '#') return { row, col };
    }
  }
  return { row: 0, col: 0 };
}

function normalizeGridForLayout(savedGrid, layoutRows) {
  const fallback = createEmptyCrosswordFillGrid(layoutRows);
  if (!Array.isArray(savedGrid) || savedGrid.length !== layoutRows.length) return fallback;

  return layoutRows.map((row, rowIndex) => Array.from(String(row || '')).map((cell, colIndex) => {
    if (cell === '#') return '#';
    const value = String(savedGrid?.[rowIndex]?.[colIndex] || '').trim().toUpperCase();
    const char = Array.from(value)[0] || '';
    return INPUT_PATTERN.test(char) ? char : '';
  }));
}

function normalizeInputChar(rawValue) {
  const trimmed = String(rawValue || '').trim().toUpperCase();
  const char = Array.from(trimmed)[0] || '';
  return INPUT_PATTERN.test(char) ? char : '';
}

function getEntryKey(entry) {
  return `${entry.direction}:${entry.row}:${entry.col}`;
}

function getAdjacentFillable(layoutRows, row, col, deltaRow, deltaCol) {
  const nextRow = row + deltaRow;
  const nextCol = col + deltaCol;
  if (!layoutRows[nextRow] || String(layoutRows[nextRow] || '')[nextCol] === '#') return null;
  if (String(layoutRows[nextRow] || '')[nextCol] === undefined) return null;
  return { row: nextRow, col: nextCol };
}

export default function GameCrosswordPage() {
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grid, setGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [selectedDirection, setSelectedDirection] = useState('across');
  const [wrongCellKeys, setWrongCellKeys] = useState(new Set());
  const [gameStatus, setGameStatus] = useState('playing');
  const [showHelp, setShowHelp] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const inputRefs = useRef(new Map());

  const displayError = error === 'No puzzle for today'
    ? 'Няма кръстословица за днес. Провери пак по-късно.'
    : error;

  useEffect(() => {
    api.games.getToday(GAME_SLUG)
      .then((data) => {
        setPuzzle(data);
        const layoutRows = Array.isArray(data?.payload?.layout) ? data.payload.layout : [];
        const todayStr = getTodayStr();
        const saved = loadGameProgress(GAME_SLUG, todayStr);
        if (saved && saved.puzzleId === data.id) {
          setGrid(normalizeGridForLayout(saved.grid, layoutRows));
          setSelectedCell(saved.selectedCell || findFirstFillableCell(layoutRows));
          setSelectedDirection(saved.selectedDirection === 'down' ? 'down' : 'across');
          setGameStatus(saved.gameStatus === 'won' ? 'won' : 'playing');
        } else {
          setGrid(createEmptyCrosswordFillGrid(layoutRows));
          setSelectedCell(findFirstFillableCell(layoutRows));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const layoutRows = Array.isArray(puzzle?.payload?.layout) ? puzzle.payload.layout : [];
  const cellNumbers = useMemo(() => getCrosswordCellNumberMap(layoutRows), [layoutRows]);

  const entries = useMemo(() => {
    const rawClues = puzzle?.payload?.clues || { across: [], down: [] };
    const mapDirection = (direction) => (Array.isArray(rawClues[direction]) ? rawClues[direction] : []).map((entry) => ({
      ...entry,
      direction,
      cells: getCrosswordEntryCells(layoutRows, entry.row, entry.col, direction),
    }));

    return {
      across: mapDirection('across'),
      down: mapDirection('down'),
    };
  }, [layoutRows, puzzle?.payload?.clues]);

  const entryMaps = useMemo(() => {
    const maps = { across: new Map(), down: new Map() };
    const lookup = new Map();

    ['across', 'down'].forEach((direction) => {
      entries[direction].forEach((entry) => {
        lookup.set(getEntryKey(entry), entry);
        entry.cells.forEach((cell) => {
          maps[direction].set(cell.key, entry);
        });
      });
    });

    return { maps, lookup };
  }, [entries]);

  const activeEntry = useMemo(() => {
    const key = getCrosswordCellKey(selectedCell.row, selectedCell.col);
    return entryMaps.maps[selectedDirection].get(key)
      || entryMaps.maps[selectedDirection === 'across' ? 'down' : 'across'].get(key)
      || entries.across[0]
      || entries.down[0]
      || null;
  }, [entries, entryMaps, selectedCell, selectedDirection]);

  const activeEntryKey = activeEntry ? getEntryKey(activeEntry) : '';
  const activeCellKeys = useMemo(() => new Set((activeEntry?.cells || []).map((cell) => cell.key)), [activeEntry]);
  const totalCells = useMemo(() => layoutRows.reduce((count, row) => count + Array.from(String(row || '')).filter((cell) => cell !== '#').length, 0), [layoutRows]);
  const filledCells = useMemo(() => grid.flat().filter((cell) => cell && cell !== '#').length, [grid]);

  useEffect(() => {
    if (!puzzle) return;
    if (filledCells === 0 && gameStatus === 'playing') return;
    saveGameProgress(GAME_SLUG, getTodayStr(), {
      puzzleId: puzzle.id,
      grid,
      selectedCell,
      selectedDirection,
      gameStatus,
    });
  }, [filledCells, gameStatus, grid, puzzle, selectedCell, selectedDirection]);

  const focusCell = (row, col) => {
    const node = inputRefs.current.get(getCrosswordCellKey(row, col));
    if (node) node.focus();
  };

  const selectCell = (row, col, allowToggle) => {
    const key = getCrosswordCellKey(row, col);
    const hasAcross = entryMaps.maps.across.has(key);
    const hasDown = entryMaps.maps.down.has(key);

    setSelectedDirection((current) => {
      if (allowToggle && selectedCell.row === row && selectedCell.col === col && hasAcross && hasDown) {
        return current === 'across' ? 'down' : 'across';
      }
      if (current === 'across' && !hasAcross && hasDown) return 'down';
      if (current === 'down' && !hasDown && hasAcross) return 'across';
      return current;
    });
    setSelectedCell({ row, col });
  };

  const updateCell = (row, col, value) => {
    setGrid((current) => current.map((gridRow, rowIndex) => {
      if (rowIndex !== row) return gridRow;
      return gridRow.map((cell, colIndex) => (colIndex === col ? value : cell));
    }));
    setWrongCellKeys((current) => {
      const next = new Set(current);
      next.delete(getCrosswordCellKey(row, col));
      return next;
    });
  };

  const moveInsideActiveEntry = (step) => {
    if (!activeEntry) return null;
    const cellIndex = activeEntry.cells.findIndex((cell) => cell.row === selectedCell.row && cell.col === selectedCell.col);
    const nextCell = activeEntry.cells[cellIndex + step];
    return nextCell ? { row: nextCell.row, col: nextCell.col } : null;
  };

  const handleInput = (row, col, rawValue) => {
    const value = normalizeInputChar(rawValue);
    updateCell(row, col, value);
    setFeedback(null);
    setSelectedCell({ row, col });

    if (value) {
      const currentEntry = entryMaps.maps[selectedDirection].get(getCrosswordCellKey(row, col))
        || entryMaps.maps[selectedDirection === 'across' ? 'down' : 'across'].get(getCrosswordCellKey(row, col));
      if (currentEntry) {
        const cellIndex = currentEntry.cells.findIndex((cell) => cell.row === row && cell.col === col);
        const nextCell = currentEntry.cells[cellIndex + 1];
        if (nextCell) {
          setSelectedCell({ row: nextCell.row, col: nextCell.col });
          window.requestAnimationFrame(() => focusCell(nextCell.row, nextCell.col));
        }
      }
    }
  };

  const handleKeyDown = (event, row, col) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (grid?.[row]?.[col]) {
        updateCell(row, col, '');
        return;
      }
      const previousCell = moveInsideActiveEntry(-1);
      if (previousCell) {
        updateCell(previousCell.row, previousCell.col, '');
        setSelectedCell(previousCell);
        window.requestAnimationFrame(() => focusCell(previousCell.row, previousCell.col));
      }
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      selectCell(row, col, true);
      return;
    }

    const arrowMoves = {
      ArrowLeft: { row: 0, col: -1, direction: 'across' },
      ArrowRight: { row: 0, col: 1, direction: 'across' },
      ArrowUp: { row: -1, col: 0, direction: 'down' },
      ArrowDown: { row: 1, col: 0, direction: 'down' },
    };

    const move = arrowMoves[event.key];
    if (move) {
      event.preventDefault();
      const nextCell = getAdjacentFillable(layoutRows, row, col, move.row, move.col);
      setSelectedDirection(move.direction);
      if (nextCell) {
        setSelectedCell(nextCell);
        window.requestAnimationFrame(() => focusCell(nextCell.row, nextCell.col));
      }
    }
  };

  const handleCheck = async () => {
    if (!puzzle || isChecking) return;
    setIsChecking(true);
    setFeedback(null);
    try {
      const response = await api.games.validate(GAME_SLUG, getTodayStr(), {
        grid: serializeCrosswordPlayerGrid(grid, layoutRows),
      });
      const wrongKeys = new Set((Array.isArray(response.wrongCells) ? response.wrongCells : []).map((cell) => getCrosswordCellKey(cell.row, cell.col)));
      setWrongCellKeys(wrongKeys);

      if (response.isSolved) {
        setGameStatus('won');
        setFeedback({ type: 'success', message: 'Кръстословицата е решена.' });
        recordGameWin(GAME_SLUG, getTodayStr());
      } else if ((response.wrongCells || []).length > 0) {
        setFeedback({
          type: 'warning',
          message: `Има ${(response.wrongCells || []).length} грешни клетки и ${(response.emptyCells || []).length} празни.`,
        });
      } else {
        setFeedback({
          type: 'info',
          message: `Няма грешки, но остават ${(response.emptyCells || []).length} празни клетки.`,
        });
      }
    } catch (e) {
      setFeedback({
        type: 'error',
        message: 'Грешка при проверка: ' + e.message,
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleClearActiveEntry = () => {
    if (!activeEntry) return;
    setGrid((current) => current.map((row, rowIndex) => row.map((cell, colIndex) => (
      activeEntry.cells.some((entryCell) => entryCell.row === rowIndex && entryCell.col === colIndex) ? '' : cell
    ))));
    setFeedback(null);
  };

  const handleShare = async () => {
    const text = `zNews кръстословица - ${getTodayStr()}\n${layoutRows.length}x${String(layoutRows[0] || '').length}\nРешено.`;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setFeedback({
        type: 'error',
        message: 'Копирането не се поддържа в този браузър.',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setFeedback({
        type: 'success',
        message: 'Резултатът е копиран.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Не успях да копирам резултата.',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 flex justify-center items-center">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 text-center py-20 px-4">
        <div className="max-w-xl mx-auto rounded-[28px] border border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900 p-10 shadow-xl">
          <h1 className="text-3xl text-slate-900 dark:text-white mb-4 font-black uppercase font-condensed">Няма активна игра</h1>
          <p className="text-slate-500 dark:text-zinc-400 mb-8">{displayError || 'Възникна неочаквана грешка.'}</p>
          <Link to="/games" className="text-indigo-600 hover:text-indigo-500 font-bold">Към всички игри</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zn-paper dark:bg-zinc-950 text-slate-900 dark:text-white pb-20">
      <header className="w-full border-b border-stone-200 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur mb-8">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between p-4">
          <Link to="/games" className="text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-black uppercase tracking-widest font-condensed">Кръстословица</h1>
          <button onClick={() => setShowHelp(true)} className="text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <HelpCircle className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 space-y-8">
        <section className="rounded-[36px] border border-indigo-100/80 bg-[radial-gradient(circle_at_top_right,_rgba(125,211,252,0.24),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.18),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(238,242,255,0.96))] p-6 shadow-[0_40px_90px_rgba(79,70,229,0.14)] dark:border-indigo-950/50 dark:bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.18),_transparent_38%),linear-gradient(135deg,_rgba(24,24,27,0.98),_rgba(9,9,11,0.98))] dark:shadow-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-indigo-700 dark:text-sky-300">Дневен grid</p>
              <h2 className="mt-3 text-4xl font-black uppercase font-condensed">{puzzle.payload?.title || 'Мини кръстословица за днес'}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
                {puzzle.payload?.deck || 'Работи по уликите, превключвай посоката с повторен клик върху клетка и проверявай, когато си готов.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-indigo-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-indigo-700 dark:border-indigo-900 dark:bg-zinc-900 dark:text-sky-300">{getTodayStr()}</span>
              <span className="rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">{filledCells}/{totalCells} клетки</span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] gap-6 items-start">
          <div className="space-y-5">
            <CrosswordBoard
              layoutRows={layoutRows}
              grid={grid}
              cellNumbers={cellNumbers}
              selectedCell={selectedCell}
              activeCellKeys={activeCellKeys}
              wrongCellKeys={wrongCellKeys}
              onSelect={selectCell}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              getInputRef={(row, col, node) => {
                const key = getCrosswordCellKey(row, col);
                if (node) inputRefs.current.set(key, node);
                else inputRefs.current.delete(key);
              }}
            />

            <div className="flex flex-wrap gap-3">
              <button onClick={handleCheck} disabled={gameStatus === 'won' || isChecking} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black uppercase tracking-[0.25em] text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400">
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Провери
              </button>
              <button onClick={handleClearActiveEntry} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.25em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-stone-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
                <Eraser className="w-4 h-4" /> Изчисти дума
              </button>
              {gameStatus === 'won' && (
                <button onClick={handleShare} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-black uppercase tracking-[0.25em] text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/60">
                  <Share2 className="w-4 h-4" /> Сподели
                </button>
              )}
            </div>

            {feedback?.message && (
              <div
                aria-live="polite"
                className={`rounded-[28px] border px-5 py-4 text-sm ${FEEDBACK_TONE_CLASSNAMES[feedback.type] || FEEDBACK_TONE_CLASSNAMES.info}`}
              >
                {feedback.message}
              </div>
            )}

            {gameStatus === 'won' && (
              <div className="rounded-[32px] border border-emerald-200 bg-emerald-50/90 px-5 py-5 text-emerald-950 dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  <div>
                    <h3 className="text-2xl font-black uppercase font-condensed">Кръстословицата е готова</h3>
                    <p className="mt-2 text-sm leading-6">Попълни правилно всички клетки. Резултатът вече е отчетен за днешната серия.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <CrosswordCluePanel title="Хоризонтални" entries={entries.across} activeEntryKey={activeEntryKey} onSelect={(entry) => {
              setSelectedDirection('across');
              setSelectedCell({ row: entry.row, col: entry.col });
              window.requestAnimationFrame(() => focusCell(entry.row, entry.col));
            }} />
            <CrosswordCluePanel title="Вертикални" tone="rose" entries={entries.down} activeEntryKey={activeEntryKey} onSelect={(entry) => {
              setSelectedDirection('down');
              setSelectedCell({ row: entry.row, col: entry.col });
              window.requestAnimationFrame(() => focusCell(entry.row, entry.col));
            }} />
          </div>
        </section>
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-black/80 px-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 p-6 rounded-2xl max-w-md w-full shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-2xl font-black mb-4 text-slate-900 dark:text-white uppercase font-condensed">Как се играе</h2>
            <ul className="list-disc pl-5 text-sm text-slate-500 dark:text-zinc-400 space-y-2 mb-6">
              <li>Кликни върху клетка, за да я активираш. Повтори клик, за да смениш посоката.</li>
              <li>Използвай клавиатурата, за да въвеждаш букви, и стрелките за навигация.</li>
              <li>Бутонът „Провери“ маркира грешните и празните клетки, без да разкрива решението.</li>
            </ul>
            <button onClick={() => setShowHelp(false)} className="mt-4 w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors rounded-xl uppercase tracking-wider">Затвори</button>
          </div>
        </div>
      )}
    </div>
  );
}
