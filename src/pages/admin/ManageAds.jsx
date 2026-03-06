import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Pencil, Trash2, X, Save, ExternalLink, ImageIcon, AlertTriangle, Loader2, Eye } from 'lucide-react';
import AdminImageField from '../../components/admin/AdminImageField';
import { useToast } from '../../components/admin/Toast';
import { AdBannerHorizontal, AdBannerSide, AdBannerInline } from '../../components/AdBanner';
import { AD_PAGE_TYPES, AD_SLOT_DEFINITIONS, AD_STATUS_OPTIONS } from '../../../shared/adSlots.js';
import { normalizeAdRecord } from '../../../shared/adResolver.js';
import { api } from '../../utils/api';

const AD_TYPES = [
  { value: 'horizontal', label: 'Хоризонтален банер' },
  { value: 'side', label: 'Sidebar банер' },
  { value: 'inline', label: 'Inline банер' },
];

const AD_TYPE_LABELS = Object.freeze(
  AD_TYPES.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {})
);

const AD_STATUS_LABELS = Object.freeze({
  draft: 'Чернова',
  active: 'Активна',
  paused: 'Пауза',
  archived: 'Архив',
});

const AD_IMAGE_PLACEMENTS = [
  { value: 'circle', label: 'Икона / кръг' },
  { value: 'cover', label: 'Cover background' },
];

const AD_ICONS = ['📢', '🚓', '🧾', '🍔', '🎧', '🏦', '📱', '⚡', '🎯', '🛠️', '🏁', '🎮', '💼', '🚗', '🛡️', '🏠'];

const PAGE_TYPE_LABELS = Object.freeze({
  home: 'Начална',
  article: 'Статия',
  category: 'Категория',
});

const emptyForm = {
  campaignName: '',
  title: '',
  subtitle: '',
  cta: 'Научи повече',
  type: 'horizontal',
  status: 'active',
  icon: '📢',
  link: '#',
  color: '#990F3D',
  image: '',
  imagePlacement: 'circle',
  placements: [],
  pageTypes: [],
  categoryIds: [],
  articleIdsInput: '',
  excludeArticleIdsInput: '',
  excludeCategoryIdsInput: '',
  priority: 0,
  weight: 1,
  startAt: '',
  endAt: '',
  notes: '',
};

function parseNumericCsv(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((item) => Number.isInteger(item) && item > 0)
  )];
}

function parseStringCsv(value) {
  return [...new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  )];
}

function formatNumericCsv(values) {
  return (Array.isArray(values) ? values : []).join(', ');
}

function formatStringCsv(values) {
  return (Array.isArray(values) ? values : []).join(', ');
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offsetMs = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
}

function buildPayloadFromForm(form) {
  return {
    campaignName: String(form.campaignName || '').trim(),
    title: String(form.title || '').trim(),
    subtitle: String(form.subtitle || '').trim(),
    cta: String(form.cta || '').trim(),
    type: form.type || 'horizontal',
    status: form.status || 'active',
    icon: String(form.icon || '').trim(),
    link: String(form.link || '').trim(),
    color: String(form.color || '').trim(),
    image: String(form.image || '').trim(),
    imagePlacement: form.imagePlacement === 'cover' ? 'cover' : 'circle',
    placements: Array.isArray(form.placements) ? form.placements : [],
    targeting: {
      pageTypes: Array.isArray(form.pageTypes) ? form.pageTypes : [],
      articleIds: parseNumericCsv(form.articleIdsInput),
      categoryIds: Array.isArray(form.categoryIds) ? form.categoryIds : [],
      excludeArticleIds: parseNumericCsv(form.excludeArticleIdsInput),
      excludeCategoryIds: parseStringCsv(form.excludeCategoryIdsInput),
    },
    priority: Number.parseInt(form.priority, 10) || 0,
    weight: Math.max(1, Number.parseInt(form.weight, 10) || 1),
    startAt: form.startAt || null,
    endAt: form.endAt || null,
    notes: String(form.notes || '').trim(),
  };
}

function normalizeAdForm(value) {
  const normalized = normalizeAdRecord(value || {});
  return {
    ...emptyForm,
    ...normalized,
    campaignName: normalized.campaignName || '',
    title: normalized.title || '',
    subtitle: normalized.subtitle || '',
    cta: normalized.cta || 'Научи повече',
    icon: normalized.icon || '📢',
    link: normalized.link || '#',
    color: normalized.color || '#990F3D',
    image: normalized.image || '',
    imagePlacement: normalized.imagePlacement === 'cover' ? 'cover' : 'circle',
    placements: Array.isArray(normalized.placements) ? normalized.placements : [],
    pageTypes: Array.isArray(normalized.targeting?.pageTypes) ? normalized.targeting.pageTypes : [],
    categoryIds: Array.isArray(normalized.targeting?.categoryIds) ? normalized.targeting.categoryIds : [],
    articleIdsInput: formatNumericCsv(normalized.targeting?.articleIds),
    excludeArticleIdsInput: formatNumericCsv(normalized.targeting?.excludeArticleIds),
    excludeCategoryIdsInput: formatStringCsv(normalized.targeting?.excludeCategoryIds),
    priority: normalized.priority ?? 0,
    weight: normalized.weight ?? 1,
    startAt: toDateTimeLocal(normalized.startAt),
    endAt: toDateTimeLocal(normalized.endAt),
    notes: normalized.notes || '',
  };
}

function summarizeTargeting(ad, categoriesById, articlesById) {
  const chunks = [];
  if (ad.targeting?.pageTypes?.length) {
    chunks.push(ad.targeting.pageTypes.map((item) => PAGE_TYPE_LABELS[item] || item).join(', '));
  }
  if (ad.targeting?.categoryIds?.length) {
    chunks.push(`Категории: ${ad.targeting.categoryIds.map((id) => categoriesById.get(id)?.name || id).join(', ')}`);
  }
  if (ad.targeting?.articleIds?.length) {
    chunks.push(`Статии: ${ad.targeting.articleIds.map((id) => articlesById.get(id)?.title || `#${id}`).join(', ')}`);
  }
  if (chunks.length === 0) return 'Глобална реклама';
  return chunks.join(' • ');
}

function PreviewBanner({ ad }) {
  if (ad.type === 'side') return <AdBannerSide ad={ad} />;
  if (ad.type === 'inline') return <AdBannerInline ad={ad} />;
  return <AdBannerHorizontal ad={ad} />;
}

export default function ManageAds() {
  const { ads, categories, articles, addAd, updateAd, deleteAd } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [analyticsSummary, setAnalyticsSummary] = useState({
    items: [],
    totals: { impressions: 0, clicks: 0, ctr: 0 },
    days: 30,
    loading: true,
    error: '',
  });
  const toast = useToast();

  const normalizedAds = useMemo(
    () => (Array.isArray(ads) ? ads : []).map((ad) => normalizeAdRecord(ad)).sort((left, right) => (right.priority || 0) - (left.priority || 0) || (right.id || 0) - (left.id || 0)),
    [ads]
  );
  const analyticsByAdId = useMemo(
    () => new Map((Array.isArray(analyticsSummary.items) ? analyticsSummary.items : []).map((item) => [Number(item.adId), item])),
    [analyticsSummary.items]
  );
  const categoriesById = useMemo(
    () => new Map((Array.isArray(categories) ? categories : []).map((category) => [category.id, category])),
    [categories]
  );
  const articlesById = useMemo(
    () => new Map((Array.isArray(articles) ? articles : []).map((article) => [Number(article.id), article])),
    [articles]
  );
  const slotGroups = useMemo(() => {
    return AD_PAGE_TYPES.map((pageType) => ({
      pageType,
      slots: AD_SLOT_DEFINITIONS.filter((slot) => slot.pageType === pageType),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAnalyticsSummary((prev) => ({ ...prev, loading: true, error: '' }));

    api.ads.getAnalyticsSummary(30)
      .then((summary) => {
        if (cancelled) return;
        setAnalyticsSummary({
          items: Array.isArray(summary?.items) ? summary.items : [],
          totals: summary?.totals || { impressions: 0, clicks: 0, ctr: 0 },
          days: Number(summary?.days) || 30,
          loading: false,
          error: '',
        });
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setAnalyticsSummary((prev) => ({
          ...prev,
          loading: false,
          error: fetchError?.message || 'Analytics unavailable',
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedAds.length]);

  const draftPayload = useMemo(() => buildPayloadFromForm(form), [form]);
  const selectedSlots = useMemo(
    () => AD_SLOT_DEFINITIONS.filter((slot) => draftPayload.placements.includes(slot.id)),
    [draftPayload.placements]
  );
  const previewAd = useMemo(
    () => normalizeAdRecord({ ...draftPayload, id: editing || 'preview' }),
    [draftPayload, editing]
  );
  const selectedArticleIds = useMemo(() => parseNumericCsv(form.articleIdsInput), [form.articleIdsInput]);
  const validationErrors = useMemo(() => {
    const nextErrors = [];
    if (!draftPayload.title) nextErrors.push('Заглавието е задължително.');
    if (!draftPayload.cta) nextErrors.push('CTA текстът е задължителен.');
    if (!draftPayload.link) nextErrors.push('Линкът е задължителен.');
    if (!draftPayload.placements.length) nextErrors.push('Избери поне една позиция.');
    if (draftPayload.startAt && draftPayload.endAt && new Date(draftPayload.startAt).getTime() > new Date(draftPayload.endAt).getTime()) {
      nextErrors.push('Началната дата трябва да е преди крайната.');
    }
    if (draftPayload.targeting.articleIds.length > 0 && !selectedSlots.some((slot) => slot.supportsArticleTargeting)) {
      nextErrors.push('Избраните позиции не поддържат article targeting.');
    }
    if (draftPayload.targeting.categoryIds.length > 0 && !selectedSlots.some((slot) => slot.supportsCategoryTargeting)) {
      nextErrors.push('Избраните позиции не поддържат category targeting.');
    }
    return nextErrors;
  }, [draftPayload, selectedSlots]);

  const handleToggle = (field, value) => {
    setForm((prev) => {
      const nextValues = new Set(prev[field] || []);
      if (nextValues.has(value)) nextValues.delete(value);
      else nextValues.add(value);
      return { ...prev, [field]: [...nextValues] };
    });
  };

  const handleSave = async () => {
    setError('');
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setSaving(true);
    try {
      if (editing === 'new') {
        await addAd(draftPayload);
        toast.success('Рекламата е създадена');
      } else {
        await updateAd(editing, draftPayload);
        toast.success('Рекламата е обновена');
      }
      setEditing(null);
      setForm({ ...emptyForm });
    } catch (e) {
      const message = e?.message || 'Проблем при запис на рекламата';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Сигурен ли си, че искаш да изтриеш рекламата?')) return;
    setError('');
    try {
      await deleteAd(id);
      toast.success('Рекламата е изтрита');
    } catch (e) {
      const message = e?.message || 'Проблем при изтриване на рекламата';
      setError(message);
      toast.error(message);
    }
  };

  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';
  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Реклами</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Slot-based реклами с targeting по страница, категория и статия</p>
          <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-sans text-gray-600">
            <span className="px-2 py-1 bg-gray-100 border border-gray-200">Analytics {analyticsSummary.days}d</span>
            <span className="px-2 py-1 bg-gray-100 border border-gray-200">Impressions: {analyticsSummary.loading ? '...' : analyticsSummary.totals.impressions}</span>
            <span className="px-2 py-1 bg-gray-100 border border-gray-200">Clicks: {analyticsSummary.loading ? '...' : analyticsSummary.totals.clicks}</span>
            <span className="px-2 py-1 bg-gray-100 border border-gray-200">CTR: {analyticsSummary.loading ? '...' : `${analyticsSummary.totals.ctr}%`}</span>
          </div>
          {analyticsSummary.error && (
            <p className="text-xs font-sans text-amber-700 mt-2">Analytics: {analyticsSummary.error}</p>
          )}
        </div>
        <button
          onClick={() => { setError(''); setEditing('new'); setForm({ ...emptyForm }); }}
          className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Нова реклама
        </button>
      </div>

      {(error || validationErrors.length > 0) && (
        <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            {error && <div>{error}</div>}
            {!error && validationErrors.map((item) => <div key={item}>{item}</div>)}
          </div>
        </div>
      )}

      {editing && (
        <div className="mb-8 grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-6">
          <div className="bg-white border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="font-sans font-semibold text-gray-900">{editing === 'new' ? 'Нова реклама' : 'Редакция на реклама'}</h2>
              <p className="text-xs font-sans text-gray-500 mt-1">Позициониране, targeting и scheduling се записват директно в рекламата.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Campaign</label>
                <input className={inputCls} value={form.campaignName} onChange={(e) => setForm({ ...form, campaignName: e.target.value })} placeholder="Spring launch" />
              </div>
              <div>
                <label className={labelCls}>Статус</label>
                <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {AD_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{AD_STATUS_LABELS[status] || status}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Заглавие</label>
                <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Име на рекламата" />
              </div>
              <div>
                <label className={labelCls}>Подзаглавие</label>
                <input className={inputCls} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Кратък текст" />
              </div>
              <div>
                <label className={labelCls}>CTA</label>
                <input className={inputCls} value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} placeholder="Научи повече" />
              </div>
              <div>
                <label className={labelCls}>Тип банер</label>
                <select className={inputCls} value={form.type} onChange={(e) => { const nextType = e.target.value; setForm((prev) => ({ ...prev, type: nextType, placements: prev.placements.filter((slotId) => AD_SLOT_DEFINITIONS.find((slot) => slot.id === slotId)?.variant === nextType) })); }} >
                  {AD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Линк</label>
                <input className={inputCls} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://example.com" />
              </div>
              <div>
                <label className={labelCls}>Цвят</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-10 border border-gray-200 cursor-pointer" />
                  <input className={`${inputCls} flex-1`} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Икона</label>
                <div className="flex flex-wrap gap-1.5">
                  {AD_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setForm({ ...form, icon })}
                      className={`w-10 h-10 text-xl flex items-center justify-center border transition-colors ${form.icon === icon ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <AdminImageField
                  label="Изображение"
                  value={form.image}
                  onChange={(nextValue) => setForm((prev) => ({ ...prev, image: nextValue }))}
                  helperText="Незадължително. Ако има cover image, банерът използва него като фон."
                  previewClassName="h-36"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Режим на изображение</label>
                <select className={inputCls} value={form.imagePlacement} onChange={(e) => setForm({ ...form, imagePlacement: e.target.value })}>
                  {AD_IMAGE_PLACEMENTS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-4 border-t border-gray-200 pt-5">
              <div>
                <h3 className="font-sans font-semibold text-gray-900">Позиции</h3>
                <p className="text-xs font-sans text-gray-500 mt-1">Избери точно в кои slot-ове може да се показва тази реклама.</p>
              </div>
              <div className="space-y-4">
                {slotGroups.map((group) => (
                  <div key={group.pageType} className="border border-gray-200 rounded-sm p-4">
                    <p className="text-xs font-sans font-bold uppercase tracking-wider text-gray-500 mb-3">{PAGE_TYPE_LABELS[group.pageType]}</p>
                    <div className="space-y-2">
                      {group.slots.map((slot) => {
                        const checked = form.placements.includes(slot.id);
                        const disabled = slot.variant !== form.type;
                        return (
                          <label key={slot.id} className={`flex items-start gap-3 p-3 border rounded-sm ${checked ? 'border-zn-purple bg-zn-purple/5' : 'border-gray-200'} ${disabled ? 'opacity-40' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => handleToggle('placements', slot.id)}
                              className="mt-1"
                            />
                            <span>
                              <span className="block text-sm font-sans font-semibold text-gray-900">{slot.label}</span>
                              <span className="block text-xs text-gray-500">{slot.description}</span>
                              <span className="block text-[11px] text-gray-400 mt-1">Тип: {AD_TYPE_LABELS[slot.variant]}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t border-gray-200 pt-5">
              <div>
                <h3 className="font-sans font-semibold text-gray-900">Targeting</h3>
                <p className="text-xs font-sans text-gray-500 mt-1">Остави празно за глобална реклама или ограничи по page type, категории и конкретни статии.</p>
              </div>
              <div>
                <label className={labelCls}>Page types</label>
                <div className="flex flex-wrap gap-2">
                  {AD_PAGE_TYPES.map((pageType) => (
                    <button
                      key={pageType}
                      type="button"
                      onClick={() => handleToggle('pageTypes', pageType)}
                      className={`px-3 py-1.5 border text-xs font-sans font-semibold uppercase tracking-wider ${form.pageTypes.includes(pageType) ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}
                    >
                      {PAGE_TYPE_LABELS[pageType]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Категории</label>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(categories) ? categories : [])
                    .filter((category) => category.id !== 'all')
                    .map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleToggle('categoryIds', category.id)}
                        className={`px-3 py-1.5 border text-xs font-sans font-semibold ${form.categoryIds.includes(category.id) ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}
                      >
                        {category.name}
                      </button>
                    ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Article IDs</label>
                  <input className={inputCls} value={form.articleIdsInput} onChange={(e) => setForm({ ...form, articleIdsInput: e.target.value })} placeholder="12, 25, 108" />
                  {selectedArticleIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedArticleIds.map((id) => (
                        <span key={id} className="px-2 py-1 text-[11px] bg-gray-100 text-gray-600 font-sans">
                          #{id} {articlesById.get(id)?.title || 'неоткрита статия'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Exclude article IDs</label>
                  <input className={inputCls} value={form.excludeArticleIdsInput} onChange={(e) => setForm({ ...form, excludeArticleIdsInput: e.target.value })} placeholder="45, 77" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Exclude category IDs</label>
                  <input className={inputCls} value={form.excludeCategoryIdsInput} onChange={(e) => setForm({ ...form, excludeCategoryIdsInput: e.target.value })} placeholder="crime, business" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-200 pt-5">
              <div>
                <label className={labelCls}>Приоритет</label>
                <input type="number" className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Weight</label>
                <input type="number" min="1" className={inputCls} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Start</label>
                <input type="datetime-local" className={inputCls} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>End</label>
                <input type="datetime-local" className={inputCls} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Бележки</label>
                <textarea className={`${inputCls} min-h-[110px]`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Вътрешни бележки за кампанията" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving || validationErrors.length > 0} className="flex items-center gap-2 px-5 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Запис...' : 'Запази'}
              </button>
              <button onClick={() => { setEditing(null); setError(''); }} className="flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors">
                <X className="w-4 h-4" /> Отказ
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">Preview</p>
              </div>
              <div className="newspaper-page bg-[#EDE6DA] p-3 overflow-visible">
                <PreviewBanner ad={previewAd} />
              </div>
              <div className="mt-4 space-y-3 text-xs font-sans text-gray-600">
                <div>
                  <p className="font-semibold text-gray-900">Позиции</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedSlots.length > 0 ? selectedSlots.map((slot) => (
                      <span key={slot.id} className="px-2 py-1 bg-gray-100 border border-gray-200">{slot.label}</span>
                    )) : <span className="text-gray-400">Няма избрани позиции</span>}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Targeting</p>
                  <p>{summarizeTargeting(previewAd, categoriesById, articlesById)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-gray-200 p-2">
                    <div className="text-gray-400 uppercase tracking-wider text-[10px]">Статус</div>
                    <div className="font-semibold text-gray-900">{AD_STATUS_LABELS[previewAd.status] || previewAd.status}</div>
                  </div>
                  <div className="border border-gray-200 p-2">
                    <div className="text-gray-400 uppercase tracking-wider text-[10px]">Приоритет</div>
                    <div className="font-semibold text-gray-900">{previewAd.priority}</div>
                  </div>
                  <div className="border border-gray-200 p-2">
                    <div className="text-gray-400 uppercase tracking-wider text-[10px]">Weight</div>
                    <div className="font-semibold text-gray-900">{previewAd.weight}</div>
                  </div>
                  <div className="border border-gray-200 p-2">
                    <div className="text-gray-400 uppercase tracking-wider text-[10px]">Тип</div>
                    <div className="font-semibold text-gray-900">{AD_TYPE_LABELS[previewAd.type] || previewAd.type}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {normalizedAds.map((ad) => {
          const coverPreview = Boolean(ad.image) && ad.imagePlacement === 'cover';
          const metrics = analyticsByAdId.get(Number(ad.id)) || {
            impressions: 0,
            clicks: 0,
            ctr: 0,
            lastImpressionAt: null,
            lastClickAt: null,
          };
          return (
            <div key={ad.id} className="bg-white border border-gray-200 overflow-hidden group">
              <div className="p-4 text-white relative overflow-hidden" style={{ backgroundColor: coverPreview ? '#1C1428' : (ad.color || '#990F3D') }}>
                {ad.image && (
                  <img
                    src={ad.image}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover ${coverPreview ? 'opacity-100' : 'opacity-30'}`}
                  />
                )}
                {coverPreview && <div className="absolute inset-0 bg-black/45" />}
                <div className="flex items-center gap-2 mb-2 relative z-10">
                  {coverPreview ? (
                    <span className="text-sm px-2 py-0.5 border border-white/40 bg-black/35 font-display font-bold uppercase tracking-wider">ADV</span>
                  ) : (
                    <span className="text-xl">{ad.icon}</span>
                  )}
                  <div>
                    <p className="font-sans font-bold text-sm">{ad.campaignName || ad.title}</p>
                    <p className="text-xs opacity-90">{ad.subtitle}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-[1px] text-xs font-sans font-semibold relative z-10">{ad.cta}</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-sans font-bold uppercase tracking-wider">
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600">{AD_TYPE_LABELS[ad.type] || ad.type}</span>
                  <span className={`px-1.5 py-0.5 ${ad.status === 'active' ? 'bg-green-100 text-green-700' : ad.status === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {AD_STATUS_LABELS[ad.status] || ad.status}
                  </span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700">P {ad.priority}</span>
                  {ad.image && (
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700">
                      <ImageIcon className="w-3 h-3 inline mr-0.5" />media
                    </span>
                  )}
                  {ad.link && ad.link !== '#' && (
                    <a href={ad.link} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-zn-hot">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 mb-1">Позиции</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ad.placements.map((placement) => (
                      <span key={placement} className="px-2 py-1 text-[11px] bg-gray-100 text-gray-600 font-sans">{placement}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 mb-1">Targeting</p>
                  <p className="text-sm font-sans text-gray-600">{summarizeTargeting(ad, categoriesById, articlesById)}</p>
                </div>
                {(ad.startAt || ad.endAt) && (
                  <div className="text-xs font-sans text-gray-500 border-t border-gray-100 pt-2">
                    {ad.startAt && <div>От: {new Date(ad.startAt).toLocaleString('bg-BG')}</div>}
                    {ad.endAt && <div>До: {new Date(ad.endAt).toLocaleString('bg-BG')}</div>}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400 mb-1">Analytics</p>
                  <div className="grid grid-cols-3 gap-2 text-xs font-sans text-gray-600">
                    <div className="border border-gray-200 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">Impressions</div>
                      <div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : metrics.impressions}</div>
                    </div>
                    <div className="border border-gray-200 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">Clicks</div>
                      <div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : metrics.clicks}</div>
                    </div>
                    <div className="border border-gray-200 p-2">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400">CTR</div>
                      <div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : `${metrics.ctr}%`}</div>
                    </div>
                  </div>
                  {(metrics.lastImpressionAt || metrics.lastClickAt) && (
                    <div className="mt-2 text-[11px] font-sans text-gray-500 space-y-1">
                      {metrics.lastImpressionAt && <div>Last impression: {new Date(metrics.lastImpressionAt).toLocaleString('bg-BG')}</div>}
                      {metrics.lastClickAt && <div>Last click: {new Date(metrics.lastClickAt).toLocaleString('bg-BG')}</div>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => { setError(''); setEditing(ad.id); setForm(normalizeAdForm(ad)); }}
                    className="p-1.5 text-gray-400 hover:text-zn-hot transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(ad.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {normalizedAds.length === 0 && (
          <div className="col-span-full text-center py-12 text-sm font-sans text-gray-400">Няма реклами</div>
        )}
      </div>
    </div>
  );
}


