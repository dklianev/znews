import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eraser, HelpCircle, Loader2, Send, Share2 } from 'lucide-react';
import { api } from '../utils/api';
import { getTodayStr } from '../utils/gameDate';
import { formatPuzzleDateLabel, getPuzzleDurationDays, getPuzzleWindowLabel } from '../utils/puzzleDateUtils';
import { loadGameProgress, loadScopedGameProgress, recordGameWin, saveScopedGameProgress } from '../utils/gameStorage';
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
  info: 'border-stone-300 bg-white text-stone-700 shadow-[0_14px_30px_rgba(28,25,23,0.06)] dark:border-zinc-800 dark:bg-[#151619] dark:text-zinc-200 dark:shadow-none',
  success: 'border-emerald-300 bg-emerald-50/95 text-emerald-950 shadow-[0_14px_30px_rgba(16,185,129,0.08)] dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100 dark:shadow-none',
  warning: 'border-amber-300 bg-amber-50/95 text-amber-950 shadow-[0_14px_30px_rgba(245,158,11,0.08)] dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-100 dark:shadow-none',
  error: 'border-rose-300 bg-rose-50/95 text-rose-950 shadow-[0_14px_30px_rgba(244,63,94,0.08)] dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-100 dark:shadow-none',
};
const DIRECTION_META = {
  across: {
    title: 'По хоризонтала',
    shortTitle: 'Хоризонтални',
    compactTitle: 'Хор.',
    tone: 'sky',
  },
  down: {
    title: 'По вертикала',
    shortTitle: 'Вертикални',
    compactTitle: 'Верт.',
    tone: 'amber',
  },
};
const PRIMARY_ACTION_CLASS = 'inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-stone-300 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400';
const SECONDARY_ACTION_CLASS = 'inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-50 dark:border-zinc-800 dark:bg-[#151619] dark:text-zinc-100 dark:hover:bg-zinc-900';

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


function getCrosswordProgressKey(puzzle) {
  return puzzle?.id ? 'puzzle-' + puzzle.id : getTodayStr();
}

function loadCrosswordProgress(puzzle) {
  const scopedKey = getCrosswordProgressKey(puzzle);
  const scopedProgress = loadScopedGameProgress(GAME_SLUG, scopedKey);
  if (scopedProgress && scopedProgress.puzzleId === puzzle?.id) {
    return scopedProgress;
  }

  const legacyProgress = loadGameProgress(GAME_SLUG, puzzle?.puzzleDate || '');
  if (!legacyProgress) return null;
  if (legacyProgress.puzzleId && legacyProgress.puzzleId !== puzzle?.id) return null;

  const migratedProgress = {
    ...legacyProgress,
    puzzleId: puzzle?.id || legacyProgress.puzzleId,
  };
  saveScopedGameProgress(GAME_SLUG, scopedKey, migratedProgress);
  return migratedProgress;
}

export default function GameCrosswordPage() {
  const [puzzle, setPuzzle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grid, setGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [selectedDirection, setSelectedDirection] = useState('across');
  const [mobileClueDirection, setMobileClueDirection] = useState('across');
  const [wrongCellKeys, setWrongCellKeys] = useState(new Set());
  const [gameStatus, setGameStatus] = useState('playing');
  const [showHelp, setShowHelp] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const inputRefs = useRef(new Map());

  const displayError = error === 'No puzzle for today'
    ? 'Няма кръстословица за днес. Върни се по-късно.'
    : error;

  useEffect(() => {
    api.games.getToday(GAME_SLUG)
      .then((data) => {
        setPuzzle(data);
        const layoutRows = Array.isArray(data?.payload?.layout) ? data.payload.layout : [];
        const saved = loadCrosswordProgress(data);
        if (saved && saved.puzzleId === data.id) {
          setGrid(normalizeGridForLayout(saved.grid, layoutRows));
          setSelectedCell(saved.selectedCell || findFirstFillableCell(layoutRows));
          setSelectedDirection(saved.selectedDirection === 'down' ? 'down' : 'across');
          setMobileClueDirection(saved.selectedDirection === 'down' ? 'down' : 'across');
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
  const gridWidth = useMemo(() => (layoutRows[0] ? Array.from(String(layoutRows[0] || '')).length : 0), [layoutRows]);
  const gridHeight = layoutRows.length;
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

    ['across', 'down'].forEach((direction) => {
      entries[direction].forEach((entry) => {
        entry.cells.forEach((cell) => {
          maps[direction].set(cell.key, entry);
        });
      });
    });

    return { maps };
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
  const completionPercent = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  const selectedCellKey = getCrosswordCellKey(selectedCell.row, selectedCell.col);
  const cellHasAcross = entryMaps.maps.across.has(selectedCellKey);
  const cellHasDown = entryMaps.maps.down.has(selectedCellKey);
  const canToggleDirection = cellHasAcross && cellHasDown;
  const currentDirection = activeEntry?.direction || selectedDirection;
  const currentDirectionMeta = DIRECTION_META[currentDirection] || DIRECTION_META.across;
  const mobileEntries = mobileClueDirection === 'down' ? entries.down : entries.across;
  const mobileDirectionMeta = DIRECTION_META[mobileClueDirection] || DIRECTION_META.across;
  const crosswordTitle = puzzle?.payload?.title || 'Кръстословица на деня';
  const crosswordDeck = puzzle?.payload?.deck || 'Попълни всички думи по хоризонтала и вертикала. Кликни повторно върху клетка, за да смениш посоката.';
  const activeUntilDate = puzzle?.activeUntilDate || puzzle?.puzzleDate || getTodayStr();
  const puzzleWindowDays = getPuzzleDurationDays(puzzle?.puzzleDate, activeUntilDate);
  const availabilityLabel = getPuzzleWindowLabel(puzzle?.puzzleDate || getTodayStr(), activeUntilDate);
  const availabilityHint = puzzleWindowDays > 1 ? 'Активна ' + puzzleWindowDays + ' дни' : 'Еднодневна кръстословица';
  const activeClueTitle = activeEntry ? `${currentDirectionMeta.title} ${activeEntry.number}` : 'Избери улика';
  const activeClueText = activeEntry?.clue || 'Кликни върху клетка в мрежата или върху улика от списъка, за да започнеш.';
  const activeClueMeta = activeEntry
    ? `${activeEntry.length} букви  /  старт ${activeEntry.row + 1}:${activeEntry.col + 1}`
    : `${gridWidth}x${gridHeight}  /  ${entries.across.length + entries.down.length} улики`;

  useEffect(() => {
    if (!puzzle) return;
    if (filledCells === 0 && gameStatus === 'playing') return;
    saveScopedGameProgress(GAME_SLUG, getCrosswordProgressKey(puzzle), {
      puzzleId: puzzle.id,
      grid,
      selectedCell,
      selectedDirection,
      gameStatus,
    });
  }, [filledCells, gameStatus, grid, puzzle, selectedCell, selectedDirection]);

  useEffect(() => {
    setMobileClueDirection(selectedDirection);
  }, [selectedDirection]);

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

  const handleSelectEntry = (direction, entry) => {
    setSelectedDirection(direction);
    setMobileClueDirection(direction);
    setSelectedCell({ row: entry.row, col: entry.col });
    window.requestAnimationFrame(() => focusCell(entry.row, entry.col));
  };

  const handleSetDirection = (direction) => {
    const inCurrentCell = entryMaps.maps[direction].get(selectedCellKey);
    if (inCurrentCell) {
      setSelectedDirection(direction);
      setMobileClueDirection(direction);
      window.requestAnimationFrame(() => focusCell(selectedCell.row, selectedCell.col));
      return;
    }

    const fallbackEntry = entries[direction][0];
    if (fallbackEntry) {
      handleSelectEntry(direction, fallbackEntry);
    }
  };

  const handleToggleDirection = () => {
    if (!canToggleDirection) return;
    const nextDirection = currentDirection === 'across' ? 'down' : 'across';
    setSelectedDirection(nextDirection);
    setMobileClueDirection(nextDirection);
    window.requestAnimationFrame(() => focusCell(selectedCell.row, selectedCell.col));
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

    if (event.key === 'Enter') {
      event.preventDefault();
      const key = getCrosswordCellKey(row, col);
      if (entryMaps.maps.across.has(key) && entryMaps.maps.down.has(key)) {
        handleToggleDirection();
      }
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
    const text = `zNews Кръстословица - ${getTodayStr()}\n${gridHeight}x${gridWidth}\nРешено.`;
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
      <div className="flex min-h-screen items-center justify-center bg-stone-100 dark:bg-[#101113]">
        <Loader2 className="h-12 w-12 animate-spin text-slate-950 dark:text-white" />
      </div>
    );
  }

  if (error || !puzzle) {
    return (
      <div className="min-h-screen bg-stone-100 px-4 py-20 text-center dark:bg-[#101113]">
        <div className="mx-auto max-w-xl rounded-[28px] border border-stone-300 bg-white/95 p-10 shadow-xl dark:border-zinc-800 dark:bg-[#151619]">
          <h1 className="mb-4 text-3xl font-black uppercase text-slate-900 dark:text-white">Няма активен пъзел</h1>
          <p className="mb-8 text-stone-500 dark:text-zinc-400">{displayError || 'Пъзелът временно не е наличен.'}</p>
          <Link to="/games" className="font-bold text-slate-900 hover:text-stone-700 dark:text-white dark:hover:text-zinc-300">Към игрите</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 pb-20 text-stone-950 dark:bg-[#101113] dark:text-stone-100">
      <header className="mb-8 border-b border-stone-300 bg-white/80 backdrop-blur dark:border-zinc-900 dark:bg-[#101113]/90">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between p-4">
          <Link to="/games" className="text-stone-500 transition-colors hover:text-stone-950 dark:text-zinc-500 dark:hover:text-white">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-sm font-black uppercase tracking-[0.42em] text-stone-700 dark:text-zinc-200">Кръстословица</h1>
          <button onClick={() => setShowHelp(true)} className="text-stone-500 transition-colors hover:text-stone-950 dark:text-zinc-500 dark:hover:text-white">
            <HelpCircle className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4">
        <section className="overflow-hidden rounded-[32px] border border-stone-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,240,232,0.96))] shadow-[0_24px_55px_rgba(28,25,23,0.08)] dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.98),rgba(12,12,13,0.98))] dark:shadow-none">
          <div className="border-b border-stone-200 px-6 py-5 dark:border-zinc-800">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-stone-500 dark:text-zinc-500">zNews редакция</p>
            <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-stone-500 dark:text-zinc-400">{availabilityLabel}</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">{availabilityHint}</p>
                </div>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-slate-950 [font-family:Georgia,'Times_New_Roman',serif] dark:text-white sm:text-5xl">
                  {crosswordTitle}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 dark:text-zinc-300">
                  {crosswordDeck}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-stone-400 dark:text-zinc-500">
                  {puzzleWindowDays > 1 ? 'Прогресът се пази до ' + formatPuzzleDateLabel(activeUntilDate) + '.' : 'Прогресът се пази за днешния пъзел.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
                <div className="rounded-[22px] border border-stone-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-[#151619]">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">Период</p>
                  <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{puzzleWindowDays} {puzzleWindowDays === 1 ? 'ден' : 'дни'}</p>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-[#151619]">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">Размер</p>
                  <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{gridWidth} × {gridHeight}</p>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-[#151619]">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">Прогрес</p>
                  <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{completionPercent}%</p>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-[#151619]">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">Клетки</p>
                  <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{filledCells}/{totalCells}</p>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-white/90 px-4 py-3 dark:border-zinc-800 dark:bg-[#151619]">
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-stone-400 dark:text-zinc-500">Улики</p>
                  <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{entries.across.length + entries.down.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="rounded-[28px] border border-sky-200 bg-sky-50/70 px-5 py-4 dark:border-sky-950/60 dark:bg-sky-950/20">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-700 dark:text-sky-300">Активна улика</p>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 [font-family:Georgia,'Times_New_Roman',serif] dark:text-white">
                    {activeClueTitle}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700 dark:text-zinc-200">{activeClueText}</p>
                </div>
                <div className="rounded-full border border-white/80 bg-white/85 px-4 py-2 text-[11px] font-black uppercase tracking-[0.26em] text-stone-600 dark:border-zinc-800 dark:bg-[#111214] dark:text-zinc-300">
                  {activeClueMeta}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['across', 'down']).map((direction) => {
                const meta = DIRECTION_META[direction];
                const isCurrent = currentDirection === direction;
                return (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => handleSetDirection(direction)}
                    className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.26em] transition-colors ${isCurrent
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-black'
                      : 'border border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900 dark:border-zinc-800 dark:bg-[#151619] dark:text-zinc-300 dark:hover:text-white'}`}
                  >
                    {meta.compactTitle}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleToggleDirection}
                disabled={!canToggleDirection}
                className={`${SECONDARY_ACTION_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Смени посока
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <div className="space-y-4">
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
              <button onClick={handleCheck} disabled={gameStatus === 'won' || isChecking} className={PRIMARY_ACTION_CLASS}>
                {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Провери
              </button>
              <button onClick={handleClearActiveEntry} className={SECONDARY_ACTION_CLASS}>
                <Eraser className="h-4 w-4" /> Изчисти дума
              </button>
              {gameStatus === 'won' && (
                <button onClick={handleShare} className={SECONDARY_ACTION_CLASS}>
                  <Share2 className="h-4 w-4" /> Сподели
                </button>
              )}
            </div>

            <div className="rounded-[26px] border border-stone-300 bg-white px-5 py-4 text-sm text-stone-600 shadow-[0_14px_35px_rgba(28,25,23,0.05)] dark:border-zinc-800 dark:bg-[#151619] dark:text-zinc-300 dark:shadow-none">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-stone-500 dark:text-zinc-500">Навигация</p>
              <p className="mt-2 leading-6">
                Повторен клик, <span className="font-black">Space</span> или <span className="font-black">Enter</span> сменя посоката. Дъската се оразмерява автоматично според зададените ширина и височина в администрацията.
              </p>
            </div>

            {feedback?.message && (
              <div
                aria-live="polite"
                className={`rounded-[26px] border px-5 py-4 text-sm ${FEEDBACK_TONE_CLASSNAMES[feedback.type] || FEEDBACK_TONE_CLASSNAMES.info}`}
              >
                {feedback.message}
              </div>
            )}

            {gameStatus === 'won' && (
              <div className="rounded-[28px] border border-emerald-300 bg-emerald-50/95 px-5 py-5 text-emerald-950 shadow-[0_16px_35px_rgba(16,185,129,0.08)] dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100 dark:shadow-none">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.04em] [font-family:Georgia,'Times_New_Roman',serif]">Решено без излишен шум</h3>
                    <p className="mt-2 text-sm leading-6">Кръстословицата е завършена. Можеш да споделиш резултата или да минеш към следващата дневна игра.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section className="rounded-[32px] border border-stone-300 bg-white p-4 shadow-[0_20px_45px_rgba(28,25,23,0.08)] dark:border-zinc-800 dark:bg-[#141518] dark:shadow-none">
              <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.32em] text-stone-500 dark:text-zinc-500">Подсказки</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 [font-family:Georgia,'Times_New_Roman',serif] dark:text-white">
                    Подсказки и навигация
                  </h3>
                  <p className="mt-1 text-sm text-stone-600 dark:text-zinc-300">Кликни върху улика, за да скочиш директно към думата в мрежата.</p>
                </div>
                <div className="rounded-full border border-stone-200 bg-stone-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.25em] text-stone-500 dark:border-zinc-800 dark:bg-[#111214] dark:text-zinc-400">
                  {entries.across.length + entries.down.length} общо
                </div>
              </div>

              <div className="mt-4 xl:hidden">
                <div className="mb-4 inline-flex rounded-full border border-stone-300 bg-stone-100 p-1 dark:border-zinc-800 dark:bg-[#111214]">
                  {(['across', 'down']).map((direction) => {
                    const meta = DIRECTION_META[direction];
                    const isCurrent = mobileClueDirection === direction;
                    return (
                      <button
                        key={direction}
                        type="button"
                        onClick={() => setMobileClueDirection(direction)}
                        className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] transition-colors ${isCurrent
                          ? 'bg-white text-slate-950 shadow-sm dark:bg-white dark:text-black'
                          : 'text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'}`}
                      >
                        {meta.compactTitle}
                      </button>
                    );
                  })}
                </div>

                <CrosswordCluePanel
                  title={mobileDirectionMeta.shortTitle}
                  tone={mobileDirectionMeta.tone}
                  entries={mobileEntries}
                  activeEntryKey={activeEntryKey}
                  onSelect={(entry) => handleSelectEntry(mobileClueDirection, entry)}
                  scrollClass="max-h-[26rem]"
                />
              </div>

              <div className="hidden xl:grid xl:grid-cols-2 xl:gap-4">
                <CrosswordCluePanel
                  title={DIRECTION_META.across.shortTitle}
                  tone={DIRECTION_META.across.tone}
                  entries={entries.across}
                  activeEntryKey={activeEntryKey}
                  onSelect={(entry) => handleSelectEntry('across', entry)}
                  scrollClass="max-h-[34rem]"
                />
                <CrosswordCluePanel
                  title={DIRECTION_META.down.shortTitle}
                  tone={DIRECTION_META.down.tone}
                  entries={entries.down}
                  activeEntryKey={activeEntryKey}
                  onSelect={(entry) => handleSelectEntry('down', entry)}
                  scrollClass="max-h-[34rem]"
                />
              </div>
            </section>
          </aside>
        </section>
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-100/70 px-4 backdrop-blur-sm dark:bg-black/80" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md rounded-[28px] border border-stone-300 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#151619]" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 [font-family:Georgia,'Times_New_Roman',serif] dark:text-white">Как се играе</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-600 dark:text-zinc-300">
              <li>Кликни клетка или улика, за да избереш активната дума.</li>
              <li>Повторен клик, <span className="font-black">Space</span> или <span className="font-black">Enter</span> сменя посоката, когато клетката е част и от хоризонтална, и от вертикална дума.</li>
              <li>С бутон <span className="font-black">Провери</span> маркираш грешните клетки, а <span className="font-black">Изчисти дума</span> чисти само активния отговор.</li>
            </ul>
            <button onClick={() => setShowHelp(false)} className="mt-6 w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
              Затвори
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
