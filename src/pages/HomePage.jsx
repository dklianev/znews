import { useMemo } from 'react';
import { motion } from 'framer-motion';
import ArticleCard from '../components/ArticleCard';
import TrendingSidebar from '../components/TrendingSidebar';
import MostWanted from '../components/MostWanted';
import PollWidget from '../components/PollWidget';
import { AdBannerHorizontal, AdBannerSide } from '../components/AdBanner';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import { Flame, Megaphone, Bell, Siren, TrendingUp, Eye } from 'lucide-react';
import ComicNewsCard from '../components/ComicNewsCard';
import ResponsiveImage from '../components/ResponsiveImage';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const fallbackLatestImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EDE4D0"/><stop offset="1" stop-color="#DDD3C2"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><text x="600" y="360" text-anchor="middle" font-family="Oswald,sans-serif" font-size="64" font-weight="900" fill="#C4B49A">LOS SANTOS NEWSWIRE</text></svg>');

export default function HomePage() {
  const { articles, ads, categories, heroSettings, siteSettings } = useData();
  const layoutPresets = siteSettings?.layoutPresets || {};

  useDocumentTitle();

  const {
    heroArticle,
    featuredArticles,
    latestArticles,
    crimeArticles,
    breakingArticles,
    emergencyArticles,
    reportageArticles,
    activeCategories,
    categoryById,
    horizontalAds,
    sideAds,
    latestShowcase,
    latestWire,
    headlineBoardWords,
    heroPrimaryPhoto,
    heroSiblings,
  } = useMemo(() => {
    const safeArticles = Array.isArray(articles) ? articles : [];
    const safeCategories = Array.isArray(categories) ? categories : [];
    const safeAds = Array.isArray(ads) ? ads : [];

    const heroArticle = safeArticles.find(a => a.hero) || safeArticles.find(a => a.breaking) || safeArticles[0] || null;

    // Базови новини: Hero и Featured (тези никога няма да се повтарят никъде надолу)
    const usedTopIds = new Set();
    if (heroArticle) usedTopIds.add(heroArticle.id);

    const featuredArticles = safeArticles.filter(a => a.featured && !usedTopIds.has(a.id)).slice(0, 3);
    featuredArticles.forEach(a => usedTopIds.add(a.id));

    // Секция "Последни Новини": тук трябва да тече всичко ново хронологично, 
    // с изключение на вече показаните огромни банери най-горе (Hero/Featured).
    const latestArticles = safeArticles.filter(a => !usedTopIds.has(a.id));

    // Тематични секции: те просто си дърпат съответната категория (без Hero/Featured)
    const crimeArticles = safeArticles.filter(a => (a.category === 'crime' || a.category === 'underground') && !usedTopIds.has(a.id)).slice(0, 4);
    const breakingArticles = safeArticles.filter(a => a.category === 'breaking' && !usedTopIds.has(a.id)).slice(0, 2);
    const emergencyArticles = safeArticles.filter(a => a.category === 'emergency' && !usedTopIds.has(a.id)).slice(0, 2);
    const reportageArticles = safeArticles.filter(a => a.category === 'reportage' && !usedTopIds.has(a.id)).slice(0, 3);
    const activeCategories = safeCategories.filter(c => c.id !== 'all');
    const categoryById = new Map(safeCategories.map(c => [c.id, c.name]));

    const horizontalAds = safeAds.filter(a => a.type === 'horizontal');
    const sideAds = safeAds.filter(a => a.type === 'side');
    // The grid for showcase needs up to 5. If we have fewer, they still go here.
    // The rest go to the wire. If we want all of them in a simple list when there are few, we can do that,
    // but the current logic is: first 5 go to showcase, rest go to wire.
    const latestShowcase = latestArticles.slice(0, 5);
    const latestWire = latestArticles.slice(5);

    const headlineBoardWords = (heroSettings?.headlineBoardText || 'ШОК И СЕНЗАЦИЯ!')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    /* Hero photos can be manually selected from admin hero settings */
    const selectedMainPhotoId = Number.parseInt(heroSettings?.mainPhotoArticleId, 10);
    const selectedMainPhotoArticle = Number.isInteger(selectedMainPhotoId) && selectedMainPhotoId > 0
      ? safeArticles.find((a) => a.id === selectedMainPhotoId)
      : null;
    const heroPrimaryPhoto = selectedMainPhotoArticle || heroArticle;

    const selectedHeroSiblingIds = Array.isArray(heroSettings?.photoArticleIds) ? heroSettings.photoArticleIds : [];
    const selectedHeroSiblings = selectedHeroSiblingIds
      .map((id) => safeArticles.find((a) => a.id === id))
      .filter(Boolean)
      .filter((a, index, arr) => a.id !== heroPrimaryPhoto?.id && arr.findIndex((x) => x.id === a.id) === index)
      .slice(0, 2);
    const autoHeroSiblings = [...featuredArticles, ...latestArticles]
      .filter((a) => a.id !== heroPrimaryPhoto?.id && a.image)
      .slice(0, 2);
    const heroSiblings = [...selectedHeroSiblings, ...autoHeroSiblings.filter((a) => !selectedHeroSiblings.find((s) => s.id === a.id))].slice(0, 2);

    return {
      heroArticle,
      featuredArticles,
      latestArticles,
      crimeArticles,
      breakingArticles,
      emergencyArticles,
      reportageArticles,
      activeCategories,
      categoryById,
      horizontalAds,
      sideAds,
      latestShowcase,
      latestWire,
      headlineBoardWords,
      heroPrimaryPhoto,
      heroSiblings,
    };
  }, [articles, ads, categories, heroSettings]);

  if (!articles || articles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="comic-headline-board mb-6 inline-flex">
          <span className="comic-headline-board-word comic-headline-board-word-hot">ВНИМАНИЕ!</span>
        </div>
        <h1 className="font-display text-4xl font-black text-zn-black mb-4 uppercase">Няма публикации</h1>
        <p className="font-display text-zn-text-muted uppercase tracking-wider">Добавете статии от администраторския панел.</p>
      </div>
    );
  }
  const getDynamicSlots = (count) => {
    if (count === 1) return [{ span: 'col-span-1 md:col-span-12', tilt: '-1.2deg', sticker: 'Фронт' }];
    if (count === 2) return [
      { span: 'col-span-1 md:col-span-6', tilt: '-1.2deg', sticker: 'Фронт' },
      { span: 'col-span-1 md:col-span-6', tilt: '1deg', sticker: 'Досие' }
    ];
    if (count === 3) return [
      { span: 'col-span-1 md:col-span-12', tilt: '-1.2deg', sticker: 'Фронт' },
      { span: 'col-span-1 md:col-span-6', tilt: '1deg', sticker: 'Досие' },
      { span: 'col-span-1 md:col-span-6', tilt: '-0.9deg', sticker: 'Радар' }
    ];
    if (count === 4) return [
      { span: 'col-span-1 md:col-span-12', tilt: '-1.2deg', sticker: 'Фронт' },
      { span: 'col-span-1 md:col-span-4', tilt: '1deg', sticker: 'Досие' },
      { span: 'col-span-1 md:col-span-4', tilt: '-0.9deg', sticker: 'Радар' },
      { span: 'col-span-1 md:col-span-4', tilt: '0.8deg', sticker: 'Сигнал' }
    ];
    return [
      { span: 'col-span-1 md:col-span-8 md:row-span-2', tilt: '-1.2deg', sticker: 'Фронт' },
      { span: 'col-span-1 md:col-span-4', tilt: '1deg', sticker: 'Досиe' },
      { span: 'col-span-1 md:col-span-4', tilt: '-0.9deg', sticker: 'Радар' },
      { span: 'col-span-1 md:col-span-4', tilt: '0.8deg', sticker: 'Сигнал' },
      { span: 'col-span-1 md:col-span-8', tilt: '-0.8deg', sticker: 'Ключово' },
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
          {activeCategories.map((cat, index) => (
            <Link
              key={cat.id}
              to={`/category/${cat.id}`}
              className={`comic-chip ${['crime', 'underground', 'emergency', 'breaking'].includes(cat.id) ? 'comic-chip-hot' : ''}`}
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

          <div className="comic-latest-wall grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[minmax(140px,auto)]">
            {latestShowcase.map((article, index) => {
              const slot = latestSlots[index] || { span: 'md:col-span-6', tilt: '0deg', sticker: 'Новина' };
              const isLead = index === 0;
              const categoryName = categoryById.get(article.category) || 'Новини';

              return (
                <Link
                  key={article.id}
                  to={`/article/${article.id}`}
                  className={`group comic-latest-card ${isLead ? 'comic-latest-card-lead' : 'comic-latest-card-brief'} comic-panel comic-dots bg-white overflow-visible relative ${slot.span}`}
                  style={{ '--latest-tilt': slot.tilt }}
                >
                  <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${index % 2 === 0 ? 'from-zn-hot to-zn-orange' : 'from-zn-purple to-zn-blue'}`} />
                  <div className="absolute top-3 left-3 z-20">
                    <span className="comic-kicker">{categoryName}</span>
                  </div>
                  <div className="absolute -top-3 -right-2 z-30">
                    <span className="comic-sticker">{slot.sticker}</span>
                  </div>

                  <div className="flex flex-col h-full">
                    <div className={`relative overflow-hidden shrink-0 ${isLead ? 'h-64 md:h-[360px]' : 'h-44'}`}>
                      <ResponsiveImage
                        src={article.image}
                        pipeline={article.imageMeta}
                        fallbackSrc={fallbackLatestImage}
                        alt={article.title}
                        loading="lazy"
                        decoding="async"
                        sizes={isLead ? '(max-width: 768px) 100vw, 66vw' : '(max-width: 768px) 100vw, 33vw'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        pictureClassName="block w-full h-full"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 px-2 py-1 text-[10px] font-display font-black uppercase tracking-[0.16em] text-white border border-white/40 bg-black/35">
                        {article.date}
                      </div>
                    </div>

                    <div className={`p-4 flex flex-col justify-between gap-3 flex-1`}>
                      <h3 className={`font-display font-black uppercase leading-tight text-zn-black group-hover:text-zn-hot transition-colors ${isLead ? 'text-2xl md:text-3xl' : 'text-lg'} line-clamp-4`}>
                        {article.title}
                      </h3>
                      <p className={`text-zn-text-muted italic ${isLead ? 'line-clamp-3 text-base' : 'line-clamp-3 text-sm'}`}>
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
                        {categoryName} • {article.date}
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
          <Link to="/category/crime" className="nav-pill-hot text-base justify-center flex-1 sm:flex-initial" style={{ '--pill-tilt': '-1.3deg' }}>
            <Flame className="w-5 h-5" /> Горещи Новини
          </Link>
          <Link to="/category/underground" className="nav-pill-purple text-base justify-center flex-1 sm:flex-initial" style={{ '--pill-tilt': '1deg' }}>
            <Megaphone className="w-5 h-5" /> Скандали
          </Link>
          <Link to="/category/society" className="nav-pill-navy text-base justify-center flex-1 sm:flex-initial" style={{ '--pill-tilt': '-0.8deg' }}>
            <Bell className="w-5 h-5" /> Слухове
          </Link>
        </div>
      </section>

      {/* ═══ Bottom Ad ═══ */}
      <section><AdBannerHorizontal ad={horizontalAds[horizontalAds.length - 1]} /></section>
    </div>
  );
}
