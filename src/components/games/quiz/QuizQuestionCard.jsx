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
        <div className="w-full max-w-2xl bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                <span className="text-zinc-400 font-bold uppercase tracking-widest text-sm">
                    Въпрос {currentQ + 1} от {totalQ}
                </span>
            </div>

            <div className="p-6 md:p-8 flex-grow flex flex-col">
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-8 font-condensed">
                    {question.question}
                </h2>

                <div className="space-y-3 mb-8 flex-grow">
                    {question.options.map((option, idx) => {
                        let btnClass = 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500';
                        let Icon = null;

                        if (hasAnswered) {
                            if (idx === question.correctIndex) {
                                btnClass = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
                                Icon = CheckCircle2;
                            } else if (idx === selectedOption) {
                                btnClass = 'bg-red-500/20 border-red-500/50 text-red-400';
                                Icon = XCircle;
                            } else {
                                btnClass = 'bg-zinc-800/30 border-zinc-800 text-zinc-600 opacity-50';
                            }
                        } else if (selectedOption === idx) {
                            btnClass = 'bg-orange-500/20 border-orange-500 text-orange-400';
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
                        className={`p-5 rounded-xl border mb-6 ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}
                    >
                        <p className="font-bold mb-2 flex items-center gap-2">
                            {isCorrect ? (
                                <><span className="text-emerald-400">Правилен отговор!</span></>
                            ) : (
                                <><span className="text-red-400">Грешен отговор!</span></>
                            )}
                        </p>
                        <p className="text-zinc-300 text-sm">{question.explanation}</p>
                    </motion.div>
                )}

                {hasAnswered && (
                    <button
                        onClick={onNext}
                        className="w-full py-4 mt-auto bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-colors"
                    >
                        {currentQ < totalQ - 1 ? 'Следващ въпрос' : 'Виж резултатите'}
                    </button>
                )}
            </div>
        </div>
    );
}
