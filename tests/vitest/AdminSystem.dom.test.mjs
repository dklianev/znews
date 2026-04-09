import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, inputValue, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const refreshTips = vi.fn(async () => []);
const ensureTipsLoaded = vi.fn(async () => []);
const updateTip = vi.fn(async () => ({}));
const deleteTip = vi.fn(async () => ({}));
const getAllContactMessages = vi.fn(async () => []);
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
};

let adminDataState = {};
let publicDataState = {};
let sessionState = {};
let searchParamsState = '';

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

  afterEach(async () => {
    refreshTips.mockReset();
    ensureTipsLoaded.mockReset();
    updateTip.mockReset();
    deleteTip.mockReset();
    getAllContactMessages.mockReset();
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
    adminDataState = {};
    publicDataState = {};
    sessionState = {};
    searchParamsState = '';
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

    expect(container.textContent).toContain('Няма записи');
  });

  it('hydrates audit log resource filtering from the URL and syncs changes back', async () => {
    searchParamsState = 'resource=articles';
    sessionState = { session: { token: 'admin-token' } };
    adminDataState = {
      hasPermission: () => true,
    };
    getAuditLogPage.mockResolvedValueOnce({
      items: [
        { action: 'update', user: 'Диего', resource: 'articles', resourceId: 7, details: 'Редакция', timestamp: '2026-04-09T09:00:00.000Z' },
        { action: 'delete', user: 'Мария', resource: 'comments', resourceId: 2, details: 'Изтриване', timestamp: '2026-04-09T10:00:00.000Z' },
      ],
      nextCursor: null,
    });

    ({ root, container } = await renderIntoBody(ManageAuditLog));
    await flushEffects();

    const resourceSelect = container.querySelector('select');
    expect(resourceSelect?.value).toBe('articles');
    expect(container.textContent).toContain('Редакция');
    expect(container.textContent).not.toContain('Изтриване');

    resourceSelect.value = 'all';
    resourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushEffects();
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('', { replace: true });
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

    expect(container.textContent).toContain('Репортер');
    expect(container.textContent).not.toContain('Редактор');
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
    expect(searchInput?.value).toBe('photo');
    expect(container.textContent).toContain('Фотограф');
    expect(container.textContent).not.toContain('Редактор');
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
