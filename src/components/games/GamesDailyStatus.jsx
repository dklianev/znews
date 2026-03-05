import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { loadGameProgress } from '../../utils/gameStorage';
import { getTodayStr } from '../../utils/gameDate';
import { Link } from 'react-router-dom';
import { Gamepad2, ChevronRight, Check } from 'lucide-react';
import { getGameIconComponent } from '../../utils/gameIcons';
import { ensureSudokuGameList } from '../../utils/gamesCatalog';

export default function GamesDailyStatus() {
    const [games, setGames] = useState([]);

    useEffect(() => {
        // Light client-side fetch for the active games
        api.games.getAll().then(data => {
            const todayStr = getTodayStr();
            const decorated = ensureSudokuGameList(Array.isArray(data) ? data : []).map(g => {
                const progress = loadGameProgress(g.slug, todayStr);
                const gameStatus = progress?.gameStatus || '';
                return {
                    ...g,
                    isPlayed: Boolean(progress) && gameStatus !== 'playing',
                    isWon: gameStatus === 'won',
                    isLost: gameStatus === 'lost',
                };
            });
            setGames(decorated);
        }).catch((error) => {
            console.error(error);
            const decorated = ensureSudokuGameList([]).map((g) => ({
                ...g,
                isPlayed: false,
                isWon: false,
                isLost: false,
            }));
            setGames(decorated);
        });
    }, []);

    if (games.length === 0) return null;

    return (
        <div className="comic-panel comic-dots bg-white dark:bg-zinc-900 border-2 border-zn-black dark:border-zinc-700 rounded-lg overflow-hidden flex flex-col md:flex-row mt-4 mb-2">
            <Link
                to="/games"
                className="bg-zn-purple md:w-1/3 p-4 flex flex-col justify-center items-center text-center group transition-colors hover:bg-zn-purple-dark text-white border-b-2 md:border-b-0 md:border-r-2 border-zn-black"
            >
                <Gamepad2 className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform drop-shadow" />
                <h3 className="font-comic uppercase text-2xl tracking-widest leading-none drop-shadow">zNews Игри</h3>
                <p className="text-white/80 text-[10px] font-display uppercase tracking-[0.2em] font-bold mt-2">Ежедневни Предизвикателства</p>
            </Link>
            <div className="flex-1 p-4 flex flex-col justify-center bg-[#F5EEDF] dark:bg-zinc-950">
                <div className="flex flex-wrap gap-2">
                    {games.map(g => {
                        const Icon = getGameIconComponent(g.icon);
                        const borderClass = g.isWon
                            ? 'border-emerald-600 bg-emerald-50'
                            : g.isLost
                                ? 'border-red-600 bg-red-50'
                                : g.isPlayed
                                    ? 'border-sky-600 bg-sky-50'
                                    : 'border-zn-black dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zn-bg-warm dark:hover:bg-zinc-800 hover:-translate-y-0.5';

                        return (
                            <Link
                                key={g.slug}
                                to={`/games/${g.slug}`}
                                className={`flex-1 min-w-[140px] flex items-center justify-between p-3 rounded shadow-[2px_2px_0_rgba(0,0,0,1)] border-2 transition-transform ${borderClass}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="w-5 h-5 text-zn-black dark:text-white shrink-0" />
                                    <span className="text-sm font-display font-black text-zn-black dark:text-white tracking-wide uppercase">{g.title}</span>
                                </div>
                                {g.isPlayed ? (
                                    <Check className={`w-5 h-5 ${g.isWon ? 'text-emerald-600' : g.isLost ? 'text-red-500' : 'text-sky-600'}`} />
                                ) : (
                                    <ChevronRight className="w-5 h-5 text-zn-text-dim dark:text-zinc-500" />
                                )}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}

