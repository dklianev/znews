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
    adminDataState = {};
    publicDataState = {};
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
    expect(container.querySelectorAll('input')).toHaveLength(3);

    await inputValue(Array.from(container.querySelectorAll('input'))[0], 'Кой печели дербито?');
    await inputValue(Array.from(container.querySelectorAll('input'))[1], 'Левски');
    await inputValue(Array.from(container.querySelectorAll('input'))[2], 'ЦСКА');

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
});
