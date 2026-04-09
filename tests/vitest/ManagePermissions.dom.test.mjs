import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const updatePermission = vi.fn(async () => ({}));
const createRole = vi.fn(async () => ({}));
const confirmMock = vi.fn(async () => true);

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

let adminDataState = {};
let sessionDataState = {};
let searchParamsState = '';
const setSearchParamsSpy = vi.fn();

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
  useSessionData: () => sessionDataState,
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
}));

vi.mock('../../src/components/admin/ConfirmDialog', () => ({
  useConfirm: () => confirmMock,
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

const { default: ManagePermissions } = await import('../../src/pages/admin/ManagePermissions.jsx');

describe('ManagePermissions', () => {
  let root;
  let container;

  afterEach(async () => {
    updatePermission.mockReset();
    createRole.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
    confirmMock.mockReset();
    confirmMock.mockResolvedValue(true);
    setSearchParamsSpy.mockReset();
    adminDataState = {};
    sessionDataState = {};
    searchParamsState = '';
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('shows classifieds in the permissions matrix and can save that permission', async () => {
    adminDataState = {
      permissions: [
        {
          role: 'editor',
          permissions: {
            articles: true,
            categories: false,
            ads: false,
            breaking: false,
            wanted: false,
            jobs: false,
            classifieds: false,
            court: false,
            events: false,
            polls: false,
            comments: false,
            contact: false,
            gallery: false,
            profiles: false,
            permissions: false,
            games: false,
          },
        },
      ],
      updatePermission,
      createRole,
      hasPermission: () => true,
    };
    sessionDataState = {
      session: { token: 'token', role: 'admin' },
    };

    ({ root, container } = await renderIntoBody(ManagePermissions));

    expect(container.textContent).toContain('Малки обяви');

    const row = Array.from(container.querySelectorAll('tr')).find((node) => node.textContent?.includes('Редактор'));
    const toggleButtons = Array.from(row?.querySelectorAll('button') || []);
    const classifiedsToggle = toggleButtons[6];
    await click(classifiedsToggle);

    const saveButton = toggleButtons.find((button) => button.textContent?.includes('Запази'));
    await click(saveButton);

    expect(updatePermission).toHaveBeenCalledWith('editor', expect.objectContaining({ classifieds: true }));
    expect(toast.success).toHaveBeenCalled();
  });

  it('applies a permission preset to the selected role before saving', async () => {
    adminDataState = {
      permissions: [
        {
          role: 'editor',
          permissions: {
            articles: false,
            categories: false,
            ads: false,
            breaking: false,
            wanted: false,
            jobs: false,
            classifieds: false,
            court: false,
            events: false,
            polls: false,
            comments: false,
            contact: false,
            gallery: false,
            profiles: false,
            permissions: false,
            games: false,
          },
        },
      ],
      updatePermission,
      createRole,
      hasPermission: () => true,
    };
    sessionDataState = {
      session: { token: 'token', role: 'admin' },
    };

    ({ root, container } = await renderIntoBody(ManagePermissions));

    const presetButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Редактор'));
    await click(presetButton);

    const applyButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Приложи шаблона'));
    await click(applyButton);

    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Прилагане на шаблон',
      confirmLabel: 'Приложи',
    }));

    const row = Array.from(container.querySelectorAll('tr')).find((node) => node.textContent?.includes('Редактор'));
    const saveButton = Array.from(row?.querySelectorAll('button') || [])
      .find((button) => button.textContent?.includes('Запази'));
    await click(saveButton);

    expect(updatePermission).toHaveBeenCalledWith('editor', expect.objectContaining({
      articles: true,
      categories: true,
      breaking: true,
      comments: true,
      contact: true,
      gallery: true,
      profiles: true,
      ads: false,
      classifieds: false,
      games: false,
    }));
  });

  it('shows an info toast when the selected role already matches the preset', async () => {
    adminDataState = {
      permissions: [
        {
          role: 'editor',
          permissions: {
            articles: true,
            categories: true,
            ads: false,
            breaking: true,
            wanted: false,
            jobs: false,
            classifieds: false,
            court: false,
            events: false,
            polls: false,
            comments: true,
            contact: true,
            gallery: true,
            profiles: true,
            permissions: false,
            games: false,
          },
        },
      ],
      updatePermission,
      createRole,
      hasPermission: () => true,
    };
    sessionDataState = {
      session: { token: 'token', role: 'admin' },
    };

    ({ root, container } = await renderIntoBody(ManagePermissions));

    const presetButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Редактор'));
    await click(presetButton);

    const applyButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Приложи шаблона'));
    await click(applyButton);

    expect(confirmMock).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
    expect(updatePermission).not.toHaveBeenCalled();
  });
});
