import { motion } from 'motion/react';

const DIFFICULTY_COLORS = {
    1: 'bg-amber-100 text-amber-950 border border-amber-200 dark:bg-amber-400 dark:text-amber-950 dark:border-transparent',
    2: 'bg-emerald-100 text-emerald-950 border border-emerald-200 dark:bg-emerald-400 dark:text-emerald-950 dark:border-transparent',
    3: 'bg-indigo-100 text-indigo-950 border border-indigo-200 dark:bg-indigo-400 dark:text-indigo-950 dark:border-transparent',
    4: 'bg-fuchsia-100 text-fuchsia-950 border border-fuchsia-200 dark:bg-purple-400 dark:text-purple-950 dark:border-transparent'
};

function getTileTextClasses(item) {
    const length = Array.from(String(item || '').trim()).length;
    if (length >= 11) return 'text-[0.72rem] leading-[0.92] tracking-[-0.05em] sm:text-[0.95rem]';
    if (length >= 9) return 'text-[0.8rem] leading-[0.95] tracking-[-0.04em] sm:text-[1rem]';
    if (length >= 7) return 'text-[0.88rem] leading-[0.98] tracking-[-0.03em] sm:text-[1.05rem]';
    return 'text-[0.98rem] leading-[1.02] tracking-[-0.02em] sm:text-[1.08rem] md:text-lg';
}

export default function ConnectionsBoard({ items, selectedItems, solvedGroups, onToggle, shakeTiles }) {
    return (
        <div className="w-full flex flex-col gap-2 sm:gap-3">
            {/* Solved Groups at the top */}
            {solvedGroups.map(group => (
                <motion.div
                    key={group.label}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`w-full rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm ${DIFFICULTY_COLORS[group.difficulty] || 'bg-slate-200 text-slate-900 dark:bg-zinc-600 dark:text-white'}`}
                >
                    <h3 className="font-black uppercase tracking-widest text-lg mb-1">{group.label}</h3>
                    <p className="font-medium">{group.items.join(', ')}</p>
                </motion.div>
            ))}

            {/* Grid of remaining items */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {items.map(item => {
                    const isSelected = selectedItems.includes(item);
                    const tileTextClasses = getTileTextClasses(item);

                    return (
                        <motion.button
                            key={item}
                            onClick={() => onToggle(item)}
                            animate={shakeTiles && isSelected ? { x: [-5, 5, -5, 5, 0] } : {}}
                            transition={{ duration: 0.4 }}
                            className={`min-h-[104px] sm:min-h-[118px] rounded-[22px] sm:rounded-xl flex items-center justify-center px-1.5 py-2 sm:p-3 font-black uppercase text-center transition-all ${isSelected
                                    ? 'bg-slate-800 text-white scale-95 shadow-inner dark:bg-zinc-600'
                                    : 'bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 dark:bg-zinc-800 dark:text-white dark:border-transparent dark:hover:bg-zinc-700'
                                }`}
                        >
                            <span className={`block w-full break-words whitespace-normal px-0.5 ${tileTextClasses}`}>{item}</span>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
