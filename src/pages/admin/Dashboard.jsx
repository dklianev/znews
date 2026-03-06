import { Suspense, lazy, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { api } from '../../utils/api';
import {
  FileText,
  Users,
  Eye,
  Crosshair,
  Briefcase,
  Scale,
  CalendarDays,
  BarChart3,
  RotateCcw,
  MessageCircle,
  Image,
  Download,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DashboardAnalytics = lazy(() => import('../../components/admin/DashboardAnalytics'));

function AnalyticsFallback() {
  return (
    <div className="mb-6 border border-gray-200 bg-white p-5 text-sm text-gray-500">
      Зареждане на аналитичния панел...
    </div>
  );
}

export default function Dashboard() {
  const {
    articles,
    authors,
    wanted,
    jobs,
    court,
    events,
    polls,
    comments,
    gallery,
    categories,
    users,
    resetAll,
    session,
    hasPermission,
  } = useData();
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [adminActionError, setAdminActionError] = useState('');

  const isAdmin = session?.role === 'admin';
  const canSeeAnalytics = hasPermission('articles');
  const canSeeTeam = hasPermission('profiles');

  const totalViews = useMemo(
    () => articles.reduce((sum, article) => sum + (article.views || 0), 0),
    [articles],
  );
  const pendingComments = useMemo(
    () => comments.filter((comment) => !comment.approved).length,
    [comments],
  );
  const recentArticles = useMemo(
    () => [...articles].sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 5),
    [articles],
  );

  const stats = [
    { label: 'Статии', value: articles.length, icon: FileText, color: 'bg-zn-purple', to: '/admin/articles', permission: 'articles' },
    { label: 'Преглеждания', value: totalViews.toLocaleString('bg-BG'), icon: Eye, color: 'bg-amber-600', to: null, permission: 'articles' },
    { label: 'Коментари', value: comments.length, icon: MessageCircle, color: 'bg-zn-hot', badge: pendingComments > 0 ? `${pendingComments} чакат` : null, to: '/admin/comments', permission: 'comments' },
    { label: 'Галерия', value: gallery.length, icon: Image, color: 'bg-blue-500', to: '/admin/gallery', permission: 'gallery' },
  ];

  const rpStats = [
    { label: 'Издирвани', value: wanted.length, icon: Crosshair, color: 'bg-red-600', to: '/admin/wanted', permission: 'wanted' },
    { label: 'Обяви', value: jobs.length, icon: Briefcase, color: 'bg-emerald-600', to: '/admin/jobs', permission: 'jobs' },
    { label: 'Дела', value: court.length, icon: Scale, color: 'bg-violet-600', to: '/admin/court', permission: 'court' },
    { label: 'Събития', value: events.length, icon: CalendarDays, color: 'bg-blue-600', to: '/admin/events', permission: 'events' },
    { label: 'Анкети', value: polls.length, icon: BarChart3, color: 'bg-pink-600', to: '/admin/polls', permission: 'polls' },
  ];

  const visibleStats = stats.filter((stat) => !stat.permission || hasPermission(stat.permission));
  const visibleRpStats = rpStats.filter((stat) => !stat.permission || hasPermission(stat.permission));

  const handleExport = async () => {
    if (!isAdmin) return;
    setAdminActionError('');
    setExporting(true);
    try {
      const blob = await api.backup.download();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `znews-backup-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setAdminActionError(error?.message || 'Export failed');
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async () => {
    if (!isAdmin) return;
    setAdminActionError('');
    if (!confirm('Това ще презапише демонстрационните данни и ще върне системата в начално състояние. Продължаваме ли?')) return;
    setResetting(true);
    try {
      await resetAll();
    } catch (error) {
      setAdminActionError(error?.message || 'Reset failed');
      console.error('Reset failed:', error);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Табло</h1>
          <p className="mt-1 text-sm text-gray-500">Оперативен преглед на Los Santos News CMS.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
            >
              <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} /> Архив
            </button>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="flex items-center gap-2 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} /> Reset demo
            </button>
          </div>
        )}
      </div>

      {adminActionError && (
        <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {adminActionError}
        </div>
      )}

      {visibleStats.length > 0 ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleStats.map((stat) => {
            const Inner = (
              <div className="flex items-center gap-4 border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm">
                <div className={`${stat.color} flex h-12 w-12 shrink-0 items-center justify-center text-white`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs uppercase tracking-wider text-gray-500">{stat.label}</p>
                  {stat.badge && <span className="text-[10px] font-semibold text-amber-600">{stat.badge}</span>}
                </div>
              </div>
            );
            return stat.to ? <Link key={stat.label} to={stat.to}>{Inner}</Link> : <div key={stat.label}>{Inner}</div>;
          })}
        </div>
      ) : (
        <div className="mb-6 border border-gray-200 bg-white p-5 text-sm text-gray-600">
          Няма видими статистики за текущия профил.
        </div>
      )}

      {visibleRpStats.length > 0 && (
        <>
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Оперативни секции</p>
          </div>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {visibleRpStats.map((stat) => (
              <Link key={stat.label} to={stat.to} className="flex items-center gap-3 border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
                <div className={`${stat.color} flex h-9 w-9 shrink-0 items-center justify-center text-white`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xl font-display font-bold text-gray-900">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {canSeeAnalytics && (
        <Suspense fallback={<AnalyticsFallback />}>
          <DashboardAnalytics
            articles={articles}
            authors={authors}
            categories={categories}
            jobs={jobs}
            court={court}
            events={events}
            gallery={gallery}
            polls={polls}
            comments={comments}
            totalViews={totalViews}
          />
        </Suspense>
      )}

      {(canSeeAnalytics || canSeeTeam) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {canSeeAnalytics && (
            <div className={`border border-gray-200 bg-white p-5 ${!canSeeTeam ? 'lg:col-span-2' : ''}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-sans font-semibold text-gray-900">Последни статии</h2>
                <Link to="/admin/articles" className="text-xs text-zn-hot hover:underline">Към статиите</Link>
              </div>
              <div className="space-y-3">
                {recentArticles.map((article) => (
                  <div key={article.id} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                    <div className="mr-3 min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{article.title}</p>
                      <p className="text-xs text-gray-400">{article.date} • {article.category}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{(article.views || 0).toLocaleString('bg-BG')} прегл.</span>
                  </div>
                ))}
                {recentArticles.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">Няма публикации.</p>
                )}
              </div>
            </div>
          )}

          {canSeeTeam && (
            <div className={`border border-gray-200 bg-white p-5 ${!canSeeAnalytics ? 'lg:col-span-2' : ''}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-sans font-semibold text-gray-900">Екип</h2>
                <Link to="/admin/profiles" className="text-xs text-zn-hot hover:underline">Управление</Link>
              </div>
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg">
                      {user.avatar || '??'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-400">{user.profession || user.role}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-zn-purple text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {user.role}
                    </span>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">Няма потребители.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
