import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, inputValue, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const refreshTips = vi.fn(async () => []);
const ensureTipsLoaded = vi.fn(async () => []);
const updateTip = vi.fn(async () => ({}));
const deleteTip = vi.fn(async () => ({}));
const getAllContactMessages = vi.fn(async () => []);
const updateContactMessage = vi.fn(async () => ({}));
const deleteContactMessage = vi.fn(async () => ({}));
const getArticleById = vi.fn(async () => null);
const updateComment = vi.fn(async () => ({}));
const deleteComment = vi.fn(async () => ({}));
const addJob = vi.fn(async () => ({}));
const updateJob = vi.fn(async () => ({}));
const deleteJob = vi.fn(async () => ({}));
const addEvent = vi.fn(async () => ({}));
const updateEvent = vi.fn(async () => ({}));
const deleteEvent = vi.fn(async () => ({}));
const addWanted = vi.fn(async () => ({}));
const updateWanted = vi.fn(async () => ({}));
const deleteWanted = vi.fn(async () => ({}));
const addGalleryItem = vi.fn(async () => ({}));
const updateGalleryItem = vi.fn(async () => ({}));
const deleteGalleryItem = vi.fn(async () => ({}));
const addCategory = vi.fn(async () => ({}));
const updateCategory = vi.fn(async () => ({}));
const deleteCategory = vi.fn(async () => ({}));
const addCourtCase = vi.fn(async () => ({}));
const updateCourtCase = vi.fn(async () => ({}));
const deleteCourtCase = vi.fn(async () => ({}));
const getAuditLogPage = vi.fn(async () => ({ items: [], nextCursor: null }));
const getAllGames = vi.fn(async () => []);
const updateGame = vi.fn(async () => ({}));
const updatePermission = vi.fn(async () => ({}));
const createRole = vi.fn(async () => ({}));
const saveBreaking = vi.fn(async () => ({}));
const navigate = vi.fn();
const confirm = vi.fn(async () => true);
const setSearchParamsSpy = vi.fn();

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

let adminDataState = {};
let publicDataState = {};
let sessionState = {};
let searchParamsState = '';
let originalLocalStorage;

function installLocalStorageStub() {
  const store = new Map();
  if (originalLocalStorage === undefined) {
    originalLocalStorage = window.localStorage;
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    },
  });
}

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
  usePublicData: () => publicDataState,
  useSessionData: () => sessionState,
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
}));

vi.mock('../../src/components/admin/ConfirmDialog', () => ({
  useConfirm: () => confirm,
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    contactMessages: {
      getAll: (...args) => getAllContactMessages(...args),
      update: (...args) => updateContactMessage(...args),
      delete: (...args) => deleteContactMessage(...args),
    },
    articles: {
      getById: (...args) => getArticleById(...args),
    },
    auditLog: {
      getPage: (...args) => getAuditLogPage(...args),
    },
    adminGames: {
      getAll: (...args) => getAllGames(...args),
      update: (...args) => updateGame(...args),
    },
  },
}));

vi.mock('../../src/components/admin/AdminImageField', () => ({
  default: () => null,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => {
    const [params, setParams] = React.useState(() => new URLSearchParams(searchParamsState));

    const updateParams = (nextInit, options) => {
      setParams((currentParams) => {
        const resolvedParams = typeof nextInit === 'function'
          ? nextInit(currentParams)
          : nextInit;
        const nextParams = new URLSearchParams(resolvedParams);
        searchParamsState = nextParams.toString();
        setSearchParamsSpy(searchParamsState, options ?? null);
        return nextParams;
      });
    };

    return [params, updateParams];
  },
}));

const { default: ManageTips } = await import('../../src/pages/admin/ManageTips.jsx');
const { default: ManageContactMessages } = await import('../../src/pages/admin/ManageContactMessages.jsx');
const { default: ManageIntakeQueue } = await import('../../src/pages/admin/ManageIntakeQueue.jsx');
const { default: ManageComments } = await import('../../src/pages/admin/ManageComments.jsx');
const { default: ManageJobs } = await import('../../src/pages/admin/ManageJobs.jsx');
const { default: ManageEvents } = await import('../../src/pages/admin/ManageEvents.jsx');
const { default: ManageMostWanted } = await import('../../src/pages/admin/ManageMostWanted.jsx');
const { default: ManageGallery } = await import('../../src/pages/admin/ManageGallery.jsx');
const { default: ManageCategories } = await import('../../src/pages/admin/ManageCategories.jsx');
const { default: ManageCourt } = await import('../../src/pages/admin/ManageCourt.jsx');
const { default: ManageAuditLog } = await import('../../src/pages/admin/ManageAuditLog.jsx');
const { default: ManageProfiles } = await import('../../src/pages/admin/ManageProfiles.jsx');
const { default: ManageGames } = await import('../../src/pages/admin/ManageGames.jsx');
const { default: ManagePermissions } = await import('../../src/pages/admin/ManagePermissions.jsx');
const { default: ManageBreaking } = await import('../../src/pages/admin/ManageBreaking.jsx');

describe('AdminSystem', () => {
  let root;
  let container;

  beforeEach(() => {
    installLocalStorageStub();
  });

  afterEach(async () => {
    refreshTips.mockReset();
    ensureTipsLoaded.mockReset();
    updateTip.mockReset();
    deleteTip.mockReset();
    getAllContactMessages.mockReset();
    updateContactMessage.mockReset();
    deleteContactMessage.mockReset();
    getArticleById.mockReset();
    updateComment.mockReset();
    deleteComment.mockReset();
    addJob.mockReset();
    updateJob.mockReset();
    deleteJob.mockReset();
    addEvent.mockReset();
    updateEvent.mockReset();
    deleteEvent.mockReset();
    addWanted.mockReset();
    updateWanted.mockReset();
    deleteWanted.mockReset();
    addGalleryItem.mockReset();
    updateGalleryItem.mockReset();
    deleteGalleryItem.mockReset();
    addCategory.mockReset();
    updateCategory.mockReset();
    deleteCategory.mockReset();
    addCourtCase.mockReset();
    updateCourtCase.mockReset();
    deleteCourtCase.mockReset();
    getAuditLogPage.mockReset();
    getAllGames.mockReset();
    updateGame.mockReset();
    updatePermission.mockReset();
    createRole.mockReset();
    saveBreaking.mockReset();
    navigate.mockReset();
    confirm.mockReset();
    setSearchParamsSpy.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.warning.mockReset();
    toast.info.mockReset();
    adminDataState = {};
    publicDataState = {};
    sessionState = {};
    searchParamsState = '';
    window.localStorage?.clear?.();
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('renders the shared search and empty state for tipline results', async () => {
    adminDataState = {
      tips: [
        {
          id: 11,
          text: 'Катастрофа пред болницата',
          location: 'Лос Сантос',
          status: 'new',
          createdAt: '2026-04-09T08:00:00.000Z',
        },
        {
          id: 12,
          text: 'Случай в Блейн Каунти',
          location: 'Блейн Каунти',
          status: 'new',
          createdAt: '2026-04-09T09:00:00.000Z',
        },
      ],
      tipsReady: true,
      refreshTips,
      ensureTipsLoaded,
      updateTip,
      deleteTip,
    };
    searchParamsState = 'q=%D0%9B%D0%BE%D1%81';

    ({ root, container } = await renderIntoBody(ManageTips));
    await flushEffects();

    expect(container.querySelector('button[aria-label="Изтрий сигнал"]')).not.toBeNull();
    expect(container.textContent).toContain('Катастрофа пред болницата');
    expect(container.textContent).not.toContain('Случай в Блейн Каунти');

    const searchInput = container.querySelector('input[aria-label="Търси сигнал по текст или локация"]');
    expect(searchInput.value).toBe('Лос');
    await inputValue(searchInput, 'несъществуващ');

    expect(container.textContent).toContain('Няма сигнали');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=%D0%BD%D0%B5%D1%81%D1%8A%D1%89%D0%B5%D1%81%D1%82%D0%B2%D1%83%D0%B2%D0%B0%D1%89', { replace: true });
  });

  it('filters contact messages by search query and exposes accessible row actions', async () => {
    sessionState = { session: { token: 'admin-token' } };
    adminDataState = {
      hasPermission: (permission) => permission === 'contact',
    };
    getAllContactMessages.mockResolvedValueOnce([
      {
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: '',
        message: 'Имам сигнал за статията.',
        status: 'new',
        createdAt: '2026-04-09T09:00:00.000Z',
      },
      {
        id: 42,
        name: 'Мария',
        phone: '7771234',
        email: '',
        message: 'Просто поздрави.',
        status: 'read',
        createdAt: '2026-04-09T10:00:00.000Z',
      },
    ]);
    searchParamsState = 'status=read&q=%D0%BC%D0%B0%D1%80';

    ({ root, container } = await renderIntoBody(ManageContactMessages));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси контактни съобщения"]');
    expect(searchInput.value).toBe('мар');
    expect(container.textContent).toContain('Мария');
    expect(container.textContent).not.toContain('Диего');

    const allButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Всички (2)'));
    await click(allButton);
    await inputValue(searchInput, 'диего');

    expect(container.textContent).toContain('Диего');
    expect(container.textContent).not.toContain('Мария');
    expect(container.querySelector('button[aria-label="Изтрий съобщение"]')).not.toBeNull();
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=%D0%B4%D0%B8%D0%B5%D0%B3%D0%BE', { replace: true });
  });

  it('bulk-processes selected tips from the legacy tips screen', async () => {
    adminDataState = {
      tips: [
        {
          id: 11,
          text: 'Катастрофа пред болницата',
          location: 'Лос Сантос',
          status: 'new',
          createdAt: '2026-04-09T08:00:00.000Z',
        },
        {
          id: 12,
          text: 'Скандал пред клуба',
          location: 'Вайнвуд',
          status: 'new',
          createdAt: '2026-04-09T09:00:00.000Z',
        },
      ],
      tipsReady: true,
      refreshTips,
      ensureTipsLoaded,
      updateTip,
      deleteTip,
    };

    ({ root, container } = await renderIntoBody(ManageTips));
    await flushEffects();

    const selectVisible = container.querySelector('input[aria-label="Избери всички видими сигнали"]');
    await click(selectVisible);
    await flushEffects();

    const bulkProcessButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Обработи избраните (2)'));
    await click(bulkProcessButton);
    await flushEffects();

    expect(updateTip).toHaveBeenCalledTimes(2);
    expect(updateTip).toHaveBeenCalledWith(11, 'processed');
    expect(updateTip).toHaveBeenCalledWith(12, 'processed');
    expect(toast.success).toHaveBeenCalledWith('Обработени сигнали: 2');
  });

  it('bulk-archives selected contact messages from the legacy contact screen', async () => {
    sessionState = { session: { token: 'admin-token' } };
    adminDataState = {
      hasPermission: (permission) => permission === 'contact',
    };
    getAllContactMessages.mockResolvedValueOnce([
      {
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: '',
        message: 'Искам право на отговор.',
        status: 'new',
        createdAt: '2026-04-09T09:00:00.000Z',
      },
      {
        id: 42,
        name: 'Мария',
        phone: '7771234',
        email: '',
        message: 'Здравейте.',
        status: 'read',
        createdAt: '2026-04-09T10:00:00.000Z',
      },
    ]);
    updateContactMessage
      .mockResolvedValueOnce({
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: '',
        message: 'Искам право на отговор.',
        status: 'archived',
        createdAt: '2026-04-09T09:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 42,
        name: 'Мария',
        phone: '7771234',
        email: '',
        message: 'Здравейте.',
        status: 'archived',
        createdAt: '2026-04-09T10:00:00.000Z',
      });

    ({ root, container } = await renderIntoBody(ManageContactMessages));
    await flushEffects();

    const selectVisible = container.querySelector('input[aria-label="Избери всички видими съобщения"]');
    await click(selectVisible);
    await flushEffects();

    const archiveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Архивирай избраните (2)'));
    await click(archiveButton);
    await flushEffects();

    expect(updateContactMessage).toHaveBeenCalledTimes(2);
    expect(updateContactMessage).toHaveBeenCalledWith(41, { status: 'archived' });
    expect(updateContactMessage).toHaveBeenCalledWith(42, { status: 'archived' });
    expect(toast.success).toHaveBeenCalledWith('Архивирани съобщения: 2');
  });

  it('combines tips and contact messages into a unified intake queue with URL-synced filters', async () => {
    sessionState = { session: { token: 'admin-token' } };
    adminDataState = {
      tips: [
        {
          id: 11,
          text: 'Катастрофа пред болницата',
          location: 'Лос Сантос',
          status: 'new',
          createdAt: '2026-04-09T08:00:00.000Z',
        },
      ],
      tipsReady: true,
      ensureTipsLoaded,
      refreshTips,
      updateTip,
      deleteTip,
      hasPermission: (permission) => Array.isArray(permission)
        ? permission.some((entry) => entry === 'articles' || entry === 'contact')
        : permission === 'articles' || permission === 'contact',
    };
    getAllContactMessages.mockResolvedValueOnce([
      {
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: '',
        message: 'Искам право на отговор.',
        status: 'new',
        createdAt: '2026-04-09T09:00:00.000Z',
      },
    ]);
    searchParamsState = 'source=contact&status=new&q=%D0%B4%D0%B8%D0%B5%D0%B3%D0%BE';

    ({ root, container } = await renderIntoBody(ManageIntakeQueue));
    await flushEffects();

    expect(container.textContent).toContain('Входяща опашка');
    expect(container.textContent).toContain('Диего');
    expect(container.textContent).not.toContain('Катастрофа пред болницата');

    const searchInput = container.querySelector('input[aria-label="Търси във входящата опашка"]');
    expect(searchInput?.value).toBe('диего');
    await inputValue(searchInput, 'лос');

    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('source=contact&status=new&q=%D0%BB%D0%BE%D1%81', { replace: true });

    const allSourcesButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Всички източници'));
    await click(allSourcesButton);
    await flushEffects();

    expect(container.textContent).toContain('Катастрофа пред болницата');
    expect(container.querySelector('button[aria-label="Изтрий сигнал от входящата опашка"]')).not.toBeNull();
  });

  it('saves editorial queue fields for tip items from the unified intake queue', async () => {
    sessionState = { session: { token: 'admin-token', name: 'Ани Петрова' } };
    adminDataState = {
      tips: [
        {
          id: 11,
          text: 'Катастрофа пред болницата',
          location: 'Лос Сантос',
          status: 'new',
          priority: 'normal',
          assignedEditor: '',
          tags: [],
          createdAt: '2026-04-09T08:00:00.000Z',
        },
      ],
      tipsReady: true,
      ensureTipsLoaded,
      refreshTips,
      updateTip,
      deleteTip,
      hasPermission: (permission) => Array.isArray(permission)
        ? permission.some((entry) => entry === 'articles')
        : permission === 'articles',
    };
    updateTip.mockResolvedValueOnce({
      id: 11,
      text: 'Катастрофа пред болницата',
      location: 'Лос Сантос',
      status: 'new',
      priority: 'high',
      assignedEditor: 'Ани Петрова',
      tags: ['корекция', 'следене'],
      dueAt: '2026-04-12T20:59:59.999Z',
      lastActionAt: '2026-04-09T10:30:00.000Z',
      lastActionBy: 'Ани Петрова',
      createdAt: '2026-04-09T08:00:00.000Z',
    });

    ({ root, container } = await renderIntoBody(ManageIntakeQueue));
    await flushEffects();

    const assigneeInput = container.querySelector('input[aria-label="Редактор за Лос Сантос"]');
    const tagsInput = container.querySelector('input[aria-label="Тагове за Лос Сантос"]');
    const prioritySelect = container.querySelector('select[aria-label="Приоритет за Лос Сантос"]');
    const dueAtInput = container.querySelector('input[aria-label="Срок за Лос Сантос"]');

    await inputValue(assigneeInput, 'Ани Петрова');
    await inputValue(tagsInput, 'корекция, следене');
    await inputValue(dueAtInput, '2026-04-12');
    prioritySelect.value = 'high';
    prioritySelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushEffects();

    const saveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Запази'));
    await click(saveButton);
    await flushEffects();

    expect(updateTip).toHaveBeenLastCalledWith(11, {
      assignedEditor: 'Ани Петрова',
      priority: 'high',
      tags: ['корекция', 'следене'],
      dueAt: '2026-04-12',
    });
  });

  it('bulk-processes selected tip and contact intake items through the correct update paths', async () => {
    sessionState = { session: { token: 'admin-token', name: 'Ани Петрова' } };
    adminDataState = {
      tips: [
        {
          id: 11,
          text: 'Катастрофа пред болницата',
          location: 'Лос Сантос',
          status: 'new',
          priority: 'normal',
          assignedEditor: '',
          tags: [],
          createdAt: '2026-04-09T08:00:00.000Z',
        },
      ],
      tipsReady: true,
      ensureTipsLoaded,
      refreshTips,
      updateTip,
      deleteTip,
      hasPermission: (permission) => Array.isArray(permission)
        ? permission.some((entry) => entry === 'articles' || entry === 'contact')
        : permission === 'articles' || permission === 'contact',
    };
    getAllContactMessages.mockResolvedValueOnce([
      {
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: '',
        message: 'Искам право на отговор.',
        status: 'new',
        priority: 'normal',
        assignedEditor: '',
        tags: [],
        createdAt: '2026-04-09T09:00:00.000Z',
      },
    ]);
    updateTip.mockResolvedValueOnce({
      id: 11,
      text: 'Катастрофа пред болницата',
      location: 'Лос Сантос',
      status: 'processed',
      priority: 'normal',
      assignedEditor: '',
      tags: [],
      createdAt: '2026-04-09T08:00:00.000Z',
    });
    updateContactMessage.mockResolvedValueOnce({
      id: 41,
      name: 'Диего',
      phone: '9652438',
      email: '',
      message: 'Искам право на отговор.',
      status: 'read',
      priority: 'normal',
      assignedEditor: '',
      tags: [],
      createdAt: '2026-04-09T09:00:00.000Z',
    });

    ({ root, container } = await renderIntoBody(ManageIntakeQueue));
    await flushEffects();

    const selectVisibleButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Избери видимите'));
    await click(selectVisibleButton);
    await flushEffects();

    expect(container.textContent).toContain('Избрани: 2');

    const bulkProcessButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Обработи избраните'));
    await click(bulkProcessButton);
    await flushEffects();

    expect(updateTip).toHaveBeenLastCalledWith(11, 'processed');
    expect(updateContactMessage).toHaveBeenLastCalledWith(41, { status: 'read' });
    expect(container.textContent).toContain('Няма избрани елементи');
  });

  it('hydrates intake queue owner and priority filters from the URL and applies saved views', async () => {
    sessionState = { session: { token: 'admin-token', name: 'Ани Петрова' } };
    adminDataState = {
      tips: [
        {
          id: 11,
          text: 'Катастрофа пред болницата',
          location: 'Лос Сантос',
          status: 'new',
          priority: 'urgent',
          assignedEditor: 'Ани Петрова',
          tags: ['право на отговор'],
          dueAt: '2026-04-08T20:59:59.999Z',
          lastActionAt: '2026-04-09T10:30:00.000Z',
          lastActionBy: 'Ани Петрова',
          createdAt: '2026-04-09T08:00:00.000Z',
        },
      ],
      tipsReady: true,
      ensureTipsLoaded,
      refreshTips,
      updateTip,
      deleteTip,
      hasPermission: (permission) => Array.isArray(permission)
        ? permission.some((entry) => entry === 'articles' || entry === 'contact')
        : permission === 'articles' || permission === 'contact',
    };
    getAllContactMessages.mockResolvedValueOnce([
      {
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: '',
        message: 'Искам право на отговор.',
        status: 'new',
        priority: 'normal',
        assignedEditor: '',
        tags: [],
        createdAt: '2026-04-09T09:00:00.000Z',
      },
    ]);
    searchParamsState = 'priority=urgent&owner=mine&due=overdue';

    ({ root, container } = await renderIntoBody(ManageIntakeQueue));
    await flushEffects();

    expect(container.textContent).toContain('Катастрофа пред болницата');
    expect(container.textContent).not.toContain('Диего');

    const priorityFilter = container.querySelector('select[aria-label="Филтрирай входящата опашка по приоритет"]');
    const ownerFilter = container.querySelector('select[aria-label="Филтрирай входящата опашка по редактор"]');
    const dueFilter = container.querySelector('select[aria-label="Филтрирай входящата опашка по срок"]');
    expect(priorityFilter?.value).toBe('urgent');
    expect(ownerFilter?.value).toBe('mine');
    expect(dueFilter?.value).toBe('overdue');
    expect(container.textContent).toContain('Просрочено');

    const newContactView = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Нови запитвания'));
    await click(newContactView);
    await flushEffects();

    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('source=contact&status=new', { replace: true });
  });

  it('surfaces right-of-reply requests as a distinct intake type with linked article context', async () => {
    sessionState = { session: { token: 'admin-token', name: 'Ани Петрова' } };
    adminDataState = {
      tips: [],
      tipsReady: true,
      ensureTipsLoaded,
      refreshTips,
      updateTip,
      deleteTip,
      hasPermission: (permission) => Array.isArray(permission)
        ? permission.some((entry) => entry === 'articles' || entry === 'contact')
        : permission === 'articles' || permission === 'contact',
    };
    getAllContactMessages.mockResolvedValueOnce([
      {
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: '',
        message: 'Искам право на отговор.',
        requestKind: 'right_of_reply',
        relatedArticleId: 88,
        relatedArticleTitle: 'Скандал в центъра',
        responseArticleId: 101,
        responseArticleStatus: 'draft',
        status: 'new',
        priority: 'high',
        createdAt: '2026-04-09T09:00:00.000Z',
      },
      {
        id: 42,
        name: 'Марио',
        phone: '9652000',
        email: '',
        message: 'Обикновено запитване.',
        requestKind: 'general',
        status: 'new',
        priority: 'normal',
        createdAt: '2026-04-09T08:00:00.000Z',
      },
    ]);
    searchParamsState = 'kind=right_of_reply';

    ({ root, container } = await renderIntoBody(ManageIntakeQueue));
    await flushEffects();

    expect(container.textContent).toContain('Право на отговор');
    expect(container.textContent).toContain('Скандал в центъра');
    expect(container.textContent).toContain('Чернова на отговор: Статия #101');
    expect(container.textContent).not.toContain('Обикновено запитване.');
    expect(container.querySelector('a[href="/article/88"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/articles?q=88"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/articles?q=101"]')).not.toBeNull();
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('Обнови отговора'))).toBe(true);

    const kindFilter = container.querySelector('select[aria-label="Филтрирай входящата опашка по тип заявка"]');
    expect(kindFilter?.value).toBe('right_of_reply');

    const savedViewButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Права на отговор'));
    await click(savedViewButton);
    await flushEffects();

    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('kind=right_of_reply&source=contact', { replace: true });
  });

  it('shows a public shortcut when a right-of-reply response is already published', async () => {
    sessionState = { session: { token: 'admin-token', name: 'Ани Петрова' } };
    adminDataState = {
      tips: [],
      tipsReady: true,
      ensureTipsLoaded,
      refreshTips,
      updateTip,
      deleteTip,
      hasPermission: (permission) => Array.isArray(permission)
        ? permission.some((entry) => entry === 'articles' || entry === 'contact')
        : permission === 'articles' || permission === 'contact',
    };
    getAllContactMessages.mockResolvedValueOnce([
      {
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: '',
        message: 'Позицията ми вече е публикувана.',
        requestKind: 'right_of_reply',
        relatedArticleId: 88,
        relatedArticleTitle: 'Скандал в центъра',
        responseArticleId: 101,
        responseArticleStatus: 'published',
        status: 'archived',
        priority: 'high',
        createdAt: '2026-04-09T09:00:00.000Z',
      },
    ]);
    searchParamsState = 'kind=right_of_reply';

    ({ root, container } = await renderIntoBody(ManageIntakeQueue));
    await flushEffects();

    expect(container.textContent).toContain('Публикуван отговор: Статия #101');
    expect(container.querySelector('a[href="/article/101"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/articles?q=101"]')).not.toBeNull();
    expect(container.textContent).toContain('Публичен отговор');
    expect(container.textContent).toContain('Отговор в админа');
  });

  it('prepares a draft article from a right-of-reply intake item and opens the article editor', async () => {
    sessionState = { session: { token: 'admin-token', name: 'Ани Петрова' } };
    adminDataState = {
      tips: [],
      tipsReady: true,
      ensureTipsLoaded,
      refreshTips,
      updateTip,
      deleteTip,
      hasPermission: (permission) => Array.isArray(permission)
        ? permission.some((entry) => entry === 'articles' || entry === 'contact')
        : permission === 'articles' || permission === 'contact',
    };
    getAllContactMessages.mockResolvedValueOnce([
      {
        id: 41,
        name: 'Диего',
        phone: '9652438',
        email: 'diego@example.com',
        message: 'Искам редакцията да публикува моята позиция.',
        requestKind: 'right_of_reply',
        relatedArticleId: 88,
        relatedArticleTitle: 'Скандал в центъра',
        status: 'new',
        priority: 'high',
        createdAt: '2026-04-09T09:00:00.000Z',
      },
    ]);
    getArticleById.mockResolvedValueOnce({
      id: 88,
      title: 'Скандал в центъра',
      category: 'society',
    });
    updateContactMessage.mockResolvedValueOnce({
      id: 41,
      name: 'Диего',
      phone: '9652438',
      email: 'diego@example.com',
      message: 'Искам редакцията да публикува моята позиция.',
      requestKind: 'right_of_reply',
      relatedArticleId: 88,
      relatedArticleTitle: 'Скандал в центъра',
      status: 'read',
      priority: 'high',
      createdAt: '2026-04-09T09:00:00.000Z',
    });

    ({ root, container } = await renderIntoBody(ManageIntakeQueue));
    await flushEffects();

    const prepareButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Подготви отговор'));
    await click(prepareButton);
    await flushEffects();

    const prefillRaw = window.localStorage.getItem('znews_intake_article_prefill_v1');
    const prefill = JSON.parse(prefillRaw || '{}');

    expect(getArticleById).toHaveBeenCalledWith(88);
    expect(updateContactMessage).toHaveBeenLastCalledWith(41, { status: 'read' });
    expect(prefill.title).toBe('Право на отговор: Скандал в центъра');
    expect(prefill.category).toBe('society');
    expect(prefill.status).toBe('draft');
    expect(prefill.relatedArticles).toEqual([88]);
    expect(prefill.tags).toEqual(['право на отговор']);
    expect(prefill.cardSticker).toBe('ПРАВО НА ОТГОВОР');
    expect(prefill.intakeMeta).toEqual({
      source: 'contact',
      requestId: 41,
      requestKind: 'right_of_reply',
      relatedArticleId: 88,
      relatedArticleTitle: 'Скандал в центъра',
    });
    expect(prefill.content).toContain('Искам редакцията да публикува моята позиция.');
    expect(navigate).toHaveBeenCalledWith('/admin/articles');
  });

  it('keeps comment actions accessible and shows the shared empty state when search misses', async () => {
    publicDataState = {
      comments: [
        {
          id: 9,
          articleId: 5,
          author: 'Ники',
          avatar: '😱',
          text: 'Това е тестов коментар',
          date: '2026-04-09 11:00',
          likes: 1,
          dislikes: 0,
          approved: false,
          parentId: null,
        },
        {
          id: 10,
          articleId: 5,
          author: 'Миро',
          avatar: '🔥',
          text: 'Одобрен тест',
          date: '2026-04-09 12:00',
          likes: 0,
          dislikes: 0,
          approved: true,
          parentId: null,
        },
      ],
      articles: [{ id: 5, title: 'Голямата новина' }],
      updateComment,
      deleteComment,
    };
    searchParamsState = 'status=approved&q=%D0%BE%D0%B4%D0%BE%D0%B1%D1%80%D0%B5%D0%BD';

    ({ root, container } = await renderIntoBody(ManageComments));
    await flushEffects();

    expect(container.textContent).toContain('Одобрен тест');
    expect(container.textContent).not.toContain('Това е тестов коментар');
    expect(container.querySelector('button[aria-label="Изтрий коментар"]')).not.toBeNull();

    const searchInput = container.querySelector('input[aria-label="Търси коментар по автор или текст"]');
    await inputValue(searchInput, 'несъществуващ');

    expect(container.textContent).toContain('Няма коментари');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('status=approved&q=%D0%BD%D0%B5%D1%81%D1%8A%D1%89%D0%B5%D1%81%D1%82%D0%B2%D1%83%D0%B2%D0%B0%D1%89', { replace: true });
  });

  it('bulk-approves the selected visible comments', async () => {
    publicDataState = {
      comments: [
        {
          id: 21,
          articleId: 5,
          author: 'Ели',
          avatar: '🔥',
          text: 'Първи чакащ коментар',
          date: '2026-04-09 13:00',
          likes: 0,
          dislikes: 0,
          approved: false,
          parentId: null,
        },
        {
          id: 22,
          articleId: 5,
          author: 'Миро',
          avatar: '📰',
          text: 'Втори чакащ коментар',
          date: '2026-04-09 14:00',
          likes: 0,
          dislikes: 0,
          approved: false,
          parentId: null,
        },
      ],
      articles: [{ id: 5, title: 'Голямата новина' }],
      updateComment,
      deleteComment,
    };

    ({ root, container } = await renderIntoBody(ManageComments));
    await flushEffects();

    const selectAll = container.querySelector('input[aria-label="Избери всички видими коментари"]');
    await click(selectAll);
    await flushEffects();

    const bulkApproveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Одобри избраните (2)'));
    await click(bulkApproveButton);
    await flushEffects();

    expect(updateComment).toHaveBeenCalledTimes(2);
    expect(updateComment).toHaveBeenNthCalledWith(1, 21, { approved: true });
    expect(updateComment).toHaveBeenNthCalledWith(2, 22, { approved: true });
    expect(toast.success).toHaveBeenCalledWith('Одобрени коментари: 2');
  });

  it('filters jobs with the shared search field and keeps row actions accessible', async () => {
    publicDataState = {
      jobs: [
        {
          id: 1,
          title: 'Механик в сервиз',
          org: 'Los Santos Customs',
          type: 'mechanic',
          salary: '$4000',
          contact: '9652438',
          requirements: 'Опит',
          active: true,
        },
        {
          id: 2,
          title: 'Парамедик',
          org: 'EMS',
          type: 'ems',
          salary: '$5000',
          contact: '7771234',
          requirements: 'Лиценз',
          active: false,
        },
      ],
      addJob,
      updateJob,
      deleteJob,
    };

    ({ root, container } = await renderIntoBody(ManageJobs));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси обяви за работа"]');
    await inputValue(searchInput, 'ems');

    expect(container.textContent).toContain('Парамедик');
    expect(container.textContent).not.toContain('Механик в сервиз');
    expect(container.querySelector('button[aria-label="Редактирай обявата"]')).not.toBeNull();
  });

  it('hydrates jobs search from the URL and syncs updates back', async () => {
    searchParamsState = 'q=ems';
    publicDataState = {
      jobs: [
        { id: 1, title: 'Механик в сервиз', org: 'Los Santos Customs', type: 'mechanic', salary: '$4000', contact: '9652438', requirements: 'Опит', active: true },
        { id: 2, title: 'Парамедик', org: 'EMS', type: 'ems', salary: '$5000', contact: '7771234', requirements: 'Лиценз', active: false },
      ],
      addJob,
      updateJob,
      deleteJob,
    };

    ({ root, container } = await renderIntoBody(ManageJobs));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси обяви за работа"]');
    expect(searchInput?.value).toBe('ems');
    expect(container.textContent).toContain('Парамедик');
    expect(container.textContent).not.toContain('Механик в сервиз');

    await inputValue(searchInput, 'mechanic');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=mechanic', { replace: true });
  });

  it('filters events and keeps event row actions accessible', async () => {
    publicDataState = {
      events: [
        {
          id: 11,
          title: 'Illegal Drift Night',
          location: 'Docks',
          organizer: 'Midnight Crew',
          description: 'Нощни дрифтове',
          type: 'race',
          image: '🏁',
          date: '2026-04-09',
          time: '23:00',
        },
        {
          id: 12,
          title: 'City Hall Briefing',
          location: 'City Hall',
          organizer: 'Община',
          description: 'Официална среща',
          type: 'meeting',
          image: '🤝',
          date: '2026-04-10',
          time: '18:00',
        },
      ],
      addEvent,
      updateEvent,
      deleteEvent,
    };

    ({ root, container } = await renderIntoBody(ManageEvents));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси събития"]');
    await inputValue(searchInput, 'docks');

    expect(container.textContent).toContain('Illegal Drift Night');
    expect(container.textContent).not.toContain('City Hall Briefing');
    expect(container.querySelector('button[aria-label="Редактирай събитието"]')).not.toBeNull();
  });

  it('hydrates events search from the URL and syncs updates back', async () => {
    searchParamsState = 'q=docks';
    publicDataState = {
      events: [
        { id: 11, title: 'Illegal Drift Night', location: 'Docks', organizer: 'Midnight Crew', description: 'Нощни дрифтове', type: 'race', image: '🏁', date: '2026-04-09', time: '23:00' },
        { id: 12, title: 'City Hall Briefing', location: 'City Hall', organizer: 'Община', description: 'Официална среща', type: 'meeting', image: '🤝', date: '2026-04-10', time: '18:00' },
      ],
      addEvent,
      updateEvent,
      deleteEvent,
    };

    ({ root, container } = await renderIntoBody(ManageEvents));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси събития"]');
    expect(searchInput?.value).toBe('docks');
    expect(container.textContent).toContain('Illegal Drift Night');
    expect(container.textContent).not.toContain('City Hall Briefing');

    await inputValue(searchInput, 'hall');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=hall', { replace: true });
  });

  it('filters wanted records and keeps wanted row actions accessible', async () => {
    publicDataState = {
      wanted: [
        { id: 7, name: 'Иван Ковача', bounty: '$50000', charge: 'Въоръжен грабеж', danger: 'high' },
        { id: 8, name: 'Марко Лисицата', bounty: '$10000', charge: 'Измама', danger: 'medium' },
      ],
      addWanted,
      updateWanted,
      deleteWanted,
    };

    ({ root, container } = await renderIntoBody(ManageMostWanted));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси издирвани лица"]');
    await inputValue(searchInput, 'измама');

    expect(container.textContent).toContain('Марко Лисицата');
    expect(container.textContent).not.toContain('Иван Ковача');
    expect(container.querySelector('button[aria-label="Изтрий издирваното лице"]')).not.toBeNull();
  });

  it('hydrates wanted search from the URL and syncs updates back', async () => {
    searchParamsState = 'q=%D0%B8%D0%B7%D0%BC%D0%B0%D0%BC%D0%B0';
    publicDataState = {
      wanted: [
        { id: 7, name: 'Иван Ковача', bounty: '$50000', charge: 'Въоръжен грабеж', danger: 'high' },
        { id: 8, name: 'Марко Лисицата', bounty: '$10000', charge: 'Измама', danger: 'medium' },
      ],
      addWanted,
      updateWanted,
      deleteWanted,
    };

    ({ root, container } = await renderIntoBody(ManageMostWanted));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси издирвани лица"]');
    expect(searchInput?.value).toBe('измама');
    expect(container.textContent).toContain('Марко Лисицата');
    expect(container.textContent).not.toContain('Иван Ковача');

    await inputValue(searchInput, 'ковача');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=%D0%BA%D0%BE%D0%B2%D0%B0%D1%87%D0%B0', { replace: true });
  });

  it('filters gallery records and shows the shared empty state on search miss', async () => {
    publicDataState = {
      gallery: [
        { id: 21, title: 'Полицейска акция', description: 'Център', image: '/img/a.jpg', category: 'Криминални', featured: false, date: '2026-04-09' },
        { id: 22, title: 'Нощен клуб', description: 'Парти', image: '/img/b.jpg', category: 'Общество', featured: true, date: '2026-04-08' },
      ],
      addGalleryItem,
      updateGalleryItem,
      deleteGalleryItem,
    };

    ({ root, container } = await renderIntoBody(ManageGallery));
    await flushEffects();

    expect(container.querySelector('button[aria-label="Редактирай снимката"]')).not.toBeNull();

    const searchInput = container.querySelector('input[aria-label="Търси снимки в галерията"]');
    await inputValue(searchInput, 'несъществуващ');

    expect(container.textContent).toContain('Няма снимки');
  });

  it('hydrates gallery search from the URL and syncs updates back', async () => {
    searchParamsState = 'q=%D0%BF%D0%B0%D1%80%D1%82%D0%B8';
    publicDataState = {
      gallery: [
        { id: 21, title: 'Полицейска акция', description: 'Център', image: '/img/a.jpg', category: 'Криминални', featured: false, date: '2026-04-09' },
        { id: 22, title: 'Нощен клуб', description: 'Парти', image: '/img/b.jpg', category: 'Общество', featured: true, date: '2026-04-08' },
      ],
      addGalleryItem,
      updateGalleryItem,
      deleteGalleryItem,
    };

    ({ root, container } = await renderIntoBody(ManageGallery));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси снимки в галерията"]');
    expect(searchInput?.value).toBe('парти');
    expect(container.textContent).toContain('Нощен клуб');
    expect(container.textContent).not.toContain('Полицейска акция');

    await inputValue(searchInput, 'акция');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=%D0%B0%D0%BA%D1%86%D0%B8%D1%8F', { replace: true });
  });

  it('filters categories through the shared search field and keeps row actions accessible', async () => {
    publicDataState = {
      categories: [
        { id: 'crime', name: 'Криминални', icon: '🚨' },
        { id: 'politics', name: 'Политика', icon: '🏛️' },
      ],
      addCategory,
      updateCategory,
      deleteCategory,
    };

    ({ root, container } = await renderIntoBody(ManageCategories));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси категории"]');
    await inputValue(searchInput, 'crime');

    expect(container.textContent).toContain('Криминални');
    expect(container.textContent).not.toContain('Политика');
    expect(container.querySelector('button[aria-label="Редактирай категорията"]')).not.toBeNull();
  });

  it('hydrates categories search from the URL and syncs updates back', async () => {
    searchParamsState = 'q=politics';
    publicDataState = {
      categories: [
        { id: 'crime', name: 'Криминални', icon: '🚨' },
        { id: 'politics', name: 'Политика', icon: '🏛️' },
      ],
      addCategory,
      updateCategory,
      deleteCategory,
    };

    ({ root, container } = await renderIntoBody(ManageCategories));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси категории"]');
    expect(searchInput?.value).toBe('politics');
    expect(container.textContent).toContain('Политика');
    expect(container.textContent).not.toContain('Криминални');

    await inputValue(searchInput, 'crime');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=crime', { replace: true });
  });

  it('filters court cases with the shared search field and shows accessible row actions', async () => {
    publicDataState = {
      court: [
        { id: 1, title: 'Дело срещу Иван', defendant: 'Иван', charge: 'Грабеж', judge: 'Съдия Роси', severity: 'heavy', status: 'scheduled', date: '2026-04-09', nextHearing: '' },
        { id: 2, title: 'Дело срещу Петър', defendant: 'Петър', charge: 'Измама', judge: 'Съдия Николова', severity: 'medium', status: 'completed', date: '2026-04-08', verdict: '6 години' },
      ],
      addCourtCase,
      updateCourtCase,
      deleteCourtCase,
    };

    ({ root, container } = await renderIntoBody(ManageCourt));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси съдебни дела"]');
    await inputValue(searchInput, 'измама');

    expect(container.textContent).toContain('Дело срещу Петър');
    expect(container.textContent).not.toContain('Дело срещу Иван');
    expect(container.querySelector('button[aria-label="Изтрий делото"]')).not.toBeNull();
  });

  it('hydrates court search from the URL and syncs updates back', async () => {
    searchParamsState = 'q=%D0%B8%D0%B7%D0%BC%D0%B0%D0%BC%D0%B0';
    publicDataState = {
      court: [
        { id: 1, title: 'Дело срещу Иван', defendant: 'Иван', charge: 'Грабеж', judge: 'Съдия Роси', severity: 'heavy', status: 'scheduled', date: '2026-04-09', nextHearing: '' },
        { id: 2, title: 'Дело срещу Петър', defendant: 'Петър', charge: 'Измама', judge: 'Съдия Николова', severity: 'medium', status: 'completed', date: '2026-04-08', verdict: '6 години' },
      ],
      addCourtCase,
      updateCourtCase,
      deleteCourtCase,
    };

    ({ root, container } = await renderIntoBody(ManageCourt));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси съдебни дела"]');
    expect(searchInput?.value).toBe('измама');
    expect(container.textContent).toContain('Дело срещу Петър');
    expect(container.textContent).not.toContain('Дело срещу Иван');

    await inputValue(searchInput, 'роси');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=%D1%80%D0%BE%D1%81%D0%B8', { replace: true });
  });

  it('shows the shared empty state in audit log when there are no records', async () => {
    sessionState = { session: { token: 'admin-token' } };
    adminDataState = {
      hasPermission: () => true,
    };
    getAuditLogPage.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    ({ root, container } = await renderIntoBody(ManageAuditLog));
    await flushEffects();

    expect(getAuditLogPage).toHaveBeenCalledWith({ limit: 200 });
    expect(container.textContent).toContain('Няма записи');
  });

  it('hydrates audit log filters from the URL and syncs changes back', async () => {
    searchParamsState = 'resource=articles&action=update&resourceId=7&q=%D1%80%D0%B5%D0%B4';
    sessionState = { session: { token: 'admin-token' } };
    adminDataState = {
      hasPermission: () => true,
    };
    getAuditLogPage.mockResolvedValueOnce({
      items: [
        { action: 'update', user: 'Диего', resource: 'articles', resourceId: 7, details: 'Редакция', timestamp: '2026-04-09T09:00:00.000Z' },
      ],
      nextCursor: null,
    });

    ({ root, container } = await renderIntoBody(ManageAuditLog));
    await flushEffects();

    expect(getAuditLogPage).toHaveBeenCalledWith({ limit: 200, resource: 'articles', action: 'update', resourceId: 7, q: 'ред' });

    const resourceSelect = container.querySelector('select[aria-label="Филтрирай журнала по ресурс"]');
    const actionSelect = container.querySelector('select[aria-label="Филтрирай журнала по действие"]');
    const resourceIdInput = container.querySelector('input[aria-label="Филтрирай журнала по точен ID"]');
    const searchInput = container.querySelector('input[aria-label="Търси в журнала по потребител, ресурс или детайли"]');
    expect(resourceSelect?.value).toBe('articles');
    expect(actionSelect?.value).toBe('update');
    expect(resourceIdInput?.value).toBe('7');
    expect(searchInput?.value).toBe('ред');
    expect(container.textContent).toContain('Редакция');
    expect(container.querySelector('a[href="/admin/articles?q=7"]')).not.toBeNull();

    resourceSelect.value = 'all';
    resourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushEffects();
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('action=update&resourceId=7&q=%D1%80%D0%B5%D0%B4', { replace: true });
  });

  it('links intake queue items to filtered audit log views', async () => {
    sessionState = { session: { token: 'admin-token', name: 'Ани Петрова' } };
    adminDataState = {
      tips: [
        {
          id: 11,
          text: 'Катастрофа пред болницата',
          location: 'Лос Сантос',
          status: 'processed',
          priority: 'normal',
          assignedEditor: 'Ани Петрова',
          tags: [],
          lastActionAt: '2026-04-09T10:30:00.000Z',
          lastActionBy: 'Ани Петрова',
          createdAt: '2026-04-09T08:00:00.000Z',
        },
      ],
      tipsReady: true,
      ensureTipsLoaded,
      refreshTips,
      updateTip,
      deleteTip,
      hasPermission: (permission) => Array.isArray(permission)
        ? permission.some((entry) => entry === 'articles')
        : permission === 'articles',
    };

    ({ root, container } = await renderIntoBody(ManageIntakeQueue));
    await flushEffects();

    const auditLink = Array.from(container.querySelectorAll('a'))
      .find((anchor) => anchor.getAttribute('href') === '/admin/audit-log?resource=tips&resourceId=11&q=%D0%9B%D0%BE%D1%81+%D0%A1%D0%B0%D0%BD%D1%82%D0%BE%D1%81');

    expect(auditLink).not.toBeNull();
  });

  it('hydrates profiles tab and search query from the URL', async () => {
    searchParamsState = 'tab=authors&q=%D0%B4%D0%B8%D0%B5';
    sessionState = { session: { role: 'admin' } };
    adminDataState = {
      users: [
        { id: 1, name: 'Служебен', username: 'admin', role: 'admin', profession: 'Admin', avatar: '👑' },
      ],
      ensureUsersLoaded: vi.fn(async () => []),
      addUser: vi.fn(async () => ({})),
      updateUser: vi.fn(async () => ({})),
      deleteUser: vi.fn(async () => ({})),
      permissions: [],
      createRole: vi.fn(async () => ({})),
    };
    publicDataState = {
      authors: [
        { id: 1, name: 'Диего Ламас', role: 'Репортер', avatar: '📸', avatarImage: '', bio: '' },
        { id: 2, name: 'Мария Стоянова', role: 'Редактор', avatar: '✍️', avatarImage: '', bio: '' },
      ],
      articles: [],
      addAuthor: vi.fn(async () => ({})),
      updateAuthor: vi.fn(async () => ({})),
      deleteAuthor: vi.fn(async () => ({})),
    };

    ({ root, container } = await renderIntoBody(ManageProfiles));
    await flushEffects();

    const searchInput = container.querySelector('input[placeholder="Търси по име или позиция..."]');
    expect(searchInput?.value).toBe('дие');
    expect(container.textContent).toContain('Автори (репортери)');
    expect(container.textContent).toContain('Диего Ламас');
    expect(container.textContent).not.toContain('Мария Стоянова');
  });

  it('filters games with the shared search field and keeps refresh action accessible', async () => {
    getAllGames.mockResolvedValueOnce([
      { id: 1, slug: 'word', title: 'Слово', description: 'Дневна дума', active: true },
      { id: 2, slug: 'snake', title: 'Змия', description: 'Аркадна игра', active: false },
    ]);

    ({ root, container } = await renderIntoBody(ManageGames));
    await flushEffects();

    expect(container.querySelector('button[aria-label="Презареди игрите"]')).not.toBeNull();

    const searchInput = container.querySelector('input[aria-label="Търси игра по име, slug или описание"]');
    await inputValue(searchInput, 'snake');

    expect(container.textContent).toContain('Змия');
    expect(container.textContent).not.toContain('Слово');
  });

  it('hydrates games search from the URL and syncs updates back', async () => {
    searchParamsState = 'q=snake';
    getAllGames.mockResolvedValueOnce([
      { id: 1, slug: 'word', title: 'Слово', description: 'Дневна дума', active: true },
      { id: 2, slug: 'snake', title: 'Змия', description: 'Аркадна игра', active: false },
    ]);

    ({ root, container } = await renderIntoBody(ManageGames));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси игра по име, slug или описание"]');
    expect(searchInput?.value).toBe('snake');
    expect(container.textContent).toContain('Змия');
    expect(container.textContent).not.toContain('Слово');

    await inputValue(searchInput, 'word');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=word', { replace: true });
  });

  it('filters permissions by role and keeps permission toggles accessible', async () => {
    sessionState = { session: { role: 'admin' } };
    adminDataState = {
      permissions: [
        { role: 'admin', permissions: {} },
        { role: 'editor', permissions: { articles: true, classifieds: false } },
        { role: 'reporter', permissions: { articles: true, classifieds: true } },
      ],
      updatePermission,
      createRole,
      hasPermission: (permission) => permission === 'permissions',
    };

    ({ root, container } = await renderIntoBody(ManagePermissions));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси роля по ключ или етикет"]');
    await inputValue(searchInput, 'report');
    const permissionsTable = container.querySelector('table');

    expect(permissionsTable?.textContent).toContain('Репортер');
    expect(permissionsTable?.textContent).not.toContain('Редактор');
    expect(container.querySelector('button[aria-label="Разреши достъп до Категории за Репортер"], button[aria-label="Отнеми достъп до Категории за Репортер"]')).not.toBeNull();
  });

  it('hydrates permissions search from the URL', async () => {
    searchParamsState = 'q=photo';
    sessionState = { session: { role: 'admin' } };
    adminDataState = {
      permissions: [
        { role: 'photographer', permissions: { gallery: true } },
        { role: 'editor', permissions: { articles: true } },
      ],
      updatePermission,
      createRole,
      hasPermission: (permission) => permission === 'permissions',
    };

    ({ root, container } = await renderIntoBody(ManagePermissions));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси роля по ключ или етикет"]');
    const permissionsTable = container.querySelector('table');
    expect(searchInput?.value).toBe('photo');
    expect(permissionsTable?.textContent).toContain('Фотограф');
    expect(permissionsTable?.textContent).not.toContain('Редактор');
  });

  it('shows the shared empty state in breaking manager', async () => {
    publicDataState = {
      breaking: [],
      saveBreaking,
    };

    ({ root, container } = await renderIntoBody(ManageBreaking));
    await flushEffects();

    expect(container.textContent).toContain('Няма извънредни новини');
  });

  it('keeps breaking row actions accessible', async () => {
    publicDataState = {
      breaking: ['Срив в центъра'],
      saveBreaking,
    };

    ({ root, container } = await renderIntoBody(ManageBreaking));
    await flushEffects();

    expect(container.querySelector('button[aria-label="Премести новината нагоре"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Премахни новината"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="Редактирай новина 1"]')).not.toBeNull();
  });
});
