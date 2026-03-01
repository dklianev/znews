import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function QuizQuestionCard({
    question,
    currentQ,
    totalQ,
    selectedOption,
    onSelectOption,
    onNext
}) {
    const hasAnswered = selectedOption !== null;
    const isCorrect = hasAnswered && selectedOption === question.correctIndex;

    return (
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="bg-orange-50 dark:bg-zinc-800/50 px-6 py-4 border-b border-orange-100 dark:border-zinc-800 flex justify-between items-center">
                <span className="text-orange-700 dark:text-zinc-400 font-bold uppercase tracking-widest text-sm">
                    Въпрос {currentQ + 1} от {totalQ}
                </span>
            </div>

            <div className="p-6 md:p-8 flex-grow flex flex-col">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight mb-8 font-condensed">
                    {question.question}
                </h2>

                <div className="space-y-3 mb-8 flex-grow">
                    {question.options.map((option, idx) => {
                        let btnClass = 'bg-stone-50 border-stone-200 text-slate-800 hover:bg-stone-100 hover:border-stone-300 dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:border-zinc-500';
                        let Icon = null;

                        if (hasAnswered) {
                            if (idx === question.correctIndex) {
                                btnClass = 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/50 dark:text-emerald-400';
                                Icon = CheckCircle2;
                            } else if (idx === selectedOption) {
                                btnClass = 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/20 dark:border-red-500/50 dark:text-red-400';
                                Icon = XCircle;
                            } else {
                                btnClass = 'bg-stone-50/70 border-stone-100 text-stone-400 opacity-60 dark:bg-zinc-800/30 dark:border-zinc-800 dark:text-zinc-600';
                            }
                        } else if (selectedOption === idx) {
                            btnClass = 'bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-500/20 dark:border-orange-500 dark:text-orange-400';
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => !hasAnswered && onSelectOption(idx)}
                                disabled={hasAnswered}
                                className={`w-full text-left px-5 py-4 rounded-xl border-2 font-bold text-lg transition-all flex justify-between items-center ${btnClass}`}
                            >
                                <span>{option}</span>
                                {Icon && <Icon className="w-6 h-6 shrink-0 ml-4" />}
                            </button>
                        );
                    })}
                </div>

                {hasAnswered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-5 rounded-xl border mb-6 ${isCorrect ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'}`}
                    >
                        <p className="font-bold mb-2 flex items-center gap-2">
                            {isCorrect ? (
                                <><span className="text-emerald-700 dark:text-emerald-400">Правилен отговор!</span></>
                            ) : (
                                <><span className="text-red-700 dark:text-red-400">Грешен отговор!</span></>
                            )}
                        </p>
                        <p className="text-slate-600 dark:text-zinc-300 text-sm">{question.explanation}</p>
                    </motion.div>
                )}

                {hasAnswered && (
                    <button
                        onClick={onNext}
                        className="w-full py-4 mt-auto bg-slate-900 text-white dark:bg-white dark:text-black font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors"
                    >
                        {currentQ < totalQ - 1 ? 'Следващ въпрос' : 'Виж резултатите'}
                    </button>
                )}
            </div>
        </div>
    );
}
