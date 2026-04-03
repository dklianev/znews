import React, { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn(() => Promise.resolve());
const toast = {
  success: vi.fn(),
  error: vi.fn(),
};
const confirm = vi.fn(() => Promise.resolve(true));
const loadArticleRevisions = vi.fn();
const getById = vi.fn();

let listMode = 'initial';

const publishedArticle = {
  id: 1,
  title: 'Published Alpha',
  category: 'crime',
  authorId: 1,
  date: '2026-04-02',
  readTime: 3,
  status: 'published',
};

const restoredDraft = {
  id: 77,
  title: 'Restored Gamma',
  category: 'crime',
  authorId: 1,
  date: '2026-04-02',
  readTime: 2,
  status: 'draft',
};

const detailFallbackArticle = {
  id: 88,
  title: 'Detail Beta',
  category: 'crime',
  authorId: 1,
  date: '2026-04-02',
  readTime: 5,
  status: 'draft',
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
    addArticle: vi.fn(),
    updateArticle: vi.fn(),
    deleteArticle: vi.fn(),
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
    confirm.mockClear();
    listAdmin.mockClear();
    getAdminMeta.mockClear();
    listArchived.mockClear();
    restore.mockClear();
    loadArticleRevisions.mockClear();
    getById.mockReset();

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
});
