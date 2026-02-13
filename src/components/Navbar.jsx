import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Flame, Megaphone, Bell, Sun, Moon, Siren, Zap, Newspaper, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';

const DEFAULT_NAV_LINKS = [
  { to: '/', label: 'Начало' },
  { to: '/category/crime', label: 'Криминални', hot: true },
  { to: '/category/underground', label: 'Подземен свят', hot: true },
  { to: '/category/emergency', label: 'Полиция' },
  { to: '/category/reportage', label: 'Репортажи' },
  { to: '/category/politics', label: 'Политика' },
  { to: '/category/business', label: 'Бизнес' },
  { to: '/category/society', label: 'Общество' },
  { to: '/jobs', label: 'Работа' },
  { to: '/court', label: 'Съд' },
  { to: '/events', label: 'Събития' },
  { to: '/gallery', label: 'Галерия' },
];

const DEFAULT_SPOTLIGHT_LINKS = [
  { to: '/category/crime', label: 'Горещо', icon: 'Flame', hot: true, tilt: '-2deg' },
  { to: '/category/underground', label: 'Скандали', icon: 'Megaphone', hot: true, tilt: '1.5deg' },
  { to: '/category/society', label: 'Слухове', icon: 'Bell', hot: false, tilt: '-1deg' },
];

const SPOTLIGHT_ICON_MAP = {
  Flame,
  Megaphone,
  Bell,
  Siren,
  Zap,
  Newspaper,
  ShieldAlert,
};

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleDark } = useTheme();
  const { siteSettings } = useData();

  const navLinksRaw = Array.isArray(siteSettings?.navbarLinks) && siteSettings.navbarLinks.length > 0
    ? siteSettings.navbarLinks
    : DEFAULT_NAV_LINKS;
  const navLinks = navLinksRaw.filter((item) => item?.to !== '/category/sports');

  const spotlightLinksRaw = Array.isArray(siteSettings?.spotlightLinks) && siteSettings.spotlightLinks.length > 0
    ? siteSettings.spotlightLinks
    : DEFAULT_SPOTLIGHT_LINKS;
  const spotlightLinks = spotlightLinksRaw.map((item) => ({
    ...item,
    Icon: SPOTLIGHT_ICON_MAP[item.icon] || Flame,
  }));

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const today = new Date().toLocaleDateString('bg-BG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <header className="relative z-50 select-none">
      {/* ── GTA SUNSET SKYLINE BANNER ── */}
      <div className="sunset-banner relative overflow-hidden">
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-yellow-300/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 pt-9 sm:pt-11 md:pt-12 pb-14 sm:pb-16 text-center overflow-visible">
          {/* Top date line */}
          <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4 sm:mb-5 text-white/55 text-[9px] sm:text-[10px] font-display uppercase tracking-[0.22em] sm:tracking-[0.35em]">
            <span className="capitalize">{today}</span>
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Търси</span>
              </button>
              <button
                onClick={toggleDark}
                className="hover:text-white transition-colors flex items-center gap-1.5"
                aria-label={isDark ? 'Светъл режим' : 'Тъмен режим'}
                title={isDark ? 'Светъл режим' : 'Тъмен режим'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <Link to="/about" className="hover:text-white transition-colors">За нас</Link>
            </div>
          </div>

          {/* COMIC LOGO — big tabloid name */}
          <Link to="/" className="inline-block group overflow-visible">
            <div className="relative inline-block overflow-visible px-2 sm:px-3 pr-8 sm:pr-10">
              {/* Background glow */}
              <div className="absolute -inset-6 bg-gradient-to-br from-yellow-400/15 via-transparent to-orange-400/15 blur-2xl" />

              <div className="relative">
                {/* "EXCLUSIVE" stamp */}
                <div className="absolute -top-2 left-0 sm:-top-3 sm:-left-4 md:-left-8 transform -rotate-12 z-20">
                  <span className="comic-sticker">Exclusive</span>
                </div>

                <h1 className="relative z-20 font-comic text-5xl sm:text-7xl md:text-8xl lg:text-[9.5rem] tracking-tight uppercase leading-none" style={{ letterSpacing: '-0.01em' }}>
                  <span className="text-white" style={{ WebkitTextStroke: '2px rgba(0,0,0,0.3)', textShadow: '4px 4px 0 rgba(0,0,0,0.4)' }}>z</span>
                  <span
                    className="inline-block pr-[0.14em] text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-400 to-orange-500"
                    style={{ WebkitTextStroke: '2px rgba(0,0,0,0.15)', filter: 'drop-shadow(4px 4px 0 rgba(0,0,0,0.35))' }}
                  >
                    News
                  </span>
                </h1>

                {/* Megaphone badge */}
                <div className="absolute -top-1 right-0 sm:-right-2 md:-right-3 transform rotate-12 z-10">
                  <div className="bg-yellow-400 p-1.5 md:p-2 border-2 border-black/20" style={{ boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', borderRadius: '50%' }}>
                    <Megaphone className="w-5 h-5 md:w-7 md:h-7 text-zn-purple-deep" />
                  </div>
                </div>
              </div>

              <p className="font-display text-[9px] sm:text-[10px] md:text-xs text-white/60 tracking-[0.28em] sm:tracking-[0.5em] uppercase mt-2" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.6)' }}>
                Горещи новини &bull; Скандали &bull; Слухове
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="comic-kicker">Los Santos Edition</span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ── TABLOID CATEGORY PILLS — ROUNDED like the images ── */}
      <div className="relative border-t-4 border-b-4 border-black/20">
        <div className="bg-gradient-to-r from-zn-hot via-zn-purple to-zn-navy">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-3 md:gap-5 overflow-x-auto scrollbar-hide">
            {spotlightLinks.map(({ to, label, Icon, hot, tilt }) => (
              <Link
                key={to}
                to={to}
                className={`comic-chip whitespace-nowrap ${hot ? 'comic-chip-hot' : ''}`}
                style={{ '--chip-tilt': tilt }}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN NAV BAR ── */}
      <nav className="comic-strip-nav border-b-4 border-zn-black sticky top-0 z-50" style={{ boxShadow: '0 4px 0 rgba(204,10,26,0.3)' }}>
        <div className="max-w-[1400px] mx-auto px-2 sm:px-3 lg:px-4">
          <div className="flex items-center justify-between">
            <div className="hidden md:flex w-full min-w-0 items-center justify-start lg:justify-center gap-0 overflow-x-auto lg:overflow-visible scrollbar-hide comic-main-nav-row">
              {navLinks.map(link => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`comic-main-nav-link ${isActive ? 'comic-main-nav-link-active' : ''}`}
                  >
                    {link.hot && <span className="comic-main-nav-hot-dot" aria-hidden="true" />}
                    <span>{link.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="navIndicator"
                        className="comic-main-nav-underline"
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Mobile toggle */}
            <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-3 text-zn-text" aria-label={isOpen ? 'Затвори менюто' : 'Отвори менюто'}>
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            {/* Mobile logo */}
            <Link to="/" className="md:hidden font-comic text-3xl uppercase" style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.1)' }}>
              <span className="text-zn-black">z</span>
              <span className="text-zn-hot">News</span>
            </Link>
            <div className="w-10 md:hidden" />
          </div>

          {/* Search bar */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <form onSubmit={handleSearch} className="pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-dim" />
                    <input
                      type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Търси горещи новини, скандали..." autoFocus
                      className="w-full pl-10 pr-4 py-3 bg-zn-bg-warm border-2 border-zn-border text-zn-text placeholder-zn-text-dim font-display text-sm outline-none focus:border-zn-hot uppercase tracking-wide"
                    />
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile nav */}
          <AnimatePresence>
            {isOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden overflow-hidden">
                <div className="pb-3 space-y-0.5">
                  {navLinks.map(link => (
                    <Link
                      key={link.to} to={link.to} onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 text-sm font-display font-bold uppercase tracking-wider transition-all border-b border-zn-border/30 ${
                        location.pathname === link.to
                          ? 'text-zn-hot bg-zn-hot/5'
                          : 'text-zn-text hover:text-zn-hot hover:bg-zn-bg-warm'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  );
}
