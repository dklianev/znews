import { motion } from 'motion/react';

export default function WordGrid({ guesses, currentGuess, wordLength, maxAttempts, isWordReady = false }) {
    const empties = Math.max(0, maxAttempts - guesses.length - (currentGuess ? 1 : 0));

    return (
        <div className="grid gap-2 mb-6 w-full max-w-sm mx-auto p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xl">
            {guesses.map((guess, i) => (
                <CompletedRow key={i} guess={guess} />
            ))}
            {guesses.length < maxAttempts && (
                <CurrentRow guess={currentGuess} wordLength={wordLength} isReady={isWordReady} />
            )}
            {Array.from({ length: empties }).map((_, i) => (
                <EmptyRow key={i} wordLength={wordLength} />
            ))}
        </div>
    );
}

function CompletedRow({ guess }) {
    return (
        <div className="flex gap-2 justify-center">
            {guess.map((gw, i) => (
                <motion.div
                    key={i}
                    initial={{ rotateX: 90 }}
                    animate={{ rotateX: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className={`w-12 h-12 flex items-center justify-center text-2xl font-black uppercase rounded bg-gradient-to-br ${gw.status === 'correct' ? 'from-emerald-500 to-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' :
                            gw.status === 'present' ? 'from-amber-300 to-yellow-400 text-amber-950 dark:from-yellow-500 dark:to-yellow-600 dark:text-white shadow-[0_0_15px_rgba(234,179,8,0.35)]' :
                                'from-slate-200 to-slate-300 text-slate-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-300'
                        }`}
                >
                    {gw.letter}
                </motion.div>
            ))}
        </div>
    );
}

function CurrentRow({ guess, wordLength, isReady }) {
    const letters = guess.split('');
    const emptyBoxes = Array.from({ length: wordLength - letters.length });

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="flex gap-2 justify-center">
                {letters.map((letter, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className={`w-12 h-12 border-[3px] flex items-center justify-center text-2xl font-black uppercase rounded shadow-[0_0_10px_rgba(255,255,255,0.08)] transition-colors duration-200 ${
                            isReady
                                ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-slate-900 dark:text-white'
                                : 'border-slate-400 dark:border-zinc-500 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white'
                        }`}
                    >
                        {letter}
                    </motion.div>
                ))}
                {emptyBoxes.map((_, i) => (
                    <div key={i} className="w-12 h-12 border-2 border-stone-200 dark:border-zinc-800 flex items-center justify-center rounded bg-stone-50 dark:bg-black/20" />
                ))}
            </div>
            {isReady && (
                <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mt-1"
                >
                    Натисни ENTER ↵
                </motion.p>
            )}
        </div>
    );
}

function EmptyRow({ wordLength }) {
    return (
        <div className="flex gap-2 justify-center">
            {Array.from({ length: wordLength }).map((_, i) => (
                <div key={i} className="w-12 h-12 border-2 border-stone-200 dark:border-zinc-800 flex items-center justify-center rounded bg-stone-50 dark:bg-black/20" />
            ))}
        </div>
    );
}
