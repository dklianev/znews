import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Eye, Flame, Megaphone } from 'lucide-react';
import { motion } from 'motion/react';
import ResponsiveImage from './ResponsiveImage';
import { buildScaledClamp, normalizeHeroTitleScale } from '../utils/heroTitleScale';
import { formatNewsDate } from '../utils/newsDate';

const defaultFallbackImg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" fill="%23EDE6DA"><rect width="800" height="450"/><text x="400" y="225" text-anchor="middle" font-family="Oswald,sans-serif" font-size="28" font-weight="900" fill="%23C4B49A">zNews</text></svg>');

function ColorTitle({ text }) {
    const words = text.split(' ');
    return (
        <span>
            {words.map((word, i) => (
                <span key={i} className={i % 3 !== 0 ? 'hero-title-dark-word' : undefined} style={{ color: i % 3 === 0 ? '#CC0A1A' : '#1C1428', WebkitTextStroke: i % 3 === 0 ? '1px rgba(153,8,19,0.3)' : 'none' }}>
                    {word}{' '}
                </span>
            ))}
        </span>
    );
}

export default function HeroSection({ article, author, category, heroPhotoArticle, siblingArticles = [], heroSettings, fallbackImg = defaultFallbackImg }) {
    if (!article) return null;
    const mainPhoto = heroPhotoArticle || article;
    const captions = Array.isArray(heroSettings?.captions) && heroSettings.captions.length === 3
        ? heroSettings.captions
        : ['В КОЛАТА НА ПОЛИЦАЯ!', 'ГОРЕЩА ПРЕГРЪДКА!', 'ТАЙНА СРЕЩА В ПАРКА!'];
    const headline = (heroSettings?.headline || 'ТАЙНИ СРЕЩИ НА ПЛАЖА\nИ ПАРКА!').split('\n').filter(Boolean);
    const shockLabel = heroSettings?.shockLabel || 'ШОК!';
    const ctaLabel = heroSettings?.ctaLabel || 'РАЗКРИЙ ВСИЧКО ТУК!';
    const heroTitleScale = useMemo(() => normalizeHeroTitleScale(heroSettings?.heroTitleScale), [heroSettings?.heroTitleScale]);
    const heroTitleFontSize = useMemo(() => buildScaledClamp('2.8rem', '8vw', '6.5rem', heroTitleScale), [heroTitleScale]);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="newspaper-page relative comic-panel comic-dots comic-speed-lines hero-sunset-bg">
            <div className="h-3 bg-gradient-to-r from-red-700 via-red-600 to-orange-500 border-y-2 border-black/30" />
            <div className="px-5 md:px-10 pt-6 pb-8 relative z-[1]">
                <div className="flex items-center gap-3 mb-3">
                    {article.breaking && (
                        <span className="breaking-badge flex items-center gap-1.5 text-xs">
                            <Flame className="w-3.5 h-3.5" /> ИЗВЪНРЕДНО
                        </span>
                    )}
                    {category && (
                        <span className="comic-kicker">{category.name}</span>
                    )}
                </div>
                <Link to={`/article/${article.id}`} prefetch="intent" className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F3EA]">
                    <div className="flex items-start gap-3 mb-4">
                        <Megaphone className="hidden md:inline-block mt-2 w-10 h-10 text-zn-hot" style={{ filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.3))', transform: 'rotate(-10deg)' }} aria-hidden="true" />
                        <h1 className="flex-1 min-w-0 font-display font-black uppercase leading-[0.88] cursor-pointer text-balance" style={{ fontSize: heroTitleFontSize, textShadow: '3px 3px 0 rgba(204,10,26,0.25), 5px 5px 0 rgba(0,0,0,0.15)', letterSpacing: '-0.03em' }}>
                            <ColorTitle text={article.title} />
                        </h1>
                        <div className="h-1.5 w-32 bg-gradient-to-r from-red-600 to-orange-500 mt-2 mb-1" />
                        <Megaphone className="hidden md:inline-block mt-2 w-10 h-10 text-zn-hot" style={{ filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.3))', transform: 'scaleX(-1) rotate(-10deg)' }} aria-hidden="true" />
                    </div>
                </Link>
                <p className="font-sans text-lg md:text-xl lg:text-2xl mb-3 leading-relaxed text-zn-text-dim" style={{ fontStyle: 'normal' }}>{article.excerpt}</p>
                <div className="flex items-center gap-4 text-xs font-display text-zn-text-dim uppercase tracking-wider mb-6">
                    {author && <span className="font-black text-zn-hot">{author.name}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {article.readTime} мин</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {(article.views || 0).toLocaleString()}</span>
                    <span className="normal-case">{formatNewsDate(article.date)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5 px-2 sm:px-0">
                    <Link to={`/article/${mainPhoto.id}`} prefetch="intent" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F3EA]">
                        <div className="polaroid-thick relative" style={{ '--tilt': '-2deg' }}>
                            <div className="tape tape-tl" />
                            <div className="tape tape-tr" />
                            <div className="hero-main-photo-media relative overflow-hidden" style={{ height: '320px' }}>
                                <ResponsiveImage
                                    src={mainPhoto.image}
                                    pipeline={mainPhoto.imageMeta}
                                    fallbackSrc={fallbackImg}
                                    alt={mainPhoto.title}
                                    className="hero-main-photo-image w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                    pictureClassName="block w-full h-full"
                                    sizes="(max-width: 640px) 100vw, 50vw"
                                    loading="eager"
                                    fetchPriority="high"
                                />
                                <div className="photo-caption">{captions[0]}</div>
                            </div>
                        </div>
                    </Link>
                    {siblingArticles[0] && (
                        <Link to={`/article/${siblingArticles[0].id}`} prefetch="intent" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F3EA]">
                            <div className="polaroid-thick relative" style={{ '--tilt': '2deg' }}>
                                <div className="tape tape-tl" />
                                <div className="relative overflow-hidden" style={{ height: '320px' }}>
                                    <ResponsiveImage
                                        src={siblingArticles[0].image}
                                        pipeline={siblingArticles[0].imageMeta}
                                        fallbackSrc={fallbackImg}
                                        alt={siblingArticles[0].title}
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                        pictureClassName="block w-full h-full"
                                        sizes="(max-width: 640px) 100vw, 50vw"
                                        loading="lazy"
                                    />
                                    <div className="photo-caption">{captions[1]}</div>
                                </div>
                            </div>
                        </Link>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 px-2 md:px-0">
                    <div>
                        <h2 className="section-header-red text-3xl md:text-4xl lg:text-5xl mb-4 leading-tight">
                            {headline.map((line, index) => (
                                <span key={`${line}-${index}`}>
                                    {line}
                                    {index < headline.length - 1 && <br />}
                                </span>
                            ))}
                        </h2>
                        <div className="space-y-3 mb-5">
                            {siblingArticles[0] && <p className="red-dot font-sans text-base md:text-lg leading-relaxed">{siblingArticles[0].excerpt}</p>}
                            {siblingArticles[1] && <p className="red-dot font-sans text-base md:text-lg leading-relaxed">{siblingArticles[1].excerpt}</p>}
                        </div>
                    </div>
                    <div className="relative">
                        <div className="absolute -top-5 -right-3 z-30">
                            <div className="starburst text-lg md:text-xl" style={{ padding: '16px 22px' }}>{shockLabel}</div>
                        </div>
                        {siblingArticles[1] ? (
                            <Link to={`/article/${siblingArticles[1].id}`} prefetch="intent" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F3EA]">
                                <div className="polaroid-thick relative" style={{ '--tilt': '-1deg' }}>
                                    <div className="tape tape-tr" />
                                    <div className="relative overflow-hidden" style={{ height: '280px' }}>
                                        <ResponsiveImage
                                            src={siblingArticles[1].image}
                                            pipeline={siblingArticles[1].imageMeta}
                                            fallbackSrc={fallbackImg}
                                            alt={siblingArticles[1].title}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                            pictureClassName="block w-full h-full"
                                            sizes="(max-width: 768px) 100vw, 42vw"
                                            loading="lazy"
                                        />
                                        <div className="photo-caption">{captions[2]}</div>
                                    </div>
                                </div>
                            </Link>
                        ) : (
                            <div className="polaroid-thick relative" style={{ '--tilt': '-1deg' }}>
                                <div className="relative overflow-hidden" style={{ height: '280px' }}>
                                    <ResponsiveImage
                                        src={fallbackImg}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        pictureClassName="block w-full h-full"
                                        sizes="(max-width: 768px) 100vw, 42vw"
                                        loading="lazy"
                                    />
                                    <div className="photo-caption">{captions[2]}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <Link to={`/article/${article.id}`} prefetch="intent" className="block text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-4 focus-visible:ring-offset-[#F7F3EA]">
                    <motion.span
                        initial={{ opacity: 0, scale: 0.96, y: 6 }}
                        animate={{ opacity: 1, scale: [1, 1.03, 1], y: [0, -2, 0] }}
                        transition={{
                            opacity: { duration: 0.35, ease: 'easeOut' },
                            scale: { duration: 2.1, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' },
                            y: { duration: 2.1, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' }
                        }}
                        whileHover={{ scale: 1.06, y: -3 }}
                        className="inline-block section-header-red text-3xl md:text-5xl cursor-pointer tracking-wider"
                        style={{ textShadow: '3px 3px 0 rgba(153,8,19,0.3), 5px 5px 0 rgba(0,0,0,0.1)' }}
                    >
                        {ctaLabel}
                    </motion.span>
                </Link>
            </div>
            <div className="h-3 bg-gradient-to-r from-orange-500 via-red-600 to-red-700 border-y-2 border-black/30" />
        </motion.div>
    );
}
