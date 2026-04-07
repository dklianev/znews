import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider, useAdminData, usePublicData, useSessionData } from './context/DataContext';
import { AnimatePresence, motion } from 'motion/react';
import Navbar from './components/Navbar';
import BreakingTicker from './components/BreakingTicker';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { appCopy } from './content/uiCopy';
import { isChunkLoadError, shouldReloadForChunkError } from './utils/chunkReload';
import useEasterEggHunt from './hooks/useEasterEggHunt';
import EasterHuntBadge from './components/seasonal/EasterHuntBadge';
import { shouldRenderDecorations } from './utils/seasonalCampaigns';
import { reportChunkLoadIssue } from './utils/clientMonitoring';
import { showChunkReloadToast } from './utils/systemToasts';

// ─── Chunk-resilient lazy loader ───
// After a deploy, old chunk hashes no longer exist on the server.
// The SPA fallback returns index.html (text/html) instead of JS,
// causing "Failed to load module script" errors.
// This wrapper detects the failure and reloads the page once to
// pick up the new HTML with correct chunk references.
function lazyRetry(importFn) {
  return lazy(() =>
    importFn().catch((error) => {
      if (isChunkLoadError(error) && shouldReloadForChunkError()) {
        reportChunkLoadIssue(error, {
          component: 'App.lazyRetry',
          phase: 'lazy-import',
          autoReload: true,
        }).catch(() => {});
        showChunkReloadToast(() => window.location.reload());
        return new Promise(() => {});
      }
      throw error;
    })
  );
}

// ─── Lazy-loaded pages (code-split) ───
const HomePage = lazyRetry(() => import('./pages/HomePage'));
const ArticlePage = lazyRetry(() => import('./pages/ArticlePage'));
const CategoryPage = lazyRetry(() => import('./pages/CategoryPage'));
const AuthorPage = lazyRetry(() => import('./pages/AuthorPage'));
const SearchPage = lazyRetry(() => import('./pages/SearchPage'));
const LatestPage = lazyRetry(() => import('./pages/LatestPage'));
const AboutPage = lazyRetry(() => import('./pages/AboutPage'));
const JobsPage = lazyRetry(() => import('./pages/JobsPage'));
const GalleryPage = lazyRetry(() => import('./pages/GalleryPage'));
const CourtPage = lazyRetry(() => import('./pages/CourtPage'));
const EventsPage = lazyRetry(() => import('./pages/EventsPage'));
const NotFoundPage = lazyRetry(() => import('./pages/NotFoundPage'));
const TipLine = lazyRetry(() => import('./pages/TipLine'));
const Footer = lazyRetry(() => import('./components/Footer'));
const ClassifiedsPage = lazyRetry(() => import('./pages/ClassifiedsPage'));
const ClassifiedSubmitPage = lazyRetry(() => import('./pages/ClassifiedSubmitPage'));
const ClassifiedDetailPage = lazyRetry(() => import('./pages/ClassifiedDetailPage'));
const ClassifiedStatusPage = lazyRetry(() => import('./pages/ClassifiedStatusPage'));
const GamesPage = lazyRetry(() => import('./pages/GamesPage'));
const GameWordPage = lazyRetry(() => import('./pages/GameWordPage'));
const GameConnectionsPage = lazyRetry(() => import('./pages/GameConnectionsPage'));
const GameHangmanPage = lazyRetry(() => import('./pages/GameHangmanPage'));
const GameQuizPage = lazyRetry(() => import('./pages/GameQuizPage'));
const GameCrosswordPage = lazyRetry(() => import('./pages/GameCrosswordPage'));
const GameSpellingBeePage = lazyRetry(() => import('./pages/GameSpellingBeePage'));
const GameSudokuPage = lazyRetry(() => import('./pages/GameSudokuPage'));
const GameTetrisPage = lazyRetry(() => import('./pages/GameTetrisPage'));
const GameSnakePage = lazyRetry(() => import('./pages/GameSnakePage'));
const Game2048Page = lazyRetry(() => import('./pages/Game2048Page'));
const GameFlappyBirdPage = lazyRetry(() => import('./pages/GameFlappyBirdPage'));
const GameBlockBustPage = lazyRetry(() => import('./pages/GameBlockBustPage'));

// Admin (lazy — heavy, rarely visited)
const AdminLogin = lazyRetry(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazyRetry(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazyRetry(() => import('./pages/admin/Dashboard'));
const ManageProfiles = lazyRetry(() => import('./pages/admin/ManageProfiles'));
const ManageArticles = lazyRetry(() => import('./pages/admin/ManageArticles'));
const EditorialQueue = lazyRetry(() => import('./pages/admin/EditorialQueue'));
const ManageMedia = lazyRetry(() => import('./pages/admin/ManageMedia'));
const ManageAds = lazyRetry(() => import('./pages/admin/ManageAds'));
const ManageBreaking = lazyRetry(() => import('./pages/admin/ManageBreaking'));
const ManageHero = lazyRetry(() => import('./pages/admin/ManageHero'));
const ManageCategories = lazyRetry(() => import('./pages/admin/ManageCategories'));
const ManageMostWanted = lazyRetry(() => import('./pages/admin/ManageMostWanted'));
const ManageJobs = lazyRetry(() => import('./pages/admin/ManageJobs'));
const ManageCourt = lazyRetry(() => import('./pages/admin/ManageCourt'));
const ManageEvents = lazyRetry(() => import('./pages/admin/ManageEvents'));
const ManagePolls = lazyRetry(() => import('./pages/admin/ManagePolls'));
const ManageComments = lazyRetry(() => import('./pages/admin/ManageComments'));
const ManageGallery = lazyRetry(() => import('./pages/admin/ManageGallery'));
const ManagePermissions = lazyRetry(() => import('./pages/admin/ManagePermissions'));
const ManageAuditLog = lazyRetry(() => import('./pages/admin/ManageAuditLog'));
const ManageSiteSettings = lazyRetry(() => import('./pages/admin/ManageSiteSettings'));
const AdminDiagnostics = lazyRetry(() => import('./pages/admin/AdminDiagnostics'));
const ManageContactMessages = lazyRetry(() => import('./pages/admin/ManageContactMessages'));
const ManageTips = lazyRetry(() => import('./pages/admin/ManageTips'));
const ManageGames = lazyRetry(() => import('./pages/admin/ManageGames'));
const ManageGamePuzzles = lazyRetry(() => import('./pages/admin/ManageGamePuzzles'));
const ManageClassifieds = lazyRetry(() => import('./pages/admin/ManageClassifieds'));

// ─── Inline loading fallback ───
function PageFallback() {
  return (
    <div className="fixed inset-0 z-50 bg-zn-paper paper-lines flex items-center justify-center" aria-live="polite" aria-busy="true">
      <div className="text-center">
        <span className="font-comic text-5xl tracking-tight uppercase leading-none" style={{ letterSpacing: '-0.01em' }}>
          <span className="text-white logo-z-letter">z</span>
          <span className="inline-block pr-[0.14em] text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-400 to-orange-500 logo-news-letters">
            News
          </span>
        </span>
        <div className="w-9 h-9 border-3 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto mt-5 mb-3" />
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-zn-text/40">
          {appCopy.loadingMessage}
        </p>
      </div>
    </div>
  );
}

function PublicPageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-pulse" aria-label={appCopy.publicFallbackAria}>
      <div className="mx-auto mb-6 h-10 w-72 bg-zn-text/10 rounded" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="comic-panel comic-dots bg-white p-4">
            <div className="h-56 md:h-72 w-full bg-zn-text/10 rounded mb-4" />
            <div className="h-6 w-11/12 bg-zn-text/10 rounded mb-2" />
            <div className="h-4 w-8/12 bg-zn-text/10 rounded" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="comic-panel comic-dots bg-white p-4">
                <div className="h-36 w-full bg-zn-text/10 rounded mb-3" />
                <div className="h-5 w-10/12 bg-zn-text/10 rounded mb-2" />
                <div className="h-3 w-full bg-zn-text/10 rounded mb-1" />
                <div className="h-3 w-9/12 bg-zn-text/10 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="newspaper-page comic-panel comic-dots p-5 relative">
            <div className="h-4 w-40 bg-zn-text/10 rounded mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-zn-text/10 rounded" />
              <div className="h-3 w-11/12 bg-zn-text/10 rounded" />
              <div className="h-3 w-8/12 bg-zn-text/10 rounded" />
            </div>
          </div>

          <div className="newspaper-page comic-panel comic-dots p-5 relative">
            <div className="h-4 w-32 bg-zn-text/10 rounded mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-zn-text/10 rounded" />
              <div className="h-3 w-10/12 bg-zn-text/10 rounded" />
              <div className="h-3 w-9/12 bg-zn-text/10 rounded" />
              <div className="h-3 w-7/12 bg-zn-text/10 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicRouteErrorState({ onRetry }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="newspaper-page comic-panel comic-dots p-6 sm:p-8 text-center relative">
        <p className="text-xs sm:text-sm font-display uppercase tracking-[0.3em] text-zn-hot mb-3">{appCopy.routeErrorEyebrow}</p>
        <h1 className="font-display text-3xl sm:text-4xl uppercase text-zn-text mb-4">{appCopy.routeErrorTitle}</h1>
        <p className="text-zn-text/80 text-base sm:text-lg max-w-xl mx-auto mb-6">{appCopy.routeErrorBody}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center px-6 py-3 border-3 border-[#1C1428] bg-zn-hot text-white font-display uppercase tracking-[0.2em] shadow-comic transition-transform hover:-translate-y-0.5"
        >
          {appCopy.routeErrorRetry}
        </button>
      </div>
    </div>
  );
}

function AdminPermissionRoute({ permission, children }) {
  const { session } = useSessionData();
  const { hasPermission } = useAdminData();
  if (!session) return <Navigate to="/admin/login" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/admin" replace />;
  return children;
}
function isFramedWindow() {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function AdminFrameGuard({ children }) {
  if (isFramedWindow()) return <Navigate to="/" replace />;
  return children;
}
function PublicGameRoute({ slug, children }) {
  const { session } = useSessionData();
  const { hasPermission } = useAdminData();
  const { games, publicSectionStatus, loadGamesCatalog } = usePublicData();
  const canManageGames = Boolean(session) && hasPermission('games');
  const [retryNonce, setRetryNonce] = useState(0);
  const [routeState, setRouteState] = useState({
    loading: !canManageGames,
    isAvailable: canManageGames,
    hasError: false,
  });

  useEffect(() => {
    if (canManageGames) {
      setRouteState({ loading: false, isAvailable: true, hasError: false });
      return undefined;
    }

    const isLoaded = publicSectionStatus.games === 'loaded';
    const isLoading = publicSectionStatus.games === 'loading';
    const hasError = publicSectionStatus.games === 'error';

    if (isLoaded) {
      const activeGames = Array.isArray(games) ? games : [];
      const isAvailable = activeGames.some((game) => String(game?.slug || '').toLowerCase() === slug);
      setRouteState({ loading: false, isAvailable, hasError: false });
      return undefined;
    }

    if (hasError) {
      setRouteState({ loading: false, isAvailable: false, hasError: true });
      return undefined;
    }

    setRouteState({ loading: true, isAvailable: false, hasError: false });
    const shouldLoadCatalog = publicSectionStatus.games === 'idle'
      || (retryNonce > 0 && publicSectionStatus.games !== 'loading');

    if (shouldLoadCatalog) {
      loadGamesCatalog({ force: retryNonce > 0 }).catch((error) => {
        console.error('Failed to load active games for route guard:', error);
      });
    }

    if (isLoading) return undefined;
    return undefined;
  }, [canManageGames, games, loadGamesCatalog, publicSectionStatus.games, retryNonce, slug]);

  if (routeState.loading) return <PublicPageFallback />;
  if (routeState.hasError) return <PublicRouteErrorState onRetry={() => setRetryNonce((value) => value + 1)} />;
  if (!routeState.isAvailable) return <NotFoundPage />;
  return children;
}
function PublicLayout() {
  const location = useLocation();
  const { siteSettings } = usePublicData();
  const easterHunt = useEasterEggHunt(siteSettings);
  const easterDecorationsActive = useMemo(
    () => shouldRenderDecorations(siteSettings),
    [siteSettings],
  );

  useEffect(() => {
    if (easterDecorationsActive) {
      document.body.classList.add('easter-active');
    } else {
      document.body.classList.remove('easter-active');
    }
    return () => document.body.classList.remove('easter-active');
  }, [easterDecorationsActive]);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-zn-purple focus:text-white focus:font-display focus:font-bold focus:text-sm focus:uppercase focus:tracking-wider" style={{ boxShadow: '3px 3px 0 #1C1428' }}>
        Към съдържанието
      </a>
      <Navbar />
      <BreakingTicker />
      <main id="main-content" className="flex-1 comic-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Suspense fallback={<PublicPageFallback />}>
              <Outlet context={{ easterHunt }} />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      {easterHunt.huntActive && (
        <EasterHuntBadge
          collected={easterHunt.collected}
          total={easterHunt.total}
          isComplete={easterHunt.isComplete}
          rewardText={easterHunt.rewardText}
          showProgress={easterHunt.showProgress}
          badgeDismissed={easterHunt.badgeDismissed}
          onDismiss={easterHunt.dismissBadge}
        />
      )}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-zn-bg comic-stage flex items-center justify-center" aria-live="polite" aria-busy="true">
      <div className="text-center">
        <span className="font-comic text-6xl tracking-tight uppercase leading-none" style={{ letterSpacing: '-0.01em' }}>
          <span className="text-white logo-z-letter">z</span>
          <span className="inline-block pr-[0.14em] text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-400 to-orange-500 logo-news-letters">
            News
          </span>
        </span>
        <div className="w-10 h-10 border-3 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto mt-6 mb-4" />
        <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zn-text/40">
          {appCopy.loadingMessage}
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { loading } = usePublicData();
  const isHomePath = typeof window !== 'undefined' && window.location.pathname === '/';
  if (loading && !isHomePath) return <LoadingScreen />;
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Admin panel */}
        <Route
          path="/admin/login"
          element={(
            <AdminFrameGuard>
              <Suspense fallback={<PageFallback />}><AdminLogin /></Suspense>
            </AdminFrameGuard>
          )}
        />
        <Route
          path="/admin"
          element={(
            <AdminFrameGuard>
              <Suspense fallback={<PageFallback />}><AdminLayout /></Suspense>
            </AdminFrameGuard>
          )}
        >
          <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="profiles" element={<AdminPermissionRoute permission="profiles"><Suspense fallback={<PageFallback />}><ManageProfiles /></Suspense></AdminPermissionRoute>} />
          <Route path="tips" element={<AdminPermissionRoute permission="articles"><Suspense fallback={<PageFallback />}><ManageTips /></Suspense></AdminPermissionRoute>} />
          <Route path="articles" element={<AdminPermissionRoute permission="articles"><Suspense fallback={<PageFallback />}><ManageArticles /></Suspense></AdminPermissionRoute>} />
          <Route path="editorial-queue" element={<AdminPermissionRoute permission="articles"><Suspense fallback={<PageFallback />}><EditorialQueue /></Suspense></AdminPermissionRoute>} />
          <Route path="media" element={<AdminPermissionRoute permission={['articles', 'ads', 'gallery', 'events']}><Suspense fallback={<PageFallback />}><ManageMedia /></Suspense></AdminPermissionRoute>} />
          <Route path="ads" element={<AdminPermissionRoute permission="ads"><Suspense fallback={<PageFallback />}><ManageAds /></Suspense></AdminPermissionRoute>} />
          <Route path="hero" element={<AdminPermissionRoute permission="articles"><Suspense fallback={<PageFallback />}><ManageHero /></Suspense></AdminPermissionRoute>} />
          <Route path="breaking" element={<AdminPermissionRoute permission="breaking"><Suspense fallback={<PageFallback />}><ManageBreaking /></Suspense></AdminPermissionRoute>} />
          <Route path="categories" element={<AdminPermissionRoute permission="categories"><Suspense fallback={<PageFallback />}><ManageCategories /></Suspense></AdminPermissionRoute>} />
          <Route path="wanted" element={<AdminPermissionRoute permission="wanted"><Suspense fallback={<PageFallback />}><ManageMostWanted /></Suspense></AdminPermissionRoute>} />
          <Route path="jobs" element={<AdminPermissionRoute permission="jobs"><Suspense fallback={<PageFallback />}><ManageJobs /></Suspense></AdminPermissionRoute>} />
          <Route path="court" element={<AdminPermissionRoute permission="court"><Suspense fallback={<PageFallback />}><ManageCourt /></Suspense></AdminPermissionRoute>} />
          <Route path="events" element={<AdminPermissionRoute permission="events"><Suspense fallback={<PageFallback />}><ManageEvents /></Suspense></AdminPermissionRoute>} />
          <Route path="polls" element={<AdminPermissionRoute permission="polls"><Suspense fallback={<PageFallback />}><ManagePolls /></Suspense></AdminPermissionRoute>} />
          <Route path="comments" element={<AdminPermissionRoute permission="comments"><Suspense fallback={<PageFallback />}><ManageComments /></Suspense></AdminPermissionRoute>} />
          <Route path="contact" element={<AdminPermissionRoute permission="contact"><Suspense fallback={<PageFallback />}><ManageContactMessages /></Suspense></AdminPermissionRoute>} />
          <Route path="gallery" element={<AdminPermissionRoute permission="gallery"><Suspense fallback={<PageFallback />}><ManageGallery /></Suspense></AdminPermissionRoute>} />
          <Route path="permissions" element={<AdminPermissionRoute permission="permissions"><Suspense fallback={<PageFallback />}><ManagePermissions /></Suspense></AdminPermissionRoute>} />
          <Route path="site-settings" element={<AdminPermissionRoute permission="permissions"><Suspense fallback={<PageFallback />}><ManageSiteSettings /></Suspense></AdminPermissionRoute>} />
          <Route path="diagnostics" element={<AdminPermissionRoute permission="permissions"><Suspense fallback={<PageFallback />}><AdminDiagnostics /></Suspense></AdminPermissionRoute>} />
          <Route path="audit-log" element={<AdminPermissionRoute permission="permissions"><Suspense fallback={<PageFallback />}><ManageAuditLog /></Suspense></AdminPermissionRoute>} />
          <Route path="games" element={<AdminPermissionRoute permission="games"><Suspense fallback={<PageFallback />}><ManageGames /></Suspense></AdminPermissionRoute>} />
          <Route path="games/puzzles" element={<AdminPermissionRoute permission="games"><Suspense fallback={<PageFallback />}><ManageGamePuzzles /></Suspense></AdminPermissionRoute>} />
          <Route path="classifieds" element={<AdminPermissionRoute permission="classifieds"><Suspense fallback={<PageFallback />}><ManageClassifieds /></Suspense></AdminPermissionRoute>} />
        </Route>

        {/* Public site — Suspense is in PublicLayout */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/article/:id" element={<ArticlePage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/author/:id" element={<AuthorPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/latest" element={<LatestPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/court" element={<CourtPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/tipline" element={<TipLine />} />
          <Route path="/obiavi" element={<ClassifiedsPage />} />
          <Route path="/obiavi/submit" element={<ClassifiedSubmitPage />} />
          <Route path="/obiavi/status/:ref?" element={<ClassifiedStatusPage />} />
          <Route path="/obiavi/:id" element={<ClassifiedDetailPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/word" element={<PublicGameRoute slug="word"><GameWordPage /></PublicGameRoute>} />
          <Route path="/games/connections" element={<PublicGameRoute slug="connections"><GameConnectionsPage /></PublicGameRoute>} />
          <Route path="/games/hangman" element={<PublicGameRoute slug="hangman"><GameHangmanPage /></PublicGameRoute>} />
          <Route path="/games/quiz" element={<PublicGameRoute slug="quiz"><GameQuizPage /></PublicGameRoute>} />
          <Route path="/games/spellingbee" element={<PublicGameRoute slug="spellingbee"><GameSpellingBeePage /></PublicGameRoute>} />
          <Route path="/games/crossword" element={<PublicGameRoute slug="crossword"><GameCrosswordPage /></PublicGameRoute>} />
          <Route path="/games/sudoku" element={<PublicGameRoute slug="sudoku"><GameSudokuPage /></PublicGameRoute>} />
          <Route path="/games/tetris" element={<PublicGameRoute slug="tetris"><GameTetrisPage /></PublicGameRoute>} />
          <Route path="/games/snake" element={<PublicGameRoute slug="snake"><GameSnakePage /></PublicGameRoute>} />
          <Route path="/games/2048" element={<PublicGameRoute slug="2048"><Game2048Page /></PublicGameRoute>} />
          <Route path="/games/flappybird" element={<PublicGameRoute slug="flappybird"><GameFlappyBirdPage /></PublicGameRoute>} />
          <Route path="/games/blockbust" element={<PublicGameRoute slug="blockbust"><GameBlockBustPage /></PublicGameRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
