import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gamepad2, Loader2 } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import EasterDecorations from '../components/seasonal/EasterDecorations';
import GamesProgressBar from '../components/games/GamesProgressBar';
import GamesSection from '../components/games/GamesSection';
import GamesSpotlightCard from '../components/games/GamesSpotlightCard';
import { getTodayStr } from '../utils/gameDate';
import { getGameStreak, loadGameProfile, loadGameProgress } from '../utils/gameStorage';
import { GAME_GROUPS, getDailyGames, getGameGroup, sortGamesCatalog } from '../utils/gamesCatalog';

export default function GamesPage() {
    const { games, publicSectionStatus, loadGamesCatalog } = usePublicData();
    const [profile, setProfile] = useState(null);
    const [filter, setFilter] = useState('all');
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
        streak: getGameStreak(profile, game.slug),
    })), [games, profile, todayStr]);

    const puzzleGames = useMemo(() => decoratedGames.filter((game) => getGameGroup(game) === 'puzzles'), [decoratedGames]);
    const arcadeGames = useMemo(() => decoratedGames.filter((game) => getGameGroup(game) === 'arcade'), [decoratedGames]);
    const dailyGames = useMemo(() => getDailyGames(decoratedGames), [decoratedGames]);

    const firstUnplayed = useMemo(() => dailyGames.find((game) => {
        const gameStatus = game.dailyProgress?.gameStatus || '';
        return !game.dailyProgress || gameStatus === 'playing';
    }) || null, [dailyGames]);

    const arcadeSectionRef = useRef(null);

    const handleFilterArcade = useCallback(() => {
        setFilter('arcade');
        requestAnimationFrame(() => {
            arcadeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, []);

    const countsByFilter = useMemo(() => ({
        all: decoratedGames.length,
        puzzles: puzzleGames.length,
        arcade: arcadeGames.length,
    }), [arcadeGames.length, decoratedGames.length, puzzleGames.length]);

    return (
        <div className="relative min-h-screen bg-zn-paper pb-20 pt-10 text-black comic-dots dark:bg-zinc-950 dark:text-white">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="relative mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
                    <EasterDecorations pageId="games" />
                    <div>
                        <h1 className="flex items-center gap-4 font-display text-4xl font-black uppercase tracking-wider text-black dark:text-white md:text-6xl">
                            <Gamepad2 className="h-10 w-10 text-zn-hot md:h-14 md:w-14" />
                            zNews ИГРИ
                        </h1>
                        <p className="mt-4 max-w-2xl -rotate-1 border-2 border-black bg-white p-3 text-lg font-semibold text-zn-comic-black shadow-comic dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-none">
                            Тренирай ума си с ежедневни пъзели и аркадни игри. Избери следващото предизвикателство и следи как върви прогресът ти.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-zn-hot" />
                    </div>
                ) : decoratedGames.length === 0 ? (
                    <div className="rotate-1 border-4 border-black bg-white py-20 text-center shadow-comic dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none">
                        <p className="font-display text-2xl font-black uppercase tracking-widest text-zn-comic-black dark:text-white">В момента няма активни игри.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <section className="comic-panel comic-dots flex flex-col gap-3 bg-white p-3 dark:bg-zinc-900 md:flex-row md:items-center md:justify-between md:p-4">
                            <GamesProgressBar games={dailyGames} />
                            <div className="flex flex-wrap gap-2">
                                {GAME_GROUPS.map((group) => {
                                    const isActive = filter === group.key;
                                    return (
                                        <button
                                            key={group.key}
                                            type="button"
                                            onClick={() => setFilter(group.key)}
                                            className={`border-2 px-3 py-1.5 font-display text-xs font-black uppercase tracking-[0.16em] transition-all ${
                                                isActive
                                                    ? 'border-black bg-zn-purple text-white shadow-comic dark:border-zinc-700 dark:shadow-none'
                                                    : 'border-black bg-white text-zn-comic-black shadow-comic hover:-translate-y-0.5 hover:bg-zn-bg dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:shadow-none dark:hover:bg-zinc-800'
                                            }`}
                                            aria-pressed={isActive}
                                        >
                                            {group.label} ({countsByFilter[group.key] || 0})
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {filter === 'all' && firstUnplayed && (
                            <GamesSpotlightCard
                                game={firstUnplayed}
                                progress={firstUnplayed.dailyProgress}
                                streak={firstUnplayed.streak}
                            />
                        )}

                        {filter === 'all' && !firstUnplayed && dailyGames.length > 0 && (
                            <GamesSpotlightCard
                                mode="complete"
                                dailyCount={dailyGames.length}
                                onFilterArcade={handleFilterArcade}
                            />
                        )}

                        {(filter === 'all' || filter === 'puzzles') && (
                            <GamesSection title="Пъзели" variant="purple" games={puzzleGames} />
                        )}

                        <div ref={arcadeSectionRef}>
                            {(filter === 'all' || filter === 'arcade') && (
                                <GamesSection title="Аркадни" variant="gold" games={arcadeGames} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
