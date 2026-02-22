import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search as SearchIcon, FileText, Briefcase, Scale, CalendarDays, Crosshair, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { api } from '../utils/api';
import React, { useState, useMemo } from 'react';
import ComicNewsCard from '../components/ComicNewsCard';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';

const ARTICLE_SEARCH_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,hero,views,tags,status,publishAt,shareTitle,shareSubtitle,shareBadge,shareAccent,shareImage,cardSticker';

export default function SearchPage() {
  const { articles, jobs, court, events, wanted, siteSettings } = useData();
  const layoutPresets = siteSettings?.layoutPresets || {};
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const trimmedQuery = query.trim();
  useDocumentTitle(makeTitle(trimmedQuery ? `Търсене: ${trimmedQuery.slice(0, 80)}` : 'Търсене'));
  const [localQuery, setLocalQuery] = useState(query);
  const [remoteResults, setRemoteResults] = useState({
    articles: [],
    jobs: [],
    court: [],
    events: [],
    wanted: [],
  });
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState('');

  // Sync input when URL query changes (e.g. from Navbar search)
  React.useEffect(() => { setLocalQuery(query); }, [query]);

  React.useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();
    if (!trimmed) {
      setRemoteResults({
        articles: [],
        jobs: [],
        court: [],
        events: [],
        wanted: [],
      });
      setRemoteLoading(false);
      setRemoteError('');
      return () => { cancelled = true; };
    }

    const timer = setTimeout(() => {
      setRemoteLoading(true);
      setRemoteError('');
      api.search.query({
        q: trimmed,
        fields: ARTICLE_SEARCH_FIELDS,
        articleLimit: 24,
        sectionLimit: 12,
      })
        .then((payload) => {
          if (cancelled) return;
          setRemoteResults({
            articles: Array.isArray(payload?.articles) ? payload.articles : [],
            jobs: Array.isArray(payload?.jobs) ? payload.jobs : [],
            court: Array.isArray(payload?.court) ? payload.court : [],
            events: Array.isArray(payload?.events) ? payload.events : [],
            wanted: Array.isArray(payload?.wanted) ? payload.wanted : [],
          });
        })
        .catch((error) => {
          if (cancelled) return;
          setRemoteError(error?.message || 'Грешка при търсенето.');
          setRemoteResults({
            articles: [],
            jobs: [],
            court: [],
            events: [],
            wanted: [],
          });
        })
        .finally(() => {
          if (cancelled) return;
          setRemoteLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const q = trimmedQuery.toLowerCase();

  const localArticleResults = useMemo(() => !q ? [] : articles.filter(article =>
    String(article?.title || '').toLowerCase().includes(q) ||
    String(article?.excerpt || '').toLowerCase().includes(q) ||
    (Array.isArray(article?.tags) && article.tags.some(t => String(t).toLowerCase().includes(q)))
  ), [q, articles]);

  const localJobResults = useMemo(() => !q ? [] : jobs.filter(j =>
    String(j?.title || '').toLowerCase().includes(q) ||
    String(j?.org || '').toLowerCase().includes(q) ||
    String(j?.description || '').toLowerCase().includes(q)
  ), [q, jobs]);

  const localCourtResults = useMemo(() => !q ? [] : court.filter(c =>
    String(c?.title || '').toLowerCase().includes(q) ||
    String(c?.details || '').toLowerCase().includes(q) ||
    String(c?.defendant || '').toLowerCase().includes(q) ||
    String(c?.charge || '').toLowerCase().includes(q)
  ), [q, court]);

  const localEventResults = useMemo(() => !q ? [] : events.filter(e =>
    String(e?.title || '').toLowerCase().includes(q) ||
    String(e?.description || '').toLowerCase().includes(q) ||
    String(e?.location || '').toLowerCase().includes(q)
  ), [q, events]);

  const localWantedResults = useMemo(() => !q ? [] : wanted.filter(w =>
    String(w?.name || '').toLowerCase().includes(q) ||
    String(w?.charge || '').toLowerCase().includes(q)
  ), [q, wanted]);

  const useLocalFallback = Boolean(trimmedQuery) && Boolean(remoteError);
  const articleResults = useLocalFallback ? localArticleResults : (Array.isArray(remoteResults.articles) ? remoteResults.articles : []);
  const jobResults = useLocalFallback ? localJobResults : (Array.isArray(remoteResults.jobs) ? remoteResults.jobs : []);
  const courtResults = useLocalFallback ? localCourtResults : (Array.isArray(remoteResults.court) ? remoteResults.court : []);
  const eventResults = useLocalFallback ? localEventResults : (Array.isArray(remoteResults.events) ? remoteResults.events : []);
  const wantedResults = useLocalFallback ? localWantedResults : (Array.isArray(remoteResults.wanted) ? remoteResults.wanted : []);
  const totalResults = articleResults.length + jobResults.length + courtResults.length + eventResults.length + wantedResults.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-4 py-8"
    >
      {/* Header */}
      <div className="newspaper-page comic-panel comic-dots p-6 mb-6 relative">
        <div className="absolute -top-2 right-8 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-4 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
        <div className="flex items-center gap-3 relative z-[2]">
          <SearchIcon className="w-8 h-8 text-zn-hot" />
          <h1 className="font-display text-3xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal">Търсене</h1>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-3 relative z-[2]" />
      </div>

      {/* Search form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (localQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(localQuery.trim())}`);
          }
        }}
        className="mb-8"
      >
        <div className="relative comic-panel bg-white">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zn-text-muted z-[2]" />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Търси по ключова дума..."
            className="w-full pl-12 pr-10 py-3.5 bg-transparent text-zn-text placeholder-zn-text-dim font-display text-sm uppercase tracking-wider outline-none relative z-[2]"
            aria-label="Търсене"
          />
          {localQuery && (
            <button
              type="button"
              onClick={() => {
                setLocalQuery('');
                navigate('/search');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-zn-text-muted hover:text-zn-hot transition-colors z-[3]"
              aria-label="Изчисти търсенето"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {query && (
        <p className="mb-6 font-display font-bold text-sm text-zn-text-muted uppercase tracking-wider">
          {totalResults} резултата за &ldquo;<span className="text-zn-hot">{query}</span>&rdquo;
          {remoteLoading && <span className="ml-2 text-zn-text-dim">Търсене...</span>}
          {useLocalFallback && <span className="ml-2 text-zn-hot">Показани са локални резултати.</span>}
        </p>
      )}

      {query && totalResults === 0 && !remoteLoading && (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
          <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">ПРАЗНО!</div>
          <p className="font-display font-black text-base text-zn-text mb-2 uppercase tracking-wider relative z-[2]">Няма намерени резултати.</p>
          <p className="text-sm font-sans text-zn-text-muted relative z-[2]">Опитай с различни ключови думи.</p>
        </div>
      )}

      {/* Article results (loading skeleton) */}
      {query && remoteLoading && articleResults.length === 0 && (
        <section className="mb-8" aria-label="Зареждане на резултати">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-6 bg-zn-hot" />
            <FileText className="w-4 h-4 text-zn-hot" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-zn-hot">Статии</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-zn-hot/30 to-transparent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="comic-panel bg-white p-4 animate-pulse">
                <div className="h-28 w-full bg-zn-text/10 rounded mb-3" />
                <div className="h-4 w-5/6 bg-zn-text/10 rounded mb-2" />
                <div className="h-3 w-full bg-zn-text/10 rounded mb-1" />
                <div className="h-3 w-4/5 bg-zn-text/10 rounded" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Article results */}
      {articleResults.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-6 bg-zn-hot" />
            <FileText className="w-4 h-4 text-zn-hot" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-zn-hot">Статии ({articleResults.length})</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-zn-hot/30 to-transparent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articleResults.map((article, index) => {
              const design = getComicCardStyle('searchListing', index, article, layoutPresets.searchListing);
              return (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.06 }}
                  className="h-full"
                >
                  <ComicNewsCard
                    article={article}
                    compact
                    tilt={design.tilt}
                    variant={design.variant}
                    sticker={design.sticker}
                    stripe={design.stripe}
                  />
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Job results */}
      {jobResults.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-6 bg-zn-purple" />
            <Briefcase className="w-4 h-4 text-zn-purple" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-zn-purple">Обяви за работа ({jobResults.length})</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-zn-purple/30 to-transparent" />
          </div>
          <div className="space-y-3">
            {jobResults.map((j, index) => (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
              >
                <Link to="/jobs" className="block comic-panel comic-panel-hover bg-white p-4">
                  <h3 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{j.title}</h3>
                  <p className="text-xs font-display font-bold text-zn-hot uppercase tracking-wider mt-1">{j.org} · {j.salary}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Court results */}
      {courtResults.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-6 bg-blue-600" />
            <Scale className="w-4 h-4 text-blue-600" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-blue-600">Съдебна хроника ({courtResults.length})</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-blue-600/30 to-transparent" />
          </div>
          <div className="space-y-3">
            {courtResults.map((c, index) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
              >
                <Link to="/court" className="block comic-panel comic-panel-hover bg-white p-4 border-l-4 border-l-blue-600">
                  <h3 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{c.title}</h3>
                  <p className="text-xs font-sans text-zn-text-muted mt-1">{c.defendant} · {c.date}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Event results */}
      {eventResults.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-6 bg-emerald-700" />
            <CalendarDays className="w-4 h-4 text-emerald-700" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-emerald-700">Събития ({eventResults.length})</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-emerald-700/30 to-transparent" />
          </div>
          <div className="space-y-3">
            {eventResults.map((e, index) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
              >
                <Link to="/events" className="block comic-panel comic-panel-hover bg-white p-4">
                  <h3 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{e.title}</h3>
                  <p className="text-xs font-sans text-zn-text-muted mt-1">{e.location} · {e.date}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Wanted results */}
      {wantedResults.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-6 bg-red-700" />
            <Crosshair className="w-4 h-4 text-red-700" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-red-700">Издирвани ({wantedResults.length})</h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-red-700/30 to-transparent" />
          </div>
          <div className="space-y-3">
            {wantedResults.map((w, index) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
              >
                <div className="comic-panel comic-panel-hover bg-white p-4 border-l-4 border-l-red-700">
                  <h3 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{w.name}</h3>
                  <p className="text-xs font-sans text-zn-text-muted mt-1">{w.charge} · Награда: <span className="text-zn-gold font-display font-bold">{w.bounty}</span></p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
