import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ChevronRight, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePublicData } from '../context/DataContext';
import HeroSection from './HeroSection';
import ResponsiveImage from './ResponsiveImage';
import { formatNewsDate } from '../utils/newsDate';

const fallbackImg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" fill="%23EDE6DA"><rect width="800" height="450"/><text x="400" y="225" text-anchor="middle" font-family="Oswald,sans-serif" font-size="26" font-weight="900" fill="%23C4B49A">ZNEWS</text></svg>');
const DEFAULT_HERO_SETTINGS = {
  headline: 'ТАЙНИ СРЕЩИ НА ПЛАЖА\nИ ПАРКА!',
  shockLabel: 'ШОК!',
  ctaLabel: 'РАЗКРИЙ ВСИЧКО ТУК!',
  heroTitleScale: 100,
  captions: ['В КОЛАТА НА ПОЛИЦАЯ!', 'ГОРЕЩА ПРЕГРЪДКА!', 'ТАЙНА СРЕЩА В ПАРКА!'],
  mainPhotoArticleId: null,
  photoArticleIds: [],
};

function ArticleCard({ article, size = 'normal', siblingArticles = [], heroPhotoArticle = null }) {
  const { authors, categories, heroSettings, siteSettings } = usePublicData();

  if (!article || typeof article !== 'object') return null;

  const articleId = Number(article.id);
  if (!Number.isFinite(articleId) || articleId <= 0) return null;

  const author = (Array.isArray(authors) ? authors : []).find(a => a.id === article.authorId);
  const category = (Array.isArray(categories) ? categories : []).find(c => c.id === article.category);
  const tilt = ((String(article.id || '').charCodeAt(0) || 0) % 5) - 2;
  const breakingBadgeLabel = typeof siteSettings?.breakingBadgeLabel === 'string' && siteSettings.breakingBadgeLabel.trim()
    ? siteSettings.breakingBadgeLabel.trim()
    : 'ГОРЕЩО!';

  /* ══════════════════════════════════════
     HERO — delegates to HeroSection component
     ══════════════════════════════════════ */
  if (size === 'hero') {
    const resolvedHeroSettings = {
      ...DEFAULT_HERO_SETTINGS,
      ...(heroSettings || {}),
      captions: Array.isArray(heroSettings?.captions) && heroSettings.captions.length === 3
        ? heroSettings.captions
        : DEFAULT_HERO_SETTINGS.captions,
    };
    return (
      <HeroSection
        article={article}
        author={author}
        category={category}
        heroPhotoArticle={heroPhotoArticle}
        siblingArticles={siblingArticles}
        heroSettings={resolvedHeroSettings}
        fallbackImg={fallbackImg}
      />
    );
  }

  /* ══════════════════════════════════════
     FEATURED — Polaroid card with tape
     Thick white border, visible rotation
     ══════════════════════════════════════ */
  if (size === 'featured') {
    return (
      <Link
        to={`/article/${article.id}`}
        prefetch="intent"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F3EA]"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="polaroid-thick group cursor-pointer h-full comic-panel-hover"
          style={{ '--tilt': `${tilt}deg` }}
        >
          <div className="tape tape-tl" />
          {/* Photo area */}
          <div className="relative overflow-hidden" style={{ height: '200px' }}>
            <ResponsiveImage
              src={article.image}
              pipeline={article.imageMeta}
              fallbackSrc={fallbackImg}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              pictureClassName="block w-full h-full"
              sizes="(max-width: 768px) 100vw, 33vw"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {article.breaking && (
              <span className="absolute top-2 left-2 breaking-badge text-[9px] flex items-center gap-1">
                <Flame className="w-2.5 h-2.5" /> {breakingBadgeLabel}
              </span>
            )}
            {article.sponsored && (
              <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[9px] font-display font-black uppercase tracking-wider px-2 py-0.5 border border-emerald-800 shadow-sm">
                Платена
              </span>
            )}
            {/* Red caption banner on photo */}
            <div className="photo-caption">
              {category?.name || 'НОВИНА'}
            </div>
          </div>

          <div className="pt-3">
            <h3 className="font-display font-black text-base text-zn-black mb-1 group-hover:text-zn-hot transition-colors line-clamp-2 leading-tight uppercase text-balance">
              {article.title}
            </h3>
            <p className="text-zn-text-muted text-sm mb-2 line-clamp-2 italic font-sans">{article.excerpt}</p>
            <div className="flex items-center justify-between text-xs font-display text-zn-text-dim border-t-2 border-zn-border/50 pt-2 uppercase tracking-wider">
              <span className="normal-case">{formatNewsDate(article.date)}</span>
              <span className="flex items-center gap-1 text-zn-hot font-black"><Eye className="w-3 h-3" />{(article.views || 0).toLocaleString()}</span>
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  /* ══════════════════════════════════════
     NORMAL — Horizontal card with
     polaroid-like padding and tape
     ══════════════════════════════════════ */
  return (
    <Link
      to={`/article/${article.id}`}
      prefetch="intent"
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F3EA]"
    >
      <motion.div
        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
        className="comic-story-card overflow-visible group cursor-pointer flex flex-col sm:flex-row"
      >
        {/* Photo with white border frame */}
        <div className="relative sm:w-56 md:w-64 h-44 sm:h-auto shrink-0 p-2 sm:pr-0">
          <div className="h-full overflow-hidden relative bg-white" style={{ border: '2px solid #e0d5c5' }}>
            <ResponsiveImage
              src={article.image}
              pipeline={article.imageMeta}
              fallbackSrc={fallbackImg}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              pictureClassName="block w-full h-full"
              sizes="(max-width: 640px) 100vw, 320px"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
          {article.breaking && (
            <span className="absolute top-4 left-4 breaking-badge text-[9px] flex items-center gap-1">
              <Flame className="w-2.5 h-2.5" /> {breakingBadgeLabel}
            </span>
          )}
          {article.sponsored && (
            <span className="absolute top-4 right-4 bg-emerald-600 text-white text-[9px] font-display font-black uppercase tracking-wider px-2 py-0.5 border border-emerald-800 shadow-sm z-10">
              Платена
            </span>
          )}
          {/* Tape strip */}
          <div className="absolute -top-1 left-6 w-12 h-5 bg-yellow-200/70 border border-black/5 transform -rotate-6 z-10" style={{ boxShadow: '1px 1px 3px rgba(0,0,0,0.12)' }} />
        </div>

        <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
          <div>
            {category && (
              <span className="comic-kicker mb-1">
                {category.name}
              </span>
            )}
            <h3 className="font-display font-black text-lg mt-1 mb-2 group-hover:text-zn-hot transition-colors duration-300 line-clamp-2 text-zn-black leading-snug uppercase text-balance">
              {article.title}
            </h3>
            <p className="text-sm text-zn-text-muted line-clamp-2 italic font-sans">{article.excerpt}</p>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2.5 border-t-2 border-zn-border/50 text-xs font-display text-zn-text-dim uppercase tracking-wider">
            <div className="flex items-center gap-3">
              {author && <span className="font-black text-zn-hot">{author.name}</span>}
              <span className="normal-case">{formatNewsDate(article.date)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{(article.views || 0).toLocaleString()}</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-zn-hot" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default memo(ArticleCard);
