import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useAdminData, usePublicData, useSessionData } from '../../context/DataContext';
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
  Tag,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardCopy } from '../../content/uiCopy';
import { useConfirm } from '../../components/admin/ConfirmDialog';

const DashboardAnalytics = lazy(() => import('../../components/admin/DashboardAnalytics'));

function AnalyticsFallback() {
  return (
    <div className="mb-6 border border-gray-200 bg-white p-5 text-sm text-gray-500">
      {dashboardCopy.loadingAnalytics}
    </div>
  );
}

export default function Dashboard() {
  const { articles, authors, wanted, jobs, court, events, polls, comments, gallery, categories } = usePublicData();
  const {
    users,
    usersReady,
    ensureUsersLoaded,
    resetAll,
    hasPermission,
    classifieds,
    ensureClassifiedsLoaded,
    tips,
    tipsReady,
    ensureTipsLoaded,
  } = useAdminData();
  const { session } = useSessionData();
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [adminActionError, setAdminActionError] = useState('');
  const [contactMessages, setContactMessages] = useState([]);
  const [contactMessagesReady, setContactMessagesReady] = useState(false);
  const confirm = useConfirm();

  const isAdmin = session?.role === 'admin';
  const canSeeAnalytics = hasPermission('articles');
  const canSeeTeam = hasPermission('profiles');
  const canSeeTips = hasPermission('articles');
  const canSeeContactMessages = hasPermission('contact');
  const canSeeClassifieds = hasPermission('classifieds');

  useEffect(() => {
    if (!canSeeTeam) return;
    void ensureUsersLoaded();
  }, [canSeeTeam, ensureUsersLoaded]);

  useEffect(() => {
    if (!canSeeClassifieds) return;
    void ensureClassifiedsLoaded();
  }, [canSeeClassifieds, ensureClassifiedsLoaded]);

  useEffect(() => {
    if (!canSeeTips) return;
    void ensureTipsLoaded();
  }, [canSeeTips, ensureTipsLoaded]);

  useEffect(() => {
    if (!canSeeContactMessages) {
      setContactMessages([]);
      setContactMessagesReady(false);
      return;
    }

    let cancelled = false;

    const loadContactMessages = async () => {
      try {
        const data = await api.contactMessages.getAll({ limit: 200 });
        if (!cancelled) {
          setContactMessages(Array.isArray(data) ? data : []);
          setContactMessagesReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setContactMessages([]);
          setContactMessagesReady(true);
        }
        console.error('Failed to load contact messages for dashboard:', error);
      }
    };

    void loadContactMessages();

    return () => {
      cancelled = true;
    };
  }, [canSeeContactMessages]);

  const totalViews = useMemo(
    () => articles.reduce((sum, article) => sum + (article.views || 0), 0),
    [articles],
  );
  const pendingComments = useMemo(
    () => comments.filter((comment) => !comment.approved).length,
    [comments],
  );
  const newTips = useMemo(
    () => (Array.isArray(tips) ? tips : []).filter((tip) => tip?.status === 'new').length,
    [tips],
  );
  const newContactMessages = useMemo(
    () => (Array.isArray(contactMessages) ? contactMessages : []).filter((message) => message?.status === 'new').length,
    [contactMessages],
  );
  const pendingClassifieds = useMemo(
    () => (Array.isArray(classifieds) ? classifieds : []).filter((c) => c.status === 'awaiting_payment').length,
    [classifieds],
  );
  const recentArticles = useMemo(
    () => [...articles].sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 5),
    [articles],
  );

  const stats = [
    { label: dashboardCopy.stats.articles, value: articles.length, icon: FileText, color: 'bg-zn-purple', to: '/admin/articles', permission: 'articles' },
    { label: dashboardCopy.stats.views, value: totalViews.toLocaleString('bg-BG'), icon: Eye, color: 'bg-amber-600', to: null, permission: 'articles' },
    { label: dashboardCopy.stats.comments, value: comments.length, icon: MessageCircle, color: 'bg-zn-hot', badge: pendingComments > 0 ? `${pendingComments} ${dashboardCopy.stats.pendingComments}` : null, to: '/admin/comments', permission: 'comments' },
    { label: dashboardCopy.stats.gallery, value: gallery.length, icon: Image, color: 'bg-blue-500', to: '/admin/gallery', permission: 'gallery' },
    {
      label: dashboardCopy.stats.tips || 'Сигнали',
      value: tipsReady ? tips.length : '—',
      icon: AlertTriangle,
      color: 'bg-orange-500',
      badge: newTips > 0 ? `${newTips} ${dashboardCopy.stats.newTips || 'нови'}` : null,
      to: '/admin/tips',
      permission: 'articles',
    },
    {
      label: dashboardCopy.stats.contact || 'Запитвания',
      value: contactMessagesReady ? contactMessages.length : '—',
      icon: Mail,
      color: 'bg-sky-600',
      badge: newContactMessages > 0 ? `${newContactMessages} ${dashboardCopy.stats.newContactMessages || 'нови'}` : null,
      to: '/admin/contact',
      permission: 'contact',
    },
  ];

  const rpStats = [
    { label: dashboardCopy.rpStats.wanted, value: wanted.length, icon: Crosshair, color: 'bg-red-600', to: '/admin/wanted', permission: 'wanted' },
    { label: dashboardCopy.rpStats.jobs, value: jobs.length, icon: Briefcase, color: 'bg-emerald-600', to: '/admin/jobs', permission: 'jobs' },
    { label: dashboardCopy.rpStats.court, value: court.length, icon: Scale, color: 'bg-violet-600', to: '/admin/court', permission: 'court' },
    { label: dashboardCopy.rpStats.events, value: events.length, icon: CalendarDays, color: 'bg-blue-600', to: '/admin/events', permission: 'events' },
    { label: dashboardCopy.rpStats.polls, value: polls.length, icon: BarChart3, color: 'bg-pink-600', to: '/admin/polls', permission: 'polls' },
    { label: dashboardCopy.rpStats.classifieds, value: (Array.isArray(classifieds) ? classifieds : []).length, icon: Tag, color: 'bg-amber-600', badge: pendingClassifieds > 0 ? `${pendingClassifieds} ${dashboardCopy.rpStats.pendingClassifieds}` : null, to: '/admin/classifieds', permission: 'classifieds' },
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
      setAdminActionError(error?.message || dashboardCopy.exportError);
      console.error(dashboardCopy.exportError, error);
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async () => {
    if (!isAdmin) return;
    setAdminActionError('');
    const confirmed = await confirm({
      title: 'Пълно нулиране',
      message: dashboardCopy.resetConfirm,
      confirmLabel: dashboardCopy.resetLabel,
      variant: 'danger',
    });
    if (!confirmed) return;
    setResetting(true);
    try {
      await resetAll();
    } catch (error) {
      setAdminActionError(error?.message || dashboardCopy.resetError);
      console.error(dashboardCopy.resetError, error);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">{dashboardCopy.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{dashboardCopy.subtitle}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
            >
              <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} /> {dashboardCopy.exportLabel}
            </button>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="flex items-center gap-2 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} /> {dashboardCopy.resetLabel}
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
          {dashboardCopy.noStats}
        </div>
      )}

      {visibleRpStats.length > 0 && (
        <>
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{dashboardCopy.rpSection}</p>
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
                <h2 className="font-sans font-semibold text-gray-900">{dashboardCopy.recentArticles}</h2>
                <Link to="/admin/articles" className="text-xs text-zn-hot hover:underline">{dashboardCopy.manageArticles}</Link>
              </div>
              <div className="space-y-3">
                {recentArticles.map((article) => (
                  <div key={article.id} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                    <div className="mr-3 min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{article.title}</p>
                      <p className="text-xs text-gray-400">{article.date} • {article.category}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{(article.views || 0).toLocaleString('bg-BG')} {dashboardCopy.viewsShort}</span>
                  </div>
                ))}
                {recentArticles.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">{dashboardCopy.noArticles}</p>
                )}
              </div>
            </div>
          )}

          {canSeeTeam && (
            <div className={`border border-gray-200 bg-white p-5 ${!canSeeAnalytics ? 'lg:col-span-2' : ''}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-sans font-semibold text-gray-900">{dashboardCopy.teamTitle}</h2>
                <Link to="/admin/profiles" className="text-xs text-zn-hot hover:underline">{dashboardCopy.teamManage}</Link>
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
                {usersReady && users.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">{dashboardCopy.noUsers}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
