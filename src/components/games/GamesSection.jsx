import GamesCompactCard from './GamesCompactCard';

export default function GamesSection({ title, variant = 'purple', games }) {
  const safeGames = Array.isArray(games) ? games : [];
  if (safeGames.length === 0) return null;

  const bannerClass = variant === 'gold' ? 'headline-banner-gold' : 'headline-banner-purple';

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <span className={bannerClass}>{title} ({safeGames.length})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {safeGames.map((game) => (
          <GamesCompactCard
            key={game.id}
            game={game}
            progress={game.dailyProgress}
            streak={game.streak}
          />
        ))}
      </div>
    </section>
  );
}
