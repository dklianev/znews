import { useMemo } from 'react';
import { motion } from 'framer-motion';
import ArticleCard from '../components/ArticleCard';
import TrendingSidebar from '../components/TrendingSidebar';
import MostWanted from '../components/MostWanted';
import PollWidget from '../components/PollWidget';
import { AdBannerHorizontal, AdBannerSide } from '../components/AdBanner';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Flame, Megaphone, Bell, Siren, TrendingUp, Eye, RefreshCw, AlertTriangle, Zap, Newspaper, ShieldAlert } from 'lucide-react';
import ComicNewsCard from '../components/ComicNewsCard';
import ResponsiveImage from '../components/ResponsiveImage';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const fallbackLatestImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EDE4D0"/><stop offset="1" stop-color="#DDD3C2"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><text x="600" y="360" text-anchor="middle" font-family="Oswald,sans-serif" font-size="64" font-weight="900" fill="#C4B49A">LOS SANTOS NEWSWIRE</text></svg>');

const SPOTLIGHT_ICON_MAP = {
  Flame,
  Megaphone,
  Bell,
  Siren,
  Zap,
  Newspaper,
  ShieldAlert,
};

const DEFAULT_HOME_SPOTLIGHT_LINKS = [
  { to: '/category/crime', label: 'Горещи Новини', icon: 'Flame', hot: true, tilt: '-1.3deg' },
  { to: '/category/underground', label: 'Скандали', icon: 'Megaphone', hot: true, tilt: '1deg' },
  { to: '/category/society', label: 'Слухове', icon: 'Bell', hot: false, tilt: '-0.8deg' },
];

const NAV_PILL_VARIANTS = ['nav-pill-hot', 'nav-pill-purple', 'nav-pill-navy'];

function getArticleTimestamp(article) {
  if (!article || typeof article !== 'object') return 0;

  if (article.publishAt) {
    const publishAtTs = new Date(article.publishAt).getTime();
    if (Number.isFinite(publishAtTs)) return publishAtTs;
  }

  if (article.date) {
    const dateTs = new Date(article.date).getTime();
    if (Number.isFinite(dateTs)) return dateTs;
  }

  return Number(article.id) || 0;
}

function formatArticleDateLabel(article) {
  if (article?.publishAt) {
    const publishDate = new Date(article.publishAt);
    if (!Number.isNaN(publishDate.getTime())) {
      return publishDate.toLocaleDateString('bg-BG');
    }
  }
  return article?.date || '';
}

function getLatestImageSizes(mdCols) {
  switch (mdCols) {
    case 12:
      return '(max-width: 767px) 100vw, (max-width: 1023px) 96vw, 56vw';
    case 8:
      return '(max-width: 767px) 100vw, (max-width: 1023px) 64vw, 38vw';
    case 6:
      return '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 29vw';
    case 4:
      return '(max-width: 767px) 100vw, (max-width: 1023px) 34vw, 20vw';
    default:
      return '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 29vw';
  }
}

function getLatestCardLayout({ count, index, mdCols }) {
  const normalizedCols = Number.isFinite(Number(mdCols)) ? Number(mdCols) : 6;

  if (count === 1) {
    return {
      cardModeClass: 'comic-latest-card-lead',
      imageHeightClass: 'h-72 md:h-[420px]',
      titleSizeClass: 'text-2xl md:text-3xl',
      excerptSizeClass: 'line-clamp-4 text-base',
      imageSizes: getLatestImageSizes(12),
    };
  }

  if (count === 2) {
    return {
      cardModeClass: 'comic-latest-card-balanced',
      imageHeightClass: 'h-60 md:h-[320px]',
      titleSizeClass: 'text-xl md:text-2xl',
      excerptSizeClass: 'line-clamp-3 text-base',
      imageSizes: getLatestImageSizes(6),
    };
  }

  if (index === 0) {
    return {
      cardModeClass: 'comic-latest-card-lead',
      imageHeightClass: 'h-64 md:h-[360px]',
      titleSizeClass: 'text-2xl md:text-3xl',
      excerptSizeClass: 'line-clamp-3 text-base',
      imageSizes: getLatestImageSizes(normalizedCols),
    };
  }

  if (normalizedCols >= 8) {
    return {
      cardModeClass: 'comic-latest-card-wide',
      imageHeightClass: 'h-52 md:h-[280px]',
      titleSizeClass: 'text-xl md:text-2xl',
      excerptSizeClass: 'line-clamp-3 text-base',
      imageSizes: getLatestImageSizes(normalizedCols),
    };
  }

  if (normalizedCols === 6) {
    return {
      cardModeClass: 'comic-latest-card-half',
      imageHeightClass: 'h-48 md:h-56',
      titleSizeClass: 'text-xl',
      excerptSizeClass: 'line-clamp-3 text-base',
      imageSizes: getLatestImageSizes(6),
    };
  }

  return {
    cardModeClass: 'comic-latest-card-brief',
    imageHeightClass: 'h-44 md:h-48',
    titleSizeClass: 'text-lg',
    excerptSizeClass: 'line-clamp-3 text-sm',
    imageSizes: getLatestImageSizes(normalizedCols),
  };
}

function HomePageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-3 md:px-4 py-5 space-y-6 animate-pulse">
      <div className="h-10 w-72 mx-auto bg-zn-text/10 rounded" />
      <div className="comic-panel comic-dots bg-white p-4">
        <div className="h-72 md:h-[420px] w-full bg-zn-text/10 rounded" />
      </div>
      <div className="h-20 bg-zn-text/10 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="comic-panel comic-dots bg-white p-4">
            <div className="h-44 w-full bg-zn-text/10 rounded mb-3" />
            <div className="h-5 w-11/12 bg-zn-text/10 rounded mb-2" />
            <div className="h-3 w-8/12 bg-zn-text/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { articles, ads, categories, heroSettings, siteSettings, loading, loadError, refresh } = useData();
  const layoutPresets = siteSettings?.layoutPresets || {};

  useDocumentTitle();

  const {
    heroArticle,
    featuredArticles,
    crimeArticles,
    breakingArticles,
    emergencyArticles,
    reportageArticles,
    categoryById,
    horizontalAds,
    sideAds,
    latestShowcase,
    latestWire,
    quickCategoryLinks,
    bottomPills,
    headlineBoardWords,
    heroPrimaryPhoto,
    heroSiblings,
  } = useMemo(() => {
    const safeArticles = Array.isArray(articles) ? articles : [];
    const safeCategories = Array.isArray(categories) ? categories : [];
    const safeAds = Array.isArray(ads) ? ads : [];

    const sortedArticles = [...safeArticles].sort((left, right) => {
      const timestampDiff = getArticleTimestamp(right) - getArticleTimestamp(left);
      if (timestampDiff !== 0) return timestampDiff;
      return (Number(right.id) || 0) - (Number(left.id) || 0);
    });
    const articleById = new Map(safeArticles.map((article) => [Number(article.id), article]));

    const usedIds = new Set();
    const claimArticle = (article) => {
      if (!article || !Number.isFinite(Number(article.id))) return false;
      const normalizedId = Number(article.id);
      if (usedIds.has(normalizedId)) return false;
      usedIds.add(normalizedId);
      return true;
    };

    const takeFromPool = (predicate, limit) => {
      const result = [];
      for (const article of sortedArticles) {
        if (result.length >= limit) break;
        if (!predicate(article)) continue;
        if (!claimArticle(article)) continue;
        result.push(article);
      }
      return result;
    };

    const heroArticle = sortedArticles.find((article) => article.hero)
      || sortedArticles.find((article) => article.breaking)
      || sortedArticles[0]
      || null;

    const selectedMainPhotoId = Number.parseInt(heroSettings?.mainPhotoArticleId, 10);
    const selectedMainPhotoArticle = Number.isInteger(selectedMainPhotoId) && selectedMainPhotoId > 0
      ? articleById.get(selectedMainPhotoId) || null
      : null;
    const heroPrimaryPhoto = selectedMainPhotoArticle || heroArticle;

    const selectedHeroSiblingIds = Array.isArray(heroSettings?.photoArticleIds) ? heroSettings.photoArticleIds : [];
    const selectedHeroSiblings = selectedHeroSiblingIds
      .map((id) => articleById.get(Number(id)) || null)
      .filter(Boolean)
      .filter((a, index, arr) => a.id !== heroPrimaryPhoto?.id && arr.findIndex((x) => x.id === a.id) === index)
      .slice(0, 2);
    const autoHeroSiblings = sortedArticles
      .filter((a) => a.id !== heroPrimaryPhoto?.id && a.image)
      .slice(0, 2);
    const heroSiblings = [...selectedHeroSiblings, ...autoHeroSiblings.filter((a) => !selectedHeroSiblings.find((s) => s.id === a.id))].slice(0, 2);

    // Reserve hero entries first so they cannot be reused in section grids or latest feed.
    claimArticle(heroArticle);
    claimArticle(heroPrimaryPhoto);
    heroSiblings.forEach((article) => claimArticle(article));

    const featuredArticles = takeFromPool((article) => article.featured, 3);
    const crimeArticles = takeFromPool((article) => article.category === 'crime' || article.category === 'underground', 4);
    const breakingArticles = takeFromPool((article) => article.category === 'breaking', 2);
    const emergencyArticles = takeFromPool((article) => article.category === 'emergency', 2);
    const reportageArticles = takeFromPool((article) => article.category === 'reportage', 3);
    const latestArticles = sortedArticles.filter((article) => !usedIds.has(Number(article.id)));

    const categoryById = new Map(safeCategories.map(c => [c.id, c.name]));

    const horizontalAds = safeAds.filter(a => a.type === 'horizontal');
    const sideAds = safeAds.filter(a => a.type === 'side');
    const latestShowcase = latestArticles.slice(0, 5);
    const latestWire = latestArticles.slice(5);

    const navbarCategoryLinks = Array.isArray(siteSettings?.navbarLinks)
      ? siteSettings.navbarLinks.filter((item) => typeof item?.to === 'string' && item.to.startsWith('/category/'))
      : [];
    const quickHotCategoryIds = new Set(
      navbarCategoryLinks
        .filter((item) => item?.hot)
        .map((item) => item.to.replace(/^\/category\//, '').split('/')[0])
        .filter(Boolean)
    );
    const quickOrderedCategoryIds = new Set();
    const quickCategoriesFromNavbar = navbarCategoryLinks.map((item) => {
      const categoryId = item.to.replace(/^\/category\//, '').split('/')[0];
      if (!categoryId || quickOrderedCategoryIds.has(categoryId)) return null;
      const matchingCategory = safeCategories.find((category) => category.id === categoryId && category.id !== 'all');
      if (!matchingCategory) return null;
      quickOrderedCategoryIds.add(categoryId);
      return {
        id: matchingCategory.id,
        name: matchingCategory.name,
        to: `/category/${matchingCategory.id}`,
        hot: quickHotCategoryIds.has(matchingCategory.id),
      };
    }).filter(Boolean);
    const quickCategoryRemainder = safeCategories
      .filter((category) => category.id !== 'all' && !quickOrderedCategoryIds.has(category.id))
      .map((category) => ({
        id: category.id,
        name: category.name,
        to: `/category/${category.id}`,
        hot: false,
      }));
    const quickCategoryLinks = [...quickCategoriesFromNavbar, ...quickCategoryRemainder];

    const spotlightSource = Array.isArray(siteSettings?.spotlightLinks) && siteSettings.spotlightLinks.length > 0
      ? siteSettings.spotlightLinks
      : DEFAULT_HOME_SPOTLIGHT_LINKS;
    const bottomPills = (spotlightSource.length > 0 ? spotlightSource : DEFAULT_HOME_SPOTLIGHT_LINKS)
      .slice(0, 3)
      .map((item, index) => ({
        to: typeof item?.to === 'string' && item.to ? item.to : DEFAULT_HOME_SPOTLIGHT_LINKS[index]?.to || '/',
        label: item?.label || DEFAULT_HOME_SPOTLIGHT_LINKS[index]?.label || 'Виж повече',
        hot: Boolean(item?.hot),
        tilt: item?.tilt || DEFAULT_HOME_SPOTLIGHT_LINKS[index]?.tilt || '0deg',
        className: NAV_PILL_VARIANTS[index] || NAV_PILL_VARIANTS[NAV_PILL_VARIANTS.length - 1],
        Icon: SPOTLIGHT_ICON_MAP[item?.icon] || SPOTLIGHT_ICON_MAP[DEFAULT_HOME_SPOTLIGHT_LINKS[index]?.icon] || Flame,
      }));

    const headlineBoardWords = (heroSettings?.headlineBoardText || 'ШОК И СЕНЗАЦИЯ!')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return {
      heroArticle,
      featuredArticles,
      crimeArticles,
      breakingArticles,
      emergencyArticles,
      reportageArticles,
      categoryById,
      horizontalAds,
      sideAds,
      latestShowcase,
      latestWire,
      quickCategoryLinks,
      bottomPills,
      headlineBoardWords,
      heroPrimaryPhoto,
      heroSiblings,
    };
  }, [articles, ads, categories, heroSettings, siteSettings]);

  if (loading) {
    return <HomePageSkeleton />;
  }

  if (loadError && (!articles || articles.length === 0)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="comic-headline-board mb-6 inline-flex">
          <span className="comic-headline-board-word comic-headline-board-word-hot">ГРЕШКА</span>
        </div>
        <h1 className="font-display text-4xl font-black text-zn-black mb-4 uppercase">Проблем при зареждане</h1>
        <p className="font-display text-zn-text-muted uppercase tracking-wider mb-6 inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-zn-hot" />
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Опитай отново
        </button>
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="comic-headline-board mb-6 inline-flex">
          <span className="comic-headline-board-word comic-headline-board-word-hot">ПРАЗНО</span>
        </div>
        <h1 className="font-display text-4xl font-black text-zn-black mb-4 uppercase">Няма публикации</h1>
        <p className="font-display text-zn-text-muted uppercase tracking-wider">Добавете статии от администраторския панел.</p>
      </div>
    );
  }
  const getDynamicSlots = (count) => {
    if (count === 1) return [{ span: 'col-span-1 md:col-span-12', mdCols: 12, tilt: '-1.2deg', sticker: 'Фронт' }];
    if (count === 2) return [
      { span: 'col-span-1 md:col-span-6', mdCols: 6, tilt: '-1.2deg', sticker: 'Фронт' },
      { span: 'col-span-1 md:col-span-6', mdCols: 6, tilt: '1deg', sticker: 'Досие' }
    ];
    if (count === 3) return [
      { span: 'col-span-1 md:col-span-12', mdCols: 12, tilt: '-1.2deg', sticker: 'Фронт' },
      { span: 'col-span-1 md:col-span-6', mdCols: 6, tilt: '1deg', sticker: 'Досие' },
      { span: 'col-span-1 md:col-span-6', mdCols: 6, tilt: '-0.9deg', sticker: 'Радар' }
    ];
    if (count === 4) return [
      { span: 'col-span-1 md:col-span-12', mdCols: 12, tilt: '-1.2deg', sticker: 'Фронт' },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '1deg', sticker: 'Досие' },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '-0.9deg', sticker: 'Радар' },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '0.8deg', sticker: 'Сигнал' }
    ];
    return [
      { span: 'col-span-1 md:col-span-8 md:row-span-2', mdCols: 8, tilt: '-1.2deg', sticker: 'Фронт' },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '1deg', sticker: 'Досие' },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '-0.9deg', sticker: 'Радар' },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '0.8deg', sticker: 'Сигнал' },
      { span: 'col-span-1 md:col-span-8', mdCols: 8, tilt: '-0.8deg', sticker: 'Ключово' },
    ];
  };
  const latestSlots = getDynamicSlots(latestShowcase.length);

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-4 py-5 space-y-6">

      {/* ═══ STARBURST CALLOUT ═══ */}
      <section className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.34, ease: 'easeOut' }}
          className="inline-block relative z-[2]"
        >
          <div className="comic-headline-board inline-flex">
            {(headlineBoardWords.length > 0 ? headlineBoardWords : ['ШОК', 'И', 'СЕНЗАЦИЯ!']).map((word, index, words) => {
              const edgeWord = index === 0 || index === words.length - 1;
              return (
                <span
                  key={`${word}-${index}`}
                  className={`comic-headline-board-word ${edgeWord ? 'comic-headline-board-word-hot' : 'comic-headline-board-word-ink'}`}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ═══ HERO — Newspaper front page ═══ */}
      <section>
        <ArticleCard article={heroArticle} size="hero" heroPhotoArticle={heroPrimaryPhoto} siblingArticles={heroSiblings} />
      </section>

      {/* ═══ Ad ═══ */}
      <section><AdBannerHorizontal ad={horizontalAds[0]} /></section>

      {/* ═══ Featured — "ГОРЕЩО ОТ РЕДАКЦИЯТА" ═══ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="comic-ribbon-hot" style={{ transform: 'rotate(-0.7deg)' }}>
            <Flame className="w-5 h-5" /> Горещо от Редакцията
          </div>
          <div className="flex-1 h-1 bg-gradient-to-r from-zn-hot/40 to-transparent" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {featuredArticles.map((article, index) => {
            const design = getComicCardStyle('homeFeatured', index, article, layoutPresets.homeFeatured);
            return (
              <ComicNewsCard
                key={article.id}
                article={article}
                tilt={design.tilt}
                variant={design.variant}
                sticker={design.sticker}
                stripe={design.stripe}
              />
            );
          })}
        </div>
      </section>

      {/* ═══ Crime & Underground ═══ */}
      <section className="comic-grid-backdrop overflow-visible p-4 md:p-6 relative" style={{ transform: 'rotate(-0.35deg)' }}>
        {/* Corner tape */}
        <div className="tape tape-tl" />
        <div className="tape tape-br" />

        <div className="flex items-center gap-3 mb-4">
          <div className="comic-ribbon-navy" style={{ transform: 'rotate(0.7deg)' }}>
            <Siren className="w-5 h-5" /> Криминални / Подземен свят
          </div>
          <div className="flex-1 h-1 bg-gradient-to-r from-zn-navy/40 to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {crimeArticles.map((article, index) => {
            const design = getComicCardStyle('homeCrime', index, article, layoutPresets.homeCrime);
            return (
              <ComicNewsCard
                key={article.id}
                article={article}
                tilt={design.tilt}
                variant={design.variant}
                sticker={design.sticker}
                compact
                stripe={design.stripe}
              />
            );
          })}
        </div>
      </section>

      {/* ═══ Quick Categories ═══ */}
      <section>
        <div className="flex flex-wrap gap-2 justify-center">
          {quickCategoryLinks.map((cat, index) => (
            <Link
              key={cat.id}
              to={cat.to}
              className={`comic-chip ${cat.hot ? 'comic-chip-hot' : ''}`}
              style={{ '--chip-tilt': `${index % 2 === 0 ? -1.4 : 1.2}deg` }}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ Main + Sidebar ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="comic-ribbon-purple" style={{ transform: 'rotate(-0.5deg)' }}>
              <TrendingUp className="w-5 h-5" /> Последни Новини
            </div>
            <div className="flex-1 h-1 bg-gradient-to-r from-zn-purple/40 to-transparent" />
          </div>

          {latestShowcase.length > 0 ? (
            <div className="comic-latest-wall grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[minmax(140px,auto)] md:items-start">
              {latestShowcase.map((article, index) => {
                const slot = latestSlots[index] || { span: 'md:col-span-6', mdCols: 6, tilt: '0deg', sticker: 'Новина' };
                const latestCardLayout = getLatestCardLayout({
                  count: latestShowcase.length,
                  index,
                  mdCols: slot.mdCols,
                });
                const categoryName = categoryById.get(article.category) || 'Новини';

                const customSticker = typeof article.cardSticker === 'string' ? article.cardSticker.trim() : '';
                const stickerLabel = customSticker || slot.sticker;

                return (
                  <Link
                    key={article.id}
                    to={`/article/${article.id}`}
                    className={`group comic-latest-card ${latestCardLayout.cardModeClass} comic-panel comic-dots bg-white overflow-visible relative ${slot.span}`}
                    style={{ '--latest-tilt': slot.tilt }}
                  >
                    <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${index % 2 === 0 ? 'from-zn-hot to-zn-orange' : 'from-zn-purple to-zn-blue'}`} />
                    <div className="absolute top-3 left-3 z-20">
                      <span className="comic-kicker">{categoryName}</span>
                    </div>
                    <div className="absolute -top-3 -right-2 z-30">
                      <span className="comic-sticker">{stickerLabel}</span>
                    </div>

                    <div className="flex flex-col h-full">
                      <div className={`relative overflow-hidden shrink-0 ${latestCardLayout.imageHeightClass}`}>
                        <ResponsiveImage
                          src={article.image}
                          pipeline={article.imageMeta}
                          fallbackSrc={fallbackLatestImage}
                          alt={article.title}
                          loading="lazy"
                          decoding="async"
                          sizes={latestCardLayout.imageSizes}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          pictureClassName="block w-full h-full"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                        <div className="absolute bottom-3 left-3 px-2 py-1 text-[10px] font-display font-black uppercase tracking-[0.16em] text-white border border-white/40 bg-black/35">
                          {formatArticleDateLabel(article)}
                        </div>
                      </div>

                      <div className={`p-4 flex flex-col justify-between gap-3 flex-1`}>
                        <h3 className={`font-display font-black uppercase leading-tight text-zn-black group-hover:text-zn-hot transition-colors ${latestCardLayout.titleSizeClass} line-clamp-4`}>
                          {article.title}
                        </h3>
                        <p className={`text-zn-text-muted italic ${latestCardLayout.excerptSizeClass}`}>
                          {article.excerpt}
                        </p>
                        <div className="flex items-center justify-between border-t-2 border-zn-border/50 pt-2 text-xs font-display font-black uppercase tracking-[0.08em] text-zn-text-dim mt-auto">
                          <span>{categoryName}</span>
                          <span className="inline-flex items-center gap-1 text-zn-hot">
                            <Eye className="w-3.5 h-3.5" />
                            {(article.views || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="comic-panel comic-dots bg-white border-2 border-zn-border/60 p-6 text-center">
              <p className="font-display font-black uppercase tracking-[0.08em] text-zn-text mb-2">
                Няма още публикации за тази секция
              </p>
              <p className="text-sm text-zn-text-muted mb-4">
                Добавете нова статия или обновете данните.
              </p>
              <button
                type="button"
                onClick={() => refresh()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-xs font-sans font-semibold uppercase tracking-[0.06em] hover:bg-zn-purple-dark transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Обнови
              </button>
            </div>
          )}

          {horizontalAds[1] && (
            <div className="pt-1">
              <AdBannerHorizontal ad={horizontalAds[1]} />
            </div>
          )}

          {latestWire.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {latestWire.map((article, index) => {
                const rank = index + 1;
                const rankClass = rank === 1 ? 'trending-number-1' : rank === 2 ? 'trending-number-2' : rank === 3 ? 'trending-number-3' : 'trending-number-default';
                const categoryName = categoryById.get(article.category) || 'Новини';
                const tilt = `${index % 2 === 0 ? -0.6 : 0.6}deg`;

                return (
                  <Link
                    key={article.id}
                    to={`/article/${article.id}`}
                    className="comic-wire-card comic-panel bg-white p-3 flex items-start gap-3"
                    style={{ '--wire-tilt': tilt }}
                  >
                    <span className={`trending-number ${rankClass}`}>{rank}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-display font-black uppercase tracking-[0.14em] text-zn-text-dim mb-1">
                        {categoryName} • {formatArticleDateLabel(article)}
                      </p>
                      <h4 className="font-display font-black uppercase text-sm leading-snug text-zn-black line-clamp-2 hover:text-zn-hot transition-colors">
                        {article.title}
                      </h4>
                    </div>
                    <span className="text-[11px] font-display font-black text-zn-hot whitespace-nowrap pl-2">
                      {(article.views || 0).toLocaleString()}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ═══ Reportage ═══ */}
          {reportageArticles.length > 0 && (
            <section className="pt-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="comic-ribbon-gold" style={{ transform: 'rotate(0.5deg)' }}>
                  Репортажи
                </div>
                <div className="flex-1 h-1 bg-gradient-to-r from-zn-orange/40 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {reportageArticles.map((article, index) => {
                  const design = getComicCardStyle('homeReportage', index, article, layoutPresets.homeReportage);
                  return (
                    <ComicNewsCard
                      key={article.id}
                      article={article}
                      tilt={design.tilt}
                      variant={design.variant}
                      sticker={design.sticker}
                      stripe={design.stripe}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ Breaking Category ═══ */}
          {breakingArticles.length > 0 && (
            <section className="pt-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="comic-ribbon-hot" style={{ transform: 'rotate(-0.4deg)' }}>
                  Спешни
                </div>
                <div className="flex-1 h-1 bg-gradient-to-r from-zn-hot/40 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {breakingArticles.map((article, index) => {
                  const design = getComicCardStyle('homeEmergency', index, article, layoutPresets.homeEmergency);
                  return (
                    <ComicNewsCard
                      key={article.id}
                      article={article}
                      tilt={design.tilt}
                      variant={design.variant}
                      sticker={design.sticker}
                      stripe={design.stripe}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* ═══ EMS / Police ═══ */}
          {emergencyArticles.length > 0 && (
            <section className="pt-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="comic-ribbon-hot" style={{ transform: 'rotate(-0.4deg)' }}>
                  Полиция
                </div>
                <div className="flex-1 h-1 bg-gradient-to-r from-zn-hot/40 to-transparent" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {emergencyArticles.map((article, index) => {
                  const design = getComicCardStyle('homeEmergency', index, article, layoutPresets.homeEmergency);
                  return (
                    <ComicNewsCard
                      key={article.id}
                      article={article}
                      tilt={design.tilt}
                      variant={design.variant}
                      sticker={design.sticker}
                      stripe={design.stripe}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <TrendingSidebar />
          <MostWanted />
          <PollWidget />
          {sideAds.slice(0, 2).map(ad => (
            <AdBannerSide key={ad.id} ad={ad} />
          ))}
        </div>
      </div>

      {/* ═══ BOTTOM TABLOID PILLS — rounded, exactly like the images ═══ */}
      <section className="py-4">
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          {bottomPills.map((pill, index) => (
            <Link
              key={`${pill.to}-${pill.label}-${index}`}
              to={pill.to}
              className={`${pill.className} text-base justify-center flex-1 sm:flex-initial`}
              style={{ '--pill-tilt': pill.tilt }}
            >
              <pill.Icon className="w-5 h-5" />
              {pill.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ Bottom Ad ═══ */}
      <section><AdBannerHorizontal ad={horizontalAds[horizontalAds.length - 1]} /></section>
    </div>
  );
}
