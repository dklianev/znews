import { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { FileText, Users, Megaphone, Eye, Crosshair, Briefcase, Scale, CalendarDays, BarChart3, RotateCcw, MessageCircle, Image, TrendingUp, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  RadialBarChart, RadialBar,
} from 'recharts';

const COLORS = ['#990F3D', '#0D7680', '#0F5499', '#d97706', '#059669', '#7c3aed', '#dc2626', '#2563eb', '#db2777'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg px-3 py-2 text-xs font-sans">
      <p className="font-semibold text-gray-900 mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value.toLocaleString()}</strong></p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { articles, authors, ads, wanted, jobs, court, events, polls, comments, gallery, categories, users, resetAll, session } = useData();
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
  const pendingComments = comments.filter(c => !c.approved).length;

  // ─── Chart data ──────────────────────
  const articlesByCategory = useMemo(() => {
    const map = {};
    articles.forEach(a => { map[a.category] = (map[a.category] || 0) + 1; });
    const catNameMap = {};
    categories.forEach(c => { catNameMap[c.id] = c.name; });
    return Object.entries(map)
      .map(([key, count]) => ({ name: catNameMap[key] || key, count }))
      .sort((a, b) => b.count - a.count);
  }, [articles, categories]);

  const topArticles = useMemo(() =>
    [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 7).map(a => ({
      name: a.title.length > 28 ? a.title.slice(0, 28) + '…' : a.title,
      views: a.views || 0,
    }))
    , [articles]);

  const topAuthors = useMemo(() => {
    const map = {};
    articles.forEach(a => {
      const author = authors.find(au => au.id === a.authorId);
      if (author) {
        if (!map[author.id]) map[author.id] = { name: author.name, avatar: author.avatar, articles: 0, views: 0 };
        map[author.id].articles += 1;
        map[author.id].views += (a.views || 0);
      }
    });
    return Object.values(map).sort((a, b) => b.views - a.views).slice(0, 5);
  }, [articles, authors]);

  const contentMix = useMemo(() => [
    { name: 'Статии', value: articles.length, fill: '#990F3D' },
    { name: 'Обяви', value: jobs.length, fill: '#059669' },
    { name: 'Съдебни', value: court.length, fill: '#7c3aed' },
    { name: 'Събития', value: events.length, fill: '#2563eb' },
    { name: 'Галерия', value: gallery.length, fill: '#d97706' },
  ].filter(d => d.value > 0), [articles, jobs, court, events, gallery]);

  const engagementData = useMemo(() => [
    { name: 'Коментари', value: comments.length, fill: '#0D7680' },
    { name: 'Гласове', value: polls.reduce((s, p) => s + (p.options?.reduce((os, o) => os + (o.votes || 0), 0) || 0), 0), fill: '#990F3D' },
    { name: 'Преглеждания', value: Math.min(totalViews, 999), fill: '#0F5499' },
  ], [comments, polls, totalViews]);

  // ─── Stat cards ──────────────────────
  const stats = [
    { label: 'Статии', value: articles.length, icon: FileText, color: 'bg-zn-purple', to: '/admin/articles' },
    { label: 'Преглеждания', value: totalViews.toLocaleString(), icon: Eye, color: 'bg-amber-600', to: null },
    { label: 'Коментари', value: comments.length, icon: MessageCircle, color: 'bg-zn-hot', badge: pendingComments > 0 ? `${pendingComments} чакащи` : null, to: '/admin/comments' },
    { label: 'Галерия', value: gallery.length, icon: Image, color: 'bg-blue-500', to: '/admin/gallery' },
  ];

  const rpStats = [
    { label: 'Издирвани', value: wanted.length, icon: Crosshair, color: 'bg-red-600', to: '/admin/wanted' },
    { label: 'Обяви работа', value: jobs.length, icon: Briefcase, color: 'bg-emerald-600', to: '/admin/jobs' },
    { label: 'Съдебни дела', value: court.length, icon: Scale, color: 'bg-violet-600', to: '/admin/court' },
    { label: 'Събития', value: events.length, icon: CalendarDays, color: 'bg-blue-600', to: '/admin/events' },
    { label: 'Анкети', value: polls.length, icon: BarChart3, color: 'bg-pink-600', to: '/admin/polls' },
  ];

  const recentArticles = [...articles].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const handleReset = async () => {
    if (!confirm('Сигурен ли си? Това ще изтрие ВСИЧКИ данни и ще зареди началните стойности!')) return;
    setResetting(true);
    try {
      await resetAll();
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Табло</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Обобщение на Los Santos News CMS</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setExporting(true);
              try {
                const token = session?.token;
                if (!token) throw new Error('Missing session token');
                const res = await fetch('/api/backup', { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `znews-backup-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              } catch (e) { console.error('Export failed:', e); }
              setExporting(false);
            }}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-200 text-emerald-600 text-sm font-sans font-medium hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} /> Бекъп
          </button>
          <button onClick={handleReset} disabled={resetting} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm font-sans font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} /> Нулирай данни
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(stat => {
          const Inner = (
            <div className="bg-white border border-gray-200 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow">
              <div className={`${stat.color} w-12 h-12 flex items-center justify-center text-white shrink-0`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs font-sans text-gray-500 uppercase tracking-wider">{stat.label}</p>
                {stat.badge && <span className="text-[10px] font-sans text-amber-600 font-semibold">{stat.badge}</span>}
              </div>
            </div>
          );
          return stat.to ? <Link key={stat.label} to={stat.to}>{Inner}</Link> : <div key={stat.label}>{Inner}</div>;
        })}
      </div>

      {/* RP Stats */}
      <div className="mb-3">
        <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400">RP Секции</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {rpStats.map(stat => (
          <Link key={stat.label} to={stat.to} className="bg-white border border-gray-200 p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
            <div className={`${stat.color} w-9 h-9 flex items-center justify-center text-white shrink-0`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-display font-bold text-gray-900">{stat.value}</p>
              <p className="text-[10px] font-sans text-gray-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ─── Charts Row 1 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Articles by Category — Bar */}
        <div className="lg:col-span-2 bg-white border border-gray-200 p-5">
          <h2 className="font-sans font-semibold text-gray-900 mb-1">Статии по категория</h2>
          <p className="text-xs font-sans text-gray-400 mb-4">Разпределение на съдържанието</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={articlesByCategory} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#555' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Статии" radius={[0, 4, 4, 0]}>
                {articlesByCategory.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Content Mix — Pie */}
        <div className="bg-white border border-gray-200 p-5">
          <h2 className="font-sans font-semibold text-gray-900 mb-1">Тип съдържание</h2>
          <p className="text-xs font-sans text-gray-400 mb-4">Микс на публикации</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={contentMix}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {contentMix.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Charts Row 2 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Articles by Views — Area */}
        <div className="bg-white border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-zn-hot" />
            <h2 className="font-sans font-semibold text-gray-900">Топ статии по преглеждания</h2>
          </div>
          <p className="text-xs font-sans text-gray-400 mb-4">Най-четените публикации</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={topArticles} margin={{ left: 0, right: 10, bottom: 30 }}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#990F3D" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#990F3D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: '#888' }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="views" name="Преглеждания" stroke="#990F3D" fill="url(#viewsGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Authors */}
        <div className="bg-white border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-zn-hot" />
            <h2 className="font-sans font-semibold text-gray-900">Топ автори</h2>
          </div>
          <p className="text-xs font-sans text-gray-400 mb-4">По брой преглеждания</p>
          <div className="space-y-3">
            {topAuthors.map((author, i) => {
              const maxViews = topAuthors[0]?.views || 1;
              const pct = Math.round((author.views / maxViews) * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{author.avatar}</span>
                      <span className="text-sm font-sans font-medium text-gray-900">{author.name}</span>
                      <span className="text-[10px] font-sans text-gray-400">{author.articles} статии</span>
                    </div>
                    <span className="text-sm font-sans font-bold text-gray-700">{author.views.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
            {topAuthors.length === 0 && (
              <p className="text-sm font-sans text-gray-400 text-center py-4">Няма данни</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Bottom Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent articles */}
        <div className="bg-white border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-gray-900">Последни статии</h2>
            <Link to="/admin/articles" className="text-xs font-sans text-zn-hot hover:underline">Виж всички →</Link>
          </div>
          <div className="space-y-3">
            {recentArticles.map(article => (
              <div key={article.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-sans font-medium text-gray-900 truncate">{article.title}</p>
                  <p className="text-xs font-sans text-gray-400">{article.date} · {article.category}</p>
                </div>
                <span className="text-xs font-sans text-gray-400 shrink-0">{(article.views || 0).toLocaleString()} 👁</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="bg-white border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-gray-900">Екип</h2>
            <Link to="/admin/profiles" className="text-xs font-sans text-zn-hot hover:underline">Управлявай →</Link>
          </div>
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="w-9 h-9 bg-gray-100 flex items-center justify-center text-lg rounded-full">
                  {user.avatar || '👤'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-sans font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs font-sans text-gray-400">{user.profession || user.role}</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-zn-purple text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
