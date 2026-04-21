import { Suspense, lazy, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import ArticleCard from '../components/ArticleCard';
import AdSlot from '../components/ads/AdSlot';
import { useArticlesData, useSettingsData, useTaxonomyData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Flame, Megaphone, Bell, Siren, TrendingUp, Eye, RefreshCw, AlertTriangle, Zap, Newspaper, ShieldAlert, ChevronRight } from 'lucide-react';
import ComicNewsCard from '../components/ComicNewsCard';
import ResponsiveImage from '../components/ResponsiveImage';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { getLatestWallImageSizes } from '../utils/imageSizes';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { homeCopy } from '../content/uiCopy';
import { buildHomepageSections } from '../../shared/homepageSelectors.js';
import GamesDailyStatus from '../components/games/GamesDailyStatus';
import EasterDecorations from '../components/seasonal/EasterDecorations';
import { formatNewsDate } from '../utils/newsDate';

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

const DEFAULT_HOME_SPOTLIGHT_LINKS = homeCopy.defaultBottomPills;

const NAV_PILL_VARIANTS = ['nav-pill-hot', 'nav-pill-purple', 'nav-pill-navy'];
const LATEST_STICKER_FALLBACKS = [
  homeCopy.latestLeadSticker,
  homeCopy.latestSecondSticker,
  homeCopy.latestThirdSticker,
  homeCopy.latestFourthSticker,
  homeCopy.latestFifthSticker,
];
const QUICK_CATEGORY_PREVIEW_COUNT = 8;
const HomeSidebarRail = lazy(() => import('../components/HomeSidebarRail'));

function formatArticleDateLabel(article) {
  if (article?.publishAt) {
    return formatNewsDate(article.publishAt);
  }
  return formatNewsDate(article?.date);
}

function getLatestCardLayout({ count, index, mdCols }) {
  const normalizedCols = Number.isFinite(Number(mdCols)) ? Number(mdCols) : 6;

  if (count === 1) {
    return {
      cardModeClass: 'comic-latest-card-lead',
      imageHeightClass: 'h-72 md:h-[420px]',
      titleSizeClass: 'text-2xl md:text-3xl',
      excerptSizeClass: 'line-clamp-4 text-base',
      imageSizes: getLatestWallImageSizes(12),
    };
  }

  if (count === 2) {
    return {
      cardModeClass: 'comic-latest-card-balanced',
      imageHeightClass: 'h-60 md:h-[320px]',
      titleSizeClass: 'text-xl md:text-2xl',
      excerptSizeClass: 'line-clamp-3 text-base',
      imageSizes: getLatestWallImageSizes(6),
    };
  }

  if (index === 0) {
    return {
      cardModeClass: 'comic-latest-card-lead',
      imageHeightClass: 'h-64 md:h-[360px]',
      titleSizeClass: 'text-2xl md:text-3xl',
      excerptSizeClass: 'line-clamp-3 text-base',
      imageSizes: getLatestWallImageSizes(normalizedCols),
    };
  }

  if (normalizedCols >= 8) {
    return {
      cardModeClass: 'comic-latest-card-wide',
      imageHeightClass: 'h-52 md:h-[280px]',
      titleSizeClass: 'text-xl md:text-2xl',
      excerptSizeClass: 'line-clamp-3 text-base',
      imageSizes: getLatestWallImageSizes(normalizedCols),
    };
  }

  if (normalizedCols === 6) {
    return {
      cardModeClass: 'comic-latest-card-half',
      imageHeightClass: 'h-48 md:h-56',
      titleSizeClass: 'text-xl',
      excerptSizeClass: 'line-clamp-3 text-base',
      imageSizes: getLatestWallImageSizes(6),
    };
  }

  return {
    cardModeClass: 'comic-latest-card-brief',
    imageHeightClass: 'h-44 md:h-48',
    titleSizeClass: 'text-lg',
    excerptSizeClass: 'line-clamp-3 text-sm',
    imageSizes: getLatestWallImageSizes(normalizedCols),
  };
}

function HomePageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-3 md:px-4 py-5 space-y-6 animate-pulse">
      <div className="h-14 w-[22rem] max-w-full mx-auto bg-zn-text/10 rounded" />
      <div className="comic-panel comic-dots bg-white p-5 md:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-6 w-28 rounded bg-zn-text/10" />
          <div className="h-5 w-24 rounded bg-zn-text/10" />
        </div>
        <div className="mb-4 flex min-h-[7rem] sm:min-h-[8.5rem] md:min-h-[10rem] lg:min-h-[11rem] items-start gap-3">
          <div className="hidden md:block h-10 w-10 rounded-full bg-zn-text/10 shrink-0 mt-2" />
          <div className="flex-1 space-y-3">
            <div className="h-12 w-11/12 rounded bg-zn-text/10" />
            <div className="h-12 w-10/12 rounded bg-zn-text/10" />
            <div className="h-12 w-8/12 rounded bg-zn-text/10" />
          </div>
          <div className="hidden md:block h-10 w-10 rounded-full bg-zn-text/10 shrink-0 mt-2" />
        </div>
        <div className="mb-3 space-y-2">
          <div className="h-5 w-full rounded bg-zn-text/10" />
          <div className="h-5 w-10/12 rounded bg-zn-text/10" />
        </div>
        <div className="mb-6 flex items-center gap-4">
          <div className="h-4 w-24 rounded bg-zn-text/10" />
          <div className="h-4 w-20 rounded bg-zn-text/10" />
          <div className="h-4 w-20 rounded bg-zn-text/10" />
          <div className="h-4 w-28 rounded bg-zn-text/10" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5 px-2 sm:px-0">
          <div className="h-[320px] rounded bg-zn-text/10" />
          <div className="h-[320px] rounded bg-zn-text/10" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 px-2 md:px-0">
          <div className="space-y-3">
            <div className="h-10 w-9/12 rounded bg-zn-text/10" />
            <div className="h-10 w-8/12 rounded bg-zn-text/10" />
            <div className="h-4 w-full rounded bg-zn-text/10" />
            <div className="h-4 w-11/12 rounded bg-zn-text/10" />
            <div className="h-4 w-10/12 rounded bg-zn-text/10" />
            <div className="h-4 w-full rounded bg-zn-text/10" />
            <div className="h-4 w-9/12 rounded bg-zn-text/10" />
          </div>
          <div className="h-[280px] rounded bg-zn-text/10" />
        </div>
        <div className="h-12 w-72 mx-auto max-w-full rounded bg-zn-text/10" />
      </div>
      <div className="h-48 bg-zn-text/10 rounded" />
      <div className="h-20 bg-zn-text/10 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="comic-panel comic-dots bg-white p-4">
              <div className="h-44 w-full bg-zn-text/10 rounded mb-3" />
              <div className="h-5 w-11/12 bg-zn-text/10 rounded mb-2" />
              <div className="h-3 w-full bg-zn-text/10 rounded mb-1" />
              <div className="h-3 w-9/12 bg-zn-text/10 rounded" />
            </div>
          ))}
        </div>
        <SidebarPlaceholder />
      </div>
    </div>
  );
}

function SidebarPlaceholder() {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="comic-panel comic-dots bg-white/85 dark:bg-slate-900/80 p-5 animate-pulse"
        >
          <div className="h-4 w-28 bg-zn-text/10 rounded mb-4" />
          <div className="space-y-3">
            <div className="h-16 bg-zn-text/10 rounded" />
            <div className="h-16 bg-zn-text/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionActionLink({ to, label, mobile = false }) {
  if (mobile) {
    return (
      <div className="md:hidden clear-both pt-5 pb-1">
        <Link
          to={to}
          prefetch="intent"
          className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center gap-1.5 border-3 border-[#1C1428] bg-white px-4 py-3 font-display text-xs font-black uppercase tracking-[0.16em] text-zn-text shadow-[4px_4px_0_#1C1428] transition-[transform,background-color,color] duration-200 hover:-translate-y-0.5 hover:bg-zn-purple hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-4 focus-visible:ring-offset-zn-paper dark:bg-slate-950 dark:text-white dark:focus-visible:ring-offset-slate-950"
        >
          <span>{label}</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Link>
      </div>
    );
  }

  const className = 'hidden md:inline-flex items-center gap-1 rounded-none border-2 border-[#1C1428] bg-white px-3 py-1.5 font-display text-[11px] font-black uppercase tracking-[0.16em] text-zn-text shadow-[3px_3px_0_#1C1428] transition-[transform,background-color,color] duration-200 hover:-translate-y-0.5 hover:bg-zn-purple hover:text-white';

  return (
    <Link to={to} prefetch="intent" className={className}>
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

export default function HomePage() {
  const { articles, loading, loadError, refresh, homepage } = useArticlesData();
  const { categories } = useTaxonomyData();
  const { ads, heroSettings, siteSettings } = useSettingsData();
  const layoutPresets = siteSettings?.layoutPresets || {};
  const [showAllQuickCategories, setShowAllQuickCategories] = useState(false);
  const homepageArticlePool = Array.isArray(homepage?.articlePool) && homepage.articlePool.length > 0
    ? homepage.articlePool
    : null;
  const primaryArticlePool = homepageArticlePool || articles;
  const homepageSectionsPayload = homepage?.sections && typeof homepage.sections === 'object'
    ? homepage.sections
    : null;
  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const safeArticlePool = useMemo(() => (Array.isArray(primaryArticlePool) ? primaryArticlePool : []), [primaryArticlePool]);

  useDocumentTitle();

  const articleById = useMemo(() => new Map(
    safeArticlePool
      .map((article) => [Number(article?.id), article])
      .filter(([id, article]) => Number.isFinite(id) && id > 0 && article)
  ), [safeArticlePool]);

  const derivedHomepageSections = useMemo(() => buildHomepageSections({
    articles: safeArticlePool,
    heroSettings,
    latestShowcaseLimit: 5,
    latestWireLimit: 16,
  }), [safeArticlePool, heroSettings]);

  const {
    heroArticle,
    featuredArticles,
    crimeArticles,
    breakingArticles,
    emergencyArticles,
    reportageArticles,
    sponsoredArticles,
    latestShowcase,
    latestWire,
    heroPrimaryPhoto,
    heroSiblings,
  } = useMemo(() => {
    const hasSectionKey = (key) => Boolean(homepageSectionsPayload) && Object.prototype.hasOwnProperty.call(homepageSectionsPayload, key);
    const pickArticle = (id) => articleById.get(Number(id)) || null;
    const pickArticleList = (ids) => {
      const seen = new Set();
      return (Array.isArray(ids) ? ids : [])
        .map((id) => pickArticle(id))
        .filter((article) => {
          const articleId = Number(article?.id);
          if (!Number.isFinite(articleId) || articleId <= 0 || seen.has(articleId)) return false;
          seen.add(articleId);
          return true;
        });
    };

    const heroArticle = hasSectionKey('heroArticleId')
      ? (pickArticle(homepageSectionsPayload.heroArticleId) || derivedHomepageSections.heroArticle)
      : derivedHomepageSections.heroArticle;
    const heroPrimaryPhoto = hasSectionKey('heroPrimaryPhotoId')
      ? (pickArticle(homepageSectionsPayload.heroPrimaryPhotoId) || derivedHomepageSections.heroPrimaryPhoto)
      : derivedHomepageSections.heroPrimaryPhoto;
    const heroSiblings = hasSectionKey('heroSiblingIds')
      ? pickArticleList(homepageSectionsPayload.heroSiblingIds)
      : derivedHomepageSections.heroSiblings;
    const featuredArticles = hasSectionKey('featuredIds')
      ? pickArticleList(homepageSectionsPayload.featuredIds)
      : derivedHomepageSections.featuredArticles;
    const crimeArticles = hasSectionKey('crimeIds')
      ? pickArticleList(homepageSectionsPayload.crimeIds)
      : derivedHomepageSections.crimeArticles;
    const breakingArticles = hasSectionKey('breakingIds')
      ? pickArticleList(homepageSectionsPayload.breakingIds)
      : derivedHomepageSections.breakingArticles;
    const emergencyArticles = hasSectionKey('emergencyIds')
      ? pickArticleList(homepageSectionsPayload.emergencyIds)
      : derivedHomepageSections.emergencyArticles;
    const reportageArticles = hasSectionKey('reportageIds')
      ? pickArticleList(homepageSectionsPayload.reportageIds)
      : derivedHomepageSections.reportageArticles;
    const sponsoredArticles = hasSectionKey('sponsoredIds')
      ? pickArticleList(homepageSectionsPayload.sponsoredIds)
      : derivedHomepageSections.sponsoredArticles;
    const latestShowcaseRaw = hasSectionKey('latestShowcaseIds')
      ? pickArticleList(homepageSectionsPayload.latestShowcaseIds)
      : derivedHomepageSections.latestShowcase;
    const latestWireRaw = hasSectionKey('latestWireIds')
      ? pickArticleList(homepageSectionsPayload.latestWireIds)
      : derivedHomepageSections.latestWire;
    const latestShowcaseIds = new Set(
      latestShowcaseRaw
        .map((article) => Number(article?.id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );
    const latestWire = latestWireRaw.filter((article) => {
      const articleId = Number(article?.id);
      if (!Number.isFinite(articleId) || articleId <= 0) return true;
      return !latestShowcaseIds.has(articleId);
    });

    return {
      heroArticle,
      featuredArticles,
      crimeArticles,
      breakingArticles,
      emergencyArticles,
      reportageArticles,
      sponsoredArticles,
      latestShowcase: latestShowcaseRaw,
      latestWire,
      heroPrimaryPhoto,
      heroSiblings,
    };
  }, [articleById, derivedHomepageSections, homepageSectionsPayload]);

  const categoryById = useMemo(() => new Map(safeCategories.map((category) => [category.id, category.name])), [safeCategories]);

  const quickCategoryLinks = useMemo(() => {
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

    return [...quickCategoriesFromNavbar, ...quickCategoryRemainder];
  }, [safeCategories, siteSettings?.navbarLinks]);

  const bottomPills = useMemo(() => {
    const spotlightSource = Array.isArray(siteSettings?.spotlightLinks) && siteSettings.spotlightLinks.length > 0
      ? siteSettings.spotlightLinks
      : DEFAULT_HOME_SPOTLIGHT_LINKS;
    const bottomPillSource = (spotlightSource.length > 0 ? spotlightSource : DEFAULT_HOME_SPOTLIGHT_LINKS)
      .filter((item) => item?.to !== '/games');

    return (bottomPillSource.length > 0 ? bottomPillSource : DEFAULT_HOME_SPOTLIGHT_LINKS)
      .slice(0, 3)
      .map((item, index) => ({
        to: typeof item?.to === 'string' && item.to ? item.to : DEFAULT_HOME_SPOTLIGHT_LINKS[index]?.to || '/',
        label: item?.label || DEFAULT_HOME_SPOTLIGHT_LINKS[index]?.label || homeCopy.defaultPillLabel,
        hot: Boolean(item?.hot),
        tilt: item?.tilt || DEFAULT_HOME_SPOTLIGHT_LINKS[index]?.tilt || '0deg',
        className: NAV_PILL_VARIANTS[index] || NAV_PILL_VARIANTS[NAV_PILL_VARIANTS.length - 1],
        Icon: SPOTLIGHT_ICON_MAP[item?.icon] || SPOTLIGHT_ICON_MAP[DEFAULT_HOME_SPOTLIGHT_LINKS[index]?.icon] || Flame,
      }));
  }, [siteSettings?.spotlightLinks]);

  const headlineBoardWords = useMemo(() => (heroSettings?.headlineBoardText || homeCopy.defaultHeadlineWords.join(' '))
    .trim()
    .split(/\s+/)
    .filter(Boolean), [heroSettings?.headlineBoardText]);
  const hasExpandableQuickCategories = quickCategoryLinks.length > QUICK_CATEGORY_PREVIEW_COUNT;
  const visibleQuickCategoryLinks = hasExpandableQuickCategories && !showAllQuickCategories
    ? quickCategoryLinks.slice(0, QUICK_CATEGORY_PREVIEW_COUNT)
    : quickCategoryLinks;

  if (loading) {
    return <HomePageSkeleton />;
  }

  if (loadError && (!articles || articles.length === 0)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="comic-headline-board mb-5 inline-flex">
          <span className="comic-headline-board-word comic-headline-board-word-hot">{homeCopy.loadErrorBadge}</span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-black text-zn-black mb-3 uppercase">
          {homeCopy.loadErrorTitle}
        </h1>
        <p className="font-display text-zn-text-muted uppercase tracking-wider text-sm mb-8 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-zn-hot shrink-0" />
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-zn-purple text-white text-sm font-display font-black uppercase tracking-wider border-3 border-[#1C1428] hover:bg-zn-purple-dark transition-colors"
          style={{ boxShadow: '4px 4px 0 #1C1428' }}
        >
          <RefreshCw className="w-4 h-4" />
          {homeCopy.loadErrorRetry}
        </button>
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="comic-headline-board mb-6 inline-flex">
          <span className="comic-headline-board-word comic-headline-board-word-hot">{homeCopy.emptyBadge}</span>
        </div>
        <h1 className="font-display text-4xl font-black text-zn-black mb-4 uppercase">{homeCopy.emptyTitle}</h1>
        <p className="font-display text-zn-text-muted uppercase tracking-wider">{homeCopy.emptyBody}</p>
      </div>
    );
  }
  const getDynamicSlots = (count) => {
    if (count === 1) return [{ span: 'col-span-1 md:col-span-12', mdCols: 12, tilt: '-1.2deg', sticker: LATEST_STICKER_FALLBACKS[0] }];
    if (count === 2) return [
      { span: 'col-span-1 md:col-span-6', mdCols: 6, tilt: '-1.2deg', sticker: LATEST_STICKER_FALLBACKS[0] },
      { span: 'col-span-1 md:col-span-6', mdCols: 6, tilt: '1deg', sticker: LATEST_STICKER_FALLBACKS[1] }
    ];
    if (count === 3) return [
      { span: 'col-span-1 md:col-span-12', mdCols: 12, tilt: '-1.2deg', sticker: LATEST_STICKER_FALLBACKS[0] },
      { span: 'col-span-1 md:col-span-6', mdCols: 6, tilt: '1deg', sticker: LATEST_STICKER_FALLBACKS[1] },
      { span: 'col-span-1 md:col-span-6', mdCols: 6, tilt: '-0.9deg', sticker: LATEST_STICKER_FALLBACKS[2] }
    ];
    if (count === 4) return [
      { span: 'col-span-1 md:col-span-12', mdCols: 12, tilt: '-1.2deg', sticker: LATEST_STICKER_FALLBACKS[0] },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '1deg', sticker: LATEST_STICKER_FALLBACKS[1] },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '-0.9deg', sticker: LATEST_STICKER_FALLBACKS[2] },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '0.8deg', sticker: LATEST_STICKER_FALLBACKS[3] }
    ];
    return [
      { span: 'col-span-1 md:col-span-8 md:row-span-2', mdCols: 8, tilt: '-1.2deg', sticker: LATEST_STICKER_FALLBACKS[0] },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '1deg', sticker: LATEST_STICKER_FALLBACKS[1] },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '-0.9deg', sticker: LATEST_STICKER_FALLBACKS[2] },
      { span: 'col-span-1 md:col-span-4', mdCols: 4, tilt: '0.8deg', sticker: LATEST_STICKER_FALLBACKS[3] },
      { span: 'col-span-1 md:col-span-8', mdCols: 8, tilt: '-0.8deg', sticker: LATEST_STICKER_FALLBACKS[4] },
    ];
  };
  const latestSlots = getDynamicSlots(latestShowcase.length);

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-4 py-5 space-y-6">

      {/* ═══ STARBURST CALLOUT ═══ */}
      <section className="text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.34, ease: 'easeOut' }}
          className="inline-block relative z-[2]"
        >
          <div className="comic-headline-board inline-flex">
            {(headlineBoardWords.length > 0 ? headlineBoardWords : homeCopy.defaultHeadlineWords).map((word, index, words) => {
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
      <section className="relative">
        <ArticleCard article={heroArticle} size="hero" heroPhotoArticle={heroPrimaryPhoto} siblingArticles={heroSiblings} />
        <EasterDecorations pageId="homepage" />
      </section>

      <div className="flex flex-col gap-6">
        {/* ═══ Games Teaser ═══ */}
        <section className="order-2 md:order-1">
          <GamesDailyStatus />
        </section>

        {/* ═══ Ad ═══ */}
        <section className="order-3 md:order-2"><AdSlot ads={ads} slot="home.top" pageType="home" /></section>

        {/* ═══ Featured — "ГОРЕЩО ОТ РЕДАКЦИЯТА" ═══ */}
        <section className="order-1 md:order-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="comic-ribbon-hot" style={{ transform: 'rotate(-0.7deg)' }}>
              <Flame className="w-5 h-5" /> {homeCopy.featuredLabel}
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
      </div>

      {/* ═══ Sponsored / Платени публикации ═══ */}
      {sponsoredArticles.length > 0 && (
        <section className="relative comic-panel bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 dark:from-emerald-950/30 dark:via-slate-950 dark:to-emerald-900/20 p-4 md:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-600 text-white px-4 py-1.5 font-display font-black text-sm uppercase tracking-wider border-2 border-emerald-800 shadow-md flex items-center gap-2" style={{ transform: 'rotate(-0.5deg)' }}>
              💰 {homeCopy.sponsoredLabel}
            </div>
            <div className="flex-1 h-1 bg-gradient-to-r from-emerald-500/40 to-transparent" />
          </div>
          <p className="mb-4 font-display text-[11px] font-black uppercase tracking-[0.16em] text-emerald-900/80 dark:text-emerald-200/80">
            {homeCopy.sponsoredDisclosure}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sponsoredArticles.map((article, index) => {
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
      )}

      {/* ═══ Crime & Underground ═══ */}
      <section className="comic-grid-backdrop overflow-visible p-4 md:p-6 relative" style={{ transform: 'rotate(-0.35deg)' }}>
        {/* Corner tape */}
        <div className="tape tape-tl" />
        <div className="tape tape-br" />

        <div className="flex items-center gap-3 mb-4">
          <div className="comic-ribbon-navy" style={{ transform: 'rotate(0.7deg)' }}>
            <Siren className="w-5 h-5" /> {homeCopy.crimeLabel}
          </div>
          <div className="flex-1 h-1 bg-gradient-to-r from-zn-navy/40 to-transparent" />
          <SectionActionLink to="/category/crime-underground" label={homeCopy.sectionViewAllLabel} />
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
        <SectionActionLink to="/category/crime-underground" label={homeCopy.sectionViewAllLabel} mobile />
      </section>

      {/* ═══ Quick Categories ═══ */}
      <section>
        <div className="flex flex-wrap gap-2 justify-center">
          {visibleQuickCategoryLinks.map((cat, index) => (
            <Link
              key={cat.id}
              to={cat.to}
              prefetch="intent"
              className={`comic-chip ${cat.hot ? 'comic-chip-hot' : ''}`}
              style={{ '--chip-tilt': `${index % 2 === 0 ? -1.4 : 1.2}deg` }}
            >
              {cat.name}
            </Link>
          ))}
        </div>
        {hasExpandableQuickCategories && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setShowAllQuickCategories((prev) => !prev)}
              className="inline-flex items-center gap-2 border-3 border-[#1C1428] bg-white px-4 py-2 font-display text-xs font-black uppercase tracking-[0.16em] text-zn-text shadow-[4px_4px_0_#1C1428] transition-all duration-200 hover:bg-zn-purple hover:text-white"
            >
              {showAllQuickCategories ? homeCopy.quickCategoriesLessLabel : homeCopy.quickCategoriesMoreLabel}
            </button>
          </div>
        )}
      </section>

      {/* ═══ Main + Sidebar ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="comic-ribbon-purple" style={{ transform: 'rotate(-0.5deg)' }}>
              <TrendingUp className="w-5 h-5" /> {homeCopy.latestLabel}
            </div>
            <div className="flex-1 h-1 bg-gradient-to-r from-zn-purple/40 to-transparent" />
            <SectionActionLink to="/latest" label={homeCopy.latestMoreLabel} />
          </div>

          {latestShowcase.length > 0 ? (
            <div className="comic-latest-wall grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[minmax(140px,auto)] md:items-start">
              {latestShowcase.map((article, index) => {
                const slot = latestSlots[index] || { span: 'md:col-span-6', mdCols: 6, tilt: '0deg', sticker: homeCopy.latestThirdSticker };
                const latestCardLayout = getLatestCardLayout({
                  count: latestShowcase.length,
                  index,
                  mdCols: slot.mdCols,
                });
                const categoryName = categoryById.get(article.category) || homeCopy.defaultCategoryLabel;

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
                      <div className={`relative overflow-hidden bg-zn-black leading-none -mb-px shrink-0 ${latestCardLayout.imageHeightClass}`}>
                        <ResponsiveImage
                          src={article.image}
                          pipeline={article.imageMeta}
                          fallbackSrc={fallbackLatestImage}
                          alt={article.title}
                          loading="lazy"
                          decoding="async"
                          sizes={latestCardLayout.imageSizes}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          pictureClassName="block w-full h-full leading-none"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                        <div className="absolute bottom-3 left-3 px-2 py-1 text-[10px] font-display font-black tracking-[0.16em] text-white border border-white/40 bg-black/35 normal-case">
                          {formatArticleDateLabel(article)}
                        </div>
                      </div>

                      <div className={`relative z-10 p-4 flex flex-col justify-between gap-3 flex-1`}>
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
                {homeCopy.latestEmptyTitle}
              </p>
              <p className="text-sm text-zn-text-muted mb-4">
                {homeCopy.latestEmptyBody}
              </p>
              <button
                type="button"
                onClick={() => refresh()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-xs font-sans font-semibold uppercase tracking-[0.06em] hover:bg-zn-purple-dark transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {homeCopy.latestEmptyButton}
              </button>
            </div>
          )}

          <AdSlot ads={ads} slot="home.feed.afterShowcase" pageType="home" className="pt-1" />

          {latestWire.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {latestWire.map((article, index) => {
                const rank = index + 1;
                const rankClass = rank === 1 ? 'trending-number-1' : rank === 2 ? 'trending-number-2' : rank === 3 ? 'trending-number-3' : 'trending-number-default';
                const categoryName = categoryById.get(article.category) || homeCopy.defaultCategoryLabel;
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
                        {categoryName} • <span className="normal-case">{formatArticleDateLabel(article)}</span>
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
          <SectionActionLink to="/latest" label={homeCopy.latestMoreLabel} mobile />

          {/* ═══ Reportage ═══ */}
          {reportageArticles.length > 0 && (
            <section className="below-fold-section pt-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="comic-ribbon-gold" style={{ transform: 'rotate(0.5deg)' }}>
                  {homeCopy.reportageLabel}
                </div>
                <div className="flex-1 h-1 bg-gradient-to-r from-zn-orange/40 to-transparent" />
                <SectionActionLink to="/category/reportage" label={homeCopy.sectionViewAllLabel} />
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
              <SectionActionLink to="/category/reportage" label={homeCopy.sectionViewAllLabel} mobile />
            </section>
          )}

          {/* ═══ Breaking Category ═══ */}
          {breakingArticles.length > 0 && (
            <section className="below-fold-section pt-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="comic-ribbon-hot" style={{ transform: 'rotate(-0.4deg)' }}>
                  {homeCopy.breakingLabel}
                </div>
                <div className="flex-1 h-1 bg-gradient-to-r from-zn-hot/40 to-transparent" />
                <SectionActionLink to="/category/breaking" label={homeCopy.sectionViewAllLabel} />
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
              <SectionActionLink to="/category/breaking" label={homeCopy.sectionViewAllLabel} mobile />
            </section>
          )}

          {/* ═══ EMS / Police ═══ */}
          {emergencyArticles.length > 0 && (
            <section className="below-fold-section pt-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="comic-ribbon-hot" style={{ transform: 'rotate(-0.4deg)' }}>
                  {homeCopy.emergencyLabel}
                </div>
                <div className="flex-1 h-1 bg-gradient-to-r from-zn-hot/40 to-transparent" />
                <SectionActionLink to="/category/emergency" label={homeCopy.sectionViewAllLabel} />
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
              <SectionActionLink to="/category/emergency" label={homeCopy.sectionViewAllLabel} mobile />
            </section>
          )}
        </div>

        <Suspense fallback={<SidebarPlaceholder />}>
          <HomeSidebarRail ads={ads} />
        </Suspense>
      </div>

      {/* ═══ BOTTOM TABLOID PILLS — rounded, exactly like the images ═══ */}
      <section className="below-fold-section-compact py-4">
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          {bottomPills.map((pill, index) => (
            <Link
              key={`${pill.to}-${pill.label}-${index}`}
              to={pill.to}
              prefetch="intent"
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
      <section className="overflow-visible"><AdSlot ads={ads} slot="home.bottom" pageType="home" /></section>
    </div>
  );
}
