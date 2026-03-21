import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Newspaper, RefreshCw, Clock3 } from 'lucide-react';
import TrendingSidebar from '../components/TrendingSidebar';
import AdSlot from '../components/ads/AdSlot';
import ComicNewsCard from '../components/ComicNewsCard';
import { usePublicData } from '../context/DataContext';
import { api } from '../utils/api';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const PER_PAGE = 12;
const LATEST_LIST_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,sponsored,hero,views,tags,status,publishAt,cardSticker';
const LATEST_SCROLL_PREFIX = 'zn_latest_scroll';

function parsePageValue(value) {
  const parsed = Number.parseInt(value || '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getLatestScrollKey(page) {
  return `${LATEST_SCROLL_PREFIX}:all:${page}`;
}

function LatestCardSkeleton() {
  return (
    <div className="comic-latest-card comic-panel comic-dots bg-white overflow-visible relative block h-full animate-pulse" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-zn-purple/30 to-zn-hot/30" />
      <div className="relative overflow-hidden aspect-[16/9]">
        <div className="w-full h-full bg-zn-text/10" />
      </div>
      <div className="flex flex-col justify-between p-4 gap-3">
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

export default function LatestPage() {
  const { ads, siteSettings, loading } = usePublicData();
  const layoutPresets = siteSettings?.layoutPresets || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [latestArticles, setLatestArticles] = useState([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [loadError, setLoadError] = useState('');
  const restoredKeyRef = useRef('');

  const page = parsePageValue(searchParams.get('page'));
  const requestLimit = Math.max(PER_PAGE, page * PER_PAGE);
  const totalPages = Math.max(1, Math.ceil((totalArticles || 0) / PER_PAGE));
  const showInitialSkeleton = loadingArticles && latestArticles.length === 0;
  const showLoadMoreSkeleton = loadingArticles && latestArticles.length > 0;
  const showEmptyState = !loadingArticles && latestArticles.length === 0 && !loadError;
  const pageDescriptor = useMemo(() => {
    if (totalArticles > 0) return `${totalArticles} публикувани статии в потока`;
    return 'Хронологичен поток от най-новите материали';
  }, [totalArticles]);

  useDocumentTitle(makeTitle('Последни новини'));

  useEffect(() => {
    let cancelled = false;
    setLoadingArticles(true);
    setLoadError('');

    api.articles.getAll({
      page: 1,
      limit: requestLimit,
      fields: LATEST_LIST_FIELDS,
    })
      .then((payload) => {
        if (cancelled) return;
        setLatestArticles(Array.isArray(payload?.items) ? payload.items : []);
        setTotalArticles(Number(payload?.total) || 0);
      })
      .catch((error) => {
        if (cancelled) return;
        setLatestArticles([]);
        setTotalArticles(0);
        setLoadError(error?.message || 'Не успяхме да заредим последните новини.');
      })
      .finally(() => {
        if (!cancelled) setLoadingArticles(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestLimit]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const key = getLatestScrollKey(page);
    let rafId = 0;

    const persistScroll = () => {
      rafId = 0;
      try {
        window.sessionStorage.setItem(key, String(window.scrollY || 0));
      } catch {
        // ignore storage errors
      }
    };

    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(persistScroll);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    persistScroll();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      persistScroll();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [page]);

  useEffect(() => {
    if (typeof window === 'undefined' || loadingArticles) return undefined;
    const key = getLatestScrollKey(page);
    if (restoredKeyRef.current === key) return undefined;
    restoredKeyRef.current = key;

    let savedY = 0;
    try {
      savedY = Number.parseInt(window.sessionStorage.getItem(key) || '0', 10);
    } catch {
      savedY = 0;
    }

    if (!Number.isFinite(savedY) || savedY <= 0) return undefined;

    let cancelled = false;
    let attempts = 0;
    const restoreScroll = () => {
      if (cancelled) return;
      window.scrollTo(0, savedY);
      attempts += 1;
      if (attempts < 3 && Math.abs((window.scrollY || 0) - savedY) > 4) {
        window.requestAnimationFrame(restoreScroll);
      }
    };

    const rafId = window.requestAnimationFrame(restoreScroll);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [loadingArticles, page, latestArticles.length]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(nextPage));
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(getLatestScrollKey(nextPage), String(window.scrollY || 0));
      } catch {
        // ignore storage errors
      }
    }
    setSearchParams(nextParams);
  };

  const handleRetry = () => {
    restoredKeyRef.current = '';
    const nextParams = new URLSearchParams(searchParams);
    if (page <= 1) nextParams.delete('page');
    setSearchParams(nextParams);
    setLoadingArticles(true);
    api.articles.getAll({
      page: 1,
      limit: requestLimit,
      fields: LATEST_LIST_FIELDS,
    })
      .then((payload) => {
        setLatestArticles(Array.isArray(payload?.items) ? payload.items : []);
        setTotalArticles(Number(payload?.total) || 0);
        setLoadError('');
      })
      .catch((error) => {
        setLatestArticles([]);
        setTotalArticles(0);
        setLoadError(error?.message || 'Не успяхме да заредим последните новини.');
      })
      .finally(() => setLoadingArticles(false));
  };

  if (loading && latestArticles.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="newspaper-page comic-panel comic-dots p-6 mb-6 animate-pulse">
          <div className="h-4 w-40 bg-zn-text/10 rounded mb-3" />
          <div className="h-8 w-72 bg-zn-text/10 rounded mb-3" />
          <div className="h-3 w-80 bg-zn-text/10 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: PER_PAGE }).map((_, index) => (
            <LatestCardSkeleton key={`latest-loading-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-6"
    >
      <div className="newspaper-page comic-panel comic-dots p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full comic-speed-lines opacity-[0.04] pointer-events-none z-0" />
        <div className="relative z-[2] flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-display font-black uppercase tracking-[0.3em] text-zn-hot mb-2">
              <Newspaper className="w-4 h-4" />
              Новинарски поток
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal">
              Последни новини
            </h1>
            <div className="h-1.5 bg-gradient-to-r from-zn-purple via-zn-hot to-zn-orange mt-2 mb-3 max-w-sm" />
            <p className="text-sm font-sans text-zn-text-muted max-w-2xl">
              {pageDescriptor}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start md:self-auto bg-white/70 px-3 py-2 border-2 border-zn-border/60 comic-panel">
            <Clock3 className="w-4 h-4 text-zn-purple" />
            <span className="text-[11px] font-display font-black uppercase tracking-[0.16em] text-zn-text-dim">
              Страница {page} от {totalPages}
            </span>
          </div>
        </div>
      </div>

      <section className="mb-6">
        <AdSlot ads={ads} slot="category.top" pageType="latest" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {loadError ? (
            <div className="newspaper-page comic-panel comic-dots p-8 text-center relative">
              <p className="font-display font-black uppercase tracking-[0.18em] text-zn-hot mb-2">Проблем с потока</p>
              <p className="text-sm font-sans text-zn-text-muted mb-5">{loadError}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-5 py-3 bg-zn-purple text-white text-xs font-display font-black uppercase tracking-[0.12em] border-3 border-[#1C1428] hover:bg-zn-purple-dark transition-colors"
                style={{ boxShadow: '4px 4px 0 #1C1428' }}
              >
                <RefreshCw className="w-4 h-4" />
                Опитай пак
              </button>
            </div>
          ) : showEmptyState ? (
            <div className="newspaper-page comic-panel comic-dots p-10 text-center relative overflow-hidden">
              <div className="comic-stamp-circle absolute -top-4 -right-2 z-20 animate-wiggle text-[10px]">ТИШИНА</div>
              <p className="font-display font-black text-xl uppercase tracking-[0.18em] text-zn-text mb-2 relative z-[2]">
                НЯМА НОВИНИ... ЗАСЕГА
              </p>
              <p className="text-sm font-sans text-zn-text-muted relative z-[2]">
                Когато излезе нещо ново, потокът ще го покаже тук първо.
              </p>
            </div>
          ) : (
            <>
              {(showInitialSkeleton || showLoadMoreSkeleton) && (
                <div className="sr-only" role="status">Зареждане...</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-busy={showInitialSkeleton || showLoadMoreSkeleton}>
                {showInitialSkeleton ? (
                  Array.from({ length: PER_PAGE }).map((_, index) => (
                    <LatestCardSkeleton key={`latest-skeleton-${index}`} />
                  ))
                ) : (
                  latestArticles.map((article, index) => {
                    const design = getComicCardStyle('categoryListing', index, article, layoutPresets.categoryListing);
                    return (
                      <ComicNewsCard
                        key={article.id}
                        article={article}
                        compact
                        tilt={design.tilt}
                        variant={design.variant}
                        sticker={design.sticker}
                        stripe={design.stripe}
                      />
                    );
                  })
                )}
                {showLoadMoreSkeleton && (
                  Array.from({ length: 2 }).map((_, index) => (
                    <LatestCardSkeleton key={`latest-more-skeleton-${index}`} />
                  ))
                )}
              </div>

              {page < totalPages && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingArticles}
                  className={`w-full py-3 border-3 border-[#1C1428] text-sm font-display font-black uppercase tracking-wider transition-all duration-200 comic-panel bg-white ${
                    loadingArticles
                      ? 'text-zn-text-muted cursor-wait'
                      : 'text-zn-text comic-panel-hover hover:bg-zn-purple hover:text-white'
                  }`}
                >
                  {loadingArticles ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-zn-text-muted border-t-zn-purple rounded-full animate-spin" />
                      Зареждане...
                    </span>
                  ) : (
                    <>Още новини ({Math.max(totalArticles - latestArticles.length, 0)} оставащи)</>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="newspaper-page comic-panel comic-dots p-5 relative">
            <p className="text-[11px] font-display font-black uppercase tracking-[0.26em] text-zn-hot mb-2">
              Ориентирай се бързо
            </p>
            <p className="text-sm font-sans text-zn-text-muted leading-relaxed mb-4">
              Потокът показва най-новото хронологично. За по-точно ровене използвай категориите или търсачката.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/category/crime" className="comic-chip comic-chip-hot">Криминале</Link>
              <Link to="/category/breaking" className="comic-chip comic-chip-hot">Извънредно</Link>
              <Link to="/category/emergency" className="comic-chip">Спешно</Link>
              <Link to="/search" className="comic-chip">Търсене</Link>
            </div>
          </div>
          <TrendingSidebar />
          <AdSlot ads={ads} slot="category.sidebar.1" pageType="latest" />
          <AdSlot ads={ads} slot="category.sidebar.2" pageType="latest" />
        </div>
      </div>
    </motion.div>
  );
}
