import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, Clock, Copy, Eye, Mail, Sparkles } from 'lucide-react';
import { usePublicData } from '../context/DataContext';
import { api } from '../utils/api';
import { copyToClipboard } from '../utils/copyToClipboard';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import ResponsiveImage from '../components/ResponsiveImage';
import YouTubeEmbed from '../components/YouTubeEmbed';
import TrendingSidebar from '../components/TrendingSidebar';
import ErrorBoundary from '../components/ErrorBoundary';
import AdSlot from '../components/ads/AdSlot';
import ArticleReactions from '../components/ArticleReactions';
import CommentsSection from '../components/CommentsSection';
import ComicNewsCard from '../components/ComicNewsCard';
import { formatNewsDate } from '../utils/newsDate';
import {
  isCefYouTubeFallbackEnvironment,
  replaceInlineYouTubeIframesWithFallback,
} from '../utils/youtubeEmbeds';

const categoryColors = {
  crime: 'bg-zn-purple text-white',
  politics: 'bg-blue-500 text-white',
  business: 'bg-zn-hot text-white',
  society: 'bg-amber-700 text-white',
  underground: 'bg-zn-text text-white',
  emergency: 'bg-red-700 text-white',
  reportage: 'bg-violet-700 text-white',
  breaking: 'bg-red-600 text-white',
};

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

function serializeArticleNode(node) {
  if (!node) return '';
  if (node.nodeType === 1) return node.outerHTML || '';
  if (node.nodeType === 3) return node.textContent || '';
  return '';
}

function buildConceptPresentation(article) {
  const fallbackHtml = article?.content || `<p>${article?.excerpt || ''}</p>`;
  const fallback = {
    html: fallbackHtml,
    headings: [],
    pullQuote: article?.excerpt || '',
    leadHtml: fallbackHtml,
    bodyHtml: '',
  };

  if (!article?.content || typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return fallback;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="concept-root">${article.content}</div>`, 'text/html');
    const root = doc.getElementById('concept-root');
    if (!root) return fallback;

    if (isCefYouTubeFallbackEnvironment()) {
      replaceInlineYouTubeIframesWithFallback(root, article.id);
    }

    const headings = [];
    const usedIds = new Map();
    root.querySelectorAll('h2, h3').forEach((heading, index) => {
      const label = (heading.textContent || '').trim();
      if (!label) return;
      const baseId = label
        .toLowerCase()
        .replace(/[^a-z0-9а-яё\s-]/gi, '')
        .replace(/\s+/g, '-')
        .slice(0, 42) || `section-${index + 1}`;
      const count = usedIds.get(baseId) || 0;
      usedIds.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
      heading.id = id;
      headings.push({
        id,
        label,
        level: heading.tagName.toLowerCase(),
      });
    });

    const firstParagraph = root.querySelector('p');
    if (firstParagraph) {
      firstParagraph.classList.add('article-lead');
    }

    const leadNodes = [];
    const bodyNodes = [];
    let leadParagraphs = 0;
    let leadClosed = false;

    Array.from(root.childNodes || []).forEach((node) => {
      const html = serializeArticleNode(node);
      if (!html) return;

      if (!leadClosed) {
        leadNodes.push(html);
        if (node.nodeType === 1 && node.tagName?.toLowerCase() === 'p') {
          leadParagraphs += 1;
          if (leadParagraphs >= 2) {
            leadClosed = true;
          }
        }
        return;
      }

      bodyNodes.push(html);
    });

    return {
      html: root.innerHTML,
      headings,
      pullQuote: root.querySelector('blockquote')?.textContent?.trim() || article.excerpt || '',
      leadHtml: leadNodes.join('') || fallbackHtml,
      bodyHtml: bodyNodes.join(''),
    };
  } catch {
    return fallback;
  }
}

function ArticleConceptSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse" aria-label="Зареждане на концепта">
      <div className="comic-panel bg-white p-5 mb-6">
        <div className="h-5 w-40 bg-zn-text/10 rounded mb-4" />
        <div className="h-10 w-10/12 bg-zn-text/10 rounded mb-3" />
        <div className="h-5 w-7/12 bg-zn-text/10 rounded" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_300px] gap-6">
        <div className="h-60 bg-zn-text/10 rounded" />
        <div className="h-[40rem] bg-zn-text/10 rounded" />
        <div className="h-80 bg-zn-text/10 rounded" />
      </div>
    </div>
  );
}

export default function ArticlePageConcept() {
  const { id } = useParams();
  const { articles, authors, categories, ads, incrementArticleView, loading } = usePublicData();
  const articleId = Number.parseInt(id, 10);
  const contextArticle = articles.find((candidate) => candidate.id === articleId);
  const [directArticle, setDirectArticle] = useState(null);
  const [hydratingArticle, setHydratingArticle] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rightOfReplyForm, setRightOfReplyForm] = useState(INITIAL_RIGHT_OF_REPLY_FORM);
  const [rightOfReplyState, setRightOfReplyState] = useState(INITIAL_RIGHT_OF_REPLY_STATE);
  const [rightOfReplyPending, setRightOfReplyPending] = useState(false);
  const [publishedReplyArticles, setPublishedReplyArticles] = useState([]);
  const [publishedReplyLoading, setPublishedReplyLoading] = useState(false);
  const viewCounted = useRef(false);

  useEffect(() => {
    setDirectArticle(null);
    setHydratingArticle(false);
    setCopied(false);
  }, [articleId]);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isInteger(articleId)) return undefined;
    if (directArticle?.id === articleId && directArticle?.content) return undefined;
    if (contextArticle?.content) return undefined;

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
  }, [articleId, contextArticle?.content, directArticle?.content, directArticle?.id]);

  const article = directArticle || contextArticle;
  const author = article ? authors.find((candidate) => candidate.id === article.authorId) : null;
  const category = article ? categories.find((candidate) => candidate.id === article.category) : null;
  const articlePresentation = useMemo(() => buildConceptPresentation(article), [article]);

  useDocumentTitle(makeTitle(article?.title ? `${article.title} · Концепт` : 'Концепт статия'));

  const articleMetaTags = useMemo(() => {
    if (!article) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const rawImg = article.image || article.shareImage || '';
    const image = rawImg
      ? (rawImg.startsWith('http') ? rawImg : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`)
      : `${origin}/og.png`;
    return {
      title: `${article.title} · Концепт`,
      description: article.excerpt || article.title,
      image,
      url: `${origin}/article/${article.id}/concept`,
      type: 'article',
    };
  }, [article]);
  useDocumentMeta(articleMetaTags);

  useEffect(() => {
    viewCounted.current = false;
  }, [articleId]);

  useEffect(() => {
    if (!article?.id || viewCounted.current) return;
    viewCounted.current = true;
    incrementArticleView(article.id);
  }, [article?.id, incrementArticleView]);

  useEffect(() => {
    setRightOfReplyForm(INITIAL_RIGHT_OF_REPLY_FORM);
    setRightOfReplyState(INITIAL_RIGHT_OF_REPLY_STATE);
    setRightOfReplyPending(false);
    setPublishedReplyArticles([]);
    setPublishedReplyLoading(false);
  }, [article?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isInteger(article?.id) || article.id <= 0) return undefined;

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

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    return articles
      .filter((candidate) => candidate.id !== article.id && candidate.status !== 'draft')
      .map((candidate) => ({
        article: candidate,
        score: (candidate.category === article.category ? 40 : 0) + ((candidate.views || 0) / 5000),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.article);
  }, [article, articles]);

  const previewUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/article/${article?.id || articleId}/concept`
    : `/article/${article?.id || articleId}/concept`;

  const handleCopyPreviewLink = async () => {
    const ok = await copyToClipboard(previewUrl);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleRightOfReplyFieldChange = (field, value) => {
    setRightOfReplyForm((current) => ({ ...current, [field]: value }));
    setRightOfReplyState((current) => ({
      ...current,
      status: current.status === 'success' ? 'idle' : current.status,
      fieldErrors: {
        ...current.fieldErrors,
        [field]: '',
      },
    }));
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
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if ((loading || hydratingArticle) && !article) {
    return <ArticleConceptSkeleton />;
  }

  if (!article) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-black uppercase tracking-wider text-zn-text mb-4">
          Концептът не намери статията
        </h1>
        <Link to="/" className="btn-primary inline-flex">
          Към началната страница
        </Link>
      </div>
    );
  }

  const conceptNotes = [
    'По-силен masthead с по-ясна йерархия между заглавие, lead и meta.',
    'Story map вляво, за да се сканират дългите материали по-бързо.',
    'По-отчетливо разделение между редакционното четене, коментарите и правото на отговор.',
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-4 py-8">
      <div className="comic-panel comic-dots bg-white p-4 sm:p-5 mb-6 relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-zn-purple/12 to-transparent pointer-events-none" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="headline-banner-purple text-[10px] sm:text-xs">КОНЦЕПТ PREVIEW</span>
              <span className="comic-chip text-[10px] sm:text-xs">Без промяна на live страницата</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-black uppercase tracking-wider text-zn-text">
              Нов прочит на статията
            </h1>
            <p className="mt-2 font-sans text-sm md:text-base text-zn-text/75 max-w-3xl">
              Тук гледаме как може да изглежда по-редакционен и по-премиум article layout, преди да сменим основната страница.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={`/article/${article.id}`} className="nav-pill inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Към live статията
            </Link>
            <button type="button" onClick={handleCopyPreviewLink} className="btn-primary inline-flex items-center gap-2">
              <Copy className="h-4 w-4" />
              {copied ? 'Копирано!' : 'Копирай preview линк'}
            </button>
          </div>
        </div>
      </div>

      <section className="comic-panel comic-dots bg-white p-4 md:p-6 xl:p-7 mb-6 overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-6 xl:gap-8 items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="headline-banner-gold text-[10px] sm:text-xs">FEATURE LAYOUT</span>
              {article.breaking ? <span className="breaking-badge font-sans">Извънредно</span> : null}
              {category ? (
                <Link
                  to={`/category/${category.id}`}
                  className={`px-2.5 py-0.5 text-xs font-display font-bold uppercase tracking-wide ${categoryColors[article.category] || 'bg-zn-text text-white'}`}
                >
                  {category.name}
                </Link>
              ) : null}
            </div>

            <h2 className="font-display text-3xl md:text-5xl xl:text-6xl font-black uppercase leading-[0.92] tracking-[0.02em] text-zn-text text-shadow-brutal">
              {article.title}
            </h2>
            <p className="mt-4 max-w-3xl font-sans text-lg md:text-xl leading-relaxed text-zn-text/80">
              {article.excerpt}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm font-sans text-zn-text/65">
              {author ? (
                <Link to={`/author/${author.id}`} className="inline-flex items-center gap-2 hover:text-zn-hot transition-colors">
                  <span className="flex h-10 w-10 items-center justify-center border-3 border-[#1C1428] bg-zn-hot text-white font-display font-black">
                    {author.name?.charAt(0) || 'Z'}
                  </span>
                  <span className="font-semibold text-zn-text">{author.name}</span>
                </Link>
              ) : null}
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{formatNewsDate(article.date)}</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{(article.views || 0).toLocaleString()}</span>
              <span className="comic-chip-hot text-[10px] sm:text-xs">{article.readTime || 4} мин четене</span>
            </div>

            {articlePresentation.headings.length > 0 ? (
              <div className="mt-6">
                <p className="text-[11px] font-display font-bold uppercase tracking-[0.22em] text-zn-text/55 mb-2">
                  Карта на материала
                </p>
                <div className="flex flex-wrap gap-2">
                  {articlePresentation.headings.slice(0, 5).map((heading) => (
                    <button
                      key={heading.id}
                      type="button"
                      onClick={() => scrollToSection(heading.id)}
                      className="nav-pill inline-flex items-center gap-2 text-left"
                    >
                      <span>{heading.label}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <div className="absolute -top-3 left-3 z-[2] comic-sticker">Редакционен hero</div>
            <div className="comic-panel overflow-hidden bg-zn-bg">
              {article.youtubeUrl ? (
                <YouTubeEmbed
                  url={article.youtubeUrl}
                  title={article.title}
                  thumbnailUrl={article.image}
                  articleId={article.id}
                />
              ) : (
                <ResponsiveImage
                  src={article.image}
                  pipeline={article.imageMeta}
                  alt={article.title}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  sizes="(max-width: 1280px) 100vw, 40vw"
                  className="w-full h-auto"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <AdSlot ads={ads} slot="article.afterCover" pageType="article" articleId={article.id} categoryId={article.category} />

      <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_300px] gap-6 mt-6">
        <aside className="hidden xl:block space-y-5">
          <div className="newspaper-page comic-panel comic-dots p-4 sticky top-24">
            <p className="text-[11px] font-display font-bold uppercase tracking-[0.24em] text-zn-purple mb-3">
              Story map
            </p>
            <div className="space-y-2">
              {articlePresentation.headings.length > 0 ? articlePresentation.headings.map((heading, index) => (
                <button
                  key={heading.id}
                  type="button"
                  onClick={() => scrollToSection(heading.id)}
                  className="w-full text-left comic-panel-hover border-2 border-[#1C1428] bg-white px-3 py-2"
                >
                  <span className="block text-[10px] font-mono text-zn-text/45 mb-1">0{index + 1}</span>
                  <span className="block text-sm font-display font-bold uppercase tracking-wide text-zn-text">
                    {heading.label}
                  </span>
                </button>
              )) : (
                <p className="text-sm font-sans text-zn-text/65">
                  Тази статия е по-кратка и няма отделни секции за навигация.
                </p>
              )}
            </div>
          </div>
        </aside>

        <article className="min-w-0 space-y-6">
          <section className="comic-panel bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="headline-banner-hot text-[10px] sm:text-xs">LEAD</span>
              <span className="comic-chip text-[10px] sm:text-xs">По-силен вход в материала</span>
            </div>
            <div
              className="prose prose-lg max-w-none article-body
                [&_p]:font-sans [&_p]:leading-relaxed [&_p]:mb-4 [&_.article-lead]:text-lg [&_.article-lead]:font-semibold
                [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-black [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-8
                [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mt-6
                [&_blockquote]:border-l-4 [&_blockquote]:border-zn-purple [&_blockquote]:pl-5 [&_blockquote]:italic"
              dangerouslySetInnerHTML={{ __html: articlePresentation.leadHtml }}
            />
          </section>

          {articlePresentation.pullQuote ? (
            <section className="comic-bubble bg-white px-6 py-5">
              <p className="font-display text-2xl md:text-3xl font-black uppercase leading-tight tracking-wide text-zn-text">
                {articlePresentation.pullQuote}
              </p>
            </section>
          ) : null}

          {articlePresentation.bodyHtml ? (
            <section className="newspaper-page comic-panel comic-dots p-5 md:p-6">
              <div
                className="prose prose-lg max-w-none article-body
                  [&_p]:font-sans [&_p]:leading-relaxed [&_p]:mb-4
                  [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-black [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-9
                  [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mt-7
                  [&_blockquote]:border-l-4 [&_blockquote]:border-zn-purple [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:bg-white/70 [&_blockquote]:py-2
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:font-sans [&_li]:mb-1
                  [&_a]:text-zn-hot [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: articlePresentation.bodyHtml }}
              />
            </section>
          ) : null}

          <ArticleReactions articleId={article.id} reactions={article.reactions} />
          <CommentsSection articleId={article.id} />

          <section className="newspaper-page comic-panel comic-dots p-5 md:p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-zn-purple/10 pointer-events-none" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="headline-banner-purple text-[10px] sm:text-xs">ПРАВО НА ОТГОВОР</span>
                <span className="comic-chip text-[10px] sm:text-xs">По-официален и ясен тон</span>
              </div>
              <div className="flex items-start gap-3 mb-4">
                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-3 border-[#1C1428] bg-white text-zn-purple">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg md:text-xl font-black uppercase tracking-wide text-zn-text">
                    Засегнат си от тази публикация?
                  </h3>
                  <p className="mt-1 text-sm font-sans leading-relaxed text-zn-text/80">
                    Ако материалът засяга пряко теб, твоята организация или твоята позиция, изпрати искане за право на отговор.
                  </p>
                </div>
              </div>

              {publishedReplyLoading ? (
                <div className="mb-4 border border-zn-purple/20 bg-white/80 px-4 py-3 text-sm font-sans text-zn-text/70">
                  Зареждаме публикуваните отговори по тази публикация...
                </div>
              ) : null}

              {publishedReplyArticles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                  {publishedReplyArticles.map((replyArticle) => (
                    <Link
                      key={replyArticle.id}
                      to={`/article/${replyArticle.id}`}
                      className="comic-story-card bg-white p-4 flex flex-col gap-2"
                    >
                      <span className="comic-chip-hot text-[10px] w-fit">Публикуван отговор</span>
                      <h4 className="font-display text-sm font-black uppercase tracking-wide text-zn-text">
                        {replyArticle.title}
                      </h4>
                      {replyArticle.excerpt ? (
                        <p className="text-sm font-sans text-zn-text/70 line-clamp-3">{replyArticle.excerpt}</p>
                      ) : null}
                      <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-[0.18em] text-zn-purple">
                        Отвори
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
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

              <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleRightOfReplySubmit}>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-display font-bold uppercase tracking-[0.18em] text-zn-text/60">Име</span>
                  <input
                    type="text"
                    value={rightOfReplyForm.name}
                    onChange={(event) => handleRightOfReplyFieldChange('name', event.target.value)}
                    className="w-full border-3 border-[#1C1428] bg-white px-3 py-2 font-sans text-sm text-zn-text outline-none focus:border-zn-purple"
                  />
                  {rightOfReplyState.fieldErrors?.name ? <span className="mt-1 block text-xs font-sans text-zn-hot">{rightOfReplyState.fieldErrors.name}</span> : null}
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-display font-bold uppercase tracking-[0.18em] text-zn-text/60">Телефон</span>
                  <input
                    type="text"
                    value={rightOfReplyForm.phone}
                    onChange={(event) => handleRightOfReplyFieldChange('phone', event.target.value)}
                    className="w-full border-3 border-[#1C1428] bg-white px-3 py-2 font-sans text-sm text-zn-text outline-none focus:border-zn-purple"
                  />
                  {rightOfReplyState.fieldErrors?.phone ? <span className="mt-1 block text-xs font-sans text-zn-hot">{rightOfReplyState.fieldErrors.phone}</span> : null}
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-[11px] font-display font-bold uppercase tracking-[0.18em] text-zn-text/60">Твоят отговор</span>
                  <textarea
                    value={rightOfReplyForm.message}
                    onChange={(event) => handleRightOfReplyFieldChange('message', event.target.value)}
                    rows={5}
                    className="w-full resize-y border-3 border-[#1C1428] bg-white px-3 py-2 font-sans text-sm text-zn-text outline-none focus:border-zn-purple"
                  />
                  {rightOfReplyState.fieldErrors?.message ? <span className="mt-1 block text-xs font-sans text-zn-hot">{rightOfReplyState.fieldErrors.message}</span> : null}
                </label>
                <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-sans text-zn-text/65">
                    Искането ще бъде заведено към редакцията като право на отговор по статия №{article.id}.
                  </p>
                  <button type="submit" disabled={rightOfReplyPending} className="btn-primary min-w-[220px] disabled:opacity-60">
                    {rightOfReplyPending ? 'Изпращане...' : 'Изпрати искане'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {relatedArticles.length > 0 ? (
            <section className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="headline-banner-hot text-[10px] sm:text-xs">ОЩЕ ПО ТЕМАТА</span>
                <p className="text-sm font-sans text-zn-text/65">Тук концепцията държи related stories като по-редакционен финал.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {relatedArticles.map((related) => (
                  <ComicNewsCard key={related.id} article={related} compact />
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="space-y-6">
          <section className="newspaper-page comic-panel comic-dots p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-zn-purple" />
              <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-zn-text">
                Какво пробваме
              </p>
            </div>
            <ul className="space-y-3">
              {conceptNotes.map((note) => (
                <li key={note} className="font-sans text-sm leading-relaxed text-zn-text/75">
                  {note}
                </li>
              ))}
            </ul>
          </section>

          {author ? (
            <section className="comic-panel bg-white p-5">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-zn-purple mb-2">
                Авторски rail
              </p>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-14 w-14 items-center justify-center border-3 border-[#1C1428] bg-zn-hot text-white font-display font-black text-xl">
                  {author.name?.charAt(0) || 'Z'}
                </div>
                <div>
                  <p className="font-display text-lg font-black uppercase tracking-wide text-zn-text">{author.name}</p>
                  <p className="font-sans text-sm text-zn-text/65">{author.role}</p>
                </div>
              </div>
              <Link to={`/author/${author.id}`} className="nav-pill inline-flex items-center gap-2">
                Всички негови материали
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </section>
          ) : null}

          <ErrorBoundary fallback={null}>
            <TrendingSidebar />
          </ErrorBoundary>

          <AdSlot ads={ads} slot="article.sidebar.1" pageType="article" articleId={article.id} categoryId={article.category} />
        </aside>
      </div>
    </motion.div>
  );
}
