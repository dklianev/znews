import { useMemo } from 'react';
import { TrendingUp, Users } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#990F3D', '#0D7680', '#0F5499', '#d97706', '#059669', '#7c3aed', '#dc2626', '#2563eb', '#db2777'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-0.5 font-semibold text-gray-900">{label}</p>
      {payload.map((entry, index) => (
        <p key={`${entry.name}-${index}`} style={{ color: entry.color }}>
          {entry.name}: <strong>{Number(entry.value || 0).toLocaleString('bg-BG')}</strong>
        </p>
      ))}
    </div>
  );
}

export default function DashboardAnalytics({
  articles = [],
  authors = [],
  categories = [],
  jobs = [],
  court = [],
  events = [],
  gallery = [],
  polls = [],
  comments = [],
  totalViews = 0,
}) {
  const articlesByCategory = useMemo(() => {
    const counts = new Map();
    const categoryNames = new Map();

    articles.forEach((article) => {
      const key = String(article?.category || '').trim() || 'uncategorized';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    categories.forEach((category) => {
      categoryNames.set(category.id, category.name);
    });

    return [...counts.entries()]
      .map(([key, count]) => ({ name: categoryNames.get(key) || key, count }))
      .sort((left, right) => right.count - left.count);
  }, [articles, categories]);

  const topArticles = useMemo(() => (
    [...articles]
      .sort((left, right) => (right.views || 0) - (left.views || 0))
      .slice(0, 7)
      .map((article) => ({
        name: article.title.length > 28 ? `${article.title.slice(0, 28)}.` : article.title,
        views: article.views || 0,
      }))
  ), [articles]);

  const topAuthors = useMemo(() => {
    const authorMap = new Map(authors.map((author) => [author.id, author]));
    const totals = new Map();

    articles.forEach((article) => {
      const author = authorMap.get(article.authorId);
      if (!author) return;

      const existing = totals.get(author.id) || {
        name: author.name,
        avatar: author.avatar,
        articles: 0,
        views: 0,
      };

      existing.articles += 1;
      existing.views += (article.views || 0);
      totals.set(author.id, existing);
    });

    return [...totals.values()].sort((left, right) => right.views - left.views).slice(0, 5);
  }, [articles, authors]);

  const contentMix = useMemo(() => [
    { name: 'Статии', value: articles.length, fill: '#990F3D' },
    { name: 'Обяви', value: jobs.length, fill: '#059669' },
    { name: 'Дела', value: court.length, fill: '#7c3aed' },
    { name: 'Събития', value: events.length, fill: '#2563eb' },
    { name: 'Галерия', value: gallery.length, fill: '#d97706' },
  ].filter((entry) => entry.value > 0), [articles, jobs, court, events, gallery]);

  const engagementData = useMemo(() => [
    { name: 'Коментари', value: comments.length, fill: '#0D7680' },
    {
      name: 'Гласове',
      value: polls.reduce((sum, poll) => sum + (poll.options?.reduce((optionSum, option) => optionSum + (option.votes || 0), 0) || 0), 0),
      fill: '#990F3D',
    },
    { name: 'Преглеждания', value: totalViews, fill: '#0F5499' },
  ], [comments, polls, totalViews]);

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 border border-gray-200 bg-white p-5">
          <h2 className="mb-1 font-sans font-semibold text-gray-900">Статии по категории</h2>
          <p className="mb-4 text-xs text-gray-400">Разпределение на публикуваното съдържание.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={articlesByCategory} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#555' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Статии" radius={[0, 4, 4, 0]}>
                {articlesByCategory.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-gray-200 bg-white p-5">
          <h2 className="mb-1 font-sans font-semibold text-gray-900">Микс по тип</h2>
          <p className="mb-4 text-xs text-gray-400">Как е разпределено съдържанието.</p>
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
                {contentMix.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-gray-200 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-zn-hot" />
            <h2 className="font-sans font-semibold text-gray-900">Най-четени статии</h2>
          </div>
          <p className="mb-4 text-xs text-gray-400">Текущи лидери по преглеждания.</p>
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

        <div className="border border-gray-200 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <Users className="h-4 w-4 text-zn-hot" />
            <h2 className="font-sans font-semibold text-gray-900">Топ автори</h2>
          </div>
          <p className="mb-4 text-xs text-gray-400">По общи преглеждания на публикациите.</p>
          <div className="space-y-3">
            {topAuthors.map((author, index) => {
              const maxViews = topAuthors[0]?.views || 1;
              const pct = Math.round((author.views / maxViews) * 100);
              return (
                <div key={`${author.name}-${index}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{author.avatar}</span>
                      <span className="text-sm font-medium text-gray-900">{author.name}</span>
                      <span className="text-[10px] text-gray-400">{author.articles} статии</span>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{author.views.toLocaleString('bg-BG')}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: COLORS[index % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
            {topAuthors.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">Няма достатъчно данни.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 border border-gray-200 bg-white p-5">
        <h2 className="mb-1 font-sans font-semibold text-gray-900">Ангажираност</h2>
        <p className="mb-4 text-xs text-gray-400">Коментари, гласове и общи преглеждания.</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={engagementData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#555' }} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {engagementData.map((entry, index) => (
                <Cell key={index} fill={entry.fill || COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
