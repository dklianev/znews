import { useState, useEffect, useMemo } from 'react';
import { getGameStreak, loadGameProfile, loadGameProgress } from '../utils/gameStorage';
import { usePublicData } from '../context/DataContext';
import { getTodayStr } from '../utils/gameDate';
import GamesHubCard from '../components/games/GamesHubCard';
import { sortGamesCatalog } from '../utils/gamesCatalog';
import { Gamepad2, Loader2 } from 'lucide-react';
import EasterDecorations from '../components/seasonal/EasterDecorations';

export default function GamesPage() {
    const { games, publicSectionStatus, loadGamesCatalog } = usePublicData();
    const [profile, setProfile] = useState(null);
    const todayStr = getTodayStr();

    useEffect(() => {
        setProfile(loadGameProfile());
    }, []);

    useEffect(() => {
        if (publicSectionStatus.games !== 'idle') return undefined;
        loadGamesCatalog().catch((error) => {
            console.error(error);
        });
        return undefined;
    }, [loadGamesCatalog, publicSectionStatus.games]);

    const loading = publicSectionStatus.games === 'loading' && (!Array.isArray(games) || games.length === 0);
    const decoratedGames = useMemo(() => sortGamesCatalog(Array.isArray(games) ? games : []).map((game) => ({
        ...game,
        dailyProgress: loadGameProgress(game.slug, todayStr),
    })), [games, todayStr]);

    return (
        <div className="min-h-screen bg-zn-paper comic-dots dark:bg-zinc-950 text-black dark:text-white pb-20 pt-10 relative">
            <EasterDecorations pageId="games" />
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end mb-12">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-wider mb-4 text-black dark:text-white font-display flex items-center gap-4">
                            <Gamepad2 className="w-10 h-10 md:w-14 md:h-14 text-zn-hot" />
                            zNews ИГРИ
                        </h1>
                        <p className="text-zn-comic-black dark:text-zinc-200 font-semibold text-lg max-w-2xl bg-white dark:bg-zinc-900 p-3 border-2 border-black dark:border-zinc-700 shadow-comic dark:shadow-none transform -rotate-1">
                            Тренирай ума си с ежедневни пъзели и новинарски тестове. Нови предизвикателства всяка сутрин!
                        </p>
                    </div>

                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-zn-hot" />
                    </div>
                ) : decoratedGames.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 border-4 border-black dark:border-zinc-700 shadow-comic dark:shadow-none transform rotate-1">
                        <p className="text-zn-comic-black dark:text-white font-display text-2xl uppercase tracking-widest">В момента няма активни игри.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                        {decoratedGames.map(game => (
                            <GamesHubCard
                                key={game.id}
                                game={game}
                                progress={game.dailyProgress}
                                streak={getGameStreak(profile, game.slug)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

