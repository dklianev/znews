import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, ExternalLink, ImageIcon, AlertTriangle, Loader2, Eye, Info } from 'lucide-react';
import { useData } from '../../context/DataContext';
import AdminImageField from '../../components/admin/AdminImageField';
import { useToast } from '../../components/admin/Toast';
import { AdBannerHorizontal, AdBannerSide, AdBannerInline } from '../../components/AdBanner';
import { AD_PAGE_TYPES, AD_SLOT_DEFINITIONS, AD_STATUS_OPTIONS } from '../../../shared/adSlots.js';
import { explainAdResolution, normalizeAdRecord } from '../../../shared/adResolver.js';
import { buildAdSlotOccupancy } from '../../../shared/adOccupancy.js';
import { api } from '../../utils/api';

const AD_TYPES = [
  {
    value: 'horizontal',
    label: '\u0425\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u0435\u043d \u0431\u0430\u043d\u0435\u0440',
    description: '\u0428\u0438\u0440\u043e\u043a \u0444\u043e\u0440\u043c\u0430\u0442 \u0437\u0430 \u0433\u043e\u0440\u043d\u0438, \u0434\u043e\u043b\u043d\u0438 \u0438 \u043c\u0435\u0436\u0434\u0438\u043d\u043d\u0438 \u043f\u043e\u0437\u0438\u0446\u0438\u0438.',
    recommendedSize: '1600 x 400 px',
    minSize: '1200 x 300 px',
    aspectRatio: '4:1',
  },
  {
    value: 'side',
    label: 'Sidebar \u0431\u0430\u043d\u0435\u0440',
    description: '\u0422\u0435\u0441\u0435\u043d \u0444\u043e\u0440\u043c\u0430\u0442 \u0437\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0447\u043d\u0438 \u043f\u043e\u0437\u0438\u0446\u0438\u0438.',
    recommendedSize: '900 x 1200 px',
    minSize: '700 x 933 px',
    aspectRatio: '3:4',
  },
  {
    value: 'inline',
    label: 'Inline \u0431\u0430\u043d\u0435\u0440',
    description: '\u0412\u043b\u0438\u0437\u0430 \u0432\u044a\u0442\u0440\u0435 \u0432 \u0442\u0435\u043a\u0441\u0442\u0430 \u043d\u0430 \u0441\u0442\u0430\u0442\u0438\u044f.',
    recommendedSize: '1200 x 300 px',
    minSize: '960 x 240 px',
    aspectRatio: '4:1',
  },
];
const AD_CIRCLE_IMAGE_SIZE = '800 x 800 px';

const AD_TYPE_LABELS = Object.freeze(AD_TYPES.reduce((acc, item) => ({ ...acc, [item.value]: item.label }), {}));
const AD_STATUS_LABELS = Object.freeze({
  draft: '\u0427\u0435\u0440\u043d\u043e\u0432\u0430',
  active: '\u0410\u043a\u0442\u0438\u0432\u043d\u0430',
  paused: '\u041f\u0430\u0443\u0437\u0430',
  archived: '\u0410\u0440\u0445\u0438\u0432',
});
const PAGE_TYPE_LABELS = Object.freeze({
  home: '\u041d\u0430\u0447\u0430\u043b\u043d\u0430',
  article: '\u0421\u0442\u0430\u0442\u0438\u044f',
  category: '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f',
});
const AD_IMAGE_PLACEMENTS = [
  { value: 'circle', label: '\u0418\u043a\u043e\u043d\u0430 / \u043a\u0440\u044a\u0433' },
  { value: 'cover', label: '\u041f\u044a\u043b\u0435\u043d \u0444\u043e\u043d' },
];
const AD_ICONS = ['\u{1F4F0}', '\u{1F697}', '\u{1F4B8}', '\u{1F3E6}', '\u{1F3AF}', '\u{1F354}', '\u{1F6D2}', '\u{1F525}', '\u{1F3B2}', '\u{1F3B5}', '\u{1F3C6}', '\u{1F4F1}'];
const DELIVERY_RULES = [
  '\u041f\u043e\u0437\u0438\u0446\u0438\u044f\u0442\u0430 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044f \u043a\u044a\u0434\u0435 \u043d\u0430 \u0441\u0430\u0439\u0442\u0430 \u043c\u043e\u0436\u0435 \u0434\u0430 \u0441\u0435 \u043f\u043e\u043a\u0430\u0436\u0435 \u0440\u0435\u043a\u043b\u0430\u043c\u0430\u0442\u0430.',
  '\u041f\u043e-\u0441\u043f\u0435\u0446\u0438\u0444\u0438\u0447\u043d\u0438\u044f\u0442 targeting \u043f\u0435\u0447\u0435\u043b\u0438 \u043d\u0430\u0434 \u043f\u043e-\u0448\u0438\u0440\u043e\u043a\u0438\u044f.',
  '\u041f\u043e-\u0432\u0438\u0441\u043e\u043a\u0438\u044f\u0442 priority \u043f\u0435\u0447\u0435\u043b\u0438 \u043d\u0430\u0434 \u043f\u043e-\u043d\u0438\u0441\u043a\u0438\u044f \u043d\u0430 \u0441\u044a\u0449\u0438\u044f slot.',
  'Weight \u0443\u0447\u0430\u0441\u0442\u0432\u0430 \u0441\u0430\u043c\u043e \u0432 \u0440\u043e\u0442\u0430\u0446\u0438\u044f \u043c\u0435\u0436\u0434\u0443 \u0440\u0430\u0432\u043d\u043e\u0441\u0442\u043e\u0439\u043d\u0438 \u0440\u0435\u043a\u043b\u0430\u043c\u0438.',
];

const emptyForm = {
  campaignName: '',
  title: '',
  subtitle: '',
  cta: '\u0412\u0438\u0436 \u043f\u043e\u0432\u0435\u0447\u0435',
  type: 'horizontal',
  status: 'active',
  icon: '\u{1F4F0}',
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

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-zn-purple';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1';

function parseNumericCsv(value) {
  return [...new Set(String(value || '').split(',').map((item) => Number.parseInt(item.trim(), 10)).filter((item) => Number.isInteger(item) && item > 0))];
}

function parseStringCsv(value) {
  return [...new Set(String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))];
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
    pageTypes: Array.isArray(normalized.targeting?.pageTypes) ? normalized.targeting.pageTypes : [],
    categoryIds: Array.isArray(normalized.targeting?.categoryIds) ? normalized.targeting.categoryIds : [],
    articleIdsInput: formatNumericCsv(normalized.targeting?.articleIds),
    excludeArticleIdsInput: formatNumericCsv(normalized.targeting?.excludeArticleIds),
    excludeCategoryIdsInput: formatStringCsv(normalized.targeting?.excludeCategoryIds),
    startAt: toDateTimeLocal(normalized.startAt),
    endAt: toDateTimeLocal(normalized.endAt),
  };
}

function summarizeTargeting(ad, categoriesById, articlesById) {
  const parts = [];
  if (ad.targeting?.pageTypes?.length) parts.push(`\u0422\u0438\u043f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430: ${ad.targeting.pageTypes.map((item) => PAGE_TYPE_LABELS[item] || item).join(', ')}`);
  if (ad.targeting?.categoryIds?.length) parts.push(`\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438: ${ad.targeting.categoryIds.map((id) => categoriesById.get(id)?.name || id).join(', ')}`);
  if (ad.targeting?.articleIds?.length) parts.push(`\u0421\u0442\u0430\u0442\u0438\u0438: ${ad.targeting.articleIds.map((id) => articlesById.get(id)?.title || `#${id}`).join(', ')}`);
  if (ad.targeting?.excludeArticleIds?.length) parts.push(`\u0418\u0437\u043a\u043b\u044e\u0447\u0438 \u0441\u0442\u0430\u0442\u0438\u0438: ${ad.targeting.excludeArticleIds.map((id) => articlesById.get(id)?.title || `#${id}`).join(', ')}`);
  if (ad.targeting?.excludeCategoryIds?.length) parts.push(`\u0418\u0437\u043a\u043b\u044e\u0447\u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438: ${ad.targeting.excludeCategoryIds.map((id) => categoriesById.get(id)?.name || id).join(', ')}`);
  return parts.join(' | ') || '\u0411\u0435\u0437 \u0434\u043e\u043f\u044a\u043b\u043d\u0438\u0442\u0435\u043b\u043d\u0438 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f.';
}

function buildPreviewContext(slot, previewAd, articlesById) {
  const articleId = slot.supportsArticleTargeting ? (previewAd.targeting?.articleIds?.[0] || null) : null;
  const article = articleId ? articlesById.get(Number(articleId)) : null;
  const categoryId = slot.supportsCategoryTargeting ? (article?.category || previewAd.targeting?.categoryIds?.[0] || '') : '';
  return { slot: slot.id, pageType: slot.pageType, articleId, categoryId, rotationKey: `preview|${slot.id}|${articleId || 'na'}|${categoryId || 'na'}` };
}

function PreviewBanner({ ad }) {
  if (ad.type === 'side') return <AdBannerSide ad={ad} />;
  if (ad.type === 'inline') return <AdBannerInline ad={ad} />;
  return <AdBannerHorizontal ad={ad} />;
}

function formatDateTimeShort(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatScheduleRange(ad) {
  const startLabel = formatDateTimeShort(ad?.startAt);
  const endLabel = formatDateTimeShort(ad?.endAt);
  if (startLabel && endLabel) return `От ${startLabel} до ${endLabel}`;
  if (startLabel) return `От ${startLabel}`;
  if (endLabel) return `До ${endLabel}`;
  return 'Без ограничение във времето';
}

function getAdDisplayName(ad) {
  return ad?.campaignName || ad?.title || `Реклама #${ad?.id ?? 'na'}`;
}
export default function ManageAds() {
  const { ads, categories, articles, addAd, updateAd, deleteAd } = useData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [analyticsSummary, setAnalyticsSummary] = useState({ items: [], totals: { impressions: 0, clicks: 0, ctr: 0 }, days: 30, loading: true, error: '' });
  const toast = useToast();

  const normalizedAds = useMemo(() => (Array.isArray(ads) ? ads : []).map((ad) => normalizeAdRecord(ad)).sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.id || 0) - (a.id || 0)), [ads]);
  const categoriesById = useMemo(() => new Map((Array.isArray(categories) ? categories : []).map((category) => [category.id, category])), [categories]);
  const articlesById = useMemo(() => new Map((Array.isArray(articles) ? articles : []).map((article) => [Number(article.id), article])), [articles]);
  const analyticsByAdId = useMemo(() => new Map((Array.isArray(analyticsSummary.items) ? analyticsSummary.items : []).map((item) => [Number(item.adId), item])), [analyticsSummary.items]);
  const slotOccupancy = useMemo(() => buildAdSlotOccupancy(normalizedAds), [normalizedAds]);
  const occupancyWarningCount = useMemo(() => slotOccupancy.reduce((sum, entry) => sum + entry.warnings.length, 0), [slotOccupancy]);

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
        setAnalyticsSummary((prev) => ({ ...prev, loading: false, error: fetchError?.message || 'Analytics unavailable' }));
      });
    return () => { cancelled = true; };
  }, [normalizedAds.length]);

  const draftPayload = useMemo(() => buildPayloadFromForm(form), [form]);
  const selectedTypeMeta = useMemo(() => AD_TYPES.find((item) => item.value === form.type) || AD_TYPES[0], [form.type]);
  const selectedSlots = useMemo(() => AD_SLOT_DEFINITIONS.filter((slot) => draftPayload.placements.includes(slot.id)), [draftPayload.placements]);
  const previewAd = useMemo(() => normalizeAdRecord({ ...draftPayload, id: editing || 'preview' }), [draftPayload, editing]);
  const selectedArticleIds = useMemo(() => parseNumericCsv(form.articleIdsInput), [form.articleIdsInput]);
  const imageHelperText = useMemo(() => (
    form.imagePlacement === 'cover'
      ? `\u041f\u043e \u0436\u0435\u043b\u0430\u043d\u0438\u0435. Cover \u0440\u0435\u0436\u0438\u043c\u044a\u0442 \u0438\u0437\u043f\u043e\u043b\u0437\u0432\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435\u0442\u043e \u043a\u0430\u0442\u043e \u0444\u043e\u043d. \u0417\u0430 \u043d\u0430\u0439-\u0434\u043e\u0431\u044a\u0440 \u0440\u0435\u0437\u0443\u043b\u0442\u0430\u0442 \u043a\u0430\u0447\u0438 ${selectedTypeMeta.recommendedSize}.`
      : `\u041f\u043e \u0436\u0435\u043b\u0430\u043d\u0438\u0435. \u0412 \u0440\u0435\u0436\u0438\u043c "\u0418\u043a\u043e\u043d\u0430 / \u043a\u0440\u044a\u0433" \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435\u0442\u043e \u0441\u0435 \u0438\u0437\u0440\u044f\u0437\u0432\u0430 \u0432 \u043a\u0440\u044a\u0433. \u041a\u0430\u0447\u0438 \u043a\u0432\u0430\u0434\u0440\u0430\u0442 \u043f\u043e\u043d\u0435 ${AD_CIRCLE_IMAGE_SIZE}.`
  ), [form.imagePlacement, selectedTypeMeta]);
  const adsForPreview = useMemo(() => {
    if (!editing) return normalizedAds;
    if (editing === 'new') return [...normalizedAds, previewAd];
    return normalizedAds.map((ad) => (String(ad.id) === String(editing) ? previewAd : ad));
  }, [editing, normalizedAds, previewAd]);
  const slotPreview = useMemo(() => selectedSlots.map((slot) => {
    const context = buildPreviewContext(slot, previewAd, articlesById);
    const resolution = explainAdResolution(adsForPreview, context);
    return { slot, message: resolution.resolvedAd && String(resolution.resolvedAd.id) === String(previewAd.id)
      ? ((resolution.rotationPool || []).length > 1
        ? `\u0420\u043e\u0442\u0430\u0446\u0438\u044f \u0441 ${resolution.rotationPool.length - 1} \u0434\u0440\u0443\u0433\u0438 \u0440\u0435\u043a\u043b\u0430\u043c\u0438. Weight ${previewAd.weight}/${resolution.totalWeight}.`
        : '\u0429\u0435 \u0441\u0435 \u043f\u043e\u043a\u0430\u0437\u0432\u0430 \u0441\u0430\u043c\u043e\u0441\u0442\u043e\u044f\u0442\u0435\u043b\u043d\u043e \u043d\u0430 \u0442\u043e\u0437\u0438 slot.')
      : (resolution.resolvedAd ? '\u0412 \u0442\u043e\u0437\u0438 \u043f\u0440\u0438\u043c\u0435\u0440 \u043f\u0435\u0447\u0435\u043b\u0438 \u0434\u0440\u0443\u0433\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u0430 \u0441 \u043f\u043e-\u0432\u0438\u0441\u043e\u043a priority \u0438\u043b\u0438 \u043f\u043e-\u0441\u043f\u0435\u0446\u0438\u0444\u0438\u0447\u0435\u043d targeting.' : '\u041d\u044f\u043c\u0430 \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043d delivery \u0437\u0430 \u0442\u043e\u0437\u0438 context.') };
  }), [adsForPreview, articlesById, previewAd, selectedSlots]);

  const validationErrors = useMemo(() => {
    const errors = [];
    if (!draftPayload.title) errors.push('\u0417\u0430\u0433\u043b\u0430\u0432\u0438\u0435\u0442\u043e \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u043d\u043e.');
    if (!draftPayload.cta) errors.push('CTA \u0442\u0435\u043a\u0441\u0442\u044a\u0442 \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u0435\u043d.');
    if (!draftPayload.link) errors.push('\u041b\u0438\u043d\u043a\u044a\u0442 \u0435 \u0437\u0430\u0434\u044a\u043b\u0436\u0438\u0442\u0435\u043b\u0435\u043d.');
    if (!draftPayload.placements.length) errors.push('\u0418\u0437\u0431\u0435\u0440\u0438 \u043f\u043e\u043d\u0435 \u0435\u0434\u043d\u0430 \u043f\u043e\u0437\u0438\u0446\u0438\u044f.');
    if (draftPayload.startAt && draftPayload.endAt && new Date(draftPayload.startAt).getTime() > new Date(draftPayload.endAt).getTime()) errors.push('\u041d\u0430\u0447\u0430\u043b\u043d\u0430\u0442\u0430 \u0434\u0430\u0442\u0430 \u0442\u0440\u044f\u0431\u0432\u0430 \u0434\u0430 \u0435 \u043f\u0440\u0435\u0434\u0438 \u043a\u0440\u0430\u0439\u043d\u0430\u0442\u0430.');
    return errors;
  }, [draftPayload]);

  const handleToggle = (field, value) => setForm((prev) => {
    const next = new Set(prev[field] || []);
    if (next.has(value)) next.delete(value); else next.add(value);
    return { ...prev, [field]: [...next] };
  });

  const handleSave = async () => {
    setError('');
    if (validationErrors.length > 0) return setError(validationErrors[0]);
    setSaving(true);
    try {
      if (editing === 'new') {
        await addAd(draftPayload);
        toast.success('\u0420\u0435\u043a\u043b\u0430\u043c\u0430\u0442\u0430 \u0435 \u0441\u044a\u0437\u0434\u0430\u0434\u0435\u043d\u0430.');
      } else {
        await updateAd(editing, draftPayload);
        toast.success('\u0420\u0435\u043a\u043b\u0430\u043c\u0430\u0442\u0430 \u0435 \u043e\u0431\u043d\u043e\u0432\u0435\u043d\u0430.');
      }
      setEditing(null);
      setForm({ ...emptyForm });
    } catch (e) {
      const message = e?.message || '\u0420\u0435\u043a\u043b\u0430\u043c\u0430\u0442\u0430 \u043d\u0435 \u043c\u043e\u0436\u0430 \u0434\u0430 \u0431\u044a\u0434\u0435 \u0437\u0430\u043f\u0430\u0437\u0435\u043d\u0430.';
      setError(message);
      toast.error(message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('\u0421\u0438\u0433\u0443\u0440\u0435\u043d \u043b\u0438 \u0441\u0438, \u0447\u0435 \u0438\u0441\u043a\u0430\u0448 \u0434\u0430 \u0438\u0437\u0442\u0440\u0438\u0435\u0448 \u0442\u0430\u0437\u0438 \u0440\u0435\u043a\u043b\u0430\u043c\u0430?')) return;
    await deleteAd(id);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">{'\u0420\u0435\u043a\u043b\u0430\u043c\u0438'}</h1>
          <p className="mt-1 text-sm text-gray-500">{'Slot-based \u0440\u0435\u043a\u043b\u0430\u043c\u0438 \u0441 targeting \u043f\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u0438, \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u0438 \u0441\u0442\u0430\u0442\u0438\u0438.'}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
            <span className="border border-gray-200 bg-gray-100 px-2 py-1">Analytics {analyticsSummary.days}d</span>
            <span className="border border-gray-200 bg-gray-100 px-2 py-1">Impressions: {analyticsSummary.loading ? '...' : analyticsSummary.totals.impressions}</span>
            <span className="border border-gray-200 bg-gray-100 px-2 py-1">Clicks: {analyticsSummary.loading ? '...' : analyticsSummary.totals.clicks}</span>
            <span className="border border-gray-200 bg-gray-100 px-2 py-1">CTR: {analyticsSummary.loading ? '...' : `${analyticsSummary.totals.ctr}%`}</span>
          </div>
        </div>
        <button onClick={() => { setError(''); setEditing('new'); setForm({ ...emptyForm }); }} className="flex items-center gap-2 bg-zn-purple px-4 py-2 text-sm font-semibold text-white hover:bg-zn-purple-dark">
          <Plus className="h-4 w-4" />
          {'\u041d\u043e\u0432\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u0430'}
        </button>
      </div>

      {(error || validationErrors.length > 0) && <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div>{error || validationErrors[0]}</div></div>}

      <div className="border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Заетост по позиции</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-500">Показва кой slot е зает в момента, какво предстои по график и къде има застъпване или ротация между кампании.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
            <span className="border border-emerald-200 bg-emerald-50 px-2 py-1">Активни слотове: {slotOccupancy.filter((entry) => entry.isOccupied).length}</span>
            <span className="border border-blue-200 bg-blue-50 px-2 py-1">С предстоящи кампании: {slotOccupancy.filter((entry) => entry.upcomingAds.length > 0).length}</span>
            <span className="border border-amber-200 bg-amber-50 px-2 py-1">Предупреждения: {occupancyWarningCount}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {slotOccupancy.map(({ slot, currentAds, upcomingAds, inactiveAds, warnings, isOccupied }) => (
            <div key={slot.id} className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{slot.label}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{slot.id}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                  <span className="border border-gray-200 bg-white px-2 py-1 text-gray-600">{PAGE_TYPE_LABELS[slot.pageType]}</span>
                  <span className="border border-gray-200 bg-white px-2 py-1 text-gray-600">{AD_TYPE_LABELS[slot.variant]}</span>
                  <span className={isOccupied ? 'border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700' : 'border border-gray-200 bg-white px-2 py-1 text-gray-500'}>
                    {isOccupied ? 'Активен' : 'Свободен'}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-xs text-gray-500">{slot.description}</p>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">В момента</p>
                    <span className="text-[10px] text-gray-400">{currentAds.length}</span>
                  </div>
                  {currentAds.length > 0 ? (
                    <div className="space-y-2">
                      {currentAds.map((ad) => (
                        <div key={`current-${slot.id}-${ad.id}`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{getAdDisplayName(ad)}</p>
                              <p className="mt-1 text-[11px] text-gray-600">{formatScheduleRange(ad)}</p>
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">P {ad.priority} / W {ad.weight}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">Няма активна реклама на тази позиция.</div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Предстои</p>
                    <span className="text-[10px] text-gray-400">{upcomingAds.length}</span>
                  </div>
                  {upcomingAds.length > 0 ? (
                    <div className="space-y-2">
                      {upcomingAds.map((ad) => (
                        <div key={`upcoming-${slot.id}-${ad.id}`} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{getAdDisplayName(ad)}</p>
                              <p className="mt-1 text-[11px] text-gray-600">{formatScheduleRange(ad)}</p>
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">P {ad.priority} / W {ad.weight}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">Няма следваща кампания по график.</div>
                  )}
                </div>

                {warnings.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">Рискове</p>
                    <div className="space-y-2">
                      {warnings.map((warning) => (
                        <div key={`${slot.id}-${warning.type}-${warning.message}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          {warning.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inactiveAds.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] text-gray-500">
                    История на позицията: {inactiveAds.length} неактивни или приключили кампании.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {editing && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-6 border border-gray-200 bg-white p-6">
            <div>
              <h2 className="font-semibold text-gray-900">{editing === 'new' ? '\u041d\u043e\u0432\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u0430' : '\u0420\u0435\u0434\u0430\u043a\u0446\u0438\u044f \u043d\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u0430'}</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><label className={labelCls}>{'\u041a\u0430\u043c\u043f\u0430\u043d\u0438\u044f'}</label><input className={inputCls} value={form.campaignName} onChange={(e) => setForm({ ...form, campaignName: e.target.value })} placeholder="Spring launch" /></div>
              <div><label className={labelCls}>{'\u0421\u0442\u0430\u0442\u0443\u0441'}</label><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{AD_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{AD_STATUS_LABELS[status] || status}</option>)}</select></div>
              <div><label className={labelCls}>{'\u0417\u0430\u0433\u043b\u0430\u0432\u0438\u0435'}</label><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={'\u041d\u043e\u0432 \u043f\u0440\u043e\u0434\u0443\u043a\u0442'} /></div>
              <div><label className={labelCls}>{'\u041f\u043e\u0434\u0437\u0430\u0433\u043b\u0430\u0432\u0438\u0435'}</label><input className={inputCls} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder={'\u041a\u0440\u0430\u0442\u044a\u043a \u0442\u0435\u043a\u0441\u0442'} /></div>
              <div><label className={labelCls}>CTA</label><input className={inputCls} value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} placeholder={'\u0412\u0438\u0436 \u043f\u043e\u0432\u0435\u0447\u0435'} /></div>
              <div><label className={labelCls}>{'\u0422\u0438\u043f \u0431\u0430\u043d\u0435\u0440'}</label><select className={inputCls} value={form.type} onChange={(e) => { const nextType = e.target.value; setForm((prev) => ({ ...prev, type: nextType, placements: prev.placements.filter((slotId) => AD_SLOT_DEFINITIONS.find((slot) => slot.id === slotId)?.variant === nextType) })); }}>{AD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><p className="mt-1 text-[11px] text-gray-500">{AD_TYPES.find((item) => item.value === form.type)?.description}</p></div>
              <div className="md:col-span-2"><label className={labelCls}>{'\u041b\u0438\u043d\u043a'}</label><input className={inputCls} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://example.com" /></div>
              <div><label className={labelCls}>{'\u0426\u0432\u044f\u0442'}</label><div className="flex items-center gap-2"><input type="color" className="h-10 w-10 border border-gray-200" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /><input className={`${inputCls} flex-1`} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div></div>
              <div><label className={labelCls}>{'\u0418\u043a\u043e\u043d\u0430'}</label><div className="flex flex-wrap gap-1.5">{AD_ICONS.map((icon) => <button key={icon} type="button" onClick={() => setForm({ ...form, icon })} className={`flex h-10 w-10 items-center justify-center border text-xl ${form.icon === icon ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200'}`}>{icon}</button>)}</div></div>
              <div className="md:col-span-2"><AdminImageField label={'\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435'} value={form.image} onChange={(nextValue) => setForm((prev) => ({ ...prev, image: nextValue }))} helperText={imageHelperText} previewClassName="h-36" /></div>
              <div className="md:col-span-2"><label className={labelCls}>{'\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u0432 \u0431\u0430\u043d\u0435\u0440\u0430'}</label><select className={inputCls} value={form.imagePlacement} onChange={(e) => setForm({ ...form, imagePlacement: e.target.value })}>{AD_IMAGE_PLACEMENTS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></div>
              <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{'\u041f\u0440\u0435\u043f\u043e\u0440\u044a\u0447\u0438\u0442\u0435\u043b\u0435\u043d \u0440\u0430\u0437\u043c\u0435\u0440'}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{selectedTypeMeta.label}</p>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    {`Ratio ${selectedTypeMeta.aspectRatio}`}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-gray-700 sm:grid-cols-3">
                  <div className="rounded-lg border border-white bg-white/85 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{'\u0411\u0430\u043d\u0435\u0440'}</div>
                    <div className="mt-1 font-semibold text-gray-900">{selectedTypeMeta.recommendedSize}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white/85 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{'\u041c\u0438\u043d\u0438\u043c\u0443\u043c'}</div>
                    <div className="mt-1 font-semibold text-gray-900">{selectedTypeMeta.minSize}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white/85 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{'\u0418\u043a\u043e\u043d\u0430 / \u043a\u0440\u044a\u0433'}</div>
                    <div className="mt-1 font-semibold text-gray-900">{AD_CIRCLE_IMAGE_SIZE}</div>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-amber-900">
                  {form.imagePlacement === 'cover'
                    ? '\u041f\u0440\u0438 cover \u0444\u043e\u043d \u0434\u0440\u044a\u0436 \u0432\u0430\u0436\u043d\u0438\u044f \u0442\u0435\u043a\u0441\u0442 \u0438 \u043b\u043e\u0433\u043e\u0442\u043e \u0432 \u0446\u0435\u043d\u0442\u0440\u0430\u043b\u043d\u0430\u0442\u0430 \u0437\u043e\u043d\u0430, \u0437\u0430\u0449\u043e\u0442\u043e \u0431\u0430\u043d\u0435\u0440\u044a\u0442 \u0441\u0435 \u0440\u0435\u0436\u0435 \u043d\u0430 \u0440\u0430\u0437\u043b\u0438\u0447\u043d\u0438 \u0435\u043a\u0440\u0430\u043d\u0438.'
                    : '\u041f\u0440\u0438 \u0440\u0435\u0436\u0438\u043c "\u0418\u043a\u043e\u043d\u0430 / \u043a\u0440\u044a\u0433" \u043d\u0430\u0439-\u0434\u043e\u0431\u0440\u0435 \u0440\u0430\u0431\u043e\u0442\u0438 \u043a\u0432\u0430\u0434\u0440\u0430\u0442\u043d\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u0431\u0435\u0437 \u0434\u0440\u0435\u0431\u043d\u0438 \u0434\u0435\u0442\u0430\u0439\u043b\u0438 \u043f\u043e \u043a\u0440\u0430\u0438\u0449\u0430\u0442\u0430.'}
                </p>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-5">
              <div className="mb-3"><h3 className="font-semibold text-gray-900">{'\u041f\u043e\u0437\u0438\u0446\u0438\u0438'}</h3><p className="mt-1 text-xs text-gray-500">{'\u0418\u0437\u0431\u0435\u0440\u0438 slot-\u043e\u0432\u0435\u0442\u0435, \u0432 \u043a\u043e\u0438\u0442\u043e \u0440\u0435\u043a\u043b\u0430\u043c\u0430\u0442\u0430 \u043c\u043e\u0436\u0435 \u0434\u0430 \u0443\u0447\u0430\u0441\u0442\u0432\u0430.'}</p></div>
              <div className="space-y-4">{AD_PAGE_TYPES.map((pageType) => <div key={pageType} className="border border-gray-200 p-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">{PAGE_TYPE_LABELS[pageType]}</p><div className="space-y-2">{AD_SLOT_DEFINITIONS.filter((slot) => slot.pageType === pageType).map((slot) => { const checked = form.placements.includes(slot.id); const disabled = slot.variant !== form.type; return <label key={slot.id} className={`flex items-start gap-3 border p-3 ${checked ? 'border-zn-purple bg-zn-purple/5' : 'border-gray-200'} ${disabled ? 'opacity-40' : ''}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => handleToggle('placements', slot.id)} className="mt-1" /><span><span className="block text-sm font-semibold text-gray-900">{slot.label}</span><span className="block text-xs text-gray-500">{slot.description}</span><span className="mt-1 block text-[11px] text-gray-400">{'\u0424\u043e\u0440\u043c\u0430\u0442: '}{AD_TYPE_LABELS[slot.variant]}</span></span></label>; })}</div></div>)}</div>
            </div>

            <div className="border-t border-gray-200 pt-5">
              <div className="mb-3"><h3 className="font-semibold text-gray-900">Targeting</h3><p className="mt-1 text-xs text-gray-500">{'\u041e\u0441\u0442\u0430\u0432\u0438 \u043f\u0440\u0430\u0437\u043d\u043e \u0437\u0430 \u0448\u0438\u0440\u043e\u043a delivery, \u0438\u043b\u0438 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0438 \u043f\u043e page type, \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u0438 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u0438 \u0441\u0442\u0430\u0442\u0438\u0438.'}</p></div>
              <div className="space-y-4">
                <div><label className={labelCls}>Page types</label><div className="flex flex-wrap gap-2">{AD_PAGE_TYPES.map((pageType) => <button key={pageType} type="button" onClick={() => handleToggle('pageTypes', pageType)} className={`px-3 py-1.5 border text-xs font-semibold uppercase tracking-wider ${form.pageTypes.includes(pageType) ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-200 text-gray-700'}`}>{PAGE_TYPE_LABELS[pageType]}</button>)}</div></div>
                <div><label className={labelCls}>{'\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438'}</label><div className="flex flex-wrap gap-2">{(Array.isArray(categories) ? categories : []).filter((category) => category.id !== 'all').map((category) => <button key={category.id} type="button" onClick={() => handleToggle('categoryIds', category.id)} className={`px-3 py-1.5 border text-xs font-semibold ${form.categoryIds.includes(category.id) ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-200 text-gray-700'}`}>{category.name}</button>)}</div></div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>
    <label className={labelCls}>Article IDs</label>
    <input className={inputCls} value={form.articleIdsInput} onChange={(e) => setForm({ ...form, articleIdsInput: e.target.value })} placeholder="12, 25, 108" />
    {selectedArticleIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{selectedArticleIds.map((id) => <span key={id} className="bg-gray-100 px-2 py-1 text-[11px] text-gray-600">#{id} {articlesById.get(id)?.title || '\u041d\u0435\u043f\u043e\u0437\u043d\u0430\u0442\u0430 \u0441\u0442\u0430\u0442\u0438\u044f'}</span>)}</div>}
  </div>
  <div>
    <label className={labelCls}>Exclude article IDs</label>
    <input className={inputCls} value={form.excludeArticleIdsInput} onChange={(e) => setForm({ ...form, excludeArticleIdsInput: e.target.value })} placeholder="45, 77" />
    <p className="mt-1 text-[11px] text-gray-500">{'\u0410\u043a\u043e \u0441\u0442\u0430\u0442\u0438\u044f\u0442\u0430 \u0435 \u0432 \u0442\u043e\u0437\u0438 \u0441\u043f\u0438\u0441\u044a\u043a, \u0440\u0435\u043a\u043b\u0430\u043c\u0430\u0442\u0430 \u043d\u044f\u043c\u0430 \u0434\u0430 \u0441\u0435 \u043f\u043e\u043a\u0430\u0436\u0435.'}</p>
  </div>
  <div className="md:col-span-2">
    <label className={labelCls}>Exclude category IDs</label>
    <input className={inputCls} value={form.excludeCategoryIdsInput} onChange={(e) => setForm({ ...form, excludeCategoryIdsInput: e.target.value })} placeholder="crime, business" />
    <p className="mt-1 text-[11px] text-gray-500">{'\u0410\u043a\u043e \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f\u0442\u0430 \u0441\u044a\u0432\u043f\u0430\u0434\u043d\u0435, \u0442\u043e\u0437\u0438 ad \u0441\u0435 \u0438\u0437\u043a\u043b\u044e\u0447\u0432\u0430 \u043e\u0442 delivery-\u0442\u043e.'}</p>
  </div>
</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-gray-200 pt-5 md:grid-cols-2">
              <div><label className={labelCls}>Priority</label><input type="number" className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /><p className="mt-1 text-[11px] text-gray-500">{'\u041f\u043e-\u0432\u0438\u0441\u043e\u043a\u0430\u0442\u0430 \u0441\u0442\u043e\u0439\u043d\u043e\u0441\u0442 \u043f\u0435\u0447\u0435\u043b\u0438 \u043d\u0430\u0434 \u043f\u043e-\u043d\u0438\u0441\u043a\u0430\u0442\u0430 \u043d\u0430 \u0441\u044a\u0449\u0438\u044f slot.'}</p></div>
              <div><label className={labelCls}>Weight</label><input type="number" min="1" className={inputCls} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /><p className="mt-1 text-[11px] text-gray-500">{'Weight \u0432\u043b\u0438\u044f\u0435 \u0441\u0430\u043c\u043e \u0430\u043a\u043e \u0438\u043c\u0430 \u0440\u043e\u0442\u0430\u0446\u0438\u044f.'}</p></div>
              <div><label className={labelCls}>Start</label><input type="datetime-local" className={inputCls} value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></div>
              <div><label className={labelCls}>End</label><input type="datetime-local" className={inputCls} value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelCls}>{'\u0411\u0435\u043b\u0435\u0436\u043a\u0438'}</label><textarea className={`${inputCls} min-h-[110px]`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={'\u0412\u044a\u0442\u0440\u0435\u0448\u043d\u0438 \u0431\u0435\u043b\u0435\u0436\u043a\u0438 \u0437\u0430 \u0435\u043a\u0438\u043f\u0430'} /></div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving || validationErrors.length > 0} className="flex items-center gap-2 bg-zn-purple px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? '\u0417\u0430\u043f\u0438\u0441\u0432\u0430\u043d\u0435...' : '\u0417\u0430\u043f\u0430\u0437\u0438'}</button>
              <button onClick={() => { setEditing(null); setError(''); }} className="flex items-center gap-2 border border-gray-200 px-5 py-2 text-sm text-gray-600"><X className="h-4 w-4" />{'\u041e\u0442\u043a\u0430\u0437'}</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2"><Eye className="h-4 w-4 text-gray-500" /><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Preview</p></div>
              <div className="newspaper-page bg-[#EDE6DA] p-3 overflow-visible"><PreviewBanner ad={previewAd} /></div>
              <div className="mt-4 space-y-3 text-xs text-gray-600"><div><p className="font-semibold text-gray-900">{'\u041f\u043e\u0437\u0438\u0446\u0438\u0438'}</p><div className="mt-1 flex flex-wrap gap-1.5">{selectedSlots.length > 0 ? selectedSlots.map((slot) => <span key={slot.id} className="border border-gray-200 bg-gray-100 px-2 py-1">{slot.label}</span>) : <span className="text-gray-400">{'\u041d\u044f\u043c\u0430 \u0438\u0437\u0431\u0440\u0430\u043d\u0438 \u043f\u043e\u0437\u0438\u0446\u0438\u0438'}</span>}</div></div><div><p className="font-semibold text-gray-900">Targeting</p><p>{summarizeTargeting(previewAd, categoriesById, articlesById)}</p></div></div>
            </div>

            <div className="border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2"><Info className="h-4 w-4 text-gray-500" /><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{'\u041a\u0430\u043a \u0440\u0430\u0431\u043e\u0442\u0438'}</p></div>
              <div className="space-y-2 text-sm text-gray-600">{DELIVERY_RULES.map((rule) => <div key={rule} className="border border-gray-200 bg-gray-50 px-3 py-2">{rule}</div>)}</div>
              {slotPreview.length > 0 && <div className="mt-4 space-y-2">{slotPreview.map(({ slot, message }) => <div key={slot.id} className="border border-gray-200 px-3 py-2 text-sm text-gray-600"><div className="font-semibold text-gray-900">{slot.label}</div><div className="mt-1">{message}</div></div>)}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {normalizedAds.map((ad) => {
          const metrics = analyticsByAdId.get(Number(ad.id)) || { impressions: 0, clicks: 0, ctr: 0, lastImpressionAt: null, lastClickAt: null };
          return <div key={ad.id} className="border border-gray-200 bg-white"><div className="relative overflow-hidden p-4 text-white" style={{ backgroundColor: ad.color || '#990F3D' }}>{ad.image && <img src={ad.image} alt="" className={`absolute inset-0 h-full w-full object-cover ${ad.imagePlacement === 'cover' ? 'opacity-100' : 'opacity-30'}`} />}<div className="relative z-10 flex items-center gap-2"><span className="text-xl">{ad.icon}</span><div><p className="text-sm font-bold">{ad.campaignName || ad.title}</p><p className="text-xs opacity-90">{ad.subtitle}</p></div></div><span className="relative z-10 mt-3 inline-block bg-white/20 px-3 py-1 text-xs font-semibold">{ad.cta}</span></div><div className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><span className="bg-gray-100 px-1.5 py-0.5 text-gray-600">{AD_TYPE_LABELS[ad.type] || ad.type}</span><span className="bg-gray-100 px-1.5 py-0.5 text-gray-600">{AD_STATUS_LABELS[ad.status] || ad.status}</span><span className="bg-blue-100 px-1.5 py-0.5 text-blue-700">P {ad.priority}</span><span className="bg-violet-100 px-1.5 py-0.5 text-violet-700">W {ad.weight}</span>{ad.link && ad.link !== '#' && <a href={ad.link} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-zn-hot"><ExternalLink className="h-3.5 w-3.5" /></a>}{ad.image && <span className="bg-purple-100 px-1.5 py-0.5 text-purple-700"><ImageIcon className="mr-0.5 inline h-3 w-3" />media</span>}</div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{'\u041f\u043e\u0437\u0438\u0446\u0438\u0438'}</p><div className="flex flex-wrap gap-1.5">{ad.placements.map((placement) => <span key={placement} className="bg-gray-100 px-2 py-1 text-[11px] text-gray-600">{AD_SLOT_DEFINITIONS.find((slot) => slot.id === placement)?.label || placement}</span>)}</div></div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Targeting</p><p className="text-sm text-gray-600">{summarizeTargeting(ad, categoriesById, articlesById)}</p></div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Analytics</p><div className="grid grid-cols-3 gap-2 text-xs text-gray-600"><div className="border border-gray-200 p-2"><div className="text-[10px] uppercase tracking-wider text-gray-400">Impr.</div><div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : metrics.impressions}</div></div><div className="border border-gray-200 p-2"><div className="text-[10px] uppercase tracking-wider text-gray-400">Clicks</div><div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : metrics.clicks}</div></div><div className="border border-gray-200 p-2"><div className="text-[10px] uppercase tracking-wider text-gray-400">CTR</div><div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : `${metrics.ctr}%`}</div></div></div></div><div className="flex items-center gap-1 border-t border-gray-100 pt-2"><button onClick={() => { setError(''); setEditing(ad.id); setForm(normalizeAdForm(ad)); }} className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDelete(ad.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></div></div>;
        })}
        {normalizedAds.length === 0 && <div className="col-span-full py-12 text-center text-sm text-gray-400">{'\u041d\u044f\u043c\u0430 \u0440\u0435\u043a\u043b\u0430\u043c\u0438'}</div>}
      </div>
    </div>
  );
}



