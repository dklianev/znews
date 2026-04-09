const INTAKE_SOURCE_META = Object.freeze({
  tip: {
    label: 'Сигнал',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  contact: {
    label: 'Запитване',
    className: 'bg-sky-100 text-sky-700 border-sky-200',
  },
});

const INTAKE_REQUEST_KIND_META = Object.freeze({
  general: {
    label: 'Общо запитване',
    className: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  correction: {
    label: 'Корекция',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  right_of_reply: {
    label: 'Право на отговор',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
});

const INTAKE_STATUS_META = Object.freeze({
  new: {
    label: 'Ново',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  handled: {
    label: 'Обработено',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  closed: {
    label: 'Затворено',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
});

const INTAKE_PRIORITY_META = Object.freeze({
  low: {
    label: 'Нисък',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  normal: {
    label: 'Нормален',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  high: {
    label: 'Висок',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  urgent: {
    label: 'Спешен',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
});

function normalizeDateValue(value) {
  const asTimestamp = new Date(value).getTime();
  return Number.isFinite(asTimestamp) ? asTimestamp : 0;
}

function formatDueDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toLocaleDateString('bg-BG');
}

function formatDueDateInputValue(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLastActionLabel(value, actor) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return actor ? `Последно: ${actor}` : '';
  const suffix = actor ? ` • ${actor}` : '';
  return `Последно: ${parsed.toLocaleString('bg-BG')}${suffix}`;
}

function resolveDueState(dueAt) {
  const timestamp = normalizeDateValue(dueAt);
  if (!timestamp) {
    return {
      isOverdue: false,
      dueAtLabel: '',
      dueAtInputValue: '',
      dueClassName: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  const isOverdue = timestamp < Date.now();
  return {
    isOverdue,
    dueAtLabel: `Срок: ${formatDueDate(dueAt)}`,
    dueAtInputValue: formatDueDateInputValue(dueAt),
    dueClassName: isOverdue
      ? 'bg-red-100 text-red-700 border-red-200'
      : 'bg-amber-100 text-amber-800 border-amber-200',
  };
}

function toIntakeStatus(source, status) {
  if (source === 'tip') {
    if (status === 'processed') return 'handled';
    if (status === 'rejected') return 'closed';
    return 'new';
  }

  if (status === 'read') return 'handled';
  if (status === 'archived') return 'closed';
  return 'new';
}

function buildSearchText(parts) {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeRequestKind(value) {
  return INTAKE_REQUEST_KIND_META[value] ? value : 'general';
}

function normalizeTipItem(tip) {
  const location = typeof tip?.location === 'string' ? tip.location.trim() : '';
  const text = typeof tip?.text === 'string' ? tip.text.trim() : '';
  const createdAt = tip?.createdAt || null;

  const assignedEditor = typeof tip?.assignedEditor === 'string' ? tip.assignedEditor.trim() : '';
  const priority = typeof tip?.priority === 'string' && INTAKE_PRIORITY_META[tip.priority] ? tip.priority : 'normal';
  const tags = Array.isArray(tip?.tags) ? tip.tags.filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim()) : [];
  const dueState = resolveDueState(tip?.dueAt);

  return {
    queueKey: `tip:${tip?.id}`,
    source: 'tip',
    sourceLabel: INTAKE_SOURCE_META.tip.label,
    sourceClassName: INTAKE_SOURCE_META.tip.className,
    status: toIntakeStatus('tip', tip?.status),
    statusClassName: INTAKE_STATUS_META[toIntakeStatus('tip', tip?.status)]?.className || INTAKE_STATUS_META.new.className,
    statusLabel: INTAKE_STATUS_META[toIntakeStatus('tip', tip?.status)]?.label || INTAKE_STATUS_META.new.label,
    id: Number.parseInt(String(tip?.id), 10),
    createdAt,
    createdAtLabel: createdAt ? new Date(createdAt).toLocaleString('bg-BG') : '',
    title: location || 'Сигнал без локация',
    summary: text || '(без текст)',
    secondaryMeta: location || 'Локацията не е уточнена',
    tertiaryMeta: '',
    assignedEditor,
    priority,
    priorityLabel: INTAKE_PRIORITY_META[priority].label,
    priorityClassName: INTAKE_PRIORITY_META[priority].className,
    tags,
    dueAt: tip?.dueAt || null,
    dueAtInputValue: dueState.dueAtInputValue,
    dueAtLabel: dueState.dueAtLabel,
    dueClassName: dueState.dueClassName,
    isOverdue: dueState.isOverdue,
    lastActionAt: tip?.lastActionAt || null,
    lastActionBy: typeof tip?.lastActionBy === 'string' ? tip.lastActionBy.trim() : '',
    lastActionLabel: formatLastActionLabel(tip?.lastActionAt, tip?.lastActionBy),
    rawStatus: tip?.status || 'new',
    image: tip?.image || '',
    imageMeta: tip?.imageMeta || null,
    originalItem: tip,
    searchText: buildSearchText([location, text, assignedEditor, priority, tags.join(' '), dueState.dueAtLabel, tip?.lastActionBy]),
    sortValue: normalizeDateValue(createdAt),
  };
}

function normalizeContactItem(message) {
  const name = typeof message?.name === 'string' ? message.name.trim() : '';
  const phone = typeof message?.phone === 'string' ? message.phone.trim() : '';
  const email = typeof message?.email === 'string' ? message.email.trim() : '';
  const text = typeof message?.message === 'string' ? message.message.trim() : '';
  const createdAt = message?.createdAt || null;
  const requestKind = normalizeRequestKind(message?.requestKind);
  const requestKindMeta = INTAKE_REQUEST_KIND_META[requestKind];
  const relatedArticleId = Number.isInteger(message?.relatedArticleId)
    ? message.relatedArticleId
    : Number.parseInt(String(message?.relatedArticleId || ''), 10);
  const relatedArticleTitle = typeof message?.relatedArticleTitle === 'string' ? message.relatedArticleTitle.trim() : '';
  const linkedArticleLabel = relatedArticleTitle || (Number.isInteger(relatedArticleId) ? `Статия #${relatedArticleId}` : '');
  const responseArticleId = Number.isInteger(message?.responseArticleId)
    ? message.responseArticleId
    : Number.parseInt(String(message?.responseArticleId || ''), 10);
  const responseArticleStatus = typeof message?.responseArticleStatus === 'string'
    ? message.responseArticleStatus.trim()
    : '';
  const responseStatusLabel = responseArticleStatus === 'published'
    ? 'Публикуван отговор'
    : responseArticleStatus === 'archived'
      ? 'Архивиран отговор'
      : responseArticleStatus === 'draft'
        ? 'Чернова на отговор'
        : '';
  const responseMeta = Number.isInteger(responseArticleId)
    ? `${responseStatusLabel || 'Отговор'}: Статия #${responseArticleId}`
    : '';

  const assignedEditor = typeof message?.assignedEditor === 'string' ? message.assignedEditor.trim() : '';
  const priority = typeof message?.priority === 'string' && INTAKE_PRIORITY_META[message.priority] ? message.priority : 'normal';
  const tags = Array.isArray(message?.tags) ? message.tags.filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim()) : [];
  const dueState = resolveDueState(message?.dueAt);

  return {
    queueKey: `contact:${message?.id}`,
    source: 'contact',
    sourceLabel: INTAKE_SOURCE_META.contact.label,
    sourceClassName: INTAKE_SOURCE_META.contact.className,
    status: toIntakeStatus('contact', message?.status),
    statusClassName: INTAKE_STATUS_META[toIntakeStatus('contact', message?.status)]?.className || INTAKE_STATUS_META.new.className,
    statusLabel: INTAKE_STATUS_META[toIntakeStatus('contact', message?.status)]?.label || INTAKE_STATUS_META.new.label,
    id: Number.parseInt(String(message?.id), 10),
    createdAt,
    createdAtLabel: createdAt ? new Date(createdAt).toLocaleString('bg-BG') : '',
    title: name || 'Анонимен подател',
    summary: text || '(без текст)',
    secondaryMeta: phone || 'Без телефон',
    tertiaryMeta: email || '',
    requestKind,
    requestKindLabel: requestKindMeta.label,
    requestKindClassName: requestKindMeta.className,
    relatedArticleId: Number.isInteger(relatedArticleId) ? relatedArticleId : null,
    relatedArticleTitle,
    referenceMeta: linkedArticleLabel,
    responseArticleId: Number.isInteger(responseArticleId) ? responseArticleId : null,
    responseArticleStatus,
    responseMeta,
    assignedEditor,
    priority,
    priorityLabel: INTAKE_PRIORITY_META[priority].label,
    priorityClassName: INTAKE_PRIORITY_META[priority].className,
    tags,
    dueAt: message?.dueAt || null,
    dueAtInputValue: dueState.dueAtInputValue,
    dueAtLabel: dueState.dueAtLabel,
    dueClassName: dueState.dueClassName,
    isOverdue: dueState.isOverdue,
    lastActionAt: message?.lastActionAt || null,
    lastActionBy: typeof message?.lastActionBy === 'string' ? message.lastActionBy.trim() : '',
    lastActionLabel: formatLastActionLabel(message?.lastActionAt, message?.lastActionBy),
    rawStatus: message?.status || 'new',
    originalItem: message,
    searchText: buildSearchText([
      name,
      phone,
      email,
      text,
      requestKindMeta.label,
      relatedArticleTitle,
      responseMeta,
      Number.isInteger(relatedArticleId) ? `Статия ${relatedArticleId}` : '',
      Number.isInteger(responseArticleId) ? `Отговор ${responseArticleId}` : '',
      assignedEditor,
      priority,
      tags.join(' '),
      dueState.dueAtLabel,
      message?.lastActionBy,
    ]),
    sortValue: normalizeDateValue(createdAt),
  };
}

export function serializeAdminIntakeTags(tags) {
  return (Array.isArray(tags) ? tags : [])
    .filter((tag) => typeof tag === 'string' && tag.trim())
    .map((tag) => tag.trim())
    .join(', ');
}

export function parseAdminIntakeTags(rawValue) {
  const source = typeof rawValue === 'string' ? rawValue.split(',') : [];
  const uniqueTags = [];

  source.forEach((entry) => {
    const normalized = String(entry || '').trim();
    if (!normalized) return;
    if (uniqueTags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) return;
    uniqueTags.push(normalized);
  });

  return uniqueTags.slice(0, 8);
}

export function buildAdminIntakeItems({ tips = [], contactMessages = [] } = {}) {
  const normalizedTips = Array.isArray(tips) ? tips.map(normalizeTipItem) : [];
  const normalizedContactMessages = Array.isArray(contactMessages)
    ? contactMessages.map(normalizeContactItem)
    : [];

  return [...normalizedTips, ...normalizedContactMessages]
    .filter((item) => Number.isInteger(item.id))
    .sort((left, right) => right.sortValue - left.sortValue);
}

export function filterAdminIntakeItems(
  items,
  { query = '', source = 'all', status = 'all', priority = 'all', owner = 'all', currentEditor = '', due = 'all', kind = 'all' } = {},
) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedEditor = String(currentEditor || '').trim().toLowerCase();
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (source !== 'all' && item.source !== source) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (priority !== 'all' && item.priority !== priority) return false;
    if (kind !== 'all') {
      if (item.source !== 'contact' || item.requestKind !== kind) return false;
    }
    if (owner === 'mine') {
      if (!normalizedEditor || item.assignedEditor.trim().toLowerCase() !== normalizedEditor) return false;
    }
    if (owner === 'unassigned' && item.assignedEditor.trim()) return false;
    if (due === 'overdue' && !item.isOverdue) return false;
    if (due === 'scheduled' && !item.dueAt) return false;
    if (!normalizedQuery) return true;
    return item.searchText.includes(normalizedQuery);
  });
}

export function getAdminIntakeCounts(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    all: list.length,
    new: list.filter((item) => item.status === 'new').length,
    handled: list.filter((item) => item.status === 'handled').length,
    closed: list.filter((item) => item.status === 'closed').length,
    tips: list.filter((item) => item.source === 'tip').length,
    contact: list.filter((item) => item.source === 'contact').length,
    rightOfReply: list.filter((item) => item.source === 'contact' && item.requestKind === 'right_of_reply').length,
  };
}
