import { useParams, Link } from 'react-router-dom';
import { Clock, Eye, ChevronRight, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { useArticlesData, useSettingsData, useTaxonomyData } from '../context/DataContext';
import AdSlot from '../components/ads/AdSlot';
import TrendingSidebar from '../components/TrendingSidebar';
import { Fragment, Suspense, lazy, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import ComicNewsCard from '../components/ComicNewsCard';
import NextArticleCard from '../components/NextArticleCard';
import ResponsiveImage from '../components/ResponsiveImage';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { api } from '../utils/api';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useEntryHeadingScroll } from '../hooks/useEntryHeadingScroll';
import YouTubeEmbed from '../components/YouTubeEmbed';
import ErrorBoundary from '../components/ErrorBoundary';
import ArticleReactions from '../components/ArticleReactions';
import EasterDecorations from '../components/seasonal/EasterDecorations';
import { formatNewsDate } from '../utils/newsDate';
import {
  isCefYouTubeFallbackEnvironment,
  replaceInlineYouTubeIframesWithFallback,
} from '../utils/youtubeEmbeds';

const CommentsSection = lazy(() => import('../components/CommentsSection'));

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

function CommentsSectionSkeleton() {
  return (
    <section className="mb-8 newspaper-page comic-panel comic-dots p-5 md:p-6 animate-pulse" aria-label="Зареждане на коментари">
      <div className="h-5 w-40 bg-zn-text/10 rounded mb-4" />
      <div className="space-y-3">
        <div className="h-16 bg-zn-text/10 rounded" />
        <div className="h-16 bg-zn-text/10 rounded" />
        <div className="h-16 bg-zn-text/10 rounded" />
      </div>
    </section>
  );
}

function ArticlePageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-pulse" aria-label="Зареждане на страницата">
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

const INITIAL_RIGHT_OF_REPLY_FORM = Object.freeze({
  name: '',
  phone: '',
  message: '',
});

const INITIAL_RIGHT_OF_REPLY_STATE = Object.freeze({
  status: 'idle',
  message: '',
  fieldErrors: {},
});

function serializeArticleBodyNode(node) {
  if (!node) return '';
  if (node.nodeType === 1) return node.outerHTML || '';
  if (node.nodeType === 3) return node.textContent || '';
  return '';
}

function getLightboxCaption(imageElement) {
  const figure = imageElement?.closest?.('figure');
  const figureCaption = figure?.querySelector?.('figcaption')?.textContent?.trim();
  return figureCaption || imageElement?.getAttribute?.('alt') || '';
}

function buildArticleBodySegments(root) {
  if (!root) return [];

  const breakpoints = new Map([
    [2, 'article.inline.afterParagraph2'],
    [5, 'article.inline.afterParagraph5'],
  ]);
  const segments = [];
  let paragraphCount = 0;
  let currentHtml = '';

  Array.from(root.childNodes || []).forEach((node) => {
    const html = serializeArticleBodyNode(node);
    if (!html) return;
    currentHtml += html;

    if (node.nodeType === 1 && node.tagName?.toLowerCase() === 'p') {
      paragraphCount += 1;
      const slot = breakpoints.get(paragraphCount);
      if (slot) {
        segments.push({ html: currentHtml, slot });
        currentHtml = '';
      }
    }
  });

  if (currentHtml.trim()) {
    segments.push({ html: currentHtml, slot: null });
  }

  if (segments.length === 0) {
    return [{ html: root.innerHTML || '', slot: null }];
  }

  return segments;
}

export default function ArticlePage() {
  const { id } = useParams();
  const { articles, incrementArticleView, loading } = useArticlesData();
  const { authors, categories } = useTaxonomyData();
  const { ads, siteSettings } = useSettingsData();
  const articleId = Number.parseInt(id, 10);
  const contextArticle = articles.find(a => a.id === articleId);
  const [directArticle, setDirectArticle] = useState(null);
  const [hydratingArticle, setHydratingArticle] = useState(false);
  const viewedArticleIdsRef = useRef(new Set());

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
  useDocumentTitle(makeTitle(article?.title || 'Статия'));

  // Per-page OG / Twitter / canonical meta for social sharing
  const articleMetaTags = useMemo(() => {
    if (!article) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const rawImg = article.image || article.shareImage || '';
    const image = rawImg
      ? (rawImg.startsWith('http') ? rawImg : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`)
      : `${origin}/og.png`;
    return {
      title: article.title,
      description: article.excerpt || article.title,
      image,
      url: `${origin}/article/${article.id}`,
      type: 'article',
    };
  }, [article?.id, article?.title, article?.excerpt, article?.image, article?.shareImage]);
  useDocumentMeta(articleMetaTags);

  useEffect(() => {
    const targetArticleId = Number.parseInt(article?.id, 10);
    if (!Number.isInteger(targetArticleId)) return;
    if (viewedArticleIdsRef.current.has(targetArticleId)) return;
    viewedArticleIdsRef.current.add(targetArticleId);
    incrementArticleView(targetArticleId);
  }, [article?.id, incrementArticleView]);

  // ── All remaining hooks MUST be declared before early returns ──

  const author = article ? authors.find(a => a.id === article.authorId) : null;
  const category = article ? categories.find(c => c.id === article.category) : null;
  const showBodySkeleton = Boolean(hydratingArticle && !directArticle?.content && !contextArticle?.content);
  const pageHeadingRef = useRef(null);
  const entryScrollKey = article
    ? `ready:${article.id}`
    : showBodySkeleton || loading
      ? `pending:${articleId}`
      : `missing:${articleId}`;

  useEntryHeadingScroll(pageHeadingRef, entryScrollKey);

  const relatedArticles = useMemo(() => {
    if (!article) return [];
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
          reasons.push('Рубрика');
        }

        const candidateTags = Array.isArray(candidate.tags)
          ? candidate.tags.map(tag => String(tag).toLowerCase())
          : [];
        const sharedTag = candidateTags.find(tag => sourceTags.includes(tag));
        if (sharedTag) {
          score += 16;
          reasons.push(`#${sharedTag}`);
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
  }, [articles, article?.category, article?.date, article?.id, article?.tags]);

  const nextArticle = useMemo(() => {
    if (!article) return null;
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
  }, [article?.id, articles]);

  const nextArticleCategory = useMemo(() => {
    if (!nextArticle) return null;
    return categories.find((item) => item.id === nextArticle.category) || null;
  }, [categories, nextArticle?.category, nextArticle?.id]);

  const articlePresentation = useMemo(() => {
    if (!article) return { html: '', headings: [], pullQuote: '', bodySegments: [] };
    const fallbackHtml = article.content || `<p>${article.excerpt || ''}</p>`;
    const fallback = {
      html: fallbackHtml,
      headings: [],
      pullQuote: article.excerpt || '',
      bodySegments: [{ html: fallbackHtml, slot: null }],
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

      if (isCefYouTubeFallbackEnvironment()) {
        replaceInlineYouTubeIframesWithFallback(root, article.id);
      }

      const usedIds = new Map();
      const headings = [];
      root.querySelectorAll('h2, h3').forEach((heading, index) => {
        const text = (heading.textContent || '').trim();
        if (!text) return;
        const base = text
          .toLowerCase()
          .replace(/[^a-z0-9?-?\s-]/gi, '')
          .replace(/\s+/g, '-')
          .slice(0, 42) || `section-${index + 1}`;
        const count = usedIds.get(base) || 0;
        usedIds.set(base, count + 1);
        const idValue = count === 0 ? base : `${base}-${count + 1}`;
        heading.setAttribute('id', idValue);
        heading.classList.add('article-section-heading', 'scroll-mt-24', 'md:scroll-mt-28');
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
      const bodySegments = buildArticleBodySegments(root);

      return {
        html: root.innerHTML,
        headings,
        pullQuote: pullQuoteText,
        bodySegments,
      };
    } catch {
      return fallback;
    }
  }, [article?.content, article?.excerpt]);

  // JSON-LD structured data for search engines
  const jsonLd = useMemo(() => {
    if (!article) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const rawImg = article.image || article.shareImage || '';
    const ldImage = rawImg
      ? (rawImg.startsWith('http') ? rawImg : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`)
      : `${origin}/og.png`;
    return {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: article.excerpt || '',
      image: ldImage,
      datePublished: article.date || '',
      dateModified: article.updatedAt || article.date || '',
      author: author ? { '@type': 'Person', name: author.name } : undefined,
      publisher: {
        '@type': 'Organization',
        name: 'zNews',
        logo: { '@type': 'ImageObject', url: `${origin}/og.png` },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${origin}/article/${article.id}`,
      },
    };
  }, [article?.id, article?.title, article?.excerpt, article?.image, article?.shareImage, article?.date, article?.updatedAt, author?.name]);

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [yapperOpen, setYapperOpen] = useState(false);
  const [yapperCopied, setYapperCopied] = useState(false);
  const [rightOfReplyForm, setRightOfReplyForm] = useState(INITIAL_RIGHT_OF_REPLY_FORM);
  const [rightOfReplyState, setRightOfReplyState] = useState(INITIAL_RIGHT_OF_REPLY_STATE);
  const [rightOfReplyPending, setRightOfReplyPending] = useState(false);
  const [publishedReplyArticles, setPublishedReplyArticles] = useState([]);
  const [publishedReplyLoading, setPublishedReplyLoading] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const yapperRef = useRef(null);
  const yapperInputRef = useRef(null);
  const inlineBodyContentRef = useRef(null);

  const handleYapperOutsideDismiss = useEffectEvent((event) => {
    if (yapperRef.current && !yapperRef.current.contains(event.target)) {
      setYapperOpen(false);
    }
  });

  const handleYapperEscapeDismiss = useEffectEvent((event) => {
    if (event.key === 'Escape') setYapperOpen(false);
  });

  // Close yapper popup on outside click or Esc
  useEffect(() => {
    if (!yapperOpen) return undefined;

    const handleClick = (event) => {
      handleYapperOutsideDismiss(event);
    };
    const handleKey = (event) => {
      handleYapperEscapeDismiss(event);
    };

    document.addEventListener('pointerdown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [yapperOpen]);

  // Autofocus the link input when opening the yapper popup.
  useEffect(() => {
    if (!yapperOpen) return;
    const t = window.requestAnimationFrame(() => {
      try {
        yapperInputRef.current?.focus();
        yapperInputRef.current?.select();
      } catch { }
    });
    return () => window.cancelAnimationFrame(t);
  }, [yapperOpen]);

  useEffect(() => {
    setRightOfReplyForm(INITIAL_RIGHT_OF_REPLY_FORM);
    setRightOfReplyState(INITIAL_RIGHT_OF_REPLY_STATE);
    setRightOfReplyPending(false);
    setPublishedReplyArticles([]);
    setPublishedReplyLoading(false);
    setLightboxImage(null);
  }, [article?.id]);

  useEffect(() => {
    if (articlePresentation.headings.length === 0) {
      setActiveHeadingId('');
      return;
    }

    const hashId = typeof window !== 'undefined'
      ? decodeURIComponent((window.location.hash || '').replace(/^#/, ''))
      : '';
    const initialId = articlePresentation.headings.some((heading) => heading.id === hashId)
      ? hashId
      : articlePresentation.headings[0]?.id || '';
    setActiveHeadingId(initialId);
  }, [article?.id, articlePresentation.headings]);

  useEffect(() => {
    let cancelled = false;

    if (!Number.isInteger(article?.id) || article.id <= 0) {
      setPublishedReplyArticles([]);
      setPublishedReplyLoading(false);
      return undefined;
    }

    setPublishedReplyLoading(true);
    api.contactMessages.getPublishedRightOfReply(article.id)
      .then((payload) => {
        if (cancelled) return;
        setPublishedReplyArticles(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        if (cancelled) return;
        setPublishedReplyArticles([]);
      })
      .finally(() => {
        if (!cancelled) setPublishedReplyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [article?.id]);

  useEffect(() => {
    if (!nextArticle?.image || typeof Image === 'undefined') return undefined;

    let preloadImage = null;
    const t = window.setTimeout(() => {
      preloadImage = new Image();
      preloadImage.decoding = 'async';
      preloadImage.src = nextArticle.image;
    }, 800);

    return () => {
      window.clearTimeout(t);
      if (preloadImage) {
        try { preloadImage.src = ''; } catch { }
      }
      preloadImage = null;
    };
  }, [nextArticle?.image]);

  const syncActiveHeading = useEffectEvent((nextHeadingId) => {
    if (!nextHeadingId) return;
    setActiveHeadingId((currentId) => (currentId === nextHeadingId ? currentId : nextHeadingId));

    if (typeof window !== 'undefined' && window.location.hash !== `#${nextHeadingId}`) {
      window.history.replaceState(null, '', `#${nextHeadingId}`);
    }
  });

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || typeof IntersectionObserver === 'undefined'
      || articlePresentation.headings.length === 0
    ) {
      return undefined;
    }

    const headingElements = articlePresentation.headings
      .map((heading) => document.getElementById(heading.id))
      .filter(Boolean);

    if (headingElements.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => {
            const aScore = Math.abs(a.boundingClientRect.top - 132);
            const bScore = Math.abs(b.boundingClientRect.top - 132);
            if (aScore !== bScore) return aScore - bScore;
            return b.intersectionRatio - a.intersectionRatio;
          });

        const nextHeadingId = visibleEntries[0]?.target?.id;
        if (nextHeadingId) {
          syncActiveHeading(nextHeadingId);
        }
      },
      {
        root: null,
        rootMargin: '-120px 0px -55% 0px',
        threshold: [0.12, 0.25, 0.5, 0.75, 1],
      },
    );

    headingElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [article?.id, articlePresentation.headings, syncActiveHeading]);

  // Reading progress bar
  const articleBodyRef = useRef(null);
  const progressBarRef = useRef(null);
  const readProgressRef = useRef(0);
  const progressFrameRef = useRef(0);
  const updateReadProgress = useEffectEvent(() => {
    const el = articleBodyRef.current;
    const progressEl = progressBarRef.current;
    if (!el || !progressEl) return;
    const rect = el.getBoundingClientRect();
    const total = el.scrollHeight;
    const visible = window.innerHeight;
    const maxScrollable = Math.max(1, total - visible);
    const scrolled = Math.max(0, -rect.top);
    const pct = Math.min(100, Math.max(0, (scrolled / maxScrollable) * 100));

    if (Math.abs(readProgressRef.current - pct) < 0.1) return;

    readProgressRef.current = pct;
    progressEl.style.transform = `scaleX(${pct / 100})`;
    progressEl.setAttribute('aria-valuenow', String(Math.round(pct)));
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleViewportChange = () => {
      if (progressFrameRef.current) return;
      progressFrameRef.current = window.requestAnimationFrame(() => {
        progressFrameRef.current = 0;
        updateReadProgress();
      });
    };

    updateReadProgress();
    window.addEventListener('scroll', handleViewportChange, { passive: true });
    window.addEventListener('resize', handleViewportChange);
    return () => {
      if (progressFrameRef.current) {
        window.cancelAnimationFrame(progressFrameRef.current);
        progressFrameRef.current = 0;
      }
      window.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [article?.id]);

  const handleLightboxEscape = useEffectEvent((event) => {
    if (event.key === 'Escape') {
      setLightboxImage(null);
    }
  });

  useEffect(() => {
    if (!lightboxImage || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleLightboxEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleLightboxEscape);
    };
  }, [lightboxImage]);

  // ── Early returns AFTER all hooks ──

  if ((loading || hydratingArticle) && !article) {
    return <ArticlePageSkeleton />;
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1
          ref={pageHeadingRef}
          className="font-display text-3xl font-bold text-zn-text mb-4 tracking-wider scroll-mt-24 md:scroll-mt-28"
        >
          Статията не е намерена
        </h1>
        <Link to="/" className="text-zn-hot hover:underline font-sans">Обратно към началната страница</Link>
      </div>
    );
  }

  const sharePublicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share/article/${article.id}`
    : `/share/article/${article.id}`;
  const sharePngUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/articles/${article.id}/share.png`
    : `/api/articles/${article.id}/share.png`;
  const yapperPopupId = `yapper-popup-${article.id}`;

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

  const handleYapperCopy = async () => {
    const ok = await copyText(sharePngUrl);
    if (ok) {
      setYapperCopied(true);
      setTimeout(() => setYapperCopied(false), 2000);
    }
  };

  const handleRightOfReplyFieldChange = (field, value) => {
    setRightOfReplyForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setRightOfReplyState((currentState) => {
      if (!currentState.fieldErrors?.[field] && currentState.status !== 'success') return currentState;
      return {
        ...currentState,
        status: currentState.status === 'success' ? 'idle' : currentState.status,
        fieldErrors: {
          ...currentState.fieldErrors,
          [field]: '',
        },
      };
    });
  };

  const handleRightOfReplySubmit = async (event) => {
    event.preventDefault();
    if (!article?.id) return;

    const nextForm = {
      name: String(rightOfReplyForm.name || '').trim(),
      phone: String(rightOfReplyForm.phone || '').trim(),
      message: String(rightOfReplyForm.message || '').trim(),
    };

    const fieldErrors = {};
    if (!nextForm.name) fieldErrors.name = 'Името е задължително.';
    if (!nextForm.phone) fieldErrors.phone = 'Телефонът е задължителен.';
    if (!nextForm.message) fieldErrors.message = 'Опиши какъв е твоят отговор по публикацията.';
    if (nextForm.phone && nextForm.phone.replace(/\D/g, '').length < 5) {
      fieldErrors.phone = 'Въведи валиден телефон.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      setRightOfReplyState({
        status: 'error',
        message: 'Попълни коректно полетата за право на отговор.',
        fieldErrors,
      });
      return;
    }

    setRightOfReplyPending(true);
    setRightOfReplyState(INITIAL_RIGHT_OF_REPLY_STATE);

    try {
      await api.contactMessages.submit({
        ...nextForm,
        requestKind: 'right_of_reply',
        relatedArticleId: article.id,
        relatedArticleTitle: article.title,
      });
      setRightOfReplyForm(INITIAL_RIGHT_OF_REPLY_FORM);
      setRightOfReplyState({
        status: 'success',
        message: 'Искането за право на отговор е изпратено към редакцията.',
        fieldErrors: {},
      });
    } catch (error) {
      const payloadFieldErrors = error?.payload?.fieldErrors && typeof error.payload.fieldErrors === 'object'
        ? error.payload.fieldErrors
        : {};

      setRightOfReplyState({
        status: 'error',
        message: error?.message || 'Не успяхме да изпратим искането. Опитай отново.',
        fieldErrors: payloadFieldErrors,
      });
    } finally {
      setRightOfReplyPending(false);
    }
  };

  const scrollToSection = (sectionId) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    setActiveHeadingId(sectionId);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${sectionId}`);
  };

  const handleInlineImageClick = (event) => {
    const imageElement = event.target instanceof Element ? event.target.closest('img') : null;
    if (!imageElement || !inlineBodyContentRef.current?.contains(imageElement)) return;

    const source = imageElement.getAttribute('src');
    if (!source) return;

    event.preventDefault();
    setLightboxImage({
      src: source,
      alt: imageElement.getAttribute('alt') || article.title,
      caption: getLightboxCaption(imageElement),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-6"
    >
      {/* JSON-LD structured data */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Reading progress bar */}
      <div
        ref={progressBarRef}
        className="fixed top-0 left-0 h-1 w-full bg-gradient-to-r from-zn-hot to-zn-orange z-[100] transition-transform duration-150 ease-out"
        style={{ transform: 'scaleX(0)', transformOrigin: 'left center', willChange: 'transform' }}
        role="progressbar"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Прогрес на четене"
      />

      {/* Breadcrumb */}
      <nav aria-label="Навигационна пътека" className="flex items-center gap-2 text-sm font-sans text-zn-text-muted mb-6">
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
        <article ref={articleBodyRef} className="lg:col-span-2 relative">
          {/* Category & badges */}
          <div className="flex items-center gap-2 mb-3">
            {article.breaking && (
              <span className="breaking-badge font-sans">Извънредно</span>
            )}
            {article.sponsored && (
              <span className="bg-emerald-600 text-white text-xs font-display font-black uppercase tracking-wider px-2.5 py-0.5 border border-emerald-800">
                Платена публикация
              </span>
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
          <h1
            ref={pageHeadingRef}
            className="font-display text-3xl md:text-4xl font-black text-zn-text leading-tight mb-4 tracking-wider uppercase text-shadow-brutal scroll-mt-24 md:scroll-mt-28"
          >
            {article.title}
          </h1>

          {/* Standfirst / Excerpt */}
          <p className="font-sans text-xl text-zn-text-muted leading-relaxed mb-5">
            {article.excerpt}
          </p>

          {/* Meta bar */}
          <div className="flex items-center flex-wrap gap-4 text-sm font-sans text-zn-text-dim pb-5 mb-6 border-b border-zn-border">
            {author && (
              <Link to={`/author/${author.id}`} className="flex items-center gap-2 hover:text-zn-hot transition-colors">
                <div className="w-8 h-8 bg-zn-hot text-white flex items-center justify-center font-display font-black text-xs border-2 border-[#1C1428] overflow-hidden">
                  {author.avatarImage ? (
                    <img src={author.avatarImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    author.name?.charAt(0)
                  )}
                </div>
                <div>
                  <span className="font-semibold text-zn-text">{author.name}</span>
                  <span className="text-zn-text-dim ml-1">— {author.role}</span>
                </div>
              </Link>
            )}
            <span>{formatNewsDate(article.date)}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {article.readTime} мин четене
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {(article.views || 0).toLocaleString()}
            </span>
            {/* Share buttons */}
            <div className="flex items-center gap-2 ml-auto relative">
              <div ref={yapperRef} className="relative">
                <button
                  type="button"
                  onClick={() => setYapperOpen((v) => !v)}
                  className="share-btn share-btn-yapper"
                  title="Вземи линк за Yapper"
                  aria-haspopup="dialog"
                  aria-expanded={yapperOpen}
                  aria-controls={yapperPopupId}
                >
                  Yapper
                </button>
                {yapperOpen && (
                  <div className="yapper-popup fixed sm:absolute inset-x-4 bottom-4 sm:inset-auto sm:right-0 sm:top-full sm:mt-2 z-50" id={yapperPopupId} role="dialog" aria-label="Yapper снимка">
                    <div className="yapper-popup-title">Yapper снимка</div>
                    <img
                      src={sharePngUrl}
                      alt="Yapper share"
                      className="yapper-popup-img"
                      loading="lazy"
                      decoding="async"
                    />
                    <p className="yapper-popup-desc">Копирай линка и го постни в Yapper:</p>
                    <div className="yapper-popup-link-row">
                      <input
                        ref={yapperInputRef}
                        type="text"
                        readOnly
                        value={sharePngUrl}
                        className="yapper-popup-input"
                        onClick={(e) => e.target.select()}
                        aria-label="Линк към Yapper PNG"
                      />
                      <button type="button" onClick={handleYapperCopy} className="yapper-popup-copy-btn">
                        {yapperCopied ? '✓' : 'Копирай'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button type="button" onClick={handleCopyLink} className="share-btn share-btn-copy" title="Копирай линк">
                {copyFailed ? 'Неуспешно' : copied ? 'Копирано!' : 'Копирай'}
              </button>
            </div>
          </div>

          {/* Featured image or Video */}
          <div className="mb-6 comic-panel comic-dots relative p-2 bg-white flex justify-center">
            <EasterDecorations pageId="article" />
            {article.youtubeUrl ? (
              <YouTubeEmbed
                url={article.youtubeUrl}
                title={article.title}
                thumbnailUrl={article.image}
                articleId={article.id}
                className="relative z-[2]"
              />
            ) : (
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
            )}
          </div>

          {/* Inline ad */}
          <AdSlot ads={ads} slot="article.afterCover" pageType="article" articleId={article.id} categoryId={article.category} />

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
                ref={inlineBodyContentRef}
                onClick={handleInlineImageClick}
                className="prose prose-lg max-w-none mb-8 article-body
                  [&_p]:font-sans [&_p]:leading-relaxed [&_p]:mb-4
                  [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-black [&_h2]:mt-9 [&_h2]:mb-3
                  [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-3
                  [&_h4]:font-display [&_h4]:text-lg [&_h4]:font-bold [&_h4]:mt-6 [&_h4]:mb-2
                  [&_blockquote]:border-l-4 [&_blockquote]:border-zn-purple [&_blockquote]:pl-5 [&_blockquote]:py-2 [&_blockquote]:my-6 [&_blockquote]:italic [&_blockquote]:font-sans [&_blockquote]:text-lg [&_blockquote]:bg-zn-bg-warm/50
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:font-sans
                  [&_li]:mb-1
                  [&_a]:text-zn-hot [&_a]:underline
                  [&_img]:w-full [&_img]:h-auto [&_img]:my-6 [&_img]:rounded-sm [&_img]:border [&_img]:border-zn-border [&_img]:cursor-zoom-in
                "
              >
                {articlePresentation.bodySegments.map((segment, index) => (
                  <Fragment key={`segment-${index}`}>
                    <div dangerouslySetInnerHTML={{ __html: segment.html }} />
                    {segment.slot && (
                      <AdSlot
                        ads={ads}
                        slot={segment.slot}
                        pageType="article"
                        articleId={article.id}
                        categoryId={article.category}
                      />
                    )}
                  </Fragment>
                ))}
              </div>
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

          {/* Reactions */}
          <ArticleReactions articleId={article.id} reactions={article.reactions} />

          {/* Comments */}
          <Suspense fallback={<CommentsSectionSkeleton />}>
            <CommentsSection articleId={article.id} />
          </Suspense>

          {nextArticle ? (
            <NextArticleCard
              article={nextArticle}
              category={nextArticleCategory}
              categoryClassName={categoryColors[nextArticle.category] || 'bg-zn-text-dim text-white'}
              formattedDate={formatNewsDate(nextArticle.date)}
            />
          ) : null}

          <section className="mt-8 mb-8 newspaper-page comic-panel comic-dots p-5 md:p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-zn-purple/8 pointer-events-none" />
            <div className="relative z-[2]">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="headline-banner-purple text-[10px] sm:text-xs">ПРАВО НА ОТГОВОР</span>
                <span className="comic-chip text-[10px] sm:text-xs">Свързано с тази публикация</span>
              </div>
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-3 border-[#1C1428] bg-white text-zn-purple">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg md:text-xl font-black uppercase tracking-wider text-zn-text">
                    Засегнат си от тази публикация?
                  </h2>
                  <p className="mt-1 text-sm md:text-[15px] font-sans text-zn-text/80 leading-relaxed">
                    Ако статията засяга пряко теб, твоята организация или твоята позиция, изпрати искане за право на
                    отговор. Редакцията го разглежда по установения ред и го свързва директно с тази публикация.
                  </p>
                </div>
              </div>

              {publishedReplyLoading ? (
                <div className="mb-4 border border-zn-purple/15 bg-white/85 px-4 py-3 text-sm font-sans text-zn-text/75">
                  Зареждаме публикуваните отговори по тази публикация...
                </div>
              ) : null}

              {publishedReplyArticles.length > 0 ? (
                <div className="mb-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="headline-banner-hot text-[10px] sm:text-xs">ПУБЛИКУВАНИ ОТГОВОРИ</span>
                    <span className="comic-chip text-[10px] sm:text-xs">
                      {publishedReplyArticles.length === 1
                        ? '1 публикуван отговор'
                        : `${publishedReplyArticles.length} публикувани отговора`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {publishedReplyArticles.map((replyArticle) => (
                      <Link
                        key={replyArticle.id}
                        to={`/article/${replyArticle.id}`}
                        className="comic-story-card group relative flex h-full flex-col gap-2 bg-white p-4 transition-transform hover:-translate-y-0.5"
                        aria-label={`Отвори публикувания отговор "${replyArticle.title}"`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="comic-chip-hot text-[10px]">
                            {replyArticle.cardSticker || replyArticle.shareBadge || 'ОТГОВОР'}
                          </span>
                          {replyArticle.date ? (
                            <span className="text-[11px] font-sans text-zn-text/55">
                              {formatNewsDate(replyArticle.date)}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="font-display text-sm font-black uppercase tracking-wide text-zn-text transition-colors group-hover:text-zn-hot">
                          {replyArticle.title}
                        </h3>
                        {replyArticle.excerpt ? (
                          <p className="line-clamp-3 text-sm font-sans leading-relaxed text-zn-text/75">
                            {replyArticle.excerpt}
                          </p>
                        ) : null}
                        <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-[0.18em] text-zn-purple">
                          Отвори отговора
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {rightOfReplyState.status === 'success' ? (
                <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-sans text-emerald-800" role="status">
                  {rightOfReplyState.message}
                </div>
              ) : null}

              {rightOfReplyState.status === 'error' && rightOfReplyState.message ? (
                <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-sans text-red-800" role="alert">
                  {rightOfReplyState.message}
                </div>
              ) : null}

              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleRightOfReplySubmit}>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-display font-bold uppercase tracking-[0.18em] text-zn-text/60">
                    Име
                  </span>
                  <input
                    type="text"
                    value={rightOfReplyForm.name}
                    onChange={(event) => handleRightOfReplyFieldChange('name', event.target.value)}
                    aria-label="Име за право на отговор"
                    className="w-full border-3 border-[#1C1428] bg-white px-3 py-2 font-sans text-sm text-zn-text outline-none focus:border-zn-purple"
                  />
                  {rightOfReplyState.fieldErrors?.name ? (
                    <span className="mt-1 block text-xs font-sans text-zn-hot">{rightOfReplyState.fieldErrors.name}</span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-display font-bold uppercase tracking-[0.18em] text-zn-text/60">
                    Телефон
                  </span>
                  <input
                    type="text"
                    value={rightOfReplyForm.phone}
                    onChange={(event) => handleRightOfReplyFieldChange('phone', event.target.value)}
                    aria-label="Телефон за право на отговор"
                    className="w-full border-3 border-[#1C1428] bg-white px-3 py-2 font-sans text-sm text-zn-text outline-none focus:border-zn-purple"
                  />
                  {rightOfReplyState.fieldErrors?.phone ? (
                    <span className="mt-1 block text-xs font-sans text-zn-hot">{rightOfReplyState.fieldErrors.phone}</span>
                  ) : null}
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1 block text-[11px] font-display font-bold uppercase tracking-[0.18em] text-zn-text/60">
                    Твоят отговор
                  </span>
                  <textarea
                    value={rightOfReplyForm.message}
                    onChange={(event) => handleRightOfReplyFieldChange('message', event.target.value)}
                    aria-label="Текст на правото на отговор"
                    rows={5}
                    className="w-full resize-y border-3 border-[#1C1428] bg-white px-3 py-2 font-sans text-sm text-zn-text outline-none focus:border-zn-purple"
                  />
                  {rightOfReplyState.fieldErrors?.message ? (
                    <span className="mt-1 block text-xs font-sans text-zn-hot">{rightOfReplyState.fieldErrors.message}</span>
                  ) : null}
                </label>

                <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-sans text-zn-text/65">
                    Искането ще бъде заведено към редакцията като право на отговор по статия №{article.id}.
                  </p>
                  <button
                    type="submit"
                    disabled={rightOfReplyPending}
                    className="btn-primary min-w-[220px] disabled:opacity-60"
                    aria-busy={rightOfReplyPending}
                  >
                    {rightOfReplyPending ? 'Изпращане...' : 'Изпрати искане'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Bottom ad */}
          <AdSlot ads={ads} slot="article.bottom" pageType="article" articleId={article.id} categoryId={article.category} />

          {/* Related articles */}
          {relatedArticles.length > 0 && (
            <section className="mt-10 pt-8 border-t-4 border-zn-border/30 relative">
              <div className="absolute -top-4 left-6">
                <span className="comic-sticker">Още</span>
              </div>
              <h2 className="font-display text-xl font-black text-zn-text tracking-wider uppercase">Свързани новини</h2>
              <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-2 mb-5" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {relatedArticles.map(({ article: related, reason }, index) => {
                  const design = getComicCardStyle('articleRelated', index, related, siteSettings?.layoutPresets?.articleRelated);
                  return (
                    <div key={related.id}>
                      <ComicNewsCard
                        article={related}
                        compact
                        tilt={design.tilt}
                        variant={design.variant}
                        sticker={reason}
                        stripe={design.stripe}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </article>

        {/* Sidebar */}
        <aside aria-label="Странична лента" className="hidden lg:block space-y-6">
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
                    className={`article-toc-link ${heading.level === 'h3' ? 'article-toc-link-sub' : ''} ${activeHeadingId === heading.id ? 'article-toc-link-active' : ''}`}
                    aria-current={activeHeadingId === heading.id ? 'location' : undefined}
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
            <Link to={`/author/${author.id}`} className="block newspaper-page comic-panel comic-dots p-5 text-center relative hover:shadow-lg transition-shadow">
              <div className="tape-deco absolute -top-2 right-6 w-12 h-4 bg-yellow-200/70 dark:bg-yellow-700/30 border border-black/5 dark:border-yellow-600/20 transform rotate-3 z-10" />
              <div className="w-16 h-16 bg-zn-hot text-white flex items-center justify-center font-display font-black text-2xl border-3 border-[#1C1428] mx-auto mb-3 relative z-[2] comic-ink-shadow overflow-hidden">
                {author.avatarImage ? (
                  <img src={author.avatarImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  author.name?.charAt(0)
                )}
              </div>
              <h3 className="font-display font-bold text-lg text-zn-text tracking-wider relative z-[2]">{author.name}</h3>
              <p className="text-sm font-sans text-zn-hot font-semibold relative z-[2]">{author.role}</p>
              <div className="mt-3 pt-3 border-t-2 border-zn-border/50 relative z-[2]">
                <p className="text-xs font-display font-black text-zn-text-dim uppercase tracking-widest">
                  {articles.filter(a => a.authorId === author.id).length} публикации
                </p>
              </div>
            </Link>
          )}

          <ErrorBoundary fallback={null}><TrendingSidebar /></ErrorBoundary>

          <ErrorBoundary fallback={null}>
            <AdSlot ads={ads} slot="article.sidebar.1" pageType="article" articleId={article.id} categoryId={article.category} />
          </ErrorBoundary>
          <ErrorBoundary fallback={null}>
            <AdSlot ads={ads} slot="article.sidebar.2" pageType="article" articleId={article.id} categoryId={article.category} />
          </ErrorBoundary>
        </aside>
      </div>

      {lightboxImage ? (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Преглед на изображение"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            aria-label="Затвори изображението"
            onClick={() => setLightboxImage(null)}
          >
            ×
          </button>
          <img
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            loading="eager"
            decoding="async"
            onClick={() => setLightboxImage(null)}
          />
          {lightboxImage.caption ? (
            <div className="lightbox-caption">{lightboxImage.caption}</div>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
