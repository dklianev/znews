import { useEffect, useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Save, Plus, Trash2, RotateCcw, ShieldAlert, History, AlertTriangle } from 'lucide-react';
import { COMIC_LAYOUT_PRESET_OPTIONS } from '../../utils/comicCardDesign';

const DEFAULT_SETTINGS = {
  navbarLinks: [
    { to: '/', label: 'Начало', hot: false },
    { to: '/category/crime', label: 'Криминални', hot: true },
    { to: '/category/underground', label: 'Подземен свят', hot: true },
    { to: '/category/emergency', label: 'Полиция', hot: false },
    { to: '/category/reportage', label: 'Репортажи', hot: false },
    { to: '/category/politics', label: 'Политика', hot: false },
    { to: '/category/business', label: 'Бизнес', hot: false },
    { to: '/category/society', label: 'Общество', hot: false },
    { to: '/jobs', label: 'Работа', hot: false },
    { to: '/court', label: 'Съд', hot: false },
    { to: '/events', label: 'Събития', hot: false },
    { to: '/gallery', label: 'Галерия', hot: false },
  ],
  spotlightLinks: [
    { to: '/category/crime', label: 'Горещо', icon: 'Flame', hot: true, tilt: '-2deg' },
    { to: '/category/underground', label: 'Скандали', icon: 'Megaphone', hot: true, tilt: '1.5deg' },
    { to: '/category/society', label: 'Слухове', icon: 'Bell', hot: false, tilt: '-1deg' },
  ],
  footerPills: [
    { to: '/category/crime', label: 'Горещо', hot: true, tilt: '-1.5deg' },
    { to: '/category/underground', label: 'Скандали', hot: true, tilt: '1deg' },
    { to: '/category/society', label: 'Слухове', hot: false, tilt: '-0.8deg' },
    { to: '/category/crime', label: 'Криминални', hot: false, tilt: '0.8deg' },
    { to: '/category/business', label: 'Бизнес', hot: false, tilt: '-1deg' },
  ],
  footerQuickLinks: [
    { to: '/category/crime', label: 'Криминални' },
    { to: '/category/underground', label: 'Подземен свят' },
    { to: '/category/emergency', label: 'Полиция' },
    { to: '/category/politics', label: 'Политика' },
    { to: '/category/business', label: 'Бизнес' },
    { to: '/category/society', label: 'Общество' },
  ],
  footerInfoLinks: [
    { to: '/about', label: 'За нас' },
    { to: '/jobs', label: 'Работа' },
    { to: '/court', label: 'Съдебна хроника' },
    { to: '/events', label: 'Събития' },
    { to: '/gallery', label: 'Галерия' },
  ],
  contact: {
    address: 'Vinewood Blvd 42, Los Santos',
    phone: '+381 11 123 4567',
    email: 'redakciq@znews.live',
  },
  about: {
    heroText: 'Независим новинарски портал за града Los Santos. Доставяме ви новини, репортажи и разследвания 24 часа в денонощието, 7 дни в седмицата.',
    missionTitle: 'Нашата мисия',
    missionParagraph1: 'zNews е създаден с целта да предостави на гражданите на Los Santos честна, навременна и безпристрастна информация за случващото се в града. Ние вярваме в силата на журналистиката да информира, образова и вдъхновява промяна.',
    missionParagraph2: 'Нашият екип от опитни журналисти работи денонощно, за да покрива всички аспекти на живота в Los Santos — от криминалните хроники до обществените събития, от бизнес новините до спортните триумфи.',
    adIntro: 'Искаш да рекламираш своя бизнес в Los Santos? zNews предлага разнообразни рекламни формати:',
    adPlans: [
      { name: 'Банер (горен)', price: '$500/месец', desc: 'Хоризонтален банер в горната част' },
      { name: 'Банер (страничен)', price: '$300/месец', desc: 'Странично каре в sidebar' },
      { name: 'Банер (в статия)', price: '$400/месец', desc: 'Вграден в съдържанието' },
    ],
  },
  layoutPresets: {
    homeFeatured: 'default',
    homeCrime: 'default',
    homeReportage: 'default',
    homeEmergency: 'default',
    articleRelated: 'default',
    categoryListing: 'default',
    searchListing: 'default',
  },
};

const SPOTLIGHT_ICON_OPTIONS = ['Flame', 'Megaphone', 'Bell', 'Siren', 'Zap', 'Newspaper', 'ShieldAlert'];

function resolveSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const filterRemovedCategories = (links) => links.filter((item) => item?.to !== '/category/sports');
  return {
    navbarLinks: filterRemovedCategories(
      Array.isArray(input.navbarLinks) && input.navbarLinks.length > 0 ? input.navbarLinks : DEFAULT_SETTINGS.navbarLinks
    ),
    spotlightLinks: Array.isArray(input.spotlightLinks) && input.spotlightLinks.length > 0 ? input.spotlightLinks : DEFAULT_SETTINGS.spotlightLinks,
    footerPills: Array.isArray(input.footerPills) && input.footerPills.length > 0 ? input.footerPills : DEFAULT_SETTINGS.footerPills,
    footerQuickLinks: filterRemovedCategories(
      Array.isArray(input.footerQuickLinks) && input.footerQuickLinks.length > 0 ? input.footerQuickLinks : DEFAULT_SETTINGS.footerQuickLinks
    ),
    footerInfoLinks: Array.isArray(input.footerInfoLinks) && input.footerInfoLinks.length > 0 ? input.footerInfoLinks : DEFAULT_SETTINGS.footerInfoLinks,
    contact: {
      ...DEFAULT_SETTINGS.contact,
      ...(input.contact || {}),
    },
    about: {
      ...DEFAULT_SETTINGS.about,
      ...(input.about || {}),
      adPlans: Array.isArray(input?.about?.adPlans) && input.about.adPlans.length > 0
        ? input.about.adPlans
        : DEFAULT_SETTINGS.about.adPlans,
    },
    layoutPresets: {
      ...DEFAULT_SETTINGS.layoutPresets,
      ...(input.layoutPresets || {}),
    },
  };
}

export default function ManageSiteSettings() {
  const {
    session,
    siteSettings,
    siteSettingsRevisions,
    saveSiteSettings,
    loadSiteSettingsRevisions,
    restoreSiteSettingsRevision,
    hasPermission,
  } = useData();
  const [form, setForm] = useState(resolveSettings(siteSettings));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [restoringHistory, setRestoringHistory] = useState(null);

  useEffect(() => {
    setForm(resolveSettings(siteSettings));
  }, [siteSettings]);

  useEffect(() => {
    if (!session?.token) return undefined;
    if (!hasPermission('permissions')) return undefined;
    let cancelled = false;
    setLoadingHistory(true);
    loadSiteSettingsRevisions()
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Грешка при зареждане на Site settings историята');
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasPermission, loadSiteSettingsRevisions, session?.token]);

  const listSectionCls = 'bg-white border border-gray-200 p-5 space-y-3';
  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';
  const tinyLabelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';

  const canEdit = useMemo(() => hasPermission('permissions'), [hasPermission]);

  const updateListItem = (key, index, field, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const removeListItem = (key, index) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));
  };

  const addListItem = (key, template) => {
    setForm((prev) => ({
      ...prev,
      [key]: [...prev[key], template],
    }));
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await saveSiteSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e?.message || 'Грешка при запазване на Site настройките');
      console.error('Failed to save site settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreHistory = async (revisionId) => {
    if (!revisionId) return;
    if (!confirm('Да върна тази Site версия? Текущите незапазени промени ще бъдат заменени.')) return;
    setRestoringHistory(revisionId);
    setError('');
    try {
      await restoreSiteSettingsRevision(revisionId);
    } catch (e) {
      setError(e?.message || 'Грешка при възстановяване на Site версия');
      console.error('Failed to restore site settings revision:', e);
    } finally {
      setRestoringHistory(null);
    }
  };

  if (!canEdit) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-sans text-red-700 font-semibold">Нямате достъп до тази страница</p>
          <p className="font-sans text-red-500 text-sm mt-1">Нужни са права за управление на permissions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Site настройки</h1>
          <p className="text-sm font-sans text-gray-500 mt-1">Navbar, Footer и About съдържание от админ панела</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setForm(resolveSettings(DEFAULT_SETTINGS))}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-sans hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Default
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-zn-purple text-white text-sm font-sans font-semibold hover:bg-zn-purple-dark transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Запис...' : saved ? 'Записано' : 'Запази'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <section className={listSectionCls}>
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-2 text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
            <History className="w-3.5 h-3.5" />
            Site settings revisions
          </div>
          <button
            onClick={async () => {
              setLoadingHistory(true);
              setError('');
              try {
                await loadSiteSettingsRevisions();
              } catch (e) {
                setError(e?.message || 'Грешка при зареждане на Site settings историята');
                console.error('Failed to load site settings revisions:', e);
              } finally {
                setLoadingHistory(false);
              }
            }}
            className="text-xs font-sans font-semibold text-zn-purple hover:text-zn-purple-dark transition-colors"
          >
            Обнови
          </button>
        </div>
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {loadingHistory && <p className="text-xs font-sans text-gray-400 py-2">Зареждане на версии...</p>}
          {!loadingHistory && siteSettingsRevisions.slice(0, 30).map((revision) => (
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
          {!loadingHistory && siteSettingsRevisions.length === 0 && (
            <p className="text-xs font-sans text-gray-400 py-2">Няма запазени версии на Site settings.</p>
          )}
        </div>
      </section>

      <section className={listSectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="font-sans font-semibold text-gray-900">Navbar links</h2>
          <button onClick={() => addListItem('navbarLinks', { to: '/', label: '', hot: false })} className="text-xs font-sans text-zn-hot inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Добави
          </button>
        </div>
        {form.navbarLinks.map((item, index) => (
          <div key={`navbar-${index}`} className="grid grid-cols-1 md:grid-cols-[1.2fr_2fr_auto_auto] gap-2 items-end">
            <div>
              <label className={tinyLabelCls}>Label</label>
              <input className={inputCls} value={item.label || ''} onChange={(e) => updateListItem('navbarLinks', index, 'label', e.target.value)} />
            </div>
            <div>
              <label className={tinyLabelCls}>Path</label>
              <input className={inputCls} value={item.to || ''} onChange={(e) => updateListItem('navbarLinks', index, 'to', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm font-sans text-gray-700 px-2 pb-2">
              <input type="checkbox" checked={Boolean(item.hot)} onChange={(e) => updateListItem('navbarLinks', index, 'hot', e.target.checked)} className="w-4 h-4 accent-zn-purple" />
              Hot
            </label>
            <button onClick={() => removeListItem('navbarLinks', index)} className="mb-1 p-2 text-gray-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </section>

      <section className={listSectionCls}>
        <h2 className="font-sans font-semibold text-gray-900">Card layout presets</h2>
        <p className="text-xs font-sans text-gray-500">Избира visual preset за всяка card секция.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'homeFeatured', label: 'Home / Горещо от редакцията' },
            { key: 'homeCrime', label: 'Home / Криминални' },
            { key: 'homeReportage', label: 'Home / Репортажи' },
            { key: 'homeEmergency', label: 'Home / Полиция' },
            { key: 'articleRelated', label: 'Статия / Свързани новини' },
            { key: 'categoryListing', label: 'Категория / Карти' },
            { key: 'searchListing', label: 'Търсене / Карти' },
          ].map((item) => (
            <div key={item.key}>
              <label className={tinyLabelCls}>{item.label}</label>
              <select
                className={inputCls}
                value={form.layoutPresets?.[item.key] || 'default'}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  layoutPresets: {
                    ...(prev.layoutPresets || {}),
                    [item.key]: e.target.value,
                  },
                }))}
              >
                {COMIC_LAYOUT_PRESET_OPTIONS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className={listSectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="font-sans font-semibold text-gray-900">Spotlight chips</h2>
          <button onClick={() => addListItem('spotlightLinks', { to: '/', label: '', icon: 'Flame', hot: false, tilt: '0deg' })} className="text-xs font-sans text-zn-hot inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Добави
          </button>
        </div>
        {form.spotlightLinks.map((item, index) => (
          <div key={`spot-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr_1fr_1fr_auto_auto] gap-2 items-end">
            <div>
              <label className={tinyLabelCls}>Label</label>
              <input className={inputCls} value={item.label || ''} onChange={(e) => updateListItem('spotlightLinks', index, 'label', e.target.value)} />
            </div>
            <div>
              <label className={tinyLabelCls}>Path</label>
              <input className={inputCls} value={item.to || ''} onChange={(e) => updateListItem('spotlightLinks', index, 'to', e.target.value)} />
            </div>
            <div>
              <label className={tinyLabelCls}>Icon</label>
              <select className={inputCls} value={item.icon || 'Flame'} onChange={(e) => updateListItem('spotlightLinks', index, 'icon', e.target.value)}>
                {SPOTLIGHT_ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
              </select>
            </div>
            <div>
              <label className={tinyLabelCls}>Tilt</label>
              <input className={inputCls} value={item.tilt || '0deg'} onChange={(e) => updateListItem('spotlightLinks', index, 'tilt', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm font-sans text-gray-700 px-2 pb-2">
              <input type="checkbox" checked={Boolean(item.hot)} onChange={(e) => updateListItem('spotlightLinks', index, 'hot', e.target.checked)} className="w-4 h-4 accent-zn-purple" />
              Hot
            </label>
            <button onClick={() => removeListItem('spotlightLinks', index)} className="mb-1 p-2 text-gray-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </section>

      <section className={listSectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="font-sans font-semibold text-gray-900">Footer pills</h2>
          <button onClick={() => addListItem('footerPills', { to: '/', label: '', hot: false, tilt: '0deg' })} className="text-xs font-sans text-zn-hot inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Добави
          </button>
        </div>
        {form.footerPills.map((item, index) => (
          <div key={`pill-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr_1fr_auto_auto] gap-2 items-end">
            <div>
              <label className={tinyLabelCls}>Label</label>
              <input className={inputCls} value={item.label || ''} onChange={(e) => updateListItem('footerPills', index, 'label', e.target.value)} />
            </div>
            <div>
              <label className={tinyLabelCls}>Path</label>
              <input className={inputCls} value={item.to || ''} onChange={(e) => updateListItem('footerPills', index, 'to', e.target.value)} />
            </div>
            <div>
              <label className={tinyLabelCls}>Tilt</label>
              <input className={inputCls} value={item.tilt || '0deg'} onChange={(e) => updateListItem('footerPills', index, 'tilt', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm font-sans text-gray-700 px-2 pb-2">
              <input type="checkbox" checked={Boolean(item.hot)} onChange={(e) => updateListItem('footerPills', index, 'hot', e.target.checked)} className="w-4 h-4 accent-zn-purple" />
              Hot
            </label>
            <button onClick={() => removeListItem('footerPills', index)} className="mb-1 p-2 text-gray-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </section>

      <section className={listSectionCls}>
        <h2 className="font-sans font-semibold text-gray-900">Footer quick/info links</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-sans font-semibold text-gray-700">Рубрики</h3>
              <button onClick={() => addListItem('footerQuickLinks', { to: '/', label: '' })} className="text-xs font-sans text-zn-hot inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Добави
              </button>
            </div>
            {form.footerQuickLinks.map((item, index) => (
              <div key={`quick-${index}`} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-end">
                <input className={inputCls} value={item.label || ''} onChange={(e) => updateListItem('footerQuickLinks', index, 'label', e.target.value)} placeholder="Label" />
                <input className={inputCls} value={item.to || ''} onChange={(e) => updateListItem('footerQuickLinks', index, 'to', e.target.value)} placeholder="/path" />
                <button onClick={() => removeListItem('footerQuickLinks', index)} className="p-2 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-sans font-semibold text-gray-700">Информация</h3>
              <button onClick={() => addListItem('footerInfoLinks', { to: '/', label: '' })} className="text-xs font-sans text-zn-hot inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Добави
              </button>
            </div>
            {form.footerInfoLinks.map((item, index) => (
              <div key={`info-${index}`} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-end">
                <input className={inputCls} value={item.label || ''} onChange={(e) => updateListItem('footerInfoLinks', index, 'label', e.target.value)} placeholder="Label" />
                <input className={inputCls} value={item.to || ''} onChange={(e) => updateListItem('footerInfoLinks', index, 'to', e.target.value)} placeholder="/path" />
                <button onClick={() => removeListItem('footerInfoLinks', index)} className="p-2 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={listSectionCls}>
        <h2 className="font-sans font-semibold text-gray-900">Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={tinyLabelCls}>Адрес</label>
            <input className={inputCls} value={form.contact.address || ''} onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, address: e.target.value } }))} />
          </div>
          <div>
            <label className={tinyLabelCls}>Телефон</label>
            <input className={inputCls} value={form.contact.phone || ''} onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, phone: e.target.value } }))} />
          </div>
          <div>
            <label className={tinyLabelCls}>Email</label>
            <input className={inputCls} value={form.contact.email || ''} onChange={(e) => setForm((prev) => ({ ...prev, contact: { ...prev.contact, email: e.target.value } }))} />
          </div>
        </div>
      </section>

      <section className={listSectionCls}>
        <h2 className="font-sans font-semibold text-gray-900">About page</h2>
        <div className="space-y-4">
          <div>
            <label className={tinyLabelCls}>Hero текст</label>
            <textarea className={`${inputCls} h-20 resize-y`} value={form.about.heroText || ''} onChange={(e) => setForm((prev) => ({ ...prev, about: { ...prev.about, heroText: e.target.value } }))} />
          </div>
          <div>
            <label className={tinyLabelCls}>Мисия заглавие</label>
            <input className={inputCls} value={form.about.missionTitle || ''} onChange={(e) => setForm((prev) => ({ ...prev, about: { ...prev.about, missionTitle: e.target.value } }))} />
          </div>
          <div>
            <label className={tinyLabelCls}>Мисия абзац 1</label>
            <textarea className={`${inputCls} h-24 resize-y`} value={form.about.missionParagraph1 || ''} onChange={(e) => setForm((prev) => ({ ...prev, about: { ...prev.about, missionParagraph1: e.target.value } }))} />
          </div>
          <div>
            <label className={tinyLabelCls}>Мисия абзац 2</label>
            <textarea className={`${inputCls} h-24 resize-y`} value={form.about.missionParagraph2 || ''} onChange={(e) => setForm((prev) => ({ ...prev, about: { ...prev.about, missionParagraph2: e.target.value } }))} />
          </div>
          <div>
            <label className={tinyLabelCls}>Реклама intro</label>
            <textarea className={`${inputCls} h-20 resize-y`} value={form.about.adIntro || ''} onChange={(e) => setForm((prev) => ({ ...prev, about: { ...prev.about, adIntro: e.target.value } }))} />
          </div>
        </div>
      </section>

      <section className={listSectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="font-sans font-semibold text-gray-900">About рекламни планове</h2>
          <button onClick={() => setForm((prev) => ({ ...prev, about: { ...prev.about, adPlans: [...prev.about.adPlans, { name: '', price: '', desc: '' }] } }))} className="text-xs font-sans text-zn-hot inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Добави
          </button>
        </div>
        {form.about.adPlans.map((plan, index) => (
          <div key={`plan-${index}`} className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_2fr_auto] gap-2 items-end">
            <div>
              <label className={tinyLabelCls}>Име</label>
              <input className={inputCls} value={plan.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, about: { ...prev.about, adPlans: prev.about.adPlans.map((p, i) => i === index ? { ...p, name: e.target.value } : p) } }))} />
            </div>
            <div>
              <label className={tinyLabelCls}>Цена</label>
              <input className={inputCls} value={plan.price || ''} onChange={(e) => setForm((prev) => ({ ...prev, about: { ...prev.about, adPlans: prev.about.adPlans.map((p, i) => i === index ? { ...p, price: e.target.value } : p) } }))} />
            </div>
            <div>
              <label className={tinyLabelCls}>Описание</label>
              <input className={inputCls} value={plan.desc || ''} onChange={(e) => setForm((prev) => ({ ...prev, about: { ...prev.about, adPlans: prev.about.adPlans.map((p, i) => i === index ? { ...p, desc: e.target.value } : p) } }))} />
            </div>
            <button onClick={() => setForm((prev) => ({ ...prev, about: { ...prev.about, adPlans: prev.about.adPlans.filter((_, i) => i !== index) } }))} className="mb-1 p-2 text-gray-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
