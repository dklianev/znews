import { Link } from 'react-router-dom';
import { CheckCircle2, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGameIconComponent } from '../../utils/gameIcons';

export default function GamesHubCard({ game, progress, streak }) {
    const Icon = getGameIconComponent(game.icon);
    const gameStatus = progress?.gameStatus || '';
    const isPlayedToday = Boolean(progress) && gameStatus !== 'playing';
    const isWonToday = gameStatus === 'won';
    const hasActiveStreak = Number(streak?.currentStreak) > 0;

    const themeVariant = {
        green: 'eco',
        indigo: 'underground',
        orange: 'hot',
        purple: 'underground',
        default: 'front'
    }[game.theme] || 'front';

    const stripeColors = {
        green: 'from-emerald-500 to-emerald-700',
        indigo: 'from-indigo-600 to-zn-navy',
        orange: 'from-zn-hot to-zn-orange',
        purple: 'from-zn-purple to-zn-purple-dark',
        default: 'from-zinc-700 to-zinc-900'
    };
    const stripeClass = stripeColors[game.theme] || stripeColors.default;

    return (
        <motion.div whileHover={{ y: -4, rotate: -1 }} className={`group comic-latest-card comic-panel comic-dots bg-white dark:bg-zinc-900 relative block flex flex-col h-full overflow-visible comic-card-variant-${themeVariant}`}>
            <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${stripeClass}`} />

            <span className="comic-card-tape comic-card-tape-right" />

            <div className="absolute -top-3 -right-2 z-30 flex flex-col gap-2 items-end">
                {isPlayedToday && (
                    <span className={`comic-sticker ${isWonToday ? 'comic-sticker-eco' : 'comic-sticker-underground'} shadow-sticker`}>
                        {isWonToday ? 'ПОБЕДА' : 'ИЗИГРАНА'}
                    </span>
                )}
                {hasActiveStreak && (
                    <span className="comic-sticker comic-sticker-hot mt-1 flex items-center gap-1 shadow-sticker">
                        <Flame className="w-3 h-3" />
                        {streak.currentStreak} ДНИ
                    </span>
                )}
            </div>

            <div className="p-6 pt-10 flex flex-col flex-grow relative z-10 border-2 border-black dark:border-zinc-700 m-0 shadow-comic-heavy dark:shadow-none h-full bg-white dark:bg-zinc-900 transition-all group-hover:shadow-comic-glow dark:group-hover:shadow-none">
                <div className="mb-4">
                    <div className="inline-block p-3 border-4 border-black dark:border-zinc-600 bg-white dark:bg-zinc-950 shadow-comic dark:shadow-none transform -rotate-2 group-hover:rotate-0 transition-transform">
                        <Icon className="w-8 h-8 text-black dark:text-white" />
                    </div>
                </div>

                <h3 className="text-3xl font-display font-black text-black dark:text-white mb-2 uppercase tracking-[0.02em] leading-none group-hover:text-zn-hot transition-colors flex-shrink-0">
                    {game.title}
                </h3>

                <p className="text-base text-zn-comic-black dark:text-zinc-300 font-semibold mb-6 flex-grow leading-snug">
                    {game.description}
                </p>

                <Link
                    to={`/games/${game.slug}`}
                    className="mt-auto relative z-10 w-full bg-zn-hot text-black border-4 border-black dark:border-zinc-700 shadow-comic dark:shadow-none font-display font-black py-3 text-center uppercase tracking-widest text-xl hover:bg-zn-comic-yellow hover:-translate-y-1 hover:shadow-comic-heavy dark:hover:shadow-none transition-all active:translate-y-0 active:shadow-comic"
                >
                    {isPlayedToday ? 'ВИЖ РЕЗУЛТАТА' : 'ИГРАЙ СЕГА'}
                </Link>
            </div>
        </motion.div>
    );
}

