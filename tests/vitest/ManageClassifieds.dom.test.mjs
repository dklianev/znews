import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const refreshClassifieds = vi.fn(async () => []);
const ensureClassifiedsLoaded = vi.fn(async () => []);
const approveClassified = vi.fn(async () => ({}));
const rejectClassified = vi.fn(async () => ({}));
const deleteClassified = vi.fn(async () => ({}));
const bumpClassified = vi.fn(async () => ({}));
const renewClassified = vi.fn(async () => ({}));

const toast = {
  success: vi.fn(),
  error: vi.fn(),
};

let adminDataState = {};

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
}));

const { default: ManageClassifieds } = await import('../../src/pages/admin/ManageClassifieds.jsx');

describe('ManageClassifieds', () => {
  let root;
  let container;

  afterEach(async () => {
    refreshClassifieds.mockReset();
    ensureClassifiedsLoaded.mockReset();
    approveClassified.mockReset();
    rejectClassified.mockReset();
    deleteClassified.mockReset();
    bumpClassified.mockReset();
    renewClassified.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    adminDataState = {};
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('catches auth rejections from the initial classifieds load without leaking an unhandled rejection', async () => {
    const unhandledRejection = vi.fn();
    const authError = new Error('Authentication required');
    authError.status = 401;
    ensureClassifiedsLoaded.mockRejectedValueOnce(authError);

    adminDataState = {
      classifieds: [],
      classifiedsReady: false,
      refreshClassifieds,
      ensureClassifiedsLoaded,
      approveClassified,
      rejectClassified,
      deleteClassified,
      bumpClassified,
      renewClassified,
    };

    window.addEventListener('unhandledrejection', unhandledRejection);
    try {
      ({ root, container } = await renderIntoBody(ManageClassifieds));
      await flushEffects();

      expect(ensureClassifiedsLoaded).toHaveBeenCalledTimes(1);
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
    }
  });

  it('shows a toast when a manual refresh fails for a non-auth reason', async () => {
    refreshClassifieds.mockRejectedValueOnce(new Error('Network failed'));
    adminDataState = {
      classifieds: [],
      classifiedsReady: true,
      refreshClassifieds,
      ensureClassifiedsLoaded,
      approveClassified,
      rejectClassified,
      deleteClassified,
      bumpClassified,
      renewClassified,
    };

    ({ root, container } = await renderIntoBody(ManageClassifieds));
    await flushEffects();

    const refreshButton = container.querySelector('button[aria-label]');
    await click(refreshButton);

    expect(refreshClassifieds).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Network failed'));
  });

  it('renders the stored classifieds currency instead of a hardcoded dollar symbol', async () => {
    adminDataState = {
      classifieds: [
        {
          id: 17,
          status: 'awaiting_payment',
          category: 'selling',
          tier: 'vip',
          title: 'Продавам Sultan RS',
          description: 'Лека козметика.',
          contactName: 'Диего',
          phone: '9652438',
          createdAt: '2026-04-08T12:00:00.000Z',
          paymentRef: 'ZN-DF4D1B295FF89904',
          amountDue: 2000,
          currency: 'лв.',
          images: [],
        },
      ],
      classifiedsReady: true,
      refreshClassifieds,
      ensureClassifiedsLoaded,
      approveClassified,
      rejectClassified,
      deleteClassified,
      bumpClassified,
      renewClassified,
    };

    ({ root, container } = await renderIntoBody(ManageClassifieds));
    await flushEffects();

    expect(container.textContent).toContain('лв.2000');
    expect(container.textContent).not.toContain('$2000');
  });
});
