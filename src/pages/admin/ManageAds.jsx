import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, ExternalLink, ImageIcon, AlertTriangle, Loader2, Eye, Info } from 'lucide-react';
import { usePublicData } from '../../context/DataContext';
import AdminImageField from '../../components/admin/AdminImageField';
import { useToast } from '../../components/admin/Toast';
import { AdBannerHorizontal, AdBannerSide, AdBannerInline } from '../../components/AdBanner';
import { AD_PAGE_TYPES, AD_SLOT_DEFINITIONS, AD_STATUS_OPTIONS, getAdSlot } from '../../../shared/adSlots.js';
import { explainAdResolution, normalizeAdImageMeta, normalizeAdRecord, resolveAdCreative } from '../../../shared/adResolver.js';
import { buildAdSlotOccupancy } from '../../../shared/adOccupancy.js';
import { api } from '../../utils/api';

const AD_TYPES = [
  {
    value: 'horizontal',
    label: 'Хоризонтален банер',
    description: 'Широк формат за горни, долни и междинни позиции.',
    recommendedSize: '1600 x 400 px',
    minSize: '1200 x 300 px',
    aspectRatio: '4:1',
  },
  {
    value: 'side',
    label: 'Sidebar банер',
    description: 'Тесен формат за странични позиции.',
    recommendedSize: '900 x 1200 px',
    minSize: '700 x 933 px',
    aspectRatio: '3:4',
  },
  {
    value: 'inline',
    label: 'Inline банер',
    description: 'Влиза вътре в текста на статия.',
    recommendedSize: '1200 x 300 px',
    minSize: '960 x 240 px',
    aspectRatio: '4:1',
  },
];
const AD_CIRCLE_IMAGE_SIZE = '800 x 800 px';
const AD_DEFAULT_IMAGE_META = Object.freeze({ objectPosition: '50% 50%', objectScale: 1 });
const AD_EDITOR_ASPECT_PRESETS = Object.freeze({
  horizontal: [
    { key: 'banner', label: '4:1 Банер', ratio: 4 / 1, css: '4 / 1' },
    { key: 'wide', label: '16:9 Широк', ratio: 16 / 9, css: '16 / 9' },
    { key: 'safe', label: '3:2 Безопасна зона', ratio: 3 / 2, css: '3 / 2' },
  ],
  side: [
    { key: 'sidebar', label: '3:4 Сайдбар', ratio: 3 / 4, css: '3 / 4' },
    { key: 'portrait', label: '4:5 Портрет', ratio: 4 / 5, css: '4 / 5' },
    { key: 'story', label: '9:16 Story', ratio: 9 / 16, css: '9 / 16' },
  ],
  inline: [
    { key: 'inline', label: '4:1 Inline', ratio: 4 / 1, css: '4 / 1' },
    { key: 'wide', label: '16:9 Широк', ratio: 16 / 9, css: '16 / 9' },
    { key: 'safe', label: '3:2 Безопасна зона', ratio: 3 / 2, css: '3 / 2' },
  ],
  circle: [
    { key: 'square', label: '1:1 Квадрат', ratio: 1, css: '1 / 1' },
  ],
});

const AD_TYPE_LABELS = Object.freeze(AD_TYPES.reduce((acc, item) => ({ ...acc, [item.value]: item.label }), {}));
const AD_STATUS_LABELS = Object.freeze({
  draft: 'Чернова',
  active: 'Активна',
  paused: 'Пауза',
  archived: 'Архив',
});
const PAGE_TYPE_LABELS = Object.freeze({
  home: 'Начална',
  article: 'Статия',
  category: 'Категория',
});
const AD_IMAGE_PLACEMENTS = [
  { value: 'circle', label: 'Икона / кръг' },
  { value: 'cover', label: 'Пълен фон' },
];
const AD_FIT_MODES = [
  {
    value: 'cover',
    label: 'Cover',
    description: 'Изображението запълва целия banner и може да реже краищата.',
  },
  {
    value: 'contain',
    label: 'Contain',
    description: 'Пази целия creative в рамка и е по-подходящо за банери с много текст.',
  },
];
const AD_ICONS = ['📰', '🚗', '💸', '🏦', '🎯', '🍔', '🛒', '🔥', '🎲', '🎵', '🏆', '📱'];
const DELIVERY_RULES = [
  'Позицията определя къде на сайта може да се покаже рекламата.',
  'По-специфичният targeting печели над по-широкия.',
  'По-високият priority печели над по-ниския на същия slot.',
  'Weight участва само в ротация между равностойни реклами.',
];

const emptyForm = {
  campaignName: '',
  title: '',
  subtitle: '',
  showTitle: true,
  clickable: true,
  showButton: true,
  cta: 'Виж повече',
  type: 'horizontal',
  status: 'active',
  icon: '📰',
  link: '#',
  color: '#990F3D',
  image: '',
  imageMeta: { ...AD_DEFAULT_IMAGE_META },
  imageMobile: '',
  imageMetaMobile: { ...AD_DEFAULT_IMAGE_META },
  imagePlacement: 'circle',
  fitMode: 'cover',
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

function clampPercentage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.min(100, Math.max(0, numeric));
}

function clampAdScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(2.4, Math.max(1, Number(numeric.toFixed(2))));
}

function parseAdObjectPosition(value) {
  const normalized = normalizeAdImageMeta({ objectPosition: value });
  const [x = '50%', y = '50%'] = String(normalized.objectPosition || '50% 50%').split(/\s+/);
  return {
    x: clampPercentage(Number.parseFloat(x)),
    y: clampPercentage(Number.parseFloat(y)),
  };
}

function buildAdObjectPosition(x, y) {
  return `${Math.round(clampPercentage(x))}% ${Math.round(clampPercentage(y))}%`;
}

function getAdAdminCardImageStyle(ad) {
  const creative = resolveAdCreative(ad, { viewport: 'desktop' });
  return {
    objectPosition: creative.imageMeta.objectPosition,
    transform: ad?.imagePlacement === 'cover' && creative.imageMeta.objectScale !== 1 ? `scale(${creative.imageMeta.objectScale})` : undefined,
    transformOrigin: creative.imageMeta.objectPosition,
  };
}

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
    showTitle: form.showTitle !== false,
    clickable: form.clickable !== false,
    showButton: form.showButton !== false,
    cta: String(form.cta || '').trim(),
    type: form.type || 'horizontal',
    status: form.status || 'active',
    icon: String(form.icon || '').trim(),
    link: String(form.link || '').trim(),
    color: String(form.color || '').trim(),
    imageDesktop: String(form.image || '').trim(),
    imageMetaDesktop: normalizeAdImageMeta(form.imageMeta),
    imageMobile: String(form.imageMobile || '').trim(),
    imageMetaMobile: normalizeAdImageMeta(form.imageMetaMobile),
    imagePlacement: form.imagePlacement === 'cover' ? 'cover' : 'circle',
    fitMode: form.fitMode === 'contain' ? 'contain' : 'cover',
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
    image: normalized.imageDesktop || normalized.image || '',
    imageMeta: normalizeAdImageMeta(normalized.imageMetaDesktop || normalized.imageMeta),
    imageMobile: normalized.imageMobile || '',
    imageMetaMobile: normalizeAdImageMeta(normalized.imageMetaMobile),
    fitMode: normalized.fitMode === 'contain' ? 'contain' : 'cover',
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
  if (ad.targeting?.pageTypes?.length) parts.push(`Тип страница: ${ad.targeting.pageTypes.map((item) => PAGE_TYPE_LABELS[item] || item).join(', ')}`);
  if (ad.targeting?.categoryIds?.length) parts.push(`Категории: ${ad.targeting.categoryIds.map((id) => categoriesById.get(id)?.name || id).join(', ')}`);
  if (ad.targeting?.articleIds?.length) parts.push(`Статии: ${ad.targeting.articleIds.map((id) => articlesById.get(id)?.title || `#${id}`).join(', ')}`);
  if (ad.targeting?.excludeArticleIds?.length) parts.push(`Изключи статии: ${ad.targeting.excludeArticleIds.map((id) => articlesById.get(id)?.title || `#${id}`).join(', ')}`);
  if (ad.targeting?.excludeCategoryIds?.length) parts.push(`Изключи категории: ${ad.targeting.excludeCategoryIds.map((id) => categoriesById.get(id)?.name || id).join(', ')}`);
  return parts.join(' | ') || 'Без допълнителни ограничения.';
}

function buildPreviewContext(slot, previewAd, articlesById) {
  const articleId = slot.supportsArticleTargeting ? (previewAd.targeting?.articleIds?.[0] || null) : null;
  const article = articleId ? articlesById.get(Number(articleId)) : null;
  const categoryId = slot.supportsCategoryTargeting ? (article?.category || previewAd.targeting?.categoryIds?.[0] || '') : '';
  return { slot: slot.id, pageType: slot.pageType, articleId, categoryId, rotationKey: `preview|${slot.id}|${articleId || 'na'}|${categoryId || 'na'}` };
}

function parseSizeLabel(value) {
  const match = String(value || '').match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function getAdGuideMode(type) {
  if (type === 'side') return 'ad-side';
  if (type === 'inline') return 'ad-inline';
  return 'ad-horizontal';
}

function getSlotAspectRatio(slotMeta, viewport, fallbackRatio) {
  if (viewport === 'mobile') return String(slotMeta?.mobileAspectRatio || fallbackRatio || '4:1');
  return String(slotMeta?.desktopAspectRatio || fallbackRatio || '4:1');
}

function getCreativeImageField(viewport) {
  return viewport === 'mobile' ? 'imageMobile' : 'image';
}

function getCreativeMetaField(viewport) {
  return viewport === 'mobile' ? 'imageMetaMobile' : 'imageMeta';
}

const SIZE_TARGETS = Object.freeze({
  horizontal: Object.freeze({ recLong: 1600, minLong: 1200 }),
  side: Object.freeze({ recLong: 1200, minLong: 960 }),
  inline: Object.freeze({ recLong: 1200, minLong: 960 }),
});

function computeSizesFromRatio(ratioLabel, variant) {
  const match = String(ratioLabel || '').match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const rw = Number(match[1]);
  const rh = Number(match[2]);
  if (!rw || !rh) return null;

  const target = SIZE_TARGETS[variant] || SIZE_TARGETS.horizontal;
  let recW, recH, minW, minH;

  if (rw >= rh) {
    recW = target.recLong;
    recH = Math.round(recW * rh / rw);
    minW = target.minLong;
    minH = Math.round(minW * rh / rw);
  } else {
    recH = target.recLong;
    recW = Math.round(recH * rw / rh);
    minH = target.minLong;
    minW = Math.round(minH * rw / rh);
  }

  return {
    recommended: { width: recW, height: recH },
    minimum: { width: minW, height: minH },
  };
}

function buildCreativeRequirements(selectedTypeMeta, slotMeta, viewport) {
  const ratioLabel = getSlotAspectRatio(slotMeta, viewport, selectedTypeMeta?.aspectRatio || '4:1');
  const variant = selectedTypeMeta?.value || 'horizontal';
  const computed = computeSizesFromRatio(ratioLabel, variant);
  return {
    label: viewport === 'mobile' ? 'Мобилен creative' : 'Десктоп creative',
    recommended: computed?.recommended || parseSizeLabel(selectedTypeMeta?.recommendedSize),
    minimum: computed?.minimum || parseSizeLabel(selectedTypeMeta?.minSize),
    ratioLabel,
  };
}

function PreviewBanner({ ad, slotMeta = null, showSafeArea = false, viewport = 'auto' }) {
  if (ad.type === 'side') return <AdBannerSide ad={ad} slotMeta={slotMeta} showSafeArea={showSafeArea} viewport={viewport} />;
  if (ad.type === 'inline') return <AdBannerInline ad={ad} slotMeta={slotMeta} showSafeArea={showSafeArea} viewport={viewport} />;
  return <AdBannerHorizontal ad={ad} slotMeta={slotMeta} showSafeArea={showSafeArea} viewport={viewport} />;
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
  const { ads, categories, articles, addAd, updateAd, deleteAd } = usePublicData();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => normalizeAdForm(emptyForm));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [analyticsSummary, setAnalyticsSummary] = useState({ items: [], totals: { impressions: 0, clicks: 0, ctr: 0 }, days: 30, loading: true, error: '' });
  const [previewSlotId, setPreviewSlotId] = useState('');
  const [creativeViewport, setCreativeViewport] = useState('desktop');
  const toast = useToast();
  const fieldRefs = useRef(new Map());

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
  const previewSlotOptions = useMemo(() => (
    selectedSlots.length > 0
      ? selectedSlots
      : AD_SLOT_DEFINITIONS.filter((slot) => slot.variant === form.type)
  ), [form.type, selectedSlots]);
  const previewSlotMeta = useMemo(
    () => previewSlotOptions.find((slot) => slot.id === previewSlotId) || previewSlotOptions[0] || null,
    [previewSlotId, previewSlotOptions],
  );
  const previewGuideMode = useMemo(() => getAdGuideMode(form.type), [form.type]);
  const activeCreativeImageField = useMemo(() => getCreativeImageField(creativeViewport), [creativeViewport]);
  const activeCreativeMetaField = useMemo(() => getCreativeMetaField(creativeViewport), [creativeViewport]);
  const activeCreativeImage = form[activeCreativeImageField] || '';
  const activeCreativeMeta = useMemo(() => normalizeAdImageMeta(form[activeCreativeMetaField]), [activeCreativeMetaField, form]);
  const imageRequirements = useMemo(() => buildCreativeRequirements(selectedTypeMeta, previewSlotMeta, creativeViewport), [creativeViewport, previewSlotMeta, selectedTypeMeta]);
  const mobileCreativeWarning = useMemo(() => (
    form.image && !form.imageMobile && form.imagePlacement === 'cover'
      ? 'Имаш само desktop creative. На mobile ще се ползва fallback към същия banner, но препоръчваме отделен mobile creative.'
      : ''
  ), [form.image, form.imageMobile, form.imagePlacement]);

  useEffect(() => {
    if (!previewSlotOptions.length) {
      setPreviewSlotId('');
      return;
    }
    if (!previewSlotOptions.some((slot) => slot.id === previewSlotId)) {
      setPreviewSlotId(previewSlotOptions[0].id);
    }
  }, [previewSlotId, previewSlotOptions]);
  const previewAd = useMemo(() => normalizeAdRecord({ ...draftPayload, id: editing || 'preview' }), [draftPayload, editing]);
  const selectedArticleIds = useMemo(() => parseNumericCsv(form.articleIdsInput), [form.articleIdsInput]);
  const coverImageMeta = useMemo(() => activeCreativeMeta, [activeCreativeMeta]);
  const coverImageFocus = useMemo(() => parseAdObjectPosition(coverImageMeta.objectPosition), [coverImageMeta.objectPosition]);
  const editorAspectPresets = useMemo(() => (
    form.imagePlacement === 'cover'
      ? (AD_EDITOR_ASPECT_PRESETS[form.type] || AD_EDITOR_ASPECT_PRESETS.horizontal)
      : AD_EDITOR_ASPECT_PRESETS.circle
  ), [form.imagePlacement, form.type]);
  const imageHelperText = useMemo(() => (
    form.imagePlacement === 'cover'
      ? `По желание. ${creativeViewport === 'mobile' ? 'Мобилният' : 'Десктоп'} cover creative ще се показва с ratio ${imageRequirements.ratioLabel}.`
      : `По желание. В режим "Икона / кръг" най-добре работи квадрат поне ${AD_CIRCLE_IMAGE_SIZE}.`
  ), [creativeViewport, form.imagePlacement, imageRequirements.ratioLabel]);
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
        ? `Ротация с ${resolution.rotationPool.length - 1} други реклами. Weight ${previewAd.weight}/${resolution.totalWeight}.`
        : 'Ще се показва самостоятелно на този slot.')
      : (resolution.resolvedAd ? 'В този пример печели друга реклама с по-висок priority или по-специфичен targeting.' : 'Няма разрешен delivery за този context.') };
  }), [adsForPreview, articlesById, previewAd, selectedSlots]);

  const validationEntries = useMemo(() => {
    const errors = [];
    if (!draftPayload.title) errors.push(['title', 'Заглавието е задължително.']);
    if (draftPayload.showButton !== false && !draftPayload.cta) errors.push(['cta', 'CTA текстът е задължителен.']);
    if (draftPayload.clickable !== false && (!draftPayload.link || draftPayload.link === '#')) {
      errors.push(['link', 'Линкът е задължителен за clickable реклама.']);
    }
    if (!draftPayload.placements.length) errors.push(['placements', 'Избери поне една позиция.']);
    if (draftPayload.startAt && draftPayload.endAt && new Date(draftPayload.startAt).getTime() > new Date(draftPayload.endAt).getTime()) {
      errors.push(['schedule', 'Началната дата трябва да е преди крайната.']);
    }
    return errors;
  }, [draftPayload]);

  const validationMessages = useMemo(() => Object.fromEntries(validationEntries), [validationEntries]);

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
  const clearFormError = () => {
    if (error) setError('');
  };

  const handleToggle = (field, value) => {
    clearFormError();
    setForm((prev) => {
      const next = new Set(prev[field] || []);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [field]: [...next] };
    });
  };

  const updateCoverImageMeta = (patch) => setForm((prev) => ({
    ...prev,
    [activeCreativeMetaField]: normalizeAdImageMeta({
      ...(prev[activeCreativeMetaField] && typeof prev[activeCreativeMetaField] === 'object' ? prev[activeCreativeMetaField] : AD_DEFAULT_IMAGE_META),
      ...(patch && typeof patch === 'object' ? patch : {}),
    }),
  }));

  const setCoverFocusAxis = (axis, nextValue) => {
    if (axis === 'x') {
      updateCoverImageMeta({ objectPosition: buildAdObjectPosition(nextValue, coverImageFocus.y) });
      return;
    }
    updateCoverImageMeta({ objectPosition: buildAdObjectPosition(coverImageFocus.x, nextValue) });
  };

  const handleSave = async () => {
    setError('');
    if (validationEntries.length > 0) {
      focusValidationField(validationEntries[0][0]);
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') {
        await addAd(draftPayload);
        toast.success('Рекламата е създадена.');
      } else {
        await updateAd(editing, draftPayload);
        toast.success('Рекламата е обновена.');
      }
      setEditing(null);
      setForm(normalizeAdForm(emptyForm));
    } catch (e) {
      const message = e?.message || 'Рекламата не можа да бъде запазена.';
      setError(message);
      toast.error(message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Сигурен ли си, че искаш да изтриеш тази реклама?')) return;
    await deleteAd(id);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">{'Реклами'}</h1>
          <p className="mt-1 text-sm text-gray-500">{'Slot-based реклами с targeting по позиции, категории и статии.'}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
            <span className="border border-gray-200 bg-gray-100 px-2 py-1">Analytics {analyticsSummary.days}d</span>
            <span className="border border-gray-200 bg-gray-100 px-2 py-1">Impressions: {analyticsSummary.loading ? '...' : analyticsSummary.totals.impressions}</span>
            <span className="border border-gray-200 bg-gray-100 px-2 py-1">Clicks: {analyticsSummary.loading ? '...' : analyticsSummary.totals.clicks}</span>
            <span className="border border-gray-200 bg-gray-100 px-2 py-1">CTR: {analyticsSummary.loading ? '...' : `${analyticsSummary.totals.ctr}%`}</span>
          </div>
        </div>
        <button onClick={() => { setError(''); setEditing('new'); setCreativeViewport('desktop'); setForm(normalizeAdForm(emptyForm)); }} className="flex items-center gap-2 bg-zn-purple px-4 py-2 text-sm font-semibold text-white hover:bg-zn-purple-dark">
          <Plus className="h-4 w-4" />
          {'Нова реклама'}
        </button>
      </div>

      {(error || validationEntries.length > 0) && (
        <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert" aria-live="polite">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            {error ? (
              <div>{error}</div>
            ) : (
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
            )}
          </div>
        </div>
      )}

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
              <h2 className="font-semibold text-gray-900">{editing === 'new' ? 'Нова реклама' : 'Редакция на реклама'}</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><label className={labelCls}>{'Кампания'}</label><input className={inputCls} value={form.campaignName} onChange={(e) => { clearFormError(); setForm({ ...form, campaignName: e.target.value }); }} placeholder="Spring launch" /></div>
              <div><label className={labelCls}>{'Статус'}</label><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{AD_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{AD_STATUS_LABELS[status] || status}</option>)}</select></div>
              <div ref={registerFieldRef('title')}>
                <label className={labelCls}>{'Заглавие'}</label>
                <input
                  className={getInputClassName('title')}
                  value={form.title}
                  onChange={(e) => { clearFormError(); setForm({ ...form, title: e.target.value }); }}
                  placeholder={'Нов продукт'}
                  aria-invalid={getFieldError('title') ? 'true' : 'false'}
                  aria-describedby={getFieldError('title') ? 'ad-title-error' : undefined}
                />
                {getFieldError('title') && <p id="ad-title-error" className="mt-1 text-xs text-red-600">{getFieldError('title')}</p>}
              </div>
              <div><label className={labelCls}>{'Подзаглавие'}</label><input className={inputCls} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder={'Кратък текст'} /></div>
              <div className="md:col-span-2 rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <label className={labelCls}>{'Заглавие в банера'}</label>
                    <p className="text-sm text-gray-600">{'Когато е изключено, заглавието не се показва в самия банер, но остава за вътрешна организация и списъците в администрацията.'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { clearFormError(); setForm((prev) => ({ ...prev, showTitle: !prev.showTitle })); }}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${form.showTitle ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                  >
                    {form.showTitle ? 'Заглавието е видимо' : 'Без заглавие'}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2 rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <label className={labelCls}>{'Clickable реклама'}</label>
                    <p className="text-sm text-gray-600">{'Ако е включено, целият банер води към link. Ако е изключено, рекламата остава статична.'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { clearFormError(); setForm((prev) => prev.clickable ? { ...prev, clickable: false, showButton: false } : { ...prev, clickable: true }); }}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${form.clickable ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                  >
                    {form.clickable ? 'Clickable е включено' : 'Static без link'}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2 rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <label className={labelCls}>{'CTA бутон'}</label>
                    <p className="text-sm text-gray-600">{'Бутонът е само визуален елемент. Може да го скриеш и пак да оставиш clickable banner.'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { clearFormError(); setForm((prev) => prev.showButton ? { ...prev, showButton: false } : { ...prev, clickable: true, showButton: true }); }}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${form.showButton ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                  >
                    {form.showButton ? 'Бутонът е видим' : 'Без CTA бутон'}
                  </button>
                </div>
              </div>
              {form.showButton ? (
                <div ref={registerFieldRef('cta')}>
                  <label className={labelCls}>CTA</label>
                  <input
                    className={getInputClassName('cta')}
                    value={form.cta}
                    onChange={(e) => { clearFormError(); setForm({ ...form, cta: e.target.value }); }}
                    placeholder={'Виж повече'}
                    aria-invalid={getFieldError('cta') ? 'true' : 'false'}
                    aria-describedby={getFieldError('cta') ? 'ad-cta-error' : undefined}
                  />
                  {getFieldError('cta') && <p id="ad-cta-error" className="mt-1 text-xs text-red-600">{getFieldError('cta')}</p>}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">{'Банерът ще се показва без CTA бутон, но може да остане clickable.'}</div>
              )}
              <div><label className={labelCls}>{'Тип банер'}</label><select className={inputCls} value={form.type} onChange={(e) => { clearFormError(); const nextType = e.target.value; setForm((prev) => ({ ...prev, type: nextType, placements: prev.placements.filter((slotId) => AD_SLOT_DEFINITIONS.find((slot) => slot.id === slotId)?.variant === nextType) })); }}>{AD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><p className="mt-1 text-[11px] text-gray-500">{AD_TYPES.find((item) => item.value === form.type)?.description}</p></div>
              {form.clickable ? (
                <div className="md:col-span-2" ref={registerFieldRef('link')}>
                  <label className={labelCls}>{'Линк'}</label>
                  <input
                    className={getInputClassName('link')}
                    value={form.link}
                    onChange={(e) => { clearFormError(); setForm({ ...form, link: e.target.value }); }}
                    placeholder="https://example.com"
                    aria-invalid={getFieldError('link') ? 'true' : 'false'}
                    aria-describedby={getFieldError('link') ? 'ad-link-error' : undefined}
                  />
                  {getFieldError('link') && <p id="ad-link-error" className="mt-1 text-xs text-red-600">{getFieldError('link')}</p>}
                </div>
              ) : (
                <div className="md:col-span-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">{'Линкът се игнорира, докато рекламата е static.'}</div>
              )}
              <div><label className={labelCls}>{'Цвят'}</label><div className="flex items-center gap-2"><input type="color" className="h-10 w-10 border border-gray-200" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /><input className={`${inputCls} flex-1`} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div></div>
              <div><label className={labelCls}>{'Икона'}</label><div className="flex flex-wrap gap-1.5">{AD_ICONS.map((icon) => <button key={icon} type="button" onClick={() => setForm({ ...form, icon })} className={`flex h-10 w-10 items-center justify-center border text-xl ${form.icon === icon ? 'border-zn-purple bg-zn-purple/10' : 'border-gray-200'}`}>{icon}</button>)}</div></div>
              <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Creative sets</p>
                    <p className="mt-1 text-sm text-gray-600">Десктоп и mobile визии за една и съща ad кампания.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[['desktop', 'Десктоп'], ['mobile', 'Mobile']].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCreativeViewport(value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${creativeViewport === value ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <AdminImageField
                    label={'Десктоп creative'}
                    value={form.image}
                    onChange={(nextValue) => setForm((prev) => ({
                      ...prev,
                      image: nextValue,
                      imageMeta: nextValue && nextValue !== prev.image ? { ...AD_DEFAULT_IMAGE_META } : prev.imageMeta,
                    }))}
                    imageMeta={form.imageMeta}
                    onChangeMeta={(nextMeta) => setForm((prev) => ({
                      ...prev,
                      imageMeta: normalizeAdImageMeta(nextMeta),
                    }))}
                    helperText={form.imagePlacement === 'cover' ? 'Широката версия за десктоп slot-овете.' : imageHelperText}
                    previewClassName="h-36"
                    editorAspectPresets={editorAspectPresets}
                    defaultEditorMode={form.imagePlacement === 'cover' ? 'focal' : 'crop'}
                    guideMode={previewGuideMode}
                    imageRequirements={buildCreativeRequirements(selectedTypeMeta, previewSlotMeta, 'desktop')}
                  />
                  <AdminImageField
                    label={'Mobile creative'}
                    value={form.imageMobile}
                    onChange={(nextValue) => setForm((prev) => ({
                      ...prev,
                      imageMobile: nextValue,
                      imageMetaMobile: nextValue && nextValue !== prev.imageMobile ? { ...AD_DEFAULT_IMAGE_META } : prev.imageMetaMobile,
                    }))}
                    imageMeta={form.imageMetaMobile}
                    onChangeMeta={(nextMeta) => setForm((prev) => ({
                      ...prev,
                      imageMetaMobile: normalizeAdImageMeta(nextMeta),
                    }))}
                    helperText={form.imagePlacement === 'cover' ? 'Опционално, но силно препоръчително за mobile ratio fallback-и.' : imageHelperText}
                    previewClassName="h-36"
                    editorAspectPresets={editorAspectPresets}
                    defaultEditorMode={form.imagePlacement === 'cover' ? 'focal' : 'crop'}
                    guideMode={previewGuideMode}
                    imageRequirements={buildCreativeRequirements(selectedTypeMeta, previewSlotMeta, 'mobile')}
                  />
                </div>
                {mobileCreativeWarning && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {mobileCreativeWarning}
                  </div>
                )}
              </div>
              <div><label className={labelCls}>{'Изображение в банера'}</label><select className={inputCls} value={form.imagePlacement} onChange={(e) => setForm({ ...form, imagePlacement: e.target.value })}>{AD_IMAGE_PLACEMENTS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></div>
              <div><label className={labelCls}>Fit mode</label><select className={inputCls} value={form.fitMode} onChange={(e) => setForm({ ...form, fitMode: e.target.value })}>{AD_FIT_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select><p className="mt-1 text-[11px] text-gray-500">{AD_FIT_MODES.find((mode) => mode.value === form.fitMode)?.description}</p></div>
              <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{'Препоръчителен размер'}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{`${creativeViewport === 'mobile' ? 'Mobile' : 'Десктоп'} • ${selectedTypeMeta.label}`}</p>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    {`Ratio ${imageRequirements.ratioLabel}`}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-gray-700 sm:grid-cols-3">
                  <div className="rounded-lg border border-white bg-white/85 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{'Банер'}</div>
                    <div className="mt-1 font-semibold text-gray-900">{imageRequirements.recommended ? `${imageRequirements.recommended.width} x ${imageRequirements.recommended.height} px` : selectedTypeMeta.recommendedSize}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white/85 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{'Минимум'}</div>
                    <div className="mt-1 font-semibold text-gray-900">{imageRequirements.minimum ? `${imageRequirements.minimum.width} x ${imageRequirements.minimum.height} px` : selectedTypeMeta.minSize}</div>
                  </div>
                  <div className="rounded-lg border border-white bg-white/85 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{'Икона / кръг'}</div>
                    <div className="mt-1 font-semibold text-gray-900">{AD_CIRCLE_IMAGE_SIZE}</div>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-amber-900">
                  {form.imagePlacement === 'cover'
                    ? 'При cover фон дръж важния текст и логото в централната зона, защото банерът се реже на различни екрани.'
                    : 'При режим "Икона / кръг" най-добре работи квадратно изображение без дребни детайли по краищата.'}
                </p>
              </div>
            </div>
            {activeCreativeImage && form.imagePlacement === 'cover' && (
              <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Позициониране на фон</p>
                    <p className="mt-1 text-sm text-sky-950">Мащабирай и премести изображението така, че да влиза точно в рамката на банера.</p>
                  </div>
                  <div className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold text-sky-700">
                    {`${coverImageMeta.objectPosition} • ${Math.round(coverImageMeta.objectScale * 100)}%`}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="overflow-hidden rounded-2xl border border-white/70 bg-[#0f172a] p-3">
                    <div
                      className="relative overflow-hidden rounded-[20px] border border-white/10 bg-black"
                      style={{ aspectRatio: getSlotAspectRatio(previewSlotMeta, creativeViewport, selectedTypeMeta.aspectRatio).replace(':', ' / ') }}
                    >
                      <img
                        src={activeCreativeImage}
                        alt=""
                        className={`absolute inset-0 h-full w-full ${form.fitMode === 'contain' ? 'object-contain p-4' : 'object-cover'}`}
                        style={{
                          objectPosition: coverImageMeta.objectPosition,
                          transform: coverImageMeta.objectScale !== 1 ? `scale(${coverImageMeta.objectScale})` : undefined,
                          transformOrigin: coverImageMeta.objectPosition,
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#111827]/42 via-transparent to-[#111827]/42" />
                      <div className="absolute inset-[10%] border border-dashed border-white/45" />
                      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" />
                      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/25" />
                      <div
                        className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/15 shadow-[0_0_0_3px_rgba(0,0,0,0.2)]"
                        style={{ left: `${coverImageFocus.x}%`, top: `${coverImageFocus.y}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/70 bg-white/80 p-4">
                    <div>
                      <label className={labelCls}>Хоризонтален фокус</label>
                      <input type="range" min="0" max="100" step="1" value={coverImageFocus.x} onChange={(e) => setCoverFocusAxis('x', e.target.value)} className="w-full accent-sky-600" />
                    </div>
                    <div>
                      <label className={labelCls}>Вертикален фокус</label>
                      <input type="range" min="0" max="100" step="1" value={coverImageFocus.y} onChange={(e) => setCoverFocusAxis('y', e.target.value)} className="w-full accent-sky-600" />
                    </div>
                    <div>
                      <label className={labelCls}>Мащаб</label>
                      <input type="range" min="1" max="2.4" step="0.05" value={coverImageMeta.objectScale} onChange={(e) => updateCoverImageMeta({ objectScale: clampAdScale(e.target.value) })} className="w-full accent-sky-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-sky-950">
                      <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Фокус X</div>
                        <div className="mt-1 font-semibold">{Math.round(coverImageFocus.x)}%</div>
                      </div>
                      <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Фокус Y</div>
                        <div className="mt-1 font-semibold">{Math.round(coverImageFocus.y)}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { label: 'Ляво', action: () => setCoverFocusAxis('x', 0) },
                    { label: 'Център', action: () => setCoverFocusAxis('x', 50) },
                    { label: 'Дясно', action: () => setCoverFocusAxis('x', 100) },
                    { label: 'Горе', action: () => setCoverFocusAxis('y', 0) },
                    { label: 'Среда', action: () => setCoverFocusAxis('y', 50) },
                    { label: 'Долу', action: () => setCoverFocusAxis('y', 100) },
                    { label: '100%', action: () => updateCoverImageMeta({ objectScale: 1 }) },
                    { label: '125%', action: () => updateCoverImageMeta({ objectScale: 1.25 }) },
                    { label: '150%', action: () => updateCoverImageMeta({ objectScale: 1.5 }) },
                  ].map((control) => (
                    <button
                      key={control.label}
                      type="button"
                      onClick={control.action}
                      className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 transition-colors hover:border-sky-400 hover:text-sky-950"
                    >
                      {control.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateCoverImageMeta({ ...AD_DEFAULT_IMAGE_META })}
                    className="rounded-full border border-slate-200 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    Нулирай
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-5" ref={registerFieldRef('placements')} tabIndex={-1}>
              <div className="mb-3"><h3 className="font-semibold text-gray-900">{'Позиции'}</h3><p className="mt-1 text-xs text-gray-500">{'Избери slot-овете, в които рекламата може да участва.'}</p></div>
              <div className={`space-y-4 rounded-2xl ${getFieldError('placements') ? 'border border-red-200 bg-red-50/40 p-4' : ''}`}>{AD_PAGE_TYPES.map((pageType) => <div key={pageType} className="border border-gray-200 p-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">{PAGE_TYPE_LABELS[pageType]}</p><div className="space-y-2">{AD_SLOT_DEFINITIONS.filter((slot) => slot.pageType === pageType).map((slot) => { const checked = form.placements.includes(slot.id); const disabled = slot.variant !== form.type; return <label key={slot.id} className={`flex items-start gap-3 border p-3 ${checked ? 'border-zn-purple bg-zn-purple/5' : 'border-gray-200'} ${disabled ? 'opacity-40' : ''} ${getFieldError('placements') ? 'focus-within:border-red-400' : ''}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => handleToggle('placements', slot.id)} className="mt-1" aria-invalid={getFieldError('placements') ? 'true' : 'false'} aria-describedby={getFieldError('placements') ? 'ad-placements-error' : undefined} /><span><span className="block text-sm font-semibold text-gray-900">{slot.label}</span><span className="block text-xs text-gray-500">{slot.description}</span><span className="mt-1 block text-[11px] text-gray-400">{'Формат: '}{AD_TYPE_LABELS[slot.variant]}</span></span></label>; })}</div></div>)}</div>
              {getFieldError('placements') && <p id="ad-placements-error" className="mt-3 text-xs text-red-600">{getFieldError('placements')}</p>}
            </div>

            <div className="border-t border-gray-200 pt-5">
              <div className="mb-3"><h3 className="font-semibold text-gray-900">Targeting</h3><p className="mt-1 text-xs text-gray-500">{'Остави празно за широк delivery, или ограничи по page type, категории и конкретни статии.'}</p></div>
              <div className="space-y-4">
                <div><label className={labelCls}>Page types</label><div className="flex flex-wrap gap-2">{AD_PAGE_TYPES.map((pageType) => <button key={pageType} type="button" onClick={() => handleToggle('pageTypes', pageType)} className={`px-3 py-1.5 border text-xs font-semibold uppercase tracking-wider ${form.pageTypes.includes(pageType) ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-200 text-gray-700'}`}>{PAGE_TYPE_LABELS[pageType]}</button>)}</div></div>
                <div><label className={labelCls}>{'Категории'}</label><div className="flex flex-wrap gap-2">{(Array.isArray(categories) ? categories : []).filter((category) => category.id !== 'all').map((category) => <button key={category.id} type="button" onClick={() => handleToggle('categoryIds', category.id)} className={`px-3 py-1.5 border text-xs font-semibold ${form.categoryIds.includes(category.id) ? 'border-zn-purple bg-zn-purple text-white' : 'border-gray-200 text-gray-700'}`}>{category.name}</button>)}</div></div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>
    <label className={labelCls}>Article IDs</label>
    <input className={inputCls} value={form.articleIdsInput} onChange={(e) => setForm({ ...form, articleIdsInput: e.target.value })} placeholder="12, 25, 108" />
    {selectedArticleIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{selectedArticleIds.map((id) => <span key={id} className="bg-gray-100 px-2 py-1 text-[11px] text-gray-600">#{id} {articlesById.get(id)?.title || 'Непозната статия'}</span>)}</div>}
  </div>
  <div>
    <label className={labelCls}>Exclude article IDs</label>
    <input className={inputCls} value={form.excludeArticleIdsInput} onChange={(e) => setForm({ ...form, excludeArticleIdsInput: e.target.value })} placeholder="45, 77" />
    <p className="mt-1 text-[11px] text-gray-500">{'Ако статията е в този списък, рекламата няма да се покаже.'}</p>
  </div>
  <div className="md:col-span-2">
    <label className={labelCls}>Exclude category IDs</label>
    <input className={inputCls} value={form.excludeCategoryIdsInput} onChange={(e) => setForm({ ...form, excludeCategoryIdsInput: e.target.value })} placeholder="crime, business" />
    <p className="mt-1 text-[11px] text-gray-500">{'Ако категорията съвпадне, този ad се изключва от delivery-то.'}</p>
  </div>
</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-gray-200 pt-5 md:grid-cols-2" ref={registerFieldRef('schedule')}>
              <div><label className={labelCls}>Priority</label><input type="number" className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /><p className="mt-1 text-[11px] text-gray-500">{'По-високата стойност печели над по-ниската на същия slot.'}</p></div>
              <div><label className={labelCls}>Weight</label><input type="number" min="1" className={inputCls} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /><p className="mt-1 text-[11px] text-gray-500">{'Weight влияе само ако има ротация.'}</p></div>
              <div><label className={labelCls}>Start</label><input type="datetime-local" className={getInputClassName('schedule')} value={form.startAt} onChange={(e) => { clearFormError(); setForm({ ...form, startAt: e.target.value }); }} aria-invalid={getFieldError('schedule') ? 'true' : 'false'} aria-describedby={getFieldError('schedule') ? 'ad-schedule-error' : undefined} /></div>
              <div><label className={labelCls}>End</label><input type="datetime-local" className={getInputClassName('schedule')} value={form.endAt} onChange={(e) => { clearFormError(); setForm({ ...form, endAt: e.target.value }); }} aria-invalid={getFieldError('schedule') ? 'true' : 'false'} aria-describedby={getFieldError('schedule') ? 'ad-schedule-error' : undefined} /></div>
              {getFieldError('schedule') && <div className="md:col-span-2"><p id="ad-schedule-error" className="text-xs text-red-600">{getFieldError('schedule')}</p></div>}
              <div className="md:col-span-2"><label className={labelCls}>{'Бележки'}</label><textarea className={`${inputCls} min-h-[110px]`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={'Вътрешни бележки за екипа'} /></div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} aria-busy={saving} className="flex items-center gap-2 bg-zn-purple px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Записване...' : 'Запази'}</button>
              <button onClick={() => { setEditing(null); setError(''); }} className="flex items-center gap-2 border border-gray-200 px-5 py-2 text-sm text-gray-600"><X className="h-4 w-4" />{'Отказ'}</button>
            </div>
          </div>

          <div className="space-y-4">
                        <div className="border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2"><Eye className="h-4 w-4 text-gray-500" /><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Preview</p></div>
              {previewSlotOptions.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {previewSlotOptions.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setPreviewSlotId(slot.id)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${previewSlotMeta?.id === slot.id ? "border-zn-purple bg-zn-purple text-white" : "border-gray-200 bg-white text-gray-600 hover:border-zn-purple/40 hover:text-zn-purple"}`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-gray-200 bg-[#faf6ee] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      <span>Desktop preview</span>
                      <span>{previewSlotMeta?.desktopAspectRatio || selectedTypeMeta.aspectRatio}</span>
                    </div>
                    <div className="newspaper-page bg-[#EDE6DA] p-3 overflow-visible"><PreviewBanner ad={previewAd} slotMeta={previewSlotMeta} showSafeArea viewport="desktop" /></div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-[#faf6ee] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      <span>Mobile preview</span>
                      <span>{previewSlotMeta?.mobileAspectRatio || '4:1'}</span>
                    </div>
                    <div className="mx-auto max-w-[22rem] newspaper-page bg-[#EDE6DA] p-3 overflow-visible"><PreviewBanner ad={previewAd} slotMeta={previewSlotMeta} showSafeArea viewport="mobile" /></div>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fbfaf7] p-4 text-xs text-gray-600">
                  <p className="font-semibold uppercase tracking-wider text-gray-500">Creative delivery</p>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">Desktop: {previewAd.imageDesktop || previewAd.image ? 'Има creative' : 'Няма creative'}</div>
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">Mobile: {previewAd.imageMobile ? 'Отделен mobile creative' : 'Ще падне към desktop fallback'}</div>
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">Fit mode: {form.fitMode}</div>
                    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">Active editor: {creativeViewport === 'mobile' ? 'Mobile' : 'Десктоп'}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-xs text-gray-600">
                <div>
                  <p className="font-semibold text-gray-900">{'Позиции'}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selectedSlots.length > 0 ? selectedSlots.map((slot) => <span key={slot.id} className="border border-gray-200 bg-gray-100 px-2 py-1">{slot.label}</span>) : <span className="text-gray-400">{'Няма избрани позиции'}</span>}
                  </div>
                </div>
                {previewSlotMeta && (
                  <div>
                    <p className="font-semibold text-gray-900">Контекст</p>
                    <p>{`${previewSlotMeta.label} (${previewSlotMeta.id})`}</p>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">Targeting</p>
                  <p>{summarizeTargeting(previewAd, categoriesById, articlesById)}</p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2"><Info className="h-4 w-4 text-gray-500" /><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{'Как работи'}</p></div>
              <div className="space-y-2 text-sm text-gray-600">{DELIVERY_RULES.map((rule) => <div key={rule} className="border border-gray-200 bg-gray-50 px-3 py-2">{rule}</div>)}</div>
              {slotPreview.length > 0 && <div className="mt-4 space-y-2">{slotPreview.map(({ slot, message }) => <div key={slot.id} className="border border-gray-200 px-3 py-2 text-sm text-gray-600"><div className="font-semibold text-gray-900">{slot.label}</div><div className="mt-1">{message}</div></div>)}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {normalizedAds.map((ad) => {
          const metrics = analyticsByAdId.get(Number(ad.id)) || { impressions: 0, clicks: 0, ctr: 0, lastImpressionAt: null, lastClickAt: null };
          return <div key={ad.id} className="border border-gray-200 bg-white"><div className="relative overflow-hidden p-4 text-white" style={{ backgroundColor: ad.color || '#990F3D' }}>{ad.image && <img src={ad.image} alt="" className={`absolute inset-0 h-full w-full object-cover ${ad.imagePlacement === 'cover' ? 'opacity-100' : 'opacity-30'}`} style={getAdAdminCardImageStyle(ad)} />}<div className="relative z-10 flex items-center gap-2"><span className="text-xl">{ad.icon}</span><div><p className="text-sm font-bold">{ad.campaignName || ad.title}</p><p className="text-xs opacity-90">{ad.subtitle}</p></div></div>{ad.showButton !== false && ad.clickable !== false ? <span className="relative z-10 mt-3 inline-block bg-white/20 px-3 py-1 text-xs font-semibold">{ad.cta}</span> : <span className="relative z-10 mt-3 inline-block bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">{'Без бутон'}</span>}</div><div className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><span className="bg-gray-100 px-1.5 py-0.5 text-gray-600">{AD_TYPE_LABELS[ad.type] || ad.type}</span><span className="bg-gray-100 px-1.5 py-0.5 text-gray-600">{AD_STATUS_LABELS[ad.status] || ad.status}</span><span className="bg-blue-100 px-1.5 py-0.5 text-blue-700">P {ad.priority}</span><span className="bg-violet-100 px-1.5 py-0.5 text-violet-700">W {ad.weight}</span>{ad.clickable !== false && ad.link && ad.link !== '#' && <a href={ad.link} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-zn-hot"><ExternalLink className="h-3.5 w-3.5" /></a>}{ad.image && <span className="bg-purple-100 px-1.5 py-0.5 text-purple-700"><ImageIcon className="mr-0.5 inline h-3 w-3" />media</span>}</div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">{'Позиции'}</p><div className="flex flex-wrap gap-1.5">{ad.placements.map((placement) => <span key={placement} className="bg-gray-100 px-2 py-1 text-[11px] text-gray-600">{AD_SLOT_DEFINITIONS.find((slot) => slot.id === placement)?.label || placement}</span>)}</div></div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Targeting</p><p className="text-sm text-gray-600">{summarizeTargeting(ad, categoriesById, articlesById)}</p></div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Analytics</p><div className="grid grid-cols-3 gap-2 text-xs text-gray-600"><div className="border border-gray-200 p-2"><div className="text-[10px] uppercase tracking-wider text-gray-400">Impr.</div><div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : metrics.impressions}</div></div><div className="border border-gray-200 p-2"><div className="text-[10px] uppercase tracking-wider text-gray-400">Clicks</div><div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : metrics.clicks}</div></div><div className="border border-gray-200 p-2"><div className="text-[10px] uppercase tracking-wider text-gray-400">CTR</div><div className="font-semibold text-gray-900">{analyticsSummary.loading ? '...' : `${metrics.ctr}%`}</div></div></div></div><div className="flex items-center gap-1 border-t border-gray-100 pt-2"><button onClick={() => { setError(''); setEditing(ad.id); setCreativeViewport('desktop'); setForm(normalizeAdForm(ad)); }} className="p-1.5 text-gray-400 hover:text-zn-hot"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDelete(ad.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></div></div>;
        })}
        {normalizedAds.length === 0 && <div className="col-span-full py-12 text-center text-sm text-gray-400">{'Няма реклами'}</div>}
      </div>
    </div>
  );
}
