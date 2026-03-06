import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { LayoutDashboard, Users, FileText, Megaphone, AlertTriangle, LogOut, ExternalLink, FolderOpen, Crosshair, Briefcase, Scale, CalendarDays, BarChart3, Menu, X, MessageCircle, Image, Moon, Sun, Shield, ClipboardList, Crown, SlidersHorizontal, Clock3, Mail, Gamepad2, Puzzle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { makeTitle, useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ToastProvider } from '../../components/admin/Toast';

const navItems = [
  { to: '/admin', label: 'Табло', icon: LayoutDashboard, exact: true },
  { to: '/admin/profiles', label: 'Профили', icon: Users, permission: 'profiles' },
  { to: '/admin/tips', label: 'Сигнали', icon: AlertTriangle, permission: 'articles' },
  { to: '/admin/articles', label: 'Статии', icon: FileText, permission: 'articles' },
  { to: '/admin/editorial-queue', label: 'Editorial Queue', icon: Clock3, permission: 'articles' },
  { to: '/admin/media', label: 'Медийна библиотека', icon: Image, permission: ['articles', 'ads', 'gallery', 'events'] },
  { to: '/admin/hero', label: 'Hero секция', icon: Crown, permission: 'articles' },
  { to: '/admin/categories', label: 'Категории', icon: FolderOpen, permission: 'categories' },
  { to: '/admin/ads', label: 'Реклами', icon: Megaphone, permission: 'ads' },
  { to: '/admin/breaking', label: 'Тикер / Извънредни', icon: AlertTriangle, permission: 'breaking' },
  { type: 'divider', label: 'RP Секции' },
  { to: '/admin/wanted', label: 'Най-издирвани', icon: Crosshair, permission: 'wanted' },
  { to: '/admin/jobs', label: 'Обяви за работа', icon: Briefcase, permission: 'jobs' },
  { to: '/admin/court', label: 'Съдебна хроника', icon: Scale, permission: 'court' },
  { to: '/admin/events', label: 'Събития', icon: CalendarDays, permission: 'events' },
  { to: '/admin/polls', label: 'Анкети', icon: BarChart3, permission: 'polls' },
  { type: 'divider', label: 'Медия & Общност' },
  { to: '/admin/comments', label: 'Коментари', icon: MessageCircle, permission: 'comments' },
  { to: '/admin/contact', label: 'Запитвания', icon: Mail, permission: 'contact' },
  { to: '/admin/gallery', label: 'Галерия', icon: Image, permission: 'gallery' },
  { type: 'divider', label: 'Игри & Забавления' },
  { to: '/admin/games', label: 'Игри', icon: Gamepad2, permission: 'games' },
  { to: '/admin/games/puzzles', label: 'Игрови Пъзели', icon: Puzzle, permission: 'games' },
  { type: 'divider', label: 'Администрация' },
  { to: '/admin/site-settings', label: 'Site настройки', icon: SlidersHorizontal, permission: 'permissions' },
  { to: '/admin/permissions', label: 'Права', icon: Shield, permission: 'permissions' },
  { to: '/admin/audit-log', label: 'Журнал', icon: ClipboardList, permission: 'permissions' },
];

export default function AdminLayout() {
  const { session, logout, hasPermission } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const { isDark, toggleDark } = useTheme();

  const adminTitle = useMemo(() => {
    const path = location.pathname;
    const active = navItems.find((item) => {
      if (!item?.to) return false;
      if (item.exact) return path === item.to;
      return path === item.to || path.startsWith(`${item.to}/`);
    });
    const label = active?.label || 'Админ';
    return makeTitle(`Админ: ${label}`);
  }, [location.pathname]);
  useDocumentTitle(adminTitle);

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  useEffect(() => {
    setGlobalError('');
  }, [location.pathname]);

  useEffect(() => {
    const formatReason = (reason) => {
      if (!reason) return 'Неочаквана грешка';
      if (typeof reason === 'string') return reason.slice(0, 500);
      if (typeof reason?.message === 'string') return reason.message.slice(0, 500);
      try {
        return JSON.stringify(reason).slice(0, 500);
      } catch {
        return 'Неочаквана грешка';
      }
    };

    const onUnhandledRejection = (event) => {
      const message = formatReason(event?.reason);
      setGlobalError(message);
    };

    const onWindowError = (event) => {
      const message = formatReason(event?.error || event?.message);
      setGlobalError(message);
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
    };
  }, []);

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-white/10">
        <Link to="/" className="block" onClick={() => setSidebarOpen(false)}>
          <h1 className="font-display text-xl font-bold">Los Santos News</h1>
          <p className="text-[10px] font-sans text-white/40 uppercase tracking-[0.2em]">CMS панел</p>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 py-4 overflow-y-auto overflow-x-hidden admin-sidebar-scroll">
        {navItems.map((item, idx) => {
          if (item.type === 'divider') {
            // Only show divider if there are visible items after it
            const nextItems = navItems.slice(idx + 1);
            const hasVisibleNext = nextItems.some(n => n.type === 'divider' ? false : (!n.permission || hasPermission(n.permission)));
            if (!hasVisibleNext) return null;
            return <div key={idx} className="px-5 pt-4 pb-1.5 text-[9px] font-sans font-bold uppercase tracking-[0.15em] text-white/30">{item.label}</div>;
          }
          // Filter by permission
          if (item.permission && !hasPermission(item.permission)) return null;
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm font-sans transition-colors ${isActive
                ? 'text-white bg-white/10 border-l-[3px] border-zn-purple'
                : 'text-white/60 hover:text-zn-text hover:bg-white/5'
                }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-zn-purple rounded-full flex items-center justify-center text-sm">
            {session.name?.[0] || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-sans font-medium truncate">{session.name}</p>
            <p className="text-[10px] font-sans text-white/40 uppercase">{session.role}</p>
          </div>
          <button
            onClick={toggleDark}
            className="p-1.5 text-white/40 hover:text-zn-text transition-colors"
            title={isDark ? 'Светла тема' : 'Тъмна тема'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-sans text-white/50 hover:text-zn-text border border-white/10 hover:border-white/30 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Сайт
          </a>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-sans text-white/50 hover:text-red-400 border border-white/10 hover:border-red-400/30 transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Изход
          </button>
        </div>
      </div>
    </>
  );

  return (
    <ToastProvider>
      <div className="min-h-[100dvh] bg-gray-50 flex">
        {/* Mobile header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-zn-bg text-white flex items-center justify-between px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1" aria-label="Отвори менюто">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-display text-lg font-bold">Los Santos News CMS</h1>
          <div className="w-6" />
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
        fixed top-0 left-0 z-50 h-[100dvh] lg:h-screen w-64 bg-zn-bg text-white flex flex-col min-h-0 shrink-0 transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 text-white/60 hover:text-zn-text"
            aria-label="Затвори менюто"
          >
            <X className="w-5 h-5" />
          </button>
          {sidebarContent}
        </aside>

        {/* Main */}
        <main className="flex-1 min-h-[100dvh] overflow-auto lg:ml-64 mt-14 lg:mt-0">
          {globalError && (
            <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm font-sans flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Грешка</p>
                <p className="break-words">{globalError}</p>
              </div>
              <button
                type="button"
                onClick={() => setGlobalError('')}
                className="p-1 text-red-700 hover:text-red-900"
                aria-label="Затвори"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  );
}
