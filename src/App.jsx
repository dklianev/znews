import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider, useData } from './context/DataContext';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar';
import BreakingTicker from './components/BreakingTicker';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

// ─── Lazy-loaded pages (code-split) ───
const HomePage = lazy(() => import('./pages/HomePage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const CourtPage = lazy(() => import('./pages/CourtPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const TipLine = lazy(() => import('./pages/TipLine'));
const GamesPage = lazy(() => import('./pages/GamesPage'));
const GameWordPage = lazy(() => import('./pages/GameWordPage'));
const GameConnectionsPage = lazy(() => import('./pages/GameConnectionsPage'));
const GameHangmanPage = lazy(() => import('./pages/GameHangmanPage'));
const GameQuizPage = lazy(() => import('./pages/GameQuizPage'));
const GameCrosswordPage = lazy(() => import('./pages/GameCrosswordPage'));
const GameSpellingBeePage = lazy(() => import('./pages/GameSpellingBeePage'));
const GameSudokuPage = lazy(() => import('./pages/GameSudokuPage'));

// Admin (lazy — heavy, rarely visited)
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ManageProfiles = lazy(() => import('./pages/admin/ManageProfiles'));
const ManageArticles = lazy(() => import('./pages/admin/ManageArticles'));
const EditorialQueue = lazy(() => import('./pages/admin/EditorialQueue'));
const ManageMedia = lazy(() => import('./pages/admin/ManageMedia'));
const ManageAds = lazy(() => import('./pages/admin/ManageAds'));
const ManageBreaking = lazy(() => import('./pages/admin/ManageBreaking'));
const ManageHero = lazy(() => import('./pages/admin/ManageHero'));
const ManageCategories = lazy(() => import('./pages/admin/ManageCategories'));
const ManageMostWanted = lazy(() => import('./pages/admin/ManageMostWanted'));
const ManageJobs = lazy(() => import('./pages/admin/ManageJobs'));
const ManageCourt = lazy(() => import('./pages/admin/ManageCourt'));
const ManageEvents = lazy(() => import('./pages/admin/ManageEvents'));
const ManagePolls = lazy(() => import('./pages/admin/ManagePolls'));
const ManageComments = lazy(() => import('./pages/admin/ManageComments'));
const ManageGallery = lazy(() => import('./pages/admin/ManageGallery'));
const ManagePermissions = lazy(() => import('./pages/admin/ManagePermissions'));
const ManageAuditLog = lazy(() => import('./pages/admin/ManageAuditLog'));
const ManageSiteSettings = lazy(() => import('./pages/admin/ManageSiteSettings'));
const ManageContactMessages = lazy(() => import('./pages/admin/ManageContactMessages'));
const ManageTips = lazy(() => import('./pages/admin/ManageTips'));
const ManageGames = lazy(() => import('./pages/admin/ManageGames'));
const ManageGamePuzzles = lazy(() => import('./pages/admin/ManageGamePuzzles'));

// ─── Inline loading fallback ───
function PageFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-zn-purple border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PublicPageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-pulse" aria-label="Зареждане на страница">
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
        <p className="text-xs sm:text-sm font-display uppercase tracking-[0.3em] text-zn-hot mb-3">
          Временен проблем
        </p>
        <h1 className="font-display text-3xl sm:text-4xl uppercase text-zn-text mb-4">
          Не успяхме да проверим играта
        </h1>
        <p className="text-zn-text/80 text-base sm:text-lg max-w-xl mx-auto mb-6">
          Маршрутът не е изключен, но заявката за наличните игри се провали. Опитай отново.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center px-6 py-3 border-3 border-[#1C1428] bg-zn-hot text-white font-display uppercase tracking-[0.2em] shadow-comic transition-transform hover:-translate-y-0.5"
        >
          Опитай пак
        </button>
      </div>
    </div>
  );
}

function AdminPermissionRoute({ permission, children }) {
  const { session, hasPermission } = useData();
  if (!session) return <Navigate to="/admin/login" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/admin" replace />;
  return children;
}
function PublicGameRoute({ slug, children }) {
  const { session, hasPermission, games, publicSectionStatus, loadGamesCatalog } = useData();
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
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <BreakingTicker />
      <main className="flex-1 comic-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Suspense fallback={<PublicPageFallback />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-zn-bg dark:bg-zn-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-zn-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="font-heading text-2xl text-zn-text dark:text-zn-text mb-2">zNews</h2>
        <p className="text-zn-text/60 dark:text-zn-text/60">Зареждане...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { loading } = useData();
  const isHomePath = typeof window !== 'undefined' && window.location.pathname === '/';
  if (loading && !isHomePath) return <LoadingScreen />;
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Admin panel */}
        <Route path="/admin/login" element={<Suspense fallback={<PageFallback />}><AdminLogin /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<PageFallback />}><AdminLayout /></Suspense>}>
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
          <Route path="audit-log" element={<AdminPermissionRoute permission="permissions"><Suspense fallback={<PageFallback />}><ManageAuditLog /></Suspense></AdminPermissionRoute>} />
          <Route path="games" element={<AdminPermissionRoute permission="games"><Suspense fallback={<PageFallback />}><ManageGames /></Suspense></AdminPermissionRoute>} />
          <Route path="games/puzzles" element={<AdminPermissionRoute permission="games"><Suspense fallback={<PageFallback />}><ManageGamePuzzles /></Suspense></AdminPermissionRoute>} />
        </Route>

        {/* Public site — Suspense is in PublicLayout */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/article/:id" element={<ArticlePage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/court" element={<CourtPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/tipline" element={<TipLine />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/word" element={<PublicGameRoute slug="word"><GameWordPage /></PublicGameRoute>} />
          <Route path="/games/connections" element={<PublicGameRoute slug="connections"><GameConnectionsPage /></PublicGameRoute>} />
          <Route path="/games/hangman" element={<PublicGameRoute slug="hangman"><GameHangmanPage /></PublicGameRoute>} />
          <Route path="/games/quiz" element={<PublicGameRoute slug="quiz"><GameQuizPage /></PublicGameRoute>} />
          <Route path="/games/spellingbee" element={<PublicGameRoute slug="spellingbee"><GameSpellingBeePage /></PublicGameRoute>} />
          <Route path="/games/crossword" element={<PublicGameRoute slug="crossword"><GameCrosswordPage /></PublicGameRoute>} />
          <Route path="/games/sudoku" element={<PublicGameRoute slug="sudoku"><GameSudokuPage /></PublicGameRoute>} />
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

