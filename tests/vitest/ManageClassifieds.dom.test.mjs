import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, inputValue, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const refreshClassifieds = vi.fn(async () => ({ items: [], meta: null }));
const ensureClassifiedsLoaded = vi.fn(async () => ({ items: [], meta: null }));
const approveClassified = vi.fn(async () => ({}));
const rejectClassified = vi.fn(async () => ({}));
const deleteClassified = vi.fn(async () => ({}));
const bumpClassified = vi.fn(async () => ({}));
const renewClassified = vi.fn(async () => ({}));
const setSearchParamsSpy = vi.fn();

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

const DEFAULT_CLASSIFIEDS_META = Object.freeze({
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,
  statusCounts: { all: 0, awaiting_payment: 0, active: 0, rejected: 0, expired: 0 },
});

let adminDataState = {};
let searchParamsState = '';

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
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

const { default: ManageClassifieds } = await import('../../src/pages/admin/ManageClassifieds.jsx');

function buildAdminClassifiedsState(overrides = {}) {
  return {
    classifieds: [],
    classifiedsMeta: DEFAULT_CLASSIFIEDS_META,
    classifiedsReady: true,
    refreshClassifieds,
    ensureClassifiedsLoaded,
    approveClassified,
    rejectClassified,
    deleteClassified,
    bumpClassified,
    renewClassified,
    ...overrides,
  };
}

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
    setSearchParamsSpy.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.warning.mockReset();
    toast.info.mockReset();
    adminDataState = {};
    searchParamsState = '';
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('catches auth rejections from the initial classifieds load without leaking an unhandled rejection', async () => {
    const unhandledRejection = vi.fn();
    const authError = new Error('Authentication required');
    authError.status = 401;
    ensureClassifiedsLoaded.mockRejectedValueOnce(authError);

    adminDataState = buildAdminClassifiedsState({
      classifiedsReady: false,
    });

    window.addEventListener('unhandledrejection', unhandledRejection);
    try {
      ({ root, container } = await renderIntoBody(ManageClassifieds));
      await flushEffects();

      expect(ensureClassifiedsLoaded).toHaveBeenCalledTimes(1);
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Малки обяви');
    } finally {
      window.removeEventListener('unhandledrejection', unhandledRejection);
    }
  });

  it('shows a toast when a manual refresh fails for a non-auth reason', async () => {
    refreshClassifieds.mockRejectedValueOnce(new Error('Network failed'));
    adminDataState = buildAdminClassifiedsState();

    ({ root, container } = await renderIntoBody(ManageClassifieds));
    await flushEffects();

    const refreshButton = container.querySelector('button[aria-label="Обнови обявите"]');
    await click(refreshButton);

    expect(refreshClassifieds).toHaveBeenCalledTimes(1);
    expect(refreshClassifieds).toHaveBeenCalledWith({ page: 1, limit: 25 });
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Network failed'));
  });

  it('renders the stored classifieds currency instead of a hardcoded dollar symbol', async () => {
    adminDataState = buildAdminClassifiedsState({
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
      classifiedsMeta: {
        ...DEFAULT_CLASSIFIEDS_META,
        total: 1,
        statusCounts: { all: 1, awaiting_payment: 1, active: 0, rejected: 0, expired: 0 },
      },
    });

    ({ root, container } = await renderIntoBody(ManageClassifieds));
    await flushEffects();

    expect(container.textContent).toContain('лв.2000');
    expect(container.textContent).not.toContain('$2000');
  });

  it('hydrates filters from URL params and writes updated params back on status and search changes', async () => {
    adminDataState = buildAdminClassifiedsState({
      classifieds: [
        {
          id: 18,
          status: 'active',
          category: 'cars',
          tier: 'standard',
          title: 'Admiral за продажба',
          description: 'Запазен.',
          contactName: 'Марко',
          phone: '7771234',
          createdAt: '2026-04-08T13:00:00.000Z',
          paymentRef: 'ZN-ACTIVE',
          amountDue: 500,
          currency: '$',
          images: [],
        },
      ],
      classifiedsMeta: {
        ...DEFAULT_CLASSIFIEDS_META,
        total: 2,
        statusCounts: { all: 2, awaiting_payment: 1, active: 1, rejected: 0, expired: 0 },
      },
    });
    searchParamsState = 'status=active&q=Admiral';

    ({ root, container } = await renderIntoBody(ManageClassifieds));
    await flushEffects();

    expect(ensureClassifiedsLoaded).toHaveBeenCalledWith({ page: 1, limit: 25, status: 'active', q: 'Admiral' });
    const searchInput = container.querySelector('input[aria-label="Търси малки обяви"]');
    expect(searchInput.value).toBe('Admiral');
    expect(container.textContent).toContain('Admiral за продажба');

    const allButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Всички (2)'));
    await click(allButton);
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=Admiral&page=1', { replace: true });

    await inputValue(searchInput, 'Sultan');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('q=Sultan&page=1', { replace: true });
  });

  it('bulk-approves the selected awaiting classifieds and refreshes the current page once', async () => {
    refreshClassifieds.mockResolvedValueOnce({
      items: [],
      meta: { ...DEFAULT_CLASSIFIEDS_META, totalPages: 1 },
    });
    adminDataState = buildAdminClassifiedsState({
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
        {
          id: 18,
          status: 'awaiting_payment',
          category: 'cars',
          tier: 'standard',
          title: 'Admiral за продажба',
          description: 'Запазен.',
          contactName: 'Марко',
          phone: '7771234',
          createdAt: '2026-04-08T13:00:00.000Z',
          paymentRef: 'ZN-ACTIVE',
          amountDue: 500,
          currency: '$',
          images: [],
        },
      ],
      classifiedsMeta: {
        ...DEFAULT_CLASSIFIEDS_META,
        total: 2,
        statusCounts: { all: 2, awaiting_payment: 2, active: 0, rejected: 0, expired: 0 },
      },
    });

    ({ root, container } = await renderIntoBody(ManageClassifieds));
    await flushEffects();

    const selectAll = container.querySelector('input[aria-label="Избери всички видими обяви"]');
    await click(selectAll);
    await flushEffects();

    const bulkApproveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Потвърди избраните (2)'));
    await click(bulkApproveButton);
    await flushEffects();

    expect(approveClassified).toHaveBeenCalledTimes(2);
    expect(approveClassified).toHaveBeenCalledWith(17, '');
    expect(approveClassified).toHaveBeenCalledWith(18, '');
    expect(refreshClassifieds).toHaveBeenCalledWith({ page: 1, limit: 25 });
    expect(toast.success).toHaveBeenCalledWith('Потвърдени обяви: 2');
  });
});
