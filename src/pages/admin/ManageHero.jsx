import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdminData, usePublicData } from '../../context/DataContext';
import { Crown, Search, Save, X, ExternalLink, Flame, History, RotateCcw, AlertTriangle, Loader2, Megaphone, Clock, Eye } from 'lucide-react';
import { useToast } from '../../components/admin/Toast';
import { buildScaledClamp, normalizeHeroTitleScale } from '../../utils/heroTitleScale';

const heroPreviewFallbackImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#EDE4D0"/><text x="400" y="240" text-anchor="middle" font-family="Oswald,sans-serif" font-size="42" font-weight="900" fill="#C4B49A">LOS SANTOS NEWSWIRE</text></svg>');

const DEFAULT_COPY = {
  headline: 'ТАЙНИ СРЕЩИ НА ПЛАЖА\nИ ПАРКА!',
  shockLabel: 'ШОК!',
  ctaLabel: 'РАЗКРИЙ ВСИЧКО ТУК!',
  headlineBoardText: 'ШОК И СЕНЗАЦИЯ!',
  heroTitleScale: 100,
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
    saveHeroSettings,
  } = usePublicData();
  const {
    heroSettingsRevisions,
    loadHeroSettingsRevisions,
    restoreHeroSettingsRevision,
  } = useAdminData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [restoringHistory, setRestoringHistory] = useState(null);
  const [error, setError] = useState('');
  const [copyForm, setCopyForm] = useState({
    headline: DEFAULT_COPY.headline,
    shockLabel: DEFAULT_COPY.shockLabel,
    ctaLabel: DEFAULT_COPY.ctaLabel,
    headlineBoardText: DEFAULT_COPY.headlineBoardText,
    heroTitleScale: DEFAULT_COPY.heroTitleScale,
    caption1: DEFAULT_COPY.captions[0],
    caption2: DEFAULT_COPY.captions[1],
    caption3: DEFAULT_COPY.captions[2],
    mainPhotoArticleId: '',
    photoArticleId1: '',
    photoArticleId2: '',
  });
  const initialCopyRef = useRef(copyForm);
  const fieldRefs = useRef(new Map());

  // Sync from server
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
      heroTitleScale: normalizeHeroTitleScale(heroSettings?.heroTitleScale),
      mainPhotoArticleId: Number.isInteger(Number.parseInt(heroSettings?.mainPhotoArticleId, 10))
        ? Number.parseInt(heroSettings?.mainPhotoArticleId, 10)
        : DEFAULT_COPY.mainPhotoArticleId,
    };
    const newForm = {
      headline: resolved.headline,
      shockLabel: resolved.shockLabel,
      ctaLabel: resolved.ctaLabel,
      headlineBoardText: resolved.headlineBoardText || DEFAULT_COPY.headlineBoardText,
      heroTitleScale: normalizeHeroTitleScale(resolved.heroTitleScale),
      caption1: resolved.captions[0],
      caption2: resolved.captions[1],
      caption3: resolved.captions[2],
      mainPhotoArticleId: resolved.mainPhotoArticleId ? String(resolved.mainPhotoArticleId) : '',
      photoArticleId1: resolved.photoArticleIds[0] ? String(resolved.photoArticleIds[0]) : '',
      photoArticleId2: resolved.photoArticleIds[1] ? String(resolved.photoArticleIds[1]) : '',
    };
    setCopyForm(newForm);
    initialCopyRef.current = newForm;
  }, [heroSettings]);

  // Load revision history
  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    loadHeroSettingsRevisions()
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Грешка при зареждане на Hero историята');
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => { cancelled = true; };
  }, [loadHeroSettingsRevisions]);

  // Dirty tracking
  const isCopyDirty = useMemo(() => {
    const ref = initialCopyRef.current;
    return ref.headline !== copyForm.headline || ref.shockLabel !== copyForm.shockLabel
      || ref.ctaLabel !== copyForm.ctaLabel || ref.headlineBoardText !== copyForm.headlineBoardText
      || ref.heroTitleScale !== copyForm.heroTitleScale
      || ref.caption1 !== copyForm.caption1 || ref.caption2 !== copyForm.caption2
      || ref.caption3 !== copyForm.caption3 || ref.mainPhotoArticleId !== copyForm.mainPhotoArticleId
      || ref.photoArticleId1 !== copyForm.photoArticleId1 || ref.photoArticleId2 !== copyForm.photoArticleId2;
  }, [copyForm]);

  // Unsaved changes warning
  useEffect(() => {
    if (!isCopyDirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isCopyDirty]);

  // Memos
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
  const headlineBoardWords = (copyForm.headlineBoardText || DEFAULT_COPY.headlineBoardText).trim().split(/\s+/).filter(Boolean);
  const previewHeroTitleScale = normalizeHeroTitleScale(copyForm.heroTitleScale);
  const previewHeroTitleFontSize = buildScaledClamp('2rem', '5vw', '4rem', previewHeroTitleScale);

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

  const validationEntries = useMemo(() => {
    const errors = [];
    if (!String(copyForm.headline || '').trim()) errors.push(['headline', 'Headline текстът е задължителен.']);
    if (!String(copyForm.headlineBoardText || '').trim()) errors.push(['headlineBoardText', 'Headline board текстът е задължителен.']);
    if (!String(copyForm.caption1 || '').trim()) errors.push(['caption1', 'Първият caption е задължителен.']);
    if (!String(copyForm.caption2 || '').trim()) errors.push(['caption2', 'Вторият caption е задължителен.']);
    if (!String(copyForm.caption3 || '').trim()) errors.push(['caption3', 'Третият caption е задължителен.']);
    if (!String(copyForm.shockLabel || '').trim()) errors.push(['shockLabel', 'Starburst текстът е задължителен.']);
    if (!String(copyForm.ctaLabel || '').trim()) errors.push(['ctaLabel', 'CTA текстът е задължителен.']);

    const selectedPhotoIds = [
      copyForm.mainPhotoArticleId,
      copyForm.photoArticleId1,
      copyForm.photoArticleId2,
    ]
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (new Set(selectedPhotoIds).size !== selectedPhotoIds.length) {
      errors.push(['photos', 'Избери различни статии за Hero снимките.']);
    }

    return errors;
  }, [copyForm]);

  const validationMessages = useMemo(() => Object.fromEntries(validationEntries), [validationEntries]);

  // Handlers
  const setHero = async (articleId) => {
    setSavingId(articleId);
    setError('');
    try {
      const currentlyHero = articles.filter(a => a.hero && a.id !== articleId);
      await Promise.all([
        ...currentlyHero.map(a => updateArticle(a.id, { hero: false })),
        updateArticle(articleId, { hero: true, status: 'published' }),
      ]);
      toast.success('Hero статията е зададена');
    } catch (e) {
      setError(e?.message || 'Грешка при запазване на Hero статията');
      toast.error('Грешка при задаване на Hero');
    } finally {
      setSavingId(null);
    }
  };

  const clearHero = async () => {
    const currentlyHero = articles.filter(a => a.hero);
    if (currentlyHero.length === 0) return;
    setClearing(true);
    setError('');
    try {
      await Promise.all(currentlyHero.map(a => updateArticle(a.id, { hero: false })));
      toast.success('Hero статията е премахната');
    } catch (e) {
      setError(e?.message || 'Грешка при премахване на Hero статията');
      toast.error('Грешка при премахване');
    } finally {
      setClearing(false);
    }
  };

  const saveCopy = async () => {
    setError('');
    if (validationEntries.length > 0) {
      focusValidationField(validationEntries[0][0]);
      return;
    }
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
        heroTitleScale: normalizeHeroTitleScale(copyForm.heroTitleScale),
        captions: [copyForm.caption1, copyForm.caption2, copyForm.caption3],
        mainPhotoArticleId,
        photoArticleIds,
      });
      initialCopyRef.current = { ...copyForm };
      toast.success('Hero настройките са запазени');
    } catch (e) {
      setError(e?.message || 'Грешка при запазване на Hero настройките');
      toast.error('Грешка при запис');
    } finally {
      setSavingCopy(false);
    }
  };

  const handleRestoreHistory = async (revisionId) => {
    if (!revisionId) return;
    if (!confirm('Да върна тази Hero версия? Текущите незапазени промени ще бъдат заменени.')) return;
    setRestoringHistory(revisionId);
    setError('');
    try {
      await restoreHeroSettingsRevision(revisionId);
      toast.success('Hero версията е възстановена');
    } catch (e) {
      setError(e?.message || 'Грешка при възстановяване на Hero версия');
      toast.error('Грешка при възстановяване');
    } finally {
      setRestoringHistory(null);
    }
  };

  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';
  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';

  const registerFieldRef = (field) => (node) => {
    if (node) fieldRefs.current.set(field, node);
    else fieldRefs.current.delete(field);
  };

  const focusValidationField = (field) => {
    const node = fieldRefs.current.get(field);
    if (!node) return;
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const target = typeof node.focus === 'function' && node.tabIndex >= 0
      ? node
      : node.querySelector?.('input, select, textarea, button, [tabindex]');
    if (target && typeof target.focus === 'function') {
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  };

  const getFieldError = (field) => validationMessages[field] || '';
  const getInputClassName = (field, className = inputCls) => (
    getFieldError(field) ? `${className} !border-red-400 bg-red-50/30` : className
  );
  const clearCopyError = () => {
    if (error) setError('');
  };
  const updateCopyField = (field, value) => {
    clearCopyError();
    setCopyForm((prev) => ({ ...prev, [field]: value }));
  };

  // Headline for demo
  const headlineLines = (copyForm.headline || DEFAULT_COPY.headline).split('\n').filter(Boolean);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Hero секция</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Управлявай водещата секция на началната страница</p>
        </div>
        <div className="flex gap-2">
          {isCopyDirty && (
            <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-sans font-semibold text-amber-600 bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" /> Има незапазени промени
            </span>
          )}
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

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {validationEntries.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert" aria-live="polite">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <ul className="space-y-1">
            {validationEntries.map(([field, message]) => (
              <li key={field}>
                <button
                  type="button"
                  onClick={() => focusValidationField(field)}
                  className="text-left hover:underline underline-offset-2"
                >
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Current Hero status */}
      <div className="bg-white border border-gray-200 p-5 mb-6">
        <p className={labelCls}>Текущ Hero</p>
        {heroArticle ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {heroArticle.image && (
                <img src={heroArticle.image} alt="" className="w-16 h-10 object-cover border border-gray-100 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-sans font-bold text-gray-900 truncate">{heroArticle.title}</p>
                <p className="text-xs font-sans text-gray-500 mt-0.5">
                  {categoryMap.get(heroArticle.category) || heroArticle.category} · {authorMap.get(heroArticle.authorId) || 'Неизвестен'} · {heroArticle.date}
                </p>
              </div>
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
            Няма избрана hero статия. Ще се ползва: {' '}
            <span className="font-semibold text-gray-700">{fallbackHero?.title || 'няма налични публикации'}</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 2-COLUMN LAYOUT: Form (left) + Live Preview (right) */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 mb-6">
        {/* LEFT: Form */}
        <div className="bg-white border border-gray-200 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-sans font-semibold text-gray-900">Hero текстове и снимки</h2>
              <p className="text-xs font-sans text-gray-500 mt-0.5">Редактирай надписи и избери кои снимки/статии да се показват</p>
            </div>
            <button
              onClick={saveCopy}
              disabled={savingCopy}
              aria-busy={savingCopy}
              className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50"
            >
              {savingCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingCopy ? 'Запис...' : 'Запази Hero'}
            </button>
          </div>

          {/* Photo selection */}
          <div
            ref={registerFieldRef('photos')}
            className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50/40 ${getFieldError('photos') ? 'border border-red-300 bg-red-50/40' : 'border border-gray-200'}`}
          >
            <div>
              <label className={labelCls}>Снимка 1 (главна, вляво)</label>
              <select
                value={copyForm.mainPhotoArticleId}
                onChange={(e) => updateCopyField('mainPhotoArticleId', e.target.value)}
                className={getInputClassName('photos')}
                aria-invalid={Boolean(getFieldError('photos'))}
                aria-describedby={getFieldError('photos') ? 'hero-photos-error' : undefined}
              >
                <option value="">Автоматично (Hero статия)</option>
                {sortedArticles.map(article => (
                  <option key={`hero-photo-main-${article.id}`} value={String(article.id)} disabled={copyForm.photoArticleId1 === String(article.id) || copyForm.photoArticleId2 === String(article.id)}>
                    {article.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Снимка 2 (горе вдясно)</label>
              <select
                value={copyForm.photoArticleId1}
                onChange={(e) => updateCopyField('photoArticleId1', e.target.value)}
                className={getInputClassName('photos')}
                aria-invalid={Boolean(getFieldError('photos'))}
                aria-describedby={getFieldError('photos') ? 'hero-photos-error' : undefined}
              >
                <option value="">Автоматично</option>
                {sortedArticles.map(article => (
                  <option key={`hero-photo-1-${article.id}`} value={String(article.id)} disabled={copyForm.mainPhotoArticleId === String(article.id) || copyForm.photoArticleId2 === String(article.id)}>
                    {article.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Снимка 3 (долу вдясно)</label>
              <select
                value={copyForm.photoArticleId2}
                onChange={(e) => updateCopyField('photoArticleId2', e.target.value)}
                className={getInputClassName('photos')}
                aria-invalid={Boolean(getFieldError('photos'))}
                aria-describedby={getFieldError('photos') ? 'hero-photos-error' : undefined}
              >
                <option value="">Автоматично</option>
                {sortedArticles.map(article => (
                  <option key={`hero-photo-2-${article.id}`} value={String(article.id)} disabled={copyForm.mainPhotoArticleId === String(article.id) || copyForm.photoArticleId1 === String(article.id)}>
                    {article.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {getFieldError('photos') && (
            <p id="hero-photos-error" className="mt-2 text-xs font-sans text-red-700">
              {getFieldError('photos')}
            </p>
          )}

          {/* Text fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div ref={registerFieldRef('headline')} className="md:col-span-2">
              <label className={labelCls}>Голям червен надпис (нов ред с Enter)</label>
              <textarea
                value={copyForm.headline}
                onChange={(e) => updateCopyField('headline', e.target.value)}
                className={getInputClassName('headline', `${inputCls} resize-y h-20`)}
                aria-invalid={Boolean(getFieldError('headline'))}
                aria-describedby={getFieldError('headline') ? 'hero-headline-error' : undefined}
              />
              {getFieldError('headline') && (
                <p id="hero-headline-error" className="mt-1 text-xs font-sans text-red-700">
                  {getFieldError('headline')}
                </p>
              )}
            </div>
            <div ref={registerFieldRef('headlineBoardText')} className="md:col-span-2">
              <label className={labelCls}>Горен board текст (над Hero)</label>
              <input
                value={copyForm.headlineBoardText}
                onChange={(e) => updateCopyField('headlineBoardText', e.target.value)}
                className={getInputClassName('headlineBoardText')}
                aria-invalid={Boolean(getFieldError('headlineBoardText'))}
                aria-describedby={getFieldError('headlineBoardText') ? 'hero-headline-board-error' : undefined}
              />
              {getFieldError('headlineBoardText') && (
                <p id="hero-headline-board-error" className="mt-1 text-xs font-sans text-red-700">
                  {getFieldError('headlineBoardText')}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Размер на голямото заглавие в Hero ({normalizeHeroTitleScale(copyForm.heroTitleScale)}%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={70}
                  max={130}
                  step={5}
                  value={normalizeHeroTitleScale(copyForm.heroTitleScale)}
                  onChange={(e) => {
                    clearCopyError();
                    setCopyForm(prev => ({ ...prev, heroTitleScale: normalizeHeroTitleScale(e.target.value) }));
                  }}
                  className="flex-1 accent-zn-purple"
                />
                <input
                  type="number"
                  min={70}
                  max={130}
                  step={5}
                  value={normalizeHeroTitleScale(copyForm.heroTitleScale)}
                  onChange={(e) => {
                    clearCopyError();
                    setCopyForm(prev => ({ ...prev, heroTitleScale: normalizeHeroTitleScale(e.target.value) }));
                  }}
                  className="w-20 px-2 py-1.5 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple text-center"
                />
              </div>
              <p className="mt-1 text-[11px] font-sans text-gray-500">100% е текущият default. Можеш да намалиш до 70% или увеличиш до 130%.</p>
            </div>
            <div ref={registerFieldRef('caption1')}>
              <label className={labelCls}>Лента върху 1-ва снимка</label>
              <input
                value={copyForm.caption1}
                onChange={(e) => updateCopyField('caption1', e.target.value)}
                className={getInputClassName('caption1')}
                aria-invalid={Boolean(getFieldError('caption1'))}
                aria-describedby={getFieldError('caption1') ? 'hero-caption1-error' : undefined}
              />
              {getFieldError('caption1') && (
                <p id="hero-caption1-error" className="mt-1 text-xs font-sans text-red-700">
                  {getFieldError('caption1')}
                </p>
              )}
            </div>
            <div ref={registerFieldRef('caption2')}>
              <label className={labelCls}>Лента върху 2-ра снимка</label>
              <input
                value={copyForm.caption2}
                onChange={(e) => updateCopyField('caption2', e.target.value)}
                className={getInputClassName('caption2')}
                aria-invalid={Boolean(getFieldError('caption2'))}
                aria-describedby={getFieldError('caption2') ? 'hero-caption2-error' : undefined}
              />
              {getFieldError('caption2') && (
                <p id="hero-caption2-error" className="mt-1 text-xs font-sans text-red-700">
                  {getFieldError('caption2')}
                </p>
              )}
            </div>
            <div ref={registerFieldRef('caption3')}>
              <label className={labelCls}>Лента върху 3-та снимка</label>
              <input
                value={copyForm.caption3}
                onChange={(e) => updateCopyField('caption3', e.target.value)}
                className={getInputClassName('caption3')}
                aria-invalid={Boolean(getFieldError('caption3'))}
                aria-describedby={getFieldError('caption3') ? 'hero-caption3-error' : undefined}
              />
              {getFieldError('caption3') && (
                <p id="hero-caption3-error" className="mt-1 text-xs font-sans text-red-700">
                  {getFieldError('caption3')}
                </p>
              )}
            </div>
            <div ref={registerFieldRef('shockLabel')}>
              <label className={labelCls}>Starburst текст</label>
              <input
                value={copyForm.shockLabel}
                onChange={(e) => updateCopyField('shockLabel', e.target.value)}
                className={getInputClassName('shockLabel')}
                aria-invalid={Boolean(getFieldError('shockLabel'))}
                aria-describedby={getFieldError('shockLabel') ? 'hero-shock-label-error' : undefined}
              />
              {getFieldError('shockLabel') && (
                <p id="hero-shock-label-error" className="mt-1 text-xs font-sans text-red-700">
                  {getFieldError('shockLabel')}
                </p>
              )}
            </div>
            <div ref={registerFieldRef('ctaLabel')} className="md:col-span-2">
              <label className={labelCls}>CTA текст (долу)</label>
              <input
                value={copyForm.ctaLabel}
                onChange={(e) => updateCopyField('ctaLabel', e.target.value)}
                className={getInputClassName('ctaLabel')}
                aria-invalid={Boolean(getFieldError('ctaLabel'))}
                aria-describedby={getFieldError('ctaLabel') ? 'hero-cta-label-error' : undefined}
              />
              {getFieldError('ctaLabel') && (
                <p id="hero-cta-label-error" className="mt-1 text-xs font-sans text-red-700">
                  {getFieldError('ctaLabel')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Mini preview + Revisions */}
        <div className="space-y-4">
          {/* Mini layout preview */}
          <div className="bg-white border border-gray-200 p-4">
            <p className={labelCls}>Преглед на снимки</p>
            {previewPhotoArticles.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {previewPhotoArticles.map((item, index) => (
                  <div key={`mini-preview-${item.id}-${index}`} className="border border-gray-200 bg-gray-50 p-1.5">
                    <div className="aspect-[4/3] overflow-hidden border border-gray-100 mb-1">
                      <img
                        src={item.image || heroPreviewFallbackImage}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = heroPreviewFallbackImage; }}
                      />
                    </div>
                    <p className="text-[9px] font-sans font-semibold text-gray-700 truncate">{item.title}</p>
                    <p className="text-[8px] font-sans text-zn-hot truncate mt-0.5">
                      {index === 0 ? copyForm.caption1 : index === 1 ? copyForm.caption2 : copyForm.caption3}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-sans text-gray-400 py-4 text-center">Няма статии за preview</p>
            )}
          </div>

          {/* Headline board preview */}
          <div className="bg-white border border-gray-200 p-4">
            <p className={labelCls}>Headline Board</p>
            <div className="comic-headline-board inline-flex flex-wrap">
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

          {/* Ticker preview */}
          <div className="bg-white border border-gray-200 overflow-hidden">
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

          {/* Revisions */}
          <div className="bg-white border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                <History className="w-3.5 h-3.5" />
                Hero revisions
              </div>
              <button
                onClick={async () => {
                  setLoadingHistory(true);
                  setError('');
                  try { await loadHeroSettingsRevisions(); }
                  catch (e) { setError(e?.message || 'Грешка при зареждане'); }
                  finally { setLoadingHistory(false); }
                }}
                className="text-xs font-sans font-semibold text-zn-purple hover:text-zn-purple-dark transition-colors"
              >
                Обнови
              </button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {loadingHistory && <p className="text-xs font-sans text-gray-400 py-2">Зареждане на версии...</p>}
              {!loadingHistory && heroSettingsRevisions.slice(0, 15).map((revision) => (
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
                <p className="text-xs font-sans text-gray-400 py-2">Няма запазени версии.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* LIVE HERO DEMO — shows exactly how it looks on the site */}
      {/* ═══════════════════════════════════════ */}
      {previewHeroArticle && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-sans font-semibold text-gray-900">Демо — как изглежда на сайта</h2>
            <span className="text-[10px] font-sans text-gray-400">(live preview при промяна)</span>
          </div>
          <div className="border-2 border-dashed border-gray-300 overflow-hidden bg-white">
            {/* Actual hero rendering */}
            <div className="newspaper-page relative comic-panel comic-dots hero-sunset-bg">
              <div className="h-3 bg-gradient-to-r from-red-700 via-red-600 to-orange-500 border-y-2 border-black/30" />
              <div className="px-5 md:px-10 pt-6 pb-8 relative z-[1]">
                {/* Breaking + category */}
                <div className="flex items-center gap-3 mb-3">
                  {previewHeroArticle.breaking && (
                    <span className="breaking-badge flex items-center gap-1.5 text-xs">
                      <Flame className="w-3.5 h-3.5" /> ИЗВЪНРЕДНО
                    </span>
                  )}
                  {categoryMap.get(previewHeroArticle.category) && (
                    <span className="comic-kicker">{categoryMap.get(previewHeroArticle.category)}</span>
                  )}
                </div>

                {/* Title */}
                <div className="flex items-start gap-3 mb-4">
                  <Megaphone className="hidden md:inline-block mt-2 w-10 h-10 text-zn-hot" style={{ filter: 'drop-shadow(3px 3px 0 rgba(0,0,0,0.3))', transform: 'rotate(-10deg)' }} />
                  <h1 className="flex-1 min-w-0 font-display font-black uppercase leading-[0.88]" style={{ fontSize: previewHeroTitleFontSize, textShadow: '3px 3px 0 rgba(204,10,26,0.25), 5px 5px 0 rgba(0,0,0,0.15)', letterSpacing: '-0.03em' }}>
                    {previewHeroArticle.title.split(' ').map((word, i) => (
                      <span key={i} style={{ color: i % 3 === 0 ? '#CC0A1A' : '#1C1428', WebkitTextStroke: i % 3 === 0 ? '1px rgba(153,8,19,0.3)' : 'none' }}>
                        {word}{' '}
                      </span>
                    ))}
                  </h1>
                  <div className="h-1.5 w-32 bg-gradient-to-r from-red-600 to-orange-500 mt-2 mb-1" />
                </div>

                {/* Excerpt */}
                <p className="font-sans text-base md:text-lg mb-3 leading-relaxed text-zn-text-dim">{previewHeroArticle.excerpt}</p>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs font-display text-zn-text-dim uppercase tracking-wider mb-6">
                  <span className="font-black text-zn-hot">{authorMap.get(previewHeroArticle.authorId) || 'Неизвестен'}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {previewHeroArticle.readTime || 3} мин</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {(previewHeroArticle.views || 0).toLocaleString()}</span>
                  <span>{previewHeroArticle.date}</span>
                </div>

                {/* Photos row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                  {previewPhotoArticles[0] && (
                    <div className="polaroid-thick relative" style={{ '--tilt': '-2deg' }}>
                      <div className="tape tape-tl" />
                      <div className="tape tape-tr" />
                      <div className="relative overflow-hidden" style={{ height: '220px' }}>
                        <img
                          src={previewPhotoArticles[0].image || heroPreviewFallbackImage}
                          alt={previewPhotoArticles[0].title}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = heroPreviewFallbackImage; }}
                        />
                        <div className="photo-caption">{copyForm.caption1}</div>
                      </div>
                    </div>
                  )}
                  {previewPhotoArticles[1] && (
                    <div className="polaroid-thick relative" style={{ '--tilt': '2deg' }}>
                      <div className="tape tape-tl" />
                      <div className="relative overflow-hidden" style={{ height: '220px' }}>
                        <img
                          src={previewPhotoArticles[1].image || heroPreviewFallbackImage}
                          alt={previewPhotoArticles[1].title}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = heroPreviewFallbackImage; }}
                        />
                        <div className="photo-caption">{copyForm.caption2}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Headline + 3rd photo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h2 className="section-header-red text-2xl md:text-3xl lg:text-4xl mb-4 leading-tight">
                      {headlineLines.map((line, index) => (
                        <span key={`${line}-${index}`}>
                          {line}
                          {index < headlineLines.length - 1 && <br />}
                        </span>
                      ))}
                    </h2>
                    <div className="space-y-3 mb-5">
                      <p className="red-dot font-sans text-sm md:text-base leading-relaxed">{previewHeroArticle.excerpt}</p>
                      {previewPhotoArticles[1] && <p className="red-dot font-sans text-sm md:text-base leading-relaxed">{previewPhotoArticles[1].excerpt}</p>}
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute -top-5 -right-3 z-30">
                      <div className="starburst text-base md:text-lg" style={{ padding: '14px 18px' }}>{copyForm.shockLabel}</div>
                    </div>
                    {previewPhotoArticles[2] && (
                      <div className="polaroid-thick relative" style={{ '--tilt': '-1deg' }}>
                        <div className="tape tape-tr" />
                        <div className="relative overflow-hidden" style={{ height: '200px' }}>
                          <img
                            src={previewPhotoArticles[2].image || heroPreviewFallbackImage}
                            alt={previewPhotoArticles[2].title}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = heroPreviewFallbackImage; }}
                          />
                          <div className="photo-caption">{copyForm.caption3}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="block text-center">
                  <span
                    className="inline-block section-header-red text-2xl md:text-4xl tracking-wider"
                    style={{ textShadow: '3px 3px 0 rgba(153,8,19,0.3), 5px 5px 0 rgba(0,0,0,0.1)' }}
                  >
                    {copyForm.ctaLabel}
                  </span>
                </div>
              </div>
              <div className="h-3 bg-gradient-to-r from-orange-500 via-red-600 to-red-700 border-y-2 border-black/30" />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* Article picker list */}
      {/* ═══════════════════════════════════════ */}
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
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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
