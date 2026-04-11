import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Flame, Gamepad2 } from 'lucide-react';
import { getGameIconComponent } from '../../utils/gameIcons';
import {
  getGameHubDescription,
  getGameProgressState,
  getGameStripeClass,
} from '../../utils/gamesCatalog';

function NextChallengeContent({ game, progress, streak }) {
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
      <div className={`absolute inset-y-0 left-0 w-3 bg-gradient-to-b ${stripeClass}`} />

      <div className="relative z-10 flex flex-col gap-4 p-4 pl-7 md:flex-row md:items-center md:justify-between md:gap-6 md:p-5 md:pl-9">
        <div className="flex flex-1 flex-col gap-2">
          <span className="comic-kicker comic-kicker-flash">Следващо предизвикателство</span>
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-white shadow-comic dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-none">
              <Icon className="h-5 w-5 text-black dark:text-white" />
            </div>
            <h2 className="text-2xl font-display font-black uppercase leading-none tracking-[0.02em] text-black dark:text-white md:text-3xl">
              {game.title}
            </h2>
          </div>
          <p className="max-w-xl text-sm font-semibold leading-snug text-zn-comic-black dark:text-zinc-300">
            {description}
          </p>
        </div>

        <div className="flex items-center gap-3 md:shrink-0">
          <div className="inline-flex items-center gap-1.5 border-2 border-black bg-[#FFF4C8] px-2.5 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.16em] text-black shadow-comic dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:shadow-none">
            <Flame className="h-3.5 w-3.5 text-zn-hot" />
            {streakLabel}
          </div>

          <Link
            to={`/games/${game.slug}`}
            className="inline-flex items-center justify-center gap-1.5 border-3 border-black bg-zn-hot px-4 py-2.5 text-center font-display text-sm font-black uppercase tracking-[0.18em] text-black shadow-comic transition-all hover:-translate-y-0.5 hover:bg-zn-comic-yellow dark:border-zinc-700 dark:shadow-none"
          >
            {ctaLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function CompletedContent({ onFilterArcade }) {
  return (
    <div className="comic-panel comic-card-variant-eco comic-dots relative overflow-hidden bg-white dark:bg-zinc-900">
      <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-b from-emerald-500 to-emerald-700" />

      <div className="relative z-10 flex flex-col gap-4 p-4 pl-7 md:flex-row md:items-center md:justify-between md:gap-6 md:p-5 md:pl-9">
        <div className="flex flex-1 flex-col gap-2">
          <span className="comic-kicker comic-kicker-flash">Дневен прогрес</span>
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-2 border-emerald-600 bg-emerald-50 shadow-comic dark:border-emerald-500 dark:bg-emerald-950/60 dark:shadow-none">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-display font-black uppercase leading-none tracking-[0.02em] text-black dark:text-white md:text-3xl">
              Днешните игри са приключени
            </h2>
          </div>
          <p className="max-w-xl text-sm font-semibold leading-snug text-zn-comic-black dark:text-zinc-300">
            Днешните предизвикателства са отметнати. Разпусни с аркадна игра или се върни утре за новия набор.
          </p>
        </div>

        <div className="flex items-center gap-3 md:shrink-0">
          <div className="inline-flex items-center gap-1.5 border-2 border-emerald-600 bg-emerald-50 px-2.5 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800 shadow-comic dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200 dark:shadow-none">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Всичко изиграно
          </div>

          <button
            type="button"
            onClick={onFilterArcade}
            className="inline-flex items-center justify-center gap-1.5 border-3 border-black bg-zn-purple px-4 py-2.5 text-center font-display text-sm font-black uppercase tracking-[0.18em] text-white shadow-comic transition-all hover:-translate-y-0.5 hover:bg-zn-purple-dark dark:border-zinc-700 dark:shadow-none"
          >
            <Gamepad2 className="h-4 w-4" />
            Към аркадните
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GamesSpotlightCard({ game, progress, streak, mode = 'next', onFilterArcade }) {
  if (mode === 'complete') {
    return <CompletedContent onFilterArcade={onFilterArcade} />;
  }
  return <NextChallengeContent game={game} progress={progress} streak={streak} />;
}
