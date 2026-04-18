import { memo, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Flame, Megaphone, Bell, Sun, Moon, Siren, Zap, Newspaper, ShieldAlert, AlertTriangle, CircleHelp, Gamepad2, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { useSettingsData, useTaxonomyData } from '../context/DataContext';
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
  Gamepad2,
  Tag,
};

export default memo(function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const navRef = useRef(null);
  const navRowRef = useRef(null);
  const [mobileMenuViewport, setMobileMenuViewport] = useState({ top: 0, maxHeight: 320 });
  const [desktopNavIndicator, setDesktopNavIndicator] = useState({ x: 0, width: 0, visible: false });
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleDark } = useTheme();
  const { siteSettings } = useSettingsData();
  const { categories } = useTaxonomyData();

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
    return spotlightLinksRaw
      .map((item) => ({
        ...item,
        Icon: SPOTLIGHT_ICON_MAP[item.icon] || Flame,
        isArcade: item?.to === '/games' || item?.icon === 'Gamepad2',
        isClassifieds: item?.to === '/obiavi' || item?.icon === 'Tag',
      }))
      .sort((a, b) => Number(a.isArcade) - Number(b.isArcade));
  }, [siteSettings?.spotlightLinks]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  }, [searchQuery, navigate]);

  const focusSearchInput = useEffectEvent((selectAll = false) => {
    if (!searchInputRef.current) return;
    try {
      searchInputRef.current.focus();
      if (selectAll && typeof searchInputRef.current.select === 'function') {
        searchInputRef.current.select();
      }
    } catch { }
  });

  const handleSearchShortcut = useEffectEvent((event) => {
    const key = (event?.key || '').toLowerCase();
    if (key !== 'k') return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

    event.preventDefault();
    setIsOpen(false);
    setSearchOpen(true);
    window.requestAnimationFrame(() => {
      focusSearchInput(true);
    });
  });

  // Ctrl/Cmd + K opens the search box (common modern shortcut).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onKeyDown = (event) => {
      handleSearchShortcut(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    if (typeof window === 'undefined') return;

    const frameId = window.requestAnimationFrame(() => {
      focusSearchInput(false);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [searchOpen]);

  const handleEscapeClose = useEffectEvent((event) => {
    if (event.key !== 'Escape') return;
    setSearchOpen(false);
    setIsOpen(false);
  });

  useEffect(() => {
    if ((!isOpen && !searchOpen) || typeof window === 'undefined') return undefined;

    const onKeyDown = (event) => {
      handleEscapeClose(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, searchOpen]);

  const syncMobileMenuViewport = useEffectEvent(() => {
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
  });

  const syncDesktopNavIndicator = useEffectEvent(() => {
    const row = navRowRef.current;
    if (!row) {
      setDesktopNavIndicator((current) => (
        current.visible ? { x: 0, width: 0, visible: false } : current
      ));
      return;
    }

    const activeLink = row.querySelector('[data-nav-active="true"]');
    if (!activeLink) {
      setDesktopNavIndicator((current) => (
        current.visible ? { x: 0, width: 0, visible: false } : current
      ));
      return;
    }

    const horizontalInset = 8;
    const nextWidth = Math.max(0, Math.round(activeLink.offsetWidth - (horizontalInset * 2)));
    const nextX = Math.max(0, Math.round(activeLink.offsetLeft - row.scrollLeft + horizontalInset));
    const visible = nextWidth > 0;

    setDesktopNavIndicator((current) => (
      current.x === nextX && current.width === nextWidth && current.visible === visible
        ? current
        : { x: nextX, width: nextWidth, visible }
    ));
  });

  useLayoutEffect(() => {
    syncDesktopNavIndicator();
  }, [location.pathname, navLinks, syncDesktopNavIndicator]);

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
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = 0;
    const row = navRowRef.current;
    const scheduleSync = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        syncDesktopNavIndicator();
      });
    };

    scheduleSync();
    window.addEventListener('resize', scheduleSync, { passive: true });
    row?.addEventListener('scroll', scheduleSync, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleSync);

    const fonts = document.fonts;
    let cancelled = false;
    fonts?.ready
      ?.then(() => {
        if (!cancelled) scheduleSync();
      })
      .catch(() => { });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleSync);
      row?.removeEventListener('scroll', scheduleSync);
      window.visualViewport?.removeEventListener('resize', scheduleSync);
    };
  }, [navLinks, syncDesktopNavIndicator]);

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
    <form id="site-search-panel" onSubmit={handleSearch} className="pt-2 pb-3" role="search">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zn-text-dim" />
        <input
          id="site-search"
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={navbarCopy.searchPlaceholder}
          aria-label="Търсене"
          className="w-full pl-10 pr-4 py-3 bg-zn-bg-warm border-2 border-zn-border text-zn-text placeholder-zn-text-dim font-display text-sm outline-none focus:border-zn-hot focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-zn-bg uppercase tracking-wide"
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
          prefetch="intent"
          onClick={() => setIsOpen(false)}
          className={`flex items-center gap-3 px-3 py-3 text-sm font-display font-bold uppercase tracking-wider transition-all border-b border-zn-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-inset ${location.pathname === link.to
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
        <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 pt-9 sm:pt-11 md:pt-12 pb-14 sm:pb-16 min-h-[270px] sm:h-[332px] md:h-[388px] text-center overflow-visible flex flex-col justify-end">
          {/* Top date line */}
          <div className="flex min-h-[34px] sm:h-[38px] flex-wrap items-center justify-between gap-y-2 mb-4 sm:mb-5 text-white/70 text-[9px] sm:text-[10px] font-display uppercase tracking-[0.12em] sm:tracking-[0.28em]">
            <span className="hidden sm:inline capitalize">{today}</span>
            <div className="comic-top-actions flex w-full sm:w-auto flex-nowrap items-center justify-end gap-1 sm:gap-2.5 pb-0.5 sm:pb-0 min-h-[29px] sm:h-[34px]">
              <Link
                to="/tipline"
                prefetch="intent"
                className={`comic-top-action comic-top-action-hot shrink-0 sm:min-w-[7rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#26123b] ${isTiplinePage ? 'comic-top-action-active' : ''}`}
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
                  aria-busy={pushStatus === 'loading'}
                  className={`comic-top-action shrink-0 sm:min-w-[6.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#26123b] ${pushStatus === 'subscribed' ? 'comic-top-action-active' : 'comic-top-action-alert'} ${pushStatus === 'loading' ? 'comic-top-action-disabled' : ''}`}
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
                aria-controls="site-search-panel"
                aria-expanded={searchOpen}
                aria-pressed={searchOpen}
                className={`comic-top-action shrink-0 sm:min-w-[5.9rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#26123b] ${searchOpen ? 'comic-top-action-active' : ''}`}
                aria-label={searchOpen ? 'Затвори търсенето' : 'Отвори търсенето'}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Търси</span>
              </button>
              <Link
                to="/about"
                prefetch="intent"
                className={`comic-top-action shrink-0 sm:min-w-[5.3rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#26123b] ${isAboutPage ? 'comic-top-action-active' : ''}`}
                aria-label="За нас"
                title="За нас"
              >
                <CircleHelp className="w-3.5 h-3.5 sm:hidden" />
                <span className="hidden sm:inline">За нас</span>
              </Link>
              <button
                onClick={toggleDark}
                aria-pressed={isDark}
                className="comic-top-action comic-top-action-icon shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#26123b]"
                aria-label={isDark ? 'Светъл режим' : 'Тъмен режим'}
                title={isDark ? 'Светъл режим' : 'Тъмен режим'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* COMIC LOGO — big tabloid name */}
          <Link to="/" prefetch="intent" className="inline-flex self-center min-h-[160px] sm:h-[210px] md:h-[252px] items-end group overflow-visible">
            <div className="relative inline-block overflow-visible px-2 sm:px-3 pr-8 sm:pr-10 transition-transform duration-300 group-hover:scale-[1.03]">
              {/* Background glow */}
              <div className="absolute -inset-6 bg-gradient-to-br from-yellow-400/15 via-transparent to-orange-400/15 blur-2xl transition-opacity duration-300 group-hover:from-yellow-400/25 group-hover:to-orange-400/25" />

              <div className="relative">
                {/* "EXCLUSIVE" stamp */}
                <div className="absolute -top-2 left-0 sm:-top-3 sm:-left-4 md:-left-8 transform -rotate-12 z-20">
                  <span className="comic-sticker">Exclusive</span>
                </div>

                <span className="relative z-20 block min-h-[3.6rem] sm:min-h-[5.15rem] md:min-h-[6.6rem] lg:min-h-[8rem] font-comic text-5xl sm:text-7xl md:text-8xl lg:text-[9.5rem] tracking-tight uppercase leading-none" style={{ letterSpacing: '-0.01em' }} role="img" aria-label="zNews">
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

              <p className="min-h-[0.875rem] sm:min-h-[1rem] md:min-h-[1.125rem] font-display text-[9px] sm:text-[10px] md:text-xs text-white/60 tracking-[0.28em] sm:tracking-[0.5em] uppercase mt-2 logo-subtitle-text">
                Горещи новини &bull; Скандали &bull; Слухове
              </p>
              <div className="mt-2 flex min-h-[1.75rem] flex-wrap items-center justify-center gap-2">
                <span className="comic-kicker">Los Santos Edition</span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* ── TABLOID CATEGORY PILLS — ROUNDED like the images ── */}
      <div className="relative border-t-4 border-b-4 border-black/20">
        <div className="bg-gradient-to-r from-zn-hot via-zn-purple to-zn-navy">
          <div className="max-w-6xl mx-auto px-3 md:px-4 py-2 relative">
            <div className="comic-spotlight-strip grid min-h-[5.15rem] grid-cols-2 items-stretch justify-start gap-2 md:flex md:min-h-[3.55rem] md:items-center md:justify-center md:gap-5 overflow-visible md:overflow-x-auto scrollbar-hide py-1">
              {spotlightLinks.map(({ to, label, Icon, hot, tilt, isArcade, isClassifieds }) => (
                <Link
                  key={to}
                  to={to}
                  prefetch="intent"
                  className={`comic-chip comic-spotlight-chip w-full md:w-auto whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-zn-hot ${isClassifieds ? 'comic-chip-classifieds' : isArcade ? 'comic-chip-arcade' : ''} ${hot && !isArcade && !isClassifieds ? 'comic-chip-hot' : ''}`}
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
            <div ref={navRowRef} className="hidden md:flex w-full min-w-0 items-center justify-start lg:justify-center gap-0 overflow-x-auto lg:overflow-visible scrollbar-hide comic-main-nav-row">
              {navLinks.map(link => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    prefetch="intent"
                    data-nav-active={isActive ? 'true' : undefined}
                    className={`comic-main-nav-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-inset ${isActive ? 'comic-main-nav-link-active' : ''}`}
                  >
                    {link.hot && <span className="comic-main-nav-hot-dot" aria-hidden="true" />}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
              <span
                aria-hidden="true"
                className="comic-main-nav-underline pointer-events-none"
                style={{
                  width: `${desktopNavIndicator.width}px`,
                  opacity: desktopNavIndicator.visible ? 1 : 0,
                  transform: `translateX(${desktopNavIndicator.x}px)`,
                }}
              />
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-3 text-zn-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zn-gold focus-visible:ring-offset-2 focus-visible:ring-offset-zn-paper"
              aria-label={isOpen ? 'Затвори менюто' : 'Отвори менюто'}
              aria-controls="mobile-navigation"
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            {/* Mobile logo */}
            <Link to="/" prefetch="intent" className="md:hidden font-comic text-3xl uppercase logo-mobile-text">
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
                  id="mobile-navigation"
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
})
