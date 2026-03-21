import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Phone, Mail, FileText, Eye, Clock, ChevronRight, Newspaper, BarChart3, Flame } from 'lucide-react';
import TrendingSidebar from '../components/TrendingSidebar';
import AdSlot from '../components/ads/AdSlot';
import { usePublicData } from '../context/DataContext';
import ResponsiveImage from '../components/ResponsiveImage';
import { api } from '../utils/api';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import { formatNewsDate } from '../utils/newsDate';

const PER_PAGE = 12;
const AUTHOR_LIST_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,sponsored,hero,views,tags,status,publishAt,reactions';

const AVATAR_COLORS = [
  '#CC0A1A', '#5B1A8C', '#1565C0', '#00838F', '#2E7D32', '#E65100',
  '#AD1457', '#4527A0', '#0277BD', '#00695C', '#558B2F', '#BF360C',
];

function getAvatarColor(id) {
  return AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];
}

function formatCount(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const EMPTY_STATS = { totalViews: 0, totalReactions: 0, categoryCount: 0 };

/* ─── Skeleton ─── */
function HeroSkeleton() {
  return (
    <div className="newspaper-page comic-panel comic-dots relative overflow-hidden animate-pulse" aria-hidden="true">
      <div className="flex flex-col md:flex-row gap-6 p-6 md:p-8">
        <div className="w-36 h-36 md:w-44 md:h-44 bg-zn-text/10 border-3 border-[#1C1428] flex-shrink-0 mx-auto md:mx-0" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-24 bg-zn-hot/20 rounded" />
          <div className="h-8 w-3/4 bg-zn-text/10 rounded" />
          <div className="h-4 w-1/3 bg-zn-text/10 rounded" />
          <div className="h-1 w-full bg-zn-text/5 my-3" />
          <div className="h-3 w-full bg-zn-text/10 rounded" />
          <div className="h-3 w-5/6 bg-zn-text/10 rounded" />
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="comic-latest-card comic-panel comic-dots bg-white overflow-visible relative block h-full animate-pulse" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-zn-hot/30 to-zn-orange/30" />
      <div className="relative overflow-hidden aspect-[16/9]">
        <div className="w-full h-full bg-zn-text/10" />
      </div>
      <div className="flex flex-col justify-between p-3 gap-2">
        <div className="space-y-2">
          <div className="h-5 w-11/12 bg-zn-text/10 rounded" />
          <div className="h-5 w-9/12 bg-zn-text/10 rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-full bg-zn-text/10 rounded" />
          <div className="h-3 w-4/5 bg-zn-text/10 rounded" />
        </div>
        <div className="flex items-center justify-between border-t-2 border-zn-border/50 pt-2">
          <div className="h-3 w-24 bg-zn-text/10 rounded" />
          <div className="h-3 w-12 bg-zn-text/10 rounded" />
        </div>
      </div>
    </div>
  );
}

/* ─── Hero Block ─── */
function AuthorHero({ author, totalArticles, stats }) {
  const avatarColor = getAvatarColor(author.id);

  const facts = [
    { icon: FileText, label: 'Публикации', value: totalArticles, color: 'text-zn-hot' },
    { icon: Eye, label: 'Четения', value: formatCount(stats.totalViews), color: 'text-zn-purple' },
    { icon: Flame, label: 'Реакции', value: formatCount(stats.totalReactions), color: 'text-orange-500' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="newspaper-page comic-panel comic-dots relative overflow-visible"
    >
      {/* Corner tape */}
      <div className="tape-deco absolute -top-2 right-8 w-14 h-4 bg-yellow-200/70 dark:bg-yellow-700/30 border border-black/5 dark:border-yellow-600/20 transform rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />

      {/* Speed lines background accent */}
      <div className="absolute top-0 right-0 w-1/3 h-full comic-speed-lines opacity-[0.04] pointer-events-none z-0" />

      <div className="relative z-[2] flex flex-col md:flex-row gap-6 p-6 md:p-8">
        {/* Avatar — large, with comic treatment */}
        <div className="flex-shrink-0 mx-auto md:mx-0">
          <div className="relative">
            {author.avatarImage ? (
              <div style={{ transform: 'rotate(-2deg)' }}>
                <div
                  className="w-36 h-36 md:w-44 md:h-44 overflow-hidden border-3 border-[#1C1428]"
                  style={{ boxShadow: '6px 6px 0 #1C1428' }}
                >
                  <img
                    src={author.avatarImage}
                    alt={author.name}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: author.avatarImageMeta?.objectPosition || '50% 50%',
                      transform: author.avatarImageMeta?.objectScale ? `scale(${author.avatarImageMeta.objectScale})` : undefined,
                      transformOrigin: author.avatarImageMeta?.objectPosition || '50% 50%',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                className="w-36 h-36 md:w-44 md:h-44 flex items-center justify-center border-3 border-[#1C1428]"
                style={{ backgroundColor: avatarColor, boxShadow: '6px 6px 0 #1C1428', transform: 'rotate(-2deg)' }}
              >
                <span className="text-white font-display font-black text-6xl md:text-7xl select-none">
                  {author.avatar && author.avatar !== '👤' ? author.avatar : author.name?.charAt(0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left min-w-0">
          {/* Kicker */}
          <span className="inline-block font-display text-[10px] font-bold uppercase tracking-[0.25em] text-zn-hot mb-1">
            Биография
          </span>

          {/* Name */}
          <h1 className="font-display font-black text-3xl md:text-4xl lg:text-5xl text-zn-text dark:text-white tracking-wider uppercase leading-none mb-2" style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.1)' }}>
            {author.name}
          </h1>

          {/* Gradient stripe */}
          <div className="h-1.5 bg-gradient-to-r from-zn-hot via-zn-orange to-zn-hot/30 mb-4 max-w-xs mx-auto md:mx-0" />

          {/* Bio */}
          {author.bio && (
            <p className="font-body text-sm md:text-base text-zn-text-muted dark:text-zinc-400 leading-relaxed mb-4 max-w-xl">
              {author.bio}
            </p>
          )}

          {/* Contact row */}
          {(author.phone || author.email) && (
            <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-4">
              {author.phone && (
                <a
                  href={`tel:${author.phone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-display uppercase tracking-wider text-zn-text dark:text-zinc-300 hover:text-zn-hot transition-colors bg-white/50 dark:bg-zinc-800/50 px-3 py-1.5 border border-zn-border/50 dark:border-zinc-700"
                >
                  <Phone className="w-3 h-3 text-zn-hot" />
                  {author.phone}
                </a>
              )}
              {author.email && (
                <a
                  href={`mailto:${author.email}`}
                  className="inline-flex items-center gap-1.5 text-xs font-display uppercase tracking-wider text-zn-text dark:text-zinc-300 hover:text-zn-purple transition-colors bg-white/50 dark:bg-zinc-800/50 px-3 py-1.5 border border-zn-border/50 dark:border-zinc-700"
                >
                  <Mail className="w-3 h-3 text-zn-purple" />
                  {author.email}
                </a>
              )}
            </div>
          )}

          {/* Facts strip */}
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="comic-panel bg-white dark:bg-zinc-900 px-4 py-2.5 flex items-center gap-2"
              >
                <fact.icon className={`w-4 h-4 ${fact.color}`} />
                <div className="text-left">
                  <span className="block text-lg font-display font-black text-zn-text dark:text-white leading-none">
                    {fact.value}
                  </span>
                  <span className="block text-[9px] font-display uppercase tracking-[0.2em] text-zn-text-dim dark:text-zinc-500">
                    {fact.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Stats Strip ─── */
function StatsStrip({ totalArticles, stats, categories }) {
  const items = [
    { icon: Newspaper, label: 'Статии', value: totalArticles, accent: 'bg-zn-hot' },
    { icon: Eye, label: 'Общо четения', value: formatCount(stats.totalViews), accent: 'bg-zn-purple' },
    { icon: BarChart3, label: 'Категории', value: stats.categoryCount, accent: 'bg-emerald-500' },
    { icon: Flame, label: 'Реакции', value: formatCount(stats.totalReactions), accent: 'bg-orange-500' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {items.map((item) => (
        <div key={item.label} className="comic-panel bg-white dark:bg-zinc-900 comic-dots p-3 text-center relative overflow-hidden">
          <div className={`absolute top-0 inset-x-0 h-1 ${item.accent}`} />
          <item.icon className="w-5 h-5 mx-auto mb-1 text-zn-text-dim dark:text-zinc-500 relative z-[2]" />
          <p className="text-xl md:text-2xl font-display font-black text-zn-text dark:text-white leading-none relative z-[2]">
            {item.value}
          </p>
          <span className="text-[8px] font-display uppercase tracking-[0.2em] text-zn-text-dim dark:text-zinc-500 relative z-[2]">
            {item.label}
          </span>
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Featured Article (hero treatment for latest) ─── */
function FeaturedArticle({ article, categories }) {
  const categoryName = categories.find((c) => c.id === article.category)?.name || 'Новини';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
    >
      <Link
        to={`/article/${article.id}`}
        className="group block newspaper-page comic-panel comic-dots relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row md:items-stretch">
          {/* Image — left/top */}
          <div className="relative md:w-1/2 overflow-hidden md:self-stretch md:flex">
            <div className="aspect-[16/10] md:aspect-auto md:flex-1 min-h-[240px]">
              {article.image ? (
                <ResponsiveImage
                  src={article.image}
                  alt={article.title}
                  pictureClassName="block w-full h-full"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  style={{
                    objectPosition: article.imageMeta?.objectPosition || '50% 50%',
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zn-hot/10 to-zn-purple/10 flex items-center justify-center min-h-[200px]">
                  <Newspaper className="w-16 h-16 text-zn-text/10" />
                </div>
              )}
            </div>
            {/* Category kicker */}
            <div className="absolute top-3 left-3 z-10">
              <span
                className="font-display font-black text-[10px] uppercase tracking-[0.2em] text-[#1C1428] px-2.5 py-1 bg-gradient-to-r from-yellow-300 to-yellow-400 border-2 border-[#1C1428]"
                style={{ boxShadow: '2px 2px 0 #1C1428' }}
              >
                {categoryName}
              </span>
            </div>
            {/* "Най-ново" badge */}
            <div className="absolute top-3 right-3 z-10">
              <span
                className="font-display font-black text-[9px] uppercase tracking-[0.15em] text-white px-2 py-1 bg-zn-hot border-2 border-[#1C1428]"
                style={{ boxShadow: '2px 2px 0 #1C1428', transform: 'rotate(2deg)' }}
              >
                Най-ново
              </span>
            </div>
          </div>

          {/* Content — right/bottom */}
          <div className="md:w-1/2 p-5 md:p-6 flex flex-col justify-center relative z-[2]">
            <h3 className="font-display font-black text-xl md:text-2xl lg:text-3xl text-zn-text dark:text-white uppercase tracking-wide leading-tight mb-3 group-hover:text-zn-hot transition-colors">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="font-body text-sm text-zn-text-muted dark:text-zinc-400 leading-relaxed mb-4 line-clamp-3">
                {article.excerpt}
              </p>
            )}
            <div className="flex items-center gap-3 text-[11px] font-display uppercase tracking-wider text-zn-text-dim dark:text-zinc-500">
              <span>{formatNewsDate(article.date || article.publishAt)}</span>
              <span className="w-1 h-1 rounded-full bg-zn-text-dim" />
              {article.readTime && <span>{article.readTime} мин</span>}
              {article.views > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-zn-text-dim" />
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {formatCount(article.views)}
                  </span>
                </>
              )}
            </div>
            <div className="mt-4">
              <span className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase tracking-wider text-zn-hot group-hover:gap-2 transition-all">
                Прочети <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Mid-tier articles (2-column newspaper) ─── */
function MidArticle({ article, categories, index }) {
  const categoryName = categories.find((c) => c.id === article.category)?.name || 'Новини';
  const isEven = index % 2 === 0;

  return (
    <Link
      to={`/article/${article.id}`}
      className="group block comic-panel bg-white dark:bg-zinc-900 comic-dots relative overflow-hidden"
    >
      <div className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${isEven ? 'from-zn-hot to-zn-orange' : 'from-zn-purple to-blue-500'}`} />
      <div className="relative overflow-hidden aspect-[16/9]">
        {article.image ? (
          <ResponsiveImage
            src={article.image}
            alt={article.title}
            pictureClassName="block w-full h-full"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            style={{
              objectPosition: article.imageMeta?.objectPosition || '50% 50%',
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zn-text/5 to-zn-text/10 flex items-center justify-center">
            <Newspaper className="w-10 h-10 text-zn-text/10" />
          </div>
        )}
        <div className="absolute top-2 left-2 z-10">
          <span className="font-display font-black text-[8px] uppercase tracking-[0.15em] text-[#1C1428] px-2 py-0.5 bg-yellow-300/90 border border-[#1C1428]">
            {categoryName}
          </span>
        </div>
      </div>
      <div className="p-4 relative z-[2]">
        <h3 className="font-display font-black text-base uppercase tracking-wide leading-tight text-zn-text dark:text-white mb-2 group-hover:text-zn-hot transition-colors line-clamp-2">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="font-body text-xs text-zn-text-muted dark:text-zinc-400 leading-relaxed line-clamp-2 mb-2">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center justify-between border-t-2 border-zn-border/30 dark:border-zinc-700/50 pt-2">
          <span className="text-[10px] font-display uppercase tracking-wider text-zn-text-dim dark:text-zinc-500">
            {formatNewsDate(article.date || article.publishAt)}
          </span>
          {article.views > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-display text-zn-text-dim dark:text-zinc-500">
              <Eye className="w-3 h-3" /> {formatCount(article.views)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Compact headline list ─── */
function HeadlineItem({ article, categories }) {
  const categoryName = categories.find((c) => c.id === article.category)?.name || 'Новини';

  return (
    <Link
      to={`/article/${article.id}`}
      className="group flex gap-3 py-3 border-b-2 border-dashed border-zn-border/30 dark:border-zinc-700/40 last:border-b-0 hover:bg-zn-hot/[0.03] dark:hover:bg-zn-hot/[0.05] transition-colors px-2 -mx-2"
    >
      {/* Thumbnail */}
      {article.image && (
        <div className="w-16 h-16 md:w-20 md:h-16 flex-shrink-0 border-2 border-[#1C1428] dark:border-zinc-600 overflow-hidden">
          <ResponsiveImage
            src={article.image}
            alt=""
            pictureClassName="block w-full h-full"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            style={{ objectPosition: article.imageMeta?.objectPosition || '50% 50%' }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[8px] font-display font-bold uppercase tracking-[0.2em] text-zn-hot">
            {categoryName}
          </span>
          <span className="text-[9px] font-display text-zn-text-dim dark:text-zinc-500">
            {formatNewsDate(article.date || article.publishAt)}
          </span>
        </div>
        <h4 className="font-display font-bold text-sm text-zn-text dark:text-white uppercase tracking-wide leading-snug group-hover:text-zn-hot transition-colors line-clamp-2">
          {article.title}
        </h4>
        {article.views > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-display text-zn-text-dim dark:text-zinc-500 mt-0.5">
            <Eye className="w-2.5 h-2.5" /> {formatCount(article.views)}
          </span>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-zn-text-dim dark:text-zinc-600 flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

/* ─── Main Page ─── */
export default function AuthorPage() {
  const { id } = useParams();
  const authorId = Number(id);
  const { authors, categories, ads, loading } = usePublicData();
  const author = authors.find((a) => a.id === authorId);

  useDocumentTitle(makeTitle(author?.name || 'Автор'));

  const [authorArticles, setAuthorArticles] = useState([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [page, setPage] = useState(1);
  const [authorStats, setAuthorStats] = useState(EMPTY_STATS);

  useEffect(() => {
    setPage(1);
    setAuthorArticles([]);
    setTotalArticles(0);
    setAuthorStats(EMPTY_STATS);
  }, [authorId]);

  /* Fetch aggregate author stats from server */
  useEffect(() => {
    let cancelled = false;
    if (!authorId || isNaN(authorId)) return undefined;

    api.articles.getAuthorStats(authorId)
      .then((payload) => {
        if (cancelled) return;
        setAuthorStats({
          totalViews: Number(payload?.totalViews) || 0,
          totalReactions: Number(payload?.totalReactions) || 0,
          categoryCount: Number(payload?.categoryCount) || 0,
        });
        if (typeof payload?.totalArticles === 'number') {
          setTotalArticles(payload.totalArticles);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthorStats(EMPTY_STATS);
      });

    return () => { cancelled = true; };
  }, [authorId]);

  useEffect(() => {
    let cancelled = false;
    if (!authorId || isNaN(authorId)) return undefined;

    setLoadingArticles(true);
    api.articles.getAll({
      authorId,
      page,
      limit: PER_PAGE,
      fields: AUTHOR_LIST_FIELDS,
    })
      .then((payload) => {
        if (cancelled) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const total = Number(payload?.total) || 0;
        setAuthorArticles((prev) => (page <= 1 ? items : [...prev, ...items]));
        setTotalArticles(total);
      })
      .catch(() => {
        if (cancelled) return;
        if (page <= 1) {
          setAuthorArticles([]);
          setTotalArticles(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingArticles(false);
      });

    return () => { cancelled = true; };
  }, [authorId, page]);

  const totalPages = Math.max(1, Math.ceil((totalArticles || 0) / PER_PAGE));
  const showEmptyState = !loadingArticles && authorArticles.length === 0;
  const showInitialSkeleton = loadingArticles && authorArticles.length === 0;
  const showLoadMoreSkeleton = loadingArticles && authorArticles.length > 0;

  /* Split articles into editorial tiers */
  const featuredArticle = authorArticles[0] || null;
  const midArticles = authorArticles.slice(1, 3);
  const headlineArticles = authorArticles.slice(3);

  if (loading && !author) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <HeroSkeleton />
      </div>
    );
  }

  if (!author) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold text-zn-text dark:text-white mb-4 tracking-wider">Авторът не е намерен</h1>
        <p className="text-zn-text-muted dark:text-zinc-400 font-body">Не намерихме автор с този идентификатор.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto px-4 py-6"
    >
      <div className="space-y-6">
        {/* ═══ HERO BLOCK ═══ */}
        <AuthorHero author={author} totalArticles={totalArticles} stats={authorStats} />

        {/* ═══ STATS STRIP ═══ */}
        {totalArticles > 0 && (
          <StatsStrip totalArticles={totalArticles} stats={authorStats} categories={categories} />
        )}

        {/* ═══ CONTENT AREA ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main editorial content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <div className="h-1 w-8 bg-zn-hot" />
              <h2 className="font-display text-lg font-black text-zn-text dark:text-white tracking-wider uppercase">
                Публикации
              </h2>
              <div className="h-0.5 flex-1 bg-gradient-to-r from-zn-border/50 to-transparent dark:from-zinc-700/50" />
              {totalArticles > 0 && (
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-zn-text-dim dark:text-zinc-500">
                  {totalArticles} общо
                </span>
              )}
            </div>

            {showEmptyState ? (
              <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
                <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">ПРАЗНО!</div>
                <p className="text-zn-text-muted dark:text-zinc-400 font-display font-bold uppercase tracking-wider relative z-[2]">
                  Този автор все още няма публикации.
                </p>
              </div>
            ) : showInitialSkeleton ? (
              <div className="space-y-5">
                <div className="comic-panel bg-white dark:bg-zinc-900 animate-pulse h-64" aria-hidden="true" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <CardSkeleton key={`skel-mid-${idx}`} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {(showInitialSkeleton || showLoadMoreSkeleton) && (
                  <div className="sr-only" role="status">Зареждане...</div>
                )}

                {/* Tier 1: Featured (latest article, hero treatment) */}
                {featuredArticle && (
                  <FeaturedArticle article={featuredArticle} categories={categories} />
                )}

                {/* Tier 2: Mid articles (2-column newspaper) */}
                {midArticles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-5"
                  >
                    {midArticles.map((article, idx) => (
                      <MidArticle
                        key={article.id}
                        article={article}
                        categories={categories}
                        index={idx}
                      />
                    ))}
                  </motion.div>
                )}

                {/* Ad slot between tiers */}
                <AdSlot ads={ads} slot="author.content.1" pageType="author" />

                {/* Tier 3: Headlines (compact list) */}
                {headlineArticles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="newspaper-page comic-panel p-4 md:p-5 relative"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-1 w-5 bg-zn-purple" />
                      <span className="font-display font-black text-xs uppercase tracking-[0.2em] text-zn-text-dim dark:text-zinc-400">
                        Още от автора
                      </span>
                    </div>
                    <div>
                      {headlineArticles.map((article) => (
                        <HeadlineItem
                          key={article.id}
                          article={article}
                          categories={categories}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Load more skeleton */}
                {showLoadMoreSkeleton && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {Array.from({ length: 2 }).map((_, idx) => (
                      <CardSkeleton key={`author-more-skeleton-${idx}`} />
                    ))}
                  </div>
                )}

                {/* Load more button */}
                {page < totalPages && (
                  <button
                    type="button"
                    onClick={() => !loadingArticles && setPage((p) => p + 1)}
                    disabled={loadingArticles}
                    className={`w-full py-3 border-3 border-[#1C1428] dark:border-zinc-600 text-sm font-display font-black uppercase tracking-wider transition-all duration-200 comic-panel bg-white dark:bg-zinc-900 ${
                      loadingArticles
                        ? 'text-zn-text-muted dark:text-zinc-500 cursor-wait'
                        : 'text-zn-text dark:text-white comic-panel-hover hover:bg-zn-hot hover:text-white'
                    }`}
                  >
                    {loadingArticles ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-zn-text-muted border-t-zn-hot rounded-full animate-spin" />
                        Зареждане...
                      </span>
                    ) : (
                      <>Зареди още ({Math.max(totalArticles - authorArticles.length, 0)} остават)</>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Stamp badge */}
            <div className="hidden lg:flex justify-center">
              <div className="comic-stamp-circle animate-wiggle text-[9px]" style={{ transform: 'rotate(-12deg)' }}>
                {author.role?.toUpperCase().slice(0, 12) || 'АВТОР'}
              </div>
            </div>

            <TrendingSidebar />
            <AdSlot ads={ads} slot="author.sidebar.1" pageType="author" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

