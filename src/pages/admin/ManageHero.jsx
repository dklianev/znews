import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Crown, Search, Save, X, ExternalLink, Flame, History, RotateCcw } from 'lucide-react';

const heroPreviewFallbackImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#EDE4D0"/><text x="400" y="240" text-anchor="middle" font-family="Oswald,sans-serif" font-size="42" font-weight="900" fill="#C4B49A">LOS SANTOS NEWSWIRE</text></svg>');

const DEFAULT_COPY = {
  headline: 'ТАЙНИ СРЕЩИ НА ПЛАЖА\nИ ПАРКА!',
  shockLabel: 'ШОК!',
  ctaLabel: 'РАЗКРИЙ ВСИЧКО ТУК!',
  headlineBoardText: 'ШОК И СЕНЗАЦИЯ!',
  captions: ['В КОЛАТА НА ПОЛИЦАЯ!', 'ГОРЕЩА ПРЕГРЪДКА!', 'ТАЙНА СРЕЩА В ПАРКА!'],
  mainPhotoArticleId: null,
  photoArticleIds: [],
};

export default function ManageHero() {
  const {
    articles,
    categories,
    authors,
    breaking,
    updateArticle,
    heroSettings,
    heroSettingsRevisions,
    saveHeroSettings,
    loadHeroSettingsRevisions,
    restoreHeroSettingsRevision,
  } = useData();
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [restoringHistory, setRestoringHistory] = useState(null);
  const [copyForm, setCopyForm] = useState({
    headline: DEFAULT_COPY.headline,
    shockLabel: DEFAULT_COPY.shockLabel,
    ctaLabel: DEFAULT_COPY.ctaLabel,
    headlineBoardText: DEFAULT_COPY.headlineBoardText,
    caption1: DEFAULT_COPY.captions[0],
    caption2: DEFAULT_COPY.captions[1],
    caption3: DEFAULT_COPY.captions[2],
    mainPhotoArticleId: '',
    photoArticleId1: '',
    photoArticleId2: '',
  });

  useEffect(() => {
    const resolved = {
      ...DEFAULT_COPY,
      ...(heroSettings || {}),
      captions: Array.isArray(heroSettings?.captions) && heroSettings.captions.length === 3
        ? heroSettings.captions
        : DEFAULT_COPY.captions,
      photoArticleIds: Array.isArray(heroSettings?.photoArticleIds)
        ? heroSettings.photoArticleIds
        : DEFAULT_COPY.photoArticleIds,
      mainPhotoArticleId: Number.isInteger(Number.parseInt(heroSettings?.mainPhotoArticleId, 10))
        ? Number.parseInt(heroSettings?.mainPhotoArticleId, 10)
        : DEFAULT_COPY.mainPhotoArticleId,
    };
    setCopyForm({
      headline: resolved.headline,
      shockLabel: resolved.shockLabel,
      ctaLabel: resolved.ctaLabel,
      headlineBoardText: resolved.headlineBoardText || DEFAULT_COPY.headlineBoardText,
      caption1: resolved.captions[0],
      caption2: resolved.captions[1],
      caption3: resolved.captions[2],
      mainPhotoArticleId: resolved.mainPhotoArticleId ? String(resolved.mainPhotoArticleId) : '',
      photoArticleId1: resolved.photoArticleIds[0] ? String(resolved.photoArticleIds[0]) : '',
      photoArticleId2: resolved.photoArticleIds[1] ? String(resolved.photoArticleIds[1]) : '',
    });
  }, [heroSettings]);

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    loadHeroSettingsRevisions()
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadHeroSettingsRevisions]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const authorMap = useMemo(() => {
    const map = new Map();
    authors.forEach(a => map.set(a.id, a.name));
    return map;
  }, [authors]);

  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => {
      const dateDiff = new Date(b.date || 0) - new Date(a.date || 0);
      if (dateDiff !== 0) return dateDiff;
      return (b.id || 0) - (a.id || 0);
    });
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedArticles;
    return sortedArticles.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.excerpt || '').toLowerCase().includes(q) ||
      (categoryMap.get(a.category) || '').toLowerCase().includes(q)
    );
  }, [query, sortedArticles, categoryMap]);

  const heroArticle = useMemo(() => articles.find(a => a.hero), [articles]);
  const fallbackHero = useMemo(
    () => articles.find(a => a.breaking) || sortedArticles[0] || null,
    [articles, sortedArticles]
  );
  const previewHeroArticle = heroArticle || fallbackHero || null;
  const previewTickerItems = Array.isArray(breaking) ? breaking.filter(Boolean) : [];
  const headlineBoardWords = (copyForm.headlineBoardText || DEFAULT_COPY.headlineBoardText)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const previewMainPhoto = useMemo(() => {
    const selectedId = Number.parseInt(copyForm.mainPhotoArticleId, 10);
    if (Number.isInteger(selectedId) && selectedId > 0) {
      const selectedArticle = sortedArticles.find(item => item.id === selectedId);
      if (selectedArticle) return selectedArticle;
    }
    return previewHeroArticle;
  }, [copyForm.mainPhotoArticleId, previewHeroArticle, sortedArticles]);

  const previewPhotoArticles = useMemo(() => {
    if (!previewHeroArticle || !previewMainPhoto) return [];

    const selectedIds = [copyForm.photoArticleId1, copyForm.photoArticleId2]
      .map(value => Number.parseInt(value, 10))
      .filter(value => Number.isInteger(value) && value > 0);

    const selectedSiblings = [...new Set(selectedIds)]
      .map((articleId) => sortedArticles.find(item => item.id === articleId))
      .filter(Boolean)
      .filter((item) => item.id !== previewMainPhoto.id)
      .slice(0, 2);

    const autoSiblings = sortedArticles
      .filter((item) => item.id !== previewMainPhoto.id && !selectedSiblings.find((selected) => selected.id === item.id))
      .slice(0, 2);

    const resolvedSiblings = [...selectedSiblings, ...autoSiblings].slice(0, 2);
    return [previewMainPhoto, ...resolvedSiblings];
  }, [copyForm.photoArticleId1, copyForm.photoArticleId2, previewHeroArticle, previewMainPhoto, sortedArticles]);

  const setHero = async (articleId) => {
    setSavingId(articleId);
    try {
      const currentlyHero = articles.filter(a => a.hero && a.id !== articleId);
      await Promise.all([
        ...currentlyHero.map(a => updateArticle(a.id, { hero: false })),
        updateArticle(articleId, { hero: true, status: 'published' }),
      ]);
    } finally {
      setSavingId(null);
    }
  };

  const clearHero = async () => {
    const currentlyHero = articles.filter(a => a.hero);
    if (currentlyHero.length === 0) return;
    setClearing(true);
    try {
      await Promise.all(currentlyHero.map(a => updateArticle(a.id, { hero: false })));
    } finally {
      setClearing(false);
    }
  };

  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';

  const saveCopy = async () => {
    setSavingCopy(true);
    try {
      const mainPhotoArticleIdRaw = Number.parseInt(copyForm.mainPhotoArticleId, 10);
      const mainPhotoArticleId = Number.isInteger(mainPhotoArticleIdRaw) && mainPhotoArticleIdRaw > 0
        ? mainPhotoArticleIdRaw
        : null;

      const photoArticleIds = [...new Set(
        [copyForm.photoArticleId1, copyForm.photoArticleId2]
          .map(v => Number.parseInt(v, 10))
          .filter(v => Number.isInteger(v) && v > 0)
      )].slice(0, 2);

      await saveHeroSettings({
        headline: copyForm.headline,
        shockLabel: copyForm.shockLabel,
        ctaLabel: copyForm.ctaLabel,
        headlineBoardText: copyForm.headlineBoardText,
        captions: [copyForm.caption1, copyForm.caption2, copyForm.caption3],
        mainPhotoArticleId,
        photoArticleIds,
      });
    } finally {
      setSavingCopy(false);
    }
  };

  const handleRestoreHistory = async (revisionId) => {
    if (!revisionId) return;
    if (!confirm('Да върна тази Hero версия? Текущите незапазени промени ще бъдат заменени.')) return;
    setRestoringHistory(revisionId);
    try {
      await restoreHeroSettingsRevision(revisionId);
    } finally {
      setRestoringHistory(null);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Hero секция</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Избери една статия за главния Hero блок на началната страница</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearHero}
            disabled={clearing || !heroArticle}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Премахни Hero
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-5 mb-6">
        <p className={labelCls}>Текущ Hero</p>
        {heroArticle ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-sans font-bold text-gray-900 truncate">{heroArticle.title}</p>
              <p className="text-xs font-sans text-gray-500 mt-1">
                {categoryMap.get(heroArticle.category) || heroArticle.category} · {authorMap.get(heroArticle.authorId) || 'Неизвестен'} · {heroArticle.date}
              </p>
            </div>
            <a
              href={`/article/${heroArticle.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold text-zn-hot border border-zn-hot/30 hover:bg-zn-hot/5 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Преглед
            </a>
          </div>
        ) : (
          <div className="text-sm font-sans text-gray-500">
            Няма избрана hero статия. В момента началната ще ползва fallback: {' '}
            <span className="font-semibold text-gray-700">{fallbackHero?.title || 'няма налични публикации'}</span>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
            <History className="w-3.5 h-3.5" />
            Hero revisions
          </div>
          <button
            onClick={async () => {
              setLoadingHistory(true);
              try {
                await loadHeroSettingsRevisions();
              } finally {
                setLoadingHistory(false);
              }
            }}
            className="text-xs font-sans font-semibold text-zn-purple hover:text-zn-purple-dark transition-colors"
          >
            Обнови
          </button>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {loadingHistory && <p className="text-xs font-sans text-gray-400 py-2">Зареждане на версии...</p>}
          {!loadingHistory && heroSettingsRevisions.slice(0, 20).map((revision) => (
            <div key={revision.revisionId} className="flex items-center justify-between gap-2 border border-gray-200 bg-white px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-xs font-sans font-semibold text-gray-700 truncate">
                  v{revision.version} · {revision.source}
                </p>
                <p className="text-[10px] font-sans text-gray-400">
                  {new Date(revision.createdAt).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRestoreHistory(revision.revisionId)}
                disabled={restoringHistory === revision.revisionId}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-semibold text-zn-purple border border-zn-purple/30 hover:bg-zn-purple/5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" />
                {restoringHistory === revision.revisionId ? '...' : 'Restore'}
              </button>
            </div>
          ))}
          {!loadingHistory && heroSettingsRevisions.length === 0 && (
            <p className="text-xs font-sans text-gray-400 py-2">Няма запазени версии на Hero settings.</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-5 mb-4">
        <label className={labelCls}>Търсене на статия</label>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Търси по заглавие, резюме или категория..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-sans font-semibold text-gray-900">Hero текстове и снимки</h2>
            <p className="text-xs font-sans text-gray-500 mt-0.5">Това управлява надписите и избора на снимки в Hero блока на началната страница</p>
          </div>
          <button
            onClick={saveCopy}
            disabled={savingCopy}
            className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingCopy ? 'Запис...' : 'Запази Hero'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border border-gray-200 bg-gray-50/40">
            <div>
              <label className={labelCls}>Снимка 1 (вляво, линк + снимка)</label>
              <select
                value={copyForm.mainPhotoArticleId}
                onChange={(e) => setCopyForm(prev => ({ ...prev, mainPhotoArticleId: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
              >
                <option value="">Автоматично (Hero статия)</option>
                {sortedArticles.map(article => (
                  <option
                    key={`hero-photo-main-${article.id}`}
                    value={String(article.id)}
                    disabled={copyForm.photoArticleId1 === String(article.id) || copyForm.photoArticleId2 === String(article.id)}
                  >
                    {article.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Снимка 2 (горе вдясно, линк + снимка)</label>
              <select
                value={copyForm.photoArticleId1}
                onChange={(e) => setCopyForm(prev => ({ ...prev, photoArticleId1: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
              >
                <option value="">Автоматично (по статии)</option>
                {sortedArticles.map(article => (
                  <option
                    key={`hero-photo-1-${article.id}`}
                    value={String(article.id)}
                    disabled={copyForm.mainPhotoArticleId === String(article.id) || copyForm.photoArticleId2 === String(article.id)}
                  >
                    {article.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Снимка 3 (долу вдясно, линк + снимка)</label>
              <select
                value={copyForm.photoArticleId2}
                onChange={(e) => setCopyForm(prev => ({ ...prev, photoArticleId2: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
              >
                <option value="">Автоматично (по статии)</option>
                {sortedArticles.map(article => (
                  <option
                    key={`hero-photo-2-${article.id}`}
                    value={String(article.id)}
                    disabled={copyForm.mainPhotoArticleId === String(article.id) || copyForm.photoArticleId1 === String(article.id)}
                  >
                    {article.title}
                  </option>
                ))}
              </select>
            </div>
            <p className="md:col-span-3 text-xs font-sans text-gray-500">
              Можеш да пренасочиш всяка снимка към конкретна статия. При "Автоматично" за снимка 1 се ползва Hero статията, а за снимка 2 и 3 се ползва автоматичен подбор от последни публикации.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Голям червен надпис (нов ред с Enter)</label>
            <textarea
              value={copyForm.headline}
              onChange={(e) => setCopyForm(prev => ({ ...prev, headline: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple resize-y h-20"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Горен board текст (над Hero)</label>
            <input
              value={copyForm.headlineBoardText}
              onChange={(e) => setCopyForm(prev => ({ ...prev, headlineBoardText: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
            />
          </div>
          <div>
            <label className={labelCls}>Лента върху 1-ва снимка</label>
            <input
              value={copyForm.caption1}
              onChange={(e) => setCopyForm(prev => ({ ...prev, caption1: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
            />
          </div>
          <div>
            <label className={labelCls}>Лента върху 2-ра снимка</label>
            <input
              value={copyForm.caption2}
              onChange={(e) => setCopyForm(prev => ({ ...prev, caption2: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
            />
          </div>
          <div>
            <label className={labelCls}>Лента върху 3-та снимка</label>
            <input
              value={copyForm.caption3}
              onChange={(e) => setCopyForm(prev => ({ ...prev, caption3: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
            />
          </div>
          <div>
            <label className={labelCls}>Starburst текст</label>
            <input
              value={copyForm.shockLabel}
              onChange={(e) => setCopyForm(prev => ({ ...prev, shockLabel: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>CTA текст (долу)</label>
            <input
              value={copyForm.ctaLabel}
              onChange={(e) => setCopyForm(prev => ({ ...prev, ctaLabel: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-5 mb-6 space-y-5">
        <div>
          <h2 className="text-base font-sans font-semibold text-gray-900">Live preview</h2>
          <p className="text-xs font-sans text-gray-500 mt-0.5">Преглед в реално време на тикер, headline board и Hero снимки</p>
        </div>

        <div className="border border-gray-200 overflow-hidden">
          <div className="bg-zn-purple text-white px-3 py-1.5 text-[10px] font-sans font-bold uppercase tracking-wider">
            Тикер (текущ)
          </div>
          <div className="breaking-strip border-y border-black/20 comic-dots-red">
            <div className="px-3 py-1">
              <div className="ticker-wrap py-2">
                <div className="ticker-content text-white text-xs font-display font-bold uppercase tracking-wider">
                  {previewTickerItems.length > 0 ? (
                    <>
                      <span>{previewTickerItems.join('  ★  ')}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
                      <span>{previewTickerItems.join('  ★  ')}&nbsp;&nbsp;★&nbsp;&nbsp;</span>
                    </>
                  ) : (
                    <span>Няма елементи в тикера</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 p-4 bg-gray-50/60">
          <p className={labelCls}>Headline board</p>
          <div className="comic-headline-board inline-flex">
            {(headlineBoardWords.length > 0 ? headlineBoardWords : DEFAULT_COPY.headlineBoardText.split(' ')).map((word, index, words) => {
              const edgeWord = index === 0 || index === words.length - 1;
              return (
                <span
                  key={`${word}-${index}`}
                  className={`comic-headline-board-word ${edgeWord ? 'comic-headline-board-word-hot' : 'comic-headline-board-word-ink'}`}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </div>

        <div className="border border-gray-200 p-4 bg-gray-50/50">
          <p className={labelCls}>Hero снимки и препратки</p>
          {previewHeroArticle ? (
            <>
              <p className="text-sm font-sans font-semibold text-gray-900 mb-3">
                Hero статия: <span className="text-zn-hot">{previewHeroArticle.title}</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {previewPhotoArticles.map((item, index) => (
                  <div key={`hero-preview-${item.id}-${index}`} className="border border-gray-200 bg-white p-2">
                    <div className="aspect-[16/10] overflow-hidden border border-gray-100">
                      <img
                        src={item.image || heroPreviewFallbackImage}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = heroPreviewFallbackImage;
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-display font-black uppercase text-gray-900 line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-[11px] font-sans text-gray-500 mt-1 line-clamp-2">
                      {index === 0 ? copyForm.caption1 : index === 1 ? copyForm.caption2 : copyForm.caption3}
                    </p>
                    <p className="text-[10px] font-sans text-zn-hot mt-1">
                      Препраща към: /article/{item.id}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm font-sans text-gray-500">Няма публикации за Hero preview.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {filteredArticles.map(article => {
          const isHero = Boolean(article.hero);
          const isSaving = savingId === article.id;
          return (
            <div key={article.id} className={`bg-white border p-4 flex items-start gap-4 transition-colors ${isHero ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200 hover:bg-gray-50'}`}>
              {article.image && (
                <img src={article.image} alt="" className="w-20 h-14 object-cover flex-shrink-0 border border-gray-100" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                    {categoryMap.get(article.category) || article.category}
                  </span>
                  {article.breaking && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-sans font-bold uppercase text-red-600">
                      <Flame className="w-3 h-3" />
                      Breaking
                    </span>
                  )}
                  {isHero && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider text-amber-700 bg-amber-100">
                      <Crown className="w-3 h-3" />
                      Hero
                    </span>
                  )}
                  {article.status === 'draft' && (
                    <span className="text-[9px] font-sans font-bold uppercase text-gray-500 bg-gray-200 px-1 py-0.5 rounded">Чернова</span>
                  )}
                </div>
                <p className="text-sm font-sans font-bold text-gray-900 truncate">{article.title}</p>
                <p className="text-xs font-sans text-gray-500 mt-1">
                  {authorMap.get(article.authorId) || 'Неизвестен'} · {article.date}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/article/${article.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-zn-hot transition-colors"
                  title="Преглед"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setHero(article.id)}
                  disabled={isSaving || isHero}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zn-purple text-white text-xs font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isHero ? 'Избран' : isSaving ? 'Запис...' : 'Направи Hero'}
                </button>
              </div>
            </div>
          );
        })}

        {filteredArticles.length === 0 && (
          <div className="text-center py-12 text-sm font-sans text-gray-400 bg-white border border-gray-200">
            Няма статии по този филтър
          </div>
        )}
      </div>
    </div>
  );
}
