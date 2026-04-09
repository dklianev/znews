import { useMemo } from 'react';
import RevisionComparePanel from './RevisionComparePanel';
import { buildRevisionCompare } from '../../utils/adminRevisionCompare';

function formatAdminLinkList(items, { includeHot = false, includeIcon = false, includeTilt = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) return '—';
  return items.map((item) => {
    const parts = [
      String(item?.label || '').trim() || 'Без етикет',
      String(item?.to || '').trim() || '—',
    ];
    if (includeIcon && item?.icon) parts.push(`икона: ${item.icon}`);
    if (includeHot) parts.push(item?.hot ? 'hot' : 'normal');
    if (includeTilt && item?.tilt) parts.push(`tilt: ${item.tilt}`);
    return parts.join(' · ');
  }).join('\n');
}

function formatAdPlans(plans) {
  if (!Array.isArray(plans) || plans.length === 0) return '—';
  return plans.map((plan) => {
    const name = String(plan?.name || '').trim() || 'Без име';
    const price = String(plan?.price || '').trim() || '—';
    const desc = String(plan?.desc || '').trim() || '—';
    return `${name} · ${price} · ${desc}`;
  }).join('\n');
}

function formatLayoutPresets(layoutPresets) {
  if (!layoutPresets || typeof layoutPresets !== 'object') return '—';
  const entries = Object.entries(layoutPresets)
    .filter(([, value]) => String(value || '').trim())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, 'bg-BG'));
  return entries.length > 0
    ? entries.map(([key, value]) => `${key}: ${value}`).join('\n')
    : '—';
}

function formatClassifiedTiers(tiers, currency) {
  if (!tiers || typeof tiers !== 'object') return '—';
  const symbol = String(currency || '$').trim() || '$';
  const orderedKeys = ['standard', 'highlighted', 'vip'];
  return orderedKeys.map((key) => {
    const tier = tiers[key] || {};
    const label = key === 'standard' ? 'Стандартна' : key === 'highlighted' ? 'Удебелена' : 'VIP';
    return `${label}: ${Number(tier.price) || 0}${symbol} / ${Number(tier.durationDays) || 0} дни / ${Number(tier.maxImages) || 0} снимки`;
  }).join('\n');
}

function formatEasterCampaign(easter) {
  if (!easter || typeof easter !== 'object') return '—';
  return [
    `режим: ${easter.enabled ? 'включен' : 'изключен'}`,
    `период: ${easter.autoWindow ? 'автоматичен' : `${easter.startAt || '—'} → ${easter.endAt || '—'}`}`,
    `декорации: ${easter.decorationsEnabled ? 'да' : 'не'}`,
    `комплект: ${easter.variantSet || 'classic'}`,
    `макс. яйца: ${Number(easter.maxVisibleEggs) || 0}`,
    `лов: ${easter.huntEnabled ? 'да' : 'не'}`,
    `брой hunt яйца: ${Number(easter.huntEggCount) || 0}`,
    `награда: ${String(easter.huntRewardText || '').trim() || '—'}`,
    `версия: ${Number(easter.huntVersion) || 1}`,
    `покажи progress badge: ${easter.showProgress ? 'да' : 'не'}`,
  ].join('\n');
}

const SITE_SETTINGS_REVISION_COMPARE_FIELDS = [
  { key: 'breakingBadgeLabel', label: 'Breaking badge', group: 'Основни' },
  { key: 'navbarLinks', label: 'Navbar връзки', group: 'Навигация', format: (value) => formatAdminLinkList(value, { includeHot: true }), normalize: (value) => formatAdminLinkList(value, { includeHot: true }) },
  { key: 'spotlightLinks', label: 'Spotlight chips', group: 'Навигация', format: (value) => formatAdminLinkList(value, { includeHot: true, includeIcon: true, includeTilt: true }), normalize: (value) => formatAdminLinkList(value, { includeHot: true, includeIcon: true, includeTilt: true }) },
  { key: 'footerPills', label: 'Footer pills', group: 'Футер', format: (value) => formatAdminLinkList(value, { includeHot: true, includeTilt: true }), normalize: (value) => formatAdminLinkList(value, { includeHot: true, includeTilt: true }) },
  { key: 'footerQuickLinks', label: 'Footer рубрики', group: 'Футер', format: (value) => formatAdminLinkList(value), normalize: (value) => formatAdminLinkList(value) },
  { key: 'footerInfoLinks', label: 'Footer информация', group: 'Футер', format: (value) => formatAdminLinkList(value), normalize: (value) => formatAdminLinkList(value) },
  { key: 'contact.address', label: 'Контактен адрес', group: 'Контакти' },
  { key: 'contact.phone', label: 'Контактен телефон', group: 'Контакти' },
  { key: 'contact.email', label: 'Контактен имейл', group: 'Контакти' },
  { key: 'about.heroText', label: 'About hero текст', group: 'About' },
  { key: 'about.missionTitle', label: 'Мисия заглавие', group: 'About' },
  { key: 'about.missionParagraph1', label: 'Мисия абзац 1', group: 'About' },
  { key: 'about.missionParagraph2', label: 'Мисия абзац 2', group: 'About' },
  { key: 'about.adIntro', label: 'Реклама intro', group: 'About' },
  { key: 'about.adPlans', label: 'Рекламни планове', group: 'About', format: (value) => formatAdPlans(value), normalize: (value) => formatAdPlans(value) },
  { key: 'layoutPresets', label: 'Layout presets', group: 'Layout', format: (value) => formatLayoutPresets(value), normalize: (value) => formatLayoutPresets(value) },
  { key: 'tipLinePromo.enabled', label: 'Tip line активен', group: 'Tip line', format: (value) => (value ? 'Да' : 'Не') },
  { key: 'tipLinePromo.title', label: 'Tip line заглавие', group: 'Tip line' },
  { key: 'tipLinePromo.description', label: 'Tip line описание', group: 'Tip line' },
  { key: 'tipLinePromo.buttonLabel', label: 'Tip line бутон', group: 'Tip line' },
  { key: 'tipLinePromo.buttonLink', label: 'Tip line линк', group: 'Tip line' },
  { key: 'classifieds.tiers', label: 'Пакети обяви', group: 'Обяви', format: (_value, snapshot) => formatClassifiedTiers(snapshot?.classifieds?.tiers, snapshot?.classifieds?.currency), normalize: (_value, snapshot) => formatClassifiedTiers(snapshot?.classifieds?.tiers, snapshot?.classifieds?.currency) },
  { key: 'classifieds.bumpPrice', label: 'Цена за bump', group: 'Обяви' },
  { key: 'classifieds.renewalDiscount', label: 'Отстъпка за подновяване', group: 'Обяви' },
  { key: 'classifieds.iban', label: 'IBAN / сметка', group: 'Обяви' },
  { key: 'classifieds.beneficiary', label: 'Получател', group: 'Обяви' },
  { key: 'classifieds.currency', label: 'Валута', group: 'Обяви' },
  { key: 'seasonalCampaigns.easter', label: 'Великденска кампания', group: 'Сезонни кампании', format: (value) => formatEasterCampaign(value), normalize: (value) => formatEasterCampaign(value) },
];

export default function SiteSettingsRevisionComparePanel({
  selectedRevisionIds,
  siteSettingsRevisions,
  currentSnapshot,
}) {
  const compare = useMemo(() => {
    if (!Array.isArray(selectedRevisionIds) || selectedRevisionIds.length === 0) return null;

    const leftRevision = siteSettingsRevisions.find((revision) => revision.revisionId === selectedRevisionIds[0]);
    const rightRevision = selectedRevisionIds[1]
      ? siteSettingsRevisions.find((revision) => revision.revisionId === selectedRevisionIds[1])
      : null;

    if (!leftRevision?.snapshot) return null;
    if (selectedRevisionIds[1] && !rightRevision?.snapshot) return null;

    return buildRevisionCompare({
      fields: SITE_SETTINGS_REVISION_COMPARE_FIELDS,
      leftSnapshot: leftRevision.snapshot,
      rightSnapshot: rightRevision?.snapshot || currentSnapshot,
      leftLabel: `v${leftRevision.version} (${leftRevision.source})`,
      rightLabel: rightRevision ? `v${rightRevision.version} (${rightRevision.source})` : 'Текуща форма',
    });
  }, [currentSnapshot, selectedRevisionIds, siteSettingsRevisions]);

  return (
    <RevisionComparePanel
      title="Сравнение на Site settings версии"
      subtitle={selectedRevisionIds.length === 1 ? 'Избраната версия се сравнява с текущата форма.' : 'Избери една или две версии, за да видиш разликите.'}
      compare={compare}
      emptyMessage="Избери една или две версии от списъка горе."
    />
  );
}
