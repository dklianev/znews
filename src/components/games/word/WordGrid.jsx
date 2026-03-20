import { motion } from 'motion/react';

export default function WordGrid({ guesses, currentGuess, wordLength, maxAttempts }) {
    const empties = Math.max(0, maxAttempts - guesses.length - (currentGuess ? 1 : 0));

    return (
        <div className="grid gap-2 mb-6 w-full max-w-sm mx-auto p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xl">
            {guesses.map((guess, i) => (
                <CompletedRow key={i} guess={guess} />
            ))}
            {guesses.length < maxAttempts && (
                <CurrentRow guess={currentGuess} wordLength={wordLength} />
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

function CurrentRow({ guess, wordLength }) {
    const letters = guess.split('');
    const emptyBoxes = Array.from({ length: wordLength - letters.length });

    return (
        <div className="flex gap-2 justify-center">
            {letters.map((letter, i) => (
                <motion.div
                    key={i}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-12 h-12 border-[3px] border-slate-400 dark:border-zinc-500 flex items-center justify-center text-2xl font-black uppercase text-slate-900 dark:text-white rounded bg-white dark:bg-zinc-800 shadow-[0_0_10px_rgba(255,255,255,0.08)]"
                >
                    {letter}
                </motion.div>
            ))}
            {emptyBoxes.map((_, i) => (
                <div key={i} className="w-12 h-12 border-2 border-stone-200 dark:border-zinc-800 flex items-center justify-center rounded bg-stone-50 dark:bg-black/20" />
            ))}
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
