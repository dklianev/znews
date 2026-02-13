import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search as SearchIcon, FileText, Briefcase, Scale, CalendarDays, Crosshair } from 'lucide-react';
import { useData } from '../context/DataContext';
import React, { useState } from 'react';
import ComicNewsCard from '../components/ComicNewsCard';
import { getComicCardStyle } from '../utils/comicCardDesign';

export default function SearchPage() {
  const { articles, jobs, court, events, wanted, siteSettings } = useData();
  const layoutPresets = siteSettings?.layoutPresets || {};
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [localQuery, setLocalQuery] = useState(query);

  // Sync input when URL query changes (e.g. from Navbar search)
  React.useEffect(() => { setLocalQuery(query); }, [query]);

  const q = query.toLowerCase();

  const articleResults = !q ? [] : articles.filter(article =>
    article.title.toLowerCase().includes(q) ||
    article.excerpt.toLowerCase().includes(q) ||
    (article.tags && article.tags.some(t => t.toLowerCase().includes(q))) ||
    String(article.content || '').toLowerCase().includes(q)
  );

  const jobResults = !q ? [] : jobs.filter(j =>
    j.title?.toLowerCase().includes(q) ||
    j.org?.toLowerCase().includes(q) ||
    j.description?.toLowerCase().includes(q)
  );

  const courtResults = !q ? [] : court.filter(c =>
    c.title?.toLowerCase().includes(q) ||
    c.details?.toLowerCase().includes(q) ||
    c.defendant?.toLowerCase().includes(q) ||
    c.charge?.toLowerCase().includes(q)
  );

  const eventResults = !q ? [] : events.filter(e =>
    e.title?.toLowerCase().includes(q) ||
    e.description?.toLowerCase().includes(q) ||
    e.location?.toLowerCase().includes(q)
  );

  const wantedResults = !q ? [] : wanted.filter(w =>
    w.name?.toLowerCase().includes(q) ||
    w.charge?.toLowerCase().includes(q)
  );

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
            className="w-full pl-12 pr-4 py-3.5 bg-transparent text-zn-text placeholder-zn-text-dim font-display text-sm uppercase tracking-wider outline-none relative z-[2]"
            aria-label="Търсене"
          />
        </div>
      </form>

      {query && (
        <p className="mb-6 font-display font-bold text-sm text-zn-text-muted uppercase tracking-wider">
          {totalResults} резултата за &ldquo;<span className="text-zn-hot">{query}</span>&rdquo;
        </p>
      )}

      {query && totalResults === 0 && (
        <div className="newspaper-page comic-panel comic-dots p-10 text-center relative">
          <div className="comic-stamp-circle absolute -top-5 -right-3 z-20 animate-wiggle text-[10px]">ПРАЗНО!</div>
          <p className="font-display font-black text-base text-zn-text mb-2 uppercase tracking-wider relative z-[2]">Няма намерени резултати.</p>
          <p className="text-sm font-sans text-zn-text-muted relative z-[2]">Опитай с различни ключови думи.</p>
        </div>
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
