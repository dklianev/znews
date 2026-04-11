import { useRef, useState } from 'react';

export default function StrandsBoard({
    grid,
    currentPath,
    foundCellKinds,
    formingWord,
    disabled = false,
    onStartPath,
    onExtendPath,
    onFinishPath,
}) {
    const boardRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const currentPathSet = new Set(Array.isArray(currentPath) ? currentPath : []);
    const safeGrid = Array.isArray(grid) ? grid : [];

    const resolveCellFromPointer = (event) => {
        if (typeof document === 'undefined') return null;
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const cellNode = target?.closest?.('[data-strands-cell]');
        if (!cellNode || !boardRef.current?.contains(cellNode)) return null;
        const nextCell = Number.parseInt(cellNode.getAttribute('data-strands-cell'), 10);
        return Number.isInteger(nextCell) ? nextCell : null;
    };

    const handlePointerDown = (cellIndex, event) => {
        if (disabled) return;
        event.preventDefault();
        boardRef.current?.setPointerCapture?.(event.pointerId);
        setIsDragging(true);
        onStartPath?.(cellIndex);
    };

    const handlePointerMove = (event) => {
        if (!isDragging || disabled) return;
        const cellIndex = resolveCellFromPointer(event);
        if (cellIndex === null) return;
        onExtendPath?.(cellIndex);
    };

    const finishPointer = (event) => {
        if (!isDragging) return;
        if (boardRef.current?.hasPointerCapture?.(event.pointerId)) {
            boardRef.current.releasePointerCapture(event.pointerId);
        }
        setIsDragging(false);
        onFinishPath?.();
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-[26px] border-3 border-[#1C1428] bg-white/95 px-5 py-4 shadow-[6px_6px_0_#1C1428] dark:border-white/15 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.32em] text-zn-purple">Текуща следа</p>
                        <h3 className="mt-2 text-2xl font-black uppercase font-display text-slate-900 dark:text-white">
                            {formingWord || 'Свържи буквите'}
                        </h3>
                    </div>
                    <span className="rounded-full border-2 border-[#1C1428] bg-zn-paper px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-700 shadow-[3px_3px_0_#1C1428] dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-200 dark:shadow-none">
                        8 посоки
                    </span>
                </div>
            </div>

            <div
                ref={boardRef}
                className="comic-panel comic-dots relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(91,26,140,0.12),rgba(255,255,255,0.96))] p-4 dark:bg-[radial-gradient(circle_at_top,rgba(91,26,140,0.22),rgba(24,24,27,0.96))]"
                style={{ touchAction: 'none' }}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
                onPointerLeave={finishPointer}
            >
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                    {safeGrid.flatMap((row, rowIndex) => Array.from(String(row || '')).map((char, colIndex) => {
                        const cellIndex = (rowIndex * 6) + colIndex;
                        const foundKind = foundCellKinds.get(cellIndex) || '';
                        const isCurrent = currentPathSet.has(cellIndex);
                        const cellClass = isCurrent
                            ? 'border-zn-purple bg-zn-purple/20 text-zn-purple-dark dark:border-zn-purple-light dark:bg-zn-purple/25 dark:text-white'
                            : foundKind === 'spangram'
                                ? 'border-amber-500 bg-amber-200 text-amber-950 dark:border-amber-400 dark:bg-amber-700 dark:text-white'
                                : foundKind === 'theme'
                                    ? 'border-indigo-400 bg-indigo-200 text-indigo-950 dark:border-indigo-500 dark:bg-indigo-800 dark:text-white'
                                    : 'border-[#1C1428] bg-white text-slate-900 dark:border-white/15 dark:bg-zinc-900 dark:text-white';

                        return (
                            <button
                                key={`strands-cell-${cellIndex}`}
                                type="button"
                                data-strands-cell={cellIndex}
                                onPointerDown={(event) => handlePointerDown(cellIndex, event)}
                                className={`h-11 rounded-xl border-2 text-lg font-black uppercase transition-colors select-none sm:h-[52px] sm:text-xl ${cellClass}`}
                                disabled={disabled}
                            >
                                {char}
                            </button>
                        );
                    }))}
                </div>
            </div>
        </div>
    );
}
