import { useMemo } from 'react';
import { TrendingUp, Eye, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePublicData } from '../context/DataContext';

const numberClasses = [
  'trending-number trending-number-1',
  'trending-number trending-number-2',
  'trending-number trending-number-3',
  'trending-number trending-number-default',
  'trending-number trending-number-default',
];

export default function TrendingSidebar() {
  const { articles } = usePublicData();
  const trending = useMemo(() => {
    const safeArticles = Array.isArray(articles) ? articles : [];
    return safeArticles
      .map((article) => ({
        ...article,
        safeViews: Number.isFinite(Number(article?.views)) ? Number(article.views) : 0,
      }))
      .sort((a, b) => b.safeViews - a.safeViews)
      .slice(0, 5);
  }, [articles]);

  const maxViews = useMemo(
    () => Math.max(1, ...trending.map((article) => article.safeViews)),
    [trending],
  );

  if (trending.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="newspaper-page comic-panel p-5 pt-6 relative comic-dots comic-sidebar-widget overflow-visible"
      style={{ '--widget-tilt': '-0.35deg' }}
    >
      {/* Tape decorations */}
      <div className="tape-deco absolute -top-2 right-6 w-14 h-5 bg-yellow-200/70 dark:bg-yellow-700/30 border border-black/5 dark:border-yellow-600/20 transform rotate-6 z-10" />
      <div className="tape-deco absolute -top-2 left-8 w-12 h-5 bg-yellow-200/60 dark:bg-yellow-700/25 border border-black/5 dark:border-yellow-600/20 transform -rotate-4 z-10" />
      <div className="absolute -top-2 -right-2 z-20">
        <span className="comic-sticker">TOP 5</span>
      </div>

      <h3 className="font-display font-black text-sm text-zn-black mb-1 flex items-center gap-2 uppercase tracking-widest relative z-[2]">
        <TrendingUp className="w-5 h-5 text-zn-hot" />
        Най-четени
        <Flame className="w-4 h-4 text-orange-500 animate-pulse ml-auto" />
      </h3>
      <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mb-4 mt-2 relative z-[2]" />
      <div className="space-y-1 relative z-[2]">
        {trending.map((article, index) => (
          <motion.div
            key={article.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + index * 0.08 }}
          >
            <Link
              to={`/article/${article.id}`}
              className={`comic-sidebar-row flex gap-3 group py-3 px-2 transition-all duration-200 mb-2 last:mb-0 ${index === 0 ? 'bg-zn-hot/5 border-l-3 border-l-zn-hot pl-3 hover:bg-zn-hot/10' : index === 1 ? 'bg-zn-orange/5 border-l-3 border-l-zn-orange pl-3 hover:bg-zn-orange/10' : 'hover:bg-zn-hot/5 hover:pl-1'
                }`}
            >
              {/* Enhanced number badge */}
              <span className={`${numberClasses[index] || numberClasses[3]} transition-transform duration-200 group-hover:scale-110`}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="font-display font-bold text-sm text-zn-black line-clamp-2 group-hover:text-zn-hot transition-colors leading-snug uppercase tracking-wider">
                  {article.title}
                </h4>
                <div className="comic-heat-track mt-2">
                  <div className="comic-heat-fill" style={{ width: `${Math.max(8, Math.round((article.safeViews / maxViews) * 100))}%` }} />
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-display text-zn-text-dim uppercase tracking-wider bg-zn-bg px-2 py-0.5 border border-zn-border">
                    <Eye className="w-3 h-3" />
                    {article.safeViews.toLocaleString('bg-BG')} прегледа
                  </div>
                  {index === 0 && (
                    <span className="text-[10px] font-display font-black text-zn-hot uppercase tracking-widest">HOT</span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
