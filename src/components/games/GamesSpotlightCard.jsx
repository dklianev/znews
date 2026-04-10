import { Link } from 'react-router-dom';
import { ChevronRight, Flame } from 'lucide-react';
import { getGameIconComponent } from '../../utils/gameIcons';
import {
  getGameHubDescription,
  getGameProgressState,
  getGameStripeClass,
} from '../../utils/gamesCatalog';

export default function GamesSpotlightCard({ game, progress, streak }) {
  const Icon = getGameIconComponent(game.icon);
  const stripeClass = getGameStripeClass(game);
  const description = getGameHubDescription(game);
  const progressState = getGameProgressState(progress, streak);
  const ctaLabel = progressState.gameStatus === 'playing' ? 'ПРОДЪЛЖИ ОТТУК' : 'ИГРАЙ СЕГА';
  const streakLabel = Number(streak?.currentStreak) > 0
    ? `${streak.currentStreak} дни серия`
    : progressState.gameStatus === 'playing'
      ? 'Имаш започнат рунд'
      : 'Ново предизвикателство за днес';

  return (
    <div className="comic-panel comic-card-variant-flash comic-panel-hover comic-dots relative overflow-hidden bg-white dark:bg-zinc-900">
      <div className={`absolute inset-y-0 left-0 w-4 bg-gradient-to-b ${stripeClass}`} />

      <div className="relative z-10 flex flex-col gap-6 p-5 pl-8 md:flex-row md:items-center md:justify-between md:gap-8 md:p-7 md:pl-10">
        <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
          <div className="flex flex-col items-start gap-3 md:w-40 md:shrink-0">
            <span className="comic-kicker comic-kicker-flash">Следващо предизвикателство</span>
            <div className="inline-flex h-14 w-14 items-center justify-center border-3 border-black dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-comic dark:shadow-none">
              <Icon className="h-8 w-8 text-black dark:text-white" />
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-3xl font-display font-black uppercase leading-none tracking-[0.02em] text-black dark:text-white md:text-4xl">
              {game.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-relaxed text-zn-comic-black dark:text-zinc-200">
              {description}
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[220px] md:items-end">
          <div className="inline-flex items-center gap-2 self-start border-3 border-black dark:border-zinc-700 bg-[#FFF4C8] px-3 py-2 font-display text-xs font-black uppercase tracking-[0.18em] text-black shadow-comic dark:bg-zinc-950 dark:text-white md:self-auto">
            <Flame className="h-4 w-4 text-zn-hot" />
            {streakLabel}
          </div>

          <Link
            to={`/games/${game.slug}`}
            prefetch="intent"
            className="inline-flex items-center justify-center gap-2 border-3 border-black dark:border-zinc-700 bg-zn-hot px-5 py-3 text-center font-display text-base font-black uppercase tracking-[0.18em] text-black shadow-comic dark:shadow-none transition-all hover:-translate-y-0.5 hover:bg-zn-comic-yellow"
          >
            {ctaLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
