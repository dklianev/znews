const QUICK_COMMAND_TARGETS = new Set([
  '/admin',
  '/admin/intake',
  '/admin/articles',
  '/admin/classifieds',
  '/admin/site-settings',
  '/admin/diagnostics',
  '/admin/audit-log',
]);

function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesQuery(parts, query) {
  if (!query) return true;
  return parts
    .filter(Boolean)
    .some((part) => normalizeQuery(part).includes(query));
}

function isVisibleNavItem(item, canAccess) {
  if (!item || item.type === 'divider' || !item.to) return false;
  if (!item.permission) return true;
  return canAccess(item.permission);
}

function buildScreenItems(navItems, canAccess) {
  return (Array.isArray(navItems) ? navItems : [])
    .filter((item) => isVisibleNavItem(item, canAccess))
    .map((item) => ({
      key: `screen:${item.to}`,
      to: item.to,
      label: item.label,
      description: QUICK_COMMAND_TARGETS.has(item.to)
        ? 'Бърза команда'
        : 'Отваря секцията',
      group: QUICK_COMMAND_TARGETS.has(item.to) ? 'Бързи команди' : 'Екрани',
      keywords: [
        item.label,
        item.to,
        ...(Array.isArray(item.searchTerms) ? item.searchTerms : []),
      ],
    }));
}

function buildIdSearchItems(query, canAccess) {
  if (!/^\d+$/.test(query)) return [];

  const id = String(Number.parseInt(query, 10));
  const items = [];

  if (canAccess('articles')) {
    items.push(
      {
        key: `id:article:${id}`,
        to: `/admin/articles?q=${id}`,
        label: `Статия #${id}`,
        description: 'Отваря статии, филтрирани по ID',
        group: 'Търсене по ID',
        keywords: ['статия', 'article', id],
      },
      {
        key: `id:tip:${id}`,
        to: `/admin/intake?source=tip&q=${id}`,
        label: `Сигнал #${id}`,
        description: 'Отваря входящата опашка за конкретен сигнал',
        group: 'Търсене по ID',
        keywords: ['сигнал', 'tip', id],
      },
    );
  }

  if (canAccess('contact')) {
    items.push({
      key: `id:contact:${id}`,
      to: `/admin/intake?source=contact&q=${id}`,
      label: `Запитване #${id}`,
      description: 'Отваря входящата опашка за конкретно запитване',
      group: 'Търсене по ID',
      keywords: ['запитване', 'contact', id],
    });
  }

  if (canAccess('classifieds')) {
    items.push({
      key: `id:classified:${id}`,
      to: `/admin/classifieds?q=${id}`,
      label: `Обява #${id}`,
      description: 'Отваря малки обяви, филтрирани по ID',
      group: 'Търсене по ID',
      keywords: ['обява', 'classified', id],
    });
  }

  if (canAccess('permissions')) {
    items.push({
      key: `id:audit:${id}`,
      to: `/admin/audit-log?q=${id}`,
      label: `Журнал за #${id}`,
      description: 'Търси действия по ID в журнала',
      group: 'Търсене по ID',
      keywords: ['журнал', 'audit', id],
    });
  }

  return items;
}

export function buildAdminCommandItems({ navItems, canAccess, query = '' }) {
  const normalizedQuery = normalizeQuery(query);
  const screenItems = buildScreenItems(navItems, canAccess);
  const idItems = buildIdSearchItems(normalizedQuery, canAccess);

  const filteredScreenItems = screenItems.filter((item) => (
    matchesQuery([item.label, item.description, ...item.keywords], normalizedQuery)
  ));

  const orderedItems = normalizedQuery
    ? [...idItems, ...filteredScreenItems]
    : [
      ...filteredScreenItems.filter((item) => item.group === 'Бързи команди'),
      ...filteredScreenItems.filter((item) => item.group === 'Екрани'),
    ];

  const seenKeys = new Set();
  return orderedItems.filter((item) => {
    if (seenKeys.has(item.key)) return false;
    seenKeys.add(item.key);
    return true;
  });
}
