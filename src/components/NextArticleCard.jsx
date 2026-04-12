import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ResponsiveImage from './ResponsiveImage';

export default function NextArticleCard({
  article,
  category,
  categoryClassName,
  formattedDate,
}) {
  if (!article) return null;

  return (
    <section className="mt-8 mb-8" aria-label="Следваща статия">
      <Link
        to={`/article/${article.id}`}
        className="group block newspaper-page comic-panel comic-dots comic-panel-hover relative overflow-hidden px-4 py-4 md:px-5"
        aria-label={`Отвори следващата статия "${article.title}"`}
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-zn-hot via-zn-orange to-zn-purple opacity-80" />

        <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
          <span className="headline-banner-hot text-[10px] sm:text-xs">СЛЕДВАЩА СТАТИЯ</span>
          {category ? (
            <span
              className={`px-2 py-0.5 text-[10px] sm:text-[11px] font-display font-bold uppercase tracking-[0.14em] ${categoryClassName}`}
            >
              {category.name}
            </span>
          ) : null}
          {formattedDate ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-display font-black uppercase tracking-[0.16em] text-zn-text/55 dark:text-zn-bg/60">
              {formattedDate}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-[148px_minmax(0,1fr)] md:items-center">
          <div className="relative overflow-hidden rounded-[2px] border-3 border-[#1C1428] bg-white dark:border-[#524a62] dark:bg-zinc-950">
            {article.image ? (
              <ResponsiveImage
                src={article.image}
                pipeline={article.imageMeta}
                alt={article.title}
                loading="lazy"
                decoding="async"
                sizes="(max-width: 768px) 100vw, 148px"
                className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] md:h-24"
                pictureClassName="block"
              />
            ) : (
              <div className="flex h-28 items-center justify-center bg-linear-to-br from-zn-hot/10 via-white to-zn-orange/10 text-center md:h-24 dark:from-zn-hot/18 dark:via-zinc-950 dark:to-zn-purple/18">
                <span className="px-3 text-xs font-display font-black uppercase tracking-[0.14em] text-zn-text/70 dark:text-zn-bg/80">
                  ОЩЕ ЕДНА ГОРЕЩА ИСТОРИЯ
                </span>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="line-clamp-3 font-display text-xl md:text-[1.65rem] font-black uppercase leading-[1.08] tracking-[0.02em] text-zn-text transition-colors group-hover:text-zn-hot dark:text-zn-bg dark:group-hover:text-zn-gold">
              {article.title}
            </h2>

            {article.excerpt ? (
              <p className="mt-2 line-clamp-2 max-w-3xl font-sans text-sm leading-relaxed text-zn-text/78 dark:text-zn-bg/72">
                {article.excerpt}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border-3 border-[#1C1428] bg-linear-to-r from-zn-purple to-zn-purple-light px-4 py-2 text-xs font-display font-black uppercase tracking-[0.14em] text-white shadow-[3px_3px_0_#3a0f5c] transition-transform duration-200 group-hover:-translate-y-0.5 dark:border-[#524a62] dark:shadow-[3px_3px_0_#0a0812]">
                ЧЕТИ СЛЕДВАЩАТА
                <ChevronRight className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-zn-text/42 dark:text-zn-bg/46">
                Продължи нататък
              </span>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}
