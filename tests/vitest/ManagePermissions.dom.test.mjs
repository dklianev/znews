import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const updatePermission = vi.fn(async () => ({}));
const createRole = vi.fn(async () => ({}));

const toast = {
  success: vi.fn(),
  error: vi.fn(),
};

let adminDataState = {};
let sessionDataState = {};

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
  useSessionData: () => sessionDataState,
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
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
    adminDataState = {};
    sessionDataState = {};
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
});
