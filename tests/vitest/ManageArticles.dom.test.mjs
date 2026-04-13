import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inputValue } from './helpers/domHarness.mjs';

const refresh = vi.fn(() => Promise.resolve());
const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};
const confirm = vi.fn(() => Promise.resolve(true));
const loadArticleRevisions = vi.fn();
const getById = vi.fn();
const setSearchParamsSpy = vi.fn();
const addArticle = vi.fn();
const updateArticle = vi.fn();
const deleteArticle = vi.fn();
const updateContactMessage = vi.fn();

let listMode = 'initial';
let searchParamsState = '';

const publishedArticle = {
  id: 1,
  title: 'Published Alpha',
  category: 'crime',
  authorId: 1,
  date: '2026-04-02',
  readTime: 3,
  status: 'published',
  views: 1245,
};

const restoredDraft = {
  id: 77,
  title: 'Restored Gamma',
  category: 'crime',
  authorId: 1,
  date: '2026-04-02',
  readTime: 2,
  status: 'draft',
  views: 0,
};

const detailFallbackArticle = {
  id: 88,
  title: 'Detail Beta',
  category: 'crime',
  authorId: 1,
  date: '2026-04-02',
  readTime: 5,
  status: 'draft',
  views: 19,
};

const baseListItems = [publishedArticle, detailFallbackArticle];

const listAdmin = vi.fn(async () => (listMode === 'restored'
  ? { items: [...baseListItems, restoredDraft], total: 3, totalPages: 1, page: 1 }
  : { items: baseListItems, total: 2, totalPages: 1, page: 1 }));

const getAdminMeta = vi.fn(async () => ({
  total: listMode === 'restored' ? 3 : 2,
  byCategory: { crime: listMode === 'restored' ? 3 : 2 },
  popularTags: [],
}));

const listArchived = vi.fn(async () => [restoredDraft]);
const restore = vi.fn(async (id) => {
  listMode = 'restored';
  return { id };
});

vi.mock('../../src/context/DataContext', () => ({
  usePublicData: () => ({
    authors: [{ id: 1, name: 'Автор', role: 'Редактор' }],
    categories: [{ id: 'crime', name: 'Криминални' }],
    addArticle,
    updateArticle,
    deleteArticle,
    refresh,
  }),
  useAdminData: () => ({
    articleRevisions: {},
    loadArticleRevisions,
    autosaveArticleRevision: vi.fn(),
    restoreArticleRevision: vi.fn(),
  }),
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    articles: {
      getAdminMeta,
      listAdmin,
      listArchived,
      restore,
      permanentDelete: vi.fn(),
      searchRelatedAdmin: vi.fn(() => Promise.resolve({ items: [] })),
      getById,
      getRevision: vi.fn(),
    },
    contactMessages: {
      update: updateContactMessage,
    },
  },
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
}));

vi.mock('../../src/components/admin/ConfirmDialog', () => ({
  useConfirm: () => confirm,
}));

vi.mock('../../src/components/admin/RichTextEditor', () => ({
  default: () => createElement('div', { 'data-testid': 'rich-text-editor' }, 'editor'),
}));

vi.mock('../../src/components/admin/AdminImageField', () => ({
  default: ({ label }) => createElement('div', { 'data-testid': 'admin-image-field' }, label),
}));

vi.mock('../../src/components/admin/LivePreviewModal', () => ({
  default: () => null,
}));

vi.mock('react-router-dom', () => ({
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

vi.mock('lucide-react', () => {
  function Icon(props) {
    return createElement('svg', { ...props, 'data-testid': 'icon' });
  }

  return {
    Plus: Icon,
    Pencil: Icon,
    Trash2: Icon,
    X: Icon,
    Save: Icon,
    Eye: Icon,
    Star: Icon,
    RefreshCw: Icon,
    History: Icon,
    RotateCcw: Icon,
    Clock3: Icon,
    Loader2: Icon,
    Search: Icon,
    Copy: Icon,
    ToggleLeft: Icon,
    ToggleRight: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    CheckSquare: Icon,
    Square: Icon,
    ArrowUp: Icon,
    Archive: Icon,
    ArchiveRestore: Icon,
  };
});

const { default: ManageArticles } = await import('../../src/pages/admin/ManageArticles.jsx');

function findButton(container, label) {
  return Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes(label)) || null;
}

function findArticleRow(container, title) {
  const heading = Array.from(container.querySelectorAll('h3')).find((node) => node.textContent?.includes(title));
  return heading?.closest('div.bg-white') || null;
}

function findEditButtonForArticle(container, title) {
  const row = findArticleRow(container, title);
  if (!row) return null;
  const buttons = Array.from(row.querySelectorAll('button'));
  return buttons[3] || null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe('ManageArticles', () => {
  let main;
  let container;
  let root;
  let originalLocalStorage;

  function installLocalStorageStub() {
    const store = new Map();
    const stub = {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
    };

    originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: stub,
    });
  }

  afterEach(() => {
    listMode = 'initial';
    refresh.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
    toast.warning.mockClear();
    confirm.mockClear();
    listAdmin.mockClear();
    getAdminMeta.mockClear();
    listArchived.mockClear();
    restore.mockClear();
    loadArticleRevisions.mockClear();
    getById.mockReset();
    addArticle.mockReset();
    updateArticle.mockReset();
    deleteArticle.mockReset();
    updateContactMessage.mockReset();
    setSearchParamsSpy.mockReset();
    searchParamsState = '';

    if (root) {
      act(() => {
        root.unmount();
      });
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container);
    }
    if (main?.parentNode) {
      main.parentNode.removeChild(main);
    }
    if (originalLocalStorage !== undefined) {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
    root = null;
    container = null;
    main = null;
    originalLocalStorage = undefined;
  });

  it('restores an archived article and returns to the main list without a full reload', async () => {
    main = document.createElement('main');
    container = document.createElement('div');
    main.appendChild(container);
    document.body.appendChild(main);
    root = createRoot(container);
    installLocalStorageStub();

    act(() => {
      root.render(createElement(ManageArticles));
    });
    await flush();

    expect(container.textContent).toContain('Published Alpha');
    expect(container.textContent).toContain('Detail Beta');
    expect(container.textContent).not.toContain('Restored Gamma');

    act(() => {
      findButton(container, 'Архив')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(listArchived).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Архивирани статии (1)');
    expect(container.textContent).toContain('Restored Gamma');

    act(() => {
      findButton(container, 'Възстанови')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();
    await flush();

    expect(restore).toHaveBeenCalledWith(77);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalled();
    expect(container.textContent).toContain('Restored Gamma');
    expect(container.textContent).not.toContain('Архивирани статии (0)');
    expect(listAdmin.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(searchParamsState).toBe('');
  });

  it('hydrates filters and pagination from the URL and keeps them in sync', async () => {
    searchParamsState = 'q=beta&category=crime&page=2';
    main = document.createElement('main');
    container = document.createElement('div');
    main.appendChild(container);
    document.body.appendChild(main);
    root = createRoot(container);
    installLocalStorageStub();

    act(() => {
      root.render(createElement(ManageArticles));
    });
    await flush();

    const searchInput = container.querySelector('input[placeholder="Търси по заглавие..."]');
    expect(searchInput?.value).toBe('beta');
    expect(listAdmin).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      category: 'crime',
      q: 'beta',
    }));

    await inputValue(searchInput, 'alpha');
    await flush();

    expect(searchParamsState).toBe('q=alpha&category=crime');
  });

  it('keeps the editor closed when loading the full article for edit fails', async () => {
    main = document.createElement('main');
    container = document.createElement('div');
    main.appendChild(container);
    document.body.appendChild(main);
    root = createRoot(container);
    installLocalStorageStub();
    getById.mockRejectedValueOnce(new Error('detail failed'));

    act(() => {
      root.render(createElement(ManageArticles));
    });
    await flush();

    const editButton = findEditButtonForArticle(container, 'Detail Beta');
    expect(editButton).not.toBeNull();
    expect(container.querySelector('button[aria-label="Дублирай статията"]')).not.toBeNull();
    expect(container.querySelector('a[aria-label="Виж статията"]')).not.toBeNull();

    act(() => {
      editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(getById).toHaveBeenCalledWith(88);
    expect(loadArticleRevisions).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Не успяхме да заредим пълната статия за редакция. Опитайте отново.');
    expect(container.textContent).not.toContain('Редактирай статия');
    expect(container.textContent).not.toContain('editor');
  });

  it('shows the article view count in the admin list row', async () => {
    main = document.createElement('main');
    container = document.createElement('div');
    main.appendChild(container);
    document.body.appendChild(main);
    root = createRoot(container);
    installLocalStorageStub();

    act(() => {
      root.render(createElement(ManageArticles));
    });
    await flush();

    const row = findArticleRow(container, 'Published Alpha');
    expect(row?.textContent).toContain('1245 прегл.');
  });

  it('hydrates a new article draft from the intake prefill payload', async () => {
    main = document.createElement('main');
    container = document.createElement('div');
    main.appendChild(container);
    document.body.appendChild(main);
    root = createRoot(container);
    installLocalStorageStub();
    window.localStorage.setItem('znews_intake_article_prefill_v1', JSON.stringify({
      title: 'Право на отговор: Скандал в центъра',
      excerpt: 'Постъпило право на отговор.',
      content: '<p>Това е текстът на отговора.</p>',
      category: 'crime',
      tags: ['право на отговор'],
      relatedArticles: [88],
      status: 'draft',
      cardSticker: 'ПРАВО НА ОТГОВОР',
    }));

    act(() => {
      root.render(createElement(ManageArticles));
    });
    await flush();

    expect(container.textContent).toContain('Нова статия');
    const titleInput = container.querySelector('#article-title');
    expect(titleInput?.value).toBe('Право на отговор: Скандал в центъра');
    expect(window.localStorage.getItem('znews_intake_article_prefill_v1')).toBeNull();
  });

  it('syncs the linked right-of-reply request after saving a prefilled article draft', async () => {
    main = document.createElement('main');
    container = document.createElement('div');
    main.appendChild(container);
    document.body.appendChild(main);
    root = createRoot(container);
    installLocalStorageStub();
    window.localStorage.setItem('znews_intake_article_prefill_v1', JSON.stringify({
      title: 'Право на отговор: Скандал в центъра',
      excerpt: 'Постъпило право на отговор.',
      content: '<p>Това е текстът на отговора.</p>',
      category: 'crime',
      tags: ['право на отговор'],
      relatedArticles: [88],
      status: 'draft',
      cardSticker: 'ПРАВО НА ОТГОВОР',
      intakeMeta: {
        source: 'contact',
        requestId: 41,
        requestKind: 'right_of_reply',
        relatedArticleId: 88,
        relatedArticleTitle: 'Скандал в центъра',
      },
    }));
    addArticle.mockResolvedValueOnce({ id: 212, title: 'Право на отговор: Скандал в центъра' });
    updateContactMessage.mockResolvedValueOnce({
      id: 41,
      status: 'read',
      requestKind: 'right_of_reply',
      relatedArticleId: 88,
      relatedArticleTitle: 'Скандал в центъра',
      responseArticleId: 212,
      responseArticleStatus: 'draft',
    });

    act(() => {
      root.render(createElement(ManageArticles));
    });
    await flush();

    const saveButton = findButton(container, 'Запази');
    act(() => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(addArticle).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Право на отговор: Скандал в центъра',
      status: 'draft',
      relatedArticles: [88],
    }));
    expect(updateContactMessage).toHaveBeenCalledWith(41, {
      status: 'read',
      responseArticleId: 212,
      responseArticleStatus: 'draft',
      relatedArticleId: 88,
      relatedArticleTitle: 'Скандал в центъра',
    });
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('allows manual article view inflation from the settings tab', async () => {
    main = document.createElement('main');
    container = document.createElement('div');
    main.appendChild(container);
    document.body.appendChild(main);
    root = createRoot(container);
    installLocalStorageStub();
    window.localStorage.setItem('znews_intake_article_prefill_v1', JSON.stringify({
      title: 'Надуване на трафика',
      excerpt: 'Тест за ръчните гледания.',
      content: '<p>Кратко съдържание за чернова.</p>',
      category: 'crime',
      status: 'draft',
      views: 5,
    }));
    addArticle.mockResolvedValueOnce({ id: 501, title: 'Надуване на трафика' });

    act(() => {
      root.render(createElement(ManageArticles));
    });
    await flush();

    act(() => {
      findButton(container, 'Настройки')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    const viewsInput = container.querySelector('input[type="number"][min="0"]');
    expect(viewsInput?.value).toBe('5');

    act(() => {
      findButton(container, '+20')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.querySelector('input[type="number"][min="0"]')?.value).toBe('25');

    act(() => {
      findButton(container, 'Запази')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(addArticle).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Надуване на трафика',
      views: 25,
      status: 'draft',
    }));
  });
});
