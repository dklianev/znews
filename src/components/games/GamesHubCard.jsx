import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGameIconComponent } from '../../utils/gameIcons';

export default function GamesHubCard({ game, progress }) {
    const Icon = getGameIconComponent(game.icon);
    const gameStatus = progress?.gameStatus || '';
    const isPlayedToday = Boolean(progress) && gameStatus !== 'playing';
    const isWonToday = gameStatus === 'won';

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
                {isPlayedToday && (
                    <div className={`px-3 py-1 border rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${isWonToday
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-zinc-500/20 text-zinc-200 border-zinc-500/30'}`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {isWonToday ? 'Победа' : 'Изиграна'}
                    </div>
                )}
            </div>

            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wide font-condensed">{game.title}</h3>
            <p className="text-sm text-zinc-300 mb-6 flex-grow">{game.description}</p>

            <Link to={`/games/${game.slug}`} className="mt-auto relative z-10 w-full rounded-xl bg-white text-black font-bold py-3 text-center uppercase tracking-widest hover:bg-zinc-200 transition-colors">
                {isPlayedToday ? 'Виж резултата' : 'Играй сега'}
            </Link>
        </motion.div>
    );
}
