import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { getGameIconComponent } from '../../utils/gameIcons';
import {
  getGameProgressState,
  getGameStripeClass,
  getGameThemeVariant,
} from '../../utils/gamesCatalog';

export default function GamesCompactCard({ game, progress, streak }) {
  const Icon = getGameIconComponent(game.icon);
  const themeVariant = getGameThemeVariant(game);
  const stripeClass = getGameStripeClass(game);
  const progressState = getGameProgressState(progress, streak);
  const { isPlayedToday, isWonToday, hasActiveStreak } = progressState;

  return (
    <Link
      to={`/games/${game.slug}`}
      className={`group comic-panel comic-dots comic-panel-hover comic-card-variant-${themeVariant} bg-white dark:bg-zinc-900 relative block h-full overflow-visible`}
    >
      <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${stripeClass}`} />
      <span className="comic-card-tape comic-card-tape-right" />

      <div className="absolute -top-3 -right-2 z-30 flex flex-col items-end gap-2">
        {isPlayedToday && (
          <span className={`comic-sticker ${isWonToday ? 'comic-sticker-eco' : 'comic-sticker-underground'} shadow-sticker`}>
            {isWonToday ? 'ПОБЕДА' : 'ИЗИГРАНА'}
          </span>
        )}
        {hasActiveStreak && (
          <span className="comic-sticker comic-sticker-hot flex items-center gap-1 shadow-sticker">
            <Flame className="w-3 h-3" />
            {streak.currentStreak} ДНИ
          </span>
        )}
      </div>

      <div className="relative z-10 flex h-full flex-col border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 pt-8 shadow-comic dark:shadow-none">
        <div className="mb-4 inline-flex w-fit items-center justify-center border-3 border-black dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2.5 shadow-comic dark:shadow-none">
          <Icon className="h-6 w-6 text-black dark:text-white" />
        </div>

        <h3 className="mb-5 text-2xl font-display font-black uppercase leading-none tracking-[0.02em] text-black transition-colors group-hover:text-zn-hot dark:text-white">
          {game.title}
        </h3>

        <div className="mt-auto inline-flex items-center justify-center border-3 border-black dark:border-zinc-700 bg-zn-hot px-4 py-2 text-base font-display font-black uppercase tracking-[0.18em] text-black shadow-comic dark:shadow-none transition-all group-hover:-translate-y-0.5 group-hover:bg-zn-comic-yellow">
          {isPlayedToday ? 'ВИЖ ПАК' : 'ИГРАЙ'}
        </div>
      </div>
    </Link>
  );
}
