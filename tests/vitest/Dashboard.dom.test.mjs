import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushEffects, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

let adminDataState = {};
let publicDataState = {};
let sessionDataState = {};

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
  usePublicData: () => publicDataState,
  useSessionData: () => sessionDataState,
}));

vi.mock('../../src/utils/api', () => ({
  api: {
    backup: {
      download: vi.fn(async () => new Blob(['ok'], { type: 'application/json' })),
    },
    contactMessages: {
      getAll: vi.fn(async () => []),
    },
  },
}));

vi.mock('../../src/components/admin/DashboardAnalytics', () => ({
  default: () => createElement('div', { 'data-testid': 'dashboard-analytics' }, 'analytics'),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => createElement('a', { href: to, ...props }, children),
}));

const confirmValue = vi.fn(async () => true);
vi.mock('../../src/components/admin/ConfirmDialog', () => ({
  ConfirmProvider: ({ children }) => children,
  useConfirm: () => confirmValue,
}));

const { default: Dashboard } = await import('../../src/pages/admin/Dashboard.jsx');

describe('Dashboard', () => {
  let root;
  let container;

  afterEach(async () => {
    adminDataState = {};
    publicDataState = {};
    sessionDataState = {};
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('swallows auth rejections from the initial classifieds load without leaking an unhandled rejection', async () => {
    const unhandledRejection = vi.fn();
    const authError = new Error('Authentication required');
    authError.status = 401;
    window.addEventListener('unhandledrejection', unhandledRejection);

    adminDataState = {
      users: [],
      usersReady: true,
      ensureUsersLoaded: vi.fn(async () => []),
      resetAll: vi.fn(async () => {}),
      hasPermission: (permission) => permission === 'classifieds',
      classifieds: [],
      ensureClassifiedsLoaded: vi.fn().mockRejectedValueOnce(authError),
      tips: [],
      tipsReady: true,
      ensureTipsLoaded: vi.fn(async () => []),
    };

    publicDataState = {
      articles: [],
      authors: [],
      wanted: [],
      jobs: [],
      court: [],
      events: [],
      polls: [],
      comments: [],
      gallery: [],
      categories: [],
    };

    sessionDataState = {
      session: { role: 'admin', name: 'Админ' },
    };

    try {
      ({ root, container } = await renderIntoBody(Dashboard));
      await flushEffects();

      expect(adminDataState.ensureClassifiedsLoaded).toHaveBeenCalledTimes(1);
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Табло');
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
    }
  });
});
