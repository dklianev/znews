import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Phone, Mail, FileText } from 'lucide-react';
import TrendingSidebar from '../components/TrendingSidebar';
import AdSlot from '../components/ads/AdSlot';
import { usePublicData } from '../context/DataContext';
import ComicNewsCard from '../components/ComicNewsCard';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { api } from '../utils/api';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const PER_PAGE = 6;
const AUTHOR_LIST_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,sponsored,hero,views,tags,status,publishAt';

const AVATAR_COLORS = [
  '#CC0A1A', '#5B1A8C', '#1565C0', '#00838F', '#2E7D32', '#E65100',
  '#AD1457', '#4527A0', '#0277BD', '#00695C', '#558B2F', '#BF360C',
];

function getAvatarColor(id) {
  return AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];
}

function AuthorCardSkeleton() {
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

export default function AuthorPage() {
  const { id } = useParams();
  const authorId = Number(id);
  const { authors, ads, siteSettings, loading } = usePublicData();
  const layoutPresets = siteSettings?.layoutPresets || {};
  const author = authors.find(a => a.id === authorId);

  useDocumentTitle(makeTitle(author?.name || 'Автор'));

  const [authorArticles, setAuthorArticles] = useState([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    setAuthorArticles([]);
    setTotalArticles(0);
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

  if (loading && !author) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-zn-text mb-4 tracking-wider">Зареждане...</h1>
      </div>
    );
  }

  if (!author) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold text-zn-text mb-4 tracking-wider">Авторът не е намерен</h1>
        <p className="text-zn-text-muted font-sans">Не намерихме автор с този идентификатор.</p>
      </div>
    );
  }

  const avatarColor = getAvatarColor(author.id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar — Author Profile */}
        <div className="space-y-5">
          {/* Profile Card */}
          <div className="newspaper-page comic-panel comic-dots p-6 text-center relative overflow-visible">
            <div className="tape-deco absolute -top-2 right-6 w-12 h-4 bg-yellow-200/70 dark:bg-yellow-700/30 border border-black/5 dark:border-yellow-600/20 transform rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />

            {/* Avatar */}
            <div className="relative z-[2] flex justify-center mb-4">
              {author.avatarImage ? (
                <div className="polaroid-thick inline-block" style={{ transform: 'rotate(-2deg)' }}>
                  <div className="w-32 h-32 overflow-hidden border-3 border-[#1C1428]">
                    <img
                      src={author.avatarImage}
                      alt={author.name}
                      loading="lazy"
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
                  className="w-24 h-24 flex items-center justify-center border-3 border-[#1C1428] comic-ink-shadow"
                  style={{ backgroundColor: avatarColor }}
                >
                  <span className="text-white font-display font-black text-4xl">
                    {author.avatar && author.avatar !== '👤' ? author.avatar : author.name?.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Name & Role */}
            <h1 className="font-display font-black text-2xl text-zn-text tracking-wider uppercase text-shadow-brutal relative z-[2]">
              {author.name}
            </h1>
            {author.role && (
              <p className="text-zn-hot font-display font-semibold uppercase tracking-widest text-sm mt-1 relative z-[2]">
                {author.role}
              </p>
            )}

            {/* Gradient stripe */}
            <div className="h-1 bg-gradient-to-r from-zn-hot to-zn-orange mt-4 mb-4 relative z-[2]" />

            {/* Bio */}
            {author.bio && (
              <p className="font-sans text-sm text-zn-text-muted leading-relaxed text-left relative z-[2] mb-4">
                {author.bio}
              </p>
            )}

            {/* Contact */}
            {(author.phone || author.email) && (
              <div className="space-y-2 text-left relative z-[2] mb-4">
                {author.phone && (
                  <a
                    href={`tel:${author.phone}`}
                    className="flex items-center gap-2 text-sm font-sans text-zn-text hover:text-zn-hot transition-colors"
                  >
                    <span className="w-7 h-7 rounded-full bg-zn-hot/10 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-3.5 h-3.5 text-zn-hot" />
                    </span>
                    {author.phone}
                  </a>
                )}
                {author.email && (
                  <a
                    href={`mailto:${author.email}`}
                    className="flex items-center gap-2 text-sm font-sans text-zn-text hover:text-zn-hot transition-colors"
                  >
                    <span className="w-7 h-7 rounded-full bg-zn-purple/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3.5 h-3.5 text-zn-purple" />
                    </span>
                    {author.email}
                  </a>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="comic-panel bg-white dark:bg-zinc-900 p-3 text-center relative z-[2]">
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4 text-zn-hot" />
                <span className="text-xs font-display font-black text-zn-text-dim uppercase tracking-widest">
                  {totalArticles} публикации
                </span>
              </div>
            </div>
          </div>

          {/* Stamp badge */}
          <div className="hidden lg:flex justify-center">
            <div className="comic-stamp-circle animate-wiggle text-[9px]" style={{ transform: 'rotate(-12deg)' }}>
              {author.role?.toUpperCase().slice(0, 12) || 'АВТОР'}
            </div>
          </div>

          <TrendingSidebar />
          <AdSlot ads={ads} slot="author.sidebar.1" pageType="author" />
        </div>

        {/* Main — Articles */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section Header */}
          <div className="newspaper-page comic-panel comic-dots p-5 relative">
            <div className="absolute -top-2 left-8 w-10 h-4 bg-yellow-200/70 border border-black/5 transform -rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
            <h2 className="font-display text-xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal relative z-[2]">
              Публикации
            </h2>
            <div className="h-1 bg-gradient-to-r from-zn-hot to-zn-orange mt-2 relative z-[2]" />
          </div>

          {showEmptyState ? (
            <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
              <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">ПРАЗНО!</div>
              <p className="text-zn-text-muted font-display font-bold uppercase tracking-wider relative z-[2]">
                Този автор все още няма публикации.
              </p>
            </div>
          ) : (
            <>
              {(showInitialSkeleton || showLoadMoreSkeleton) && (
                <div className="sr-only" role="status">Зареждане...</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-busy={showInitialSkeleton || showLoadMoreSkeleton}>
                {showInitialSkeleton ? (
                  Array.from({ length: PER_PAGE }).map((_, idx) => (
                    <AuthorCardSkeleton key={`author-skeleton-${idx}`} />
                  ))
                ) : (
                  authorArticles.map((article, index) => {
                    const design = getComicCardStyle('categoryListing', index, article, layoutPresets.categoryListing);
                    return (
                      <Fragment key={article.id}>
                        <ComicNewsCard
                          article={article}
                          compact
                          tilt={design.tilt}
                          variant={design.variant}
                          sticker={design.sticker}
                          stripe={design.stripe}
                        />
                      </Fragment>
                    );
                  })
                )}
                {showLoadMoreSkeleton && (
                  Array.from({ length: 2 }).map((_, idx) => (
                    <AuthorCardSkeleton key={`author-more-skeleton-${idx}`} />
                  ))
                )}
              </div>
              {page < totalPages && (
                <button
                  onClick={() => !loadingArticles && setPage(p => p + 1)}
                  disabled={loadingArticles}
                  className={`w-full py-3 border-3 border-[#1C1428] text-sm font-display font-black uppercase tracking-wider transition-all duration-200 comic-panel bg-white ${
                    loadingArticles
                      ? 'text-zn-text-muted cursor-wait'
                      : 'text-zn-text comic-panel-hover hover:bg-zn-hot hover:text-white'
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
      </div>
    </motion.div>
  );
}
