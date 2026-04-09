import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, inputValue, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const navigate = vi.fn();
const toggleDark = vi.fn();
const reportClientError = vi.fn(async () => ({}));

let sessionDataState = {};
let adminDataState = {};
let locationState = { pathname: '/admin' };

vi.mock('../../src/context/DataContext', () => ({
  useSessionData: () => sessionDataState,
  useAdminData: () => adminDataState,
}));

vi.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    toggleDark,
  }),
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    monitoring: {
      reportClientError: (...args) => reportClientError(...args),
    },
  },
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }) => React.createElement('div', { 'data-navigate': to }),
  Outlet: () => React.createElement('div', { 'data-outlet': 'true' }, 'Outlet'),
  Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children),
  useLocation: () => locationState,
  useNavigate: () => navigate,
}));

const { default: AdminLayout } = await import('../../src/pages/admin/AdminLayout.jsx');

describe('AdminLayout', () => {
  let root;
  let container;

  afterEach(async () => {
    navigate.mockReset();
    toggleDark.mockReset();
    reportClientError.mockReset();
    sessionDataState = {};
    adminDataState = {};
    locationState = { pathname: '/admin' };
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('opens the command palette with Ctrl+K and navigates to entity shortcuts', async () => {
    sessionDataState = {
      session: { token: 'admin-token', name: 'Ани Петрова', role: 'admin' },
      logout: vi.fn(),
    };
    adminDataState = {
      hasPermission: () => true,
    };

    ({ root, container } = await renderIntoBody(AdminLayout));
    await flushEffects();

    window.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      ctrlKey: true,
      code: 'KeyK',
    }));
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Търси в админ панела"]');
    expect(searchInput).not.toBeNull();

    await inputValue(searchInput, '42');
    expect(container.textContent).toContain('Статия #42');

    const articleShortcut = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Статия #42'));
    await click(articleShortcut);

    expect(navigate).toHaveBeenCalledWith('/admin/articles?q=42');
  });
});
