import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import TrendingSidebar from '../components/TrendingSidebar';
import { AdBannerHorizontal, AdBannerSide } from '../components/AdBanner';
import { useData } from '../context/DataContext';
import ComicNewsCard from '../components/ComicNewsCard';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { api } from '../utils/api';

const PER_PAGE = 6;
const CATEGORY_LIST_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,hero,views,tags,status,publishAt';

export default function CategoryPage() {
  const { slug } = useParams();
  const { categories, ads, siteSettings, loading } = useData();
  const layoutPresets = siteSettings?.layoutPresets || {};
  const category = categories.find(c => c.id === slug);
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

  const horizontalAds = ads.filter(a => a.type === 'horizontal');
  const sideAds = ads.filter(a => a.type === 'side');

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
        <AdBannerHorizontal ad={horizontalAds[0]} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Articles */}
        <div className="lg:col-span-2 space-y-5">
          {!loadingArticles && categoryArticles.length === 0 ? (
            <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
              <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">ПРАЗНО!</div>
              <p className="text-zn-text-muted font-display font-bold uppercase tracking-wider relative z-[2]">Няма публикации в тази категория.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {categoryArticles.map((article, index) => {
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
                      {(index + 1) % 4 === 0 && horizontalAds[Math.floor((index + 1) / 4)] && (
                        <div className="md:col-span-2 my-1">
                          <AdBannerHorizontal ad={horizontalAds[Math.floor((index + 1) / 4) % horizontalAds.length]} />
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
              {loadingArticles && (
                <div className="text-center text-sm font-sans text-zn-text-muted py-3">Зареждане...</div>
              )}
              {page < totalPages && !loadingArticles && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="w-full py-3 border-3 border-[#1C1428] text-zn-text text-sm font-display font-black uppercase tracking-wider hover:bg-zn-hot hover:text-white transition-all duration-200 comic-panel comic-panel-hover bg-white"
                >
                  Зареди още ({Math.max(totalArticles - categoryArticles.length, 0)} остават)
                </button>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <TrendingSidebar />
          {sideAds.slice(0, 2).map(ad => (
            <AdBannerSide key={ad.id} ad={ad} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
