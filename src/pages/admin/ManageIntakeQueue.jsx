import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Archive, CheckCircle2, ExternalLink, Inbox, Mail, RefreshCw, Save, Trash2, UserCheck } from 'lucide-react';
import { api } from '../../utils/api';
import { useAdminData, useSessionData } from '../../context/DataContext';
import { useToast } from '../../components/admin/Toast';
import { useConfirm } from '../../components/admin/ConfirmDialog';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminFilterBar from '../../components/admin/AdminFilterBar';
import AdminSearchField from '../../components/admin/AdminSearchField';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { buildAdminSearchParams, readEnumSearchParam, readSearchParam } from '../../utils/adminSearchParams';
import {
  buildAdminIntakeItems,
  filterAdminIntakeItems,
  getAdminIntakeCounts,
  parseAdminIntakeTags,
  serializeAdminIntakeTags,
} from '../../utils/adminIntakeQueue';

const ARTICLE_PREFILL_STORAGE_KEY = 'znews_intake_article_prefill_v1';
const LEGACY_TIP_PREFILL_STORAGE_KEY = 'znews_tip_prefill';
const SOURCE_FILTERS = Object.freeze(['all', 'tip', 'contact']);
const STATUS_FILTERS = Object.freeze(['all', 'new', 'handled', 'closed']);
const PRIORITY_FILTERS = Object.freeze(['all', 'low', 'normal', 'high', 'urgent']);
const OWNER_FILTERS = Object.freeze(['all', 'mine', 'unassigned']);
const DUE_FILTERS = Object.freeze(['all', 'scheduled', 'overdue']);
const KIND_FILTERS = Object.freeze(['all', 'general', 'correction', 'right_of_reply']);
const PRIORITY_OPTIONS = Object.freeze([
  { value: 'low', label: 'Нисък' },
  { value: 'normal', label: 'Нормален' },
  { value: 'high', label: 'Висок' },
  { value: 'urgent', label: 'Спешен' },
]);
const REQUEST_KIND_OPTIONS = Object.freeze([
  { value: 'all', label: 'Всички типове' },
  { value: 'general', label: 'Общи запитвания' },
  { value: 'correction', label: 'Корекции' },
  { value: 'right_of_reply', label: 'Права на отговор' },
]);

function buildTipPrefill(item) {
  const location = item?.location || 'Без локация';
  const text = item?.text || '';
  return {
    title: `Сигнал: ${location}`,
    excerpt: text ? `${text.slice(0, 150)}...` : '',
    content: `**От читателски сигнал:**\n${text}\n\n**Локация:** ${location}\n`,
    image: item?.image || '',
    imageMeta: item?.imageMeta || null,
  };
}

function escapePrefillHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toPrefillParagraphs(value) {
  return String(value || '')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${escapePrefillHtml(chunk).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function buildRightOfReplyPrefill(item, relatedArticle) {
  const articleId = Number.isInteger(item.relatedArticleId) ? item.relatedArticleId : null;
  const articleTitle = String(
    relatedArticle?.title
    || item.relatedArticleTitle
    || (articleId ? `Статия #${articleId}` : 'Публикация')
  ).trim();
  const articleCategory = String(relatedArticle?.category || '').trim() || 'society';
  const requesterName = String(item.originalItem?.name || item.title || '').trim() || 'Засегната страна';
  const requesterPhone = String(item.originalItem?.phone || item.secondaryMeta || '').trim();
  const requesterEmail = String(item.originalItem?.email || item.tertiaryMeta || '').trim();
  const responseText = String(item.originalItem?.message || item.summary || '').trim();
  const referenceLine = articleId
    ? `<p><strong>Свързана публикация:</strong> Статия #${articleId}${articleTitle ? ` — ${escapePrefillHtml(articleTitle)}` : ''}</p>`
    : '';
  const emailLine = requesterEmail
    ? `<p><strong>Имейл:</strong> ${escapePrefillHtml(requesterEmail)}</p>`
    : '';

  return {
    title: `Право на отговор: ${articleTitle}`,
    excerpt: `Постъпило право на отговор във връзка с публикацията "${articleTitle}".`,
    content: [
      '<p><strong>Постъпило искане за право на отговор</strong></p>',
      `<p><strong>Име:</strong> ${escapePrefillHtml(requesterName)}</p>`,
      requesterPhone ? `<p><strong>Телефон:</strong> ${escapePrefillHtml(requesterPhone)}</p>` : '',
      emailLine,
      referenceLine,
      '<p><strong>Текст на отговора:</strong></p>',
      toPrefillParagraphs(responseText),
      '<p><strong>Редакционна бележка:</strong> Провери фактите, запази тона неутрален и вържи публикацията към оригиналната статия.</p>',
    ].filter(Boolean).join(''),
    category: articleCategory,
    tags: ['право на отговор'],
    relatedArticles: articleId ? [articleId] : [],
    status: 'draft',
    cardSticker: 'ПРАВО НА ОТГОВОР',
    shareBadge: 'ОТГОВОР',
    intakeMeta: {
      source: 'contact',
      requestId: item.id,
      requestKind: 'right_of_reply',
      relatedArticleId: articleId,
      relatedArticleTitle: articleTitle,
    },
  };
}

function writeArticlePrefill(prefill) {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(ARTICLE_PREFILL_STORAGE_KEY, JSON.stringify(prefill));
    return true;
  } catch {
    return false;
  }
}

function buildAdminSourceUrl(item) {
  const params = new URLSearchParams();

  if (item.source === 'tip') {
    if (item.originalItem?.location) params.set('q', item.originalItem.location);
    const queryString = params.toString();
    return `/admin/tips${queryString ? `?${queryString}` : ''}`;
  }

  if (item.originalItem?.name) params.set('q', item.originalItem.name);
  else if (item.originalItem?.phone) params.set('q', item.originalItem.phone);
  const queryString = params.toString();
  return `/admin/contact${queryString ? `?${queryString}` : ''}`;
}

function buildAdminAuditLogUrl(item) {
  const params = new URLSearchParams();
  params.set('resource', item.source === 'tip' ? 'tips' : 'contact-messages');
  params.set('resourceId', String(item.id));
  if (item.source === 'tip' && item.originalItem?.location) {
    params.set('q', item.originalItem.location);
  } else if (item.originalItem?.name) {
    params.set('q', item.originalItem.name);
  } else if (item.originalItem?.phone) {
    params.set('q', item.originalItem.phone);
  }
  return `/admin/audit-log?${params.toString()}`;
}

function buildAdminResponseArticleUrl(item) {
  if (!Number.isInteger(item?.responseArticleId)) return '';
  const params = new URLSearchParams();
  params.set('q', String(item.responseArticleId));
  return `/admin/articles?${params.toString()}`;
}

function buildAdminRelatedArticleUrl(item) {
  if (!Number.isInteger(item?.relatedArticleId)) return '';
  const params = new URLSearchParams();
  params.set('q', String(item.relatedArticleId));
  return `/admin/articles?${params.toString()}`;
}

function buildPublicArticleUrl(articleId) {
  const normalizedId = Number.parseInt(String(articleId || ''), 10);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) return '';
  return `/article/${normalizedId}`;
}

export default function ManageIntakeQueue() {
  const { session } = useSessionData();
  const { hasPermission, tips, tipsReady, ensureTipsLoaded, refreshTips, updateTip, deleteTip } = useAdminData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [contactItems, setContactItems] = useState([]);
  const [contactReady, setContactReady] = useState(false);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [bulkActionLabel, setBulkActionLabel] = useState('');
  const [drafts, setDrafts] = useState({});
  const [selectedKeys, setSelectedKeys] = useState([]);

  const requestedSource = readEnumSearchParam(searchParams, 'source', SOURCE_FILTERS, 'all');
  const status = readEnumSearchParam(searchParams, 'status', STATUS_FILTERS, 'all');
  const priority = readEnumSearchParam(searchParams, 'priority', PRIORITY_FILTERS, 'all');
  const requestedOwner = readEnumSearchParam(searchParams, 'owner', OWNER_FILTERS, 'all');
  const due = readEnumSearchParam(searchParams, 'due', DUE_FILTERS, 'all');
  const kind = readEnumSearchParam(searchParams, 'kind', KIND_FILTERS, 'all');
  const query = readSearchParam(searchParams, 'q', '');
  const canViewTips = Boolean(session?.token && hasPermission('articles'));
  const canViewContact = Boolean(session?.token && hasPermission('contact'));
  const currentEditor = String(session?.name || '').trim();
  const source = useMemo(() => {
    if (requestedSource === 'tip' && !canViewTips) return 'all';
    if (requestedSource === 'contact' && !canViewContact) return 'all';
    return requestedSource;
  }, [canViewContact, canViewTips, requestedSource]);
  const owner = useMemo(() => {
    if (requestedOwner === 'mine' && !currentEditor) return 'all';
    return requestedOwner;
  }, [currentEditor, requestedOwner]);
  const savedViews = useMemo(() => ([
    {
      key: 'new-tips',
      label: 'Нови сигнали',
      updates: { source: 'tip', status: 'new', priority: 'all', owner: 'all', due: 'all', kind: 'all', q: '' },
    },
    {
      key: 'new-contact',
      label: 'Нови запитвания',
      updates: { source: 'contact', status: 'new', priority: 'all', owner: 'all', due: 'all', kind: 'all', q: '' },
    },
    {
      key: 'right-of-reply',
      label: 'Права на отговор',
      updates: { source: 'contact', status: 'all', priority: 'all', owner: 'all', due: 'all', kind: 'right_of_reply', q: '' },
    },
    {
      key: 'urgent',
      label: 'Спешни',
      updates: { source: 'all', status: 'all', priority: 'urgent', owner: 'all', due: 'all', kind: 'all', q: '' },
    },
    ...(currentEditor ? [{
      key: 'mine',
      label: 'Моите',
      updates: { source: 'all', status: 'all', priority: 'all', owner: 'mine', due: 'all', kind: 'all', q: '' },
    }] : []),
    {
      key: 'unassigned',
      label: 'Неразпределени',
      updates: { source: 'all', status: 'new', priority: 'all', owner: 'unassigned', due: 'all', kind: 'all', q: '' },
    },
    {
      key: 'overdue',
      label: 'Просрочени',
      updates: { source: 'all', status: 'all', priority: 'all', owner: 'all', due: 'overdue', kind: 'all', q: '' },
    },
  ]), [currentEditor]);

  const setListSearchParams = (updates) => {
    setSearchParams(
      (current) => buildAdminSearchParams(current, updates),
      { replace: true },
    );
  };

  const loadContactMessages = useCallback(async () => {
    if (!canViewContact) {
      setContactItems([]);
      setContactReady(true);
      return [];
    }

    try {
      const data = await api.contactMessages.getAll({ limit: 200 });
      const normalized = Array.isArray(data) ? data : [];
      setContactItems(normalized);
      setContactReady(true);
      return normalized;
    } catch (loadError) {
      setContactItems([]);
      setContactReady(true);
      setError(loadError?.message || 'Грешка при зареждане на запитванията');
      return [];
    }
  }, [canViewContact]);

  useEffect(() => {
    if (!canViewTips) return;
    void ensureTipsLoaded();
  }, [canViewTips, ensureTipsLoaded]);

  useEffect(() => {
    if (!canViewContact) {
      setContactItems([]);
      setContactReady(true);
      return;
    }

    void loadContactMessages();
  }, [canViewContact, loadContactMessages]);

  const intakeItems = useMemo(
    () => buildAdminIntakeItems({
      tips: canViewTips ? tips : [],
      contactMessages: canViewContact ? contactItems : [],
    }),
    [canViewContact, canViewTips, contactItems, tips],
  );

  const filteredItems = useMemo(
    () => filterAdminIntakeItems(intakeItems, { query, source, status, priority, owner, currentEditor, due, kind }),
    [currentEditor, due, intakeItems, kind, owner, priority, query, source, status],
  );
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selectedItems = useMemo(
    () => intakeItems.filter((item) => selectedKeySet.has(item.queueKey)),
    [intakeItems, selectedKeySet],
  );
  const selectedCount = selectedItems.length;
  const selectedVisibleCount = filteredItems.reduce(
    (count, item) => (selectedKeySet.has(item.queueKey) ? count + 1 : count),
    0,
  );
  const allVisibleSelected = filteredItems.length > 0 && selectedVisibleCount === filteredItems.length;

  const counts = useMemo(
    () => getAdminIntakeCounts(intakeItems),
    [intakeItems],
  );

  const isLoading = (canViewTips && !tipsReady) || (canViewContact && !contactReady);
  const bulkBusy = Boolean(bulkActionLabel);
  const queueDescription = `${counts.all} входящи • ${counts.new} нови • ${counts.rightOfReply} права на отговор`;
  const noAccess = !canViewTips && !canViewContact;

  useEffect(() => {
    const validKeys = new Set(intakeItems.map((item) => item.queueKey));
    setSelectedKeys((currentKeys) => currentKeys.filter((key) => validKeys.has(key)));
  }, [intakeItems]);

  const refreshAll = async () => {
    setError('');
    await Promise.all([
      canViewTips ? refreshTips() : Promise.resolve([]),
      canViewContact ? loadContactMessages() : Promise.resolve([]),
    ]);
  };

  const isSavedViewActive = (view) => (
    source === view.updates.source
    && status === view.updates.status
    && priority === view.updates.priority
    && owner === view.updates.owner
    && due === view.updates.due
    && kind === view.updates.kind
    && query === view.updates.q
  );

  const isItemBusy = (item) => busyKey === item.queueKey;
  const getDraft = (item) => ({
    assignedEditor: item.assignedEditor || '',
    priority: item.priority || 'normal',
    tagsInput: serializeAdminIntakeTags(item.tags),
    dueAtInput: item.dueAtInputValue || '',
    ...(drafts[item.queueKey] || {}),
  });

  const updateDraft = (queueKey, updates) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [queueKey]: {
        ...(currentDrafts[queueKey] || {}),
        ...updates,
      },
    }));
  };

  const clearDraft = (queueKey) => {
    setDrafts((currentDrafts) => {
      if (!currentDrafts[queueKey]) return currentDrafts;
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[queueKey];
      return nextDrafts;
    });
  };

  const clearDrafts = (queueKeys) => {
    if (!Array.isArray(queueKeys) || queueKeys.length === 0) return;
    setDrafts((currentDrafts) => {
      let changed = false;
      const nextDrafts = { ...currentDrafts };
      queueKeys.forEach((queueKey) => {
        if (nextDrafts[queueKey]) {
          delete nextDrafts[queueKey];
          changed = true;
        }
      });
      return changed ? nextDrafts : currentDrafts;
    });
  };

  const replaceContactItem = useCallback((updatedItem) => {
    setContactItems((currentItems) => currentItems.map((contactItem) => (
      contactItem.id === updatedItem.id ? updatedItem : contactItem
    )));
  }, []);

  const removeContactItem = useCallback((id) => {
    setContactItems((currentItems) => currentItems.filter((contactItem) => contactItem.id !== id));
  }, []);

  const toggleSelectedItem = (queueKey) => {
    if (bulkBusy) return;
    setSelectedKeys((currentKeys) => (
      currentKeys.includes(queueKey)
        ? currentKeys.filter((key) => key !== queueKey)
        : [...currentKeys, queueKey]
    ));
  };

  const toggleVisibleSelection = () => {
    if (bulkBusy || filteredItems.length === 0) return;
    const visibleKeys = filteredItems.map((item) => item.queueKey);
    const visibleSet = new Set(visibleKeys);
    setSelectedKeys((currentKeys) => {
      const everyVisibleSelected = visibleKeys.every((key) => currentKeys.includes(key));
      if (everyVisibleSelected) {
        return currentKeys.filter((key) => !visibleSet.has(key));
      }
      return Array.from(new Set([...currentKeys, ...visibleKeys]));
    });
  };

  const clearSelection = () => {
    if (bulkBusy) return;
    setSelectedKeys([]);
  };

  const runTipStatusUpdate = async (item, nextStatus) => {
    setBusyKey(item.queueKey);
    setError('');
    try {
      await updateTip(item.id, nextStatus);
      toast.success(nextStatus === 'processed' ? 'Сигналът е отбелязан като обработен' : 'Сигналът е затворен');
    } catch (updateError) {
      setError(updateError?.message || 'Грешка при обновяване на сигнала');
      toast.error('Грешка при обновяване на сигнала');
      await refreshTips();
    } finally {
      setBusyKey('');
    }
  };

  const runTipDelete = async (item) => {
    const confirmed = await confirm({
      title: 'Изтриване на сигнал',
      message: 'Сигналът ще бъде изтрит безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;

    setBusyKey(item.queueKey);
    setError('');
    try {
      await deleteTip(item.id);
      toast.success('Сигналът е изтрит');
    } catch (deleteError) {
      setError(deleteError?.message || 'Грешка при изтриване на сигнала');
      toast.error('Грешка при изтриване на сигнала');
      await refreshTips();
    } finally {
      setBusyKey('');
    }
  };

  const runContactStatusUpdate = async (item, nextStatus) => {
    const previousItems = contactItems;
    setBusyKey(item.queueKey);
    setError('');
    setContactItems((currentItems) => currentItems.map((contactItem) => (
      contactItem.id === item.id ? { ...contactItem, status: nextStatus } : contactItem
    )));

    try {
      const updated = await api.contactMessages.update(item.id, { status: nextStatus });
      replaceContactItem(updated);
      toast.success(nextStatus === 'read' ? 'Запитването е отбелязано като обработено' : 'Запитването е архивирано');
    } catch (updateError) {
      setContactItems(previousItems);
      setError(updateError?.message || 'Грешка при обновяване на запитването');
      toast.error('Грешка при обновяване на запитването');
    } finally {
      setBusyKey('');
    }
  };

  const runContactDelete = async (item) => {
    const confirmed = await confirm({
      title: 'Изтриване на запитване',
      message: 'Запитването ще бъде изтрито безвъзвратно.',
      confirmLabel: 'Изтрий',
      variant: 'danger',
    });
    if (!confirmed) return;

    const previousItems = contactItems;
    setBusyKey(item.queueKey);
    setError('');
    setContactItems((currentItems) => currentItems.filter((contactItem) => contactItem.id !== item.id));

    try {
      await api.contactMessages.delete(item.id);
      toast.success('Запитването е изтрито');
    } catch (deleteError) {
      setContactItems(previousItems);
      setError(deleteError?.message || 'Грешка при изтриване на запитването');
      toast.error('Грешка при изтриване на запитването');
    } finally {
      setBusyKey('');
    }
  };

  const handleConvertTipToArticle = async (item) => {
    setBusyKey(item.queueKey);
    setError('');
    writeArticlePrefill(buildTipPrefill(item.originalItem));
    try {
      window.localStorage?.removeItem(LEGACY_TIP_PREFILL_STORAGE_KEY);
    } catch {
      // ignore storage cleanup issues
    }

    try {
      await updateTip(item.id, 'processed');
      toast.success('Сигналът е подготвен за статия');
    } catch (updateError) {
      setError(updateError?.message || 'Статията е подготвена, но статусът на сигнала не бе обновен');
      toast.warning('Статията е подготвена, но статусът на сигнала не бе обновен');
      await refreshTips();
    } finally {
      setBusyKey('');
      navigate('/admin/articles');
    }
  };

  const handlePrepareRightOfReply = async (item) => {
    setBusyKey(item.queueKey);
    setError('');

    let relatedArticle = null;
    if (item.relatedArticleId) {
      try {
        relatedArticle = await api.articles.getById(item.relatedArticleId);
      } catch {
        relatedArticle = null;
      }
    }

    const wrotePrefill = writeArticlePrefill(buildRightOfReplyPrefill(item, relatedArticle));
    if (!wrotePrefill) {
      setBusyKey('');
      setError('Не успяхме да подготвим черновата за право на отговор.');
      toast.error('Не успяхме да подготвим черновата');
      return;
    }

    try {
      if (item.rawStatus !== 'read') {
        const updated = await api.contactMessages.update(item.id, { status: 'read' });
        replaceContactItem(updated);
      }
      toast.success('Подготвихме чернова за право на отговор');
    } catch (updateError) {
      setError(updateError?.message || 'Черновата е подготвена, но статусът на заявката не беше обновен.');
      toast.warning('Черновата е подготвена, но статусът не беше обновен');
    } finally {
      setBusyKey('');
      navigate('/admin/articles');
    }
  };

  const runTipMetaSave = async (item, payload) => {
    setBusyKey(item.queueKey);
    setError('');
    try {
      await updateTip(item.id, payload);
      clearDraft(item.queueKey);
      toast.success('Редакционните полета са обновени');
    } catch (updateError) {
      setError(updateError?.message || 'Грешка при запис на редакционните полета');
      toast.error('Грешка при запис на редакционните полета');
      await refreshTips();
    } finally {
      setBusyKey('');
    }
  };

  const runContactMetaSave = async (item, payload) => {
    const previousItems = contactItems;
    setBusyKey(item.queueKey);
    setError('');

    const optimisticPatch = {
      assignedEditor: payload.assignedEditor,
      priority: payload.priority,
      tags: payload.tags,
      dueAt: payload.dueAt,
    };

    setContactItems((currentItems) => currentItems.map((contactItem) => (
      contactItem.id === item.id ? { ...contactItem, ...optimisticPatch } : contactItem
    )));

    try {
      const updated = await api.contactMessages.update(item.id, payload);
      replaceContactItem(updated);
      clearDraft(item.queueKey);
      toast.success('Редакционните полета са обновени');
    } catch (updateError) {
      setContactItems(previousItems);
      setError(updateError?.message || 'Грешка при запис на редакционните полета');
      toast.error('Грешка при запис на редакционните полета');
    } finally {
      setBusyKey('');
    }
  };

  const handleSaveMeta = async (item, draftOverride = null) => {
    const draft = draftOverride || getDraft(item);
    const payload = {
      assignedEditor: draft.assignedEditor.trim(),
      priority: draft.priority,
      tags: parseAdminIntakeTags(draft.tagsInput),
      dueAt: draft.dueAtInput || null,
    };

    if (item.source === 'tip') {
      await runTipMetaSave(item, payload);
      return;
    }

    await runContactMetaSave(item, payload);
  };

  const handleClaimItem = async (item) => {
    const assignedEditor = String(session?.name || '').trim();
    if (!assignedEditor) return;
    const nextDraft = { ...getDraft(item), assignedEditor };
    updateDraft(item.queueKey, { assignedEditor });
    await handleSaveMeta(item, nextDraft);
  };

  const runBulkAction = async ({ label, confirmConfig, action, successMessage, partialMessage, emptyMessage }) => {
    const queueSnapshot = selectedItems;
    if (queueSnapshot.length === 0 || bulkBusy) return;

    if (confirmConfig) {
      const confirmed = await confirm(confirmConfig(queueSnapshot.length));
      if (!confirmed) return;
    }

    setBulkActionLabel(label);
    setError('');

    let successCount = 0;
    let failureCount = 0;
    let firstErrorMessage = '';
    const succeededKeys = [];

    try {
      for (const item of queueSnapshot) {
        try {
          const changed = await action(item);
          if (changed === false) continue;
          successCount += 1;
          succeededKeys.push(item.queueKey);
        } catch (actionError) {
          failureCount += 1;
          if (!firstErrorMessage) {
            firstErrorMessage = actionError?.message || `Грешка при ${label.toLowerCase()}`;
          }
        }
      }

      if (successCount === 0 && failureCount === 0) {
        toast.warning(emptyMessage || 'Няма елементи за това действие');
        return;
      }

      if (failureCount === 0) {
        toast.success(typeof successMessage === 'function' ? successMessage(successCount) : successMessage);
      } else {
        setError(firstErrorMessage || `Възникна проблем при ${label.toLowerCase()}`);
        toast.warning(
          typeof partialMessage === 'function'
            ? partialMessage(successCount, failureCount)
            : partialMessage || `Част от избраните елементи не бяха обработени`,
        );
      }
    } finally {
      if (succeededKeys.length > 0) {
        clearDrafts(succeededKeys);
        setSelectedKeys((currentKeys) => currentKeys.filter((key) => !succeededKeys.includes(key)));
      }
      setBulkActionLabel('');
    }
  };

  const handleBulkClaim = async () => {
    const assignedEditor = String(session?.name || '').trim();
    if (!assignedEditor) return;

    await runBulkAction({
      label: 'Поемане',
      action: async (item) => {
        if (item.assignedEditor === assignedEditor) return false;
        if (item.source === 'tip') {
          await updateTip(item.id, { assignedEditor });
          return true;
        }
        const updated = await api.contactMessages.update(item.id, { assignedEditor });
        replaceContactItem(updated);
        return true;
      },
      successMessage: (count) => count === 1 ? 'Елементът е поет' : `Поети са ${count} елемента`,
      partialMessage: (successCount, failureCount) => `Поети: ${successCount}, с проблем: ${failureCount}`,
      emptyMessage: 'Избраните елементи вече са поети от този редактор',
    });
  };

  const handleBulkMarkHandled = async () => {
    await runBulkAction({
      label: 'Обработване',
      action: async (item) => {
        if (item.source === 'tip') {
          if (item.rawStatus === 'processed') return false;
          await updateTip(item.id, 'processed');
          return true;
        }
        if (item.rawStatus === 'read') return false;
        const updated = await api.contactMessages.update(item.id, { status: 'read' });
        replaceContactItem(updated);
        return true;
      },
      successMessage: (count) => count === 1 ? 'Елементът е обработен' : `Обработени са ${count} елемента`,
      partialMessage: (successCount, failureCount) => `Обработени: ${successCount}, с проблем: ${failureCount}`,
      emptyMessage: 'Избраните елементи вече са обработени',
    });
  };

  const handleBulkClose = async () => {
    await runBulkAction({
      label: 'Затваряне',
      action: async (item) => {
        if (item.source === 'tip') {
          if (item.rawStatus === 'rejected') return false;
          await updateTip(item.id, 'rejected');
          return true;
        }
        if (item.rawStatus === 'archived') return false;
        const updated = await api.contactMessages.update(item.id, { status: 'archived' });
        replaceContactItem(updated);
        return true;
      },
      successMessage: (count) => count === 1 ? 'Елементът е затворен' : `Затворени са ${count} елемента`,
      partialMessage: (successCount, failureCount) => `Затворени: ${successCount}, с проблем: ${failureCount}`,
      emptyMessage: 'Избраните елементи вече са затворени',
    });
  };

  const handleBulkDelete = async () => {
    await runBulkAction({
      label: 'Изтриване',
      confirmConfig: (count) => ({
        title: count === 1 ? 'Изтриване на елемент' : `Изтриване на ${count} елемента`,
        message: count === 1
          ? 'Избраният елемент ще бъде изтрит безвъзвратно.'
          : 'Избраните елементи ще бъдат изтрити безвъзвратно.',
        confirmLabel: count === 1 ? 'Изтрий' : `Изтрий ${count}`,
        variant: 'danger',
      }),
      action: async (item) => {
        if (item.source === 'tip') {
          await deleteTip(item.id);
          return true;
        }
        await api.contactMessages.delete(item.id);
        removeContactItem(item.id);
        return true;
      },
      successMessage: (count) => count === 1 ? 'Елементът е изтрит' : `Изтрити са ${count} елемента`,
      partialMessage: (successCount, failureCount) => `Изтрити: ${successCount}, с проблем: ${failureCount}`,
    });
  };

  const sourceFilterButton = (value, label, count) => (
    <button
      type="button"
      onClick={() => setListSearchParams({ source: value, status, priority, owner, due, kind: value === 'tip' ? 'all' : kind, q: query })}
      className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${source === value
        ? 'bg-zn-purple text-white border-zn-purple'
        : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
        }`}
    >
      {label} ({count})
    </button>
  );

  const statusFilterButton = (value, label, count) => (
    <button
      type="button"
      onClick={() => setListSearchParams({ source, status: value, priority, owner, due, kind, q: query })}
      className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${status === value
        ? 'bg-zn-hot text-white border-zn-hot'
        : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
        }`}
    >
      {label} ({count})
    </button>
  );

  if (noAccess) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 p-6 text-center">
          <Inbox className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-sans text-red-700 font-semibold">Нямате права за тази опашка</p>
          <p className="font-sans text-red-500 text-sm mt-1">Нужно е право: articles или contact</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-full">
      <AdminPageHeader
        title="Входяща опашка"
        description={queueDescription}
        icon={Inbox}
        actions={(
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={isLoading || bulkBusy}
            aria-label="Обнови входящата опашка"
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-sm font-sans text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Обнови
          </button>
        )}
      />

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 px-4 py-3 text-sm font-sans text-red-800 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <AdminFilterBar className="mb-6">
        {sourceFilterButton('all', 'Всички източници', counts.all)}
        {canViewTips ? sourceFilterButton('tip', 'Сигнали', counts.tips) : null}
        {canViewContact ? sourceFilterButton('contact', 'Запитвания', counts.contact) : null}
        {statusFilterButton('all', 'Всички', counts.all)}
        {statusFilterButton('new', 'Нови', counts.new)}
        {statusFilterButton('handled', 'Обработени', counts.handled)}
        {statusFilterButton('closed', 'Затворени', counts.closed)}
        <label className="min-w-[180px]">
          <span className="sr-only">Филтрирай по приоритет</span>
          <select
            value={priority}
            onChange={(event) => setListSearchParams({ source, status, priority: event.target.value, owner, due, kind, q: query })}
            aria-label="Филтрирай входящата опашка по приоритет"
            className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple"
          >
            <option value="all">Всички приоритети</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[180px]">
          <span className="sr-only">Филтрирай по редактор</span>
          <select
            value={owner}
            onChange={(event) => setListSearchParams({ source, status, priority, owner: event.target.value, due, kind, q: query })}
            aria-label="Филтрирай входящата опашка по редактор"
            className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple"
          >
            <option value="all">Всички редактори</option>
            {currentEditor ? <option value="mine">Моите</option> : null}
            <option value="unassigned">Неразпределени</option>
          </select>
        </label>
        <label className="min-w-[180px]">
          <span className="sr-only">Филтрирай по срок</span>
          <select
            value={due}
            onChange={(event) => setListSearchParams({ source, status, priority, owner, due: event.target.value, kind, q: query })}
            aria-label="Филтрирай входящата опашка по срок"
            className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple"
          >
            <option value="all">Всички срокове</option>
            <option value="scheduled">Със срок</option>
            <option value="overdue">Просрочени</option>
          </select>
        </label>
        <label className="min-w-[200px]">
          <span className="sr-only">Филтрирай по тип заявка</span>
          <select
            value={kind}
            onChange={(event) => setListSearchParams({ source, status, priority, owner, due, kind: event.target.value, q: query })}
            aria-label="Филтрирай входящата опашка по тип заявка"
            className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple"
          >
            {REQUEST_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <AdminSearchField
          value={query}
          onChange={(event) => setListSearchParams({ source, status, priority, owner, due, kind, q: event.target.value })}
          placeholder="Търси по текст, локация, име, телефон..."
          ariaLabel="Търси във входящата опашка"
          className="ml-auto min-w-[320px]"
        />
      </AdminFilterBar>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {savedViews.map((view) => (
          <button
            key={view.key}
            type="button"
            onClick={() => setListSearchParams(view.updates)}
            className={`px-3 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider border transition-colors ${isSavedViewActive(view)
              ? 'bg-zn-comic-black text-white border-zn-comic-black'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {!isLoading && (filteredItems.length > 0 || selectedCount > 0) ? (
        <div className="mb-4 flex flex-col gap-3 border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleVisibleSelection}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 border border-gray-200 bg-white px-3 py-2 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {allVisibleSelected ? 'Махни видимите' : 'Избери видимите'}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={bulkBusy || selectedCount === 0}
              className="inline-flex items-center gap-1.5 border border-gray-200 bg-white px-3 py-2 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Изчисти избора
            </button>
            <span className="text-xs font-sans font-semibold uppercase tracking-wider text-gray-500">
              {selectedCount > 0 ? `Избрани: ${selectedCount}` : 'Няма избрани елементи'}
            </span>
            {bulkBusy ? (
              <span className="text-xs font-sans font-semibold uppercase tracking-wider text-zn-purple">
                {bulkActionLabel}...
              </span>
            ) : null}
          </div>

          {selectedCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleBulkClaim()}
                disabled={bulkBusy || !session?.name}
                className="inline-flex items-center gap-1.5 border border-violet-200 bg-white px-3 py-2 text-xs font-sans font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Поеми избраните
              </button>
              <button
                type="button"
                onClick={() => void handleBulkMarkHandled()}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 border border-emerald-200 bg-white px-3 py-2 text-xs font-sans font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Обработи избраните
              </button>
              <button
                type="button"
                onClick={() => void handleBulkClose()}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 border border-gray-200 bg-white px-3 py-2 text-xs font-sans font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <Archive className="h-3.5 w-3.5" />
                Затвори / архивирай
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 border border-red-200 bg-white px-3 py-2 text-xs font-sans font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Изтрий избраните
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Зареждане...</div>
      ) : filteredItems.length === 0 ? (
        <AdminEmptyState
          title="Няма входящи елементи"
          description={query.trim()
            ? 'Няма сигнали или запитвания, които да съвпадат с текущото търсене.'
            : 'Все още няма входящи сигнали или запитвания за показване.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
              const busy = bulkBusy || isItemBusy(item);
            const isTip = item.source === 'tip';
            const draft = getDraft(item);

            return (
              <div
                key={item.queueKey}
                className="bg-white border border-gray-200 p-5 shadow-sm"
                aria-busy={busy}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border ${item.sourceClassName}`}>
                        {item.sourceLabel}
                      </span>
                      {!isTip ? (
                        <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border ${item.requestKindClassName}`}>
                          {item.requestKindLabel}
                        </span>
                      ) : null}
                      <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border ${item.statusClassName}`}>
                        {item.statusLabel}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border ${item.priorityClassName}`}>
                        {item.priorityLabel}
                      </span>
                      {item.dueAtLabel ? (
                        <span className={`px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border ${item.dueClassName}`}>
                          {item.isOverdue ? `Просрочено • ${item.dueAtLabel}` : item.dueAtLabel}
                        </span>
                      ) : null}
                      {item.assignedEditor ? (
                        <span className="px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border bg-violet-100 text-violet-700 border-violet-200">
                          {`Редактор: ${item.assignedEditor}`}
                        </span>
                      ) : null}
                      {item.tags.map((tag) => (
                        <span
                          key={`${item.queueKey}-${tag}`}
                          className="px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider border bg-gray-100 text-gray-600 border-gray-200"
                        >
                          #{tag}
                        </span>
                      ))}
                      <span className="text-xs font-sans text-gray-400">{item.createdAtLabel}</span>
                    </div>

                    <div className="flex items-start gap-3">
                      <label className="mt-0.5 flex shrink-0 items-center">
                        <input
                          type="checkbox"
                          checked={selectedKeySet.has(item.queueKey)}
                          onChange={() => toggleSelectedItem(item.queueKey)}
                          aria-label={`Избери ${item.source === 'tip' ? 'сигнал' : 'запитване'} ${item.title}`}
                          disabled={busy}
                          className="h-4 w-4 border-gray-300 text-zn-purple focus:ring-zn-purple disabled:opacity-50"
                        />
                      </label>
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border ${isTip ? 'border-orange-200 bg-orange-50 text-orange-600' : 'border-sky-200 bg-sky-50 text-sky-600'}`}>
                        {isTip ? <AlertTriangle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-display font-bold uppercase tracking-wide text-gray-900">
                          {item.title}
                        </h2>
                        <p className="mt-1 text-sm font-sans text-gray-700 whitespace-pre-wrap break-words">
                          {item.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-sans text-gray-500">
                          <span>{isTip ? `Локация: ${item.secondaryMeta}` : `Телефон: ${item.secondaryMeta}`}</span>
                          {!isTip && item.tertiaryMeta ? <span>Имейл: {item.tertiaryMeta}</span> : null}
                          {!isTip && item.referenceMeta ? <span>{`Публикация: ${item.referenceMeta}`}</span> : null}
                          {!isTip && item.responseMeta ? <span>{item.responseMeta}</span> : null}
                          {item.lastActionLabel ? <span>{item.lastActionLabel}</span> : null}
                        </div>

                        <div className="mt-4 grid gap-3 rounded border border-gray-200 bg-gray-50 p-3 md:grid-cols-[minmax(0,1.1fr)_180px_180px_minmax(0,1.2fr)_auto]">
                          <label className="min-w-0">
                            <span className="mb-1 block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                              Редактор
                            </span>
                            <input
                              type="text"
                              value={draft.assignedEditor}
                              onChange={(event) => updateDraft(item.queueKey, { assignedEditor: event.target.value })}
                              placeholder="Напр. Ани Петрова"
                              aria-label={`Редактор за ${item.title}`}
                              disabled={busy}
                              className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple disabled:opacity-50"
                            />
                          </label>

                          <label>
                            <span className="mb-1 block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                              Приоритет
                            </span>
                            <select
                              value={draft.priority}
                              onChange={(event) => updateDraft(item.queueKey, { priority: event.target.value })}
                              aria-label={`Приоритет за ${item.title}`}
                              disabled={busy}
                              className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple disabled:opacity-50"
                            >
                              {PRIORITY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span className="mb-1 block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                              Срок
                            </span>
                            <input
                              type="date"
                              value={draft.dueAtInput}
                              onChange={(event) => updateDraft(item.queueKey, { dueAtInput: event.target.value })}
                              aria-label={`Срок за ${item.title}`}
                              disabled={busy}
                              className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple disabled:opacity-50"
                            />
                          </label>

                          <label className="min-w-0">
                            <span className="mb-1 block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500">
                              Тагове
                            </span>
                            <input
                              type="text"
                              value={draft.tagsInput}
                              onChange={(event) => updateDraft(item.queueKey, { tagsInput: event.target.value })}
                              placeholder="корекция, репортаж, право на отговор"
                              aria-label={`Тагове за ${item.title}`}
                              disabled={busy}
                              className="w-full border border-gray-200 bg-white px-3 py-2 text-sm font-sans text-gray-700 outline-none focus:border-zn-purple disabled:opacity-50"
                            />
                          </label>

                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleClaimItem(item)}
                              disabled={busy || !session?.name}
                              className="inline-flex items-center gap-1.5 px-3 py-2 border border-violet-200 text-xs font-sans font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Поеми
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveMeta(item)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-sans font-semibold text-gray-700 hover:bg-white disabled:opacity-50"
                            >
                              {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              Запази
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => navigate(buildAdminSourceUrl(item))}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-sans font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Отвори източника
                    </button>
                    <a
                      href={buildAdminAuditLogUrl(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-sans font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Журнал
                    </a>
                    {!isTip && item.relatedArticleId ? (
                      <>
                        <a
                          href={buildPublicArticleUrl(item.relatedArticleId)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 text-xs font-sans font-semibold text-violet-700 hover:bg-violet-50"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Публична публикация
                        </a>
                        <a
                          href={buildAdminRelatedArticleUrl(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-violet-200/70 text-xs font-sans font-semibold text-violet-700 hover:bg-violet-50"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Публикация в админа
                        </a>
                      </>
                    ) : null}
                    {!isTip && item.responseArticleId ? (
                      <>
                        {item.responseArticleStatus === 'published' ? (
                          <a
                            href={buildPublicArticleUrl(item.responseArticleId)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-xs font-sans font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Публичен отговор
                          </a>
                        ) : null}
                        <a
                          href={buildAdminResponseArticleUrl(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-xs font-sans font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {item.responseArticleStatus === 'published' ? 'Отговор в админа' : 'Чернова в админа'}
                        </a>
                      </>
                    ) : null}

                    {isTip ? (
                      <>
                        {item.rawStatus !== 'processed' ? (
                          <button
                            type="button"
                            onClick={() => void runTipStatusUpdate(item, 'processed')}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-xs font-sans font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Отбележи като обработен
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleConvertTipToArticle(item)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zn-purple/20 text-xs font-sans font-semibold text-zn-purple hover:bg-zn-purple/10 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Превърни в статия
                        </button>
                        {item.rawStatus !== 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => void runTipStatusUpdate(item, 'rejected')}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-sans font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            Затвори
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void runTipDelete(item)}
                          disabled={busy}
                          aria-label="Изтрий сигнал от входящата опашка"
                          className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                        >
                          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </>
                    ) : (
                      <>
                        {item.requestKind === 'right_of_reply' ? (
                          <button
                            type="button"
                            onClick={() => void handlePrepareRightOfReply(item)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 text-xs font-sans font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {item.responseArticleId ? 'Обнови отговора' : 'Подготви отговор'}
                          </button>
                        ) : null}
                        {item.rawStatus !== 'read' ? (
                          <button
                            type="button"
                            onClick={() => void runContactStatusUpdate(item, 'read')}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-xs font-sans font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Отбележи като обработено
                          </button>
                        ) : null}
                        {item.rawStatus !== 'archived' ? (
                          <button
                            type="button"
                            onClick={() => void runContactStatusUpdate(item, 'archived')}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-sans font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            Архивирай
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void runContactDelete(item)}
                          disabled={busy}
                          aria-label="Изтрий запитване от входящата опашка"
                          className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                        >
                          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
