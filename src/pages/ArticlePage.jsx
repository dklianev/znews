import { useParams, Link } from 'react-router-dom';
import { Clock, Eye, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useData } from '../context/DataContext';
import { AdBannerHorizontal, AdBannerInline, AdBannerSide } from '../components/AdBanner';
import TrendingSidebar from '../components/TrendingSidebar';
import CommentsSection from '../components/CommentsSection';
import { useEffect, useMemo, useRef, useState } from 'react';
import ComicNewsCard from '../components/ComicNewsCard';
import ResponsiveImage from '../components/ResponsiveImage';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { api } from '../utils/api';

const categoryColors = {
  crime: 'bg-zn-purple text-white',
  politics: 'bg-blue-500 text-white',
  business: 'bg-zn-hot text-white',
  society: 'bg-amber-700 text-white',
  underground: 'bg-zn-bg text-white',
  emergency: 'bg-red-700 text-white',
  reportage: 'bg-violet-700 text-white',
  breaking: 'bg-red-600 text-white',
};

function ArticleBodySkeleton() {
  return (
    <div className="animate-pulse mb-8" aria-label="Зареждане на статия">
      <div className="h-24 bg-zn-text/10 rounded mb-7" />
      <div className="space-y-3">
        <div className="h-3 w-full bg-zn-text/10 rounded" />
        <div className="h-3 w-11/12 bg-zn-text/10 rounded" />
        <div className="h-3 w-full bg-zn-text/10 rounded" />
        <div className="h-3 w-10/12 bg-zn-text/10 rounded" />
        <div className="h-3 w-full bg-zn-text/10 rounded" />
        <div className="h-3 w-9/12 bg-zn-text/10 rounded" />
        <div className="h-3 w-full bg-zn-text/10 rounded" />
        <div className="h-3 w-11/12 bg-zn-text/10 rounded" />
        <div className="h-3 w-8/12 bg-zn-text/10 rounded" />
      </div>
    </div>
  );
}

function ArticlePageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-pulse" aria-label="Зареждане на страница">
      <nav className="flex items-center gap-2 text-sm font-sans text-zn-text-muted mb-6">
        <div className="h-3 w-80 bg-zn-text/10 rounded" />
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <article className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-24 bg-zn-text/10 rounded" />
            <div className="h-5 w-32 bg-zn-text/10 rounded" />
          </div>

          <div className="space-y-3 mb-5">
            <div className="h-10 w-11/12 bg-zn-text/10 rounded" />
            <div className="h-10 w-9/12 bg-zn-text/10 rounded" />
          </div>

          <div className="space-y-2 mb-5">
            <div className="h-4 w-full bg-zn-text/10 rounded" />
            <div className="h-4 w-10/12 bg-zn-text/10 rounded" />
          </div>

          <div className="flex items-center flex-wrap gap-4 pb-5 mb-6 border-b border-zn-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zn-text/10 border-2 border-[#1C1428]/10" />
              <div className="h-3 w-44 bg-zn-text/10 rounded" />
            </div>
            <div className="h-3 w-20 bg-zn-text/10 rounded" />
            <div className="h-3 w-28 bg-zn-text/10 rounded" />
            <div className="h-3 w-20 bg-zn-text/10 rounded" />
            <div className="ml-auto flex items-center gap-2">
              <div className="h-8 w-20 bg-zn-text/10 rounded" />
              <div className="h-8 w-20 bg-zn-text/10 rounded" />
            </div>
          </div>

          <div className="mb-6 comic-panel comic-dots relative p-2 bg-white">
            <div className="h-72 md:h-96 bg-zn-text/10 rounded relative z-[2]" />
          </div>

          <ArticleBodySkeleton />
        </article>

        <aside className="space-y-6">
          <div className="newspaper-page comic-panel comic-dots p-5 relative">
            <div className="h-4 w-40 bg-zn-text/10 rounded mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-zn-text/10 rounded" />
              <div className="h-3 w-11/12 bg-zn-text/10 rounded" />
              <div className="h-3 w-10/12 bg-zn-text/10 rounded" />
              <div className="h-3 w-9/12 bg-zn-text/10 rounded" />
            </div>
          </div>

          <div className="newspaper-page comic-panel comic-dots p-5 text-center relative">
            <div className="w-16 h-16 bg-zn-text/10 border-3 border-[#1C1428]/10 mx-auto mb-3" />
            <div className="h-4 w-44 bg-zn-text/10 rounded mx-auto mb-2" />
            <div className="h-3 w-28 bg-zn-text/10 rounded mx-auto" />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function ArticlePage() {
  const { id } = useParams();
  const { articles, authors, categories, ads, incrementArticleView, loading, siteSettings } = useData();
  const reduceMotion = useReducedMotion();
  const articleId = Number.parseInt(id, 10);
  const contextArticle = articles.find(a => a.id === articleId);
  const [directArticle, setDirectArticle] = useState(null);
  const [hydratingArticle, setHydratingArticle] = useState(false);
  const viewCounted = useRef(false);

  useEffect(() => {
    setDirectArticle(null);
    setHydratingArticle(false);
  }, [articleId]);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isInteger(articleId)) return undefined;
    if (directArticle?.id === articleId && directArticle?.content) return undefined;

    const needsFetch = !contextArticle || !contextArticle.content;
    if (!needsFetch) return undefined;

    setHydratingArticle(true);
    api.articles.getById(articleId)
      .then((payload) => {
        if (cancelled) return;
        if (payload && typeof payload === 'object') {
          setDirectArticle(payload);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (!contextArticle) setDirectArticle(null);
      })
      .finally(() => {
        if (!cancelled) setHydratingArticle(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articleId, contextArticle?.id, contextArticle?.content, directArticle?.id, directArticle?.content]);

  const article = directArticle || contextArticle;

  useEffect(() => {
    viewCounted.current = false;
  }, [articleId]);

  useEffect(() => {
    if (article && !viewCounted.current) {
      viewCounted.current = true;
      incrementArticleView(article.id);
    }
  }, [article?.id, incrementArticleView, articleId]);

  if ((loading || hydratingArticle) && !article) {
    return <ArticlePageSkeleton />;
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold text-zn-text mb-4 tracking-wider">Статията не е намерена</h1>
        <Link to="/" className="text-zn-hot hover:underline font-sans">Обратно към началната страница</Link>
      </div>
    );
  }

  const author = authors.find(a => a.id === article.authorId);
  const category = categories.find(c => c.id === article.category);
  const showBodySkeleton = Boolean(hydratingArticle && !directArticle?.content && !contextArticle?.content);
  const relatedArticles = useMemo(() => {
    const sourceTags = Array.isArray(article.tags)
      ? article.tags.map(tag => String(tag).toLowerCase())
      : [];
    const sourceDate = new Date(article.date || 0).getTime();

    return articles
      .filter(candidate => candidate.id !== article.id && candidate.status !== 'draft')
      .map((candidate) => {
        const reasons = [];
        let score = 0;

        if (candidate.category === article.category) {
          score += 40;
          reasons.push('Същата рубрика');
        }

        const candidateTags = Array.isArray(candidate.tags)
          ? candidate.tags.map(tag => String(tag).toLowerCase())
          : [];
        const sharedTag = candidateTags.find(tag => sourceTags.includes(tag));
        if (sharedTag) {
          score += 16;
          reasons.push(`Таг: ${sharedTag}`);
        }

        if (candidate.breaking) {
          score += 5;
          reasons.push('Breaking');
        }

        const views = Number(candidate.views) || 0;
        score += Math.min(views, 50000) / 5000;

        if (Number.isFinite(sourceDate)) {
          const candidateDate = new Date(candidate.date || 0).getTime();
          const dayDiff = Number.isFinite(candidateDate)
            ? Math.abs(sourceDate - candidateDate) / 86400000
            : 30;
          score += Math.max(0, 24 - dayDiff) * 0.4;
        }

        return {
          article: candidate,
          score,
          reason: reasons.join(' • ') || 'Препоръчано',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [articles, article.category, article.date, article.id, article.tags]);

  const nextArticle = useMemo(() => {
    const ordered = [...articles]
      .filter((item) => item.status !== 'draft')
      .sort((a, b) => {
        const byDate = new Date(b.date || 0) - new Date(a.date || 0);
        if (byDate !== 0) return byDate;
        return (b.id || 0) - (a.id || 0);
      });
    const index = ordered.findIndex((item) => item.id === article.id);
    if (index === -1) return null;
    return ordered[index + 1] || null;
  }, [article.id, articles]);

  const articlePresentation = useMemo(() => {
    const fallback = {
      html: article.content || `<p>${article.excerpt || ''}</p>`,
      headings: [],
      pullQuote: article.excerpt || '',
    };

    if (typeof article.content !== 'string' || article.content.trim() === '') {
      return fallback;
    }
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
      return fallback;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div id="article-root">${article.content}</div>`, 'text/html');
      const root = doc.getElementById('article-root');
      if (!root) return fallback;

      const usedIds = new Map();
      const headings = [];
      root.querySelectorAll('h2, h3').forEach((heading, index) => {
        const text = (heading.textContent || '').trim();
        if (!text) return;
        const base = text
          .toLowerCase()
          .replace(/[^a-z0-9а-я\s-]/gi, '')
          .replace(/\s+/g, '-')
          .slice(0, 42) || `section-${index + 1}`;
        const count = usedIds.get(base) || 0;
        usedIds.set(base, count + 1);
        const idValue = count === 0 ? base : `${base}-${count + 1}`;
        heading.setAttribute('id', idValue);
        heading.classList.add('article-section-heading');
        headings.push({
          id: idValue,
          label: text,
          level: heading.tagName.toLowerCase(),
        });
      });

      const firstParagraph = root.querySelector('p');
      if (firstParagraph) {
        firstParagraph.classList.add('article-lead');
      }

      const firstQuote = root.querySelector('blockquote');
      const pullQuoteText = firstQuote?.textContent?.trim() || article.excerpt || '';

      return {
        html: root.innerHTML,
        headings,
        pullQuote: pullQuoteText,
      };
    } catch {
      return fallback;
    }
  }, [article.content, article.excerpt]);

  const horizontalAds = ads.filter(a => a.type === 'horizontal');
  const sideAds = ads.filter(a => a.type === 'side');
  const inlineAd = ads.find(a => a.type === 'inline') || ads[0];

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const sharePublicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share/article/${article.id}`
    : `/share/article/${article.id}`;
  const sharePngUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/articles/${article.id}/share.png`
    : `/api/articles/${article.id}/share.png`;

  const copyText = async (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fallback below
      }
    }

    if (typeof document === 'undefined') return false;

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copiedOk = document.execCommand('copy');
      document.body.removeChild(textarea);
      return Boolean(copiedOk);
    } catch {
      return false;
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyText(sharePublicUrl);
    if (!ok) {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
      return;
    }
    setCopyFailed(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (sectionId) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${sectionId}`);
  };

  useEffect(() => {
    if (!nextArticle || typeof document === 'undefined') return undefined;

    const routeLink = document.createElement('link');
    routeLink.rel = 'prefetch';
    routeLink.href = `/article/${nextArticle.id}`;
    document.head.appendChild(routeLink);

    let preloadImage = null;
    if (nextArticle.image) {
      preloadImage = new Image();
      preloadImage.decoding = 'async';
      preloadImage.src = nextArticle.image;
    }

    return () => {
      if (routeLink.parentNode) routeLink.parentNode.removeChild(routeLink);
      preloadImage = null;
    };
  }, [nextArticle]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-6"
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-sans text-zn-text-muted mb-6">
        <Link to="/" className="hover:text-zn-hot transition-colors">Начало</Link>
        <ChevronRight className="w-3 h-3" />
        {category && (
          <>
            <Link to={`/category/${category.id}`} className="hover:text-zn-hot transition-colors">{category.name}</Link>
            <ChevronRight className="w-3 h-3" />
          </>
        )}
        <span className="text-zn-text truncate max-w-xs">{article.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main article */}
        <article className="lg:col-span-2">
          {/* Category & badges */}
          <div className="flex items-center gap-2 mb-3">
            {article.breaking && (
              <span className="breaking-badge font-sans">Извънредно</span>
            )}
            {category && (
              <Link
                to={`/category/${category.id}`}
                className={`px-2.5 py-0.5 text-xs font-display font-bold uppercase tracking-wide ${categoryColors[article.category] || 'bg-zn-text-dim text-white'}`}
              >
                {category.name}
              </Link>
            )}
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl md:text-4xl font-black text-zn-text leading-tight mb-4 tracking-wider uppercase text-shadow-brutal">
            {article.title}
          </h1>

          {/* Standfirst / Excerpt */}
          <p className="font-sans text-xl text-zn-text-muted leading-relaxed mb-5">
            {article.excerpt}
          </p>

          {/* Meta bar */}
          <div className="flex items-center flex-wrap gap-4 text-sm font-sans text-zn-text-dim pb-5 mb-6 border-b border-zn-border">
            {author && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-zn-hot text-white flex items-center justify-center font-display font-black text-xs border-2 border-[#1C1428]">
                  {author.name?.charAt(0)}
                </div>
                <div>
                  <span className="font-semibold text-zn-text">{author.name}</span>
                  <span className="text-zn-text-dim ml-1">— {author.role}</span>
                </div>
              </div>
            )}
            <span>{article.date}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {article.readTime} мин четене
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {(article.views || 0).toLocaleString()}
            </span>
            {/* Share buttons */}
            <div className="flex items-center gap-2 ml-auto">
              <a
                href={sharePngUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn share-btn-yapper"
                title="Отвори PNG версията за Yapper"
              >
                Yapper
              </a>
              <button onClick={handleCopyLink} className="share-btn share-btn-copy" title="Копирай линк">
                {copyFailed ? 'Неуспешно' : copied ? 'Копирано!' : 'Копирай'}
              </button>
            </div>
          </div>

          {/* Featured image */}
          <div className="mb-6 comic-panel comic-dots relative p-2 bg-white">
            <ResponsiveImage
              src={article.image}
              pipeline={article.imageMeta}
              alt={article.title}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="w-full h-auto relative z-[2]"
              pictureClassName="block"
            />
          </div>

          {/* Inline ad */}
          <AdBannerInline ad={inlineAd} />

          {showBodySkeleton ? (
            <ArticleBodySkeleton />
          ) : (
            <>
              {articlePresentation.pullQuote && (
                <blockquote className="article-pull-quote mb-7">
                  {articlePresentation.pullQuote}
                </blockquote>
              )}

              {/* Article body content */}
              <div
                className="prose prose-lg max-w-none mb-8 article-body
                  [&_p]:font-sans [&_p]:leading-relaxed [&_p]:mb-4
                  [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-black [&_h2]:uppercase [&_h2]:mt-9 [&_h2]:mb-3
                  [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-3
                  [&_h4]:font-display [&_h4]:text-lg [&_h4]:font-bold [&_h4]:mt-6 [&_h4]:mb-2
                  [&_blockquote]:border-l-4 [&_blockquote]:border-zn-purple [&_blockquote]:pl-5 [&_blockquote]:py-2 [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:font-sans [&_blockquote]:text-lg [&_blockquote]:bg-zn-bg-warm/50
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:font-sans
                  [&_li]:mb-1
                  [&_a]:text-zn-hot [&_a]:underline
                "
                dangerouslySetInnerHTML={{ __html: articlePresentation.html }}
              />
            </>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-8 pt-5 border-t border-zn-border">
              <span className="text-sm font-sans text-zn-text-muted mr-1">Тагове:</span>
              {article.tags.map(tag => (
                <Link
                  key={tag}
                  to={`/search?q=${encodeURIComponent(tag)}`}
                  className="px-3 py-1 text-xs font-sans text-zn-text-muted border-2 border-zn-border hover:text-zn-hot hover:border-zn-purple transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {/* Comments */}
          <CommentsSection articleId={article.id} />

          {/* Bottom ad */}
          {horizontalAds[1] && <AdBannerHorizontal ad={horizontalAds[1]} />}

          {/* Related articles */}
          {relatedArticles.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-xl font-bold text-zn-text tracking-wider">Свързани новини</h2>
              <div className="h-0.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-2 mb-5" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {relatedArticles.map(({ article: related, reason }, index) => {
                  const design = getComicCardStyle('articleRelated', index, related, siteSettings?.layoutPresets?.articleRelated);
                  const sticker = index === 0 ? 'Най-близка' : design.sticker;
                  return (
                    <div key={related.id}>
                      <ComicNewsCard
                        article={related}
                        compact
                        tilt={design.tilt}
                        variant={design.variant}
                        sticker={sticker}
                        stripe={design.stripe}
                      />
                      <p className="mt-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-zn-text-dim">
                        {reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </article>

        {/* Sidebar */}
        <aside className="space-y-6">
          {showBodySkeleton && (
            <div className="newspaper-page comic-panel comic-dots p-5 relative lg:sticky lg:top-24 animate-pulse" aria-label="Зареждане на навигация">
              <div className="absolute -top-2 left-6 w-14 h-4 bg-yellow-200/50 border border-black/5 transform -rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.08)' }} />
              <div className="h-4 w-40 bg-zn-text/10 rounded mb-4 relative z-[2]" />
              <div className="space-y-2 relative z-[2]">
                <div className="h-3 w-full bg-zn-text/10 rounded" />
                <div className="h-3 w-11/12 bg-zn-text/10 rounded" />
                <div className="h-3 w-10/12 bg-zn-text/10 rounded" />
                <div className="h-3 w-9/12 bg-zn-text/10 rounded" />
              </div>
            </div>
          )}
          {articlePresentation.headings.length > 0 && (
            <div className="newspaper-page comic-panel comic-dots p-5 relative lg:sticky lg:top-24">
              <div className="absolute -top-2 left-6 w-14 h-4 bg-yellow-200/70 border border-black/5 transform -rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
              <h3 className="font-display text-sm font-black uppercase tracking-[0.16em] text-zn-text mb-3">Навигация</h3>
              <div className="space-y-1.5">
                {articlePresentation.headings.map((heading, index) => (
                  <button
                    key={heading.id}
                    onClick={() => scrollToSection(heading.id)}
                    className={`article-toc-link ${heading.level === 'h3' ? 'article-toc-link-sub' : ''}`}
                  >
                    <span className="text-zn-hot">{index + 1}.</span>
                    <span>{heading.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Author card */}
          {author && (
            <div className="newspaper-page comic-panel comic-dots p-5 text-center relative">
              <div className="absolute -top-2 right-6 w-12 h-4 bg-yellow-200/70 border border-black/5 transform rotate-3 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
              <div className="w-16 h-16 bg-zn-hot text-white flex items-center justify-center font-display font-black text-2xl border-3 border-[#1C1428] mx-auto mb-3 relative z-[2]" style={{ boxShadow: '3px 3px 0 #1C1428' }}>
                {author.name?.charAt(0)}
              </div>
              <h3 className="font-display font-bold text-lg text-zn-text tracking-wider relative z-[2]">{author.name}</h3>
              <p className="text-sm font-sans text-zn-hot font-semibold relative z-[2]">{author.role}</p>
              <div className="mt-3 pt-3 border-t-2 border-zn-border/50 relative z-[2]">
                <p className="text-xs font-display font-black text-zn-text-dim uppercase tracking-widest">
                  {articles.filter(a => a.authorId === author.id).length} публикации
                </p>
              </div>
            </div>
          )}

          <TrendingSidebar />

          {sideAds.slice(0, 2).map(ad => (
            <AdBannerSide key={ad.id} ad={ad} />
          ))}
        </aside>
      </div>
    </motion.div>
  );
}
