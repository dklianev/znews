import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Flame, Megaphone, Bell, Sun, Moon, Siren, Zap, Newspaper, ShieldAlert, AlertTriangle, CircleHelp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { usePublicData } from '../context/DataContext';
import { navbarCopy } from '../content/uiCopy';

const DEFAULT_NAV_LINKS = navbarCopy.defaultNavLinks;

const DEFAULT_SPOTLIGHT_LINKS = navbarCopy.defaultSpotlightLinks;

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
  const searchInputRef = useRef(null);
  const navRef = useRef(null);
  const [mobileMenuViewport, setMobileMenuViewport] = useState({ top: 0, maxHeight: 320 });
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleDark } = useTheme();
  const { siteSettings, categories } = usePublicData();

  const [pushStatus, setPushStatus] = useState('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
    } else {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setPushStatus('subscribed');
        }).catch(() => { });
      }).catch(() => { });
    }
  }, []);

  const handleSubscribePush = async () => {
    if (pushStatus === 'subscribed' || pushStatus === 'loading') return;
    try {
      setPushStatus('loading');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('idle');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch('/api/push/vapid-public-key');
      const vapidPublicKey = await res.text();

      function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      setPushStatus('subscribed');
    } catch (e) {
      console.error('Push subscription failed:', e);
      setPushStatus('idle');
    }
  };

  const navLinks = useMemo(() => {
    const navLinksRaw = Array.isArray(siteSettings?.navbarLinks) && siteSettings.navbarLinks.length > 0
      ? siteSettings.navbarLinks
      : DEFAULT_NAV_LINKS;
    const navLinksBase = navLinksRaw.filter((item) => item?.to !== '/category/sports');
    const hasBreakingCategory = Array.isArray(categories) && categories.some((item) => item?.id === 'breaking');
    const hasBreakingLink = navLinksBase.some((item) => item?.to === '/category/breaking');
    if (!hasBreakingCategory || hasBreakingLink) return navLinksBase;
    const breakingLink = { to: '/category/breaking', label: 'Горещо', hot: true };
    const emergencyIndex = navLinksBase.findIndex((item) => item?.to === '/category/emergency');
    if (emergencyIndex === -1) return [...navLinksBase, breakingLink];
    return [
      ...navLinksBase.slice(0, emergencyIndex + 1),
      breakingLink,
      ...navLinksBase.slice(emergencyIndex + 1),
    ];
  }, [siteSettings?.navbarLinks, categories]);

  const spotlightLinks = useMemo(() => {
    const spotlightLinksRaw = Array.isArray(siteSettings?.spotlightLinks) && siteSettings.spotlightLinks.length > 0
      ? siteSettings.spotlightLinks
      : DEFAULT_SPOTLIGHT_LINKS;
    return spotlightLinksRaw.map((item) => ({
      ...item,
      Icon: SPOTLIGHT_ICON_MAP[item.icon] || Flame,
    }));
  }, [siteSettings?.spotlightLinks]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  // Ctrl/Cmd + K opens the search box (common modern shortcut).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onKeyDown = (event) => {
      const key = (event?.key || '').toLowerCase();
      if (key !== 'k') return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

      event.preventDefault();
      setIsOpen(false);
      setSearchOpen(true);

      // Focus once the collapsible is rendered.
      window.requestAnimationFrame(() => {
        if (!searchInputRef.current) return;
        try {
          searchInputRef.current.focus();
          if (typeof searchInputRef.current.select === 'function') searchInputRef.current.select();
        } catch { }
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      if (!searchInputRef.current) return;
      try {
        searchInputRef.current.focus();
      } catch { }
    });
  }, [searchOpen]);

  const syncMobileMenuViewport = useCallback(() => {
    if (typeof window === 'undefined' || !navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const top = Math.max(0, Math.round(rect.bottom + 6));
    const maxHeight = Math.max(220, Math.floor(viewportHeight - top - 8));
    setMobileMenuViewport((current) => (
      current.top === top && current.maxHeight === maxHeight
        ? current
        : { top, maxHeight }
    ));
  }, []);

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;

    syncMobileMenuViewport();

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', syncMobileMenuViewport);
    window.addEventListener('scroll', syncMobileMenuViewport, { passive: true });
    visualViewport?.addEventListener('resize', syncMobileMenuViewport);
    visualViewport?.addEventListener('scroll', syncMobileMenuViewport);

    return () => {
      window.removeEventListener('resize', syncMobileMenuViewport);
      window.removeEventListener('scroll', syncMobileMenuViewport);
      visualViewport?.removeEventListener('resize', syncMobileMenuViewport);
      visualViewport?.removeEventListener('scroll', syncMobileMenuViewport);
    };
  }, [isOpen, searchOpen, syncMobileMenuViewport]);

  const today = new Date().toLocaleDateString('bg-BG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const isAboutPage = location.pathname === '/about';
  const isTiplinePage = location.pathname === '/tipline';

  const collapsibleMotionProps = {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.22, ease: 'easeOut' },
  };

  // Mobile drawer uses transform/opacity instead of height animation for smoother low-end phone performance.
  const mobileNavMotionProps = {
    initial: { opacity: 0, y: -10, scaleY: 0.98 },
    animate: { opacity: 1, y: 0, scaleY: 1 },
    exit: { opacity: 0, y: -8, scaleY: 0.985 },
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  };

  const searchForm = (
    <form onSubmit={handleSearch} className="pt-2 pb-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-dim" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={navbarCopy.searchPlaceholder}
          aria-label="Търсене"
          className="w-full pl-10 pr-4 py-3 bg-zn-bg-warm border-2 border-zn-border text-zn-text placeholder-zn-text-dim font-display text-sm outline-none focus:border-zn-hot uppercase tracking-wide"
        />
      </div>
    </form>
  );

  const mobileNavStyle = {
    top: `${mobileMenuViewport.top}px`,
    willChange: 'transform, opacity',
  };

  const mobileNavInnerStyle = {
    maxHeight: `${mobileMenuViewport.maxHeight}px`,
    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
    WebkitOverflowScrolling: 'touch',
  };

  const mobileNav = (
    <div className="pb-3 space-y-0.5">
      {navLinks.map(link => (
        <Link
          key={link.to}
          to={link.to}
          onClick={() => setIsOpen(false)}
          className={`flex items-center gap-3 px-3 py-3 text-sm font-display font-bold uppercase tracking-wider transition-all border-b border-zn-border/30 ${location.pathname === link.to
            ? 'text-zn-hot bg-zn-hot/5'
            : 'text-zn-text hover:text-zn-hot hover:bg-zn-bg-warm'
            }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );

  return (
    <header className="relative z-50 select-none">
      {/* ── GTA SUNSET SKYLINE BANNER ── */}
      <div className="sunset-banner relative overflow-hidden">
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-yellow-300/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 pt-9 sm:pt-11 md:pt-12 pb-14 sm:pb-16 text-center overflow-visible">
          {/* Top date line */}
          <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4 sm:mb-5 text-white/70 text-[9px] sm:text-[10px] font-display uppercase tracking-[0.12em] sm:tracking-[0.28em]">
            <span className="hidden sm:inline capitalize">{today}</span>
            <div className="comic-top-actions flex w-full sm:w-auto flex-nowrap items-center justify-end gap-1 sm:gap-2.5 pb-0.5 sm:pb-0">
              <Link
                to="/tipline"
                className={`comic-top-action comic-top-action-hot shrink-0 ${isTiplinePage ? 'comic-top-action-active' : ''}`}
                title="Гореща линия за сигнали"
                aria-label="Подай сигнал"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Подай Сигнал</span>
              </Link>
              {pushStatus !== 'unsupported' && (
                <button
                  onClick={handleSubscribePush}
                  disabled={pushStatus === 'loading' || pushStatus === 'subscribed'}
                  className={`comic-top-action shrink-0 ${pushStatus === 'subscribed' ? 'comic-top-action-active' : 'comic-top-action-alert'} ${pushStatus === 'loading' ? 'comic-top-action-disabled' : ''}`}
                  title="Известия за Извънредни Новини"
                  aria-label={pushStatus === 'subscribed' ? 'Известия активни' : 'Известия'}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {pushStatus === 'subscribed' ? 'Абониран' : 'Известия'}
                  </span>
                </button>
              )}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className={`comic-top-action shrink-0 ${searchOpen ? 'comic-top-action-active' : ''}`}
                aria-label={searchOpen ? 'Затвори търсенето' : 'Отвори търсенето'}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Търси</span>
              </button>
              <Link
                to="/about"
                className={`comic-top-action shrink-0 ${isAboutPage ? 'comic-top-action-active' : ''}`}
                aria-label="За нас"
                title="За нас"
              >
                <CircleHelp className="w-3.5 h-3.5 sm:hidden" />
                <span className="hidden sm:inline">За нас</span>
              </Link>
              <button
                onClick={toggleDark}
                className="comic-top-action comic-top-action-icon shrink-0"
                aria-label={isDark ? 'Светъл режим' : 'Тъмен режим'}
                title={isDark ? 'Светъл режим' : 'Тъмен режим'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* COMIC LOGO — big tabloid name */}
          <Link to="/" className="inline-block group overflow-visible">
            <div className="relative inline-block overflow-visible px-2 sm:px-3 pr-8 sm:pr-10 transition-transform duration-300 group-hover:scale-[1.03]">
              {/* Background glow */}
              <div className="absolute -inset-6 bg-gradient-to-br from-yellow-400/15 via-transparent to-orange-400/15 blur-2xl transition-opacity duration-300 group-hover:from-yellow-400/25 group-hover:to-orange-400/25" />

              <div className="relative">
                {/* "EXCLUSIVE" stamp */}
                <div className="absolute -top-2 left-0 sm:-top-3 sm:-left-4 md:-left-8 transform -rotate-12 z-20">
                  <span className="comic-sticker">Exclusive</span>
                </div>

                <span className="relative z-20 font-comic text-5xl sm:text-7xl md:text-8xl lg:text-[9.5rem] tracking-tight uppercase leading-none block" style={{ letterSpacing: '-0.01em' }} role="img" aria-label="zNews">
                  <span className="text-white logo-z-letter">z</span>
                  <span
                    className="inline-block pr-[0.14em] text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-400 to-orange-500 logo-news-letters"
                  >
                    News
                  </span>
                </span>

                {/* Megaphone badge */}
                <div className="absolute -top-1 right-0 sm:-right-2 md:-right-3 transform rotate-12 z-10">
                  <div className="logo-megaphone-badge bg-yellow-400 p-1.5 md:p-2 border-2 border-black/20 rounded-full">
                    <Megaphone className="w-5 h-5 md:w-7 md:h-7 text-zn-purple-deep" />
                  </div>
                </div>
              </div>

              <p className="font-display text-[9px] sm:text-[10px] md:text-xs text-white/60 tracking-[0.28em] sm:tracking-[0.5em] uppercase mt-2 logo-subtitle-text">
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
          <div className="max-w-6xl mx-auto px-4 py-2 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-zn-hot to-transparent md:hidden" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-zn-navy to-transparent md:hidden" />
            <div className="flex items-center justify-center gap-3 md:gap-5 overflow-x-auto scrollbar-hide py-1">
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
      </div>

      {/* ── MAIN NAV BAR ── */}
      <nav ref={navRef} className="comic-strip-nav border-b-4 border-zn-black sticky top-0 z-50" style={{ boxShadow: '0 4px 0 rgba(204,10,26,0.3)' }}>
        <div className="relative max-w-[1400px] mx-auto px-2 sm:px-3 lg:px-4">
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
                      <motion.span layoutId="navIndicator" className="comic-main-nav-underline" transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
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
            <Link to="/" className="md:hidden font-comic text-3xl uppercase logo-mobile-text">
              <span className="text-zn-black">z</span>
              <span className="text-zn-hot">News</span>
            </Link>
            <div className="w-10 md:hidden" />
          </div>

          {/* Search bar */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div {...collapsibleMotionProps} className="overflow-hidden">
                {searchForm}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile nav */}
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                {...mobileNavMotionProps}
                className="md:hidden fixed inset-x-0 z-[70] origin-top px-2 sm:px-3 lg:px-4"
                style={mobileNavStyle}
              >
                <div
                  className="mx-auto max-w-[1400px] border-2 border-[#1C1428]/75 bg-[#F5EEDF] dark:bg-[#2A2438] dark:border-[#524A62]/75 shadow-[0_12px_24px_rgba(28,20,40,0.3)] dark:shadow-[0_12px_24px_rgba(0,0,0,0.5)] overflow-y-auto overscroll-contain"
                  style={mobileNavInnerStyle}
                >
                  {mobileNav}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  );
}
