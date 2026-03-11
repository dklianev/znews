import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search as SearchIcon, FileText, Briefcase, Scale, CalendarDays, Crosshair, X, TrendingUp, History, Sparkles } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { usePublicData } from '../context/DataContext';
import { api } from '../utils/api';
import ComicNewsCard from '../components/ComicNewsCard';
import { getComicCardStyle } from '../utils/comicCardDesign';
import { makeTitle, useDocumentTitle } from '../hooks/useDocumentTitle';
import { searchCopy } from '../content/uiCopy';
import { filterSearchResultsByType, normalizeSearchType } from '../../shared/search.js';

const ARTICLE_SEARCH_FIELDS = 'id,title,excerpt,category,authorId,date,readTime,image,imageMeta,featured,breaking,sponsored,hero,views,tags,status,publishAt,shareTitle,shareSubtitle,shareBadge,shareAccent,shareImage,cardSticker';
const RECENT_SEARCHES_KEY = 'zn_recent_searches';
const SUGGESTION_TYPES = ['articles', 'jobs', 'court', 'events', 'wanted', 'category', 'trending'];

function getRecentSearches() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query) {
  if (typeof window === 'undefined') return [];
  const trimmed = String(query || '').trim();
  if (!trimmed) return getRecentSearches();
  const next = [trimmed, ...getRecentSearches().filter((item) => item !== trimmed)].slice(0, 8);
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

function SearchSectionHeader({ icon: Icon, title, tone = 'hot', count = null }) {
  const toneClass = tone === 'purple'
    ? 'text-zn-purple'
    : tone === 'blue'
      ? 'text-blue-600'
      : tone === 'green'
        ? 'text-emerald-700'
        : tone === 'red'
          ? 'text-red-700'
          : 'text-zn-hot';

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`h-1 w-6 ${tone === 'purple' ? 'bg-zn-purple' : tone === 'blue' ? 'bg-blue-600' : tone === 'green' ? 'bg-emerald-700' : tone === 'red' ? 'bg-red-700' : 'bg-zn-hot'}`} />
      <Icon className={`w-4 h-4 ${toneClass}`} />
      <h2 className={`font-display text-sm font-black uppercase tracking-widest ${toneClass}`}>
        {title}{Number.isFinite(count) ? ` (${count})` : ''}
      </h2>
      <div className={`h-1 flex-1 bg-gradient-to-r ${tone === 'purple' ? 'from-zn-purple/30' : tone === 'blue' ? 'from-blue-600/30' : tone === 'green' ? 'from-emerald-700/30' : tone === 'red' ? 'from-red-700/30' : 'from-zn-hot/30'} to-transparent`} />
    </div>
  );
}

export default function SearchPage() {
  const { articles, jobs, court, events, wanted, siteSettings, publicSectionStatus, loadJobs, loadCourt, loadEvents } = usePublicData();
  const layoutPresets = siteSettings?.layoutPresets || {};
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const searchType = normalizeSearchType(searchParams.get('type') || 'all');
  const trimmedQuery = query.trim();
  useDocumentTitle(makeTitle(trimmedQuery ? `${searchCopy.title}: ${trimmedQuery.slice(0, 80)}` : searchCopy.title));

  const [localQuery, setLocalQuery] = useState(query);
  const [remoteResults, setRemoteResults] = useState({ articles: [], jobs: [], court: [], events: [], wanted: [] });
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [trending, setTrending] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => getRecentSearches());

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.search.trending({ limit: 8 })
      .then((payload) => {
        if (cancelled) return;
        setTrending(Array.isArray(payload?.items) ? payload.items : []);
      })
      .catch(() => {
        if (!cancelled) setTrending([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!trimmedQuery || !remoteError) return undefined;
    if (publicSectionStatus.jobs === 'idle') loadJobs().catch(() => {});
    if (publicSectionStatus.court === 'idle') loadCourt().catch(() => {});
    if (publicSectionStatus.events === 'idle') loadEvents().catch(() => {});
    return undefined;
  }, [loadCourt, loadEvents, loadJobs, publicSectionStatus.court, publicSectionStatus.events, publicSectionStatus.jobs, remoteError, trimmedQuery]);

  useEffect(() => {
    let cancelled = false;
    const currentQuery = localQuery.trim();
    if (currentQuery.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const timer = setTimeout(() => {
      setSuggestLoading(true);
      api.search.suggest({ q: currentQuery, limit: 8 })
        .then((payload) => {
          if (cancelled) return;
          const next = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
          setSuggestions(next.filter((item) => SUGGESTION_TYPES.includes(item?.type)));
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSuggestLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [localQuery]);

  useEffect(() => {
    let cancelled = false;
    if (!trimmedQuery) {
      setRemoteResults({ articles: [], jobs: [], court: [], events: [], wanted: [] });
      setRemoteLoading(false);
      setRemoteError('');
      return () => {
        cancelled = true;
      };
    }

    const timer = setTimeout(() => {
      setRemoteLoading(true);
      setRemoteError('');
      api.search.query({
        q: trimmedQuery,
        type: searchType,
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
          setRecentSearches(saveRecentSearch(trimmedQuery));
        })
        .catch((error) => {
          if (cancelled) return;
          setRemoteError(error?.message || searchCopy.serviceError);
          setRemoteResults({ articles: [], jobs: [], court: [], events: [], wanted: [] });
        })
        .finally(() => {
          if (!cancelled) setRemoteLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, searchType]);

  const q = trimmedQuery.toLowerCase();

  const localArticleResults = useMemo(() => {
    if (!q) return [];
    const includeContentSearch = Boolean(trimmedQuery) && Boolean(remoteError);
    return articles.filter((article) => (
      String(article?.title || '').toLowerCase().includes(q)
      || String(article?.excerpt || '').toLowerCase().includes(q)
      || (Array.isArray(article?.tags) && article.tags.some((tag) => String(tag).toLowerCase().includes(q)))
      || (includeContentSearch && String(article?.content || '').toLowerCase().includes(q))
    ));
  }, [q, articles, trimmedQuery, remoteError]);

  const localJobResults = useMemo(() => !q ? [] : jobs.filter((item) =>
    String(item?.title || '').toLowerCase().includes(q)
    || String(item?.org || '').toLowerCase().includes(q)
    || String(item?.description || '').toLowerCase().includes(q)
  ), [q, jobs]);

  const localCourtResults = useMemo(() => !q ? [] : court.filter((item) =>
    String(item?.title || '').toLowerCase().includes(q)
    || String(item?.details || '').toLowerCase().includes(q)
    || String(item?.defendant || '').toLowerCase().includes(q)
    || String(item?.charge || '').toLowerCase().includes(q)
  ), [q, court]);

  const localEventResults = useMemo(() => !q ? [] : events.filter((item) =>
    String(item?.title || '').toLowerCase().includes(q)
    || String(item?.description || '').toLowerCase().includes(q)
    || String(item?.location || '').toLowerCase().includes(q)
  ), [q, events]);

  const localWantedResults = useMemo(() => !q ? [] : wanted.filter((item) =>
    String(item?.name || '').toLowerCase().includes(q)
    || String(item?.charge || '').toLowerCase().includes(q)
  ), [q, wanted]);

  const useLocalFallback = Boolean(trimmedQuery) && Boolean(remoteError);
  const searchResults = useMemo(() => filterSearchResultsByType(useLocalFallback ? {
    articles: localArticleResults,
    jobs: localJobResults,
    court: localCourtResults,
    events: localEventResults,
    wanted: localWantedResults,
  } : remoteResults, searchType), [
    localArticleResults,
    localCourtResults,
    localEventResults,
    localJobResults,
    localWantedResults,
    remoteResults,
    searchType,
    useLocalFallback,
  ]);
  const articleResults = searchResults.articles;
  const jobResults = searchResults.jobs;
  const courtResults = searchResults.court;
  const eventResults = searchResults.events;
  const wantedResults = searchResults.wanted;
  const totalResults = articleResults.length + jobResults.length + courtResults.length + eventResults.length + wantedResults.length;

  const sections = useMemo(() => ([
    { key: 'all', label: searchCopy.sections.all },
    { key: 'articles', label: searchCopy.sections.articles, count: articleResults.length },
    { key: 'jobs', label: searchCopy.sections.jobs, count: jobResults.length },
    { key: 'court', label: searchCopy.sections.court, count: courtResults.length },
    { key: 'events', label: searchCopy.sections.events, count: eventResults.length },
    { key: 'wanted', label: searchCopy.sections.wanted, count: wantedResults.length },
  ]), [articleResults.length, courtResults.length, eventResults.length, jobResults.length, wantedResults.length]);

  const navigateToSearch = (nextQuery, nextType = searchType) => {
    const trimmed = String(nextQuery || '').trim();
    if (!trimmed) {
      navigate('/search');
      return;
    }
    const params = new URLSearchParams({ q: trimmed });
    if (nextType && nextType !== 'all') params.set('type', nextType);
    navigate(`/search?${params.toString()}`);
  };

  const handleSuggestionPick = (suggestion) => {
    const suggestedType = ['articles', 'jobs', 'court', 'events', 'wanted'].includes(suggestion?.type) ? suggestion.type : 'all';
    setLocalQuery(suggestion?.label || '');
    navigateToSearch(suggestion?.label || '', suggestedType);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-4 py-8">
      <div className="newspaper-page comic-panel comic-dots p-6 mb-6 relative">
        <div className="absolute -top-2 right-8 w-14 h-5 bg-yellow-200/70 border border-black/5 transform rotate-4 z-10" style={{ boxShadow: '1px 1px 2px rgba(0,0,0,0.1)' }} />
        <div className="flex items-center gap-3 relative z-[2]">
          <SearchIcon className="w-8 h-8 text-zn-hot" />
          <h1 className="font-display text-3xl font-black text-zn-text tracking-wider uppercase text-shadow-brutal">{searchCopy.title}</h1>
        </div>
        <div className="h-1.5 bg-gradient-to-r from-zn-hot to-zn-orange mt-3 relative z-[2]" />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigateToSearch(localQuery);
        }}
        className="mb-5"
      >
        <div className="relative comic-panel bg-white">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zn-text-muted z-[2]" />
          <input
            type="text"
            value={localQuery}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder={searchCopy.inputPlaceholder}
            className="w-full pl-12 pr-10 py-3.5 bg-transparent text-zn-text placeholder-zn-text-dim font-display text-sm uppercase tracking-wider outline-none relative z-[2]"
            aria-label={searchCopy.title}
          />
          {localQuery && (
            <button
              type="button"
              onClick={() => {
                setLocalQuery('');
                navigate('/search');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-zn-text-muted hover:text-zn-hot transition-colors z-[3]"
              aria-label={searchCopy.clearSearch}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {(suggestLoading || suggestions.length > 0) && localQuery.trim().length >= 2 && (
          <div className="mt-3 comic-panel bg-white p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] font-display text-zn-text-dim">
              <Sparkles className="w-4 h-4 text-zn-hot" />
              {searchCopy.suggestionsTitle}
            </div>
            {suggestLoading && suggestions.length === 0 ? (
              <p className="text-sm text-zn-text-muted">{searchCopy.loading}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.label}-${index}`}
                    type="button"
                    onClick={() => handleSuggestionPick(suggestion)}
                    className="comic-chip hover:translate-y-[-1px] transition-transform"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => navigateToSearch(trimmedQuery, section.key)}
            className={`comic-chip ${searchType === section.key ? 'comic-chip-hot' : ''}`}
          >
            {section.label}{section.key !== 'all' ? ` (${section.count})` : ''}
          </button>
        ))}
      </div>

      {!trimmedQuery && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <section className="comic-panel comic-dots bg-white p-5">
            <SearchSectionHeader icon={TrendingUp} title={searchCopy.trendingTitle} tone="hot" />
            <div className="flex flex-wrap gap-2">
              {trending.map((item, index) => (
                <button key={`${item.query}-${index}`} type="button" onClick={() => navigateToSearch(item.query)} className="comic-chip comic-chip-hot">
                  {item.query}
                </button>
              ))}
              {trending.length === 0 && <p className="text-sm text-zn-text-muted">{searchCopy.loading}</p>}
            </div>
          </section>
          <section className="comic-panel comic-dots bg-white p-5">
            <SearchSectionHeader icon={History} title={searchCopy.recentTitle} tone="purple" />
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((item, index) => (
                <button key={`${item}-${index}`} type="button" onClick={() => navigateToSearch(item)} className="comic-chip">
                  {item}
                </button>
              ))}
              {recentSearches.length === 0 && <p className="text-sm text-zn-text-muted">{searchCopy.noRecentSearches}</p>}
            </div>
          </section>
        </div>
      )}

      {trimmedQuery && (
        <p className="mb-6 font-display font-bold text-sm text-zn-text-muted uppercase tracking-wider">
          {searchCopy.resultsFor} &ldquo;<span className="text-zn-hot">{trimmedQuery}</span>&rdquo; · {totalResults}
          {remoteLoading && <span className="ml-2 text-zn-text-dim">{searchCopy.loading}</span>}
          {useLocalFallback && <span className="ml-2 text-zn-hot">{searchCopy.fallbackNotice}</span>}
        </p>
      )}

      {trimmedQuery && totalResults === 0 && !remoteLoading && (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative mb-8">
          <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">0</div>
          <p className="font-display font-black text-base text-zn-text mb-2 uppercase tracking-wider relative z-[2]">{searchCopy.emptyTitle}</p>
          <p className="text-sm font-sans text-zn-text-muted relative z-[2]">{searchCopy.emptyBody}</p>
        </div>
      )}

      {articleResults.length > 0 && (
        <section className="mb-8">
          <SearchSectionHeader icon={FileText} title={searchCopy.sections.articles} tone="hot" count={articleResults.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articleResults.map((article, index) => {
              const design = getComicCardStyle('searchListing', index, article, layoutPresets.searchListing);
              return (
                <motion.div key={article.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06 }} className="h-full">
                  <ComicNewsCard article={article} compact tilt={design.tilt} variant={design.variant} sticker={design.sticker} stripe={design.stripe} />
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {jobResults.length > 0 && (
        <section className="mb-8">
          <SearchSectionHeader icon={Briefcase} title={searchCopy.sections.jobs} tone="purple" count={jobResults.length} />
          <div className="space-y-3">
            {jobResults.map((item, index) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06 }}>
                <Link to="/jobs" className="block comic-panel comic-panel-hover bg-white p-4">
                  <h3 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{item.title}</h3>
                  <p className="text-xs font-display font-bold text-zn-hot uppercase tracking-wider mt-1">{item.org} · {item.salary}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {courtResults.length > 0 && (
        <section className="mb-8">
          <SearchSectionHeader icon={Scale} title={searchCopy.sections.court} tone="blue" count={courtResults.length} />
          <div className="space-y-3">
            {courtResults.map((item, index) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06 }}>
                <Link to="/court" className="block comic-panel comic-panel-hover bg-white p-4 border-l-4 border-l-blue-600">
                  <h3 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{item.title}</h3>
                  <p className="text-xs font-sans text-zn-text-muted mt-1">{item.defendant} · {item.date}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {eventResults.length > 0 && (
        <section className="mb-8">
          <SearchSectionHeader icon={CalendarDays} title={searchCopy.sections.events} tone="green" count={eventResults.length} />
          <div className="space-y-3">
            {eventResults.map((item, index) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06 }}>
                <Link to="/events" className="block comic-panel comic-panel-hover bg-white p-4">
                  <h3 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{item.title}</h3>
                  <p className="text-xs font-sans text-zn-text-muted mt-1">{item.location} · {item.date}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {wantedResults.length > 0 && (
        <section className="mb-8">
          <SearchSectionHeader icon={Crosshair} title={searchCopy.sections.wanted} tone="red" count={wantedResults.length} />
          <div className="space-y-3">
            {wantedResults.map((item, index) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.06 }}>
                <div className="comic-panel comic-panel-hover bg-white p-4 border-l-4 border-l-red-700">
                  <h3 className="font-display font-black uppercase text-sm text-zn-text tracking-wider">{item.name}</h3>
                  <p className="text-xs font-sans text-zn-text-muted mt-1">{item.charge} · Награда: <span className="text-zn-gold font-display font-bold">{item.bounty}</span></p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
