import { Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';

export default function GamesHubCard({ game, profile, todayStr }) {
    const Icon = LucideIcons[game.icon] || LucideIcons.Gamepad2;
    const isCompletedToday = profile?.completedDatesByGame?.[game.slug]?.includes(todayStr) || false;

    const themeColors = {
        green: 'from-emerald-500/20 to-emerald-900/40 border-emerald-500/30 text-emerald-400',
        indigo: 'from-indigo-500/20 to-indigo-900/40 border-indigo-500/30 text-indigo-400',
        orange: 'from-orange-500/20 to-orange-900/40 border-orange-500/30 text-orange-400',
        default: 'from-zinc-700/50 to-zinc-900/80 border-zinc-600/50 text-zinc-300'
    };
    const themeClass = themeColors[game.theme] || themeColors.default;

    return (
        <motion.div whileHover={{ y: -4 }} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${themeClass} p-6 flex flex-col h-full shadow-lg`}>
            <div className="mb-4 flex items-center justify-between">
                <div className="p-3 bg-black/30 rounded-xl">
                    <Icon className="w-8 h-8" />
                </div>
                {isCompletedToday && (
                    <div className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <LucideIcons.CheckCircle2 className="w-3 h-3" />
                        Изиграна
                    </div>
                )}
            </div>

            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wide font-condensed">{game.title}</h3>
            <p className="text-sm text-zinc-300 mb-6 flex-grow">{game.description}</p>

            <Link to={`/games/${game.slug}`} className="mt-auto relative z-10 w-full rounded-xl bg-white text-black font-bold py-3 text-center uppercase tracking-widest hover:bg-zinc-200 transition-colors">
                {isCompletedToday ? 'Виж резултата' : 'Играй сега'}
            </Link>
        </motion.div>
    );
}
