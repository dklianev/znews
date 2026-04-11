import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGameIconComponent } from '../../utils/gameIcons';
import { getGameProgressState } from '../../utils/gamesCatalog';

export default function GamesProgressBar({ games }) {
  const safeGames = Array.isArray(games) ? games : [];
  if (safeGames.length === 0) return null;

  const completedCount = safeGames.filter((game) => getGameProgressState(game.dailyProgress, game.streak).isPlayedToday).length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        {safeGames.map((game) => {
          const Icon = getGameIconComponent(game.icon);
          const progressState = getGameProgressState(game.dailyProgress, game.streak);
          const dotClass = progressState.isWonToday
            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
            : progressState.isLostToday
              ? 'border-zn-hot bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200'
              : 'border-black bg-white text-black dark:border-zinc-600 dark:bg-zinc-900 dark:text-white';

          return (
            <Link
              key={game.slug}
              to={`/games/${game.slug}`}
              title={game.title}
              className={`relative inline-flex h-9 w-9 items-center justify-center border-2 transition-all hover:-translate-y-0.5 hover:shadow-comic ${dotClass}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {progressState.isPlayedToday && (
                <Check className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border border-white bg-emerald-500 p-0.5 text-white dark:border-zinc-900" />
              )}
            </Link>
          );
        })}
      </div>
      <span className="font-display text-sm font-black tracking-wider text-zn-comic-black dark:text-zinc-300">
        {completedCount}/{safeGames.length}
      </span>
    </div>
  );
}
