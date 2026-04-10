import { Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGameIconComponent } from '../../utils/gameIcons';
import { getGameProgressState } from '../../utils/gamesCatalog';

export default function GamesProgressBar({ games }) {
  const safeGames = Array.isArray(games) ? games : [];
  if (safeGames.length === 0) return null;

  const completedCount = safeGames.filter((game) => getGameProgressState(game.dailyProgress, game.streak).isPlayedToday).length;

  return (
    <section className="comic-panel comic-dots relative overflow-hidden bg-white p-4 dark:bg-zinc-900 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="comic-kicker mb-2">Дневен прогрес</p>
          <h2 className="text-2xl font-display font-black uppercase tracking-[0.02em] text-black dark:text-white md:text-3xl">
            {completedCount}/{safeGames.length} завършени днес
          </h2>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {safeGames.map((game) => {
            const Icon = getGameIconComponent(game.icon);
            const progressState = getGameProgressState(game.dailyProgress, game.streak);
            const pillClass = progressState.isWonToday
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100'
              : progressState.isLostToday
                ? 'border-zn-hot bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-100'
                : 'border-black bg-white text-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-white';

            return (
              <Link
                key={game.slug}
                to={`/games/${game.slug}`}
                prefetch="intent"
                className={`inline-flex items-center gap-2 border-3 px-3 py-2 font-display text-xs font-black uppercase tracking-[0.14em] shadow-comic transition-all hover:-translate-y-0.5 dark:shadow-none ${pillClass}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="max-w-[180px] leading-none">{game.title}</span>
                {progressState.isPlayedToday ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
