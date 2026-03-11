import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import TrendingSidebar from '../components/TrendingSidebar';
import AdSlot from '../components/ads/AdSlot';
import { usePublicData } from '../context/DataContext';
import ComicNewsCard from '../components/ComicNewsCard';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { api } from '../utils/api';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const PER_PAGE = 6;
const CATEGORY_LIST_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,sponsored,hero,views,tags,status,publishAt';

function CategoryCardSkeleton({ compact = true }) {
  return (
    <div className="comic-latest-card comic-panel comic-dots bg-white overflow-visible relative block h-full animate-pulse" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-zn-hot/30 to-zn-orange/30" />
      <div className="absolute top-3 left-3 z-20">
        <div className="h-4 w-20 bg-zn-text/10 rounded" />
      </div>
      <div className="absolute -top-3 -right-2 z-30">
        <div className="h-6 w-16 bg-zn-text/10 rounded" />
      </div>

      <div className={`relative overflow-hidden ${compact ? 'aspect-[16/9]' : 'h-52'}`}>
        <div className="w-full h-full bg-zn-text/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
        <div className="absolute bottom-2 left-2 h-4 w-24 bg-zn-text/20 rounded" />
      </div>

      <div className={`flex flex-col justify-between ${compact ? 'p-3 gap-2' : 'p-4 gap-3'}`}>
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

export default function CategoryPage() {
  const { slug } = useParams();
  const { categories, ads, siteSettings, loading } = usePublicData();
  const layoutPresets = siteSettings?.layoutPresets || {};
  const category = categories.find(c => c.id === slug);

  useDocumentTitle(makeTitle(category?.name || 'Категория'));
  const [categoryArticles, setCategoryArticles] = useState([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    setCategoryArticles([]);
    setTotalArticles(0);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    if (!slug) return undefined;

    setLoadingArticles(true);
    api.articles.getAll({
      category: slug,
      page,
      limit: PER_PAGE,
      fields: CATEGORY_LIST_FIELDS,
    })
      .then((payload) => {
        if (cancelled) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const total = Number(payload?.total) || 0;
        setCategoryArticles((prev) => (page <= 1 ? items : [...prev, ...items]));
        setTotalArticles(total);
      })
      .catch(() => {
        if (cancelled) return;
        if (page <= 1) {
          setCategoryArticles([]);
          setTotalArticles(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingArticles(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, page]);

  const totalPages = Math.max(1, Math.ceil((totalArticles || 0) / PER_PAGE));

  const showEmptyState = !loadingArticles && categoryArticles.length === 0;
  const showInitialSkeleton = loadingArticles && categoryArticles.length === 0;
  const showLoadMoreSkeleton = loadingArticles && categoryArticles.length > 0;

  if (loading && !category) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-zn-text mb-4 tracking-wider">Зареждане...</h1>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold text-zn-text mb-4 tracking-wider">Категорията не е намерена</h1>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-6"
    >
      {/* Header */}
      <div className="newspaper-page comic-panel comic-dots p-6 mb-6 relative">
        <div className="absolute -top-2 right-8 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-4 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
        <h1 className="font-display text-3xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal relative z-[2]">{category.name}</h1>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-2 mb-2 relative z-[2]" />
        <p className="text-sm font-display font-bold text-zn-text-muted uppercase tracking-wider relative z-[2]">
          {totalArticles} публикации в тази категория
        </p>
      </div>

      {/* Ad */}
      <section className="mb-6">
        <AdSlot ads={ads} slot="category.top" pageType="category" categoryId={category.id} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Articles */}
        <div className="lg:col-span-2 space-y-5">
          {showEmptyState ? (
            <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
              <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">ПРАЗНО!</div>
              <p className="text-zn-text-muted font-display font-bold uppercase tracking-wider relative z-[2]">Няма публикации в тази категория.</p>
            </div>
          ) : (
            <>
              {(showInitialSkeleton || showLoadMoreSkeleton) && (
                <div className="sr-only" role="status">Зареждане...</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" aria-busy={showInitialSkeleton || showLoadMoreSkeleton}>
                {showInitialSkeleton ? (
                  Array.from({ length: PER_PAGE }).map((_, idx) => (
                    <CategoryCardSkeleton key={`category-skeleton-${idx}`} />
                  ))
                ) : (
                  categoryArticles.map((article, index) => {
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
                        {index + 1 === 4 && (
                          <AdSlot
                            ads={ads}
                            slot="category.grid.after4"
                            pageType="category"
                            categoryId={category.id}
                            className="md:col-span-2 my-1"
                          />
                        )}
                        {index + 1 === 8 && (
                          <AdSlot
                            ads={ads}
                            slot="category.grid.after8"
                            pageType="category"
                            categoryId={category.id}
                            className="md:col-span-2 my-1"
                          />
                        )}
                      </Fragment>
                    );
                  })
                )}
                {showLoadMoreSkeleton && (
                  Array.from({ length: 2 }).map((_, idx) => (
                    <CategoryCardSkeleton key={`category-more-skeleton-${idx}`} />
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
                    <>Зареди още ({Math.max(totalArticles - categoryArticles.length, 0)} остават)</>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <TrendingSidebar />
          <AdSlot ads={ads} slot="category.sidebar.1" pageType="category" categoryId={category.id} />
          <AdSlot ads={ads} slot="category.sidebar.2" pageType="category" categoryId={category.id} />
        </div>
      </div>
    </motion.div>
  );
}

