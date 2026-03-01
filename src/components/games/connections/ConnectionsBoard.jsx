import { motion } from 'framer-motion';

const DIFFICULTY_COLORS = {
    1: 'bg-yellow-400 text-yellow-950',   // Easy
    2: 'bg-emerald-400 text-emerald-950', // Medium
    3: 'bg-indigo-400 text-indigo-950',   // Hard
    4: 'bg-purple-400 text-purple-950'    // Tricky
};

export default function ConnectionsBoard({ items, selectedItems, solvedGroups, onToggle, shakeTiles }) {
    return (
        <div className="w-full flex flex-col gap-2">
            {/* Solved Groups at the top */}
            {solvedGroups.map(group => (
                <motion.div
                    key={group.label}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`w-full rounded-xl p-4 flex flex-col items-center justify-center text-center ${DIFFICULTY_COLORS[group.difficulty] || 'bg-zinc-600 text-white'}`}
                >
                    <h3 className="font-black uppercase tracking-widest text-lg mb-1">{group.label}</h3>
                    <p className="font-medium">{group.items.join(', ')}</p>
                </motion.div>
            ))}

            {/* Grid of remaining items */}
            <div className="grid grid-cols-4 gap-2">
                {items.map(item => {
                    const isSelected = selectedItems.includes(item);

                    return (
                        <motion.button
                            key={item}
                            onClick={() => onToggle(item)}
                            animate={shakeTiles && isSelected ? { x: [-5, 5, -5, 5, 0] } : {}}
                            transition={{ duration: 0.4 }}
                            className={`aspect-square sm:aspect-[4/3] rounded-xl flex items-center justify-center p-2 text-sm sm:text-base md:text-lg font-black uppercase text-center transition-all ${isSelected
                                    ? 'bg-zinc-600 text-white scale-95 shadow-inner'
                                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                                }`}
                        >
                            <span className="break-words w-full px-1 leading-tight">{item}</span>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
