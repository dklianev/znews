import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { loadGameProfile, loadGameProgress } from '../utils/gameStorage';
import { getTodayStr } from '../utils/gameDate';
import GamesHubCard from '../components/games/GamesHubCard';
import { Gamepad2, Trophy, Loader2 } from 'lucide-react';

export default function GamesPage() {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const todayStr = getTodayStr();

    useEffect(() => {
        // Load local profile
        setProfile(loadGameProfile());

        // Fetch live games
        api.games.getAll()
            .then(data => {
                const items = Array.isArray(data) ? data : [];
                setGames(items.map((game) => ({
                    ...game,
                    dailyProgress: loadGameProgress(game.slug, todayStr),
                })));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [todayStr]);

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-20 pt-10">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end mb-12">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 text-white font-condensed flex items-center gap-4">
                            <Gamepad2 className="w-10 h-10 md:w-14 md:h-14 text-red-500" />
                            zNews Игри
                        </h1>
                        <p className="text-zinc-400 text-lg max-w-2xl">
                            Тренирай ума си с ежедневни пъзели и новинарски тестове. Нови предизвикателства всяка сутрин!
                        </p>
                    </div>

                    {profile && profile.currentStreak > 0 && (
                        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-lg shrink-0">
                            <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center">
                                <Trophy className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Текуща серия</p>
                                <p className="text-2xl font-black font-condensed">{profile.currentStreak} <span className="text-orange-500 text-base">ДНИ</span></p>
                            </div>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-zinc-500" />
                    </div>
                ) : games.length === 0 ? (
                    <div className="text-center py-20 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                        <p className="text-zinc-400">В момента няма активни игри.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {games.map(game => (
                            <GamesHubCard key={game.id} game={game} progress={game.dailyProgress} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
