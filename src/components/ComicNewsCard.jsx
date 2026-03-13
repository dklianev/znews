import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Play, Clock } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import ResponsiveImage from './ResponsiveImage';
import { COMIC_CARD_VARIANTS } from '../utils/comicCardDesign';
import { formatNewsDate } from '../utils/newsDate';

const fallbackImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EDE4D0"/><stop offset="1" stop-color="#DDD3C2"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><text x="600" y="360" text-anchor="middle" font-family="Oswald,sans-serif" font-size="64" font-weight="900" fill="#C4B49A">LOS SANTOS NEWSWIRE</text></svg>');

export default memo(function ComicNewsCard({
  article,
  sticker = 'Новина',
  tilt = '0deg',
  compact = false,
  variant = 'auto',
  stripe = 'from-zn-hot to-zn-orange',
  className = '',
}) {
  const { categories } = usePublicData();
  const categoryName = categories.find(c => c.id === article.category)?.name || 'Новини';
  const resolvedVariant = variant === 'auto'
    ? COMIC_CARD_VARIANTS[Math.abs(Number(article.id) || 0) % COMIC_CARD_VARIANTS.length]
    : (COMIC_CARD_VARIANTS.includes(variant) ? variant : 'front');

  return (
    <Link
      to={`/article/${article.id}`}
      prefetch="intent"
      className={`group comic-latest-card comic-panel comic-dots bg-white overflow-visible relative block h-full comic-card-variant-${resolvedVariant} ${className}`}
      style={{ '--latest-tilt': tilt }}
    >
      <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${stripe}`} />
      {resolvedVariant === 'dossier' && <span className="comic-card-tape comic-card-tape-left" />}
      {(resolvedVariant === 'flash' || resolvedVariant === 'spotlight') && <span className="comic-card-tape comic-card-tape-right" />}
      <div className="absolute top-3 left-3 z-20">
        <span className={`comic-kicker comic-kicker-${resolvedVariant}`}>{categoryName}</span>
      </div>
      <div className="absolute -top-3 -right-2 z-30">
        <span className={`comic-sticker comic-sticker-${resolvedVariant}`}>{sticker}</span>
      </div>
      {article.sponsored && (
        <div className="absolute top-3 right-14 z-20">
          <span className="bg-emerald-600 text-white text-[9px] font-display font-black uppercase tracking-wider px-2 py-0.5 border border-emerald-800 shadow-sm">
            Платена
          </span>
        </div>
      )}

      <div className={`relative overflow-hidden bg-zn-black leading-none -mb-px ${compact ? 'aspect-[16/9]' : 'h-52'}`}>
        <ResponsiveImage
          src={article.image}
          pipeline={article.imageMeta}
          fallbackSrc={fallbackImage}
          alt={article.title}
          loading="lazy"
          decoding="async"
          sizes={compact ? '(max-width: 768px) 100vw, 24vw' : '(max-width: 768px) 100vw, 32vw'}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          pictureClassName="block w-full h-full leading-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
        {article.youtubeUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-10 bg-zn-hot/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg group-hover:bg-[#ff0000] group-hover:scale-110 transition-all duration-500 border-2 border-white/30">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 px-2 py-1 text-[10px] font-display font-black tracking-[0.12em] text-white border border-white/40 bg-black/35 normal-case">
          {formatNewsDate(article.date)}
        </div>
      </div>

      <div className={`relative z-10 flex flex-col justify-between ${compact ? 'p-3 gap-2' : 'p-4 gap-3'}`}>
        <h3 className={`font-display font-black uppercase text-zn-black group-hover:text-zn-hot transition-colors line-clamp-3 text-balance ${compact ? 'text-[1.08rem] leading-[1.1]' : 'text-[1.45rem] leading-[1.05]'}`}>
          {article.title}
        </h3>
        <p className={`text-zn-text-muted italic line-clamp-2 ${compact ? 'text-sm' : 'text-base'}`}>
          {article.excerpt}
        </p>
        <div className="flex items-center justify-between border-t-2 border-zn-border/50 pt-2 text-xs font-display font-black uppercase tracking-[0.08em] text-zn-text-dim">
          <span>{categoryName}</span>
          <div className="inline-flex items-center gap-3">
            {article.readTime > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {article.readTime} мин
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-zn-hot">
              <Eye className="w-3.5 h-3.5" />
              {(article.views || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
})
