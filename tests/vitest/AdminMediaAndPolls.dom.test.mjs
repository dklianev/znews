import React, { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flushEffects, inputValue, renderIntoBody, unmountRoot } from './helpers/domHarness.mjs';

const ensureMediaLoaded = vi.fn(async () => {});
const refreshMedia = vi.fn(async () => {});
const uploadMedia = vi.fn(async () => {});
const deleteMedia = vi.fn(async () => {});
const backfillMediaPipeline = vi.fn(async () => ({ generated: 1, regenerated: 0 }));
const addPoll = vi.fn(async () => {});
const updatePoll = vi.fn(async () => {});
const deletePoll = vi.fn(async () => {});

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

let adminDataState = {};
let publicDataState = {};
let searchParamsState = '';
const setSearchParamsSpy = vi.fn();

vi.mock('../../src/context/DataContext', () => ({
  useAdminData: () => adminDataState,
  usePublicData: () => publicDataState,
}));

vi.mock('../../src/components/admin/Toast', () => ({
  useToast: () => toast,
}));

vi.mock('../../src/components/admin/ImageEditorDialog', () => ({
  default: () => null,
}));

vi.mock('../../src/components/admin/UploadWatermarkToggle', () => ({
  default: ({ checked, onChange }) => createElement('button', { type: 'button', onClick: () => onChange(!checked) }, 'toggle-watermark'),
}));

vi.mock('../../src/hooks/useUploadWatermarkPreference', () => ({
  default: () => [true, vi.fn()],
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

const { default: ManageMedia } = await import('../../src/pages/admin/ManageMedia.jsx');
const { default: ManagePolls } = await import('../../src/pages/admin/ManagePolls.jsx');

describe('AdminMediaAndPolls', () => {
  let root;
  let container;

  afterEach(async () => {
    ensureMediaLoaded.mockClear();
    refreshMedia.mockClear();
    uploadMedia.mockClear();
    deleteMedia.mockClear();
    backfillMediaPipeline.mockClear();
    addPoll.mockClear();
    updatePoll.mockClear();
    deletePoll.mockClear();
    toast.success.mockClear();
    toast.error.mockClear();
    toast.warning.mockClear();
    setSearchParamsSpy.mockClear();
    adminDataState = {};
    publicDataState = {};
    searchParamsState = '';
    await unmountRoot(root, container);
    root = null;
    container = null;
  });

  it('loads, filters and refreshes media records in the admin view', async () => {
    adminDataState = {
      media: [
        { id: 'hero.jpg', name: 'hero.jpg', url: '/uploads/hero.jpg', size: 1024, pipelineReady: true },
        { id: 'crime.jpg', name: 'crime.jpg', url: '/uploads/crime.jpg', size: 2048, pipelineReady: false },
      ],
      mediaPipelineStatus: { engine: 'sharp', total: 2, ready: 1, pending: 1 },
      ensureMediaLoaded,
      uploadMedia,
      deleteMedia,
      refreshMedia,
      backfillMediaPipeline,
    };

    ({ root, container } = await renderIntoBody(ManageMedia));

    expect(ensureMediaLoaded).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('hero.jpg');
    expect(container.textContent).toContain('crime.jpg');

    const searchInput = Array.from(container.querySelectorAll('input')).at(-1);
    await inputValue(searchInput, 'crime');
    expect(container.textContent).not.toContain('hero.jpg');
    expect(container.textContent).toContain('crime.jpg');

    const refreshButton = Array.from(container.querySelectorAll('button'))[1];
    await click(refreshButton);
    expect(refreshMedia).toHaveBeenCalledTimes(1);
  });

  it('creates a new poll with two valid options', async () => {
    publicDataState = {
      polls: [],
      addPoll,
      updatePoll,
      deletePoll,
    };

    ({ root, container } = await renderIntoBody(ManagePolls));

    const newPollButton = container.querySelector('button');
    await click(newPollButton);
    await flushEffects();
    expect(container.querySelectorAll('input')).toHaveLength(4);

    await inputValue(Array.from(container.querySelectorAll('input'))[1], 'Кой печели дербито?');
    await inputValue(Array.from(container.querySelectorAll('input'))[2], 'Левски');
    await inputValue(Array.from(container.querySelectorAll('input'))[3], 'ЦСКА');

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Запази'));
    await click(saveButton);
    await flushEffects();

    expect(addPoll).toHaveBeenCalledWith(expect.objectContaining({
      question: 'Кой печели дербито?',
      active: false,
      options: [
        { text: 'Левски', votes: 0 },
        { text: 'ЦСКА', votes: 0 },
      ],
    }));
    expect(toast.success).toHaveBeenCalled();
  });

  it('exposes accessible poll row actions', async () => {
    publicDataState = {
      polls: [
        {
          id: 5,
          question: 'Ще има ли дерби?',
          active: true,
          createdAt: '2026-04-09',
          options: [
            { text: 'Да', votes: 3 },
            { text: 'Не', votes: 1 },
          ],
        },
      ],
      addPoll,
      updatePoll,
      deletePoll,
    };

    ({ root, container } = await renderIntoBody(ManagePolls));

    expect(container.querySelector('button[aria-label="Редактирай анкетата"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Деактивирай анкетата"], button[aria-label="Активирай анкетата"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Изтрий анкетата"]')).not.toBeNull();
  });

  it('hydrates poll filters from the URL and syncs search updates back', async () => {
    searchParamsState = 'status=inactive&q=%D0%BC%D0%B0%D1%80';
    publicDataState = {
      polls: [
        {
          id: 7,
          question: 'Маршрут за патрул?',
          active: false,
          createdAt: '2026-04-09',
          options: [{ text: 'Център', votes: 2 }],
        },
        {
          id: 8,
          question: 'Активна анкета',
          active: true,
          createdAt: '2026-04-09',
          options: [{ text: 'Да', votes: 5 }],
        },
      ],
      addPoll,
      updatePoll,
      deletePoll,
    };

    ({ root, container } = await renderIntoBody(ManagePolls));

    const searchInput = container.querySelector('input[aria-label="Търси анкета по въпрос или опция"]');
    expect(searchInput?.value).toBe('мар');
    expect(container.textContent).toContain('Маршрут за патрул?');
    expect(container.textContent).not.toContain('Активна анкета');

    await inputValue(searchInput, 'патрул');
    expect(setSearchParamsSpy).toHaveBeenLastCalledWith('status=inactive&q=%D0%BF%D0%B0%D1%82%D1%80%D1%83%D0%BB', { replace: true });
  });
});
