import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, HelpCircle, Share2, Timer } from 'lucide-react';
import {
  loadGameProgress,
  recordGameWin,
  saveGameProgress,
} from '../utils/gameStorage';
import { getTodayStr } from '../utils/gameDate';
import {
  SUDOKU_DIFFICULTY_CONFIG,
  cloneGrid,
  cloneNotesGrid,
  createEmptyNotesGrid,
  formatElapsedTime,
  generateSudokuPuzzle,
  getConflictingCells,
  isCellEditable,
  isGridComplete,
  isGridSolved,
} from '../utils/sudoku';
import SudokuBoard from '../components/games/sudoku/SudokuBoard';
import SudokuKeypad from '../components/games/sudoku/SudokuKeypad';

const GAME_SLUG = 'sudoku';
const STORAGE_KEY = 'zn_sudoku_state_v1';
const DIFFICULTIES = Object.keys(SUDOKU_DIFFICULTY_CONFIG);
const HINT_LIMIT_BY_DIFFICULTY = Object.freeze({
  easy: 4,
  medium: 3,
  hard: 2,
  expert: 1,
});
const HERO_KICKER = '\u0411\u0435\u0437\u043a\u0440\u0430\u0435\u043d \u0440\u0435\u0436\u0438\u043c';
const HERO_TITLE = '\u0421\u0443\u0434\u043e\u043a\u0443 \u0431\u0435\u0437 \u043a\u0440\u0430\u0439, \u0442\u0440\u0443\u0434\u043d\u043e\u0441\u0442 \u043f\u043e \u0438\u0437\u0431\u043e\u0440.';
const HERO_SUBTITLE = '\u0418\u0433\u0440\u0430\u0439 \u043f\u043e \u0432\u0441\u044f\u043a\u043e \u0432\u0440\u0435\u043c\u0435, \u0441\u043c\u0435\u043d\u044f\u0439 \u0442\u0440\u0443\u0434\u043d\u043e\u0441\u0442\u0442\u0430 \u043e\u0442 \u041b\u0435\u0441\u043d\u043e \u0434\u043e \u0415\u043a\u0441\u043f\u0435\u0440\u0442.';


function getDefaultSelection(grid) {
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      if (Number(grid?.[row]?.[column]) === 0) return { row, column };
    }
  }
  return { row: 0, column: 0 };
}

function normalizeSavedNotes(notes) {
  if (!Array.isArray(notes) || notes.length !== 9) return createEmptyNotesGrid();
  return notes.map((row) => {
    if (!Array.isArray(row) || row.length !== 9) return Array.from({ length: 9 }, () => []);
    return row.map((cell) => (
      Array.isArray(cell)
        ? [...new Set(cell.map((value) => Number.parseInt(value, 10)).filter((value) => value >= 1 && value <= 9))].sort((a, b) => a - b)
        : []
    ));
  });
}

function sanitizeGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 9) return null;
  const normalized = grid.map((row) => {
    if (!Array.isArray(row) || row.length !== 9) return null;
    return row.map((value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9) return 0;
      return parsed;
    });
  });
  if (normalized.some((row) => !Array.isArray(row))) return null;
  return normalized;
}

function loadStoredSudokuState() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const difficulty = DIFFICULTIES.includes(parsed?.difficulty) ? parsed.difficulty : null;
    const initialGrid = sanitizeGrid(parsed?.initialGrid);
    const solutionGrid = sanitizeGrid(parsed?.solutionGrid);
    const grid = sanitizeGrid(parsed?.grid);
    if (!difficulty || !initialGrid || !solutionGrid || !grid) return null;
    const hintLimit = HINT_LIMIT_BY_DIFFICULTY[difficulty] ?? HINT_LIMIT_BY_DIFFICULTY.medium;

    const selectedRow = Number.parseInt(parsed?.selectedCell?.row, 10);
    const selectedColumn = Number.parseInt(parsed?.selectedCell?.column, 10);

    return {
      difficulty,
      initialGrid,
      solutionGrid,
      grid,
      notes: normalizeSavedNotes(parsed?.notes),
      selectedCell: {
        row: Number.isInteger(selectedRow) ? Math.max(0, Math.min(8, selectedRow)) : 0,
        column: Number.isInteger(selectedColumn) ? Math.max(0, Math.min(8, selectedColumn)) : 0,
      },
      notesMode: Boolean(parsed?.notesMode),
      status: parsed?.status === 'won' ? 'won' : 'playing',
      elapsedSeconds: Math.max(0, Number.parseInt(parsed?.elapsedSeconds, 10) || 0),
      hintsUsed: Math.max(0, Math.min(hintLimit, Number.parseInt(parsed?.hintsUsed, 10) || 0)),
    };
  } catch {
    return null;
  }
}

function persistSudokuState(snapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore localStorage quota/private mode issues.
  }
}

function toggleNote(notesGrid, row, column, digit) {
  const next = cloneNotesGrid(notesGrid);
  const current = Array.isArray(next[row][column]) ? [...next[row][column]] : [];
  const exists = current.includes(digit);
  next[row][column] = exists
    ? current.filter((value) => value !== digit)
    : [...current, digit].sort((a, b) => a - b);
  return next;
}

function clearCellNotes(notesGrid, row, column) {
  const next = cloneNotesGrid(notesGrid);
  next[row][column] = [];
  return next;
}

function clearDigitFromPeers(notesGrid, row, column, digit) {
  const next = cloneNotesGrid(notesGrid);

  for (let index = 0; index < 9; index += 1) {
    if (index !== column) {
      next[row][index] = (next[row][index] || []).filter((value) => value !== digit);
    }
    if (index !== row) {
      next[index][column] = (next[index][column] || []).filter((value) => value !== digit);
    }
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 3; columnOffset += 1) {
      const targetRow = boxRow + rowOffset;
      const targetColumn = boxColumn + columnOffset;
      if (targetRow === row && targetColumn === column) continue;
      next[targetRow][targetColumn] = (next[targetRow][targetColumn] || []).filter((value) => value !== digit);
    }
  }

  return next;
}

function moveCellSelection(current, deltaRow, deltaColumn) {
  const nextRow = Math.max(0, Math.min(8, (current?.row ?? 0) + deltaRow));
  const nextColumn = Math.max(0, Math.min(8, (current?.column ?? 0) + deltaColumn));
  return { row: nextRow, column: nextColumn };
}

export default function GameSudokuPage() {
  const [difficulty, setDifficulty] = useState('medium');
  const [initialGrid, setInitialGrid] = useState(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0)));
  const [solutionGrid, setSolutionGrid] = useState(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0)));
  const [grid, setGrid] = useState(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0)));
  const [notes, setNotes] = useState(createEmptyNotesGrid());
  const [selectedCell, setSelectedCell] = useState({ row: 0, column: 0 });
  const [notesMode, setNotesMode] = useState(false);
  const [status, setStatus] = useState('loading');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [loadingPuzzle, setLoadingPuzzle] = useState(true);
  const [message, setMessage] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const winRecordedRef = useRef(false);
  const hintLimit = HINT_LIMIT_BY_DIFFICULTY[difficulty] ?? HINT_LIMIT_BY_DIFFICULTY.medium;
  const hintsRemaining = Math.max(0, hintLimit - hintsUsed);

  const conflicts = useMemo(() => getConflictingCells(grid), [grid]);

  const startNewGame = useCallback((targetDifficulty = 'medium') => {
    const normalizedDifficulty = DIFFICULTIES.includes(String(targetDifficulty).toLowerCase())
      ? String(targetDifficulty).toLowerCase()
      : 'medium';

    setLoadingPuzzle(true);
    setStatus('loading');
    setMessage('Генериране на пъзел...');

    window.setTimeout(() => {
      const generated = generateSudokuPuzzle(normalizedDifficulty);
      const puzzleGrid = cloneGrid(generated.puzzleGrid);

      setDifficulty(normalizedDifficulty);
      setInitialGrid(puzzleGrid);
      setSolutionGrid(cloneGrid(generated.solutionGrid));
      setGrid(cloneGrid(puzzleGrid));
      setNotes(createEmptyNotesGrid());
      setSelectedCell(getDefaultSelection(puzzleGrid));
      setNotesMode(false);
      setElapsedSeconds(0);
      setHintsUsed(0);
      setStatus('playing');
      setLoadingPuzzle(false);
      setMessage('');
      winRecordedRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    const saved = loadStoredSudokuState();
    if (!saved) {
      startNewGame('medium');
      return;
    }

    setDifficulty(saved.difficulty);
    setInitialGrid(cloneGrid(saved.initialGrid));
    setSolutionGrid(cloneGrid(saved.solutionGrid));
    setGrid(cloneGrid(saved.grid));
    setNotes(normalizeSavedNotes(saved.notes));
    setSelectedCell(saved.selectedCell);
    setNotesMode(Boolean(saved.notesMode));
    setStatus(saved.status === 'won' ? 'won' : 'playing');
    setElapsedSeconds(saved.elapsedSeconds);
    setHintsUsed(saved.hintsUsed || 0);
    setLoadingPuzzle(false);
    setMessage('');
    winRecordedRef.current = saved.status === 'won';
  }, [startNewGame]);

  useEffect(() => {
    if (status !== 'playing') return undefined;
    const timerId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [status]);

  useEffect(() => {
    if (loadingPuzzle || status === 'loading') return;

    persistSudokuState({
      difficulty,
      initialGrid,
      solutionGrid,
      grid,
      notes,
      selectedCell,
      notesMode,
      status,
      elapsedSeconds,
      hintsUsed,
    });
  }, [difficulty, elapsedSeconds, grid, hintsUsed, initialGrid, loadingPuzzle, notes, notesMode, selectedCell, solutionGrid, status]);

  useEffect(() => {
    if (status !== 'playing') return;
    if (!isGridComplete(grid)) return;
    if (conflicts.size > 0) return;
    if (!isGridSolved(grid, solutionGrid)) return;

    setStatus('won');
    setMessage('Перфектна игра. Пъзелът е решен.');

    if (!winRecordedRef.current) {
      const today = getTodayStr();
      recordGameWin(GAME_SLUG, today);
      saveGameProgress(GAME_SLUG, today, {
        puzzleId: `${today}-${difficulty}`,
        gameStatus: 'won',
        difficulty,
        elapsedSeconds,
        hintsUsed,
      });
      winRecordedRef.current = true;
    }
  }, [conflicts, difficulty, elapsedSeconds, grid, hintsUsed, solutionGrid, status]);

  const setCellValue = useCallback((digit) => {
    if (status !== 'playing') return;

    const row = Number(selectedCell?.row);
    const column = Number(selectedCell?.column);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return;
    if (!isCellEditable(initialGrid, row, column)) return;

    if (notesMode) {
      setNotes((current) => toggleNote(current, row, column, digit));
      return;
    }

    setGrid((current) => {
      const next = cloneGrid(current);
      next[row][column] = digit;
      return next;
    });

    setNotes((current) => clearDigitFromPeers(clearCellNotes(current, row, column), row, column, digit));
    setMessage('');
  }, [initialGrid, notesMode, selectedCell, status]);

  const clearSelectedCell = useCallback(() => {
    if (status !== 'playing') return;

    const row = Number(selectedCell?.row);
    const column = Number(selectedCell?.column);
    if (!Number.isInteger(row) || !Number.isInteger(column)) return;
    if (!isCellEditable(initialGrid, row, column)) return;

    setGrid((current) => {
      const next = cloneGrid(current);
      next[row][column] = 0;
      return next;
    });

    setNotes((current) => clearCellNotes(current, row, column));
    setMessage('');
  }, [initialGrid, selectedCell, status]);

  const giveHint = useCallback(() => {
    if (status !== 'playing') return;
    if (hintsUsed >= hintLimit) {
      setMessage(`Лимитът за подсказки е изчерпан (${hintLimit}).`);
      return;
    }

    let row = Number(selectedCell?.row);
    let column = Number(selectedCell?.column);

    if (!Number.isInteger(row) || !Number.isInteger(column) || !isCellEditable(initialGrid, row, column) || Number(grid[row][column]) > 0) {
      const fallbackCell = getDefaultSelection(grid);
      row = fallbackCell.row;
      column = fallbackCell.column;
      if (!isCellEditable(initialGrid, row, column)) {
        setMessage('Няма свободна клетка за подсказка.');
        return;
      }
    }

    const value = Number(solutionGrid?.[row]?.[column] || 0);
    if (value <= 0) return;

    setSelectedCell({ row, column });
    setGrid((current) => {
      const next = cloneGrid(current);
      next[row][column] = value;
      return next;
    });
    setHintsUsed((current) => Math.min(hintLimit, current + 1));
    setNotes((current) => clearDigitFromPeers(clearCellNotes(current, row, column), row, column, value));
    setMessage('Подсказката е приложена.');
  }, [grid, hintLimit, hintsUsed, initialGrid, selectedCell, solutionGrid, status]);

  const runValidation = useCallback(() => {
    if (status === 'won') {
      setMessage('Пъзелът вече е решен.');
      return;
    }

    if (conflicts.size > 0) {
      setMessage('Има конфликтни клетки на дъската.');
      return;
    }

    if (isGridSolved(grid, solutionGrid)) {
      setStatus('won');
      setMessage('Перфектна игра. Пъзелът е решен.');
      return;
    }

    setMessage('Продължавай, близо си.');
  }, [conflicts, grid, solutionGrid, status]);

  const handleDifficultyChange = useCallback((target) => {
    if (!DIFFICULTIES.includes(target)) return;
    startNewGame(target);
  }, [startNewGame]);

  const handleShare = useCallback(() => {
    if (status !== 'won') return;

    const shareText = [
      `zNews Судоку ${difficulty.toUpperCase()}`,
      `Време: ${formatElapsedTime(elapsedSeconds)}`,
      `Дата: ${getTodayStr()}`,
    ].join('\n');

    navigator.clipboard.writeText(shareText)
      .then(() => setMessage('Резултатът е копиран в клипборда.'))
      .catch(() => setMessage('Нямам достъп до клипборда.'));
  }, [difficulty, elapsedSeconds, status]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (showHelp) return;
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const targetTag = String(event.target?.tagName || '').toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;

      if (event.key >= '1' && event.key <= '9') {
        event.preventDefault();
        setCellValue(Number.parseInt(event.key, 10));
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
        event.preventDefault();
        clearSelectedCell();
        return;
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setNotesMode((current) => !current);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedCell((current) => moveCellSelection(current, -1, 0));
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedCell((current) => moveCellSelection(current, 1, 0));
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelectedCell((current) => moveCellSelection(current, 0, -1));
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelectedCell((current) => moveCellSelection(current, 0, 1));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelectedCell, setCellValue, showHelp]);

  const progress = useMemo(() => {
    const totalCells = 81;
    const filledCells = grid.flat().filter((value) => Number(value) > 0).length;
    return {
      filledCells,
      completionPct: Math.round((filledCells / totalCells) * 100),
    };
  }, [grid]);

  const todayProgress = loadGameProgress(GAME_SLUG, getTodayStr());

  return (
    <div className="min-h-screen bg-zn-paper text-slate-900 pb-20 dark:bg-[#0b0d14] dark:text-[#f4efe6]">
      <header className="w-full border-b border-stone-200 bg-white/80 backdrop-blur mb-6 dark:border-white/10 dark:bg-[#12131d]/85">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between p-4">
          <Link to="/games" className="text-slate-500 hover:text-slate-900 transition-colors dark:text-stone-400 dark:hover:text-white" aria-label="Назад към игрите">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-display font-black uppercase tracking-widest">Судоку</h1>
          <button onClick={() => setShowHelp(true)} className="text-slate-500 hover:text-slate-900 transition-colors dark:text-stone-400 dark:hover:text-white" aria-label="Помощ за Судоку">
            <HelpCircle className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <section className="space-y-4">
          <div className="newspaper-page comic-panel comic-dots p-5 relative border-2 border-[#1C1428] bg-[#f5eedf] shadow-comic-heavy dark:border-[#5c667d] dark:bg-[#151927] dark:shadow-none">
            <div className="absolute -top-2 right-8 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-4 z-10 dark:bg-[#d7bb63]/80 dark:border-white/10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 relative z-[2]">
              <div>
                <p className="text-xs font-display font-bold uppercase tracking-[0.28em] text-zn-hot dark:text-[#ff8b6b]">{HERO_KICKER}</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-display font-black uppercase tracking-wide text-[#0d2240] dark:text-[#f7f1e7]">{HERO_TITLE}</h2>
                <p className="mt-3 max-w-3xl text-sm sm:text-base font-sans font-semibold leading-relaxed text-zinc-700 dark:text-[#cad1df]">
                  {HERO_SUBTITLE}
                </p>
              </div>
              <div className="text-sm font-display font-black uppercase tracking-wider text-zn-text-dim inline-flex items-center gap-2 dark:text-[#a7afbf]">
                <Timer className="w-4 h-4" /> {formatElapsedTime(elapsedSeconds)}
              </div>
            </div>
            <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-3 relative z-[2]" />

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 relative z-[2]">
              {DIFFICULTIES.map((key) => {
                const config = SUDOKU_DIFFICULTY_CONFIG[key];
                const active = key === difficulty;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={loadingPuzzle}
                    onClick={() => handleDifficultyChange(key)}
                    className={`border-2 border-[#1C1428] px-3 py-2 text-xs sm:text-sm font-display font-black uppercase tracking-wider transition-colors dark:border-[#5c667d] ${active ? 'bg-zn-hot text-white dark:bg-[#ff5a36]' : 'bg-white text-[#1C1428] hover:bg-zn-hot hover:text-white dark:bg-[#101523] dark:text-[#f7f1e7] dark:hover:bg-[#ff5a36] dark:hover:text-white'} disabled:opacity-50`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loadingPuzzle ? (
            <div className="w-full max-w-[620px] mx-auto h-[420px] sm:h-[620px] flex items-center justify-center border-2 border-[#1C1428] bg-white shadow-comic-heavy dark:border-[#5c667d] dark:bg-[#111522] dark:shadow-none">
              <span className="font-display font-black uppercase tracking-wider text-zn-text-dim dark:text-[#a7afbf]">Зареждане на дъска...</span>
            </div>
          ) : (
            <SudokuBoard
              grid={grid}
              initialGrid={initialGrid}
              notes={notes}
              selectedCell={selectedCell}
              conflicts={conflicts}
              onSelectCell={(row, column) => setSelectedCell({ row, column })}
            />
          )}

          <SudokuKeypad
            notesMode={notesMode}
            onToggleNotes={() => setNotesMode((current) => !current)}
            onInputDigit={setCellValue}
            onClearCell={clearSelectedCell}
            onHint={giveHint}
            onNewGame={() => startNewGame(difficulty)}
            disabled={loadingPuzzle}
            hintDisabled={status !== 'playing' || hintsRemaining <= 0}
          />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-5">
          <div className="newspaper-page comic-panel comic-dots p-4 border-2 border-[#1C1428] bg-white dark:border-[#5c667d] dark:bg-[#151927]">
            <p className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-zn-text-dim dark:text-[#a7afbf]">Сесия</p>
            <div className="mt-3 space-y-2 text-sm font-sans text-zn-text dark:text-[#edf1f7]">
              <p><span className="font-bold">Трудност:</span> {SUDOKU_DIFFICULTY_CONFIG[difficulty]?.label}</p>
              <p><span className="font-bold">Попълнени:</span> {progress.filledCells}/81 ({progress.completionPct}%)</p>
              <p><span className="font-bold">Статус за днес:</span> {todayProgress?.gameStatus === 'won' ? 'Завършено' : 'Още не е завършено'}</p>
              <p><span className="font-bold">Конфликти:</span> {conflicts.size}</p>
              <p><span className="font-bold">Подсказки:</span> {hintsRemaining}/{hintLimit} оставащи</p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={runValidation}
                className="border-2 border-[#1C1428] bg-white px-3 py-2 text-sm font-display font-black uppercase tracking-wider text-[#1C1428] hover:bg-zn-hot hover:text-white transition-colors dark:border-[#5c667d] dark:bg-[#0f1422] dark:text-[#f7f1e7] dark:hover:bg-[#ff5a36]"
              >
                Провери дъската
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={status !== 'won'}
                className="inline-flex items-center justify-center gap-2 border-2 border-[#1C1428] bg-white px-3 py-2 text-sm font-display font-black uppercase tracking-wider text-[#1C1428] hover:bg-zn-purple hover:text-white transition-colors disabled:opacity-40 dark:border-[#5c667d] dark:bg-[#0f1422] dark:text-[#f7f1e7] dark:hover:bg-[#8b5cf6]"
              >
                <Share2 className="w-4 h-4" /> Сподели
              </button>
            </div>
          </div>

          {status === 'won' && (
            <div className="newspaper-page comic-panel comic-dots p-4 border-2 border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/40 dark:border-emerald-500/40">
              <h3 className="inline-flex items-center gap-2 text-base font-display font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5" /> Пъзелът е решен
              </h3>
              <p className="mt-2 text-sm font-sans text-emerald-900 dark:text-emerald-100">
                Отлично завършване на <span className="font-semibold">{SUDOKU_DIFFICULTY_CONFIG[difficulty]?.label}</span> за <span className="font-semibold">{formatElapsedTime(elapsedSeconds)}</span>.
              </p>
            </div>
          )}

          {message && (
            <div className="newspaper-page comic-panel comic-dots p-4 border-2 border-[#1C1428] bg-white dark:border-[#5c667d] dark:bg-[#151927]">
              <p className="text-sm font-sans text-zn-text dark:text-[#edf1f7]">{message}</p>
            </div>
          )}
        </aside>
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-lg border-2 border-[#1C1428] bg-white p-6 shadow-comic-heavy dark:border-[#5c667d] dark:bg-[#151927] dark:shadow-none" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-2xl font-display font-black uppercase tracking-wide text-zn-text dark:text-[#f7f1e7]">ПРАВИЛА НА ИГРАТА</h2>
            <ul className="mt-4 list-disc pl-5 space-y-2 text-sm font-sans text-zn-text-muted dark:text-[#c9d0dd]">
              <li>Попълни решетката 9x9 така, че всеки ред, колона и квадрат 3x3 да съдържа числата 1-9 точно по веднъж.</li>
              <li>Използвай <span className="font-semibold">Бележки</span>, за да добавяш възможни числа в празните клетки.</li>
              <li>Клавишни комбинации: цифри 1-9, стрелки за движение, Backspace/Delete за изчистване, <span className="font-semibold">N</span> превключва бележките.</li>
              <li>Можеш да започнеш нова дъска по всяко време на Лесно, Средно, Трудно или Експерт.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full border-2 border-[#1C1428] bg-zn-hot px-4 py-2 text-sm font-display font-black uppercase tracking-wider text-white hover:bg-zn-hot-dark transition-colors dark:border-[#5c667d] dark:bg-[#ff5a36] dark:hover:bg-[#ff734f]"
            >
              Продължи
            </button>
          </div>
        </div>
      )}
    </div>
  );
}







