import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
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

function AdminPermissionRoute({ permission, children }) {
  const { session, hasPermission } = useData();
  if (!session) return <Navigate to="/admin/login" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/admin" replace />;
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
  if (loading) return <LoadingScreen />;
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Admin panel */}
        <Route path="/admin/login" element={<Suspense fallback={<PageFallback />}><AdminLogin /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<PageFallback />}><AdminLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="profiles" element={<AdminPermissionRoute permission="profiles"><Suspense fallback={<PageFallback />}><ManageProfiles /></Suspense></AdminPermissionRoute>} />
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
          <Route path="gallery" element={<AdminPermissionRoute permission="gallery"><Suspense fallback={<PageFallback />}><ManageGallery /></Suspense></AdminPermissionRoute>} />
          <Route path="permissions" element={<AdminPermissionRoute permission="permissions"><Suspense fallback={<PageFallback />}><ManagePermissions /></Suspense></AdminPermissionRoute>} />
          <Route path="site-settings" element={<AdminPermissionRoute permission="permissions"><Suspense fallback={<PageFallback />}><ManageSiteSettings /></Suspense></AdminPermissionRoute>} />
          <Route path="audit-log" element={<AdminPermissionRoute permission="permissions"><Suspense fallback={<PageFallback />}><ManageAuditLog /></Suspense></AdminPermissionRoute>} />
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
